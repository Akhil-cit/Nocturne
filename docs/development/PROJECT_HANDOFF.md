# Nocturne — Project Handoff Document

> The Phase 2 narrative below is archival. Phase 11 recovery, provider changes and validation are tracked in CURRENT_STATE.md, TASKS.md, REFERENCE_COMPARISON.md and PROVIDER_TEST_REPORT.md.

---

## 1. Project Overview

### Original Project Objective
Build **Nocturne**, a fully functional, visually stunning, local-first, hardware-accelerated Windows 10/11 desktop music player and visualization engine inspired by **Verci**, **Needle**, and **Lumn**, using an existing local reference repository (**Monochrome** at `d:\Music\monochrome`) as the architectural reference for compatible, authorized music retrieval and playback.

### Complete Feature Requirements
1. **Music Player Core:**
   - Music search, streaming from supported/authorized sources, and local audio file playback (MP3, FLAC, WAV, OGG, AAC, M4A).
   - Play, pause, next, previous, seek bar, volume control, shuffle, repeat (off/all/one).
   - Playback queue, local playlists, recently played tracks, favourite songs.
   - Album artwork and song/artist/album metadata.
   - Keyboard shortcuts, Windows media key integration, and persistent local playback preferences.
2. **Constellation Lyrics Visualization (Primary Feature):**
   - Every word in the current lyric phrase becomes an individual 4-pointed star/node.
   - Thin glowing constellation lines connect nearby words.
   - Active word is larger, brighter, with a soft radial glow; upcoming words have subtle transparency; previously sung words gradually fade.
   - Gentle pulse and float animations, subtle camera drift/zoom, fluid phrase transitions, and anti-overlap word placement.
   - Spatial and organic aesthetic (not a generic network graph), matching the uploaded reference diagram.
3. **Lyric Synchronization Engine:**
   - Fetch synchronized lyrics via **LRCLIB** (using title, artist, album, duration).
   - Parse LRC and enhanced LRC formats (line-level and word-level timestamps).
   - Estimate word timings from line duration and word lengths when only line-level timestamps exist (distinguishing estimated vs. genuine word-level sync).
   - Handle pause, resume, seeking, track changes, local caching, manual LRC import, and graceful fallback when lyrics are unavailable.
4. **Additional Lyrics Modes (Modular):**
   - Constellation (primary), Cinematic, Floating (3D), Karaoke, Minimal, Orbit, Particle, Wave — all driven by the same playback and sync engine.
5. **Audio-Reactive Edge Lighting:**
   - Transparent Windows desktop overlay window inspired by Lumn.
   - Real-time FFT frequency reactivity (bass → pulse intensity, mid → movement/colour transitions, high → smaller highlights).
   - Smooth interpolation, configurable glow strength & border thickness, custom palettes, automatic album-art colour extraction, gradient/breathing/beat-reactive/ambient modes, click-through, and optional always-on-top.
6. **Immersive Desktop Mode:**
   - Fullscreen experience with live constellation lyrics, animated backgrounds, edge lighting, minimalist clock & date, subtle album art, song info, auto-hiding controls, and individual element visibility toggles.
   - Modes: Fullscreen, Transparent Overlay, Floating Lyrics Window, Normal Player, System Tray mode.
7. **Background Visualization Engine:**
   - Animated dark clouds, Nebula, Starfield, Fluid gradients, Aurora, Atmospheric fog, Audio-reactive particles, Abstract waves, Album-art blur, Custom images/videos, Pure black — with speed, blur, brightness, saturation, and audio-responsiveness controls.
8. **Main Application Pages:**
   - Home, Search, Now Playing, Visualization Studio, Settings.
9. **Packaging & Performance:**
   - Installable Windows desktop app via Electron Builder (NSIS).
   - 60 FPS target using `requestAnimationFrame`, visibility-based throttling, low/medium/high graphics presets, battery-saving mode, and proper resource disposal.

### Design Inspiration & Visual References
- **Visual References:** Verci, Needle, Lumn, Apple Music, Linear, and the user-uploaded reference image showing `NOW PLAYING / 22:18` above a constellation of words (`under`, `the`, `slowly`, `stars` [highlighted & glowing in center], `we`, `drift`, `away`) inside a softly glowing gradient screen border.
- **Aesthetic Rules:** Obsidian black (`#0a0a0a`) backgrounds, glass-like translucent panels, subtle borders, soft ambient glows, minimalist typography, Lucide icons (no emojis), restrained colour with album-dependent dynamic palettes, generous spacing.

### Technology Stack & Rationale
- **Electron (`^36.3.0`)**: Cross-platform desktop runtime with native Windows media keys, system tray, and transparent click-through overlay windows (`BrowserWindow`).
- **React (`^19.1.0`) + TypeScript (`^5.8.3`)**: Component-based UI with strict static typing.
- **Vite (`^6.3.5`) + `vite-plugin-electron` (`^0.30.0`)**: Fast HMR development and unified renderer/main/preload bundling.
- **Tailwind CSS v4 (`^4.1.8` + `@tailwindcss/vite`)**: Utility-first styling with CSS-native `@import "tailwindcss";` configuration.
- **Zustand (`^5.0.5`)**: Lightweight, minimal-boilerplate state management avoiding unnecessary React re-renders.
- **Motion (`^12.12.1`)**: Declarative UI transitions and micro-animations.
- **Lucide React (`^0.513.0`)**: Consistent, clean iconography.
- **Color Thief Browser (`^1.0.1`)**: Album-art colour palette extraction.
- **Canvas 2D / WebGL / Web Audio API**: Hardware-accelerated visualization and real-time FFT audio analysis.
- **LRCLIB**: Free, unauthenticated synchronized lyrics API.
- **Electron Builder (`^26.0.12`)**: Windows installer generation.

---

## 2. Current Development Status

### Implemented So Far (Scaffolded Skeleton)
- **Documentation:** `REPOSITORY_ANALYSIS.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` created in `d:\Music\nocturne\`.
- **Build & Config Files:** `package.json`, `tsconfig.json`, `vite.config.ts`, `electron-builder.yml`, `index.html`, `.gitignore`.
- **Electron Layer:**
  - `electron/main.ts` — Frameless `BrowserWindow` (1400×900, `#0a0a0a`), global media keys (`MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`, `MediaStop`), basic `Tray` setup, and window control IPC handlers (`window:minimize`, `window:maximize`, `window:close`, `window:isMaximized`).
  - `electron/preload.ts` — `contextBridge` exposing `window.electronAPI` (`minimize`, `maximize`, `close`, `isMaximized`, `onMaximizeChange`, `onMediaKey`, `platform`).
- **Frontend & Service Skeleton:**
  - React entry (`src/main.tsx`, `src/App.tsx`), Tailwind v4 styles (`src/styles/globals.css`), Electron type declarations (`src/types/electron.d.ts`).
  - Basic/stub components: `AppShell.tsx`, `Titlebar.tsx`, `Sidebar.tsx`, `PlayerBar.tsx`, `NowPlaying.tsx`, `HomePage.tsx`, `SearchPage.tsx`, `SettingsPage.tsx`, `Button.tsx`.
  - Basic/stub services & stores: `music/types.ts`, `music/provider.ts`, `playback/engine.ts`, `lyrics/lrclib.ts`, `lyrics/parser.ts`, `lyrics/sync.ts`, `audio/analyzer.ts`, `hooks/useAudioAnalyzer.ts`, `stores/playerStore.ts`, `stores/uiStore.ts`, `visualization/constellation/renderer.ts`.

### Fully Functional Features
- **Phase 1 Scaffolding & Typecheck:** `npm install` succeeded in `d:\Music\nocturne\` (with `color-thief-browser` adjusted to `^2.0.2` and `vite-plugin-electron` to `^1.2.0` to match npm registry versions) and `npx tsc --noEmit` passed with 0 errors.
- **Phase 2 Core Service Layer & Stores (`services-builder`):** Implemented and typechecked (`npx tsc --noEmit` 0 errors):
  - `src/services/music/types.ts` (`Track`, `Artist`, `Album`, `SearchResults`, `IMusicProvider`, `LyricLine`, `LyricWord`, `SyncedLyrics`, `RepeatMode`)
  - `src/services/music/provider.ts` (`MusicProviderManager` + `LocalFileProvider`)
  - `src/services/playback/engine.ts` (`PlaybackEngine` with HTML5 `Audio`, Web Audio `AudioContext` → `MediaElementSource` → `AnalyserNode` → `GainNode` → `destination`, queue, Fisher-Yates shuffle, repeat, volume, Media Session API)
  - `src/services/lyrics/parser.ts` (`parseLRC` + `estimateWordTimings`)
  - `src/services/lyrics/lrclib.ts` (`fetchLyrics` for `lrclib.net/api/get` + `/api/search` fallback)
  - `src/services/lyrics/sync.ts` (`LyricSyncEngine` with binary search, `seek`, `pause`/`resume`, `getCurrentState`)
  - `src/services/audio/analyzer.ts` (`AudioAnalyzer` with bass/mid/high energy, RMS, beat detection)
  - `src/stores/playerStore.ts` & `src/stores/uiStore.ts` (Zustand v5 stores connected to `playbackEngine`, `lyricSyncEngine`, and `fetchLyrics`)
- *Note:* Runtime execution (`npm run electron:dev` / `npm run build`) has **not** been tested yet.

### Partially Implemented Features
- **Constellation Renderer & UI Pages:** Initial starter/stub implementations exist and typecheck cleanly, but lack full UI wiring and word-level constellation lyric layout/sync.

### Features Not Yet Started
- Full `IMusicProvider` implementation (Local file scanning/IPC + modular `tracks.monochrome.st` / authorized provider).
- Full `PlaybackEngine` with Web Audio `AnalyserNode` pipeline, queue, shuffle, repeat, and Media Session integration.
- Word-timing estimator, local lyrics cache, and manual LRC import.
- Word-based Constellation Lyrics Visualization (`layout.ts`, `connections.ts`, `effects.ts`, `starfield.ts`, `ConstellationView.tsx`, `useVisualization.ts`).
- Audio-reactive edge lighting transparent overlay window.
- Fullscreen immersive mode (clock, date, auto-hiding controls, element toggles).
- Additional 7 lyrics visualization modes and customizable shader/canvas backgrounds.
- Visualization Studio page, Playlists/Favorites/History persistence (SQLite or JSON via Electron IPC), and Windows NSIS packaging test.

### Current Development Phase
- **Phase 1 — Project Scaffolding** (paused before `npm install` and `npx tsc --noEmit`).

### Exact Point Where Development Was Paused
- A swarm (`Nocturne Music Player Build`) was initialized with 4 workers (`scaffolder`, `services-builder`, `ui-builder`, `constellation-builder`).
- `scaffolder` created the initial project files in `d:\Music\nocturne\` before hitting a model quota error (`RESOURCE_EXHAUSTED` on Claude Opus 4.6).
- All swarm members were switched to `gemini-4-hydrogen-medium`, and `scaffolder` was asked to run `npm install` and `npx tsc --noEmit`, at which point the user requested to **pause development and save project state**.

---

## 3. Repository and Architecture

### Current Folder Structure (`d:\Music\nocturne\`)
```
nocturne/
├── .gitignore
├── ARCHITECTURE.md
├── IMPLEMENTATION_PLAN.md
├── PROJECT_HANDOFF.md
├── REPOSITORY_ANALYSIS.md
├── electron-builder.yml
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron/
│   ├── main.ts
│   └── preload.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── components/
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   ├── Sidebar.tsx
    │   │   └── Titlebar.tsx
    │   ├── pages/
    │   │   ├── HomePage.tsx
    │   │   ├── SearchPage.tsx
    │   │   └── SettingsPage.tsx
    │   ├── player/
    │   │   ├── NowPlaying.tsx
    │   │   └── PlayerBar.tsx
    │   └── ui/
    │       └── Button.tsx
    ├── hooks/
    │   └── useAudioAnalyzer.ts
    ├── services/
    │   ├── audio/
    │   │   └── analyzer.ts
    │   ├── lyrics/
    │   │   ├── lrclib.ts
    │   │   ├── parser.ts
    │   │   └── sync.ts
    │   ├── music/
    │   │   ├── provider.ts
    │   │   └── types.ts
    │   └── playback/
    │       └── engine.ts
    ├── stores/
    │   ├── playerStore.ts
    │   └── uiStore.ts
    ├── styles/
    │   └── globals.css
    ├── types/
    │   └── electron.d.ts
    └── visualization/
        └── constellation/
            └── renderer.ts
```

### Important Files & Responsibilities
- `electron/main.ts` — Electron main process, window lifecycle, tray, media keys, IPC handlers.
- `electron/preload.ts` — Context-isolated IPC bridge (`window.electronAPI`).
- `src/services/music/types.ts` & `provider.ts` — Music data contracts and provider abstraction.
- `src/services/playback/engine.ts` — HTML5 `<audio>` playback controller (needs Web Audio `AnalyserNode` + queue/shuffle/repeat expansion).
- `src/services/lyrics/{lrclib,parser,sync}.ts` — LRCLIB API client, LRC parser, and time-sync logic.
- `src/services/audio/analyzer.ts` — FFT frequency analysis helper.
- `src/visualization/constellation/renderer.ts` — Currently a basic particle-constellation Canvas 2D starter (needs replacement/expansion into the full lyric-word constellation engine).
- `src/stores/{playerStore,uiStore}.ts` — Zustand state stores.

### Application Architecture & Data Flow
- **Electron Main Process** handles OS integration (frameless window, media keys, tray, future overlay window, future local FS/storage IPC) and communicates via `contextBridge` (`electron/preload.ts`) with the **Renderer Process** (`contextIsolation: true`, `nodeIntegration: false`).
- **Renderer Process** runs React + Zustand + Services + Canvas 2D/WebGL renderers. Services are decoupled from UI and music providers so visualizations work identically regardless of whether audio comes from local files or a streaming provider.

### Dependencies (`package.json`)
- **Runtime:** `react`, `react-dom`, `react-router-dom`, `zustand`, `motion`, `lucide-react`, `color-thief-browser`.
- **Dev/Build:** `typescript`, `vite`, `@vitejs/plugin-react`, `vite-plugin-electron`, `vite-plugin-electron-renderer`, `electron`, `electron-builder`, `tailwindcss`, `@tailwindcss/vite`, `autoprefixer`, `@types/react`, `@types/react-dom`.

### Monochrome Reference Repository Analysis (`d:\Music\monochrome\`)
- **License:** Apache 2.0 (`d:\Music\monochrome\license`). Derivative works must retain copyright/license notices and document changes; Monochrome trademarks cannot be used.
- **Stack:** Vite 7 + TypeScript/JS (vanilla DOM, no React), Shaka Player (DASH), HLS.js, `@uimaxbai/am-lyrics`, Butterchurn, PocketBase.
- **Music Sources Observed:**
  - `js/api.js` (`LosslessAPI`) & `js/HiFi.ts` (`HiFiClient`): TIDAL/HiFi proxy endpoints (`/search/`, `/track/`, `/trackManifests/`, `/album/`, `/artist/`, `/info/`). Base64-encoded JSON or DASH MPD manifests. **Limitation:** Official HiFi instances restrict domains (self-hosted instances only work on `localhost` per `README.md`).
  - `js/tracks-api.js` (`TracksStreamerAPI`): Proxies via `https://tracks.monochrome.st` (`/search`, `/track/{id}`, etc.) with normalizers (`normalizeTracksTrack`, `normalizeTracksRelease`, `normalizeTracksArtist`).
  - `js/apple-music-api.js`: Search ordering & animated artwork via `am-mint.binimum.org` (metadata only, domain-restricted).
- **Lyrics Observed (`js/lyrics.js`):**
  - Fetches synced LRC from `https://lrclib.net/api/get` using `track_name`, `artist_name`, `album_name`, `duration` (free, no auth).
  - Parses `[MM:SS.CC]` lines (`parseSyncedLyrics`) and tracks active line (`getCurrentLine`).
- **Audio Analysis (`js/audio-context.js`):**
  - Connects `HTMLAudioElement` to Web Audio `AudioContext` + `AnalyserNode` + `GainNode` for visualizers and EQ.
- **Architectural Decisions:**
  - Do **not** copy Monochrome's vanilla DOM UI or domain-restricted auth/PocketBase/Genius tokens.
  - Reuse concepts/patterns: LRCLIB integration, LRC parsing, normalized track/album/artist models, Web Audio `AnalyserNode` graph, and Media Session integration.
  - Build a clean `IMusicProvider` interface supporting local audio files as a guaranteed offline-first source alongside modular streaming providers.

---

## 4. Implementation History

- **Files Created (in `d:\Music\nocturne\`):**
  - Documentation: `REPOSITORY_ANALYSIS.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `PROJECT_HANDOFF.md`
  - Config: `package.json`, `tsconfig.json`, `vite.config.ts`, `electron-builder.yml`, `index.html`, `.gitignore`
  - Electron: `electron/main.ts`, `electron/preload.ts`
  - Src: `src/main.tsx`, `src/App.tsx`, `src/styles/globals.css`, `src/types/electron.d.ts`, `src/components/layout/{AppShell,Sidebar,Titlebar}.tsx`, `src/components/pages/{HomePage,SearchPage,SettingsPage}.tsx`, `src/components/player/{NowPlaying,PlayerBar}.tsx`, `src/components/ui/Button.tsx`, `src/hooks/useAudioAnalyzer.ts`, `src/services/audio/analyzer.ts`, `src/services/lyrics/{lrclib,parser,sync}.ts`, `src/services/music/{provider,types}.ts`, `src/services/playback/engine.ts`, `src/stores/{playerStore,uiStore}.ts`, `src/visualization/constellation/renderer.ts`.
- **Files Modified:** None in `d:\Music\monochrome\`.
- **Commands Executed:**
  - Directory listing and file reads on `d:\Music\monochrome\`.
  - Created `d:\Music\nocturne\` directory.
  - Checked `Test-Path "d:\Music\nocturne\node_modules"` (`False`), `git -C "d:\Music\monochrome" status --short` (clean), `git -C "d:\Music\monochrome"` branch/commit (`main` / `86dc77a`), and `Test-Path "d:\Music\nocturne\.git"` (`False`).
- **Packages Installed:** None yet (`node_modules` does not exist).
- **Problems Encountered:**
  - `run_workflow` initially failed syntax check (`return` outside function) — fixed by using `log()` instead.
  - Swarm workers hit `RESOURCE_EXHAUSTED (429)` on `claude-opus-4-6-thinking` (2% quota remaining). Resolved by switching coordinator and all workers to `gemini-4-hydrogen-medium` (93% quota remaining).

---

## 5. Current Issues

1. **Runtime Not Yet Tested:** `npm install` and `npx tsc --noEmit` have succeeded, but `npm run electron:dev` and `npm run build` have not been executed yet.
2. **Stub Implementations:**
   - `src/visualization/constellation/renderer.ts` currently only draws generic bouncing dots/lines, **not** the lyric-word constellation visualization.
   - `src/services/music/provider.ts` and `src/services/playback/engine.ts` are minimal stubs without full queue/shuffle/repeat, Web Audio `AnalyserNode` wiring, or local file IPC.
   - `electron/main.ts` uses `nativeImage.createEmpty()` for Tray icon and does not yet implement file-picker IPC, local storage IPC, or the transparent edge-lighting overlay `BrowserWindow`.
4. **No Git Repository in `nocturne/`:** `d:\Music\nocturne\` is not yet initialized with `git init`.

---

## 6. How to Run the Project

### Prerequisites
- Windows 10 or Windows 11
- Node.js 20+ (with `npm`)

### Installation Commands
```powershell
cd d:\Music\nocturne
npm install
```

### Development & Verification Commands
```powershell
# TypeScript typecheck
npx tsc --noEmit

# Vite dev server (browser preview only, without Electron IPC)
npm run dev

# Build & launch Electron app
npm run electron:dev
```

### Build Commands (Windows Installer)
```powershell
npm run build
```

### Environment Variables
- None required (local-first architecture; LRCLIB requires no API keys).

### Testing Instructions & Expected Behaviour
- Currently **not runnable** until `npm install` is executed and any TypeScript compilation errors are fixed.
- Once `npm install` and `npx tsc --noEmit` pass, `npm run electron:dev` should open a frameless 1400×900 dark (`#0a0a0a`) window titled **Nocturne** with custom titlebar, icon sidebar, routed pages, and bottom player bar.

---

## 7. Remaining Development Roadmap

1. **Task 1 (P0 — Immediate): Install & Verify Baseline Build**
   - Run `npm install` and `npx tsc --noEmit` in `d:\Music\nocturne\`. Fix any type mismatches across scaffolded files (`src/services/music/types.ts`, `src/services/playback/engine.ts`, `src/stores/playerStore.ts`, etc.). Verify `npm run electron:dev` launches cleanly.
2. **Task 2 (P0 — Vertical Slice): Core Service Layer**
   - Expand `src/services/music/types.ts` & `provider.ts` (`LocalFileProvider` + Electron file-dialog IPC + modular `TracksProvider`).
   - Expand `src/services/playback/engine.ts` (Web Audio `AudioContext` → `MediaElementSource` → `AnalyserNode` → `GainNode`, queue, Fisher-Yates shuffle, repeat modes, Media Session API).
   - Complete `src/services/lyrics/{lrclib,parser,sync}.ts` (LRCLIB `/get` + `/search` fallback, `[MM:SS.CC]` & enhanced LRC parsing, word timing estimator, local JSON cache, manual LRC import).
   - Connect `src/services/audio/analyzer.ts` (bass/mid/high energy, RMS, beat detection, smoothing) and `src/stores/{playerStore,uiStore}.ts`.
3. **Task 3 (P0 — Primary Feature): Constellation Lyrics Visualization**
   - Implement `src/visualization/constellation/{layout,connections,effects,renderer}.ts`, `src/visualization/backgrounds/starfield.ts`, `src/components/visualization/ConstellationView.tsx`, and `src/hooks/useVisualization.ts`.
   - Ensure golden-angle + force-directed anti-overlap word layout, 4-pointed stars, thin animated constellation lines, active word glow/prominence, past word fade, subtle camera drift/zoom, and smooth phrase transitions.
4. **Task 4 (P1): Complete UI Pages & Controls**
   - Build out `Titlebar.tsx`, `Sidebar.tsx`, `AppShell.tsx`, `PlayerBar.tsx`, `NowPlaying.tsx`, `HomePage.tsx`, `SearchPage.tsx`, `SettingsPage.tsx`, plus `src/components/ui/{Slider,TrackList}.tsx` and keyboard shortcuts.
5. **Task 5 (P1): Audio-Reactive Edge Lighting Overlay**
   - Add transparent, click-through, always-on-top `BrowserWindow` in `electron/overlay.ts` + `electron/main.ts` driven by FFT bands and `color-thief-browser` album palette extraction.
6. **Task 6 (P2): Immersive Desktop Mode, Additional Modes & Studio**
   - Fullscreen immersive mode (clock, date, auto-hiding controls, element toggles), floating lyrics window, 7 additional lyrics modes, customizable backgrounds, and Visualization Studio page.
7. **Task 7 (P2): Persistence, Performance & Packaging**
   - Local JSON/SQLite persistence for playlists, favorites, history, and preferences; visibility-based FPS throttling & battery-saving mode; `README.md` with Monochrome Apache 2.0 attribution; `npm run build` Windows NSIS installer verification.

---

## 8. Next Session Instructions

1. **Inspect First:**
   - `d:\Music\nocturne\PROJECT_HANDOFF.md` (this file)
   - `d:\Music\nocturne\package.json`, `tsconfig.json`, `src/services/music/types.ts`, `src/services/playback/engine.ts`, `src/stores/playerStore.ts`
2. **Exact Next Task:**
   - Verify `npm run electron:dev` launches the Electron window cleanly.
   - Then proceed with **Task 2 (Core Service Layer)**, **Task 3 (Constellation Lyrics Visualization)**, and **Task 4 (UI Components)**.
3. **Do Not Rebuild:**
   - Keep existing `REPOSITORY_ANALYSIS.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `vite.config.ts`, `electron/main.ts`, and `electron/preload.ts`; build incrementally on top of them.

---

## 9. Original Requirements and Design Context

- **Reference Codebase:** `d:\Music\monochrome\` must remain **completely untouched**. All new code goes in `d:\Music\nocturne\`.
- **Legal/Source Rules:** Only authorized music sources; no DRM/auth/ad bypass; no mandatory paid APIs or cloud infrastructure; preserve Apache 2.0 attribution to Monochrome.
- **Primary Visual Goal:** The **Constellation Lyrics Visualization** is the centerpiece — spatial, organic, cinematic, never overlapping words, never looking like a generic node graph.
- **UI/UX:** Obsidian black (`#0a0a0a`), glassmorphic panels, Lucide icons, restrained colour, album-reactive accents, no emoji UI icons, no Bootstrap-style clutter.
- **Architecture:** Strict separation between music provider, playback engine, lyrics engine, audio analyzer, visualization engine, Electron main/preload (`contextIsolation: true`, `nodeIntegration: false`), and renderer.

---

## 10. Final Checkpoint

- **All unsaved changes:** Saved to disk; `PROJECT_HANDOFF.md` created in `d:\Music\nocturne\PROJECT_HANDOFF.md`.
- **Nocturne Git Status:** `d:\Music\nocturne\` is **not** a Git repository (`d:\Music\nocturne\.git` does not exist); all files are untracked local files on disk.
- **Monochrome Reference Repository Git Status (`d:\Music\monochrome\`):**
  - Branch: `main`
  - Latest Commit: `86dc77a`
  - Status: Clean (no modified or untracked files; untouched).
- **No commits or pushes** were made.
- **Untested Status:** No build, typecheck, or runtime tests have been executed yet; no untested features are claimed as working.
