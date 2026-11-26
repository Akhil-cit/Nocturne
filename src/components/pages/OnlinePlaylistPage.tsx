import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Heart, ListMusic, ListPlus, Play, Shuffle } from 'lucide-react';
import { musicProviderManager } from '@/services/music/provider';
import type { OnlinePlaylist, Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';

export function OnlinePlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<(OnlinePlaylist & { tracks: Track[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleSaveOnlinePlaylist = useLibraryStore((s) => s.toggleSaveOnlinePlaylist);
  const savedOnlinePlaylists = useLibraryStore((s) => s.savedOnlinePlaylists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    musicProviderManager
      .getPlaylistDetail(decodeURIComponent(id))
      .then((data) => {
        if (!cancelled) setPlaylist(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load playlist');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isSaved = playlist ? savedOnlinePlaylists.some((p) => p.id === playlist.id) : false;

  const handlePlayAll = (shuffle = false) => {
    if (!playlist || playlist.tracks.length === 0) return;
    const list = [...playlist.tracks];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    setQueue(list, 0);
    void play(list[0]);
  };

  const handleImportLocal = () => {
    if (!playlist) return;
    createPlaylist(playlist.title, playlist.tracks);
    setImported(true);
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 w-24 bg-white/10 rounded-lg" />
        <div className="flex items-end gap-6">
          <div className="w-44 h-44 rounded-2xl bg-white/10" />
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white/10 rounded" />
            <div className="h-4 w-40 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs text-white/80 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <p className="text-sm text-red-300">{error ?? 'Playlist not found'}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs text-white/80 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
        <div className="w-44 h-44 rounded-2xl overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 flex items-center justify-center shadow-2xl">
          {playlist.cover ? (
            <img src={playlist.cover} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <ListMusic className="w-16 h-16 text-white/25" />
          )}
        </div>
        <div className="space-y-2.5 text-center sm:text-left">
          <span className="text-[11px] uppercase tracking-widest text-white/45 font-medium">
            Online Playlist · {playlist.provider}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {playlist.title}
          </h1>
          {playlist.description && (
            <p className="text-xs text-white/60 max-w-xl">{playlist.description}</p>
          )}
          <p className="text-xs text-white/50">
            {playlist.creator ? `By ${playlist.creator} · ` : ''}
            {playlist.tracks.length} tracks
          </p>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handlePlayAll(false)}
              disabled={playlist.tracks.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold hover:scale-105 transition-transform cursor-pointer disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Play
            </button>
            <button
              type="button"
              onClick={() => handlePlayAll(true)}
              disabled={playlist.tracks.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer disabled:opacity-40"
            >
              <Shuffle className="w-3.5 h-3.5" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => playlist.tracks.forEach((t) => addToQueue(t))}
              disabled={playlist.tracks.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer disabled:opacity-40"
            >
              <ListPlus className="w-3.5 h-3.5" /> Add to Queue
            </button>
            <button
              type="button"
              onClick={() => toggleSaveOnlinePlaylist(playlist)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-white/[0.04] border-white/15 text-white/80 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleImportLocal}
              disabled={imported || playlist.tracks.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.06] hover:bg-white/12 text-xs font-medium text-white/85 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {imported ? 'Imported to Library' : 'Import Local Copy'}
            </button>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        {playlist.tracks.map((track: Track, idx: number) => (
          <div
            key={`${track.id}-${idx}`}
            onClick={() => {
              setQueue(playlist.tracks, idx);
              void play(track);
            }}
            className="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <span className="w-6 text-xs text-white/40 tabular-nums text-right">{idx + 1}</span>
            <img
              src={track.cover}
              alt={track.title}
              className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(
                    `/artist/${encodeURIComponent(track.artists?.[0]?.id ?? `name:${track.artist}`)}?name=${encodeURIComponent(track.artist)}`
                  );
                }}
                className="text-xs text-white/50 hover:text-white hover:underline truncate block text-left cursor-pointer"
              >
                {track.artist}
              </button>
            </div>
            <span className="text-xs text-white/40 tabular-nums">
              {track.duration
                ? `${Math.floor(track.duration / 60)}:${Math.floor(track.duration % 60)
                    .toString()
                    .padStart(2, '0')}`
                : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OnlinePlaylistPage;
