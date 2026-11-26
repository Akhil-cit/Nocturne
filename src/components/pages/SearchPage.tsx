import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Disc, ListMusic, Music, Search, User, X } from 'lucide-react';
import { librarySuggestions } from '@/services/music/libraryDiscovery';
import { useLibraryStore } from '@/stores/libraryStore';
import TrackList from '@/components/ui/TrackList';
import ArtworkImage from '@/components/ui/ArtworkImage';
import { musicProviderManager } from '@/services/music/provider';
import type { Album, Artist, OnlinePlaylist, SearchCategory, Track } from '@/services/music/types';
import { usePlayerStore } from '@/stores/playerStore';
import { useProviderStore } from '@/stores/providerStore';
import { useUIStore } from '@/stores/uiStore';

type ProviderFilter = 'all' | 'tracks' | 'jiosaavn' | 'itunes' | 'local' | 'commons';

const PROVIDER_FILTERS: { id: ProviderFilter; label: string }[] = [
  { id: 'all', label: 'All Sources' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'jiosaavn', label: 'JioSaavn' },
  { id: 'itunes', label: 'iTunes' },
  { id: 'local', label: 'Local' },
  { id: 'commons', label: 'Commons' },
];

export function SearchPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const searchQuery = useUIStore((s) => s.searchQuery);
  const searchCategory = useUIStore((s) => s.searchCategory);
  const searchResults = useUIStore((s) => s.searchResults);
  const isSearching = useUIStore((s) => s.isSearching);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const setSearchCategory = useUIStore((s) => s.setSearchCategory);
  const setSearchResults = useUIStore((s) => s.setSearchResults);
  const setIsSearching = useUIStore((s) => s.setIsSearching);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  const refreshHealth = useProviderStore((s) => s.refreshHealth);
  const fullTracksOnly = useProviderStore((s) => s.fullTracksOnly);
  const setFullTracksOnly = useProviderStore((s) => s.setFullTracksOnly);

  const enabled = useProviderStore((s) => s.enabledProviders);
  const priority = useProviderStore((s) => s.providerPriority);
  const preferred = useProviderStore((s) => s.preferredDiscovery);
  const searchAll = useProviderStore((s) => s.searchAllProviders);
  const recent = useLibraryStore((s) => s.recentlyPlayed);
  const localTracks = useLibraryStore((s) => s.localTracks);
  const favorites = useLibraryStore((s) => s.favorites);
  const playbackError = usePlayerStore((s) => s.error);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [error, setError] = useState<string | null>(null);

  const targets = useMemo(() => {
    const ids = Object.keys(enabled).filter((id) => enabled[id]).sort((a, b) => priority[a] - priority[b]);
    if (providerFilter !== 'all' && ids.includes(providerFilter)) return [providerFilter];
    if (searchAll || ids.length === 0) return ids;
    return [ids.includes(preferred) ? preferred : ids[0]];
  }, [enabled, priority, preferred, providerFilter, searchAll]);
  const suggestions = useMemo(() => librarySuggestions.suggest(searchQuery, [
    ...recent, ...favorites, ...localTracks,
  ]), [searchQuery, recent, favorites, localTracks]);

  async function searchOfficial(service: 'jiosaavn' | 'youtube') {
    const opened = await window.electronAPI.searchOfficialPlayer(service, searchQuery.trim()).catch(() => false);
    if (!opened) setError('The official player could not be opened in your browser.');
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setIsSearching(false);
      setError(null);
      return;
    }

    if (!targets.length) {
      setSearchResults(null);
      setError('Enable a discovery source in Settings to search in Nocturne.');
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setIsSearching(true);
    setError(null);

    const timer = setTimeout(() => {
      musicProviderManager
        .searchByCategory(trimmed, searchCategory, {
          providerIds: targets,
          signal: controller.signal,
        })
        .then((results) => {
          if (cancelled) return;
          setSearchResults(results);
          setIsSearching(false);
          refreshHealth();
        })
        .catch((err) => {
          if (cancelled) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : 'Search failed');
          setIsSearching(false);
          refreshHealth();
        });
    }, 300);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [targets, refreshHealth, searchQuery, searchCategory, setIsSearching, setSearchResults]);

  const handlePlayAlbum = async (album: Album) => {
    try {
      const fullAlbum = await musicProviderManager.getAlbum(album.id);
      const playable = fullTracksOnly ? fullAlbum.tracks.filter((t) => musicProviderManager.canResolveFullTrack(t)) : fullAlbum.tracks;
      if (playable.length > 0) {
        setQueue(playable, 0);
        await play(playable[0]);
      } else {
        setError('No matching full recording was found for this album.');
      }
    } catch {
      setError('This album could not be loaded from its catalog.');
    }
  };

  const handlePlayArtist = async (artist: Artist) => {
    try {
      const fullArtist = await musicProviderManager.getArtist(artist.id);
      const playable = fullTracksOnly ? fullArtist.topTracks.filter((t) => musicProviderManager.canResolveFullTrack(t)) : fullArtist.topTracks;
      if (playable.length > 0) {
        setQueue(playable, 0);
        await play(playable[0]);
      } else {
        setError('No matching full recording was found for this artist.');
      }
    } catch {
      setError('This artist could not be loaded from its catalog.');
    }
  };

  const allTracks: Track[] = searchResults?.tracks ?? [];
  const tracks: Track[] = fullTracksOnly
    ? allTracks.filter((track) => musicProviderManager.canResolveFullTrack(track))
    : allTracks;
  const artists: Artist[] = (searchResults?.artists ?? []).filter((artist) =>
    !fullTracksOnly || tracks.some((track) => track.artists.some((a) => a.id === artist.id)));
  const albums: Album[] = (searchResults?.albums ?? []).filter((album) =>
    !fullTracksOnly || tracks.some((track) => track.album.id === album.id));
  const playlists: OnlinePlaylist[] = searchResults?.playlists ?? [];
  const hasResults =
    (searchCategory === 'all' && (tracks.length > 0 || artists.length > 0 || albums.length > 0 || playlists.length > 0)) ||
    (searchCategory === 'tracks' && tracks.length > 0) ||
    (searchCategory === 'artists' && artists.length > 0) ||
    (searchCategory === 'albums' && albums.length > 0) ||
    (searchCategory === 'playlists' && playlists.length > 0);

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto space-y-8">
      {/* Search Input & Provider Filter Pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-5 h-5 text-white/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, albums, or playlists..."
            aria-label="Search music"
            className="w-full h-13 pl-12 pr-11 rounded-2xl bg-white/[0.05] backdrop-blur-xl border border-white/10 text-base text-white placeholder:text-white/35 focus:outline-none focus:border-white/25 focus:bg-white/[0.07] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-white/45 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Tabs: All, Tracks, Albums, Artists, Playlists */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Search categories">
          {(
            [
              ['all', 'All'],
              ['tracks', 'Tracks'],
              ['albums', 'Albums'],
              ['artists', 'Artists'],
              ['playlists', 'Playlists'],
            ] as const
          ).map(([catId, label]) => (
            <button
              key={catId}
              type="button"
              role="tab"
              aria-selected={searchCategory === catId}
              data-testid={`search-cat-${catId}`}
              onClick={() => setSearchCategory(catId as SearchCategory)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                searchCategory === catId
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/12'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {PROVIDER_FILTERS.filter((f) => f.id === 'all' || enabled[f.id]).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProviderFilter(f.id)}
                className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
                  providerFilter === f.id
                    ? 'bg-white text-[#0a0a0a] border-white font-medium'
                    : 'bg-white/[0.04] text-white/65 border-white/10 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                {f.id === 'all' && !searchAll ? 'Preferred source' : f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFullTracksOnly(!fullTracksOnly)}
            className={`px-3 py-1 rounded-full text-xs transition-colors cursor-pointer border ${
              fullTracksOnly
                ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30 font-medium'
                : 'bg-white/[0.04] text-white/60 border-white/10 hover:text-white'
            }`}
            title="Hide 30-second promotional previews and metadata-only entries"
          >
            Full tracks only
          </button>
        </div>
      </div>

      {searchQuery.trim() && window.electronAPI && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-white/65">
          <span>Search official players in your browser</span>
          <button type="button" onClick={() => void searchOfficial('jiosaavn')} className="underline">JioSaavn</button>
          <button type="button" onClick={() => void searchOfficial('youtube')} className="underline">YouTube Music</button>
        </div>
      )}
      {!isSearching && fullTracksOnly && allTracks.length > tracks.length && (
        <button type="button" className="text-sm text-white/65 underline" onClick={() => setFullTracksOnly(false)}>
          Show {allTracks.length - tracks.length} catalog results without a known full recording
        </button>
      )}
      {!isSearching && playbackError && allTracks.some((t) => t.id === currentTrack?.id) && (
        <p role="status" className="text-sm text-amber-200">{playbackError}</p>
      )}
      {/* Loading Skeleton */}
      {isSearching && (
        <div className="space-y-6 animate-pulse">
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-white/[0.04] border border-white/[0.05]"
              />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-white/[0.04] border border-white/[0.05]"
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !isSearching && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Empty Query State */}
      {!searchQuery.trim() && !isSearching && (
        <div className="py-20 text-center text-white/40">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-35" />
          <p className="text-sm">Start typing to search your music library and providers.</p>
        </div>
      )}

      {/* No Results */}
      {searchQuery.trim() && !isSearching && !error && searchResults && !hasResults && (
        <div className="py-20 text-center text-white/40">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-35" />
          <p className="text-sm">No results found for "{searchQuery}".</p>
        </div>
      )}

      {/* Results */}
      {!isSearching && hasResults && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-10"
        >
          {/* Tracks */}
          {(searchCategory === 'all' || searchCategory === 'tracks') && tracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">Tracks</h2>
                {searchCategory === 'all' && tracks.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setSearchCategory('tracks')}
                    className="text-xs text-white/55 hover:text-white cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] p-2">
                <TrackList tracks={searchCategory === 'all' ? tracks.slice(0, 6) : tracks} />
              </div>
            </section>
          )}

          {/* Artists */}
          {(searchCategory === 'all' || searchCategory === 'artists') && artists.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">Artists</h2>
                {searchCategory === 'all' && artists.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setSearchCategory('artists')}
                    className="text-xs text-white/55 hover:text-white cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(searchCategory === 'all' ? artists.slice(0, 5) : artists).map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() =>
                      navigate(
                        `/artist/${encodeURIComponent(artist.id)}?name=${encodeURIComponent(artist.name)}`
                      )
                    }
                    className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-center transition-all cursor-pointer"
                  >
                    <div className="w-24 h-24 mx-auto rounded-full bg-white/5 border border-white/10 overflow-hidden mb-3 flex items-center justify-center">
                      <ArtworkImage
                        src={artist.picture}
                        alt={artist.name}
                        type="artist"
                        title={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {artist.name}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">Artist</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Albums */}
          {(searchCategory === 'all' || searchCategory === 'albums') && albums.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">Albums</h2>
                {searchCategory === 'all' && albums.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setSearchCategory('albums')}
                    className="text-xs text-white/55 hover:text-white cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(searchCategory === 'all' ? albums.slice(0, 5) : albums).map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
                    className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left transition-all cursor-pointer"
                  >
                    <div className="w-full aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden mb-3 flex items-center justify-center">
                      <ArtworkImage
                        src={album.cover}
                        alt={album.title}
                        type="album"
                        title={album.title}
                        artist={album.artist}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {album.title}
                    </p>
                    <p className="text-xs text-white/45 truncate mt-0.5">
                      {album.artist || 'Album'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Playlists */}
          {(searchCategory === 'all' || searchCategory === 'playlists') && playlists.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">Playlists</h2>
                {searchCategory === 'all' && playlists.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setSearchCategory('playlists')}
                    className="text-xs text-white/55 hover:text-white cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {(searchCategory === 'all' ? playlists.slice(0, 5) : playlists).map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => navigate(`/discover/playlist/${encodeURIComponent(pl.id)}`)}
                    className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-left transition-all cursor-pointer"
                  >
                    <div className="w-full aspect-square rounded-xl bg-white/5 border border-white/10 overflow-hidden mb-3 flex items-center justify-center">
                      <ArtworkImage
                        src={pl.cover}
                        alt={pl.title}
                        type="playlist"
                        title={pl.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <p className="text-sm font-medium text-white truncate">{pl.title}</p>
                    <p className="text-xs text-white/45 truncate mt-0.5">
                      {pl.creator || 'Playlist'}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default SearchPage;
