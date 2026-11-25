import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  Copy,
  Download,
  Edit3,
  FolderOpen,
  Heart,
  Import,
  ListMusic,
  ListPlus,
  Merge,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import VirtualizedTrackTable from '@/components/ui/VirtualizedTrackTable';
import type { Track } from '@/services/music/types';
import { resolveImportedTrack } from '@/services/playlist/trackResolver';
import { useImportStore } from '@/stores/importStore';
import { useLibraryStore } from '@/stores/libraryStore';
import { useOnRepeatStore } from '@/stores/onRepeatStore';
import { usePlayerStore } from '@/stores/playerStore';

type TrackSort = 'custom' | 'title' | 'artist' | 'album' | 'duration';

function formatTotalDuration(tracks: Track[]): string {
  const totalSec = tracks.reduce((acc, t) => acc + (t.duration > 0 ? t.duration : 0), 0);
  if (totalSec <= 0) return '0 min';
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours} hr ${mins} min`;
  return `${Math.max(1, mins)} min`;
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PlaylistDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const playlists = useLibraryStore((s) => s.playlists);
  const favorites = useLibraryStore((s) => s.favorites);
  const localTracks = useLibraryStore((s) => s.localTracks);
  const recentlyPlayed = useLibraryStore((s) => s.recentlyPlayed);

  const updatePlaylistDetails = useLibraryStore((s) => s.updatePlaylistDetails);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const duplicatePlaylist = useLibraryStore((s) => s.duplicatePlaylist);
  const mergePlaylists = useLibraryStore((s) => s.mergePlaylists);
  const reorderPlaylistTracks = useLibraryStore((s) => s.reorderPlaylistTracks);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const removeMultipleFromPlaylist = useLibraryStore((s) => s.removeMultipleFromPlaylist);
  const replaceTrackInPlaylist = useLibraryStore((s) => s.replaceTrackInPlaylist);
  const markPlaylistPlayed = useLibraryStore((s) => s.markPlaylistPlayed);
  const toggleFavorite = useLibraryStore((s) => s.toggleFavorite);

  const setQueue = usePlayerStore((s) => s.setQueue);
  const play = usePlayerStore((s) => s.play);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const startSmartMix = usePlayerStore((s) => s.startSmartMix);
  const shuffleActive = usePlayerStore((s) => s.shuffleActive);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);

  const openImportDialog = useImportStore((s) => s.openDialog);
  const setDestinationMode = useImportStore((s) => s.setDestinationMode);
  const setDestinationPlaylistId = useImportStore((s) => s.setDestinationPlaylistId);

  const isSpecial = id === 'on-repeat' || id === 'liked' || id === 'local' || id === 'recent';
  const onRepeatTracks = useOnRepeatStore((s) => s.onRepeatTracks);
  const onRepeatUpdatedAt = useOnRepeatStore((s) => s.updatedAt);
  const saveOnRepeatAsPlaylist = useOnRepeatStore((s) => s.saveAsPlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const playlist = useMemo(
    () => (isSpecial ? null : playlists.find((p) => p.id === id) ?? null),
    [id, isSpecial, playlists]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TrackSort>('custom');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const meta = useMemo(() => {
    if (id === 'on-repeat') {
      return {
        title: 'On Repeat',
        description: "The songs you can't stop listening to.",
        badge: 'Auto Updated',
        cover: onRepeatTracks.find((t) => t.cover)?.cover,
        tracks: onRepeatTracks,
        createdAt: onRepeatUpdatedAt || undefined,
        sourcePlatform: undefined as string | undefined,
      };
    }
    if (id === 'liked') {
      return {
        title: 'Liked Songs',
        description: 'All tracks you have favorited in Nocturne.',
        badge: 'Favorites',
        cover: favorites.find((t) => t.cover)?.cover,
        tracks: favorites,
        createdAt: undefined as number | undefined,
        sourcePlatform: undefined as string | undefined,
      };
    }
    if (id === 'local') {
      return {
        title: 'Local Music Files',
        description: 'Audio files stored locally on your device (available offline).',
        badge: 'Local Library',
        cover: localTracks.find((t) => t.cover)?.cover,
        tracks: localTracks,
        createdAt: undefined,
        sourcePlatform: undefined,
      };
    }
    if (id === 'recent') {
      return {
        title: 'Recently Played',
        description: 'Your recent listening history.',
        badge: 'History',
        cover: recentlyPlayed.find((t) => t.cover)?.cover,
        tracks: recentlyPlayed,
        createdAt: undefined,
        sourcePlatform: undefined,
      };
    }
    if (!playlist) return null;
    return {
      title: playlist.name,
      description: playlist.description || '',
      badge: playlist.sourcePlatform ? `Imported · ${playlist.sourcePlatform}` : 'Playlist',
      cover: playlist.cover || playlist.tracks.find((t) => t.cover)?.cover,
      tracks: playlist.tracks,
      createdAt: playlist.createdAt,
      sourcePlatform: playlist.sourcePlatform,
    };
  }, [id, playlist, favorites, localTracks, recentlyPlayed]);

  const displayedTracks = useMemo(() => {
    if (!meta) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? meta.tracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            (t.album?.title || '').toLowerCase().includes(q)
        )
      : meta.tracks;

    if (sortBy === 'custom') return filtered;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'album') return (a.album?.title || '').localeCompare(b.album?.title || '');
      return (b.duration || 0) - (a.duration || 0);
    });
  }, [meta, searchQuery, sortBy]);

  if (!meta) {
    return (
      <div className="min-h-full px-8 py-12 max-w-5xl mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate('/library')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Button>
        <p className="text-white/60 text-sm">Playlist not found.</p>
      </div>
    );
  }

  const playableTracks = meta.tracks.filter((t) => t.availability !== 'metadata');
  const allowReorder = !isSpecial && sortBy === 'custom' && searchQuery.trim() === '';

  const handlePlayAll = () => {
    if (playableTracks.length === 0) return;
    if (!isSpecial) markPlaylistPlayed(id);
    setQueue(playableTracks, 0);
    void play(playableTracks[0]);
  };

  const handleShufflePlay = () => {
    if (playableTracks.length === 0) return;
    if (!isSpecial) markPlaylistPlayed(id);
    if (!shuffleActive) toggleShuffle();
    const randomIdx = Math.floor(Math.random() * playableTracks.length);
    setQueue(playableTracks, randomIdx);
    void play(playableTracks[randomIdx]);
  };

  const handlePlayFromTrack = (track: Track) => {
    if (track.availability === 'metadata') return;
    if (!isSpecial) markPlaylistPlayed(id);
    const list = displayedTracks.filter((t) => t.availability !== 'metadata');
    const idx = list.findIndex((t) => t.id === track.id);
    setQueue(list, idx >= 0 ? idx : 0);
    void play(track);
  };

  const handleToggleSelect = (trackId: string, shiftKey?: boolean) => {
    const idx = displayedTracks.findIndex((t) => t.id === trackId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIdx !== null && idx !== -1) {
        const [start, end] = [Math.min(lastSelectedIdx, idx), Math.max(lastSelectedIdx, idx)];
        for (let i = start; i <= end; i++) {
          next.add(displayedTracks[i].id);
        }
      } else if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
    if (idx !== -1) setLastSelectedIdx(idx);
  };

  const handleRetryUnavailable = async (track: Track) => {
    if (isSpecial) return;
    setStatusMessage(`Retrying match for "${track.title}"...`);
    try {
      const res = await resolveImportedTrack({
        originalIndex: 0,
        title: track.title,
        artist: track.artist,
        artists: [track.artist],
        album: track.album?.title,
        durationSec: track.duration || undefined,
        isrc: track.isrc,
      });
      if (res.bestMatch) {
        replaceTrackInPlaylist(id, track.id, res.bestMatch);
        setStatusMessage(`Matched "${track.title}" to ${res.bestMatch.provider}.`);
      } else {
        setStatusMessage(`No playable match found yet for "${track.title}".`);
      }
    } catch {
      setStatusMessage(`Failed to retry "${track.title}".`);
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'm3u8') => {
    const safeName = meta.title.replace(/[^\w\s-]/g, '').trim() || 'playlist';
    if (format === 'json') {
      downloadTextFile(
        `${safeName}.json`,
        JSON.stringify({ name: meta.title, description: meta.description, tracks: meta.tracks }, null, 2),
        'application/json'
      );
    } else if (format === 'csv') {
      const rows = ['"Track Name","Artist Name(s)","Album","Duration"'];
      for (const t of meta.tracks) {
        const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        rows.push([esc(t.title), esc(t.artist), esc(t.album?.title || ''), esc(String(Math.round(t.duration || 0)))].join(','));
      }
      downloadTextFile(`${safeName}.csv`, rows.join('\n'), 'text/csv');
    } else {
      const lines = ['#EXTM3U', `#PLAYLIST:${meta.title}`];
      for (const t of meta.tracks) {
        lines.push(`#EXTINF:${Math.round(t.duration || 0)},${t.artist} - ${t.title}`);
        lines.push(t.filePath || t.streamUrl || `${t.artist} - ${t.title}`);
      }
      downloadTextFile(`${safeName}.m3u8`, lines.join('\n'), 'audio/x-mpegurl');
    }
    setShowMoreMenu(false);
  };

  const startEditing = () => {
    setEditName(meta.title);
    setEditDesc(meta.description || '');
    setEditCover(meta.cover || '');
    setEditingDetails(true);
    setShowMoreMenu(false);
  };

  const saveEditing = () => {
    if (!isSpecial) {
      updatePlaylistDetails(id, {
        name: editName,
        description: editDesc,
        cover: editCover.trim() || undefined,
      });
    }
    setEditingDetails(false);
  };

  const offlineCount = meta.tracks.filter((t) => t.isLocal || t.provider === 'commons').length;
  const pageRef = useRef<HTMLDivElement>(null);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.toggle);
  const isPlaylistPlaying = Boolean(
    isPlaying && currentTrack && meta.tracks.some((t) => t.id === currentTrack.id)
  );

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const scroller = el.closest('.overflow-y-auto') as HTMLElement | null;
    if (!scroller) return;

    const onScroll = () => {
      setIsHeaderCollapsed(scroller.scrollTop > 220);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [id]);

  return (
    <div ref={pageRef} className="min-h-full pb-12">
      {/* Compact Sticky Header */}
      <div
        data-testid="playlist-compact-header"
        className={`sticky top-0 z-30 h-[56px] px-8 flex items-center gap-3.5 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.08] transition-all duration-200 ${
          isHeaderCollapsed
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            if (isPlaylistPlaying) {
              void togglePlay();
            } else {
              handlePlayAll();
            }
          }}
          disabled={playableTracks.length === 0}
          aria-label={isPlaylistPlaying ? `Pause ${meta.title}` : `Play ${meta.title}`}
          className="w-9 h-9 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer disabled:opacity-40"
        >
          {isPlaylistPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>
        <h2 className="text-base font-semibold text-white truncate">{meta.title}</h2>
      </div>

      <div className="px-8 pt-2 max-w-6xl mx-auto space-y-6">
        <button
          type="button"
          onClick={() => navigate('/library')}
          className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Your Library
        </button>

        {/* Spotify-inspired Header */}
        <div
          data-testid="playlist-expanded-header"
          className="flex flex-col md:flex-row md:items-end gap-6 p-6 rounded-2xl bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent"
        >
        <div className="w-44 h-44 rounded-2xl bg-white/5 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-2xl">
          {meta.cover ? (
            <img src={meta.cover} alt={meta.title} className="w-full h-full object-cover" />
          ) : id === 'on-repeat' ? (
            <Repeat className="w-16 h-16 text-indigo-400" />
          ) : id === 'liked' ? (
            <Heart className="w-16 h-16 text-white/40" />
          ) : id === 'local' ? (
            <FolderOpen className="w-16 h-16 text-white/40" />
          ) : id === 'recent' ? (
            <Clock className="w-16 h-16 text-white/40" />
          ) : (
            <ListMusic className="w-16 h-16 text-white/30" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/10 text-white/80">
            {meta.badge}
          </span>

          {editingDetails ? (
            <div className="space-y-2 max-w-lg">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Playlist name"
                className="w-full h-9 px-3 rounded-lg bg-black/40 border border-white/20 text-sm text-white"
              />
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Description..."
                className="w-full h-8 px-3 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
              />
              <input
                type="text"
                value={editCover}
                onChange={(e) => setEditCover(e.target.value)}
                placeholder="Artwork image URL (optional)"
                className="w-full h-8 px-3 rounded-lg bg-black/40 border border-white/15 text-xs text-white"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEditing}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDetails(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white truncate">
                  {meta.title}
                </h1>
                {!isSpecial && (
                  <button
                    type="button"
                    onClick={startEditing}
                    aria-label="Edit playlist details"
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {meta.description && (
                <p className="text-sm text-white/60 max-w-2xl">{meta.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                <span>{meta.tracks.length} {meta.tracks.length === 1 ? 'track' : 'tracks'}</span>
                <span>·</span>
                <span>{formatTotalDuration(meta.tracks)}</span>
                {meta.createdAt && (
                  <>
                    <span>·</span>
                    <span>Created {new Date(meta.createdAt).toLocaleDateString()}</span>
                  </>
                )}
                {offlineCount > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-300/80">{offlineCount} offline-ready</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="primary" disabled={playableTracks.length === 0} onClick={handlePlayAll}>
            <Play className="w-4 h-4 fill-current" />
            Play All
          </Button>
          <Button variant="secondary" disabled={playableTracks.length === 0} onClick={handleShufflePlay}>
            <Shuffle className="w-4 h-4" />
            Shuffle Play
          </Button>
          <Button variant="secondary" disabled={playableTracks.length === 0} onClick={() => void startSmartMix(playableTracks)}>
            <Sparkles className="w-4 h-4" />
            Smart Mix
          </Button>
          <Button
            variant="secondary"
            disabled={playableTracks.length === 0}
            onClick={() => {
              addToQueue(playableTracks);
              setStatusMessage(`Added ${playableTracks.length} tracks to queue.`);
            }}
          >
            <ListPlus className="w-4 h-4" />
            Add to Queue
          </Button>

          {!isSpecial && (
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setShowMoreMenu((v) => !v)}
                aria-label="More playlist options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {showMoreMenu && (
                <div className="absolute left-0 mt-2 w-56 rounded-xl bg-[#18181f]/95 backdrop-blur-2xl border border-white/15 shadow-2xl py-1.5 z-40 text-xs text-white">
                  <button
                    type="button"
                    onClick={startEditing}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit details & artwork
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const copy = duplicatePlaylist(id);
                      setShowMoreMenu(false);
                      if (copy) navigate(`/playlist/${copy.id}`);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationMode('existing');
                      setDestinationPlaylistId(id);
                      setShowMoreMenu(false);
                      openImportDialog();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Import className="w-3.5 h-3.5" />
                    Import additional tracks
                  </button>
                  {playlists.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMergePicker((v) => !v);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                    >
                      <Merge className="w-3.5 h-3.5" />
                      Merge into another playlist
                    </button>
                  )}
                  {showMergePicker && (
                    <div className="mx-2 my-1 max-h-32 overflow-y-auto rounded-lg bg-black/40 border border-white/10">
                      {playlists
                        .filter((p) => p.id !== id)
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => {
                              mergePlaylists(id, target.id);
                              setShowMergePicker(false);
                              setShowMoreMenu(false);
                              setStatusMessage(`Merged into "${target.name}".`);
                            }}
                            className="w-full px-3 py-1.5 text-left truncate hover:bg-white/10 cursor-pointer"
                          >
                            {target.name}
                          </button>
                        ))}
                    </div>
                  )}
                  <div className="border-t border-white/10 my-1" />
                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('m3u8')}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export M3U8
                  </button>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDelete(true);
                      setShowMoreMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-500/15 text-red-300 text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete playlist
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search & Sort within playlist */}
        <div className="flex items-center gap-2">
          <div className="relative w-52">
            <Search className="w-3.5 h-3.5 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in playlist..."
              aria-label="Search in playlist"
              className="w-full h-9 pl-8 pr-3 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as TrackSort)}
            aria-label="Sort playlist tracks"
            className="h-9 px-2.5 rounded-xl bg-[#16161b] border border-white/10 text-xs text-white focus:outline-none"
          >
            <option value="custom">Custom Order</option>
            <option value="title">Title</option>
            <option value="artist">Artist</option>
            <option value="album">Album</option>
            <option value="duration">Duration</option>
          </select>
        </div>
      </div>

      {statusMessage && (
        <p role="status" className="text-xs text-white/70 px-1">
          {statusMessage}
        </p>
      )}

      {/* Delete confirmation */}
      {confirmDelete && !isSpecial && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs">
          <span className="text-red-200">
            Delete "{meta.title}"? This removes the playlist from your library.
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                deletePlaylist(id);
                navigate('/library');
              }}
            >
              Confirm Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Multi-select bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.07] border border-white/15 text-xs">
          <span className="font-medium text-white">
            {selectedIds.size} {selectedIds.size === 1 ? 'track' : 'tracks'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const chosen = meta.tracks.filter(
                  (t) => selectedIds.has(t.id) && t.availability !== 'metadata'
                );
                if (chosen.length > 0) addToQueue(chosen);
                setSelectedIds(new Set());
              }}
            >
              Add to Queue
            </Button>
            {!isSpecial && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  removeMultipleFromPlaylist(id, selectedIds);
                  setSelectedIds(new Set());
                }}
              >
                Remove Selected
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Virtualized Track Table */}
      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.07] p-2">
        <VirtualizedTrackTable
          tracks={displayedTracks}
          onPlayTrack={(track) => handlePlayFromTrack(track)}
          onRemoveTrack={
            !isSpecial
              ? (track) => removeFromPlaylist(id, track.id)
              : id === 'liked'
                ? (track) => toggleFavorite(track)
                : undefined
          }
          onReorder={
            allowReorder
              ? (fromIdx, toIdx) => reorderPlaylistTracks(id, fromIdx, toIdx)
              : undefined
          }
          onRetryUnavailable={!isSpecial ? (track) => void handleRetryUnavailable(track) : undefined}
          allowReorder={allowReorder}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      </div>
      </div>
    </div>
  );
}

export default PlaylistDetailPage;
