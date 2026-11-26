import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Heart,
  Languages,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import Slider from '@/components/ui/Slider';
import TrackContextMenu from '@/components/ui/TrackContextMenu';
import PlaylistPickerModal from '@/components/ui/PlaylistPickerModal';
import ArtworkImage from '@/components/ui/ArtworkImage';
import { useLibraryStore } from '@/stores/libraryStore';
import { importLrcForTrack, importLrcFromFile } from '@/services/lyrics/importer';
import { SUPPORTED_LANGUAGES } from '@/services/translation/languageDetector';
import { usePlayerStore } from '@/stores/playerStore';
import { useStudioStore } from '@/stores/studioStore';
import { useTranslationStore } from '@/stores/translationStore';
import { useUIStore, type VisualizationMode } from '@/stores/uiStore';
import SpotifyLyrics from '@/components/player/SpotifyLyrics';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const vizModes: { id: VisualizationMode; label: string }[] = [
  { id: 'constellation', label: 'Constellation' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'floating', label: 'Floating' },
  { id: 'karaoke', label: 'Karaoke' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'particle', label: 'Particle' },
  { id: 'wave', label: 'Wave' },
  { id: 'spotify', label: 'Spotify' },
];

export function NowPlaying() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const source = usePlayerStore((s) => s.playbackSource);
  const credit = source?.credit ?? currentTrack?.credit;
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const error = usePlayerStore((s) => s.error);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const shuffleActive = usePlayerStore((s) => s.shuffleActive);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricLine = usePlayerStore((s) => s.currentLyricLine);
  const lyricsOffsetMs = usePlayerStore((s) => s.lyricsOffsetMs);
  const lyricsLoading = usePlayerStore((s) => s.lyricsLoading);

  const toggle = usePlayerStore((s) => s.toggle);
  const retry = usePlayerStore((s) => s.retry);
  const next = usePlayerStore((s) => s.next);
  const prev = usePlayerStore((s) => s.prev);
  const seek = usePlayerStore((s) => s.seek);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  const setLyrics = usePlayerStore((s) => s.setLyrics);
  const setLyricsOffset = usePlayerStore((s) => s.setLyricsOffset);

  const visualizationMode = useUIStore((s) => s.visualizationMode);
  const setVisualizationMode = useUIStore((s) => s.setVisualizationMode);
  const immersiveMode = useUIStore((s) => s.immersiveMode);
  const setImmersiveMode = useUIStore((s) => s.setImmersiveMode);
  const lyricsDisplayMode = useUIStore((s) => s.lyricsDisplayMode);
  const setLyricsDisplayMode = useUIStore((s) => s.setLyricsDisplayMode);
  const fontFamily = useStudioStore((s) => s.fontFamily);

  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState(0);
  const [showAudioInfo, setShowAudioInfo] = useState(false);
  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [userScrolledAway, setUserScrolledAway] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const translationMode = useTranslationStore((s) => s.mode);
  const setTranslationMode = useTranslationStore((s) => s.setMode);
  const sourceLang = useTranslationStore((s) => s.sourceLang);
  const setSourceLang = useTranslationStore((s) => s.setSourceLang);
  const translationFontSize = useTranslationStore((s) => s.fontSize);
  const setTranslationFontSize = useTranslationStore((s) => s.setFontSize);
  const translationOpacity = useTranslationStore((s) => s.opacity);
  const setTranslationOpacity = useTranslationStore((s) => s.setOpacity);
  const noticeAccepted = useTranslationStore((s) => s.noticeAccepted);
  const acceptNotice = useTranslationStore((s) => s.acceptNotice);
  const translationLoading = useTranslationStore((s) => s.loading);
  const translationError = useTranslationStore((s) => s.error);
  const translations = useTranslationStore((s) => s.translations);
  const activeProvider = useTranslationStore((s) => s.activeProvider);
  const translateLyrics = useTranslationStore((s) => s.translateLyrics);
  const resetTranslationForTrack = useTranslationStore((s) => s.resetForTrack);
  const clearCurrentTrackCache = useTranslationStore((s) => s.clearCurrentTrackCache);

  useEffect(() => {
    resetTranslationForTrack();
  }, [currentTrack?.id, resetTranslationForTrack]);

  useEffect(() => {
    if (translationMode !== 'original' && currentTrack && lyrics && lyrics.lines.length > 0) {
      void translateLyrics(currentTrack, lyrics);
    }
  }, [translationMode, sourceLang, currentTrack, lyrics, translateLyrics]);

  const displayedTime = isSeeking ? seekPreview : currentTime;
  const effectiveDuration = duration > 0 ? duration : currentTrack?.duration ?? 0;

  useEffect(() => {
    if (showTranslateMenu || userScrolledAway) return;
    const container = lyricsScrollRef.current;
    const lineEl = activeLineRef.current;
    if (!container || !lineEl) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const targetTop =
      container.scrollTop +
      (lineRect.top - containerRect.top) -
      container.clientHeight * 0.36;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [
    currentLyricLine,
    lyrics,
    translations,
    translationMode,
    translationFontSize,
    showTranslateMenu,
    userScrolledAway,
  ]);

  const handleFullscreenToggle = async () => {
    const nextImmersive = !immersiveMode;
    setImmersiveMode(nextImmersive);
    try {
      const api = window.electronAPI as
        | (typeof window.electronAPI & { setFullscreen?: (flag: boolean) => Promise<void> })
        | undefined;
      await api?.setFullscreen?.(nextImmersive);
      if (nextImmersive && !document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (!nextImmersive && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen API may be restricted in some environments; immersiveMode still toggles
    }
  };

  const handleImportLrc = async () => {
    const imported = currentTrack
      ? await importLrcForTrack(currentTrack)
      : await importLrcFromFile();
    if (imported) {
      setLyrics(imported);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-full flex flex-col justify-between overflow-hidden bg-[#08080b]"
    >
      {/* Subtle Restrained Album Ambient Backdrop (Normal Player Mode — no constellation behind UI) */}
      {currentTrack?.cover && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <img
            src={currentTrack.cover}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover blur-3xl opacity-12 scale-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#08080b]/80 via-[#08080b]/75 to-[#060608]/95" />
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/12 border border-white/10 text-xs text-white/80 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          {/* Visualization Mode Selector (launches Immersive Mode) */}
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-white/[0.05] backdrop-blur-xl border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-white/50 ml-2 mr-1" />
            {vizModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  setVisualizationMode(mode.id);
                  if (!immersiveMode) {
                    void handleFullscreenToggle();
                  }
                }}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  visualizationMode === mode.id
                    ? 'bg-white/15 text-white font-medium'
                    : 'text-white/50 hover:text-white/85'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Enter Immersive Visualization Mode */}
          {/* Mini Player Toggle */}
          <button
            type="button"
            onClick={() => void window.electronAPI?.toggleMiniPlayer?.()}
            aria-label="Toggle Mini Player"
            title="Toggle Mini Player"
            className="p-2 rounded-xl bg-white/[0.08] hover:bg-white/15 border border-white/12 text-white/85 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => void handleFullscreenToggle()}
            aria-label={immersiveMode ? 'Exit immersive mode' : 'Enter immersive mode'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/15 border border-white/12 text-xs font-medium text-white/85 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
          >
            {immersiveMode ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span>Immersive</span>
          </button>
        </div>
      </div>

      {/* Center Content — Responsive 40/60 Two-Column Layout */}
      <div className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[minmax(300px,40%)_minmax(420px,60%)] items-center justify-items-center gap-8 lg:gap-12 px-6 lg:px-12 py-4 max-w-7xl w-full mx-auto">
        {/* Artwork + Track Metadata + Full Playback Controls */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col items-center text-center w-full max-w-[380px]"
        >
          <div className="w-[clamp(220px,24vw,380px)] h-[clamp(220px,24vw,380px)] rounded-2xl bg-white/[0.04] border border-white/12 shadow-2xl shadow-black/80 overflow-hidden flex items-center justify-center mb-5">
            {currentTrack ? (
              <ArtworkImage
                key={currentTrack.id}
                src={currentTrack.cover}
                alt={currentTrack.title}
                type="track"
                title={currentTrack.title}
                artist={currentTrack.artist}
                className="w-full h-full object-cover"
                iconClassName="w-16 h-16 text-white/20"
              />
            ) : (
              <Music className="w-16 h-16 text-white/20" />
            )}
          </div>

          <div className="flex items-center justify-center gap-2 max-w-full">
            <h1 className="text-xl font-semibold text-white tracking-tight truncate">
              {currentTrack?.title ?? 'No track playing'}
            </h1>
            {currentTrack && (
              <>
                <button
                  type="button"
                  data-testid="nowplaying-like-btn"
                  onClick={() => toggleFavorite(currentTrack)}
                  title={favorites.some((f) => f.id === currentTrack.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                  aria-label="Like track"
                  className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <Heart className={`w-4 h-4 ${favorites.some((f) => f.id === currentTrack.id) ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                </button>
                <button
                  type="button"
                  data-testid="nowplaying-more-btn"
                  onClick={(e) => setMenuPos({ x: e.clientX, y: e.clientY })}
                  title="Track options"
                  aria-label="Track options"
                  className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <p className="text-sm text-white/55 mt-1 truncate max-w-full">
            {currentTrack?.artist ?? 'Select a song from Home or Search'}
          </p>

          {currentTrack && (currentTrack.provider || currentTrack.quality || currentTrack.codec) && (
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setShowAudioInfo((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] hover:bg-white/12 border border-white/10 text-[10px] uppercase tracking-wider text-white/65 hover:text-white transition-colors cursor-pointer"
                title="Click for actual playback & stream details"
              >
                <span>{source?.provider ?? 'Audio info'}</span>
                {source && <span>{source.quality ?? source.codec ?? 'Quality unknown'}</span>}
              </button>

              {showAudioInfo && (
                <div className="absolute left-1/2 -translate-x-1/2 top-7 z-30 w-64 rounded-xl bg-[#121216]/95 backdrop-blur-2xl border border-white/15 p-3 text-left text-[11px] text-white/75 shadow-2xl space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-white/45">Playback Provider</span>
                    <span className="text-white font-medium">{source?.provider ?? 'None'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Metadata Provider</span>
                    <span>{currentTrack.metadataProvider ?? currentTrack.provider ?? 'unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Availability</span>
                    <span>{source ? 'Full recording' : currentTrack.availability ?? 'Unconfirmed'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Audio quality</span>
                    <span>{source?.quality ?? 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Stream format</span>
                    <span>{source?.codec ?? 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Expected Duration</span>
                    <span>{formatTime(currentTrack.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/45">Actual Media Duration</span>
                    <span>{source?.duration ? formatTime(source.duration) : 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/10">
                    <span className="text-white/45">Classification</span>
                    <span>{source?.quality?.toLowerCase().includes('lossless') || source?.codec?.toLowerCase().includes('flac') ? 'Lossless' : source?.codec ? 'Lossy' : 'Unknown'}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {credit && (
            <p className="mt-1 text-xs text-white/65">
              {credit.artist}{' / '}
              <button onClick={() => void window.electronAPI?.openExternal(credit.licenseUrl)} className="underline">{credit.license}</button>
              {' / '}
              <button onClick={() => void window.electronAPI?.openExternal(credit.pageUrl)} className="underline">Source</button>
            </p>
          )}
          {currentTrack?.catalogUrl && (
            <button onClick={() => void window.electronAPI?.openExternal(currentTrack.catalogUrl!)} className="mt-1 text-xs text-white/65 underline">
              View on Apple Music
            </button>
          )}

          {/* Seek Bar */}
          <div className="w-full mt-6 space-y-1.5">
            <Slider
              value={displayedTime}
              min={0}
              max={effectiveDuration > 0 ? effectiveDuration : 1}
              step={0.25}
              disabled={!currentTrack || effectiveDuration <= 0}
              ariaLabel="Now playing seek"
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
            <div className="flex justify-between text-[11px] text-white/45 tabular-nums">
              <span>{formatTime(displayedTime)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-5 mt-4">
            <button
              type="button"
              onClick={toggleShuffle}
              aria-label="Toggle shuffle"
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                shuffleActive
                  ? 'text-white bg-white/12'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => void prev()}
              disabled={!currentTrack}
              aria-label="Previous track"
              className="p-2 rounded-full text-white/80 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={() => void toggle()}
              disabled={!currentTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-12 h-12 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-40 transition-transform cursor-pointer shadow-lg shadow-white/15"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => void next()}
              disabled={!currentTrack}
              aria-label="Next track"
              className="p-2 rounded-full text-white/80 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              type="button"
              onClick={toggleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                repeatMode !== 'off'
                  ? 'text-white bg-white/12'
                  : 'text-white/45 hover:text-white'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>
          </div>

          {isBuffering && !error && (
            <p className="mt-3 text-[11px] text-white/50 tracking-wide">
              Buffering stream...
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-400/25 text-xs text-red-200">
              <span className="max-w-sm text-left">{error}</span>
              <button
                type="button"
                onClick={() => void retry()}
                className="px-2 py-0.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition-colors cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </motion.div>

        {/* Lyrics Display Area */}
        {lyricsDisplayMode === 'spotify' ? (
          /* Spotify-style immersive lyrics */
          <div className="w-full max-w-[680px] h-[clamp(380px,62vh,600px)] rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden flex flex-col">
            {/* Spotify mode header */}
            <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-widest text-white/40">
                  Lyrics
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 border border-emerald-400/25 text-emerald-200">
                  Spotify Style
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="lyrics-translate-btn"
                  onClick={() => setShowTranslateMenu((v) => !v)}
                  title="Translate lyrics to English"
                  aria-label="Translate lyrics"
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                    translationMode !== 'original'
                      ? 'bg-white/20 text-white'
                      : 'bg-white/[0.06] hover:bg-white/12 text-white/70 hover:text-white'
                  }`}
                >
                  <Languages className="w-3 h-3" />
                  {translationMode === 'original'
                    ? 'Translate'
                    : translationMode === 'bilingual'
                      ? 'EN+'
                      : 'EN'}
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsDisplayMode('normal')}
                  title="Switch to normal lyrics"
                  className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Normal
                </button>
              </div>
            </div>

            {/* Translation controls (shared) */}
            {showTranslateMenu && (
              <div className="mx-5 mb-2 p-3 rounded-xl bg-white/[0.06] border border-white/10 space-y-2.5 text-xs shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/70 font-medium">Translation Mode</span>
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['original', 'Original'],
                        ['bilingual', 'Original + EN'],
                        ['english', 'English Only'],
                      ] as const
                    ).map(([modeKey, label]) => (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => {
                          if (modeKey !== 'original' && !noticeAccepted) acceptNotice();
                          setTranslationMode(modeKey);
                        }}
                        className={`px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                          translationMode === modeKey
                            ? 'bg-white text-[#0a0a0a] font-medium'
                            : 'bg-white/[0.06] text-white/70 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-white/60">Source Language</label>
                  <select
                    value={sourceLang}
                    onChange={(e) => setSourceLang(e.target.value)}
                    className="bg-[#141418] border border-white/15 rounded-md px-2 py-1 text-[11px] text-white"
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {translationMode !== 'original' && translationLoading && (
              <div className="mx-5 mb-2 text-[11px] text-white/55 shrink-0">
                Translating lyrics to English...
              </div>
            )}

            <SpotifyLyrics />
          </div>
        ) : (
          /* Normal lyrics panel */
          <div className="w-full max-w-[680px] h-[clamp(380px,62vh,600px)] rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-6 lg:p-7 overflow-y-auto overflow-x-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-white/40">
                Lyrics
              </span>
              {lyrics && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    lyrics.hasWordLevel
                      ? 'bg-emerald-500/15 border-emerald-400/25 text-emerald-200'
                      : 'bg-white/[0.06] border-white/10 text-white/55'
                  }`}
                >
                  {lyrics.hasWordLevel ? 'Word-Synced' : 'Estimated Word Timing'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {lyrics?.provider && (
                <span className="text-[11px] text-white/35">{lyrics.provider}</span>
              )}
              <button
                type="button"
                data-testid="lyrics-translate-btn"
                onClick={() => setShowTranslateMenu((v) => !v)}
                title="Translate lyrics to English"
                aria-label="Translate lyrics"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                  translationMode !== 'original'
                    ? 'bg-white/20 text-white'
                    : 'bg-white/[0.06] hover:bg-white/12 text-white/70 hover:text-white'
                }`}
              >
                <Languages className="w-3 h-3" />
                {translationMode === 'original'
                  ? 'Translate'
                  : translationMode === 'bilingual'
                    ? 'EN+'
                    : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => void handleImportLrc()}
                title="Import .lrc file"
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                .lrc
              </button>
              <button
                type="button"
                onClick={() => setLyricsDisplayMode('spotify')}
                title="Switch to Spotify-style lyrics"
                className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/12 text-[11px] text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                ♪ Live
              </button>
            </div>
          </div>

          {/* Per-Track Lyrics Timing Offset */}
          {currentTrack && (
            <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-white/[0.06] shrink-0 text-[11px] text-white/55">
              <span>
                Offset:{' '}
                <strong className="text-white/85 tabular-nums">
                  {lyricsOffsetMs >= 0 ? '+' : ''}
                  {(lyricsOffsetMs / 1000).toFixed(1)}s
                </strong>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLyricsOffset(lyricsOffsetMs - 100)}
                  className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/12 text-white/75 cursor-pointer"
                >
                  -0.1s
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsOffset(lyricsOffsetMs + 100)}
                  className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/12 text-white/75 cursor-pointer"
                >
                  +0.1s
                </button>
                {lyricsOffsetMs !== 0 && (
                  <button
                    type="button"
                    onClick={() => setLyricsOffset(0)}
                    className="px-2 py-0.5 rounded bg-white/[0.06] hover:bg-white/12 text-white/60 hover:text-white cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}

          {showTranslateMenu && (
            <div
              data-testid="lyrics-translate-menu"
              className="mb-3 p-3 rounded-xl bg-white/[0.06] border border-white/10 space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/70 font-medium">Translation Mode</span>
                <div className="flex items-center gap-1">
                  {(
                    [
                      ['original', 'Original'],
                      ['bilingual', 'Original + EN'],
                      ['english', 'English Only'],
                    ] as const
                  ).map(([modeKey, label]) => (
                    <button
                      key={modeKey}
                      type="button"
                      onClick={() => {
                        if (modeKey !== 'original' && !noticeAccepted) acceptNotice();
                        setTranslationMode(modeKey);
                      }}
                      className={`px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                        translationMode === modeKey
                          ? 'bg-white text-[#0a0a0a] font-medium'
                          : 'bg-white/[0.06] text-white/70 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-white/60">Source Language</label>
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  className="bg-[#141418] border border-white/15 rounded-md px-2 py-1 text-[11px] text-white"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/60">Size:</span>
                  {(['sm', 'md', 'lg'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setTranslationFontSize(sz)}
                      className={`px-1.5 py-0.5 rounded text-[10px] uppercase cursor-pointer ${
                        translationFontSize === sz
                          ? 'bg-white/25 text-white'
                          : 'bg-white/[0.05] text-white/60'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                  <span className="text-white/60">Opacity</span>
                  <input
                    type="range"
                    min={0.4}
                    max={1}
                    step={0.05}
                    value={translationOpacity}
                    onChange={(e) => setTranslationOpacity(Number(e.target.value))}
                    className="w-full accent-white cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-white/45">
                <span>
                  Machine translation via {activeProvider || 'MyMemory'} · Cached locally
                </span>
                <div className="flex items-center gap-2">
                  {currentTrack && lyrics && (
                    <button
                      type="button"
                      onClick={() => void translateLyrics(currentTrack, lyrics, true)}
                      className="inline-flex items-center gap-1 text-white/65 hover:text-white cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}
                  {currentTrack && (
                    <button
                      type="button"
                      onClick={() => void clearCurrentTrackCache(currentTrack.id)}
                      className="inline-flex items-center gap-1 text-white/65 hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {translationMode !== 'original' && translationLoading && (
            <div className="mb-2 text-[11px] text-white/55">
              Translating lyrics to English...
            </div>
          )}
          {translationMode !== 'original' && translationError && (
            <div className="mb-2 text-[11px] text-amber-300/90 flex items-center justify-between">
              <span>{translationError}</span>
              {currentTrack && lyrics && (
                <button
                  type="button"
                  onClick={() => void translateLyrics(currentTrack, lyrics, true)}
                  className="underline ml-2 cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {userScrolledAway && currentLyricLine >= 0 && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                data-testid="return-to-lyrics-btn"
                onClick={() => {
                  setUserScrolledAway(false);
                  const container = lyricsScrollRef.current;
                  const lineEl = activeLineRef.current;
                  if (container && lineEl) {
                    const containerRect = container.getBoundingClientRect();
                    const lineRect = lineEl.getBoundingClientRect();
                    const targetTop =
                      container.scrollTop +
                      (lineRect.top - containerRect.top) -
                      container.clientHeight * 0.36;
                    container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
                  }
                }}
                className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] text-white transition-colors cursor-pointer"
              >
                Return to current lyrics
              </button>
            </div>
          )}

          {lyricsLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-white/40">
              Loading synchronized lyrics...
            </div>
          ) : lyrics && lyrics.lines.length > 0 ? (
            <div
              ref={lyricsScrollRef}
              onWheel={() => setUserScrolledAway(true)}
              onTouchStart={() => setUserScrolledAway(true)}
              className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-3 pt-6 pb-16"
              style={{ fontFamily, wordBreak: 'break-word' }}
            >
              {lyrics.lines.map((line, idx) => {
                const isActive = idx === currentLyricLine;
                const isPast = idx < currentLyricLine;
                const translatedText = translations[idx];
                const subSizeClass =
                  translationFontSize === 'sm'
                    ? 'text-sm lg:text-[15px]'
                    : translationFontSize === 'lg'
                      ? 'text-lg lg:text-[19px]'
                      : 'text-base lg:text-[17px]';

                return (
                  <div
                    key={`${line.time}-${idx}`}
                    ref={isActive ? activeLineRef : undefined}
                    onClick={() => seek(line.time)}
                    className={`leading-[1.55] transition-all duration-300 cursor-pointer py-0.5 ${
                      isActive
                        ? 'text-white font-semibold'
                        : isPast
                          ? 'text-white/45 hover:text-white/70'
                          : 'text-white/65 hover:text-white/85'
                    }`}
                  >
                    {translationMode !== 'english' && (
                      <p className="text-lg lg:text-[22px]">{line.text || '···'}</p>
                    )}
                    {translationMode === 'bilingual' && translatedText && (
                      <p
                        className={`${subSizeClass} font-normal mt-1`}
                        style={{ opacity: isActive ? Math.min(1, translationOpacity + 0.15) : translationOpacity }}
                      >
                        {translatedText}
                      </p>
                    )}
                    {translationMode === 'english' && (
                      <p className="text-lg lg:text-[22px]">{translatedText || line.text || '···'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-white/35 px-4">
              {currentTrack
                ? 'No synchronized lyrics found for this track.'
                : 'Play a track to view synchronized lyrics.'}
            </div>
          )}
        </div>
        )}
      </div>
      <TrackContextMenu
        track={menuPos ? currentTrack : null}
        position={menuPos}
        onClose={() => setMenuPos(null)}
        onAddToPlaylist={() => setPickerOpen(true)}
      />
      <PlaylistPickerModal
        track={pickerOpen ? currentTrack : null}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}

export default NowPlaying;
