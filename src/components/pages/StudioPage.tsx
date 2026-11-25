import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bookmark,
  Check,
  Copy,
  Download,
  Image,
  Layers,
  Monitor,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Slider from '@/components/ui/Slider';
import LyricsStage from '@/components/visualization/LyricsStage';
import { EdgeLightingOverlay } from '@/components/lighting/EdgeLightingOverlay';
import {
  useLightingStore,
  type EdgeLightingMode,
  type EdgeLightingPreset,
} from '@/stores/lightingStore';
import { usePresetStore } from '@/stores/presetStore';
import { useStudioStore, type GraphicsQuality } from '@/stores/studioStore';
import {
  useUIStore,
  type BackgroundMode,
  type VisualizationMode,
} from '@/stores/uiStore';

const LYRIC_MODES: { id: VisualizationMode; label: string }[] = [
  { id: 'constellation', label: 'Constellation' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'floating', label: 'Floating' },
  { id: 'karaoke', label: 'Karaoke' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'particle', label: 'Particle' },
  { id: 'wave', label: 'Wave' },
];

const BACKGROUND_MODES: { id: BackgroundMode; label: string }[] = [
  { id: 'starfield', label: 'Starfield' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'fluid', label: 'Fluid' },
  { id: 'clouds', label: 'Clouds' },
  { id: 'fog', label: 'Fog' },
  { id: 'particles', label: 'Particles' },
  { id: 'waves', label: 'Waves' },
  { id: 'album-blur', label: 'Album Blur' },
  { id: 'custom-image', label: 'Custom Image' },
  { id: 'custom-video', label: 'Custom Video' },
  { id: 'black', label: 'Pure Black' },
];

const EDGE_MODES: { id: EdgeLightingMode; label: string }[] = [
  { id: 'beat', label: 'Beat' },
  { id: 'ambient', label: 'Ambient' },
  { id: 'breathing', label: 'Breathing' },
  { id: 'gradient', label: 'Gradient' },
];

const EDGE_PRESETS: { id: EdgeLightingPreset; label: string }[] = [
  { id: 'aurora', label: 'Aurora' },
  { id: 'ember', label: 'Ember' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'spectrum', label: 'Spectrum' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'album-aura', label: 'Album Aura' },
];

interface DisplayOption {
  id: number;
  index: number;
  label: string;
  primary: boolean;
}

const FONT_OPTIONS = [
  {
    label: 'Inter (Default)',
    value: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { label: 'Serif Editorial', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: '"JetBrains Mono", ui-monospace, monospace' },
];

export function StudioPage() {
  const visualizationMode = useUIStore((s) => s.visualizationMode);
  const setVisualizationMode = useUIStore((s) => s.setVisualizationMode);
  const backgroundMode = useUIStore((s) => s.backgroundMode);
  const setBackgroundMode = useUIStore((s) => s.setBackgroundMode);

  const starSize = useStudioStore((s) => s.starSize);
  const lineOpacity = useStudioStore((s) => s.lineOpacity);
  const animationSpeed = useStudioStore((s) => s.animationSpeed);
  const cameraMovement = useStudioStore((s) => s.cameraMovement);
  const glowIntensity = useStudioStore((s) => s.glowIntensity);
  const audioResponsiveness = useStudioStore((s) => s.audioResponsiveness);
  const fontFamily = useStudioStore((s) => s.fontFamily);
  const customBgUrl = useStudioStore((s) => s.customBgUrl);
  const bgBlur = useStudioStore((s) => s.bgBlur);
  const bgBrightness = useStudioStore((s) => s.bgBrightness);
  const bgSaturation = useStudioStore((s) => s.bgSaturation);
  const graphicsQuality = useStudioStore((s) => s.graphicsQuality);
  const batterySaver = useStudioStore((s) => s.batterySaver);

  const setStarSize = useStudioStore((s) => s.setStarSize);
  const setLineOpacity = useStudioStore((s) => s.setLineOpacity);
  const setAnimationSpeed = useStudioStore((s) => s.setAnimationSpeed);
  const setCameraMovement = useStudioStore((s) => s.setCameraMovement);
  const setGlowIntensity = useStudioStore((s) => s.setGlowIntensity);
  const setAudioResponsiveness = useStudioStore((s) => s.setAudioResponsiveness);
  const setFontFamily = useStudioStore((s) => s.setFontFamily);
  const setCustomBgUrl = useStudioStore((s) => s.setCustomBgUrl);
  const setBgBlur = useStudioStore((s) => s.setBgBlur);
  const setBgBrightness = useStudioStore((s) => s.setBgBrightness);
  const setBgSaturation = useStudioStore((s) => s.setBgSaturation);
  const setGraphicsQuality = useStudioStore((s) => s.setGraphicsQuality);
  const setBatterySaver = useStudioStore((s) => s.setBatterySaver);
  const resetDefaults = useStudioStore((s) => s.resetDefaults);

  const edgeLightingEnabled = useLightingStore((s) => s.edgeLightingEnabled);
  const edgeMode = useLightingStore((s) => s.edgeMode);
  const edgePreset = useLightingStore((s) => s.edgePreset);
  const edgeThickness = useLightingStore((s) => s.edgeThickness);
  const edgeGlowStrength = useLightingStore((s) => s.edgeGlowStrength);
  const edgeSensitivity = useLightingStore((s) => s.edgeSensitivity);
  const edgeSpeed = useLightingStore((s) => s.edgeSpeed);
  const autoAlbumColors = useLightingStore((s) => s.autoAlbumColors);
  const customPalette = useLightingStore((s) => s.customPalette);
  const desktopOverlayEnabled = useLightingStore((s) => s.desktopOverlayEnabled);
  const overlayOpacity = useLightingStore((s) => s.overlayOpacity);
  const overlayClickThrough = useLightingStore((s) => s.overlayClickThrough);
  const overlayMonitorIndex = useLightingStore((s) => s.overlayMonitorIndex);

  const setEdgeLightingEnabled = useLightingStore((s) => s.setEdgeLightingEnabled);
  const setEdgeMode = useLightingStore((s) => s.setEdgeMode);
  const applyEdgePreset = useLightingStore((s) => s.applyEdgePreset);
  const setEdgeThickness = useLightingStore((s) => s.setEdgeThickness);
  const setEdgeGlowStrength = useLightingStore((s) => s.setEdgeGlowStrength);
  const setEdgeSensitivity = useLightingStore((s) => s.setEdgeSensitivity);
  const setEdgeSpeed = useLightingStore((s) => s.setEdgeSpeed);
  const setAutoAlbumColors = useLightingStore((s) => s.setAutoAlbumColors);
  const setDesktopOverlayEnabled = useLightingStore(
    (s) => s.setDesktopOverlayEnabled
  );
  const setOverlayOpacity = useLightingStore((s) => s.setOverlayOpacity);
  const setOverlayClickThrough = useLightingStore((s) => s.setOverlayClickThrough);
  const setOverlayMonitorIndex = useLightingStore((s) => s.setOverlayMonitorIndex);

  const presets = usePresetStore((s) => s.presets);
  const activePresetId = usePresetStore((s) => s.activePresetId);
  const applyPreset = usePresetStore((s) => s.applyPreset);
  const createPreset = usePresetStore((s) => s.createPreset);
  const duplicatePreset = usePresetStore((s) => s.duplicatePreset);
  const deletePreset = usePresetStore((s) => s.deletePreset);
  const exportPreset = usePresetStore((s) => s.exportPreset);
  const importPreset = usePresetStore((s) => s.importPreset);
  const hydratePresets = usePresetStore((s) => s.hydrate);

  const [newPresetName, setNewPresetName] = useState('');
  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [displays, setDisplays] = useState<DisplayOption[]>([]);

  useEffect(() => {
    void hydratePresets();
    window.electronAPI
      ?.getDisplays?.()
      .then((list) => {
        if (Array.isArray(list)) setDisplays(list);
      })
      .catch(() => {});
  }, [hydratePresets]);

  const handleToggleDesktopOverlay = async () => {
    const next = !desktopOverlayEnabled;
    setDesktopOverlayEnabled(next);
    try {
      await window.electronAPI?.toggleOverlay?.(next, {
        opacity: overlayOpacity,
        clickThrough: overlayClickThrough,
        monitorIndex: overlayMonitorIndex,
      });
    } catch {
      // ignore if outside Electron
    }
  };

  const handleSavePreset = () => {
    const trimmed = newPresetName.trim();
    if (!trimmed) return;
    createPreset(trimmed);
    setNewPresetName('');
  };

  const handleExportPreset = async (id: string) => {
    const json = exportPreset(id);
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setImportJson(json);
      setShowImport(true);
    }
  };

  const handleImportPreset = () => {
    const ok = importPreset(importJson);
    setImportStatus(ok ? 'Preset imported.' : 'Invalid preset JSON.');
    if (ok) {
      setImportJson('');
      setTimeout(() => {
        setShowImport(false);
        setImportStatus(null);
      }, 1000);
    }
  };

  return (
    <div className="min-h-full px-8 py-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Visualization Studio
          </h1>
          <p className="text-sm text-white/45 mt-1">
            Customize lyric constellations, ambient backgrounds, and edge lighting in real time.
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={resetDefaults}>
          <RotateCcw className="w-3.5 h-3.5" />
          Reset defaults
        </Button>
      </motion.div>

      {/* Live Preview */}
      <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-white/10 bg-[#050507] shadow-2xl shadow-black/60">
        <LyricsStage />
        {edgeLightingEnabled && (
          <EdgeLightingOverlay
            mode={edgeMode}
            thickness={edgeThickness}
            glowStrength={edgeGlowStrength}
            autoExtractAlbumColors={autoAlbumColors}
            palette={customPalette}
          />
        )}
        <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[11px] uppercase tracking-wider text-white/60">
          Live Preview
        </div>
      </div>

      {/* Presets Manager */}
      <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Bookmark className="w-4 h-4 text-white/70" />
            Presets
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
              }}
              placeholder="Save current as..."
              className="h-8 px-3 rounded-lg bg-[#141414] border border-white/12 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/30"
            />
            <Button variant="secondary" size="sm" onClick={handleSavePreset}>
              <Plus className="w-3.5 h-3.5" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImport((v) => !v)}
            >
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </Button>
          </div>
        </div>

        {showImport && (
          <div className="space-y-2 p-3 rounded-xl bg-black/30 border border-white/10">
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              rows={3}
              placeholder="Paste exported preset JSON..."
              className="w-full p-2.5 rounded-lg bg-[#141414] border border-white/12 text-xs text-white placeholder:text-white/30 focus:outline-none font-mono"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/55">{importStatus ?? ''}</span>
              <Button size="sm" onClick={handleImportPreset}>
                Apply Imported Preset
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {presets.map((preset) => {
            const isActive = preset.id === activePresetId;
            return (
              <div
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/15 border-white/35 text-white'
                    : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/[0.08] text-white/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium truncate">{preset.name}</p>
                  {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                </div>
                <p className="text-[10px] text-white/45 capitalize mt-0.5 truncate">
                  {preset.visualizationMode} · {preset.backgroundMode}
                </p>

                <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicatePreset(preset.id);
                    }}
                    title="Duplicate preset"
                    className="p-1 rounded hover:bg-white/15 text-white/60 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleExportPreset(preset.id);
                    }}
                    title="Copy JSON"
                    className="p-1 rounded hover:bg-white/15 text-white/60 hover:text-white cursor-pointer"
                  >
                    {copiedId === preset.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                  </button>
                  {!preset.builtIn && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePreset(preset.id);
                      }}
                      title="Delete preset"
                      className="p-1 rounded hover:bg-white/15 text-white/60 hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lyrics Mode */}
        <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Sparkles className="w-4 h-4 text-white/70" />
            Lyrics Mode
          </div>
          <div className="flex flex-wrap gap-2">
            {LYRIC_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setVisualizationMode(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                  visualizationMode === m.id
                    ? 'bg-white text-[#0a0a0a] font-medium'
                    : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/12'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-4">
            <span className="text-xs text-white/70">Typography</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              aria-label="Lyrics font family"
              className="h-8 px-2.5 rounded-lg bg-[#141414] border border-white/12 text-xs text-white focus:outline-none cursor-pointer"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Background Mode */}
        <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Layers className="w-4 h-4 text-white/70" />
            Background Engine
          </div>
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_MODES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackgroundMode(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                  backgroundMode === b.id
                    ? 'bg-white text-[#0a0a0a] font-medium'
                    : 'bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/12'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {(backgroundMode === 'custom-image' ||
            backgroundMode === 'custom-video') && (
            <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs text-white/65">
                <Image className="w-3.5 h-3.5" />
                Custom Media URL
              </label>
              <input
                type="text"
                value={customBgUrl}
                onChange={(e) => setCustomBgUrl(e.target.value)}
                placeholder="https://... or file:///..."
                className="w-full h-9 px-3 rounded-xl bg-[#141414] border border-white/12 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
              />
            </div>
          )}
        </section>

        {/* Constellation & Motion Parameters */}
        <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Sliders className="w-4 h-4 text-white/70" />
            Motion &amp; Visual Parameters
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Star Size</span>
                <span className="tabular-nums">{starSize.toFixed(1)}</span>
              </div>
              <Slider
                value={starSize}
                min={2}
                max={16}
                step={0.5}
                ariaLabel="Star size"
                onChange={setStarSize}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Constellation Line Opacity</span>
                <span className="tabular-nums">{Math.round(lineOpacity * 100)}%</span>
              </div>
              <Slider
                value={lineOpacity}
                min={0}
                max={0.8}
                step={0.02}
                ariaLabel="Line opacity"
                onChange={setLineOpacity}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Animation Speed</span>
                <span className="tabular-nums">{animationSpeed.toFixed(2)}x</span>
              </div>
              <Slider
                value={animationSpeed}
                min={0.25}
                max={2.5}
                step={0.05}
                ariaLabel="Animation speed"
                onChange={setAnimationSpeed}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Camera Movement</span>
                <span className="tabular-nums">{cameraMovement.toFixed(2)}x</span>
              </div>
              <Slider
                value={cameraMovement}
                min={0}
                max={2}
                step={0.05}
                ariaLabel="Camera movement"
                onChange={setCameraMovement}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Glow Intensity</span>
                <span className="tabular-nums">{glowIntensity.toFixed(2)}x</span>
              </div>
              <Slider
                value={glowIntensity}
                min={0}
                max={2}
                step={0.05}
                ariaLabel="Glow intensity"
                onChange={setGlowIntensity}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Audio Responsiveness</span>
                <span className="tabular-nums">
                  {Math.round(audioResponsiveness * 100)}%
                </span>
              </div>
              <Slider
                value={audioResponsiveness}
                min={0}
                max={1}
                step={0.05}
                ariaLabel="Audio responsiveness"
                onChange={setAudioResponsiveness}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/[0.06]">
              <div>
                <div className="flex justify-between text-[11px] text-white/60 mb-1">
                  <span>Bg Blur</span>
                  <span>{bgBlur}px</span>
                </div>
                <Slider
                  value={bgBlur}
                  min={0}
                  max={64}
                  step={2}
                  ariaLabel="Background blur"
                  onChange={setBgBlur}
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-white/60 mb-1">
                  <span>Brightness</span>
                  <span>{Math.round(bgBrightness * 100)}%</span>
                </div>
                <Slider
                  value={bgBrightness}
                  min={0.1}
                  max={1.2}
                  step={0.05}
                  ariaLabel="Background brightness"
                  onChange={setBgBrightness}
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-white/60 mb-1">
                  <span>Saturation</span>
                  <span>{bgSaturation.toFixed(1)}</span>
                </div>
                <Slider
                  value={bgSaturation}
                  min={0}
                  max={2}
                  step={0.1}
                  ariaLabel="Background saturation"
                  onChange={setBgSaturation}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span className="text-xs text-white/75">Graphics Quality</span>
              <div className="flex items-center gap-2">
                <select
                  value={graphicsQuality}
                  onChange={(e) =>
                    setGraphicsQuality(e.target.value as GraphicsQuality)
                  }
                  aria-label="Graphics quality"
                  className="h-8 px-2.5 rounded-lg bg-[#141414] border border-white/12 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <button
                  type="button"
                  onClick={() => setBatterySaver(!batterySaver)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    batterySaver
                      ? 'bg-white text-[#0a0a0a] font-medium'
                      : 'bg-white/[0.06] text-white/65 hover:text-white'
                  }`}
                >
                  Battery Saver
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Edge Lighting & Desktop Overlay */}
        <section className="rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Zap className="w-4 h-4 text-white/70" />
              Audio-Reactive Edge Lighting
            </div>
            <button
              type="button"
              onClick={() => setEdgeLightingEnabled(!edgeLightingEnabled)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                edgeLightingEnabled
                  ? 'bg-white text-[#0a0a0a] font-medium'
                  : 'bg-white/[0.06] text-white/60'
              }`}
            >
              {edgeLightingEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {EDGE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyEdgePreset(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                  edgePreset === p.id
                    ? 'bg-white text-[#0a0a0a] font-medium'
                    : 'bg-white/[0.06] text-white/65 hover:text-white hover:bg-white/12'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/[0.06]">
            {EDGE_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setEdgeMode(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                  edgeMode === m.id
                    ? 'bg-white/20 text-white font-medium'
                    : 'bg-white/[0.05] text-white/65 hover:text-white hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Edge Thickness</span>
                <span className="tabular-nums">{edgeThickness}px</span>
              </div>
              <Slider
                value={edgeThickness}
                min={8}
                max={100}
                step={2}
                ariaLabel="Edge thickness"
                onChange={setEdgeThickness}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>Glow Strength</span>
                <span className="tabular-nums">
                  {Math.round(edgeGlowStrength * 100)}%
                </span>
              </div>
              <Slider
                value={edgeGlowStrength}
                min={0}
                max={1}
                step={0.05}
                ariaLabel="Edge glow strength"
                onChange={setEdgeGlowStrength}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-white/65 mb-1">
                  <span>Sensitivity</span>
                  <span className="tabular-nums">{edgeSensitivity.toFixed(1)}x</span>
                </div>
                <Slider
                  value={edgeSensitivity}
                  min={0.2}
                  max={2}
                  step={0.1}
                  ariaLabel="Edge sensitivity"
                  onChange={setEdgeSensitivity}
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-white/65 mb-1">
                  <span>Speed</span>
                  <span className="tabular-nums">{edgeSpeed.toFixed(1)}x</span>
                </div>
                <Slider
                  value={edgeSpeed}
                  min={0.2}
                  max={2.5}
                  step={0.1}
                  ariaLabel="Edge speed"
                  onChange={setEdgeSpeed}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <div>
              <p className="text-xs text-white/85">Auto Album Palette</p>
              <p className="text-[11px] text-white/45">
                Extract accent colors from current cover art
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoAlbumColors(!autoAlbumColors)}
              className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                autoAlbumColors
                  ? 'bg-white text-[#0a0a0a] font-medium'
                  : 'bg-white/[0.06] text-white/60'
              }`}
            >
              {autoAlbumColors ? 'On' : 'Off'}
            </button>
          </div>

          <div className="pt-2 border-t border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-white/60" />
                <div>
                  <p className="text-xs text-white/85">Desktop Edge Overlay</p>
                  <p className="text-[11px] text-white/45">
                    Transparent border around your screen (Ctrl+Shift+O recovers click-through)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleToggleDesktopOverlay()}
                className={`px-3 py-1 rounded-lg text-xs transition-colors cursor-pointer ${
                  desktopOverlayEnabled
                    ? 'bg-white text-[#0a0a0a] font-medium'
                    : 'bg-white/[0.06] text-white/60 hover:text-white'
                }`}
              >
                {desktopOverlayEnabled ? 'Active' : 'Off'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-white/65 mb-1">
                  <span>Overlay Opacity</span>
                  <span className="tabular-nums">{Math.round(overlayOpacity * 100)}%</span>
                </div>
                <Slider
                  value={overlayOpacity}
                  min={0.1}
                  max={1}
                  step={0.05}
                  ariaLabel="Overlay opacity"
                  onChange={(val) => {
                    setOverlayOpacity(val);
                    void window.electronAPI?.setOverlayConfig?.({ opacity: val });
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/65">Click-Through</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !overlayClickThrough;
                    setOverlayClickThrough(next);
                    void window.electronAPI?.setOverlayConfig?.({ clickThrough: next });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                    overlayClickThrough
                      ? 'bg-white text-[#0a0a0a] font-medium'
                      : 'bg-white/[0.06] text-white/65'
                  }`}
                >
                  {overlayClickThrough ? 'On' : 'Off'}
                </button>
              </div>
            </div>

            {displays.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-white/65">Target Monitor</span>
                <select
                  value={overlayMonitorIndex}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setOverlayMonitorIndex(idx);
                    void window.electronAPI?.setOverlayConfig?.({ monitorIndex: idx });
                  }}
                  aria-label="Overlay monitor"
                  className="h-8 px-2.5 rounded-lg bg-[#141414] border border-white/12 text-xs text-white focus:outline-none cursor-pointer"
                >
                  {displays.map((d) => (
                    <option key={d.id} value={d.index}>
                      {d.label} {d.primary ? '(Primary)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default StudioPage;
