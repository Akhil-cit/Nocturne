import { musicProviderManager } from '../music/provider';
import { useProviderStore } from '../../stores/providerStore';
import type { AudioQualityPreference, RepeatMode, Track, TrackAlternateSource, ResolvedStream } from '../music/types';

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'error';

export type PlaybackEventMap = {
  sourcechange: CustomEvent<{ source: ResolvedStream | null }>;
  trackchange: CustomEvent<{ track: Track | null; index: number }>;
  play: CustomEvent<{ track: Track | null }>;
  pause: CustomEvent<{ track: Track | null }>;
  ended: CustomEvent<{ track: Track | null }>;
  timeupdate: CustomEvent<{ currentTime: number; duration: number }>;
  durationchange: CustomEvent<{ duration: number }>;
  queuechange: CustomEvent<{ queue: Track[]; index: number }>;
  volumechange: CustomEvent<{ volume: number; muted: boolean }>;
  shufflechange: CustomEvent<{ shuffle: boolean }>;
  repeatchange: CustomEvent<{ repeatMode: RepeatMode }>;
  loading: CustomEvent<{ loading: boolean }>;
  statuschange: CustomEvent<{ status: PlaybackStatus }>;
  error: CustomEvent<{ message: string; error?: unknown }>;
};

export class PlaybackEngine extends EventTarget {
  private static instance: PlaybackEngine | null = null;

  private audio: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private originalQueue: Track[] = [];
  private queue: Track[] = [];
  private queueIndex = -1;

  private shuffleEnabled = false;
  private repeatMode: RepeatMode = 'off';
  private volume = 0.8;
  private muted = false;
  private playing = false;
  private paused = false;
  private userPaused = false;
  private status: PlaybackStatus = 'idle';
  private loadSequence = 0;
  private recoveryAttempts = 0;
  private failedUrls = new Set<string>();
  private selectedSource: ResolvedStream | null = null;
  private openingSequence: number | null = null;
  private mediaRejected = '';

  private readonly maxRecoveryAttempts = 3;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRestoreTime: number | null = null;
  private lastProgressTime = 0;

  private constructor() {
    super();
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'auto';
    this.audio.volume = this.volume;

    this.bindAudioEvents();
    this.initMediaSession();
  }

  public static getInstance(): PlaybackEngine {
    if (!PlaybackEngine.instance) {
      PlaybackEngine.instance = new PlaybackEngine();
    }
    return PlaybackEngine.instance;
  }

  private ensureAudioGraph(): void {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume().catch(() => undefined);
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(this.audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;

      const gain = ctx.createGain();
      gain.gain.value = this.muted ? 0 : this.volume;

      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);

      // Keep HTMLAudioElement at 1.0 when GainNode controls output level
      this.audio.volume = 1;

      this.audioContext = ctx;
      this.sourceNode = source;
      this.analyserNode = analyser;
      this.gainNode = gain;
    } catch {
      // Fallback to native HTMLAudioElement volume if Web Audio setup fails
    }
  }

  private setStatus(nextStatus: PlaybackStatus): void {
    if (this.status === nextStatus) return;
    this.status = nextStatus;
    this.emit('statuschange', { status: nextStatus });
  }

  private clearRecoveryTimers(): void {
    if (this.stallTimer) {
      clearTimeout(this.stallTimer);
      this.stallTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleStallWatchdog(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    if (this.userPaused || this.audio.paused || this.audio.ended) return;

    const observedTime = this.getCurrentTime();
    const seq = this.loadSequence;
    const timeoutMs = observedTime < 0.5 ? 15000 : 8000;

    this.stallTimer = setTimeout(() => {
      this.stallTimer = null;
      if (seq !== this.loadSequence) return;
      if (this.userPaused || this.audio.ended) return;
      // Only recover if playback position is genuinely stuck and buffer isn't ready
      if (
        Math.abs(this.getCurrentTime() - observedTime) < 0.15 &&
        (this.audio.readyState < 3 || this.audio.paused)
      ) {
        void this.recoverPlayback('Playback stalled while buffering.');
      }
    }, timeoutMs);
  }

  private async recoverPlayback(reason: string): Promise<void> {
    if (this.userPaused || this.audio.ended) return;
    const track = this.getCurrentTrack();
    if (!track) return;

    if (this.retryTimer || this.openingSequence !== null) return;
    if (this.recoveryAttempts === 0 && track.streamUrl && track.streamUrl.startsWith('http')) {
      try {
        const probe = await fetch(track.streamUrl, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
        });
        if (probe.status === 429) {
          const retryAfter = probe.headers.get('retry-after');
          const waitHint = retryAfter ? `~${retryAfter}s` : '~30–60s';
          this.recoveryAttempts = this.maxRecoveryAttempts;
          this.playing = false;
          this.setStatus('error');
          this.emit('loading', { loading: false });
          this.emit('error', {
            message: `Stream server rate-limited (HTTP 429). Wait ${waitHint} before clicking Retry.`,
          });
          return;
        }
      } catch {
        // Proceed with normal recovery if probe fails
      }
    }

    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      this.setStatus('error');
      this.emit('loading', { loading: false });
      this.emit('error', { message: reason + ' Click Retry to try again.' });
      return;
    }
    const delay = 1000 * 2 ** this.recoveryAttempts++;
    const seq = this.loadSequence;
    const failedProvider = this.selectedSource?.provider;
    if (this.selectedSource) this.failedUrls.add(this.selectedSource.url);
    this.pendingRestoreTime = this.getCurrentTime() || this.pendingRestoreTime;
    this.setStatus('buffering');
    this.emit('loading', { loading: true });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (seq !== this.loadSequence || this.userPaused) return;
      void this.openRecording(track, seq, failedProvider);
    }, delay);
  }

  private async openRecording(track: Track, seq: number, failedProvider?: string): Promise<void> {
    this.openingSequence = seq;
    const { autoFallback, preferredQuality } = useProviderStore.getState();
    let candidates: TrackAlternateSource[] = [];
    let failure = '';
    try {
      candidates = await musicProviderManager.playbackCandidates(track, autoFallback, !!failedProvider);
      if (failedProvider) candidates.sort((a, b) => Number(a.provider === failedProvider) - Number(b.provider === failedProvider));
      for (const candidate of candidates) {
        if (seq !== this.loadSequence || this.userPaused) return;
        const qualityOrder: AudioQualityPreference[] = [
          preferredQuality,
          ...(['high', 'medium', 'low'] as AudioQualityPreference[]).filter(
            (q) => q !== preferredQuality
          ),
        ];
        // Only try alternate qualities if the first attempt fails with a media/format error
        for (let qIdx = 0; qIdx < qualityOrder.length; qIdx++) {
          if (seq !== this.loadSequence || this.userPaused) return;
          const qualityAttempt = qualityOrder[qIdx];
          this.mediaRejected = '';
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const source = await musicProviderManager.resolveSource(
              candidate,
              track,
              qualityAttempt,
              this.failedUrls
            );
            if (seq !== this.loadSequence || this.userPaused) return;
            this.selectedSource = source;
            this.mediaRejected = '';
            this.audio.src = source.url;
            this.audio.load();
            this.ensureAudioGraph();
            await Promise.race([
              this.audio.play(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Timed out waiting for audio.')), 20000);
              }),
            ]);
            if (seq !== this.loadSequence || this.userPaused) return;
            if (this.mediaRejected) throw new Error(this.mediaRejected);
            musicProviderManager.reportPlayback(source.provider);
            this.emit('sourcechange', { source: { ...source, duration: this.audio.duration } });
            return;
          } catch (err) {
            if (seq !== this.loadSequence || this.userPaused) return;
            if (this.selectedSource?.trackId === candidate.trackId) {
              this.failedUrls.add(this.selectedSource.url);
            }
            const errMsg =
              this.mediaRejected ||
              this.audio.error?.message ||
              (err instanceof Error ? err.message : 'Unable to load audio.');
            failure = candidate.provider + ': ' + errMsg;
            this.audio.pause();
            this.audio.removeAttribute('src');
            this.audio.load();
            const isFormatOrMediaError =
              /format error|not supported|MEDIA_ELEMENT_ERROR|decode/i.test(errMsg) ||
              Boolean(this.mediaRejected);
            if (!isFormatOrMediaError) {
              break;
            }
          } finally {
            clearTimeout(timer);
          }
        }
        musicProviderManager.reportPlayback(candidate.provider, failure);
      }
      if (seq !== this.loadSequence || this.userPaused) return;
      if (!candidates.length) {
        const catalog = track.provider ?? track.metadataProvider;
        failure = 'Full track unavailable. ' + (catalog === 'itunes'
          ? 'iTunes supplies promotional previews only.'
          : catalog === 'tracks' ? 'Tracks supplies catalog metadata only.' : 'No enabled full-track source matched this recording.')
          + ' Open a local copy or use the official player.';
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : 'Unable to resolve the recording.';
    } finally {
      if (this.openingSequence === seq) this.openingSequence = null;
    }
    if (seq !== this.loadSequence || this.userPaused) return;
    this.emit('sourcechange', { source: null });
    if (this.recoveryAttempts >= 2) this.failedUrls.clear();
    if (candidates.length && this.recoveryAttempts < this.maxRecoveryAttempts) {
      await this.recoverPlayback(failure);
    } else {
      this.setStatus('error');
      this.emit('loading', { loading: false });
      this.emit('error', { message: failure });
    }
  }

  private bindAudioEvents(): void {
    this.audio.addEventListener('play', () => {
      this.playing = true;
      this.paused = false;
      this.userPaused = false;
      this.updateMediaSessionState('playing');
      this.emit('play', { track: this.getCurrentTrack() });
    });

    this.audio.addEventListener('playing', () => {
      this.clearRecoveryTimers();
      this.playing = true;
      this.paused = false;
      this.setStatus('playing');
      this.emit('loading', { loading: false });
    });

    this.audio.addEventListener('pause', () => {
      if (this.userPaused) this.clearRecoveryTimers();
      this.playing = false;
      this.paused = true;
      if (this.status !== 'error' && this.status !== 'loading' && this.status !== 'buffering') {
        this.setStatus('paused');
      }
      this.updateMediaSessionState('paused');
      this.emit('pause', { track: this.getCurrentTrack() });
    });

    this.audio.addEventListener('loadedmetadata', () => {
      const expected = this.getCurrentTrack()?.duration ?? 0;
      if (this.selectedSource?.provider !== 'local' && expected > 60 && this.audio.duration > 0 && this.audio.duration <= 31) {
        this.mediaRejected = 'The server returned a short clip for a full-length recording.';
        this.audio.pause();
        return;
      }
      if (
        this.pendingRestoreTime !== null &&
        Number.isFinite(this.pendingRestoreTime)
      ) {
        const target = this.pendingRestoreTime;
        this.pendingRestoreTime = null;
        const dur = this.getDuration();
        this.audio.currentTime = dur > 0 ? Math.min(target, dur - 0.2) : target;
      }
      this.emit('durationchange', { duration: this.getDuration() });
    });

    this.audio.addEventListener('timeupdate', () => {
      const currentTime = this.getCurrentTime();
      const duration = this.getDuration();
      if (Math.abs(currentTime - this.lastProgressTime) >= 0.2) {
        this.lastProgressTime = currentTime;
        this.recoveryAttempts = 0;
        if (!this.audio.paused && this.status !== 'playing') {
          this.setStatus('playing');
          this.emit('loading', { loading: false });
        }
        if (this.stallTimer) {
          clearTimeout(this.stallTimer);
          this.stallTimer = null;
        }
      }
      this.emit('timeupdate', { currentTime, duration });
      this.updateMediaSessionPosition(currentTime, duration);
    });

    this.audio.addEventListener('durationchange', () => {
      this.emit('durationchange', { duration: this.getDuration() });
    });

    this.audio.addEventListener('ended', () => {
      this.clearRecoveryTimers();
      this.playing = false;
      this.setStatus('idle');
      this.emit('ended', { track: this.getCurrentTrack() });
      void this.handleTrackEnded();
    });

    this.audio.addEventListener('waiting', () => {
      if (!this.userPaused && !this.audio.paused) {
        this.setStatus('buffering');
        this.emit('loading', { loading: true });
        this.scheduleStallWatchdog();
      }
    });

    this.audio.addEventListener('stalled', () => {
      if (!this.userPaused && !this.audio.paused) {
        this.setStatus('buffering');
        this.scheduleStallWatchdog();
      }
    });

    this.audio.addEventListener('canplay', () => {
      this.emit('loading', { loading: false });
      if (!this.audio.paused && !this.userPaused) {
        this.setStatus('playing');
      }
    });

    this.audio.addEventListener('error', () => {
      this.playing = false;
      if (!this.audio.hasAttribute('src') || this.openingSequence !== null) return;
      const mediaError = this.audio.error;
      const msg = mediaError?.message || 'Failed to play audio stream.';
      if (!this.userPaused && this.getCurrentTrack() && this.audio.src) {
        void this.recoverPlayback(msg);
      } else {
        this.setStatus('error');
        this.emit('loading', { loading: false });
        this.emit('error', { message: msg, error: mediaError });
      }
    });
  }

  private initMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => {
        void this.play();
      });
      ms.setActionHandler('pause', () => {
        this.pause();
      });
      ms.setActionHandler('previoustrack', () => {
        void this.previous();
      });
      ms.setActionHandler('nexttrack', () => {
        void this.next();
      });
      ms.setActionHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number') {
          this.seekTo(details.seekTime);
        }
      });
    } catch {
      // Some environments restrict specific MediaSession actions
    }
  }

  private updateMediaSessionMetadata(track: Track | null): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    if (typeof MediaMetadata !== 'undefined') {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album.title,
        artwork: track.cover
          ? [{ src: track.cover, sizes: '512x512', type: 'image/png' }]
          : [],
      });
    }
  }

  private updateMediaSessionState(state: MediaSessionPlaybackState): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    navigator.mediaSession.playbackState = state;
  }

  private updateMediaSessionPosition(currentTime: number, duration: number): void {
    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.audio.playbackRate || 1,
        position: Math.min(Math.max(0, currentTime), duration),
      });
    } catch {
      // Ignore invalid position state errors
    }
  }

  private emit<K extends keyof PlaybackEventMap>(
    type: K,
    detail: PlaybackEventMap[K]['detail']
  ): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getGainNode(): GainNode | null {
    return this.gainNode;
  }

  public getQueue(): Track[] {
    return [...this.queue];
  }

  public getQueueIndex(): number {
    return this.queueIndex;
  }

  public getCurrentTrack(): Track | null {
    if (this.queueIndex < 0 || this.queueIndex >= this.queue.length) {
      return null;
    }
    return this.queue[this.queueIndex];
  }

  public getCurrentTime(): number {
    return Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
  }

  public getDuration(): number {
    if (Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
      return this.audio.duration;
    }
    return this.getCurrentTrack()?.duration ?? 0;
  }

  public getStatus(): PlaybackStatus {
    return this.status;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getVolume(): number {
    return this.volume;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isShuffleEnabled(): boolean {
    return this.shuffleEnabled;
  }

  public getRepeatMode(): RepeatMode {
    return this.repeatMode;
  }

  public setQueue(tracks: Track[], startIndex = 0): void {
    this.originalQueue = [...tracks];

    if (tracks.length === 0) {
      this.clearQueue();
      return;
    }

    const clampedIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));

    if (this.shuffleEnabled) {
      const startTrack = tracks[clampedIndex];
      const rest = tracks.filter((_, idx) => idx !== clampedIndex);
      this.fisherYatesShuffle(rest);
      this.queue = [startTrack, ...rest];
      this.queueIndex = 0;
    } else {
      this.queue = [...tracks];
      this.queueIndex = clampedIndex;
    }

    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public addToQueue(trackOrTracks: Track | Track[]): void {
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (items.length === 0) return;

    this.originalQueue.push(...items);
    this.queue.push(...items);

    if (this.queueIndex === -1) {
      this.queueIndex = 0;
    }

    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public removeFromQueue(index: number): void {
    if (index < 0 || index >= this.queue.length) return;

    const [removed] = this.queue.splice(index, 1);
    const origIdx = this.originalQueue.findIndex((t) => t.id === removed.id);
    if (origIdx !== -1) {
      this.originalQueue.splice(origIdx, 1);
    }

    if (this.queue.length === 0) {
      this.clearQueue();
      return;
    } else if (index < this.queueIndex) {
      this.queueIndex -= 1;
    } else if (index === this.queueIndex) {
      this.queueIndex = Math.min(this.queueIndex, this.queue.length - 1);
      void this.loadAndPlayIndex(this.queueIndex);
    }

    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public insertNextInQueue(trackOrTracks: Track | Track[]): void {
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (items.length === 0) return;

    const insertAt = this.queueIndex >= 0 ? this.queueIndex + 1 : 0;
    this.queue.splice(insertAt, 0, ...items);
    this.originalQueue.splice(insertAt, 0, ...items);

    if (this.queueIndex === -1) {
      this.queueIndex = 0;
    }

    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public reorderQueue(fromIndex: number, toIndex: number): void {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      fromIndex >= this.queue.length ||
      toIndex < 0 ||
      toIndex >= this.queue.length
    ) {
      return;
    }
    const currentTrack = this.getCurrentTrack();
    const [moved] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, moved);
    if (currentTrack) {
      this.queueIndex = this.queue.findIndex((t) => t.id === currentTrack.id);
    }
    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public async playQueueIndex(index: number): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;
    await this.loadAndPlayIndex(index);
  }

  public clearQueue(): void {
    ++this.loadSequence;
    this.openingSequence = null;
    this.selectedSource = null;
    this.clearRecoveryTimers();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.setStatus('idle');
    this.emit('sourcechange', { source: null });
    this.originalQueue = [];
    this.queue = [];
    this.queueIndex = -1;
    this.playing = false;
    this.paused = false;
    this.updateMediaSessionMetadata(null);
    this.updateMediaSessionState('none');
    this.emit('queuechange', { queue: [], index: -1 });
    this.emit('trackchange', { track: null, index: -1 });
  }

  public async play(track?: Track): Promise<void> {
    this.ensureAudioGraph();
    this.userPaused = false;
    this.clearRecoveryTimers();

    if (track) {
      const existingIndex = this.queue.findIndex((t) => t.id === track.id);
      if (existingIndex !== -1) {
        await this.loadAndPlayIndex(existingIndex);
      } else {
        this.originalQueue.push(track);
        this.queue.push(track);
        this.queueIndex = this.queue.length - 1;
        this.emit('queuechange', {
          queue: this.getQueue(),
          index: this.queueIndex,
        });
        await this.loadAndPlayIndex(this.queueIndex);
      }
      return;
    }

    if (!this.audio.src && this.queueIndex >= 0 && this.queue[this.queueIndex]) {
      await this.loadAndPlayIndex(this.queueIndex);
      return;
    }

    if (this.audio.src) {
      if (this.status === 'error' || this.audio.error) {
        await this.retry();
        return;
      }
      try {
        await this.audio.play();
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === 'AbortError') return;
        await this.recoverPlayback('Playback resume failed.');
      }
    }
  }

  public pause(): void {
    this.userPaused = true;
    this.clearRecoveryTimers();
    this.audio.pause();
  }

  public async retry(): Promise<void> {
    const track = this.getCurrentTrack();
    if (!track) return;
    this.userPaused = false;
    this.clearRecoveryTimers();
    this.recoveryAttempts = 0;
    const resumeAt = this.getCurrentTime();
    this.pendingRestoreTime = resumeAt > 0.5 ? resumeAt : null;
    await this.loadAndPlayIndex(this.queueIndex, true);
  }

  public async toggle(): Promise<void> {
    if (this.status === 'error') {
      await this.retry();
      return;
    }
    if (this.status === 'buffering' && (this.audio.paused || this.audio.readyState < 3)) {
      await this.retry();
      return;
    }
    if (this.playing && !this.audio.paused) {
      this.pause();
    } else {
      await this.play();
    }
  }

  public async next(): Promise<void> {
    if (this.queue.length === 0) return;

    if (this.repeatMode === 'one') {
      this.seekTo(0);
      await this.play();
      return;
    }

    const nextIndex = this.queueIndex + 1;
    if (nextIndex < this.queue.length) {
      await this.loadAndPlayIndex(nextIndex);
    } else if (this.repeatMode === 'all') {
      await this.loadAndPlayIndex(0);
    } else {
      this.pause();
      this.seekTo(0);
    }
  }

  public async previous(): Promise<void> {
    if (this.queue.length === 0) return;

    if (this.getCurrentTime() > 3) {
      this.seekTo(0);
      return;
    }

    const prevIndex = this.queueIndex - 1;
    if (prevIndex >= 0) {
      await this.loadAndPlayIndex(prevIndex);
    } else if (this.repeatMode === 'all') {
      await this.loadAndPlayIndex(this.queue.length - 1);
    } else {
      this.seekTo(0);
    }
  }

  public seekTo(time: number): void {
    const duration = this.getDuration();
    const clamped = Math.max(
      0,
      duration > 0 ? Math.min(time, duration) : time
    );
    if (Number.isFinite(clamped)) {
      this.audio.currentTime = clamped;
      this.emit('timeupdate', { currentTime: clamped, duration });
      this.updateMediaSessionPosition(clamped, duration);
    }
  }

  public seekWhenReady(trackId: string, time: number): void {
    if (!Number.isFinite(time) || time <= 0) return;
    const apply = () => {
      if (this.getCurrentTrack()?.id !== trackId) return;
      this.seekTo(time);
    };
    if (this.audio.readyState >= 3) {
      apply();
    } else {
      this.audio.addEventListener('canplay', apply, { once: true });
    }
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = clamped;
    if (clamped > 0 && this.muted) {
      this.muted = false;
    }

    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(
        this.muted ? 0 : clamped,
        this.audioContext.currentTime,
        0.015
      );
    } else {
      this.audio.volume = this.muted ? 0 : clamped;
    }

    this.emit('volumechange', { volume: this.volume, muted: this.muted });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(
        muted ? 0 : this.volume,
        this.audioContext.currentTime,
        0.015
      );
    } else {
      this.audio.volume = muted ? 0 : this.volume;
    }
    this.emit('volumechange', { volume: this.volume, muted: this.muted });
  }

  public setShuffle(enabled: boolean): void {
    if (this.shuffleEnabled === enabled) return;
    this.shuffleEnabled = enabled;

    const currentTrack = this.getCurrentTrack();

    if (enabled) {
      const rest = this.originalQueue.filter((t) => t.id !== currentTrack?.id);
      this.fisherYatesShuffle(rest);
      this.queue = currentTrack ? [currentTrack, ...rest] : rest;
      this.queueIndex = currentTrack ? 0 : this.queue.length > 0 ? 0 : -1;
    } else {
      this.queue = [...this.originalQueue];
      this.queueIndex = currentTrack
        ? this.queue.findIndex((t) => t.id === currentTrack.id)
        : this.queue.length > 0
          ? 0
          : -1;
    }

    this.emit('shufflechange', { shuffle: this.shuffleEnabled });
    this.emit('queuechange', {
      queue: this.getQueue(),
      index: this.queueIndex,
    });
  }

  public toggleShuffle(): boolean {
    this.setShuffle(!this.shuffleEnabled);
    return this.shuffleEnabled;
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
    this.emit('repeatchange', { repeatMode: mode });
  }

  public cycleRepeatMode(): RepeatMode {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(this.repeatMode) + 1) % order.length];
    this.setRepeatMode(next);
    return next;
  }

  private async loadAndPlayIndex(index: number, preserveRestoreTime = false): Promise<void> {
    if (index < 0 || index >= this.queue.length) return;
    const seq = ++this.loadSequence;
    this.clearRecoveryTimers();
    this.recoveryAttempts = 0;
    this.userPaused = false;
    if (!preserveRestoreTime) {
      this.pendingRestoreTime = null;
      this.lastProgressTime = 0;
    }

    this.queueIndex = index;
    this.failedUrls.clear();
    const track = this.queue[index];

    this.setStatus('loading');
    this.emit('loading', { loading: true });
    this.emit('trackchange', { track, index });
    this.updateMediaSessionMetadata(track);

    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.selectedSource = null;
    this.emit('sourcechange', { source: null });
    await this.openRecording(track, seq);
  }

  private async handleTrackEnded(): Promise<void> {
    if (this.repeatMode === 'one') {
      this.seekTo(0);
      await this.play();
      return;
    }

    if (this.queueIndex + 1 < this.queue.length) {
      await this.loadAndPlayIndex(this.queueIndex + 1);
    } else if (this.repeatMode === 'all' && this.queue.length > 0) {
      await this.loadAndPlayIndex(0);
    } else {
      this.paused = false;
      this.updateMediaSessionState('none');
    }
  }

  private fisherYatesShuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = array[i];
      array[i] = array[j];
      array[j] = tmp;
    }
  }

  public dispose(): void {
    this.clearRecoveryTimers();
    this.loadSequence += 1;
    this.audio.pause();
    this.audio.src = '';
    this.sourceNode?.disconnect();
    this.analyserNode?.disconnect();
    this.gainNode?.disconnect();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
  }
}

export const playbackEngine = PlaybackEngine.getInstance();
