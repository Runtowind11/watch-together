import { useRef, useState, useCallback, useEffect } from 'react';
import Plyr from 'plyr';
import VideoPlayer from '../components/VideoPlayer';
import SyncStatus from '../components/SyncStatus';
import Toast from '../components/Toast';
import { useSync } from '../hooks/useSync';

const TEST_VIDEO_URL = '';

interface WatchRoomProps {
  roomId: string;
  nickname: string;
  onLeave: () => void;
}

interface VideoFile {
  name: string;
  path: string;
}

interface ToastData {
  message: string;
  type: 'info' | 'success' | 'error';
}

type HostTab = 'url' | 'local' | 'upload';

export default function WatchRoom({ roomId, nickname, onLeave }: WatchRoomProps) {
  const playerRef = useRef<Plyr>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const pendingVideoNameRef = useRef('');
  const [videoUrl, setVideoUrl] = useState(TEST_VIDEO_URL);
  const [urlInput, setUrlInput] = useState('');
  const [localVideos, setLocalVideos] = useState<VideoFile[]>([]);
  const [hostTab, setHostTab] = useState<HostTab>('url');
  const [toast, setToast] = useState<ToastData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const cinemaRef = useRef(false);

  const enterCinema = useCallback(() => {
    if (cinemaRef.current) return;
    cinemaRef.current = true;
    roomRef.current?.classList.add('cinema-mode');
  }, []);

  const leaveCinema = useCallback(() => {
    cinemaRef.current = false;
    roomRef.current?.classList.remove('cinema-mode');
  }, []);

  const {
    isConnected, isHost, userCount, hostRequested,
    applyingSyncRef,
    play, pause, seek, setRate, changeVideo,
    requestSync, setPlayerReady, requestHost, acceptHost, declineHost,
  } = useSync(roomId, nickname, playerRef, enterCinema, (name) => {
    showToast(`"${name}" 进入了房间`, 'info');
  });

  const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchVideos = useCallback(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(setLocalVideos)
      .catch(() => showToast('无法获取视频列表', 'error'));
  }, [showToast]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  const handlePlay = useCallback((currentTime: number) => {
    if (applyingSyncRef.current) return;
    enterCinema();
    play(currentTime);
  }, [play, applyingSyncRef, enterCinema]);

  const handlePause = useCallback((currentTime: number) => {
    if (applyingSyncRef.current) return;
    pause(currentTime);
  }, [pause, applyingSyncRef]);

  const handleSeek = useCallback((currentTime: number) => {
    if (isHost) seek(currentTime);
  }, [isHost, seek]);

  const handleRate = useCallback((rate: number) => {
    if (isHost) setRate(rate);
  }, [isHost, setRate]);

  const handlePlaying = useCallback(() => {
    if (pendingVideoNameRef.current) {
      showToast(`正在播放: ${pendingVideoNameRef.current}`, 'success');
      pendingVideoNameRef.current = '';
    }
  }, [showToast]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    playVideo(urlInput.trim());
  };

  const handleSelectLocalVideo = (file: VideoFile) => {
    const url = `/api/video/${file.path}`;
    playVideo(url);
    pendingVideoNameRef.current = file.name;
  };

  const playVideo = (url: string) => {
    setVideoUrl(url);
    changeVideo(url);
  };

  const CHUNK_SIZE = 5 * 1024 * 1024;
  const UPLOAD_CONCURRENCY = 4;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    const uploadChunk = async (chunkIndex: number): Promise<void> => {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const formData = new FormData();
      formData.append('video', file.slice(start, end));
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(chunkIndex));
      formData.append('totalChunks', String(totalChunks));
      formData.append('filename', file.name);

      const res = await fetch('/api/upload-chunk', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '上传失败' }));
        throw new Error(data.error || `分片 ${chunkIndex} 失败`);
      }
    };

    let completed = 0;
    const errors: string[] = [];
    const runWorker = async (startIdx: number) => {
      for (let i = startIdx; i < totalChunks; i += UPLOAD_CONCURRENCY) {
        if (errors.length > 0) return;
        try {
          await uploadChunk(i);
          completed++;
          setUploadProgress(Math.round((completed / totalChunks) * 100));
        } catch (err) {
          errors.push(String(err));
          return;
        }
      }
    };

    await Promise.all(
      Array.from({ length: UPLOAD_CONCURRENCY }, (_, i) => runWorker(i))
    );

    if (errors.length > 0) {
      setUploading(false);
      showToast('上传失败，请检查网络', 'error');
      e.target.value = '';
      return;
    }

    try {
      const mergeRes = await fetch('/api/upload-chunk/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId, filename: file.name, totalChunks }),
      });

      if (!mergeRes.ok) throw new Error('合并失败');

      const result = await mergeRes.json();
      playVideo(result.url);
      showToast(`上传完成: ${file.name}`, 'success');
      fetchVideos();
    } catch {
      showToast('文件合并失败', 'error');
    }

    setUploading(false);
    e.target.value = '';
  };

  const handleRequestHost = () => {
    requestHost();
    showToast('已向主控请求切换角色', 'info');
  };

  const handleAcceptHost = () => {
    acceptHost();
    showToast('已将主控权限移交', 'success');
  };

  const handleDeclineHost = () => {
    declineHost();
  };

  return (
    <div ref={roomRef} className="watch-room">
      <div className="room-header">
        <div className="header-left">
          <span className="room-id">房间: {roomId}</span>
          <SyncStatus isConnected={isConnected} isHost={isHost} userCount={userCount} />
        </div>
        <div className="header-right">
          <button onClick={leaveCinema} className="minimize-btn">收起</button>
          <span className="regular-btns">
            {!isHost && (
              <button onClick={handleRequestHost} className="host-request-btn">切换主控</button>
            )}
            <button onClick={requestSync} className="sync-btn">同步</button>
            <button onClick={onLeave} className="leave-btn">离开</button>
          </span>
        </div>
      </div>

      <VideoPlayer
        ref={playerRef}
        videoUrl={videoUrl}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onRate={handleRate}
        onReady={() => {
          console.log('[WatchRoom] onReady');
          setPlayerReady();
        }}
        onPlaying={handlePlaying}
      />

      {isHost && (
        <div className="host-controls">
          <div className="control-tabs">
            <button className={hostTab === 'url' ? 'active' : ''} onClick={() => setHostTab('url')}>URL</button>
            <button className={hostTab === 'local' ? 'active' : ''} onClick={() => setHostTab('local')}>本地</button>
            <button className={hostTab === 'upload' ? 'active' : ''} onClick={() => setHostTab('upload')}>上传</button>
          </div>

          {hostTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="url-form">
              <input type="text" placeholder="输入视频URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} />
              <button type="submit">播放</button>
            </form>
          )}

          {hostTab === 'local' && (
            <div className="local-files">
              {localVideos.length === 0 ? (
                <p className="empty-hint">还没有视频，切换到「上传」上传一个</p>
              ) : (
                localVideos.map(f => (
                  <button key={f.path} className="file-item" onClick={() => handleSelectLocalVideo(f)}>
                    {f.name}
                  </button>
                ))
              )}
              <button className="refresh-btn" onClick={fetchVideos}>刷新列表</button>
            </div>
          )}

          {hostTab === 'upload' && (
            <div className="upload-area">
              {uploading ? (
                <div className="upload-progress">
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress}%` }} /></div>
                  <span className="progress-text">上传中 {uploadProgress}%</span>
                </div>
              ) : (
                <label className="upload-btn">
                  选择视频文件
                  <input type="file" accept="video/*" onChange={handleFileUpload} hidden />
                </label>
              )}
              <p className="upload-hint">支持 mp4 / webm / mkv / avi / mov，最大 10GB</p>
            </div>
          )}
        </div>
      )}

      <div className="room-info">
        <span>{nickname}</span>
        <span className="sep">·</span>
        <span>{isHost ? '主控中' : '跟随中'}</span>
        {!isHost && <><span className="sep">·</span><span className="hint">点击「同步」对齐位置</span></>}
      </div>

      {hostRequested && (
        <div className="dialog-overlay">
          <div className="dialog">
            <p>对方请求成为主控，是否同意？</p>
            <div className="dialog-actions">
              <button onClick={handleAcceptHost} className="primary-btn">同意</button>
              <button onClick={handleDeclineHost} className="cancel-btn">拒绝</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
