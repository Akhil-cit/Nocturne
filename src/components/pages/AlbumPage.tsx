import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Disc3, Heart, ListPlus, Play, Shuffle } from 'lucide-react';
import { musicProviderManager } from '@/services/music/provider';
import type { AlbumDetail, Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';

function formatTotalDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs} hr ${rem} min`;
}

export function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleSaveAlbum = useLibraryStore((s) => s.toggleSaveAlbum);
  const savedAlbums = useLibraryStore((s) => s.savedAlbums);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    musicProviderManager
      .getAlbumDetail(decodeURIComponent(id))
      .then((data) => {
        if (!cancelled) setAlbum(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load album');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isSaved = album ? savedAlbums.some((a) => a.id === album.id) : false;

  const handlePlayAll = (shuffle = false) => {
    if (!album || album.tracks.length === 0) return;
    const list = [...album.tracks];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    setQueue(list, 0);
    void play(list[0]);
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

  if (error || !album) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs text-white/80 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <p className="text-sm text-red-300">{error ?? 'Album not found'}</p>
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

      {/* Album Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
        <div className="w-44 h-44 rounded-2xl overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 flex items-center justify-center shadow-2xl">
          {album.cover ? (
            <img src={album.cover} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <Disc3 className="w-16 h-16 text-white/25" />
          )}
        </div>
        <div className="space-y-2.5 text-center sm:text-left">
          <span className="text-[11px] uppercase tracking-widest text-white/45 font-medium">
            {album.albumType ?? 'Album'}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {album.title}
          </h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-white/65">
            {album.artist && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/artist/${encodeURIComponent(album.artistId ?? `name:${album.artist}`)}?name=${encodeURIComponent(album.artist!)}`
                  )
                }
                className="font-semibold text-white hover:underline cursor-pointer"
              >
                {album.artist}
              </button>
            )}
            {album.releaseDate && <span>· {album.releaseDate.slice(0, 4)}</span>}
            <span>· {album.tracks.length} tracks</span>
            {album.totalDuration ? <span>· {formatTotalDuration(album.totalDuration)}</span> : null}
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => handlePlayAll(false)}
              disabled={album.tracks.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold hover:scale-105 transition-transform cursor-pointer disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Play All
            </button>
            <button
              type="button"
              onClick={() => handlePlayAll(true)}
              disabled={album.tracks.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer disabled:opacity-40"
            >
              <Shuffle className="w-3.5 h-3.5" /> Shuffle
            </button>
            <button
              type="button"
              onClick={() => album.tracks.forEach((t) => addToQueue(t))}
              disabled={album.tracks.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer disabled:opacity-40"
            >
              <ListPlus className="w-3.5 h-3.5" /> Add to Queue
            </button>
            <button
              type="button"
              onClick={() =>
                toggleSaveAlbum({
                  id: album.id,
                  title: album.title,
                  cover: album.cover,
                  artist: album.artist,
                  artistId: album.artistId,
                  releaseDate: album.releaseDate,
                  trackCount: album.tracks.length,
                  provider: album.provider,
                })
              }
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-white/[0.04] border-white/15 text-white/80 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Saved' : 'Save Album'}
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] border border-white/[0.06]">
        {album.tracks.map((track: Track, idx: number) => (
          <div
            key={`${track.id}-${idx}`}
            onClick={() => {
              setQueue(album.tracks, idx);
              void play(track);
            }}
            className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <span className="w-6 text-xs text-white/40 tabular-nums text-right">
              {track.trackNumber ?? idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{track.title}</p>
              <p className="text-xs text-white/50 truncate">{track.artist}</p>
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

export default AlbumPage;
