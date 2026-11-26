import { useState, useRef, useEffect } from 'react';
import { Moon, X } from 'lucide-react';
import { formatRemaining, useSleepTimerStore } from '@/stores/sleepTimerStore';

const PRESETS: { label: string; minutes: number }[] = [
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
];

export function SleepTimerButton({ align = 'up' }: { align?: 'up' | 'down' }) {
  const [open, setOpen] = useState(false);
  const [customMins, setCustomMins] = useState('');
  const popRef = useRef<HTMLDivElement>(null);

  const mode = useSleepTimerStore((s) => s.mode);
  const remainingMs = useSleepTimerStore((s) => s.remainingMs);
  const fadeOutEnabled = useSleepTimerStore((s) => s.fadeOutEnabled);
  const startDuration = useSleepTimerStore((s) => s.startDuration);
  const startEndOfTrack = useSleepTimerStore((s) => s.startEndOfTrack);
  const startEndOfQueue = useSleepTimerStore((s) => s.startEndOfQueue);
  const cancel = useSleepTimerStore((s) => s.cancel);
  const extend = useSleepTimerStore((s) => s.extend);
  const setFadeOutEnabled = useSleepTimerStore((s) => s.setFadeOutEnabled);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const isActive = mode !== 'off';
  const badgeText =
    mode === 'duration'
      ? formatRemaining(remainingMs)
      : mode === 'end-of-track'
        ? 'Song'
        : mode === 'end-of-queue'
          ? 'Queue'
          : '';

  return (
    <div ref={popRef} className="relative">
      <button
        type="button"
        data-testid="sleep-timer-btn"
        onClick={() => setOpen((v) => !v)}
        title={isActive ? `Sleep timer: ${badgeText}` : 'Sleep Timer'}
        aria-label="Sleep Timer"
        className={`inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
          isActive
            ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-400/30'
            : 'text-white/55 hover:text-white hover:bg-white/[0.08]'
        }`}
      >
        <Moon className="w-4 h-4" />
        {isActive && <span className="text-[11px] font-medium tabular-nums">{badgeText}</span>}
      </button>

      {open && (
        <div
          data-testid="sleep-timer-popover"
          className={`absolute right-0 ${
            align === 'up' ? 'bottom-11' : 'top-10'
          } z-50 w-64 rounded-2xl bg-[#121218]/95 backdrop-blur-2xl border border-white/15 p-3.5 shadow-2xl space-y-3 text-xs`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">Sleep Timer</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-white/50 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {isActive && (
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-indigo-500/15 border border-indigo-400/25">
              <span className="text-indigo-200 font-medium tabular-nums">
                {mode === 'duration'
                  ? `${formatRemaining(remainingMs)} left`
                  : mode === 'end-of-track'
                    ? 'Stops after song'
                    : 'Stops after queue'}
              </span>
              <div className="flex items-center gap-1.5">
                {mode === 'duration' && (
                  <button
                    type="button"
                    onClick={() => extend(5)}
                    className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  >
                    +5m
                  </button>
                )}
                <button
                  type="button"
                  data-testid="sleep-timer-cancel"
                  onClick={() => {
                    cancel();
                    setOpen(false);
                  }}
                  className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/35 text-red-200 cursor-pointer"
                >
                  Off
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                onClick={() => {
                  startDuration(p.minutes);
                  setOpen(false);
                }}
                className="py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/15 text-white/85 hover:text-white transition-colors cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                startEndOfTrack();
                setOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/12 text-white/85 cursor-pointer"
            >
              End of current song
            </button>
            <button
              type="button"
              onClick={() => {
                startEndOfQueue();
                setOpen(false);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/12 text-white/85 cursor-pointer"
            >
              End of queue
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const mins = Number(customMins);
              if (Number.isFinite(mins) && mins > 0) {
                startDuration(mins);
                setCustomMins('');
                setOpen(false);
              }
            }}
            className="flex items-center gap-1.5"
          >
            <input
              type="number"
              min={1}
              max={600}
              value={customMins}
              onChange={(e) => setCustomMins(e.target.value)}
              placeholder="Custom min"
              className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1 text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-white text-[#0a0a0a] font-medium cursor-pointer"
            >
              Set
            </button>
          </form>

          <label className="flex items-center justify-between pt-1 border-t border-white/10 text-white/65 cursor-pointer">
            <span>Fade out audio (20s)</span>
            <input
              type="checkbox"
              checked={fadeOutEnabled}
              onChange={(e) => setFadeOutEnabled(e.target.checked)}
              className="accent-indigo-400 cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export default SleepTimerButton;
