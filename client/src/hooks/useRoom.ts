import { useState, useCallback, useEffect } from 'react';
import { socket } from '../socket';

const STORAGE_KEY = 'watch-together-room';

function loadSession(): { roomId: string; nickname: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveSession(roomId: string, nickname: string) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId, nickname }));
}

function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function useRoom() {
  const [roomId, setRoomId] = useState<string | null>(() => {
    const saved = loadSession();
    return saved ? saved.roomId : null;
  });
  const [nickname, setNickname] = useState(() => {
    const saved = loadSession();
    return saved ? saved.nickname : '';
  });

  useEffect(() => {
    if (roomId && nickname) {
      socket.connect();
    }
  }, []);

  const createRoom = useCallback((name: string) => {
    const id = Math.random().toString(36).substring(2, 8);
    setNickname(name);
    setRoomId(id);
    saveSession(id, name);
    socket.connect();
  }, []);

  const joinRoom = useCallback((id: string, name: string) => {
    setNickname(name);
    setRoomId(id);
    saveSession(id, name);
    socket.connect();
  }, []);

  const leaveRoom = useCallback(() => {
    socket.disconnect();
    setRoomId(null);
    setNickname('');
    clearSession();
  }, []);

  return { roomId, nickname, createRoom, joinRoom, leaveRoom };
}
