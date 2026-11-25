import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Disc,
  Download,
  GripVertical,
  Heart,
  ListPlus,
  MoreHorizontal,
  Music,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import type { Track } from '@/services/music/types';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

const ROW_HEIGHT = 56;
const OVERSCAN = 8;

export interface VirtualizedTrackTableProps {
  tracks: Track[];
  onPlayTrack: (track: Track, index: number) => void;
  onRemoveTrack?: (track: Track, index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRetryUnavailable?: (track: Track, index: number) => void;
  allowReorder?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (trackId: string, shiftKey?: boolean) => void;
  emptyMessage?: string;
  stickyHeaderTop?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  track: Track;
  index: number;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getSourceBadge(track: Track): { label: string; title: string; unavailable: boolean } | null {
  if (track.availability === 'metadata') {
    return {
      label: 'Unavailable',
      title: 'Metadata preserved from import; no playable stream matched yet',
      unavailable: true,
    };
  }
  if (track.isLocal) {
    return { label: 'Local', title: 'Local audio file (available offline)', unavailable: false };
  }
  if (track.provider === 'jiosaavn') {
    return { label: 'JioSaavn', title: 'Playback via JioSaavn', unavailable: false };
  }
  if (track.provider === 'tracks') {
    return { label: 'Tracks', title: 'Playback via Tracks', unavailable: false };
  }
  if (track.provider === 'commons') {
    return { label: 'Commons', title: 'Wikimedia Commons (offline download allowed)', unavailable: false };
  }
  return null;
}

interface TrackRowProps {
  track: Track;
  index: number;
  top: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isSelected: boolean;
  allowReorder: boolean;
  onRowPlay: (track: Track, index: number) => void;
  onToggleFavorite: (track: Track) => void;
  onToggleSelect?: (trackId: string, shiftKey?: boolean) => void;
  onOpenMenu: (e: MouseEvent<HTMLElement>, track: Track, index: number) => void;
  onDragStart: (index: number) => void;
  onDropRow: (index: number) => void;
}

const VirtualTrackRow = memo(function VirtualTrackRow({
  track,
  index,
  top,
  isCurrent,
  isPlaying,
  isFavorite,
  isSelected,
  allowReorder,
  onRowPlay,
  onToggleFavorite,
  onToggleSelect,
  onOpenMenu,
  onDragStart,
  onDropRow,
}: TrackRowProps) {
  const badge = getSourceBadge(track);
  const unavailable = track.availability === 'metadata';

  return (
    <div
      style={{ position: 'absolute', top, left: 0, right: 0, height: ROW_HEIGHT }}
      draggable={allowReorder}
      onDragStart={() => allowReorder && onDragStart(index)}
      onDragOver={(e) => {
        if (allowReorder) e.preventDefault();
      }}
      onDrop={() => allowReorder && onDropRow(index)}
      onDoubleClick={() => !unavailable && onRowPlay(track, index)}
      onContextMenu={(e) => onOpenMenu(e, track, index)}
      className={`group grid grid-cols-[36px_1fr_0.7fr_90px_76px] items-center gap-3 px-3 rounded-xl transition-colors select-none ${
        isSelected
          ? 'bg-white/12'
          : isCurrent
            ? 'bg-white/[0.08]'
            : 'hover:bg-white/[0.05]'
      } ${unavailable ? 'opacity-55' : ''}`}
    >
      {/* Index / Select / Play */}
      <div className="flex items-center justify-center gap-1">
        {allowReorder && (
          <GripVertical className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
        )}
        {onToggleSelect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(track.id, e.shiftKey);
            }}
            aria-label={`Select ${track.title}`}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-opacity cursor-pointer ${
              isSelected
                ? 'bg-white border-white text-black opacity-100'
                : 'border-white/25 opacity-0 group-hover:opacity-100'
            }`}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
        )}
        {!isSelected && (
          <button
            type="button"
            disabled={unavailable}
            onClick={() => onRowPlay(track, index)}
            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            className="w-6 h-6 flex items-center justify-center text-xs text-white/45 group-hover:text-white cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="group-hover:hidden tabular-nums">{index + 1}</span>
            <span className="hidden group-hover:flex items-center justify-center">
              {isCurrent && isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </span>
          </button>
        )}
      </div>

      {/* Artwork + Title + Artist */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-md bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
          {track.cover ? (
            <img
              src={track.cover}
              alt={track.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Music className="w-4 h-4 text-white/25" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p
              className={`text-sm font-medium truncate ${
                isCurrent ? 'text-white' : 'text-white/90'
              }`}
            >
              {track.title}
            </p>
            {badge && (
              <span
                title={badge.title}
                className={`px-1.5 py-0.5 rounded text-[10px] shrink-0 ${
                  badge.unavailable
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                    : 'bg-white/[0.06] text-white/55'
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-white/45 truncate">{track.artist}</p>
        </div>
      </div>

      {/* Album */}
      <p className="hidden md:block text-xs text-white/45 truncate">
        {track.album?.title || '—'}
      </p>

      {/* Duration + Offline */}
      <div className="flex items-center justify-end gap-2 text-xs text-white/45 tabular-nums">
        {(track.isLocal || track.provider === 'commons') && (
          <span title="Available offline">
            <Download className="w-3 h-3 text-emerald-300/70" />
          </span>
        )}
        <span>{formatDuration(track.duration)}</span>
      </div>

      {/* Actions: Like + More */}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(track);
          }}
          aria-label={isFavorite ? `Unlike ${track.title}` : `Like ${track.title}`}
          className={`p-1.5 rounded-lg transition-opacity cursor-pointer ${
            isFavorite
              ? 'text-white opacity-100'
              : 'text-white/40 opacity-0 group-hover:opacity-100 hover:text-white'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu(e, track, index);
          }}
          aria-label={`More options for ${track.title}`}
          className="p-1.5 rounded-lg text-white/40 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

export function VirtualizedTrackTable({
  tracks,
  onPlayTrack,
  onRemoveTrack,
  onReorder,
  onRetryUnavailable,
  allowReorder = false,
  selectedIds,
  onToggleSelect,
  emptyMessage = 'No tracks in this playlist.',
  stickyHeaderTop = 56,
}: VirtualizedTrackTableProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const toggle = usePlayerStore((s) => s.toggle);
  const playNext = usePlayerStore((s) => s.playNext);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const playlists = useLibraryStore((s) => s.playlists);
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((t) => t.id)),
    [favorites]
  );

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroller) return;

    const update = () => {
      const scrollerRect = scroller.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const relativeTop = Math.max(0, scrollerRect.top - elRect.top);
      setScrollTop(relativeTop);
      setViewportHeight(scroller.clientHeight || 720);
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [tracks.length]);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => setViewportHeight(el.clientHeight || 520);
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = () => {
      setMenu(null);
      setShowPlaylistPicker(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const handleRowPlay = (track: Track, index: number) => {
    if (track.availability === 'metadata') return;
    if (currentTrack?.id === track.id) {
      void toggle();
      return;
    }
    onPlayTrack(track, index);
  };

  const handleOpenMenu = (
    e: MouseEvent<HTMLElement>,
    track: Track,
    index: number
  ) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 230);
    const y = Math.min(e.clientY, window.innerHeight - 320);
    setShowPlaylistPicker(false);
    setMenu({ x, y, track, index });
  };

  if (tracks.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-white/45">{emptyMessage}</div>
    );
  }

  const totalHeight = tracks.length * ROW_HEIGHT;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endIdx = Math.min(tracks.length, startIdx + visibleCount);
  const visibleSlice = tracks.slice(startIdx, endIdx);

  return (
    <div className="relative w-full">
      {/* Sticky Table Header */}
      <div
        data-testid="playlist-table-header"
        style={{ top: stickyHeaderTop }}
        className="sticky z-20 grid grid-cols-[36px_1fr_0.7fr_90px_76px] items-center gap-3 px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-white/45 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/[0.08]"
      >
        <span className="text-center">#</span>
        <span>Title</span>
        <span className="hidden md:block">Album</span>
        <span className="text-right">Time</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Unified Page-Scrolled Virtualized List */}
      <div ref={containerRef} className="relative w-full">
        <div style={{ position: 'relative', height: totalHeight }}>
          {visibleSlice.map((track, offset) => {
            const index = startIdx + offset;
            return (
              <VirtualTrackRow
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                top={index * ROW_HEIGHT}
                isCurrent={currentTrack?.id === track.id}
                isPlaying={isPlaying}
                isFavorite={favoriteIds.has(track.id)}
                isSelected={selectedIds?.has(track.id) ?? false}
                allowReorder={allowReorder && Boolean(onReorder)}
                onRowPlay={handleRowPlay}
                onToggleFavorite={toggleFavorite}
                onToggleSelect={onToggleSelect}
                onOpenMenu={handleOpenMenu}
                onDragStart={setDraggedIdx}
                onDropRow={(targetIdx) => {
                  if (draggedIdx !== null && draggedIdx !== targetIdx) {
                    onReorder?.(draggedIdx, targetIdx);
                  }
                  setDraggedIdx(null);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Context Menu */}
      {menu && (
        <div
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 w-52 rounded-xl bg-[#18181f]/95 backdrop-blur-2xl border border-white/15 shadow-2xl py-1.5 text-xs text-white"
        >
          {menu.track.availability !== 'metadata' && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleRowPlay(menu.track, menu.index);
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Play now
              </button>
              <button
                type="button"
                onClick={() => {
                  playNext(menu.track);
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
              >
                <ListPlus className="w-3.5 h-3.5" />
                Play next
              </button>
              <button
                type="button"
                onClick={() => {
                  addToQueue(menu.track);
                  setMenu(null);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
              >
                <ListPlus className="w-3.5 h-3.5" />
                Add to queue
              </button>
            </>
          )}

          {menu.track.availability === 'metadata' && onRetryUnavailable && (
            <button
              type="button"
              onClick={() => {
                onRetryUnavailable(menu.track, menu.index);
                setMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-amber-300 text-left cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry matching
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              toggleFavorite(menu.track);
              setMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
          >
            <Heart className="w-3.5 h-3.5" />
            {favoriteIds.has(menu.track.id) ? 'Remove from Liked' : 'Like track'}
          </button>

          {playlists.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPlaylistPicker((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <ListPlus className="w-3.5 h-3.5" />
                  Add to playlist
                </span>
                <span>›</span>
              </button>
              {showPlaylistPicker && (
                <div className="mx-1.5 my-1 max-h-36 overflow-y-auto rounded-lg bg-black/40 border border-white/10">
                  {playlists.map((pl) => (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => {
                        addToPlaylist(pl.id, menu.track);
                        setMenu(null);
                      }}
                      className="w-full px-3 py-1.5 text-left truncate hover:bg-white/10 cursor-pointer"
                    >
                      {pl.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              navigate(`/search?q=${encodeURIComponent(menu.track.artist)}`);
              setMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            View artist
          </button>

          {menu.track.album?.title && (
            <button
              type="button"
              onClick={() => {
                navigate(`/search?q=${encodeURIComponent(menu.track.album.title)}`);
                setMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5" />
              View album
            </button>
          )}

          {onRemoveTrack && (
            <button
              type="button"
              onClick={() => {
                onRemoveTrack(menu.track, menu.index);
                setMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-500/15 text-red-300 text-left border-t border-white/10 mt-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove from playlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default VirtualizedTrackTable;
