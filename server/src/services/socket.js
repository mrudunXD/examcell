import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let ioInstance = null;
const activeKiosks = new Map();
const activeSessions = new Set();

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Verify JWT token during WebSocket handshake
  ioInstance.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // Allow unauthenticated connections (like public kiosks) but without user context
      return next();
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret_key');
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log(`📡 WebSocket Client Connected: ${socket.id}`);
    activeSessions.add(socket.id);

    // Kiosk registers its room information
    socket.on('register_kiosk', (data) => {
      console.log(`📺 Kiosk registered: Room ${data.roomNo} (Socket: ${socket.id})`);
      activeKiosks.set(socket.id, {
        socketId: socket.id,
        classroomId: data.classroomId,
        roomNo: data.roomNo,
        connectedAt: new Date().toISOString(),
        lastPing: Date.now()
      });
      ioInstance.emit('KIOSKS_UPDATED', getActiveKiosksList());
    });

    // Kiosk pings server periodically to maintain online status
    socket.on('kiosk_ping', () => {
      if (activeKiosks.has(socket.id)) {
        activeKiosks.get(socket.id).lastPing = Date.now();
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket Client Disconnected: ${socket.id}`);
      activeSessions.delete(socket.id);
      if (activeKiosks.has(socket.id)) {
        activeKiosks.delete(socket.id);
        ioInstance.emit('KIOSKS_UPDATED', getActiveKiosksList());
      }
    });
  });

  return ioInstance;
}

export function getIo() {
  return ioInstance;
}

export function getActiveKiosksList() {
  const list = [];
  const now = Date.now();
  for (const info of activeKiosks.values()) {
    const isOnline = (now - info.lastPing < 45000);
    list.push({
      ...info,
      status: isOnline ? 'online' : 'disconnected',
      secondsAgo: Math.round((now - info.lastPing) / 1000)
    });
  }
  return list;
}

export function getActiveConnectionsCount() {
  return activeSessions.size;
}

export function broadcastUpdate(event, payload) {
  if (ioInstance) {
    console.log(`📣 Broadcasting WebSocket Event: ${event}`, payload);
    ioInstance.emit(event, payload);
  } else {
    console.warn('⚠️ Cannot broadcast; Socket.io is not initialized.');
  }
}

export function triggerKioskDisconnectStorm() {
  if (!ioInstance) return;
  console.log('⚠️ Triggering WebSocket kiosk disconnect storm...');
  const sockets = ioInstance.sockets.sockets;
  for (const socket of sockets.values()) {
    socket.disconnect(true);
  }
}
