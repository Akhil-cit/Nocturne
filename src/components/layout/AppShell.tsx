import { useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ListMusic, Music, Trash2, X } from 'lucide-react';
import Titlebar from './Titlebar';
import Sidebar from './Sidebar';
import PlayerBar from '@/components/player/PlayerBar';
import ImmersiveView from '@/components/player/ImmersiveView';
import { useUIStore } from '@/stores/uiStore';
import { usePlayerStore } from '@/stores/playerStore';

export interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const immersiveMode = useUIStore((s) => s.immersiveMode);
  const setImmersiveMode = useUIStore((s) => s.setImmersiveMode);
  const overlayMode = useUIStore((s) => s.overlayMode);
  const setOverlayMode = useUIStore((s) => s.setOverlayMode);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const play = usePlayerStore((s) => s.play);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  useEffect(() => {
    if (!immersiveMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImmersiveMode(false);
        const api = window.electronAPI as
          | (typeof window.electronAPI & { setFullscreen?: (flag: boolean) => Promise<void> })
          | undefined;
        void api?.setFullscreen?.(false);
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [immersiveMode, setImmersiveMode]);

  if (immersiveMode) {
    return <ImmersiveView />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
      <Titlebar />

      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        {!immersiveMode && <Sidebar />}

        <main className="relative flex-1 min-w-0 h-full overflow-y-auto pb-20 z-10">
          {children ?? <Outlet />}
        </main>

        {/* Queue Slide-Over Drawer */}
        <AnimatePresence>
          {overlayMode === 'queue' && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed top-8 right-0 bottom-20 w-80 bg-[#0e0e0e]/90 backdrop-blur-2xl border-l border-white/10 z-30 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-white/70" />
                  <h2 className="text-sm font-medium">Up Next</h2>
                  <span className="text-xs text-white/40">({queue.length})</span>
                </div>
                <div className="flex items-center gap-1">
                  {queue.length > 0 && (
                    <button
                      type="button"
                      onClick={clearQueue}
                      title="Clear queue"
                      aria-label="Clear queue"
                      className="p-1.5 rounded-lg text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverlayMode('none')}
                    aria-label="Close queue"
                    className="p-1.5 rounded-lg text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {queue.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-6 text-white/40 text-xs">
                    <ListMusic className="w-8 h-8 mb-2 opacity-40" />
                    <p>Your queue is empty.</p>
                  </div>
                ) : (
                  queue.map((track, idx) => {
                    const isActive = idx === queueIndex;
                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => void play(track)}
                        className={`group flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-white/12 text-white'
                            : 'hover:bg-white/[0.06] text-white/80'
                        }`}
                      >
                        <div className="w-9 h-9 rounded bg-white/5 overflow-hidden shrink-0">
                          {track.cover ? (
                            <img
                              src={track.cover}
                              alt={track.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-3.5 h-3.5 text-white/30" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{track.title}</p>
                          <p className="text-[11px] text-white/45 truncate">{track.artist}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromQueue(idx);
                          }}
                          aria-label={`Remove ${track.title} from queue`}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom PlayerBar */}
      <PlayerBar />
    </div>
  );
}

export default AppShell;
