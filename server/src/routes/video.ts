import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { VIDEOS_DIR } from '../config';

const router = Router();

router.get('/api/videos', (_req, res) => {
  try {
    if (!fs.existsSync(VIDEOS_DIR)) {
      return res.json([]);
    }
    const files = fs.readdirSync(VIDEOS_DIR)
      .filter(f => /\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(f))
      .map(f => ({ name: f, path: f }));
    res.json(files);
  } catch {
    res.json([]);
  }
});

router.get('/api/video/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(VIDEOS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('File not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });

    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    });

    fs.createReadStream(filePath).pipe(res);
  }
});

export default router;
