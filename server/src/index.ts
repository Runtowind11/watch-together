import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { exec } from 'child_process';
import { SERVER_PORT, CLIENT_DIST, VIDEOS_DIR } from './config';
import videoRouter from './routes/video';
import uploadRouter from './routes/upload';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use(videoRouter);
app.use(uploadRouter);

const distExists = fs.existsSync(CLIENT_DIST);
if (distExists) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) return;
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('join-room', ({ roomId, nickname }) => {
    socket.join(roomId);
    const room = io.sockets.adapter.rooms.get(roomId);
    const userCount = room ? room.size : 0;
    console.log(`[join-room] ${nickname} (${socket.id}) -> ${roomId} (${userCount})`);

    socket.to(roomId).emit('user-joined', { nickname, userCount });
    socket.emit('room-joined', { roomId, userCount });

    (socket as any).__roomId = roomId;
  });

  socket.on('sync:play', ({ roomId, currentTime, timestamp }) => {
    socket.to(roomId).emit('sync:play', { currentTime, timestamp });
  });

  socket.on('sync:pause', ({ roomId, currentTime, timestamp }) => {
    socket.to(roomId).emit('sync:pause', { currentTime, timestamp });
  });

  socket.on('sync:seek', ({ roomId, currentTime, timestamp }) => {
    socket.to(roomId).emit('sync:seek', { currentTime, timestamp });
  });

  socket.on('sync:rate', ({ roomId, playbackRate, timestamp }) => {
    socket.to(roomId).emit('sync:rate', { playbackRate, timestamp });
  });

  socket.on('sync:changeVideo', ({ roomId, videoUrl }) => {
    socket.to(roomId).emit('sync:changeVideo', { videoUrl });
  });

  socket.on('sync:requestState', ({ roomId }) => {
    socket.to(roomId).emit('sync:requestState', {});
  });

  socket.on('sync:sendState', ({ roomId, currentTime, isPlaying, playbackRate, videoUrl }) => {
    socket.to(roomId).emit('sync:sendState', { currentTime, isPlaying, playbackRate, videoUrl });
  });

  socket.on('sync:calibrate', ({ roomId, currentTime, timestamp }) => {
    socket.to(roomId).emit('sync:calibrate', { currentTime, timestamp });
  });

  socket.on('sync:requestHost', ({ roomId, nickname }) => {
    socket.to(roomId).emit('sync:requestHost', { nickname });
  });

  socket.on('sync:acceptHost', ({ roomId }) => {
    socket.to(roomId).emit('sync:acceptHost', {});
  });

  socket.on('sync:declineHost', ({ roomId }) => {
    socket.to(roomId).emit('sync:declineHost', {});
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const roomId = (socket as any).__roomId;
    if (roomId && io.sockets.adapter.rooms.has(roomId)) {
      const room = io.sockets.adapter.rooms.get(roomId)!;
      socket.to(roomId).emit('user-left', { userCount: room.size });
    }
  });
});

httpServer.listen(SERVER_PORT, () => {
  console.log(`Server running on http://localhost:${SERVER_PORT}`);

  // Optimize existing MP4 videos in background
  exec('ffmpeg -version', (noFfmpeg) => {
    if (noFfmpeg) {
      console.log('[optimize] ffmpeg not found, skip existing videos optimization');
      return;
    }
    if (!fs.existsSync(VIDEOS_DIR)) return;
    const files = fs.readdirSync(VIDEOS_DIR).filter(f => /\.mp4$/i.test(f));
    if (files.length === 0) return;
    console.log(`[optimize] optimizing ${files.length} existing MP4 files...`);
    let i = 0;
    const next = () => {
      if (i >= files.length) {
        console.log('[optimize] done');
        return;
      }
      const file = files[i++];
      const fullPath = path.join(VIDEOS_DIR, file);
      const tmpPath = fullPath + '.opt.mp4';
      exec(
        `ffmpeg -i "${fullPath}" -movflags +faststart -codec copy -y "${tmpPath}"`,
        (err) => {
          if (err) {
            try { fs.unlinkSync(tmpPath); } catch {}
          } else {
            try {
              fs.renameSync(tmpPath, fullPath);
              console.log(`[optimize]  ${file}`);
            } catch {}
          }
          setTimeout(next, 100);
        },
      );
    };
    next();
  });
});
