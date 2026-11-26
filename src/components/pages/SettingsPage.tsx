import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Cpu,
  Globe,
  Info,
  Palette,
  RefreshCw,
  ShieldAlert,
  Type,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import type { AudioQualityPreference } from '@/services/music/types';
import { useProviderStore } from '@/stores/providerStore';
import { useTransitionStore } from '@/stores/transitionStore';
import { useRecommendationStore } from '@/stores/recommendationStore';
import {
  exportBackupFile,
  getLastBackupMeta,
  parseAndValidateBackup,
  restoreBackupPayload,
  type NocturneBackupPayload,
} from '@/services/backup/backupService';
import {
  useStudioStore,
  type FpsLimit,
  type GraphicsQuality,
} from '@/stores/studioStore';
import { useUIStore, type BackgroundMode } from '@/stores/uiStore';


const QUALITY_OPTIONS: { value: AudioQualityPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'lossless', label: 'Lossless' },
];

export function SettingsPage() {
  const backgroundMode = useUIStore((s) => s.backgroundMode);
  const setBackgroundMode = useUIStore((s) => s.setBackgroundMode);
  const graphicsQuality = useStudioStore((s) => s.graphicsQuality);
  const setGraphicsQuality = useStudioStore((s) => s.setGraphicsQuality);
  const fpsLimit = useStudioStore((s) => s.fpsLimit);
  const setFpsLimit = useStudioStore((s) => s.setFpsLimit);

  const enabledProviders = useProviderStore((s) => s.enabledProviders);
  const preferredQuality = useProviderStore((s) => s.preferredQuality);
  const autoFallback = useProviderStore((s) => s.autoFallback);
  const searchAllProviders = useProviderStore((s) => s.searchAllProviders);
  const health = useProviderStore((s) => s.health);
  const setProviderEnabled = useProviderStore((s) => s.setProviderEnabled);
  const setPreferredQuality = useProviderStore((s) => s.setPreferredQuality);
  const crossfadeEnabled = useTransitionStore((s) => s.crossfadeEnabled);
  const setCrossfadeEnabled = useTransitionStore((s) => s.setCrossfadeEnabled);
  const crossfadeDurationSec = useTransitionStore((s) => s.crossfadeDurationSec);
  const setCrossfadeDurationSec = useTransitionStore((s) => s.setCrossfadeDurationSec);
  const gaplessEnabled = useTransitionStore((s) => s.gaplessEnabled);
  const setGaplessEnabled = useTransitionStore((s) => s.setGaplessEnabled);
  const preserveAlbumGapless = useTransitionStore((s) => s.preserveAlbumGapless);
  const setPreserveAlbumGapless = useTransitionStore((s) => s.setPreserveAlbumGapless);
  const autoplayEnabled = useRecommendationStore((s) => s.autoplayEnabled);
  const setAutoplayEnabled = useRecommendationStore((s) => s.setAutoplayEnabled);
  const [backupMeta, setBackupMeta] = useState(() => getLastBackupMeta());
  const [pendingBackup, setPendingBackup] = useState<NocturneBackupPayload | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('Up to date (v0.1.0)');
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch('https://api.github.com/repos/Akhil-cit/Nocturne/releases/latest');
      if (!res.ok) {
        setUpdateStatus('No published releases found yet.');
        return;
      }
      const data = (await res.json()) as { tag_name?: string; html_url?: string };
      const latest = data.tag_name ?? 'unknown';
      setUpdateStatus(latest === 'v0.1.0' ? 'Up to date (v0.1.0)' : `Update available: ${latest}`);
    } catch {
      setUpdateStatus('Unable to check for updates (offline).');
    } finally {
      setCheckingUpdate(false);
    }
  };
  const setAutoFallback = useProviderStore((s) => s.setAutoFallback);
  const setSearchAllProviders = useProviderStore((s) => s.setSearchAllProviders);
  const refreshHealth = useProviderStore((s) => s.refreshHealth);
  const clearSearchCache = useProviderStore((s) => s.clearSearchCache);
  const hydrateProviders = useProviderStore((s) => s.hydrate);

  const setPriority = useProviderStore((s) => s.setProviderPriority);
  const discovery = useProviderStore((s) => s.preferredDiscovery);
  const setDiscovery = useProviderStore((s) => s.setPreferredDiscovery);
  const lyricsSource = useProviderStore((s) => s.lyricsSource);
  const setLyricsSource = useProviderStore((s) => s.setLyricsSource);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    void hydrateProviders();
    refreshHealth();
  }, [hydrateProviders, refreshHealth]);

  return (
    <div className="min-h-full px-8 py-8 max-w-3xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="text-sm text-white/45 mt-1">
          Configure audio, visual atmosphere, and lyrics synchronization.
        </p>
      </motion.div>

      {/* Music Sources */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-medium text-white">
            <Globe className="w-4 h-4 text-white/70" />
            Music Sources
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearSearchCache();
              setCacheCleared(true);
              setTimeout(() => setCacheCleared(false), 1500);
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {cacheCleared ? 'Cache Cleared' : 'Clear Search Cache'}
          </Button>
        </div>

        <div className="space-y-2.5">
          {health.map((provider, i) => {
            const isEnabled = enabledProviders[provider.id] ?? provider.enabled;
            const statusColor =
              provider.status === 'healthy'
                ? 'bg-emerald-400'
                : provider.status === 'degraded'
                ? 'bg-amber-400'
                : provider.status === 'offline'
                ? 'bg-red-400'
                : 'bg-white/35';

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                    <span className="text-sm text-white/90 font-medium">
                      {provider.name}
                    </span>
                    <span className="text-[11px] text-white/40 capitalize">
                      ({provider.status})
                    </span>
                  </div>
                  {provider.lastError && (
                    <p className="text-[11px] text-amber-300/80 truncate mt-0.5">
                      {provider.lastError}
                    </p>
                  )}
                </div>

                <select
                  aria-label={`Priority for ${provider.name}`}
                  value={i + 1}
                  onChange={(e) => setPriority(provider.id, Number(e.target.value))}
                  className="ml-auto rounded bg-[#141414] p-1 text-xs"
                >
                  {health.map((_, index) => <option key={index} value={index + 1}>Priority {index + 1}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setProviderEnabled(provider.id, !isEnabled)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                    isEnabled
                      ? 'bg-white text-[#0a0a0a] font-medium'
                      : 'bg-white/[0.06] text-white/60'
                  }`}
                >
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white/85">Preferred Quality</p>
            <p className="text-xs text-white/45">
              Use the closest available full recording
            </p>
          </div>
          <select
            value={preferredQuality}
            onChange={(e) =>
              setPreferredQuality(e.target.value as AudioQualityPreference)
            }
            aria-label="Preferred provider audio quality"
            className="h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>

        {/* Playback Transitions */}
        <div className="space-y-4 pt-3 border-t border-white/[0.06]">
          <p className="text-xs font-medium uppercase tracking-wider text-white/45">
            Playback Transitions
          </p>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/85">Crossfade</p>
              <p className="text-xs text-white/45">
                Smoothly blend the end of one track into the next
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-crossfade"
              onClick={() => setCrossfadeEnabled(!crossfadeEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                crossfadeEnabled
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.06] text-white/60 hover:text-white'
              }`}
            >
              {crossfadeEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {crossfadeEnabled && (
            <div className="flex items-center justify-between gap-4 pl-2">
              <span className="text-xs text-white/70">
                Duration: <strong className="text-white tabular-nums">{crossfadeDurationSec}s</strong>
              </span>
              <input
                type="range"
                min={0}
                max={12}
                step={1}
                value={crossfadeDurationSec}
                onChange={(e) => setCrossfadeDurationSec(Number(e.target.value))}
                className="w-44 accent-white cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/85">Gapless Playback</p>
              <p className="text-xs text-white/45">
                Preload the next track for seamless transitions
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-gapless"
              onClick={() => setGaplessEnabled(!gaplessEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                gaplessEnabled
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.06] text-white/60 hover:text-white'
              }`}
            >
              {gaplessEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/85">Preserve Album Transitions</p>
              <p className="text-xs text-white/45">
                Prioritize gapless playback for consecutive tracks on the same album
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreserveAlbumGapless(!preserveAlbumGapless)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                preserveAlbumGapless
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.06] text-white/60 hover:text-white'
              }`}
            >
              {preserveAlbumGapless ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/85">Autoplay</p>
              <p className="text-xs text-white/45">
                Keep playing similar tracks when your queue ends
              </p>
            </div>
            <button
              type="button"
              data-testid="toggle-autoplay"
              onClick={() => setAutoplayEnabled(!autoplayEnabled)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                autoplayEnabled
                  ? 'bg-white text-[#0a0a0a]'
                  : 'bg-white/[0.06] text-white/60 hover:text-white'
              }`}
            >
              {autoplayEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        {/* Backup & Restore */}
        <div className="space-y-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                Backup & Restore
              </p>
              <p className="text-xs text-white/45 mt-1">
                {backupMeta
                  ? `Last backup: ${new Date(backupMeta.createdAt).toLocaleString()} (${Math.round(backupMeta.sizeBytes / 1024)} KB)`
                  : 'Export your playlists, liked songs, and settings locally (.nocturne-backup)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="create-backup-btn"
                onClick={() => {
                  const meta = exportBackupFile();
                  setBackupMeta(meta);
                  setBackupStatus('Backup exported successfully.');
                }}
                className="px-3 py-1.5 rounded-xl bg-white text-[#0a0a0a] text-xs font-medium cursor-pointer"
              >
                Create Backup
              </button>
              <label className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/15 text-xs text-white cursor-pointer">
                Restore
                <input
                  type="file"
                  accept=".nocturne-backup,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void file.text().then((txt) => {
                      try {
                        setPendingBackup(parseAndValidateBackup(txt));
                        setBackupStatus(null);
                      } catch (err) {
                        setBackupStatus(err instanceof Error ? err.message : 'Invalid backup file.');
                      }
                    });
                  }}
                />
              </label>
            </div>
          </div>

          {pendingBackup && (
            <div className="p-3 rounded-xl bg-white/[0.05] border border-white/12 space-y-2 text-xs">
              <p className="text-white font-medium">
                Backup from {new Date(pendingBackup.createdAt).toLocaleDateString()} ·{' '}
                {pendingBackup.library.playlists.length} playlists ·{' '}
                {pendingBackup.library.favorites.length} liked songs
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    restoreBackupPayload(pendingBackup, 'merge');
                    setPendingBackup(null);
                    setBackupStatus('Backup merged with your library.');
                  }}
                  className="px-3 py-1 rounded-lg bg-white text-[#0a0a0a] font-medium cursor-pointer"
                >
                  Merge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    restoreBackupPayload(pendingBackup, 'replace');
                    setPendingBackup(null);
                    setBackupStatus('Library replaced from backup.');
                  }}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-200 font-medium cursor-pointer"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBackup(null)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-white/70 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {backupStatus && <p className="text-xs text-emerald-300">{backupStatus}</p>}
        </div>

        {/* About & Updates */}
        <div className="space-y-2 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                About & Updates
              </p>
              <p className="text-xs text-white/60 mt-1">{updateStatus}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="check-updates-btn"
                disabled={checkingUpdate}
                onClick={() => void handleCheckUpdates()}
                className="px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/15 text-xs text-white cursor-pointer disabled:opacity-50"
              >
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </button>
              <button
                type="button"
                onClick={() => void window.electronAPI?.openExternal('https://github.com/Akhil-cit/Nocturne/releases')}
                className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/12 text-xs text-white/75 cursor-pointer"
              >
                GitHub Releases
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white/85">Auto-Fallback</p>
            <p className="text-xs text-white/45">
              Automatically try alternate matched sources if primary stream fails
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoFallback(!autoFallback)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
              autoFallback
                ? 'bg-white text-[#0a0a0a] font-medium'
                : 'bg-white/[0.06] text-white/60'
            }`}
          >
            {autoFallback ? 'On' : 'Off'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white/85">Search All Providers</p>
            <p className="text-xs text-white/45">
              Search every enabled source, or choose one below
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchAllProviders(!searchAllProviders)}
            className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
              searchAllProviders
                ? 'bg-white text-[#0a0a0a] font-medium'
                : 'bg-white/[0.06] text-white/60'
            }`}
          >
            {searchAllProviders ? 'On' : 'Off'}
          </button>
        </div>
        {!searchAllProviders && (
          <label className="flex items-center justify-between gap-4 text-sm">
            Preferred discovery source
            <select aria-label="Preferred discovery source" className="rounded bg-[#141414] p-2"
              value={enabledProviders[discovery] ? discovery : health.find((p) => p.enabled)?.id ?? ''}
              onChange={(e) => setDiscovery(e.target.value)}>
              {health.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
      </section>

      {/* Appearance */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white">
          <Palette className="w-4 h-4 text-white/70" />
          Appearance
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/85">Theme</p>
            <p className="text-xs text-white/45">Obsidian dark interface</p>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-xs text-white/80">
            Obsidian
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white/85">Now Playing Background</p>
            <p className="text-xs text-white/45">
              Ambient backdrop style behind constellation lyrics
            </p>
          </div>
          <select
            value={backgroundMode}
            onChange={(e) => setBackgroundMode(e.target.value as BackgroundMode)}
            aria-label="Now Playing background"
            className="h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="starfield">Starfield</option>
            <option value="album-blur">Album Blur</option>
            <option value="solid">Solid Obsidian</option>
          </select>
        </div>
      </section>

      {/* Lyrics */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white">
          <Type className="w-4 h-4 text-white/70" />
          Lyrics
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/85">Lyrics Source</p>
            <p className="text-xs text-white/45">
              Provider used for synchronized lyrics lookup
            </p>
          </div>
          <select
            value={lyricsSource}
            onChange={(e) => setLyricsSource(e.target.value as 'lrclib' | 'local')}
            aria-label="Lyrics source"
            className="h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="lrclib">Local LRC, then LRCLIB</option>
            <option value="local">Local .lrc only</option>
          </select>
        </div>

        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/85">Timing Offset</p>
              <p className="text-xs text-white/45">
                Adjust lyric synchronization ({lyricsOffsetMs > 0 ? `+${lyricsOffsetMs}` : lyricsOffsetMs} ms)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLyricsOffsetMs(0)}
              className="text-xs text-white/50 hover:text-white cursor-pointer"
            >
              Reset
            </button>
          </div>
          <Slider
            value={lyricsOffsetMs}
            min={-2000}
            max={2000}
            step={50}
            ariaLabel="Lyrics timing offset"
            onChange={(val) => setLyricsOffsetMs(Math.round(val))}
          />
        </div>
      </section>

      {/* Performance */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white">
          <Cpu className="w-4 h-4 text-white/70" />
          Performance
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/85">Graphics Quality</p>
            <p className="text-xs text-white/45">
              Controls starfield density and glow shader intensity
            </p>
          </div>
          <select
            value={graphicsQuality}
            onChange={(e) => setGraphicsQuality(e.target.value as GraphicsQuality)}
            aria-label="Graphics quality"
            className="h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value="high">High (60+ FPS)</option>
            <option value="medium">Medium</option>
            <option value="low">Low Power</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm text-white/85">FPS Limit</p>
            <p className="text-xs text-white/45">
              Target frame rate cap for canvas visualizations
            </p>
          </div>
          <select
            value={fpsLimit}
            onChange={(e) => setFpsLimit(Number(e.target.value) as FpsLimit)}
            aria-label="FPS limit"
            className="h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer"
          >
            <option value={30}>30 FPS</option>
            <option value={60}>60 FPS</option>
            <option value={120}>120 FPS</option>
          </select>
        </div>
      </section>

      {/* Desktop Overlay & Windows Architecture Notes */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-3">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white">
          <ShieldAlert className="w-4 h-4 text-white/70" />
          Desktop Overlay &amp; Wallpaper Mode Notes
        </div>
        <div className="text-xs text-white/60 space-y-2 leading-relaxed">
          <p>
            <strong className="text-white/85">Click-Through Recovery:</strong> Press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-white/90 font-mono text-[11px]">
              Ctrl+Shift+O
            </kbd>{' '}
            at any time to exit click-through mode and reposition or resize the Desktop Edge Overlay.
          </p>
          <p>
            <strong className="text-white/85">Desktop Wallpaper Mode Feasibility:</strong>{' '}
            Windows 10/11 desktop embedding requires attaching a native HWND behind{' '}
            <code className="text-white/75">Progman</code> / <code className="text-white/75">WorkerW</code>{' '}
            via Win32 calls, which can be fragile across Windows shell updates and Explorer restarts.
            To preserve system stability without native DLL injection, Nocturne provides a safe{' '}
            <strong className="text-white/80">Transparent Desktop Overlay</strong> and{' '}
            <strong className="text-white/80">Immersive Fullscreen Mode</strong> instead.
          </p>
        </div>
      </section>

      {/* About */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-3">
        <div className="flex items-center gap-2.5 text-sm font-medium text-white">
          <Info className="w-4 h-4 text-white/70" />
          About
        </div>
        <div className="text-xs text-white/55 space-y-1.5 leading-relaxed">
          <p className="text-sm text-white/85 font-medium">Nocturne v0.1.0</p>
          <p>
            Immersive desktop music player &amp; constellation lyrics visualization engine.
          </p>
          <p className="text-white/40 pt-1">
            Music provider architecture inspired by Monochrome (Apache 2.0 License).
          </p>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;
