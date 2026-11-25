import { create } from 'zustand';
import type { SyncedLyrics, Track } from '@/services/music/types';
import {
  clearAllTranslationCache,
  clearTrackTranslationCache,
  getCachedTranslation,
  hashLyricsLines,
  setCachedTranslation,
} from '@/services/translation/cache';
import { detectLyricsLanguage } from '@/services/translation/languageDetector';
import { myMemoryProvider } from '@/services/translation/providers/mymemory';
import type { TranslationDisplayMode } from '@/services/translation/types';

const PREFS_KEY = 'nocturne:translationPrefs';

interface PersistedTranslationPrefs {
  mode: TranslationDisplayMode;
  fontSize: 'sm' | 'md' | 'lg';
  opacity: number;
  noticeAccepted: boolean;
}

function loadPrefs(): PersistedTranslationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedTranslationPrefs>;
      return {
        mode: parsed.mode === 'bilingual' || parsed.mode === 'english' ? parsed.mode : 'original',
        fontSize: parsed.fontSize === 'sm' || parsed.fontSize === 'lg' ? parsed.fontSize : 'md',
        opacity: typeof parsed.opacity === 'number' ? Math.min(1, Math.max(0.4, parsed.opacity)) : 0.72,
        noticeAccepted: Boolean(parsed.noticeAccepted),
      };
    }
  } catch {
    // ignore
  }
  return { mode: 'original', fontSize: 'md', opacity: 0.72, noticeAccepted: false };
}

function savePrefs(prefs: PersistedTranslationPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

let activeAbortController: AbortController | null = null;
let activeRequestKey = '';

export interface TranslationState {
  mode: TranslationDisplayMode;
  sourceLang: string;
  fontSize: 'sm' | 'md' | 'lg';
  opacity: number;
  noticeAccepted: boolean;

  loading: boolean;
  error: string | null;
  translations: Record<number, string>;
  detectedLang: string | null;
  activeProvider: string | null;
  activeTrackId: string | null;
  fromCache: boolean;

  setMode: (mode: TranslationDisplayMode) => void;
  setSourceLang: (lang: string) => void;
  setFontSize: (size: 'sm' | 'md' | 'lg') => void;
  setOpacity: (opacity: number) => void;
  acceptNotice: () => void;
  resetForTrack: () => void;
  translateLyrics: (track: Track, lyrics: SyncedLyrics, forceRefresh?: boolean) => Promise<void>;
  clearCurrentTrackCache: (trackId: string) => Promise<void>;
  clearAllCache: () => Promise<void>;
}

const initialPrefs = loadPrefs();

export const useTranslationStore = create<TranslationState>((set, get) => ({
  mode: initialPrefs.mode,
  sourceLang: 'auto',
  fontSize: initialPrefs.fontSize,
  opacity: initialPrefs.opacity,
  noticeAccepted: initialPrefs.noticeAccepted,

  loading: false,
  error: null,
  translations: {},
  detectedLang: null,
  activeProvider: null,
  activeTrackId: null,
  fromCache: false,

  setMode: (mode) => {
    set({ mode });
    const s = get();
    savePrefs({
      mode,
      fontSize: s.fontSize,
      opacity: s.opacity,
      noticeAccepted: s.noticeAccepted,
    });
  },

  setSourceLang: (sourceLang) => set({ sourceLang }),

  setFontSize: (fontSize) => {
    set({ fontSize });
    const s = get();
    savePrefs({
      mode: s.mode,
      fontSize,
      opacity: s.opacity,
      noticeAccepted: s.noticeAccepted,
    });
  },

  setOpacity: (opacity) => {
    const clamped = Math.min(1, Math.max(0.4, opacity));
    set({ opacity: clamped });
    const s = get();
    savePrefs({
      mode: s.mode,
      fontSize: s.fontSize,
      opacity: clamped,
      noticeAccepted: s.noticeAccepted,
    });
  },

  acceptNotice: () => {
    set({ noticeAccepted: true });
    const s = get();
    savePrefs({
      mode: s.mode,
      fontSize: s.fontSize,
      opacity: s.opacity,
      noticeAccepted: true,
    });
  },

  resetForTrack: () => {
    activeAbortController?.abort();
    activeAbortController = null;
    activeRequestKey = '';
    set({
      loading: false,
      error: null,
      translations: {},
      detectedLang: null,
      activeProvider: null,
      activeTrackId: null,
      fromCache: false,
    });
  },

  translateLyrics: async (track, lyrics, forceRefresh = false) => {
    if (!lyrics.lines.length) return;
    const rawLines = lyrics.lines.map((l) => l.text);
    const lyricsHash = hashLyricsLines(rawLines);
    const chosenSource =
      get().sourceLang === 'auto' ? detectLyricsLanguage(rawLines) : get().sourceLang;
    const targetLang = 'en';
    const reqKey = `${track.id}::${lyricsHash}::${chosenSource}::${targetLang}`;

    if (activeRequestKey === reqKey && get().loading && !forceRefresh) {
      return;
    }

    // Cancel any previous in-flight translation request
    activeAbortController?.abort();
    const controller = new AbortController();
    activeAbortController = controller;
    activeRequestKey = reqKey;

    set({
      loading: true,
      error: null,
      detectedLang: chosenSource,
      activeTrackId: track.id,
      fromCache: false,
    });

    try {
      if (!forceRefresh) {
        const cached = await getCachedTranslation(track.id, lyricsHash, chosenSource, targetLang);
        if (controller.signal.aborted) return;
        if (cached) {
          set({
            loading: false,
            translations: cached.lines,
            activeProvider: cached.provider,
            fromCache: true,
          });
          return;
        }
      }

      const items = lyrics.lines
        .map((line, index) => ({ index, text: line.text.trim() }))
        .filter((item) => item.text.length > 0);

      const translatedLines = await myMemoryProvider.translateBatch(
        items,
        chosenSource,
        targetLang,
        controller.signal
      );

      if (controller.signal.aborted) return;

      await setCachedTranslation({
        trackId: track.id,
        lyricsHash,
        sourceLang: chosenSource,
        targetLang,
        provider: myMemoryProvider.name,
        lines: translatedLines,
      });

      if (controller.signal.aborted) return;

      set({
        loading: false,
        translations: translatedLines,
        activeProvider: myMemoryProvider.name,
        fromCache: false,
      });
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Translation unavailable.',
      });
    }
  },

  clearCurrentTrackCache: async (trackId) => {
    await clearTrackTranslationCache(trackId);
    set({ translations: {}, fromCache: false });
  },

  clearAllCache: async () => {
    await clearAllTranslationCache();
    set({ translations: {}, fromCache: false });
  },
}));
