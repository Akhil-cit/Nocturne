import type { SupportedLanguage } from './types';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'ta', label: 'Tamil' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'bn', label: 'Bengali' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ko', label: 'Korean' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'en', label: 'English' },
];

const ROMANIZED_TAMIL_HINT =
  /\b(kaadhal|kadhal|anbe|uyire|uyir|enna|unakkena|vaazhgiren|kanmani|nenjam|mazhai|poove|thanimai|munbe|vaa|pookkal|nilave|kanave|idhayam)\b/i;
const ROMANIZED_HINDI_HINT =
  /\b(ishq|pyaar|pyar|dil|mohabbat|zindagi|tum|hum|tere|mere|sanam|jaan|khuda|ashiqui|raat|subah|intezaar|bewafa|dhadkan|saanson)\b/i;
const ROMANIZED_MALAYALAM_HINT =
  /\b(pranayam|mazha|hridayam|ente|ninte|kanna|ormakal|swapnam|neela|poovukal|madhuram)\b/i;

export function detectLyricsLanguage(lines: string[]): string {
  const sample = lines.slice(0, 20).join(' ');
  if (!sample.trim()) return 'en';

  if (/[\u0B80-\u0BFF]/.test(sample)) return 'ta';
  if (/[\u0900-\u097F]/.test(sample)) return 'hi';
  if (/[\u0D00-\u0D7F]/.test(sample)) return 'ml';
  if (/[\u0C00-\u0C7F]/.test(sample)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(sample)) return 'kn';
  if (/[\u0980-\u09FF]/.test(sample)) return 'bn';
  if (/[\u0A00-\u0A7F]/.test(sample)) return 'pa';
  if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko';
  if (/[\u3040-\u30FF]/.test(sample)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(sample)) return 'zh';

  // Romanized Indian lyrics check before assuming English
  if (ROMANIZED_TAMIL_HINT.test(sample)) return 'ta';
  if (ROMANIZED_HINDI_HINT.test(sample)) return 'hi';
  if (ROMANIZED_MALAYALAM_HINT.test(sample)) return 'ml';

  return 'en';
}
