import { useState, useCallback } from 'react';
import { socket } from '../socket';

export function useRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  const createRoom = useCallback((name: string) => {
    const id = Math.random().toString(36).substring(2, 8);
    setNickname(name);
    setRoomId(id);
    socket.connect();
  }, []);

  const joinRoom = useCallback((id: string, name: string) => {
    setNickname(name);
    setRoomId(id);
    socket.connect();
  }, []);

  const leaveRoom = useCallback(() => {
    socket.disconnect();
    setRoomId(null);
  }, []);

  return { roomId, nickname, createRoom, joinRoom, leaveRoom };
}
