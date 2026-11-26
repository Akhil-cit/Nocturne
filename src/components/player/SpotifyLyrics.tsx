import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayerStore } from '@/stores/playerStore';
import { useTranslationStore } from '@/stores/translationStore';
import { useStudioStore } from '@/stores/studioStore';
import { extractPaletteFromCover } from '@/services/lighting/colorExtractor';

const FALLBACK_BG = '#121318';

function darkenHex(hex: string, factor = 0.28): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return FALLBACK_BG;
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor);
  const toHex = (n: number) => Math.max(8, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Spotify-style immersive lyrics display.
 * - Album-art-derived darkened background with smooth transitions
 * - Large, bold, left-aligned lyrics in a centered ~60% column
 * - Reliable getBoundingClientRect() auto-scroll to upper-middle
 * - Manual scroll pause + "Return to current lyrics" button
 * - Full support for Original, Original + EN, and English Only
 */
export function SpotifyLyrics() {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [bgColor, setBgColor] = useState<string>(FALLBACK_BG);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const lyrics = usePlayerStore((s) => s.lyrics);
  const currentLyricLine = usePlayerStore((s) => s.currentLyricLine);
  const seek = usePlayerStore((s) => s.seek);
  const fontFamily = useStudioStore((s) => s.fontFamily);

  const translationMode = useTranslationStore((s) => s.mode);
  const translations = useTranslationStore((s) => s.translations);
  const translationFontSize = useTranslationStore((s) => s.fontSize);
  const translationOpacity = useTranslationStore((s) => s.opacity);

  // Extract dominant album color for background
  useEffect(() => {
    let cancelled = false;
    const cover = currentTrack?.cover;
    if (!cover) {
      setBgColor(FALLBACK_BG);
      return;
    }
    extractPaletteFromCover(cover)
      .then((palette) => {
        if (!cancelled && palette.length > 0) {
          setBgColor(darkenHex(palette[0], 0.3));
        }
      })
      .catch(() => {
        if (!cancelled) setBgColor(FALLBACK_BG);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.cover]);

  // Reset manual scroll on track change
  useEffect(() => {
    setUserScrolled(false);
  }, [currentTrack?.id]);

  const scrollToActiveLine = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    const lineEl = activeLineRef.current;
    if (!container || !lineEl) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const targetTop =
      container.scrollTop +
      (lineRect.top - containerRect.top) -
      container.clientHeight * 0.36;

    container.scrollTo({ top: Math.max(0, targetTop), behavior });
  }, []);

  // Auto-scroll whenever active line, lyrics, or translation layout changes
  useEffect(() => {
    if (userScrolled) return;
    scrollToActiveLine('smooth');
  }, [currentLyricLine, lyrics, translationMode, translationFontSize, userScrolled, scrollToActiveLine]);

  const handleUserScroll = useCallback(() => {
    setUserScrolled(true);
  }, []);

  const handleReturnToCurrent = useCallback(() => {
    setUserScrolled(false);
    requestAnimationFrame(() => {
      scrollToActiveLine('smooth');
    });
  }, [scrollToActiveLine]);

  const translationSizeClass =
    translationFontSize === 'sm'
      ? 'text-xl md:text-2xl'
      : translationFontSize === 'lg'
        ? 'text-3xl md:text-4xl'
        : 'text-2xl md:text-3xl';

  if (!lyrics || lyrics.lines.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-white/50 text-xl transition-colors duration-1000"
        style={{ backgroundColor: bgColor }}
      >
        No synchronized lyrics available
      </div>
    );
  }

  return (
    <div
      data-testid="spotify-lyrics-root"
      className="relative flex-1 min-h-0 flex flex-col transition-colors duration-1000"
      style={{ backgroundColor: bgColor }}
    >
      <style>{`
        .spotify-lyrics-scroll::-webkit-scrollbar { display: none; }
        .spotify-lyrics-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>

      <div
        ref={containerRef}
        data-testid="spotify-lyrics-scroll"
        onWheel={handleUserScroll}
        onTouchStart={handleUserScroll}
        className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden spotify-lyrics-scroll"
      >
        <div
          className="w-[90%] md:w-[62%] max-w-4xl mx-auto flex flex-col items-start text-left"
          style={{ fontFamily, paddingTop: '36vh', paddingBottom: '45vh' }}
        >
          {lyrics.lines.map((line, idx) => {
            const isActive = idx === currentLyricLine;
            const isPast = idx < currentLyricLine;
            const translatedText = translations[idx];

            // Readable contrast: active=1, upcoming=0.62, past=0.38
            const opacity = isActive ? 1 : isPast ? 0.38 : 0.62;

            return (
              <div
                key={`${line.time}-${idx}`}
                ref={isActive ? activeLineRef : undefined}
                data-lyric-index={idx}
                data-active={isActive ? 'true' : 'false'}
                onClick={() => {
                  seek(line.time);
                  setUserScrolled(false);
                }}
                className="w-full py-3.5 md:py-4 cursor-pointer select-none transition-all duration-300 hover:opacity-90"
                style={{
                  opacity,
                  color: '#ffffff',
                }}
              >
                {translationMode !== 'english' && (
                  <p className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-bold leading-[1.22] break-words">
                    {line.text || '♪'}
                  </p>
                )}

                {translationMode === 'bilingual' && translatedText && (
                  <p
                    className={`${translationSizeClass} font-medium mt-2 leading-snug break-words`}
                    style={{
                      opacity: isActive
                        ? Math.min(1, translationOpacity + 0.15)
                        : translationOpacity * 0.85,
                    }}
                  >
                    {translatedText}
                  </p>
                )}

                {translationMode === 'english' && (
                  <p className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-bold leading-[1.22] break-words">
                    {translatedText || line.text || '♪'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top and bottom fade gradients matching album background */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-28 z-10 transition-colors duration-1000"
        style={{ background: `linear-gradient(to bottom, ${bgColor}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 z-10 transition-colors duration-1000"
        style={{ background: `linear-gradient(to top, ${bgColor}, transparent)` }}
      />

      {/* Return to current lyrics button */}
      <AnimatePresence>
        {userScrolled && currentLyricLine >= 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            type="button"
            data-testid="spotify-return-to-lyrics-btn"
            onClick={handleReturnToCurrent}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-xl text-sm font-medium text-white transition-colors cursor-pointer shadow-lg"
          >
            ↓ Return to current lyrics
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SpotifyLyrics;
