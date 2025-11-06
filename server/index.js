import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ORIGIN = process.env.ORIGIN || ["http://localhost:5173", "http://localhost:4173"];

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ORIGIN,
  credentials: true
}));
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  
  // Handle SPA routing - must be after API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Store room data in memory (in production, use Redis or database)
const rooms = new Map();
const userSockets = new Map(); // Track user socket connections

// ---------- Code Execution (JavaScript) ----------
const EXECUTION_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 64 * 1024; // 64KB

async function runJavaScript(code) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'codesync-'));
  const filePath = path.join(tempDir, 'main.mjs');
  await writeFile(filePath, code, 'utf8');

  return limitedSpawn(process.execPath, [filePath], { cwd: tempDir, env: { ...process.env, NODE_NO_WARNINGS: '1' } }, () => rm(tempDir, { recursive: true, force: true }));
}

// Generic limited spawn helper with timeout/output caps and optional cleanup
function limitedSpawn(cmd, args, options, cleanup) {
  return new Promise((resolve) => {
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let outputTruncated = false;
    let timedOut = false;
    let spawnError;

    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    const killChild = () => {
      if (!child.killed) {
        try { child.kill('SIGKILL'); } catch {}
      }
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      killChild();
    }, EXECUTION_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
        const remaining = Math.max(0, MAX_OUTPUT_BYTES - stdout.length);
        stdout = Buffer.concat([stdout, chunk.slice(0, remaining)]);
        outputTruncated = true;
        killChild();
      } else {
        stdout = Buffer.concat([stdout, chunk]);
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length + chunk.length > MAX_OUTPUT_BYTES) {
        const remaining = Math.max(0, MAX_OUTPUT_BYTES - stderr.length);
        stderr = Buffer.concat([stderr, chunk.slice(0, remaining)]);
        outputTruncated = true;
        killChild();
      } else {
        stderr = Buffer.concat([stderr, chunk]);
      }
    });

    const done = async (payload) => {
      clearTimeout(timeout);
      if (cleanup) {
        try { await cleanup(); } catch {}
      }
      resolve(payload);
    };

    child.on('error', (err) => {
      spawnError = err && err.code ? String(err.code) : String(err);
    });

    child.on('close', (code, signal) => {
      done({
        exitCode: code,
        signal,
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        timedOut,
        outputTruncated,
        spawnError,
      });
    });
  });
}

async function runPython(code) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'codesync-'));
  const filePath = path.join(tempDir, 'main.py');
  await writeFile(filePath, code, 'utf8');

  // Try python, then py -3 (Windows)
  let res = await limitedSpawn('python', [filePath], { cwd: tempDir }, () => rm(tempDir, { recursive: true, force: true }));
  if (res.spawnError === 'ENOENT') {
    res = await limitedSpawn('py', ['-3', filePath], { cwd: tempDir }, () => rm(tempDir, { recursive: true, force: true }));
  }
  return res;
}

async function runJava(code) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'codesync-'));
  const srcPath = path.join(tempDir, 'Main.java');
  await writeFile(srcPath, code, 'utf8');

  // Compile
  const compile = await limitedSpawn('javac', [srcPath], { cwd: tempDir }, null);
  if (compile.spawnError === 'ENOENT') {
    await rm(tempDir, { recursive: true, force: true });
    return { exitCode: null, stdout: '', stderr: 'javac not found. Install JDK.', timedOut: false, outputTruncated: false };
  }
  if (compile.exitCode !== 0) {
    await rm(tempDir, { recursive: true, force: true });
    return { ...compile };
  }

  // Run
  const cp = tempDir; // classpath
  const run = await limitedSpawn('java', ['-cp', cp, 'Main'], { cwd: tempDir }, () => rm(tempDir, { recursive: true, force: true }));
  if (run.spawnError === 'ENOENT') {
    run.stderr = (run.stderr || '') + (run.stderr ? '\n' : '') + 'java not found. Install JRE/JDK.';
  }
  return run;
}

async function runCpp(code) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'codesync-'));
  const srcPath = path.join(tempDir, 'main.cpp');
  await writeFile(srcPath, code, 'utf8');
  const exeName = process.platform === 'win32' ? 'main.exe' : 'main';
  const exePath = path.join(tempDir, exeName);

  // Compile
  let compile = await limitedSpawn('g++', ['-O2', '-std=c++17', '-o', exePath, srcPath], { cwd: tempDir }, null);
  if (compile.spawnError === 'ENOENT') {
    // Try clang++ as fallback
    compile = await limitedSpawn('clang++', ['-O2', '-std=c++17', '-o', exePath, srcPath], { cwd: tempDir }, null);
  }
  if (compile.spawnError === 'ENOENT') {
    await rm(tempDir, { recursive: true, force: true });
    return { exitCode: null, stdout: '', stderr: 'C++ compiler not found (g++/clang++).', timedOut: false, outputTruncated: false };
  }
  if (compile.exitCode !== 0) {
    await rm(tempDir, { recursive: true, force: true });
    return { ...compile };
  }

  // Run
  const runCmd = process.platform === 'win32' ? exePath : `./${exeName}`;
  const run = await limitedSpawn(runCmd, [], { cwd: tempDir }, () => rm(tempDir, { recursive: true, force: true }));
  return run;
}

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

  // Run code in room (supports JavaScript, Python, Java, C++)
  socket.on('run-code', async (data) => {
    try {
      const { roomId, code, language } = data || {};
      if (!roomId || typeof code !== 'string' || !language) {
        socket.emit('error', { message: 'Invalid run request' });
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const participant = room.participants.get(socket.id);
      const startedAt = Date.now();

      let result;
      switch (language) {
        case 'javascript':
        case 'typescript':
          result = await runJavaScript(code);
          break;
        case 'python':
          result = await runPython(code);
          break;
        case 'java':
          result = await runJava(code);
          break;
        case 'cpp':
          result = await runCpp(code);
          break;
        default:
          io.to(roomId).emit('run-result', {
            roomId,
            language,
            startedAt,
            durationMs: 0,
            exitCode: null,
            stdout: '',
            stderr: `Execution for language "${language}" is not supported yet.`,
            timedOut: false,
            outputTruncated: false,
            initiatedBy: participant?.username || 'Unknown',
          });
          return;
      }

      const durationMs = Date.now() - startedAt;
      io.to(roomId).emit('run-result', {
        roomId,
        language,
        startedAt,
        durationMs,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        timedOut: result.timedOut,
        outputTruncated: result.outputTruncated,
        initiatedBy: participant?.username || 'Unknown',
      });
    } catch (error) {
      console.error('Error running code:', error);
      socket.emit('error', { message: 'Failed to run code' });
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
