import { useEffect, useRef, useCallback, useState } from 'react';
import { socket } from '../socket';
import Plyr from 'plyr';

interface PendingState {
  videoUrl: string;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
}
interface SyncState {
  isConnected: boolean;
  isHost: boolean;
  userCount: number;
  hostRequested: boolean;
}

function setVideoSrc(player: Plyr, url: string) {
  try {
    player.source = { type: 'video', sources: [{ src: url }] };
    console.log('[sync] source set via plyr');
  } catch (e) {
    console.warn('[sync] plyr source change failed, trying direct:', e);
    const vid = (player as any).media as HTMLVideoElement;
    vid.src = url;
    vid.load();
  }
}

export function useSync(roomId: string | null, nickname: string, playerRef: React.RefObject<Plyr | null>, onRemotePlay?: () => void) {
  const [syncState, setSyncState] = useState<SyncState>({
    isConnected: false,
    isHost: true,
    userCount: 0,
    hostRequested: false,
  });
  const isHostRef = useRef(true);
  const stateRef = useRef({ currentTime: 0, isPlaying: false, playbackRate: 1, videoUrl: '' });
  const pendingRef = useRef<PendingState | null>(null);
  const applyingSyncRef = useRef(false);
  const calibrateRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    console.log('[useSync] setup', roomId, nickname, 'connected:', socket.connected);

    const onConnect = () => {
      console.log('[useSync] connect event, emitting join-room');
      setSyncState(s => ({ ...s, isConnected: true }));
      socket.emit('join-room', { roomId, nickname });
    };
    const onDisconnect = () => setSyncState(s => ({ ...s, isConnected: false }));

    const onRoomJoined = ({ userCount }: { userCount: number }) => {
      console.log('[useSync] room-joined', { userCount, isHost: userCount === 1 });
      const host = userCount === 1;
      setSyncState(s => ({ ...s, isHost: host, userCount }));
      isHostRef.current = host;
      if (!host) {
        socket.emit('sync:requestState', { roomId });
      }
    };

    const onUserJoined = ({ userCount }: { userCount: number }) => {
      setSyncState(s => ({ ...s, userCount }));
    };

    const onPlay = ({ currentTime, timestamp }: { currentTime: number; timestamp: number }) => {
      console.log('[sync] onPlay received', { currentTime, isHost: isHostRef.current, hasPlayer: !!playerRef.current });
      const player = playerRef.current;
      if (!player) return;
      const elapsed = (Date.now() - timestamp) / 1000;
      const targetTime = currentTime + elapsed;
      if (Math.abs(player.currentTime - targetTime) > 1) {
        player.currentTime = targetTime;
      }
      applyingSyncRef.current = true;
      player.play();
      applyingSyncRef.current = false;
      onRemotePlay?.();
    };

    const onPause = ({ currentTime }: { currentTime: number }) => {
      console.log('[sync] onPause received', { currentTime, isHost: isHostRef.current, hasPlayer: !!playerRef.current });
      const player = playerRef.current;
      if (!player) return;
      if (Math.abs(player.currentTime - currentTime) > 1) {
        player.currentTime = currentTime;
      }
      applyingSyncRef.current = true;
      player.pause();
      applyingSyncRef.current = false;
    };

    const onSeek = ({ currentTime }: { currentTime: number }) => {
      if (isHostRef.current) return;
      const player = playerRef.current;
      if (!player) return;
      player.currentTime = currentTime;
    };

    const onRate = ({ playbackRate }: { playbackRate: number }) => {
      if (isHostRef.current) return;
      const player = playerRef.current;
      if (!player) return;
      player.speed = playbackRate;
    };

    const onChangeVideo = ({ videoUrl }: { videoUrl: string }) => {
      console.log('[sync] onChangeVideo', { videoUrl, isHost: isHostRef.current, hasPlayer: !!playerRef.current });
      if (isHostRef.current) return;
      stateRef.current.videoUrl = videoUrl;
      const player = playerRef.current;
      if (!player) return;
      if (videoUrl) {
        setVideoSrc(player, videoUrl);
      }
    };

    const onRequestState = () => {
      console.log('[sync] onRequestState', { isHost: isHostRef.current, hasPlayer: !!playerRef.current });
      if (!isHostRef.current) return;
      const player = playerRef.current;
      socket.emit('sync:sendState', {
        roomId,
        currentTime: player ? player.currentTime : stateRef.current.currentTime,
        isPlaying: player ? !player.paused : stateRef.current.isPlaying,
        playbackRate: player ? player.speed : stateRef.current.playbackRate,
        videoUrl: stateRef.current.videoUrl,
      });
      console.log('[sync] sendState responded', { videoUrl: stateRef.current.videoUrl });
    };

    const onSendState = ({ currentTime, isPlaying, playbackRate, videoUrl }: {
      currentTime: number; isPlaying: boolean; playbackRate: number; videoUrl: string;
    }) => {
      console.log('[sync] onSendState', { videoUrl, isPlaying, isHost: isHostRef.current, hasPlayer: !!playerRef.current });
      if (isHostRef.current) return;
      stateRef.current.videoUrl = videoUrl;
      stateRef.current.currentTime = currentTime;
      stateRef.current.isPlaying = isPlaying;
      stateRef.current.playbackRate = playbackRate;
      const player = playerRef.current;
      if (!player) {
        pendingRef.current = { videoUrl, currentTime, isPlaying, playbackRate };
        return;
      }
      if (videoUrl) {
        setVideoSrc(player, videoUrl);
      }
      player.currentTime = currentTime;
      player.speed = playbackRate;
      if (isPlaying) {
        player.play();
      } else {
        player.pause();
      }
    };

    const onCalibrate = ({ currentTime, timestamp }: { currentTime: number; timestamp: number }) => {
      if (isHostRef.current) return;
      const player = playerRef.current;
      if (!player) return;
      const elapsed = (Date.now() - timestamp) / 1000;
      const targetTime = currentTime + elapsed;
      if (Math.abs(player.currentTime - targetTime) > 2) {
        player.currentTime = targetTime;
      }
    };

    const onRequestHost = () => {
      if (!isHostRef.current) return;
      setSyncState(s => ({ ...s, hostRequested: true }));
    };

    const onAcceptHost = () => {
      if (isHostRef.current) return;
      isHostRef.current = true;
      setSyncState(s => ({ ...s, isHost: true, hostRequested: false }));
    };

    const onDeclineHost = () => {
      if (isHostRef.current) return;
      setSyncState(s => ({ ...s, hostRequested: false }));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);

    if (socket.connected) {
      onConnect();
    }
    socket.on('sync:play', onPlay);
    socket.on('sync:pause', onPause);
    socket.on('sync:seek', onSeek);
    socket.on('sync:rate', onRate);
    socket.on('sync:changeVideo', onChangeVideo);
    socket.on('sync:requestState', onRequestState);
    socket.on('sync:sendState', onSendState);
    socket.on('sync:calibrate', onCalibrate);
    socket.on('sync:requestHost', onRequestHost);
    socket.on('sync:acceptHost', onAcceptHost);
    socket.on('sync:declineHost', onDeclineHost);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('sync:play', onPlay);
      socket.off('sync:pause', onPause);
      socket.off('sync:seek', onSeek);
      socket.off('sync:rate', onRate);
      socket.off('sync:changeVideo', onChangeVideo);
      socket.off('sync:requestState', onRequestState);
      socket.off('sync:sendState', onSendState);
      socket.off('sync:calibrate', onCalibrate);
      socket.off('sync:requestHost', onRequestHost);
      socket.off('sync:acceptHost', onAcceptHost);
      socket.off('sync:declineHost', onDeclineHost);
    };
  }, [roomId, nickname, playerRef]);

  useEffect(() => {
    if (!roomId || !isHostRef.current) return;

    const startCalibrate = () => {
      if (calibrateRef.current) return;
      calibrateRef.current = setInterval(() => {
        const player = playerRef.current;
        if (!player || player.paused) return;
        socket.emit('sync:calibrate', {
          roomId,
          currentTime: player.currentTime,
          timestamp: Date.now(),
        });
      }, 5000);
    };

    const stopCalibrate = () => {
      if (calibrateRef.current) {
        clearInterval(calibrateRef.current);
        calibrateRef.current = null;
      }
    };

    const player = playerRef.current;
    if (player) {
      player.on('playing', startCalibrate);
      player.on('pause', stopCalibrate);
    }

    return () => {
      stopCalibrate();
      if (player) {
        player.off('playing', startCalibrate);
        player.off('pause', stopCalibrate);
      }
    };
  }, [roomId, playerRef]);

  const play = useCallback((currentTime: number) => {
    stateRef.current.currentTime = currentTime;
    stateRef.current.isPlaying = true;
    socket.emit('sync:play', { roomId, currentTime, timestamp: Date.now() });
  }, [roomId]);

  const pause = useCallback((currentTime: number) => {
    stateRef.current.currentTime = currentTime;
    stateRef.current.isPlaying = false;
    socket.emit('sync:pause', { roomId, currentTime, timestamp: Date.now() });
  }, [roomId]);

  const seek = useCallback((currentTime: number) => {
    stateRef.current.currentTime = currentTime;
    socket.emit('sync:seek', { roomId, currentTime, timestamp: Date.now() });
  }, [roomId]);

  const setRate = useCallback((playbackRate: number) => {
    stateRef.current.playbackRate = playbackRate;
    socket.emit('sync:rate', { roomId, playbackRate, timestamp: Date.now() });
  }, [roomId]);

  const changeVideo = useCallback((videoUrl: string) => {
    stateRef.current.videoUrl = videoUrl;
    socket.emit('sync:changeVideo', { roomId, videoUrl });
  }, [roomId]);

  const requestSync = useCallback(() => {
    socket.emit('sync:requestState', { roomId });
  }, [roomId]);

  const setPlayerReady = useCallback(() => {
    console.log('[sync] setPlayerReady, pending:', pendingRef.current);
    const pending = pendingRef.current;
    if (pending && pending.videoUrl) {
      const player = playerRef.current;
      if (player) {
        setVideoSrc(player, pending.videoUrl);
        player.currentTime = pending.currentTime;
        player.speed = pending.playbackRate;
        if (pending.isPlaying) {
          player.play();
        } else {
          player.pause();
        }
        pendingRef.current = null;
      }
    }
    requestSync();
  }, [requestSync]);

  const requestHost = useCallback(() => {
    socket.emit('sync:requestHost', { roomId });
  }, [roomId]);

  const acceptHost = useCallback(() => {
    isHostRef.current = false;
    setSyncState(s => ({ ...s, isHost: false, hostRequested: false }));
    socket.emit('sync:acceptHost', { roomId });
  }, [roomId]);

  const declineHost = useCallback(() => {
    setSyncState(s => ({ ...s, hostRequested: false }));
    socket.emit('sync:declineHost', { roomId });
  }, [roomId]);

  return {
    ...syncState,
    applyingSyncRef,
    play, pause, seek, setRate, changeVideo,
    requestSync, setPlayerReady, requestHost, acceptHost, declineHost,
  } as SyncState & {
    applyingSyncRef: React.MutableRefObject<boolean>;
    play: (t: number) => void; pause: (t: number) => void;
    seek: (t: number) => void; setRate: (r: number) => void;
    changeVideo: (u: string) => void;
    requestSync: () => void; setPlayerReady: () => void; requestHost: () => void;
    acceptHost: () => void; declineHost: () => void;
  };
}
