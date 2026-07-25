import { useRef, useEffect, forwardRef } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface VideoPlayerProps {
  videoUrl: string;
  onPlay?: (currentTime: number) => void;
  onPause?: (currentTime: number) => void;
  onSeek?: (currentTime: number) => void;
  onRate?: (playbackRate: number) => void;
  onReady?: () => void;
  onPlaying?: () => void;
}

const VideoPlayer = forwardRef<Plyr, VideoPlayerProps>(
  ({ videoUrl, onPlay, onPause, onSeek, onRate, onReady, onPlaying }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let player: Plyr;
      try {
        player = new Plyr(video, {
          controls: ['play-large', 'play', 'progress', 'current-time', 'settings', 'fullscreen'],
          settings: ['speed'],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
          fullscreen: { enabled: true, iosNative: true },
        });
      } catch (err) {
        console.error('[VideoPlayer] Plyr init error:', err);
        return;
      }

      if (typeof ref === 'function') {
        ref(player);
      } else if (ref) {
        (ref as React.MutableRefObject<Plyr>).current = player;
      }

      player.on('play', () => onPlay?.(player.currentTime));
      player.on('pause', () => onPause?.(player.currentTime));
      player.on('seeked', () => onSeek?.(player.currentTime));
      player.on('ratechange', () => onRate?.(player.speed));
      player.on('playing', () => onPlaying?.());

      onReady?.();

      return () => {
        player.destroy();
        if (typeof ref === 'function') {
          ref(null);
        } else if (ref) {
          (ref as React.MutableRefObject<Plyr | null>).current = null;
        }
      };
    }, [ref]);

    useEffect(() => {
      if (!videoUrl) return;
      const player = ref && 'current' in ref ? ref.current : null;
      const video = videoRef.current;

      try {
        if (player) {
          player.source = { type: 'video', sources: [{ src: videoUrl }] };
        }
      } catch {}

      if (video) {
        video.src = videoUrl;
        video.load();
      }
    }, [videoUrl, ref]);

    return (
      <div className="video-wrapper">
        <video ref={videoRef} playsInline webkit-playsinline="true" />
      </div>
    );
  }
);

export default VideoPlayer;