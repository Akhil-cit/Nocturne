import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Disc3, Heart, Play, Radio, Shuffle, User } from 'lucide-react';
import { musicProviderManager } from '@/services/music/provider';
import { getArtistRadio } from '@/services/music/recommendationService';
import type { ArtistDetail, Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useLibraryStore } from '@/stores/libraryStore';
import ArtworkImage from '@/components/ui/ArtworkImage';

export function ArtistPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fallbackName = searchParams.get('name') ?? undefined;

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  const toggleSaveArtist = useLibraryStore((s) => s.toggleSaveArtist);
  const savedArtists = useLibraryStore((s) => s.savedArtists);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    musicProviderManager
      .getArtistDetail(decodeURIComponent(id), fallbackName)
      .then((data) => {
        if (!cancelled) setArtist(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load artist');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fallbackName]);

  const isSaved = artist
    ? savedArtists.some(
        (a) => a.id === artist.id || a.name.toLowerCase() === artist.name.toLowerCase()
      )
    : false;

  const handlePlayAll = (shuffle = false) => {
    if (!artist || artist.topTracks.length === 0) return;
    const list = [...artist.topTracks];
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
        <div className="flex items-center gap-6">
          <div className="w-36 h-36 rounded-full bg-white/10" />
          <div className="space-y-3">
            <div className="h-8 w-64 bg-white/10 rounded" />
            <div className="h-4 w-40 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="p-8 space-y-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/12 text-xs text-white/80 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <p className="text-sm text-red-300">{error ?? 'Artist not found'}</p>
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

      {/* Artist Header */}
      <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden bg-white/[0.06] border border-white/10 shrink-0 flex items-center justify-center shadow-2xl">
          <ArtworkImage
            src={artist.picture}
            alt={artist.name}
            type="artist"
            title={artist.name}
            className="w-full h-full object-cover"
            iconClassName="w-16 h-16 text-white/25"
          />
        </div>
        <div className="space-y-3 text-center sm:text-left">
          <span className="text-[11px] uppercase tracking-widest text-white/45 font-medium">
            Artist
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight">
            {artist.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
            {artist.topTracks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handlePlayAll(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#0a0a0a] text-xs font-semibold hover:scale-105 transition-transform cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Play All
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayAll(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
                <button
                  type="button"
                  data-testid="artist-radio-btn"
                  onClick={() => {
                    void getArtistRadio(artist.name).then((radio) => {
                      const list = radio.length > 0 ? radio : artist.topTracks;
                      if (list.length > 0) {
                        setQueue(list, 0);
                        void play(list[0]);
                      }
                    });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.08] hover:bg-white/15 text-xs font-medium text-white cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" /> Artist Radio
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                toggleSaveArtist({
                  id: artist.id,
                  name: artist.name,
                  picture: artist.picture,
                  provider: artist.provider,
                })
              }
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-white/[0.04] border-white/15 text-white/80 hover:text-white'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>
      </div>

      {/* Biography (only if available) */}
      {artist.bio && (
        <section className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 leading-relaxed max-w-3xl">
          {artist.bio}
        </section>
      )}

      {/* Popular Tracks */}
      {artist.topTracks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Popular Tracks</h2>
          <div className="divide-y divide-white/[0.05] rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            {artist.topTracks.slice(0, 15).map((track: Track, idx: number) => (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => {
                  setQueue(artist.topTracks, idx);
                  void play(track);
                }}
                className="flex items-center gap-4 px-4 py-2.5 hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                <span className="w-5 text-xs text-white/40 tabular-nums text-right">
                  {idx + 1}
                </span>
                <img
                  src={track.cover}
                  alt={track.title}
                  className="w-10 h-10 rounded-lg object-cover bg-white/5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{track.title}</p>
                  <p className="text-xs text-white/50 truncate">{track.album?.title}</p>
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
        </section>
      )}

      {/* Albums */}
      {artist.albums.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Albums & Releases</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artist.albums.map((album) => (
              <div
                key={album.id}
                onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
                className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-colors cursor-pointer space-y-2.5"
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                  {album.cover ? (
                    <img
                      src={album.cover}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <Disc3 className="w-10 h-10 text-white/20" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white truncate">{album.title}</p>
                  <p className="text-xs text-white/45 truncate">
                    {album.releaseDate ? album.releaseDate.slice(0, 4) : 'Album'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Artists */}
      {artist.relatedArtists && artist.relatedArtists.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Related Artists</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {artist.relatedArtists.map((rel) => (
              <div
                key={rel.id}
                onClick={() =>
                  navigate(`/artist/${encodeURIComponent(rel.id)}?name=${encodeURIComponent(rel.name)}`)
                }
                className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-center cursor-pointer space-y-2"
              >
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-white/5 flex items-center justify-center">
                  {rel.picture ? (
                    <img src={rel.picture} alt={rel.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8 text-white/25" />
                  )}
                </div>
                <p className="text-xs font-medium text-white truncate">{rel.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ArtistPage;
