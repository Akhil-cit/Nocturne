export type TranslationDisplayMode = 'original' | 'bilingual' | 'english';

export interface SupportedLanguage {
  code: string;
  label: string;
}

export interface TranslationBatchResult {
  /** Map from line index to translated English text */
  lines: Record<number, string>;
  provider: string;
  sourceLang: string;
}

export interface TranslationProvider {
  readonly id: string;
  readonly name: string;
  getSupportedLanguages(): SupportedLanguage[];
  translateBatch(
    items: Array<{ index: number; text: string }>,
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<Record<number, string>>;
}

export interface CachedTranslationEntry {
  trackId: string;
  lyricsHash: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  lines: Record<number, string>;
  version: number;
  createdAt: number;
}
