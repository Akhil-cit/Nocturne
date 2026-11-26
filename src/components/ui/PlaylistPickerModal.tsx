import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Heart, ListMusic, Plus, Search, X } from 'lucide-react';
import type { Track } from '@/services/music/types';
import { useLibraryStore } from '@/stores/libraryStore';

interface PlaylistPickerModalProps {
  track: Track | null;
  onClose: () => void;
}

export function PlaylistPickerModal({ track, onClose }: PlaylistPickerModalProps) {
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const playlists = useLibraryStore((s) => s.playlists);
  const favorites = useLibraryStore((s) => s.favorites);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const addTracksToPlaylist = useLibraryStore((s) => s.addTracksToPlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);

  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [track, onClose]);

  if (!track) return null;

  const isLiked = favorites.some((f) => f.id === track.id);
  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    createPlaylist(trimmed, [track]);
    setNewName('');
    setCreating(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="playlist-picker-modal"
        className="w-full max-w-sm rounded-2xl bg-[#141419] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white">Add to playlist</h3>
            <p className="text-[11px] text-white/50 truncate">{track.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a playlist..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
            />
          </div>

          {creating ? (
            <form onSubmit={handleCreate} className="flex items-center gap-1.5">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Playlist name..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-xs text-white placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-white text-[#0a0a0a] text-xs font-medium cursor-pointer"
              >
                Create
              </button>
            </form>
          ) : (
            <button
              type="button"
              data-testid="picker-new-playlist-btn"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/12 text-xs text-white/85 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New playlist
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Liked Songs */}
          <button
            type="button"
            onClick={() => toggleFavorite(track)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Heart className={`w-4 h-4 ${isLiked ? 'fill-emerald-400 text-emerald-400' : 'text-white/70'}`} />
              </div>
              <span className="text-xs font-medium text-white truncate">Liked Songs</span>
            </div>
            {isLiked && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
          </button>

          {/* User Playlists */}
          {filtered.map((pl) => {
            const hasTrack = pl.tracks.some((t) => t.id === track.id);
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => {
                  if (hasTrack) removeFromPlaylist(pl.id, track.id);
                  else addTracksToPlaylist(pl.id, [track]);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                    <ListMusic className="w-4 h-4 text-white/60" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{pl.name}</p>
                    <p className="text-[10px] text-white/45">{pl.tracks.length} tracks</p>
                  </div>
                </div>
                {hasTrack && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            data-testid="picker-done-btn"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold hover:scale-105 transition-transform cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PlaylistPickerModal;
