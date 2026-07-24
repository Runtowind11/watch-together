import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { VIDEOS_DIR } from '../config';

const CHUNKS_DIR = path.join(VIDEOS_DIR, '..', 'tmp_chunks');

if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: VIDEOS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    const safe = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    cb(null, `${safe}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}`));
    }
  },
});

const chunkStorage = multer.diskStorage({
  destination: CHUNKS_DIR,
  filename: (_req, file, cb) => {
    cb(null, `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router = Router();

router.post('/api/upload', (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '文件大小超过 4GB' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择视频文件' });
    }

    const filename = req.file.filename;
    res.json({
      name: filename,
      path: filename,
      url: `/api/video/${filename}`,
    });
  });
});

router.post('/api/upload-chunk', (req, res) => {
  chunkUpload.single('video')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: '分片上传失败: ' + err.message });
    }

    const file = req.file;
    const { uploadId, chunkIndex, filename } = req.body;

    if (!file || !uploadId || chunkIndex === undefined || !filename) {
      if (file) fs.unlinkSync(file.path);
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const sessionDir = path.join(CHUNKS_DIR, uploadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const ext = path.extname(filename).toLowerCase();
    const allowed = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.m4v'];
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: `不支持的文件格式: ${ext}` });
    }

    const chunkPath = path.join(sessionDir, String(chunkIndex));
    fs.renameSync(file.path, chunkPath);

    res.json({ ok: true });
  });
});

router.post('/api/upload-chunk/merge', (req, res) => {
  const { uploadId, filename, totalChunks } = req.body;

  if (!uploadId || !filename || totalChunks === undefined) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const sessionDir = path.join(CHUNKS_DIR, uploadId);
  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: '上传会话不存在' });
  }

  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  const finalName = `${safeName}_${Date.now()}${ext}`;
  const finalPath = path.join(VIDEOS_DIR, finalName);

  const writeStream = fs.createWriteStream(finalPath);
  let index = 0;
  const total = Number(totalChunks);

  const appendNext = () => {
    if (index >= total) {
      writeStream.end();
      return;
    }

    const chunkPath = path.join(sessionDir, String(index));
    if (!fs.existsSync(chunkPath)) {
      writeStream.destroy();
      fs.unlinkSync(finalPath);
      return res.status(400).json({ error: `缺少分片 ${index}` });
    }

    const readStream = fs.createReadStream(chunkPath);
    readStream.pipe(writeStream, { end: false });
    readStream.on('end', () => {
      index++;
      appendNext();
    });
    readStream.on('error', () => {
      writeStream.destroy();
      fs.unlinkSync(finalPath);
      res.status(500).json({ error: '分片读取失败' });
    });
  };

  writeStream.on('finish', () => {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    res.json({
      name: finalName,
      path: finalName,
      url: `/api/video/${finalName}`,
    });
  });

  writeStream.on('error', () => {
    res.status(500).json({ error: '合并失败' });
  });

  appendNext();
});

export default router;