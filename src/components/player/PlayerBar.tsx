import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListMusic,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import Slider from '@/components/ui/Slider';
import SleepTimerButton from '@/components/ui/SleepTimerButton';
import ArtworkImage from '@/components/ui/ArtworkImage';
import { lyricSyncEngine } from '@/services/lyrics/sync';
import { useLightingStore } from '@/stores/lightingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function PlayerBar() {
  const navigate = useNavigate();

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isLoading = usePlayerStore((s) => s.isLoading);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffleActive = usePlayerStore((s) => s.shuffleActive);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricLine = usePlayerStore((s) => s.currentLyricLine);
  const currentLyricWord = usePlayerStore((s) => s.currentLyricWord);

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);

  const overlayMode = useUIStore((s) => s.overlayMode);
  const setOverlayMode = useUIStore((s) => s.setOverlayMode);
  const visualizationMode = useUIStore((s) => s.visualizationMode);
  const setVisualizationMode = useUIStore((s) => s.setVisualizationMode);
  const miniPlayerEnabled = useLightingStore((s) => s.miniPlayerEnabled);
  const setMiniPlayerEnabled = useLightingStore((s) => s.setMiniPlayerEnabled);

  const prevVolumeRef = useRef(0.75);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);

  // Sync playback state to Floating Mini Player window
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.sendMiniPlayerState) return;
    const activeLine =
      lyrics && currentLyricLine >= 0 && currentLyricLine < lyrics.lines.length
        ? lyrics.lines[currentLyricLine]
        : undefined;
    const syncState = lyricSyncEngine.getCurrentState(currentTime);

    api.sendMiniPlayerState({
      title: currentTrack?.title ?? 'No track playing',
      artist: currentTrack?.artist ?? 'Nocturne',
      cover: currentTrack?.cover || undefined,
      isPlaying,
      lyricLine: activeLine?.text,
      lyricWords: activeLine?.words?.map((w) => ({
        text: w.text,
        startTime: w.time,
        endTime: w.endTime,
      })),
      lyricLineIndex: currentLyricLine,
      lyricWordIndex: currentLyricWord,
      lyricLineProgress: syncState.progress,
      currentTime,
    });
  }, [currentTrack, isPlaying, lyrics, currentLyricLine, currentLyricWord, currentTime]);

  // Listen for actions from Floating Mini Player window
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onMiniPlayerAction) return;
    return api.onMiniPlayerAction((action) => {
      if (action === 'play-pause') void toggle();
      else if (action === 'next') void next();
      else if (action === 'previous') void prev();
      else if (action === 'expand') {
        setMiniPlayerEnabled(false);
        navigate('/now-playing');
      }
    });
  }, [navigate, next, prev, setMiniPlayerEnabled, toggle]);

  const handleToggleMiniPlayer = async () => {
    const nextEnabled = !miniPlayerEnabled;
    setMiniPlayerEnabled(nextEnabled);
    try {
      const actual = await window.electronAPI?.toggleMiniPlayer?.(nextEnabled);
      if (typeof actual === 'boolean') {
        setMiniPlayerEnabled(actual);
      }
    } catch {
      // ignore outside Electron
    }
  };

  const displayedTime = isSeeking ? seekPreview : currentTime;
  const effectiveDuration = duration > 0 ? duration : currentTrack?.duration ?? 0;

  const handleMuteToggle = () => {
    if (volume > 0) {
      prevVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 0.75);
    }
  };

  const handleToggleQueue = () => {
    setOverlayMode(overlayMode === 'queue' ? 'none' : 'queue');
  };

  const handleToggleViz = () => {
    if (visualizationMode === 'none') {
      setVisualizationMode('constellation');
      navigate('/now-playing');
    } else {
      navigate('/now-playing');
    }
  };

  useEffect(() => {
    (window.electronAPI as { setThumbarPlaybackState?: (p: boolean) => void } | undefined)?.setThumbarPlaybackState?.(isPlaying);
  }, [isPlaying]);

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-20 z-40 px-4 bg-[#0e0e0e]/85 backdrop-blur-2xl border-t border-white/[0.08] flex items-center justify-between gap-4 select-none">
      {/* Left: Track Info */}
      <div className="flex items-center gap-3 w-[28%] min-w-0">
        <button
          type="button"
          onClick={() => navigate('/now-playing')}
          aria-label="Open Now Playing"
          className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center hover:border-white/25 transition-colors cursor-pointer"
        >
          {currentTrack ? (
            <ArtworkImage
              key={currentTrack.id}
              src={currentTrack.cover}
              alt={currentTrack.title}
              type="track"
              title={currentTrack.title}
              artist={currentTrack.artist}
              className="w-full h-full object-cover"
              iconClassName="w-5 h-5 text-white/30"
            />
          ) : (
            <Music className="w-5 h-5 text-white/30" />
          )}
        </button>

        <div className="min-w-0">
          {currentTrack ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/now-playing')}
                className="block text-sm font-medium text-white truncate hover:underline text-left cursor-pointer max-w-full"
              >
                {currentTrack.title}
              </button>
              <p className="text-xs text-white/50 truncate">{currentTrack.artist}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white/45">No track playing</p>
              <p className="text-xs text-white/30">Select a song to begin</p>
            </>
          )}
        </div>
      </div>

      {/* Center: Playback Controls + Seek Bar */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-[520px] gap-1.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleShuffle}
            aria-label="Toggle shuffle"
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              shuffleActive
                ? 'text-white bg-white/10'
                : 'text-white/45 hover:text-white'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => void prev()}
            disabled={!currentTrack}
            aria-label="Previous track"
            className="p-1.5 rounded-full text-white/75 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            type="button"
            onClick={() => void toggle()}
            disabled={!currentTrack || isLoading}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-9 h-9 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 transition-transform cursor-pointer shadow-md shadow-white/10"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => void next()}
            disabled={!currentTrack}
            aria-label="Next track"
            className="p-1.5 rounded-full text-white/75 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          <button
            type="button"
            onClick={toggleRepeat}
            aria-label={`Repeat mode: ${repeatMode}`}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              repeatMode !== 'off'
                ? 'text-white bg-white/10'
                : 'text-white/45 hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] text-white/45 tabular-nums w-9 text-right">
            {formatTime(displayedTime)}
          </span>
          <Slider
            value={displayedTime}
            min={0}
            max={effectiveDuration > 0 ? effectiveDuration : 1}
            step={0.25}
            disabled={!currentTrack || effectiveDuration <= 0}
            ariaLabel="Seek position"
            className="flex-1"
            onChangeStart={() => {
              setIsSeeking(true);
              setSeekPreview(currentTime);
            }}
            onChange={(val) => {
              setSeekPreview(val);
            }}
            onChangeEnd={() => {
              seek(seekPreview);
              setIsSeeking(false);
            }}
          />
          <span className="text-[11px] text-white/45 tabular-nums w-9">
            {formatTime(effectiveDuration)}
          </span>
        </div>
      </div>

      {/* Right: Volume + Mini Player + Queue + Visualization */}
      <div className="flex items-center justify-end gap-2 w-[28%]">
        <button
          type="button"
          onClick={() => void handleToggleMiniPlayer()}
          title="Floating Mini Player"
          aria-label="Toggle mini player"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            miniPlayerEnabled
              ? 'text-white bg-white/10'
              : 'text-white/45 hover:text-white hover:bg-white/6'
          }`}
        >
          <PictureInPicture2 className="w-4 h-4" />
        </button>

        <SleepTimerButton align="up" />

        <button
          type="button"
          onClick={handleToggleViz}
          title="Constellation Visualization"
          aria-label="Toggle visualization"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            visualizationMode !== 'none'
              ? 'text-white bg-white/10'
              : 'text-white/45 hover:text-white hover:bg-white/6'
          }`}
        >
          <Sparkles className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleQueue}
          title="Queue"
          aria-label="Toggle queue"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            overlayMode === 'queue'
              ? 'text-white bg-white/10'
              : 'text-white/45 hover:text-white hover:bg-white/6'
          }`}
        >
          <ListMusic className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 w-28">
          <button
            type="button"
            onClick={handleMuteToggle}
            aria-label={volume === 0 ? 'Unmute' : 'Mute'}
            className="p-1.5 rounded-lg text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <Slider
            value={volume}
            min={0}
            max={1}
            step={0.01}
            ariaLabel="Volume"
            className="flex-1"
            onChange={(val) => setVolume(val)}
          />
        </div>
      </div>
    </footer>
  );
}

export default PlayerBar;
