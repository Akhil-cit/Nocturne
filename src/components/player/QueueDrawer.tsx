import { useState } from 'react';
import { GripVertical, ListMusic, Music, Play, Trash2, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

export function QueueDrawer() {
  const overlayMode = useUIStore((s) => s.overlayMode);
  const setOverlayMode = useUIStore((s) => s.setOverlayMode);

  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const shuffleActive = usePlayerStore((s) => s.shuffleActive);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

  const playQueueIndex = usePlayerStore((s) => s.playQueueIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  if (overlayMode !== 'queue') return null;

  const upNextItems = queue
    .map((track, idx) => ({ track, idx }))
    .filter(({ idx }) => idx > queueIndex);

  return (
    <aside
      aria-label="Playback Queue"
      className="fixed top-9 right-0 bottom-20 w-80 sm:w-96 z-40 bg-[#0d0d11]/95 backdrop-blur-2xl border-l border-white/[0.08] flex flex-col shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-white/75" />
          <h2 className="text-sm font-semibold text-white">Queue</h2>
          {shuffleActive && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/70">
              Shuffle
            </span>
          )}
          {repeatMode !== 'off' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-white/70">
              Repeat {repeatMode === 'one' ? '1' : 'All'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearQueue}>
              Clear
            </Button>
          )}
          <button
            type="button"
            onClick={() => setOverlayMode('none')}
            aria-label="Close Queue"
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Now Playing */}
        <section className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">
            Now Playing
          </p>
          {currentTrack ? (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.07] border border-white/12">
              <div className="w-10 h-10 rounded-lg bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                {currentTrack.cover ? (
                  <img
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Music className="w-4 h-4 text-white/40" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-white/50 truncate">{currentTrack.artist}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/40 py-2">Nothing is currently playing.</p>
          )}
        </section>

        {/* Up Next */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/45">
              Up Next ({upNextItems.length})
            </p>
          </div>

          {upNextItems.length === 0 ? (
            <p className="text-xs text-white/40 py-6 text-center">
              No upcoming tracks in queue.
            </p>
          ) : (
            <div className="space-y-1">
              {upNextItems.map(({ track, idx }) => (
                <div
                  key={`${track.id}-${idx}`}
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIdx !== null && draggedIdx !== idx) {
                      reorderQueue(draggedIdx, idx);
                    }
                    setDraggedIdx(null);
                  }}
                  onDragEnd={() => setDraggedIdx(null)}
                  className={`group flex items-center gap-2 p-2 rounded-xl transition-colors ${
                    draggedIdx === idx
                      ? 'bg-white/15 opacity-60'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <GripVertical className="w-3.5 h-3.5 text-white/25 group-hover:text-white/55 shrink-0 cursor-grab" />
                  <button
                    type="button"
                    onClick={() => void playQueueIndex(idx)}
                    className="w-8 h-8 rounded-md bg-white/5 overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer"
                    aria-label={`Play ${track.title}`}
                  >
                    {track.cover ? (
                      <img
                        src={track.cover}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Music className="w-3.5 h-3.5 text-white/30" />
                    )}
                    <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-3 h-3 text-white fill-current" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">
                      {track.title}
                    </p>
                    <p className="text-[11px] text-white/45 truncate">
                      {track.artist}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(idx)}
                    aria-label={`Remove ${track.title} from queue`}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

export default QueueDrawer;
