import type { LyricLine, SyncedLyrics, Track } from '../music/types';
import { setCachedLyrics } from './cache';
import { estimateWordTimings, parseLRC } from './parser';

export function importLrcFromText(
  lrcText: string,
  providerName = 'local-lrc'
): SyncedLyrics | null {
  const parsed = parseLRC(lrcText);
  if (parsed.length === 0) return null;

  const hasWordLevel = parsed.some(
    (line) => line.words && line.words.length > 0 && !line.words[0].isEstimated
  );

  const lines: LyricLine[] = parsed.map((line, index) => {
    const nextLineTime =
      index + 1 < parsed.length ? parsed[index + 1].time : line.time + 4;
    const words =
      line.words && line.words.length > 0
        ? line.words
        : estimateWordTimings(line, nextLineTime);
    return {
      ...line,
      words,
    };
  });

  return {
    lines,
    provider: providerName,
    hasWordLevel,
  };
}

function readBrowserLrcFile(): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.lrc,.txt';
    input.style.display = 'none';

    const cleanup = () => {
      input.remove();
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        cleanup();
        resolve(text);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    input.oncancel = () => {
      cleanup();
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

export async function importLrcFromFile(): Promise<SyncedLyrics | null> {
  let content: string | null = null;

  if (typeof window !== 'undefined' && window.electronAPI?.openLrcFile) {
    const result = await window.electronAPI.openLrcFile();
    content = result?.content ?? null;
  } else {
    content = await readBrowserLrcFile();
  }

  if (!content) return null;
  return importLrcFromText(content);
}

export async function importLrcForTrack(
  track: Track
): Promise<SyncedLyrics | null> {
  const lyrics = await importLrcFromFile();
  if (!lyrics) return null;
  await setCachedLyrics(
    track.title,
    track.artist,
    lyrics,
    track.album?.title
  );
  return lyrics;
}
