import { useState, useEffect, useRef } from 'react';
import { audioAnalyzer, type AudioAnalyzerData } from '@/services/audio/analyzer';

const EMPTY_DATA: AudioAnalyzerData = {
  frequencyData: new Uint8Array(0),
  timeDomainData: new Uint8Array(0),
  bass: 0,
  mid: 0,
  treble: 0,
  volume: 0,
};

export function useAudioAnalyzer(isActive: boolean): AudioAnalyzerData {
  const [data, setData] = useState<AudioAnalyzerData>(EMPTY_DATA);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      setData(EMPTY_DATA);
      return;
    }

    const tick = () => {
      setData(audioAnalyzer.getData());
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive]);

  return data;
}
