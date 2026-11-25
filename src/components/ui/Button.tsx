import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-white text-[#0a0a0a] hover:bg-white/90 active:scale-[0.98] font-medium shadow-sm shadow-white/10',
  secondary:
    'bg-white/10 text-white border border-white/10 hover:bg-white/15 active:scale-[0.98] backdrop-blur-md',
  ghost:
    'bg-transparent text-white/75 hover:text-white hover:bg-white/8 active:scale-[0.98]',
  icon:
    'bg-transparent text-white/70 hover:text-white hover:bg-white/10 active:scale-95 rounded-full',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-6 text-sm gap-2.5 rounded-xl',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 w-7 p-0 rounded-full',
  md: 'h-9 w-9 p-0 rounded-full',
  lg: 'h-11 w-11 p-0 rounded-full',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizing = variant === 'icon' ? iconSizeClasses[size] : sizeClasses[size];

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-45 disabled:pointer-events-none ${variantClasses[variant]} ${sizing} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
      {children}
    </button>
  );
}

export default Button;
