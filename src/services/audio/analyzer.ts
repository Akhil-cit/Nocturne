import { playbackEngine } from '../playback/engine';

export interface AudioAnalyzerData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  bass: number;
  mid: number;
  treble: number;
  volume: number;
}

export class AudioAnalyzer {
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private timeDomainData: Uint8Array<ArrayBuffer> = new Uint8Array(0);

  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedHigh = 0;
  private smoothedRMS = 0;

  private readonly smoothingFactor: number;
  private readonly energyHistory: number[] = [];
  private readonly historySize = 43; // ~0.7s at 60fps
  private lastBeatTimestamp = 0;
  private readonly beatCooldownMs = 220;

  constructor(analyser: AnalyserNode | null = null, smoothingFactor = 0.25) {
    this.smoothingFactor = Math.max(0.05, Math.min(1, smoothingFactor));
    if (analyser) {
      this.attach(analyser);
    }
  }

  public attach(analyser: AnalyserNode): void {
    this.analyser = analyser;
    const binCount = analyser.frequencyBinCount;
    this.frequencyData = new Uint8Array(new ArrayBuffer(binCount));
    this.timeDomainData = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }

  private ensureAttached(): AnalyserNode | null {
    if (!this.analyser) {
      const engineAnalyser = playbackEngine.getAnalyserNode();
      if (engineAnalyser) {
        this.attach(engineAnalyser);
      }
    }
    return this.analyser;
  }

  public getFrequencyData(): Uint8Array {
    const analyser = this.ensureAttached();
    if (!analyser) return this.frequencyData;
    analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  public getTimeDomainData(): Uint8Array {
    const analyser = this.ensureAttached();
    if (!analyser) return this.timeDomainData;
    analyser.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }

  public getBassEnergy(): number {
    const raw = this.computeBandEnergy(20, 250);
    this.smoothedBass = this.lerp(this.smoothedBass, raw, this.smoothingFactor);
    return this.smoothedBass;
  }

  public getMidEnergy(): number {
    const raw = this.computeBandEnergy(250, 4000);
    this.smoothedMid = this.lerp(this.smoothedMid, raw, this.smoothingFactor);
    return this.smoothedMid;
  }

  public getHighEnergy(): number {
    const raw = this.computeBandEnergy(4000, 16000);
    this.smoothedHigh = this.lerp(this.smoothedHigh, raw, this.smoothingFactor);
    return this.smoothedHigh;
  }

  public getRMSLevel(): number {
    const analyser = this.ensureAttached();
    if (!analyser || this.timeDomainData.length === 0) {
      this.smoothedRMS = this.lerp(this.smoothedRMS, 0, this.smoothingFactor);
      return this.smoothedRMS;
    }

    analyser.getByteTimeDomainData(this.timeDomainData);
    let sumSquares = 0;
    const len = this.timeDomainData.length;
    for (let i = 0; i < len; i++) {
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.min(1, Math.sqrt(sumSquares / len) * 2.2);
    this.smoothedRMS = this.lerp(this.smoothedRMS, rms, this.smoothingFactor);
    return this.smoothedRMS;
  }

  public detectBeat(): boolean {
    const bass = this.computeBandEnergy(20, 200);
    const now = performance.now();

    if (this.energyHistory.length >= this.historySize) {
      this.energyHistory.shift();
    }
    this.energyHistory.push(bass);

    if (this.energyHistory.length < 10) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < this.energyHistory.length; i++) {
      sum += this.energyHistory[i];
    }
    const avg = sum / this.energyHistory.length;

    const threshold = Math.max(0.18, avg * 1.35);
    if (bass > threshold && now - this.lastBeatTimestamp > this.beatCooldownMs) {
      this.lastBeatTimestamp = now;
      return true;
    }

    return false;
  }

  public getData(): AudioAnalyzerData {
    return {
      frequencyData: this.getFrequencyData(),
      timeDomainData: this.getTimeDomainData(),
      bass: this.getBassEnergy(),
      mid: this.getMidEnergy(),
      treble: this.getHighEnergy(),
      volume: this.getRMSLevel(),
    };
  }

  private computeBandEnergy(minHz: number, maxHz: number): number {
    const analyser = this.ensureAttached();
    if (!analyser || this.frequencyData.length === 0) return 0;

    analyser.getByteFrequencyData(this.frequencyData);
    const sampleRate = analyser.context.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const binCount = this.frequencyData.length;

    const startBin = Math.max(0, Math.floor((minHz / nyquist) * binCount));
    const endBin = Math.min(
      binCount - 1,
      Math.ceil((maxHz / nyquist) * binCount)
    );

    if (endBin < startBin) return 0;

    let sum = 0;
    for (let i = startBin; i <= endBin; i++) {
      sum += this.frequencyData[i];
    }
    const count = endBin - startBin + 1;
    return Math.min(1, sum / (count * 255));
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

export const audioAnalyzer = new AudioAnalyzer();
