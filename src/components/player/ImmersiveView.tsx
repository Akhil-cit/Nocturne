import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Eye,
  Minimize2,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from 'lucide-react';
import Slider from '@/components/ui/Slider';
import LyricsStage from '@/components/visualization/LyricsStage';
import { EdgeLightingOverlay } from '@/components/lighting/EdgeLightingOverlay';
import { extractPaletteFromCover } from '@/services/lighting/colorExtractor';
import { useLightingStore } from '@/stores/lightingStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatClock(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const mins = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const hudToggleItems = [
  { key: 'showClock', label: 'Clock' },
  { key: 'showDate', label: 'Date' },
  { key: 'showAlbumArt', label: 'Album Art' },
  { key: 'showSongInfo', label: 'Song Info' },
  { key: 'showControls', label: 'Playback Controls' },
  { key: 'showEdgeLighting', label: 'Edge Lighting' },
] as const;

export function ImmersiveView() {
  const setImmersiveMode = useUIStore((s) => s.setImmersiveMode);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffleActive = usePlayerStore((s) => s.shuffleActive);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const toggle = usePlayerStore((s) => s.toggle);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);

  const edgeLightingEnabled = useLightingStore((s) => s.edgeLightingEnabled);
  const edgeMode = useLightingStore((s) => s.edgeMode);
  const edgeThickness = useLightingStore((s) => s.edgeThickness);
  const edgeGlowStrength = useLightingStore((s) => s.edgeGlowStrength);
  const autoAlbumColors = useLightingStore((s) => s.autoAlbumColors);
  const customPalette = useLightingStore((s) => s.customPalette);
  const desktopOverlayEnabled = useLightingStore((s) => s.desktopOverlayEnabled);
  const showClock = useLightingStore((s) => s.showClock);
  const showDate = useLightingStore((s) => s.showDate);
  const showAlbumArt = useLightingStore((s) => s.showAlbumArt);
  const showSongInfo = useLightingStore((s) => s.showSongInfo);
  const showControls = useLightingStore((s) => s.showControls);
  const showEdgeLighting = useLightingStore((s) => s.showEdgeLighting);
  const toggleHudElement = useLightingStore((s) => s.toggleHudElement);

  const hudState = {
    showClock,
    showDate,
    showAlbumArt,
    showSongInfo,
    showControls,
    showEdgeLighting,
  };

  const [now, setNow] = useState(() => new Date());
  const [hudVisible, setHudVisible] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [accentColor, setAccentColor] = useState('#a5b4fc');

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract dynamic accent color from album art
  useEffect(() => {
    let cancelled = false;
    if (!autoAlbumColors) {
      setAccentColor(customPalette[0] ?? '#a5b4fc');
      return;
    }
    if (!currentTrack?.cover) {
      setAccentColor('#a5b4fc');
      return;
    }
    extractPaletteFromCover(currentTrack.cover)
      .then((colors: string[]) => {
        if (!cancelled && colors.length > 0) {
          setAccentColor(colors[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setAccentColor('#a5b4fc');
      });
    return () => {
      cancelled = true;
    };
  }, [autoAlbumColors, currentTrack?.cover, customPalette]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide controls after 3s of mouse idle
  useEffect(() => {
    const resetIdle = () => {
      setHudVisible(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!popoverOpen) {
          setHudVisible(false);
        }
      }, 3000);
    };

    resetIdle();
    window.addEventListener('mousemove', resetIdle);
    window.addEventListener('mousedown', resetIdle);
    window.addEventListener('keydown', resetIdle);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', resetIdle);
      window.removeEventListener('mousedown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [popoverOpen]);

  const handleExitImmersive = async () => {
    setImmersiveMode(false);
    try {
      const api = window.electronAPI as
        | (typeof window.electronAPI & { setFullscreen?: (flag: boolean) => Promise<void> })
        | undefined;
      await api?.setFullscreen?.(false);
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore fullscreen exit errors
    }
  };

  const displayedTime = isSeeking ? seekPreview : currentTime;
  const effectiveDuration = duration > 0 ? duration : currentTrack?.duration ?? 0;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#04050a] text-white overflow-hidden select-none ${
        hudVisible ? 'cursor-default' : 'cursor-none'
      }`}
    >
      {/* Layers 0-5: Base Background, Animated Atmosphere, Particles, Constellation Lines, Stars & Active Words */}
      <LyricsStage fullscreen accentColor={accentColor} />

      {/* Layer 8: Audio-Reactive Screen-Edge Lighting (pointer-events-none) */}
      {edgeLightingEnabled && showEdgeLighting && (
        <div className="pointer-events-none fixed inset-0 z-40">
          <EdgeLightingOverlay
            mode={edgeMode}
            thickness={edgeThickness}
            glowStrength={edgeGlowStrength}
            autoExtractAlbumColors={autoAlbumColors}
            palette={customPalette}
            forwardToDesktopOverlay={desktopOverlayEnabled}
          />
        </div>
      )}

      {/* Layer 6 & 7: Optional Clock/Date + Auto-Hiding HUD Controls */}
      <div className="relative z-30 flex items-start justify-between p-8 pointer-events-none">
        {/* Top-left: NOW PLAYING + Clock + Date */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/45">
            Now Playing
          </p>
          {showClock && (
            <p className="text-6xl font-light tracking-tight text-white/90 tabular-nums leading-none pt-1">
              {formatClock(now)}
            </p>
          )}
          {showDate && (
            <p className="text-sm text-white/45 pt-1">{formatDate(now)}</p>
          )}
        </div>

        {/* Top-right: HUD Element Popover + Exit Immersive */}
        <AnimatePresence>
          {(hudVisible || popoverOpen) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto relative flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setPopoverOpen((v) => !v)}
                aria-label="Customize HUD elements"
                title="Customize HUD"
                className={`p-2.5 rounded-xl border backdrop-blur-xl transition-colors cursor-pointer ${
                  popoverOpen
                    ? 'bg-white/15 border-white/25 text-white'
                    : 'bg-white/[0.06] border-white/10 text-white/70 hover:text-white hover:bg-white/12'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => void handleExitImmersive()}
                aria-label="Exit immersive mode"
                title="Exit immersive mode (Esc)"
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/12 border border-white/10 text-xs text-white/75 hover:text-white backdrop-blur-xl transition-colors cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Exit</span>
              </button>

              {/* Discrete HUD Toggle Popover */}
              <AnimatePresence>
                {popoverOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 w-56 rounded-2xl bg-[#121212]/90 backdrop-blur-2xl border border-white/12 p-2 shadow-2xl shadow-black/80"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">
                      <Eye className="w-3.5 h-3.5" />
                      <span>HUD Elements</span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {hudToggleItems.map(({ key, label }) => {
                        const enabled = hudState[key];
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleHudElement(key)}
                            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-white/85 hover:bg-white/8 transition-colors cursor-pointer"
                          >
                            <span>{label}</span>
                            <span
                              className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                                enabled ? 'bg-white' : 'bg-white/15'
                              }`}
                            >
                              <span
                                className={`w-3 h-3 rounded-full transition-transform ${
                                  enabled
                                    ? 'translate-x-3 bg-[#0a0a0a]'
                                    : 'translate-x-0 bg-white/60'
                                }`}
                              />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom HUD: Album Art, Song Info, Auto-Hiding Playback Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-8 flex flex-col md:flex-row md:items-end justify-between gap-6 pointer-events-none">
        {/* Track Identity */}
        {(showAlbumArt || showSongInfo) && (
          <div className="flex items-center gap-4 min-w-0 pointer-events-auto">
            {showAlbumArt && (
              <div className="w-16 h-16 rounded-xl bg-white/[0.05] border border-white/12 overflow-hidden shrink-0 flex items-center justify-center shadow-xl shadow-black/60">
                {currentTrack?.cover ? (
                  <img
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-6 h-6 text-white/30" />
                )}
              </div>
            )}

            {showSongInfo && (
              <div className="min-w-0">
                <p className="text-lg font-medium text-white truncate">
                  {currentTrack?.title ?? 'No track playing'}
                </p>
                <p className="text-sm text-white/55 truncate">
                  {currentTrack?.artist ?? 'Nocturne'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Playback Controls (auto-hides on mouse idle) */}
        <AnimatePresence>
          {showControls && hudVisible && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-md rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/10 px-5 py-3.5 space-y-2.5 shadow-2xl shadow-black/60"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-white/45 tabular-nums w-9 text-right">
                  {formatTime(displayedTime)}
                </span>
                <Slider
                  value={displayedTime}
                  min={0}
                  max={effectiveDuration > 0 ? effectiveDuration : 1}
                  step={0.25}
                  disabled={!currentTrack || effectiveDuration <= 0}
                  ariaLabel="Immersive seek"
                  className="flex-1"
                  onChangeStart={() => {
                    setIsSeeking(true);
                    setSeekPreview(currentTime);
                  }}
                  onChange={(val) => setSeekPreview(val)}
                  onChangeEnd={() => {
                    seek(seekPreview);
                    setIsSeeking(false);
                  }}
                />
                <span className="text-[11px] text-white/45 tabular-nums w-9">
                  {formatTime(effectiveDuration)}
                </span>
              </div>

              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={toggleShuffle}
                  aria-label="Toggle shuffle"
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    shuffleActive
                      ? 'text-white bg-white/12'
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
                  className="p-1.5 rounded-full text-white/80 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={() => void toggle()}
                  disabled={!currentTrack}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  className="w-10 h-10 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 transition-transform cursor-pointer"
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
                  className="p-1.5 rounded-full text-white/80 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>

                <button
                  type="button"
                  onClick={toggleRepeat}
                  aria-label={`Repeat mode: ${repeatMode}`}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    repeatMode !== 'off'
                      ? 'text-white bg-white/12'
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ImmersiveView;
