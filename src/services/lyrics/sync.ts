import type { LyricLine, SyncedLyrics } from '../music/types';

export interface LyricSyncState {
  lineIndex: number;
  wordIndex: number;
  progress: number;
  isInstrumental: boolean;
}

export class LyricSyncEngine {
  private lyrics: SyncedLyrics | null = null;
  private offsetSeconds = 0;
  private paused = false;
  private lastKnownTime = 0;
  private cachedState: LyricSyncState = {
    lineIndex: -1,
    wordIndex: -1,
    progress: 0,
    isInstrumental: false,
  };

  constructor(lyrics: SyncedLyrics | null = null) {
    this.lyrics = lyrics;
  }

  public setLyrics(lyrics: SyncedLyrics | null): void {
    this.lyrics = lyrics;
    this.lastKnownTime = 0;
    this.cachedState = {
      lineIndex: -1,
      wordIndex: -1,
      progress: 0,
      isInstrumental: false,
    };
  }

  public getLyrics(): SyncedLyrics | null {
    return this.lyrics;
  }

  public setOffset(offsetSeconds: number): void {
    this.offsetSeconds = Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
  }

  public getOffset(): number {
    return this.offsetSeconds;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public reset(): void {
    this.lastKnownTime = 0;
    this.paused = false;
    this.cachedState = {
      lineIndex: -1,
      wordIndex: -1,
      progress: 0,
      isInstrumental: false,
    };
  }

  public seek(time: number): LyricSyncState {
    this.lastKnownTime = Math.max(0, time);
    return this.computeState(this.lastKnownTime);
  }

  public getCurrentState(time: number): LyricSyncState {
    if (this.paused) {
      return this.cachedState;
    }
    this.lastKnownTime = Math.max(0, time);
    return this.computeState(this.lastKnownTime);
  }

  private computeState(rawTime: number): LyricSyncState {
    const lines = this.lyrics?.lines;
    if (!lines || lines.length === 0) {
      this.cachedState = {
        lineIndex: -1,
        wordIndex: -1,
        progress: 0,
        isInstrumental: false,
      };
      return this.cachedState;
    }

    const time = rawTime + this.offsetSeconds;
    if (time < lines[0].time) {
      this.cachedState = {
        lineIndex: -1,
        wordIndex: -1,
        progress: 0,
        isInstrumental: time < lines[0].time - 2,
      };
      return this.cachedState;
    }

    const lineIndex = this.findLineIndex(lines, time);
    if (lineIndex < 0) {
      this.cachedState = {
        lineIndex: -1,
        wordIndex: -1,
        progress: 0,
        isInstrumental: false,
      };
      return this.cachedState;
    }

    const currentLine = lines[lineIndex];
    const nextLineTime =
      lineIndex + 1 < lines.length
        ? lines[lineIndex + 1].time
        : currentLine.time + 4;

    const lineDuration = Math.max(0.1, nextLineTime - currentLine.time);
    const progress = Math.min(
      1,
      Math.max(0, (time - currentLine.time) / lineDuration)
    );

    const estimatedEnd =
      currentLine.words && currentLine.words.length > 0
        ? currentLine.words[currentLine.words.length - 1].endTime
        : currentLine.time + 3.5;

    const gapToNext =
      lineIndex + 1 < lines.length ? nextLineTime - estimatedEnd : 0;
    const isInstrumental = gapToNext > 8 && time > estimatedEnd + 2.5;

    const wordIndex = this.findWordIndex(currentLine, time);

    this.cachedState = {
      lineIndex,
      wordIndex,
      progress,
      isInstrumental,
    };
    return this.cachedState;
  }

  private findLineIndex(lines: LyricLine[], time: number): number {
    let low = 0;
    let high = lines.length - 1;
    let result = -1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (lines[mid].time <= time) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }

  private findWordIndex(line: LyricLine, time: number): number {
    const words = line.words;
    if (!words || words.length === 0) return -1;

    if (time < words[0].time) return -1;

    let low = 0;
    let high = words.length - 1;
    let result = 0;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (words[mid].time <= time) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return result;
  }
}

export const lyricSyncEngine = new LyricSyncEngine();
