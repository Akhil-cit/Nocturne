import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Disc3,
  FolderOpen,
  Heart,
  Import,
  Library,
  ListMusic,
  Music,
  Play,
  Repeat,
  Search,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { musicProviderManager } from '@/services/music/provider';
import type { Track } from '@/services/music/types';
import { useImportStore } from '@/stores/importStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useOnRepeatStore } from '@/stores/onRepeatStore';
import { usePlayerStore } from '@/stores/playerStore';

export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 22) return 'Good evening';
  return 'Good night';
}

export function HomePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [greeting, setGreeting] = useState(() => getGreeting());

  useEffect(() => {
    const refresh = () => setGreeting(getGreeting());
    const interval = setInterval(refresh, 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);

  const recentTracks = useLibraryStore((s) => s.recentlyPlayed);
  const favoriteTracks = useLibraryStore((s) => s.favorites);
  const playlists = useLibraryStore((s) => s.playlists);
  const localTracks = useLibraryStore((s) => s.localTracks);
  const refreshLocalTracks = useLibraryStore((s) => s.refreshLocalTracks);
  const markPlaylistPlayed = useLibraryStore((s) => s.markPlaylistPlayed);

  const openImportDialog = useImportStore((s) => s.openDialog);
  const onRepeatTracks = useOnRepeatStore((s) => s.onRepeatTracks);

  const recentPlaylists = useMemo(() => {
    const items = [...playlists]
      .sort((a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt))
      .slice(0, 6);
    return items;
  }, [playlists]);

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

  const hasContent =
    recentTracks.length > 0 ||
    favoriteTracks.length > 0 ||
    playlists.length > 0 ||
    localTracks.length > 0 ||
    onRepeatTracks.length > 0;

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
          <h1 data-testid="home-greeting" className="text-3xl font-semibold tracking-tight text-white">
            {greeting}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="secondary" size="md" onClick={openImportDialog}>
            <Import className="w-4 h-4" />
            Import Playlist
          </Button>
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
            Open local audio files, import a playlist, or search for tracks to begin
            listening with synchronized constellation lyrics.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" onClick={openImportDialog}>
              <Import className="w-4 h-4" />
              Import Playlist
            </Button>
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
          {/* Quick Access Shortcuts */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => navigate('/playlist/liked')}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors text-left cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">Liked Songs</p>
                <p className="text-xs text-white/50">
                  {favoriteTracks.length} {favoriteTracks.length === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/playlist/local')}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors text-left cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">Local Files</p>
                <p className="text-xs text-white/50">
                  {localTracks.length} {localTracks.length === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => navigate('/library')}
              className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors text-left cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Library className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">Your Library</p>
                <p className="text-xs text-white/50">
                  {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
                </p>
              </div>
            </button>
          </section>

          {/* Recently Played Tracks */}
          {recentTracks.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-medium text-white/90">
                  Recently Played
                </h2>
                <button
                  type="button"
                  onClick={() => navigate('/playlist/recent')}
                  className="text-xs text-white/50 hover:text-white cursor-pointer"
                >
                  View all
                </button>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {recentTracks.slice(0, 12).map((track, index) => (
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

          {/* Jump Back In: Playlists */}
          {(recentPlaylists.length > 0 || onRepeatTracks.length > 0) && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4 text-white/70" />
                  <h2 className="text-base font-medium text-white/90">
                    Your Playlists
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/library')}
                  className="text-xs text-white/50 hover:text-white cursor-pointer"
                >
                  Open Library
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {onRepeatTracks.length > 0 && (
                  <div
                    onClick={() => navigate('/playlist/on-repeat')}
                    className="group rounded-2xl p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-all cursor-pointer"
                  >
                    <div className="relative w-full aspect-square rounded-xl bg-white/5 overflow-hidden mb-2.5 flex items-center justify-center">
                      {onRepeatTracks[0]?.cover ? (
                        <img
                          src={onRepeatTracks[0].cover}
                          alt="On Repeat"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <Repeat className="w-8 h-8 text-indigo-400" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playFromList(onRepeatTracks, 0);
                        }}
                        aria-label="Play On Repeat"
                        className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </button>
                    </div>
                    <p className="text-sm font-medium text-white truncate">
                      On Repeat
                    </p>
                    <p className="text-xs text-white/45 truncate">
                      Auto · {onRepeatTracks.length} {onRepeatTracks.length === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                )}
                {recentPlaylists.map((pl) => {
                  const cover = pl.cover || pl.tracks.find((t) => t.cover)?.cover;
                  const playable = pl.tracks.filter((t) => t.availability !== 'metadata');
                  return (
                    <div
                      key={pl.id}
                      onClick={() => navigate(`/playlist/${pl.id}`)}
                      className="group rounded-2xl p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-all cursor-pointer"
                    >
                      <div className="relative w-full aspect-square rounded-xl bg-white/5 overflow-hidden mb-2.5 flex items-center justify-center">
                        {cover ? (
                          <img
                            src={cover}
                            alt={pl.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <ListMusic className="w-8 h-8 text-white/30" />
                        )}
                        {playable.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markPlaylistPlayed(pl.id);
                              playFromList(playable, 0);
                            }}
                            aria-label={`Play ${pl.name}`}
                            className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-white truncate">
                        {pl.name}
                      </p>
                      <p className="text-xs text-white/45 truncate">
                        {pl.tracks.length} {pl.tracks.length === 1 ? 'track' : 'tracks'}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default HomePage;
