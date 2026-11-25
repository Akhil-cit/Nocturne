import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

export function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    let mounted = true;
    api.isMaximized?.().then((val) => {
      if (mounted) setIsMaximized(val);
    }).catch(() => {});

    const unsubscribe = api.onMaximizeChange?.((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  const handleMinimize = () => {
    window.electronAPI?.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximize();
  };

  const handleClose = () => {
    window.electronAPI?.close();
  };

  return (
    <header className="h-8 w-full shrink-0 flex items-center justify-between px-3 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.06] select-none z-40 [-webkit-app-region:drag]">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-white/70 shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        <span className="text-[11px] font-medium tracking-widest uppercase text-white/55">
          Nocturne
        </span>
      </div>

      <div className="flex items-center h-full [-webkit-app-region:no-drag]">
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimize window"
          className="h-8 w-10 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          className="h-8 w-10 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isMaximized ? (
            <Copy className="w-3 h-3" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close window"
          className="h-8 w-10 flex items-center justify-center text-white/55 hover:text-white hover:bg-red-500/80 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}

export default Titlebar;
