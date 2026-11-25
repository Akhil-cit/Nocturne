import { useRef, useState, type ChangeEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Link2,
  Loader2,
  Music,
  RefreshCw,
  Replace,
  Search,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import { musicProviderManager } from '@/services/music/provider';
import type { Track } from '@/services/music/types';
import { useImportStore } from '@/stores/importStore';
import { useLibraryStore } from '@/stores/libraryStore';

const SUPPORTED_PLATFORMS = [
  'Spotify',
  'Apple Music',
  'YouTube Music',
  'YouTube',
  'JioSaavn',
  'M3U / CSV / JSON / TXT',
];

export function ImportDialog() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOpen = useImportStore((s) => s.isOpen);
  const closeDialog = useImportStore((s) => s.closeDialog);
  const urlInput = useImportStore((s) => s.urlInput);
  const setUrlInput = useImportStore((s) => s.setUrlInput);
  const detectedPlatform = useImportStore((s) => s.detectedPlatform);
  const phase = useImportStore((s) => s.phase);
  const errorMessage = useImportStore((s) => s.errorMessage);
  const preview = useImportStore((s) => s.preview);
  const entries = useImportStore((s) => s.entries);
  const progress = useImportStore((s) => s.progress);
  const destinationMode = useImportStore((s) => s.destinationMode);
  const setDestinationMode = useImportStore((s) => s.setDestinationMode);
  const destinationPlaylistName = useImportStore((s) => s.destinationPlaylistName);
  const setDestinationPlaylistName = useImportStore((s) => s.setDestinationPlaylistName);
  const destinationPlaylistId = useImportStore((s) => s.destinationPlaylistId);
  const setDestinationPlaylistId = useImportStore((s) => s.setDestinationPlaylistId);
  const includeUnavailable = useImportStore((s) => s.includeUnavailable);
  const setIncludeUnavailable = useImportStore((s) => s.setIncludeUnavailable);
  const savedCheckpoint = useImportStore((s) => s.savedCheckpoint);
  const lastSavedPlaylistId = useImportStore((s) => s.lastSavedPlaylistId);

  const fetchUrlPreview = useImportStore((s) => s.fetchUrlPreview);
  const openLocalPlaylistFile = useImportStore((s) => s.openLocalPlaylistFile);
  const loadLocalFileContent = useImportStore((s) => s.loadLocalFileContent);
  const startImport = useImportStore((s) => s.startImport);
  const cancelImport = useImportStore((s) => s.cancelImport);
  const retryUnmatched = useImportStore((s) => s.retryUnmatched);
  const resumeCheckpoint = useImportStore((s) => s.resumeCheckpoint);
  const discardCheckpoint = useImportStore((s) => s.discardCheckpoint);
  const replaceTrackMatch = useImportStore((s) => s.replaceTrackMatch);
  const saveToLibrary = useImportStore((s) => s.saveToLibrary);
  const reset = useImportStore((s) => s.reset);

  const playlists = useLibraryStore((s) => s.playlists);

  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState<Track[]>([]);
  const [manualSearching, setManualSearching] = useState(false);

  if (!isOpen) return null;

  const handleChooseFile = async () => {
    if (typeof window !== 'undefined' && typeof window.electronAPI?.openPlaylistFile === 'function') {
      await openLocalPlaylistFile();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    const parts = file.name.split('.');
    const ext = parts.length > 1 ? parts.pop()! : 'txt';
    const baseName = parts.join('.') || 'Imported Playlist';
    loadLocalFileContent(ext, content, baseName);
    e.target.value = '';
  };

  const openManualReplace = (index: number, initialQuery: string, candidates?: Track[]) => {
    setReplacingIndex(index);
    setManualQuery(initialQuery);
    setManualResults(candidates ?? []);
  };

  const runManualSearch = async () => {
    const q = manualQuery.trim();
    if (!q) return;
    setManualSearching(true);
    try {
      const res = await musicProviderManager.searchAll(q, { timeoutMs: 8000 });
      setManualResults(res.tracks.filter((t) => t.availability === 'full' || t.isLocal).slice(0, 8));
    } finally {
      setManualSearching(false);
    }
  };

  const pct =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Import Playlist"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".m3u,.m3u8,.csv,.json,.txt"
        onChange={(e) => void handleBrowserFileChange(e)}
        className="hidden"
      />

      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[#111115]/95 border border-white/12 shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Import Playlist</h2>
            <p className="text-xs text-white/50">
              Import tracks from streaming links or local playlist files
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            aria-label="Close Import Playlist"
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Supported platforms */}
          <div className="flex flex-wrap items-center gap-1.5">
            {SUPPORTED_PLATFORMS.map((label) => (
              <span
                key={label}
                className="px-2.5 py-1 rounded-full text-[11px] bg-white/[0.05] border border-white/[0.08] text-white/70"
              >
                {label}
              </span>
            ))}
          </div>

          {/* Resumable checkpoint banner */}
          {savedCheckpoint && phase === 'idle' && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.06] border border-white/15">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  Resume interrupted import: {savedCheckpoint.playlistTitle}
                </p>
                <p className="text-xs text-white/55">
                  {savedCheckpoint.entries.filter((e) => e.status !== 'pending').length} of{' '}
                  {savedCheckpoint.entries.length} processed
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="primary" onClick={() => void resumeCheckpoint()}>
                  Resume
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void discardCheckpoint()}>
                  Discard
                </Button>
              </div>
            </div>
          )}

          {/* URL input & local file */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void fetchUrlPreview();
                  }}
                  placeholder="Paste Spotify, Apple Music, YouTube Music, YouTube, or JioSaavn playlist URL..."
                  aria-label="Playlist URL"
                  className="w-full h-10 pl-10 pr-28 rounded-xl bg-white/[0.05] border border-white/12 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
                />
                {detectedPlatform && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/15 text-white">
                    {detectedPlatform.displayName}
                  </span>
                )}
              </div>

              <Button
                variant="primary"
                disabled={phase === 'fetching' || phase === 'importing'}
                onClick={() => void fetchUrlPreview()}
              >
                {phase === 'fetching' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  'Fetch Playlist'
                )}
              </Button>

              <Button
                variant="secondary"
                disabled={phase === 'fetching' || phase === 'importing'}
                onClick={() => void handleChooseFile()}
              >
                <FileUp className="w-4 h-4" />
                Local File
              </Button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Preview & Destination */}
          {preview && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                <div className="w-16 h-16 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                  {preview.artworkUrl ? (
                    <img
                      src={preview.artworkUrl}
                      alt={preview.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-7 h-7 text-white/30" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white truncate">
                      {preview.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 text-white/75 shrink-0">
                      {preview.totalTracks} tracks
                    </span>
                  </div>
                  {preview.owner && (
                    <p className="text-xs text-white/50 truncate mt-0.5">
                      By {preview.owner}
                    </p>
                  )}
                  {preview.warning && (
                    <p className="text-xs text-amber-300/90 mt-1">{preview.warning}</p>
                  )}
                </div>
              </div>

              {/* Destination options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 block">
                    Destination
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDestinationMode('new')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                        destinationMode === 'new'
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      New Playlist
                    </button>
                    <button
                      type="button"
                      disabled={playlists.length === 0}
                      onClick={() => {
                        setDestinationMode('existing');
                        if (!destinationPlaylistId && playlists[0]) {
                          setDestinationPlaylistId(playlists[0].id);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors disabled:opacity-40 ${
                        destinationMode === 'existing'
                          ? 'bg-white text-black border-white'
                          : 'bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      Existing Playlist
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-white/60 block">
                    {destinationMode === 'new' ? 'Playlist Name' : 'Select Playlist'}
                  </label>
                  {destinationMode === 'new' ? (
                    <input
                      type="text"
                      value={destinationPlaylistName}
                      onChange={(e) => setDestinationPlaylistName(e.target.value)}
                      placeholder="Playlist name..."
                      className="w-full h-9 px-3 rounded-lg bg-white/[0.05] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30"
                    />
                  ) : (
                    <select
                      value={destinationPlaylistId}
                      onChange={(e) => setDestinationPlaylistId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-[#1a1a20] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30"
                    >
                      {playlists.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name} ({pl.tracks.length})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <label className="sm:col-span-2 flex items-center gap-2 text-xs text-white/65 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={includeUnavailable}
                    onChange={(e) => setIncludeUnavailable(e.target.checked)}
                    className="rounded border-white/25 bg-white/10"
                  />
                  Preserve unmatched tracks in playlist with unavailable status
                </label>
              </div>

              {/* Progress bar & stats */}
              {(phase === 'importing' ||
                phase === 'completed' ||
                phase === 'cancelled' ||
                phase === 'paused') && (
                <div className="space-y-2 p-4 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-white">
                      {phase === 'importing'
                        ? `Matching tracks (${progress.processed}/${progress.total})...`
                        : phase === 'completed'
                          ? 'Import matching complete'
                          : phase === 'cancelled'
                            ? 'Import cancelled (partial progress saved)'
                            : 'Import paused'}
                    </span>
                    <span className="text-white/60">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-white transition-all duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-white/65 pt-1">
                    <span className="text-emerald-300">Matched: {progress.matched}</span>
                    <span className="text-amber-300">Unavailable: {progress.unavailable}</span>
                    <span className="text-sky-300">Duplicates: {progress.duplicates}</span>
                  </div>
                </div>
              )}

              {/* Manual replacement inline panel */}
              {replacingIndex !== null && (
                <div className="p-4 rounded-xl bg-white/[0.06] border border-white/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">
                      Replace track #{replacingIndex + 1}: {entries[replacingIndex]?.source.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplacingIndex(null)}
                      className="text-xs text-white/50 hover:text-white cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void runManualSearch();
                      }}
                      placeholder="Search replacement track..."
                      className="flex-1 h-9 px-3 rounded-lg bg-black/30 border border-white/12 text-xs text-white focus:outline-none"
                    />
                    <Button size="sm" onClick={() => void runManualSearch()} disabled={manualSearching}>
                      <Search className="w-3.5 h-3.5" />
                      {manualSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {manualResults.map((cand) => (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => {
                          replaceTrackMatch(replacingIndex, cand);
                          setReplacingIndex(null);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-left text-xs cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-white truncate">{cand.title}</p>
                          <p className="text-white/50 truncate">
                            {cand.artist} · {cand.provider}
                          </p>
                        </div>
                        <span className="text-emerald-300 shrink-0 ml-2">Select</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Track list */}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] max-h-64 overflow-y-auto divide-y divide-white/[0.05]">
                {entries.map((entry, idx) => (
                  <div
                    key={`${entry.source.originalIndex}-${entry.source.title}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-right text-white/35 tabular-nums shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">
                          {entry.matchedTrack && entry.status === 'matched'
                            ? entry.matchedTrack.title
                            : entry.source.title}
                        </p>
                        <p className="text-white/45 truncate">
                          {entry.matchedTrack && entry.status === 'matched'
                            ? `${entry.matchedTrack.artist} · ${entry.matchedTrack.provider ?? 'catalog'}`
                            : entry.source.artist}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {entry.status === 'matched' && (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Matched
                        </span>
                      )}
                      {entry.status === 'matching' && (
                        <span className="inline-flex items-center gap-1 text-white/70">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Matching
                        </span>
                      )}
                      {entry.status === 'unavailable' && (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <XCircle className="w-3.5 h-3.5" />
                          Unavailable
                        </span>
                      )}
                      {entry.status === 'duplicate' && (
                        <span className="text-sky-300">Duplicate</span>
                      )}
                      {entry.status === 'pending' && (
                        <span className="text-white/35">Pending</span>
                      )}

                      {(entry.status === 'matched' || entry.status === 'unavailable') && (
                        <button
                          type="button"
                          onClick={() =>
                            openManualReplace(
                              idx,
                              `${entry.source.title} ${entry.source.artist}`,
                              entry.candidates
                            )
                          }
                          title="Manually replace track"
                          className="p-1 rounded-md text-white/45 hover:text-white hover:bg-white/10 cursor-pointer"
                        >
                          <Replace className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.08] bg-white/[0.02]">
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>

          <div className="flex items-center gap-2.5">
            {phase === 'preview' && (
              <Button variant="primary" onClick={() => void startImport()}>
                <Sparkles className="w-4 h-4" />
                Start Import
              </Button>
            )}

            {phase === 'importing' && (
              <Button variant="secondary" onClick={cancelImport}>
                Cancel Import
              </Button>
            )}

            {(phase === 'paused' || phase === 'cancelled') && (
              <Button variant="secondary" onClick={() => void startImport()}>
                Resume Import
              </Button>
            )}

            {progress.unavailable > 0 && phase !== 'importing' && (
              <Button variant="secondary" onClick={() => void retryUnmatched()}>
                <RefreshCw className="w-4 h-4" />
                Retry Unmatched ({progress.unavailable})
              </Button>
            )}

            {(phase === 'completed' || phase === 'cancelled' || phase === 'paused') &&
              (progress.matched > 0 || (includeUnavailable && progress.unavailable > 0)) && (
                <Button
                  variant="primary"
                  onClick={() => {
                    void saveToLibrary().then((id) => {
                      if (id) closeDialog();
                    });
                  }}
                >
                  {lastSavedPlaylistId ? 'Saved!' : 'Save Playlist to Library'}
                </Button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportDialog;
