import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:4173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:4173"],
  credentials: true
}));
app.use(express.json());

// Store room data in memory (in production, use Redis or database)
const rooms = new Map();
const userSockets = new Map(); // Track user socket connections

// Helper function to get or create room
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      code: `// Welcome to CodeSync - Real-time Collaborative Editor!
// Share this room ID with others to collaborate: ${roomId}

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Try editing this code with multiple users!
console.log('Fibonacci sequence:');
for (let i = 0; i < 10; i++) {
  console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}

// Features:
// ✨ Real-time collaboration
// 🎨 Syntax highlighting
// 🔄 Auto-save
// 👥 Live user presence
// 🚀 Multiple language support`,
      language: 'javascript',
      participants: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
  }
  return rooms.get(roomId);
}

// Clean up inactive rooms (older than 24 hours with no activity)
function cleanupInactiveRooms() {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [roomId, room] of rooms.entries()) {
    if (room.participants.size === 0 && (now - room.lastActivity) > maxAge) {
      rooms.delete(roomId);
      console.log(`🧹 Cleaned up inactive room: ${roomId}`);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupInactiveRooms, 60 * 60 * 1000);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    rooms: rooms.size,
    connections: userSockets.size,
    uptime: process.uptime()
  });
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    id: room.id,
    participantCount: room.participants.size,
    language: room.language,
    createdAt: room.createdAt,
    lastActivity: room.lastActivity
  });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  userSockets.set(socket.id, { connectedAt: new Date() });

  socket.on('join-room', (data) => {
    try {
      const { roomId, username } = data;
      
      if (!roomId || !username) {
        socket.emit('error', { message: 'Room ID and username are required' });
        return;
      }

      const room = getOrCreateRoom(roomId);
      
      // Leave any previous rooms
      Array.from(socket.rooms).forEach(room => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
      
      // Join the new room
      socket.join(roomId);
      
      // Add participant to room
      const participant = {
        id: socket.id,
        username: username.trim(),
        joinedAt: new Date(),
        lastSeen: new Date()
      };
      
      room.participants.set(socket.id, participant);
      room.lastActivity = new Date();
      
      // Send current room state to the joining user
      socket.emit('room-state', {
        code: room.code,
        language: room.language,
        participants: Array.from(room.participants.values())
      });
      
      // Notify others in the room
      socket.to(roomId).emit('user-joined', {
        user: participant,
        participants: Array.from(room.participants.values())
      });
      
      console.log(`👥 User ${username} (${socket.id}) joined room ${roomId}`);
      
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  socket.on('code-change', (data) => {
    try {
      const { roomId, code, language } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      // Update room data
      if (code !== undefined) room.code = code;
      if (language) room.language = language;
      room.lastActivity = new Date();
      
      // Update participant's last seen
      const participant = room.participants.get(socket.id);
      if (participant) {
        participant.lastSeen = new Date();
      }
      
      // Broadcast to all other users in the room
      socket.to(roomId).emit('code-update', { 
        code: room.code, 
        language: room.language,
        updatedBy: participant?.username || 'Unknown'
      });
      
    } catch (error) {
      console.error('Error handling code change:', error);
      socket.emit('error', { message: 'Failed to update code' });
    }
  });

  socket.on('language-change', (data) => {
    try {
      const { roomId, language } = data;
      const room = rooms.get(roomId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      room.language = language;
      room.lastActivity = new Date();
      
      const participant = room.participants.get(socket.id);
      
      socket.to(roomId).emit('language-update', { 
        language,
        updatedBy: participant?.username || 'Unknown'
      });
      
    } catch (error) {
      console.error('Error handling language change:', error);
      socket.emit('error', { message: 'Failed to update language' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 User disconnected: ${socket.id} (${reason})`);
    
    // Remove from user tracking
    userSockets.delete(socket.id);
    
    // Remove user from all rooms
    rooms.forEach((room, roomId) => {
      const participant = room.participants.get(socket.id);
      if (participant) {
        room.participants.delete(socket.id);
        room.lastActivity = new Date();
        
        // Notify others in the room
        socket.to(roomId).emit('user-left', {
          user: participant,
          participants: Array.from(room.participants.values())
        });
        
        console.log(`👋 User ${participant.username} left room ${roomId}`);
        
        // Clean up empty rooms immediately
        if (room.participants.size === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Room ${roomId} deleted (empty)`);
        }
      }
    });
  });

  // Handle ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});