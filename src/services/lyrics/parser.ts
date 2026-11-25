import type { LyricLine, LyricWord } from '../music/types';

const TIMESTAMP_REGEX = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;
const OFFSET_REGEX = /^\[offset:\s*([+-]?\d+)\s*\]$/i;
const INLINE_WORD_REGEX = /<(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?>([^<]*)/g;

function parseTimestampToSeconds(
  minutesStr: string,
  secondsStr: string,
  fractionStr?: string
): number {
  const minutes = parseInt(minutesStr, 10);
  const seconds = parseInt(secondsStr, 10);
  let fraction = 0;

  if (fractionStr) {
    if (fractionStr.length === 1) {
      fraction = parseInt(fractionStr, 10) / 10;
    } else if (fractionStr.length === 2) {
      fraction = parseInt(fractionStr, 10) / 100;
    } else {
      fraction = parseInt(fractionStr.slice(0, 3), 10) / 1000;
    }
  }

  return minutes * 60 + seconds + fraction;
}

function parseEnhancedInlineWords(
  rawText: string,
  offsetSec: number
): { cleanText: string; words?: LyricWord[] } {
  const matches = Array.from(rawText.matchAll(INLINE_WORD_REGEX));
  if (matches.length === 0) {
    return { cleanText: rawText.trim() };
  }

  const words: LyricWord[] = [];
  const textParts: string[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const wordTime = Math.max(
      0,
      parseTimestampToSeconds(match[1], match[2], match[3]) + offsetSec
    );
    const wordText = match[4].trim();
    if (!wordText) continue;

    let endTime = wordTime + 0.5;
    if (i + 1 < matches.length) {
      const next = matches[i + 1];
      const nextTime = Math.max(
        wordTime + 0.05,
        parseTimestampToSeconds(next[1], next[2], next[3]) + offsetSec
      );
      endTime = nextTime;
    }

    words.push({
      time: wordTime,
      endTime,
      text: wordText,
      isEstimated: false,
    });
    textParts.push(wordText);
  }

  return {
    cleanText: textParts.join(' ').trim(),
    words: words.length > 0 ? words : undefined,
  };
}

export function parseLRC(lrcText: string): LyricLine[] {
  if (!lrcText || !lrcText.trim()) return [];

  const rawLines = lrcText.split(/\r?\n/);
  let offsetSec = 0;

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    const offsetMatch = trimmed.match(OFFSET_REGEX);
    if (offsetMatch) {
      offsetSec = parseInt(offsetMatch[1], 10) / 1000;
    }
  }

  const parsed: LyricLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    TIMESTAMP_REGEX.lastIndex = 0;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = TIMESTAMP_REGEX.exec(trimmed)) !== null) {
      const time = Math.max(
        0,
        parseTimestampToSeconds(match[1], match[2], match[3]) + offsetSec
      );
      timestamps.push(time);
      lastIndex = TIMESTAMP_REGEX.lastIndex;
    }

    if (timestamps.length === 0) {
      continue;
    }

    const body = trimmed.slice(lastIndex);
    const { cleanText, words } = parseEnhancedInlineWords(body, offsetSec);

    if (!cleanText) continue;

    for (const time of timestamps) {
      parsed.push({
        time,
        text: cleanText,
        words: words ? words.map((w) => ({ ...w })) : undefined,
      });
    }
  }

  parsed.sort((a, b) => a.time - b.time);
  return parsed;
}

function countGraphemes(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let count = 0;
    for (const _ of segmenter.segment(text)) count++;
    return Math.max(1, count);
  }
  return Math.max(1, Array.from(text).length);
}

export function estimateWordTimings(
  line: LyricLine,
  nextLineTime: number
): LyricWord[] {
  if (line.words && line.words.length > 0 && !line.words[0].isEstimated) {
    return line.words;
  }

  const tokens = line.text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return [];

  const totalLineDuration =
    nextLineTime > line.time ? Math.min(nextLineTime - line.time, 12) : 4;
  const effectiveDuration = Math.max(0.25, totalLineDuration);

  // Reserve small gaps between words while keeping at least 80% for word durations
  const gapCount = Math.max(0, tokens.length - 1);
  const desiredGap = Math.min(0.06, (effectiveDuration * 0.15) / Math.max(1, gapCount));
  const totalGapTime = desiredGap * gapCount;
  const speakingDuration = Math.max(0.15, effectiveDuration - totalGapTime);

  const weights = tokens.map((w) => countGraphemes(w));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const words: LyricWord[] = [];
  let cursor = line.time;

  for (let i = 0; i < tokens.length; i++) {
    const wordDuration = (weights[i] / totalWeight) * speakingDuration;
    const startTime = cursor;
    const endTime = startTime + wordDuration;

    words.push({
      time: startTime,
      endTime,
      text: tokens[i],
      isEstimated: true,
    });

    cursor = endTime + (i < tokens.length - 1 ? desiredGap : 0);
  }

  return words;
}
