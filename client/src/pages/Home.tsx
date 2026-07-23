import { useState } from 'react';

interface HomeProps {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (roomId: string, nickname: string) => void;
}

export default function Home({ onCreateRoom, onJoinRoom }: HomeProps) {
  const [nickname, setNickname] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    if (mode === 'create') {
      onCreateRoom(nickname.trim());
    } else {
      if (!roomId.trim()) return;
      onJoinRoom(roomId.trim(), nickname.trim());
    }
  };

  return (
    <div className="home-page">
      <h1>一起观影</h1>
      <p className="subtitle">和你的TA同步看电影</p>

      <div className="mode-switch">
        <button
          className={mode === 'create' ? 'active' : ''}
          onClick={() => setMode('create')}
        >
          创建房间
        </button>
        <button
          className={mode === 'join' ? 'active' : ''}
          onClick={() => setMode('join')}
        >
          加入房间
        </button>
      </div>

      <form onSubmit={handleSubmit} className="room-form">
        <input
          type="text"
          placeholder="你的昵称"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
        />
        {mode === 'join' && (
          <input
            type="text"
            placeholder="房间号"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
        )}
        <button type="submit" className="primary-btn">
          {mode === 'create' ? '创建房间' : '加入房间'}
        </button>
      </form>
    </div>
  );
}
