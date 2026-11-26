import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Copy, Disc, Heart, ListPlus, Play, Plus, Radio, User } from 'lucide-react';
import { getSongRadio } from '@/services/music/recommendationService';
import type { Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';

interface TrackContextMenuProps {
  track: Track | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onAddToPlaylist: (track: Track) => void;
}

export function TrackContextMenu({
  track,
  position,
  onClose,
  onAddToPlaylist,
}: TrackContextMenuProps) {
  const navigate = useNavigate();
  const play = usePlayerStore((s) => s.play);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  useEffect(() => {
    if (!track || !position) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onClick = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [track, position, onClose]);

  if (!track || !position) return null;

  const isLiked = favorites.some((f) => f.id === track.id);
  const left = Math.min(position.x, window.innerWidth - 224);
  const top = Math.min(position.y, window.innerHeight - 300);

  return createPortal(
    <div
      data-testid="track-context-menu"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      className="fixed z-[9998] w-52 rounded-xl bg-[#16161c]/95 backdrop-blur-2xl border border-white/15 py-1.5 shadow-2xl text-xs text-white/85"
    >
      <button
        type="button"
        onClick={() => {
          setQueue([track], 0);
          void play(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
      >
        <Play className="w-3.5 h-3.5" /> Play now
      </button>

      <button
        type="button"
        onClick={() => {
          addToQueue(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
      >
        <ListPlus className="w-3.5 h-3.5" /> Add to queue
      </button>

      <button
        type="button"
        data-testid="ctx-add-to-playlist"
        onClick={() => {
          onAddToPlaylist(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> Add to playlist
      </button>

      <button
        type="button"
        onClick={() => {
          toggleFavorite(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
      >
        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-emerald-400 text-emerald-400' : ''}`} />
        {isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      </button>

      <button
        type="button"
        data-testid="ctx-song-radio"
        onClick={() => {
          onClose();
          void getSongRadio(track).then((radio) => {
            if (radio.length > 0) {
              setQueue(radio, 0);
              void play(radio[0]);
            }
          });
        }}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
      >
        <Radio className="w-3.5 h-3.5" /> Start song radio
      </button>

      <div className="my-1 border-t border-white/10" />

      {track.artist && (
        <button
          type="button"
          onClick={() => {
            navigate(
              `/artist/${encodeURIComponent(track.artists?.[0]?.id ?? `name:${track.artist}`)}?name=${encodeURIComponent(track.artist)}`
            );
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
        >
          <User className="w-3.5 h-3.5" /> Go to artist
        </button>
      )}

      {track.album?.id && (
        <button
          type="button"
          onClick={() => {
            navigate(`/album/${encodeURIComponent(track.album.id)}`);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
        >
          <Disc className="w-3.5 h-3.5" /> Go to album
        </button>
      )}

      {track.catalogUrl && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(track.catalogUrl!);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" /> Copy song link
        </button>
      )}
    </div>,
    document.body
  );
}

export default TrackContextMenu;
