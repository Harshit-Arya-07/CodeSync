import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketProps {
  serverPath: string;
}

interface Participant {
  id: string;
  username: string;
  joinedAt: string;
  lastSeen: string;
}

interface RoomState {
  code: string;
  language: string;
  participants: Participant[];
}

interface SocketError {
  message: string;
}

export const useSocket = ({ serverPath }: UseSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    const newSocket = io(serverPath, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
      setConnectionError(null);
      setIsReconnecting(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from server:', reason);
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        setIsReconnecting(true);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server');
      setIsConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      setIsReconnecting(false);
      setConnectionError(null);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setIsReconnecting(true);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Failed to reconnect');
      setConnectionError('Failed to reconnect to server');
      setIsReconnecting(false);
    });

    // Room events
    newSocket.on('room-state', (data: RoomState) => {
      console.log('📥 Received room state');
      setParticipants(data.participants);
    });

    newSocket.on('user-joined', (data: { user: Participant; participants: Participant[] }) => {
      console.log('👥 User joined:', data.user.username);
      setParticipants(data.participants);
    });

    newSocket.on('user-left', (data: { user: Participant; participants: Participant[] }) => {
      console.log('👋 User left:', data.user.username);
      setParticipants(data.participants);
    });

    // Error handling
    newSocket.on('error', (error: SocketError) => {
      console.error('Socket error:', error);
      setConnectionError(error.message);
    });

    // Ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping');
      }
    }, 30000);

    newSocket.on('pong', () => {
      // Connection is healthy
    });

    return () => {
      clearInterval(pingInterval);
      cleanup();
    };
  }, [serverPath, cleanup]);

  const joinRoom = useCallback((roomId: string, username: string) => {
    if (socket && isConnected) {
      console.log(`🚪 Joining room: ${roomId} as ${username}`);
      socket.emit('join-room', { roomId, username });
      setRoomId(roomId);
    } else {
      setConnectionError('Not connected to server');
    }
  }, [socket, isConnected]);

  const emitCodeChange = useCallback((code: string, language?: string) => {
    if (socket && roomId && isConnected) {
      socket.emit('code-change', { roomId, code, language });
    }
  }, [socket, roomId, isConnected]);

  const emitLanguageChange = useCallback((language: string) => {
    if (socket && roomId && isConnected) {
      socket.emit('language-change', { roomId, language });
    }
  }, [socket, roomId, isConnected]);

  const reconnect = useCallback(() => {
    if (socket) {
      setIsReconnecting(true);
      socket.connect();
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    participants,
    roomId,
    connectionError,
    isReconnecting,
    joinRoom,
    emitCodeChange,
    emitLanguageChange,
    reconnect
  };
};