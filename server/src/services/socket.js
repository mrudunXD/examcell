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

  const ipConnections = new Map();

  // Verify JWT token and apply IP connection limiting during WebSocket handshake
  ioInstance.use((socket, next) => {
    const ip = socket.handshake.address;
    const currentCount = ipConnections.get(ip) || 0;
    if (currentCount >= 10) {
      return next(new Error('Too many connections from this IP.'));
    }
    ipConnections.set(ip, currentCount + 1);

    socket.on('disconnect', () => {
      const count = ipConnections.get(ip) || 1;
      if (count <= 1) {
        ipConnections.delete(ip);
      } else {
        ipConnections.set(ip, count - 1);
      }
    });

    let token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token && socket.handshake.headers.cookie) {
      const cookies = {};
      socket.handshake.headers.cookie.split(';').forEach(c => {
        const parts = c.split('=');
        cookies[parts.shift().trim()] = decodeURIComponent(parts.join('='));
      });
      token = cookies.token;
    }

    if (!token) {
      return next();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return next(new Error('Server misconfiguration: JWT_SECRET not set'));
    }

    try {
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Authentication error'));
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log(`📡 WebSocket Client Connected: ${socket.id}`);
    activeSessions.add(socket.id);

    // Message rate limiter per socket connection
    let messageCount = 0;
    const rateLimitWindowMs = 60 * 1000;
    const maxMessagesPerWindow = 60;
    let windowStart = Date.now();

    socket.use(([event, ...args], next) => {
      const now = Date.now();
      if (now - windowStart > rateLimitWindowMs) {
        windowStart = now;
        messageCount = 0;
      }
      messageCount++;
      if (messageCount > maxMessagesPerWindow) {
        console.warn(`⚠️ WebSocket Rate Limit exceeded for client ${socket.id}`);
        return next(new Error('Rate limit exceeded.'));
      }
      next();
    });

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

    socket.on('kiosk_acknowledge', async (data) => {
      const { broadcastId, classroomId, userId } = data;
      console.log(`📺 Kiosk Acknowledged: Broadcast ${broadcastId} in Room ${classroomId} by user ${userId}`);
      try {
        const { getDb } = await import('../db/database.js');
        const db = getDb();
        await db.prepare(`
          INSERT INTO broadcast_acknowledgments (broadcast_id, classroom_id, acknowledged_by)
          VALUES (?, ?, ?)
          ON CONFLICT (broadcast_id, classroom_id) DO NOTHING
        `).run(broadcastId, classroomId, userId || null);

        ioInstance.emit('BROADCAST_ACKNOWLEDGED', { broadcastId, classroomId, acknowledgedAt: new Date().toISOString() });
      } catch (err) {
        console.error('Failed to save kiosk acknowledgment:', err.message);
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

export function broadcastTargetedUpdate(classroomId, event, payload) {
  if (ioInstance) {
    console.log(`📣 Broadcasting Targeted Event to Room ${classroomId}: ${event}`, payload);
    for (const [socketId, info] of activeKiosks.entries()) {
      if (String(info.classroomId) === String(classroomId)) {
        ioInstance.to(socketId).emit(event, payload);
      }
    }
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
