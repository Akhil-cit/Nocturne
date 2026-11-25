import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  FolderOpen,
  Heart,
  Import,
  LayoutGrid,
  List,
  ListMusic,
  Music,
  Play,
  Plus,
  Repeat,
  Search,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { useImportStore } from '@/stores/importStore';
import { useLibraryStore, type Playlist } from '@/stores/libraryStore';
import { useOnRepeatStore } from '@/stores/onRepeatStore';
import { usePlayerStore } from '@/stores/playerStore';

type LibraryFilter =
  | 'all'
  | 'playlists'
  | 'liked'
  | 'imported'
  | 'local_playlists'
  | 'local_files'
  | 'recent';

type SortBy = 'recent_added' | 'name' | 'recent_played' | 'track_count';

interface LibraryCardItem {
  id: string;
  title: string;
  subtitle: string;
  trackCount: number;
  cover?: string;
  kind: 'on-repeat' | 'liked' | 'local_files' | 'recent' | 'imported' | 'playlist';
  createdAt: number;
  lastPlayedAt: number;
  route: string;
  playableTracks: Playlist['tracks'];
}

export function LibraryPage() {
  const navigate = useNavigate();

  const playlists = useLibraryStore((s) => s.playlists);
  const favorites = useLibraryStore((s) => s.favorites);
  const localTracks = useLibraryStore((s) => s.localTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const markPlaylistPlayed = useLibraryStore((s) => s.markPlaylistPlayed);

  const openImportDialog = useImportStore((s) => s.openDialog);
  const onRepeatTracks = useOnRepeatStore((s) => s.onRepeatTracks);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);

  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('recent_added');
  const [query, setQuery] = useState('');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newName, setNewName] = useState('');

  const items = useMemo<LibraryCardItem[]>(() => {
    const list: LibraryCardItem[] = [];

    if (filter === 'all' || filter === 'playlists') {
      list.push({
        id: 'on-repeat',
        title: 'On Repeat',
        subtitle: 'Auto-updated · Based on your listening',
        trackCount: onRepeatTracks.length,
        cover: onRepeatTracks.find((t) => t.cover)?.cover,
        kind: 'on-repeat',
        createdAt: Number.MAX_SAFE_INTEGER,
        lastPlayedAt: 0,
        route: '/playlist/on-repeat',
        playableTracks: onRepeatTracks,
      });
    }

    if (filter === 'all' || filter === 'liked') {
      list.push({
        id: 'liked',
        title: 'Liked Songs',
        subtitle: 'Favorites',
        trackCount: favorites.length,
        cover: favorites.find((t) => t.cover)?.cover,
        kind: 'liked',
        createdAt: Number.MAX_SAFE_INTEGER - 1,
        lastPlayedAt: favorites.length > 0 ? Date.now() : 0,
        route: '/playlist/liked',
        playableTracks: favorites,
      });
    }

    if (filter === 'all' || filter === 'local_files') {
      list.push({
        id: 'local',
        title: 'Local Music Files',
        subtitle: 'Offline files on device',
        trackCount: localTracks.length,
        cover: localTracks.find((t) => t.cover)?.cover,
        kind: 'local_files',
        createdAt: Number.MAX_SAFE_INTEGER - 2,
        lastPlayedAt: 0,
        route: '/playlist/local',
        playableTracks: localTracks,
      });
    }

    if (filter === 'all' || filter === 'recent') {
      list.push({
        id: 'recent',
        title: 'Recently Played',
        subtitle: 'Listening history',
        trackCount: recentlyPlayed.length,
        cover: recentlyPlayed.find((t) => t.cover)?.cover,
        kind: 'recent',
        createdAt: Number.MAX_SAFE_INTEGER - 3,
        lastPlayedAt: recentlyPlayed.length > 0 ? Date.now() - 1 : 0,
        route: '/playlist/recent',
        playableTracks: recentlyPlayed,
      });
    }

    for (const pl of playlists) {
      const isImported = Boolean(pl.sourcePlatform);
      if (filter === 'liked' || filter === 'local_files' || filter === 'recent') continue;
      if (filter === 'imported' && !isImported) continue;
      if (filter === 'local_playlists' && isImported) continue;

      list.push({
        id: pl.id,
        title: pl.name,
        subtitle: isImported ? `Imported · ${pl.sourcePlatform}` : 'Playlist',
        trackCount: pl.tracks.length,
        cover: pl.cover || pl.tracks.find((t) => t.cover)?.cover,
        kind: isImported ? 'imported' : 'playlist',
        createdAt: pl.createdAt,
        lastPlayedAt: pl.lastPlayedAt ?? 0,
        route: `/playlist/${pl.id}`,
        playableTracks: pl.tracks,
      });
    }

    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        )
      : list;

    return filtered.sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title);
      if (sortBy === 'track_count') return b.trackCount - a.trackCount;
      if (sortBy === 'recent_played') return b.lastPlayedAt - a.lastPlayedAt;
      return b.createdAt - a.createdAt;
    });
  }, [filter, playlists, favorites, localTracks, recentlyPlayed, query, sortBy]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created = createPlaylist(trimmed);
    setNewName('');
    setShowNewPlaylist(false);
    navigate(`/playlist/${created.id}`);
  };

  const handleQuickPlay = (item: LibraryCardItem) => {
    const playable = item.playableTracks.filter((t) => t.availability !== 'metadata');
    if (playable.length === 0) return;
    if (item.kind === 'playlist' || item.kind === 'imported') {
      markPlaylistPlayed(item.id);
    }
    setQueue(playable, 0);
    void play(playable[0]);
  };

  const filters: Array<{ id: LibraryFilter; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'playlists', label: 'Playlists' },
    { id: 'liked', label: 'Liked Songs' },
    { id: 'imported', label: 'Imported' },
    { id: 'local_playlists', label: 'Local Playlists' },
    { id: 'local_files', label: 'Local Files' },
    { id: 'recent', label: 'Recently Played' },
  ];

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
            Collection
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Your Library
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="md" onClick={openImportDialog}>
            <Import className="w-4 h-4" />
            Import Playlist
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => setShowNewPlaylist((v) => !v)}
          >
            <Plus className="w-4 h-4" />
            New Playlist
          </Button>
        </div>
      </div>

      {showNewPlaylist && (
        <div className="flex items-center gap-2 max-w-md p-3 rounded-xl bg-white/[0.04] border border-white/10">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            placeholder="New playlist name..."
            className="flex-1 h-9 px-3 rounded-lg bg-white/[0.06] border border-white/12 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
          />
          <Button size="sm" onClick={handleCreate}>
            Create
          </Button>
        </div>
      )}

      {/* Filter Pills + Search + Sort + View Mode */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filter === f.id
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter library..."
              aria-label="Filter library"
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            aria-label="Sort library"
            className="h-9 px-2.5 rounded-xl bg-[#16161b] border border-white/10 text-xs text-white focus:outline-none"
          >
            <option value="recent_added">Recently Added</option>
            <option value="name">Name (A–Z)</option>
            <option value="recent_played">Recently Played</option>
            <option value="track_count">Track Count</option>
          </select>

          <div className="flex items-center rounded-xl bg-white/[0.05] border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewMode === 'grid' ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-1.5 rounded-lg cursor-pointer ${
                viewMode === 'list' ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="py-16 text-center text-sm text-white/45">
          No matching items in your library.
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(item.route)}
              className="group rounded-2xl p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] transition-all cursor-pointer"
            >
              <div className="relative w-full aspect-square rounded-xl bg-white/5 overflow-hidden mb-3 flex items-center justify-center">
                {item.cover ? (
                  <img
                    src={item.cover}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : item.kind === 'liked' ? (
                  <Heart className="w-10 h-10 text-white/40" />
                ) : item.kind === 'local_files' ? (
                  <FolderOpen className="w-10 h-10 text-white/35" />
                ) : item.kind === 'recent' ? (
                  <Clock className="w-10 h-10 text-white/35" />
                ) : (
                  <ListMusic className="w-10 h-10 text-white/30" />
                )}

                {item.trackCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickPlay(item);
                    }}
                    aria-label={`Play ${item.title}`}
                    className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center shadow-xl opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                )}
              </div>
              <p className="text-sm font-medium text-white truncate">{item.title}</p>
              <p className="text-xs text-white/45 truncate mt-0.5">
                {item.subtitle} · {item.trackCount} {item.trackCount === 1 ? 'track' : 'tracks'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] divide-y divide-white/[0.05]">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(item.route)}
              className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Music className="w-5 h-5 text-white/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="text-xs text-white/45 truncate">{item.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-white/50 tabular-nums">
                  {item.trackCount} {item.trackCount === 1 ? 'track' : 'tracks'}
                </span>
                {item.trackCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleQuickPlay(item);
                    }}
                    aria-label={`Play ${item.title}`}
                    className="p-2 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LibraryPage;
