import { Server } from 'socket.io';

let ioInstance = null;

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  ioInstance.on('connection', (socket) => {
    console.log(`📡 WebSocket Client Connected: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`🔌 WebSocket Client Disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIo() {
  return ioInstance;
}

export function broadcastUpdate(event, payload) {
  if (ioInstance) {
    console.log(`📣 Broadcasting WebSocket Event: ${event}`, payload);
    ioInstance.emit(event, payload);
  } else {
    console.warn('⚠️ Cannot broadcast; Socket.io is not initialized.');
  }
}
