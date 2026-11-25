import { useState, type ChangeEvent } from 'react';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeStart?: () => void;
  onChangeEnd?: () => void;
  className?: string;
  trackClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 0.1,
  onChange,
  onChangeStart,
  onChangeEnd,
  className = '',
  trackClassName = '',
  ariaLabel,
  disabled = false,
}: SliderProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const safeMax = max > min ? max : min + 1;
  const clamped = Math.min(safeMax, Math.max(min, Number.isFinite(value) ? value : min));
  const percent = ((clamped - min) / (safeMax - min)) * 100;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <div
      className={`relative flex items-center h-4 select-none group ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Track background */}
      <div
        className={`relative w-full h-1 rounded-full bg-white/15 overflow-hidden transition-all duration-150 ${
          isHovered || isDragging ? 'h-1.5 bg-white/20' : ''
        } ${trackClassName}`}
      >
        {/* Progress fill */}
        <div
          className="h-full bg-white rounded-full transition-[background-color] duration-150 group-hover:bg-white"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Custom thumb */}
      <div
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-md shadow-black/50 transition-all duration-150 ${
          isHovered || isDragging ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        style={{ left: `${percent}%` }}
      />

      {/* Native accessible range input */}
      <input
        type="range"
        min={min}
        max={safeMax}
        step={step}
        value={clamped}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={handleChange}
        onPointerDown={() => {
          setIsDragging(true);
          onChangeStart?.();
        }}
        onPointerUp={() => {
          setIsDragging(false);
          onChangeEnd?.();
        }}
        onBlur={() => setIsDragging(false)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
      />
    </div>
  );
}

export default Slider;
