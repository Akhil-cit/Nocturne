import { useEffect, useState, type MouseEvent } from 'react';
import { Heart, ListPlus, MoreHorizontal, Music, Pause, Play } from 'lucide-react';
import PlaylistPickerModal from '@/components/ui/PlaylistPickerModal';
import TrackContextMenu from '@/components/ui/TrackContextMenu';
import type { Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';

export interface TrackListProps {
  tracks: Track[];
  onPlayTrack?: (track: Track, index: number) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (track: Track) => void;
  showAlbum?: boolean;
  emptyMessage?: string;
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

export function TrackList({
  tracks,
  onPlayTrack,
  favorites,
  onToggleFavorite,
  showAlbum = true,
  emptyMessage = 'No tracks to display.',
}: TrackListProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const toggle = usePlayerStore((s) => s.toggle);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const [externalError, setExternalError] = useState('');
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [pickerTrack, setPickerTrack] = useState<Track | null>(null);

  const handleRowPlay = (track: Track, index: number) => {
    if (currentTrack?.id === track.id) {
      void toggle();
      return;
    }
    if (onPlayTrack) {
      onPlayTrack(track, index);
    } else {
      setQueue(tracks, index);
      void play(track);
    }
  };

  const handleContextMenu = (
    e: MouseEvent<HTMLDivElement>,
    track: Track,
    index: number
  ) => {
    e.preventDefault();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 160);
    setMenu({ x, y, track, index });
  };

  if (tracks.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-white/40">{emptyMessage}</div>
    );
  }

  return (
    <div className="relative w-full">
      {externalError && <p role="alert" className="p-2 text-xs text-amber-200">{externalError}</p>}
      {/* Header */}
      <div
        className={`grid items-center gap-3 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-white/35 border-b border-white/6 ${
          showAlbum
            ? 'grid-cols-[32px_1fr_0.75fr_64px]'
            : 'grid-cols-[32px_1fr_64px]'
        }`}
      >
        <span className="text-center">#</span>
        <span>Title</span>
        {showAlbum && <span className="hidden md:block">Album</span>}
        <span className="text-right">Time</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/[0.03]">
        {tracks.map((track, index) => {
          const appleId = [track.id, ...(track.alternateSources ?? []).map((source) => source.trackId)]
            .find((id) => /^itunes:\d+$/.test(id))?.slice(7);
          const isCurrent = currentTrack?.id === track.id;
          const isCurrentPlaying = isCurrent && isPlaying;
          const isFav = favorites?.has(track.id) ?? false;

          return (
            <div
              key={`${track.id}-${index}`}
              onDoubleClick={() => handleRowPlay(track, index)}
              onContextMenu={(e) => handleContextMenu(e, track, index)}
              className={`group grid items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 cursor-pointer select-none ${
                showAlbum
                  ? 'grid-cols-[32px_1fr_0.75fr_64px]'
                  : 'grid-cols-[32px_1fr_64px]'
              } ${
                isCurrent
                  ? 'bg-white/10 text-white'
                  : 'even:bg-white/[0.015] hover:bg-white/[0.06]'
              }`}
            >
              {/* Index / Play button */}
              <div className="flex items-center justify-center w-8 h-8">
                <span
                  className={`text-xs tabular-nums group-hover:hidden ${
                    isCurrent ? 'text-white font-semibold' : 'text-white/40'
                  }`}
                >
                  {isCurrentPlaying ? (
                    <span className="inline-flex items-end gap-0.5 h-3">
                      <span className="w-0.5 h-3 bg-white rounded-full animate-pulse" />
                      <span className="w-0.5 h-2 bg-white rounded-full animate-pulse delay-75" />
                      <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse delay-150" />
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRowPlay(track, index);
                  }}
                  aria-label={isCurrentPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full text-white hover:bg-white/15 transition-colors cursor-pointer"
                >
                  {isCurrentPlaying ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  )}
                </button>
              </div>

              {/* Cover + Title + Artist */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-md bg-white/5 border border-white/8 overflow-hidden shrink-0 flex items-center justify-center">
                  {track.cover ? (
                    <img
                      src={track.cover}
                      alt={track.album?.title || track.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Music className="w-4 h-4 text-white/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-white' : 'text-white/90'
                      }`}
                    >
                      {track.title}
                    </p>
                    {(track.availability === 'metadata' || track.availability === 'preview') && (
                      <span className="shrink-0 text-[10px] text-white/45">Catalog</span>
                    )}
                    {appleId && window.electronAPI && (
                      <button
                        type="button"
                        aria-label={'Open ' + track.title + ' in Apple Music'}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onClick={async (event) => {
                          event.stopPropagation();
                          const opened = await window.electronAPI.openAppleSong(appleId, track.catalogUrl).catch(() => false);
                          setExternalError(opened ? '' : 'Apple Music could not be opened in your browser.');
                        }}
                        className="shrink-0 text-[11px] text-white/60 underline hover:text-white"
                      >Apple Music ?</button>
                    )}
                    {track.explicit && (
                      <span className="px-1 py-0.5 text-[9px] font-semibold uppercase rounded bg-white/10 text-white/60 shrink-0">
                        E
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 truncate">{track.artist}</p>
                </div>
              </div>

              {/* Album */}
              {showAlbum && (
                <p className="hidden md:block text-xs text-white/45 truncate">
                  {track.album?.title || '—'}
                </p>
              )}

              {/* Duration + Favorite */}
              <div className="flex items-center justify-end gap-2">
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(track);
                    }}
                    aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
                    className={`p-1 rounded-full transition-opacity cursor-pointer ${
                      isFav
                        ? 'opacity-100 text-white'
                        : 'opacity-0 group-hover:opacity-100 text-white/45 hover:text-white'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                )}
                <span className="text-xs text-white/45 tabular-nums">
                  {formatDuration(track.duration)}
                </span>
                <button
                  type="button"
                  data-testid="track-more-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e as unknown as React.MouseEvent<HTMLDivElement>, track, index);
                  }}
                  aria-label="More options"
                  title="More options"
                  className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 text-white/45 hover:text-white transition-opacity cursor-pointer"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Portal-based Context Menu & Playlist Picker */}
      <TrackContextMenu
        track={menu ? menu.track : null}
        position={menu ? { x: menu.x, y: menu.y } : null}
        onClose={() => setMenu(null)}
        onAddToPlaylist={(t) => setPickerTrack(t)}
      />
      <PlaylistPickerModal
        track={pickerTrack}
        onClose={() => setPickerTrack(null)}
      />
    </div>
  );
}

export default TrackList;
