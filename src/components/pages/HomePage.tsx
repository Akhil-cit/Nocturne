import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Disc3,
  FolderOpen,
  Heart,
  ListMusic,
  Music,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { localPlaylistImporter } from '@/services/music/libraryDiscovery';
import Button from '@/components/ui/Button';
import TrackList from '@/components/ui/TrackList';
import { musicProviderManager } from '@/services/music/provider';
import type { Track } from '@/services/music/types';
import { useProviderStore } from '@/stores/providerStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { usePlayerStore } from '@/stores/playerStore';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);

  const recentTracks = useLibraryStore((s) => s.recentlyPlayed);
  const favoriteTracks = useLibraryStore((s) => s.favorites);
  const playlists = useLibraryStore((s) => s.playlists);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);

  const localTracks = useLibraryStore((s) => s.localTracks);
  const refreshLocalTracks = useLibraryStore((s) => s.refreshLocalTracks);
  const [importMessage, setImportMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const handleImport = async () => {
    setImporting(true);
    setImportMessage('');
    try {
      const result = await localPlaylistImporter.import();
      if (!result) return;
      if (result.tracks.length) createPlaylist(result.name, result.tracks);
      refreshLocalTracks();
      setImportMessage(result.tracks.length + ' tracks imported, ' + result.skipped + ' entries skipped.');
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Playlist import failed.');
    } finally {
      setImporting(false);
    }
  };

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);

  const localEnabled = useProviderStore((s) => s.enabledProviders.local);
  const recommendations = useMemo(() => {
    if (!localEnabled) return [];
    const seeds = [...favoriteTracks, ...recentTracks];
    const known = new Set(seeds.map((track) => track.id));
    const artistNames = (track: Track) =>
      (track.artists?.length ? track.artists.map((a) => a.name) : [track.artist])
        .map((name) => name.normalize('NFKC').trim().toLowerCase())
        .filter((name) => name && name !== 'unknown artist');
    const artists = new Set(seeds.flatMap(artistNames));
    return localTracks.filter((track) =>
      !known.has(track.id) && artistNames(track).some((artist) => artists.has(artist))
    ).slice(0, 8);
  }, [favoriteTracks, recentTracks, localTracks, localEnabled]);

  const favoriteIds = useMemo(
    () => new Set(favoriteTracks.map((t) => t.id)),
    [favoriteTracks]
  );

  const handleOpenLocalFiles = async () => {
    const tracks = await musicProviderManager.localProvider.openFilesViaDialog();
    if (tracks.length > 0) {
      refreshLocalTracks();
      setQueue(tracks, 0);
      void play(tracks[0]);
      return;
    }
    if (!window.electronAPI) {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFilesChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const tracks = await musicProviderManager.localProvider.addBrowserFiles(files);
    if (tracks.length > 0) {
      refreshLocalTracks();
      setQueue(tracks, 0);
      void play(tracks[0]);
    }
    e.target.value = '';
  };

  const playFromList = (list: Track[], index: number) => {
    setQueue(list, index);
    void play(list[index]);
  };

  const handleCreatePlaylist = () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    createPlaylist(trimmed, localTracks.length > 0 ? localTracks : undefined);
    setNewPlaylistName('');
    setShowNewPlaylist(false);
  };

  const hasContent =
    recentTracks.length > 0 ||
    favoriteTracks.length > 0 ||
    playlists.length > 0 ||
    localTracks.length > 0;

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto space-y-10">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={(e) => void handleBrowserFilesChange(e)}
        className="hidden"
      />

      {/* Header & Quick Actions */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Nocturne
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {getGreeting()}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {window.electronAPI && <Button variant="secondary" disabled={importing} onClick={() => void handleImport()}>Import M3U</Button>}
          <Button
            variant="secondary"
            size="md"
            onClick={() => void handleOpenLocalFiles()}
          >
            <FolderOpen className="w-4 h-4" />
            Open local files
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/search')}
          >
            <Search className="w-4 h-4" />
            Search music
          </Button>
        </div>
      </motion.section>

      {importMessage && <p role="status" className="text-sm text-white/65">{importMessage}</p>}
      {!hasContent ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] p-12 flex flex-col items-center text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
            <Disc3 className="w-7 h-7 text-white/60" />
          </div>
          <h2 className="text-lg font-medium text-white mb-2">
            Your listening space is quiet
          </h2>
          <p className="text-sm text-white/50 max-w-md mb-6">
            Open local audio files from your device or search for tracks to begin
            listening with synchronized constellation lyrics.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => void handleOpenLocalFiles()}
            >
              <FolderOpen className="w-4 h-4" />
              Open local files
            </Button>
            <Button variant="primary" onClick={() => navigate('/search')}>
              <Search className="w-4 h-4" />
              Search music
            </Button>
          </div>
        </motion.section>
      ) : (
        <>
          {/* Recently Played */}
          {recentTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">
                  Recently Played
                </h2>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {recentTracks.map((track, index) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => playFromList(recentTracks, index)}
                    className="group w-40 shrink-0 text-left rounded-xl p-2.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] transition-all cursor-pointer"
                  >
                    <div className="relative w-full aspect-square rounded-lg bg-white/5 overflow-hidden mb-2.5 flex items-center justify-center">
                      {track.cover ? (
                        <img
                          src={track.cover}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <Music className="w-8 h-8 text-white/25" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="w-10 h-10 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-white/45 truncate">
                      {track.artist}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {recommendations.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-medium text-white/90">More from artists you listen to</h2>
              <TrackList tracks={recommendations} />
            </section>
          )}

          {/* Playlists */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-white/70" />
                <h2 className="text-base font-medium text-white/90">Playlists</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewPlaylist((v) => !v)}
              >
                <Plus className="w-3.5 h-3.5" />
                New playlist
              </Button>
            </div>

            {showNewPlaylist && (
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreatePlaylist();
                  }}
                  placeholder="Playlist name..."
                  className="flex-1 h-9 px-3 rounded-xl bg-white/[0.05] border border-white/12 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
                />
                <Button size="sm" onClick={handleCreatePlaylist}>
                  Create
                </Button>
              </div>
            )}

            {playlists.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      if (pl.tracks.length > 0) playFromList(pl.tracks, 0);
                    }}
                    className="group flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {pl.name}
                      </p>
                      <p className="text-xs text-white/45">
                        {pl.tracks.length} {pl.tracks.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePlaylist(pl.id);
                      }}
                      aria-label={`Delete ${pl.name}`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Favorites */}
          {favoriteTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-white/70" />
                <h2 className="text-base font-medium text-white/90">Favorites</h2>
              </div>
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] p-2">
                <TrackList
                  tracks={favoriteTracks}
                  favorites={favoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            </section>
          )}

          {/* Local Library */}
          {localTracks.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-white/70" />
                <h2 className="text-base font-medium text-white/90">
                  Local Files
                </h2>
              </div>
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] p-2">
                <TrackList
                  tracks={localTracks}
                  favorites={favoriteIds}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default HomePage;
