import { SUPPORTED_LANGUAGES } from '../languageDetector';
import type { SupportedLanguage, TranslationProvider } from '../types';

const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';
const MAX_BATCH_CHARS = 400;
const REQUEST_TIMEOUT_MS = 10_000;

function sanitizePlainText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

export class MyMemoryTranslationProvider implements TranslationProvider {
  public readonly id = 'mymemory';
  public readonly name = 'MyMemory';
  private cooldownUntil = 0;

  public getSupportedLanguages(): SupportedLanguage[] {
    return SUPPORTED_LANGUAGES;
  }

  public async translateBatch(
    items: Array<{ index: number; text: string }>,
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<Record<number, string>> {
    if (Date.now() < this.cooldownUntil) {
      throw new Error('Translation service is cooling down after rate limit. Please retry shortly.');
    }
    if (sourceLang === targetLang) {
      const same: Record<number, string> = {};
      for (const item of items) same[item.index] = item.text;
      return same;
    }

    // Deduplicate identical non-empty lines to minimize requests
    const uniqueTexts: string[] = [];
    const textToIndices = new Map<string, number[]>();
    for (const item of items) {
      const clean = item.text.trim();
      if (!clean) continue;
      const list = textToIndices.get(clean);
      if (list) {
        list.push(item.index);
      } else {
        textToIndices.set(clean, [item.index]);
        uniqueTexts.push(clean);
      }
    }

    const result: Record<number, string> = {};

    // Group unique lines into batches under MAX_BATCH_CHARS
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentLen = 0;

    for (const text of uniqueTexts) {
      const addLen = text.length + (currentBatch.length > 0 ? 1 : 0);
      if (currentBatch.length > 0 && currentLen + addLen > MAX_BATCH_CHARS) {
        batches.push(currentBatch);
        currentBatch = [text];
        currentLen = text.length;
      } else {
        currentBatch.push(text);
        currentLen += addLen;
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    for (const batch of batches) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const joined = batch.join('\n');
      const translated = await this.requestTranslation(joined, sourceLang, targetLang, signal);
      const split = translated.split('\n').map(sanitizePlainText);

      if (split.length === batch.length) {
        for (let i = 0; i < batch.length; i++) {
          const indices = textToIndices.get(batch[i]) ?? [];
          for (const idx of indices) {
            if (split[i]) result[idx] = split[i];
          }
        }
      } else {
        // Fallback: translate each line individually if batch line-count didn't align
        for (const line of batch) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          const single = sanitizePlainText(
            await this.requestTranslation(line, sourceLang, targetLang, signal)
          );
          const indices = textToIndices.get(line) ?? [];
          for (const idx of indices) {
            if (single) result[idx] = single;
          }
        }
      }
    }

    return result;
  }

  private async requestTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
    signal?: AbortSignal
  ): Promise<string> {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') || '60');
        this.cooldownUntil = Date.now() + Math.max(15, retryAfter) * 1000;
        throw new Error('Translation rate limit reached (HTTP 429). Please try again later.');
      }
      if (!res.ok) {
        throw new Error(`Translation request failed (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as {
        responseStatus?: number;
        responseDetails?: string;
        responseData?: { translatedText?: string };
      };
      if (data.responseStatus && data.responseStatus !== 200) {
        throw new Error(data.responseDetails || 'Translation service returned an error.');
      }
      const translatedText = data.responseData?.translatedText;
      if (typeof translatedText !== 'string' || !translatedText.trim()) {
        throw new Error('Empty translation response.');
      }
      return translatedText;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

export const myMemoryProvider = new MyMemoryTranslationProvider();
