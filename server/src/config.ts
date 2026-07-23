import path from 'path';

export const SERVER_PORT = Number(process.env.PORT) || 3001;
export const VIDEOS_DIR = path.join(__dirname, '..', 'videos');
export const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
