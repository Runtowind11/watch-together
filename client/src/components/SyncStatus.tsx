interface SyncStatusProps {
  isConnected: boolean;
  isHost: boolean;
  userCount: number;
}

export default function SyncStatus({ isConnected, isHost, userCount }: SyncStatusProps) {
  return (
    <div className="sync-status">
      <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
      <span>
        {isConnected ? '已连接' : '未连接'} · {userCount}/2 人 · {isHost ? '主控' : '跟随'}
      </span>
    </div>
  );
}
