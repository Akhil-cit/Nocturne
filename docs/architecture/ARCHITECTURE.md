# Nocturne — Architecture

## Overview

Nocturne is an immersive desktop music player and visualization engine for Windows, built with Electron + React + TypeScript. It combines functional music playback with cinematic synchronized lyrics visualizations, audio-reactive edge lighting, and customizable desktop experiences.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                        │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │  Window   │  │   IPC Bridge │  │  Tray     │  │  Overlay   │ │
│  │  Manager  │  │   (secure)   │  │  Manager  │  │  Window    │ │
│  └──────────┘  └──────────────┘  └───────────┘  └────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────┐                  │
│  │  Local Storage    │  │  Media Key Handler   │                  │
│  │  (JSON/SQLite)    │  │                      │                  │
│  └──────────────────┘  └──────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC │
┌─────────────────────────────────────────────────────────────────┐
│                   Electron Renderer Process                       │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     React Application                        │ │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │  Home    │  │  Search  │  │  Now      │  │  Settings  │  │ │
│  │  │  Page    │  │  Page    │  │  Playing  │  │  Page      │  │ │
│  │  └─────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  │  ┌───────────────────┐  ┌───────────────────────────────┐  │ │
│  │  │  Visualization    │  │      Playback Controls        │  │ │
│  │  │  Studio           │  │                               │  │ │
│  │  └───────────────────┘  └───────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────── Service Layer ───────────────────────┐ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │  Music        │  │  Playback    │  │  Lyrics          │  │ │
│  │  │  Provider     │  │  Engine      │  │  Engine          │  │ │
│  │  │  Service      │  │              │  │                  │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │  Audio        │  │  Visualization│  │  State           │  │ │
│  │  │  Analyzer     │  │  Engine      │  │  Management      │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────── Rendering Layer ─────────────────────────┐ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │ │
│  │  │  Canvas 2D   │  │  WebGL /     │  │  CSS Animations  │  │ │
│  │  │  Renderer    │  │  Three.js    │  │  (Motion)        │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Music Provider Service (`src/services/music/`)
- **Interface:** `IMusicProvider` — search, getTrack, getAlbum, getArtist, getStreamUrl
- **TracksProvider:** Adapts Monochrome's tracks.monochrome.st API
- **LocalFileProvider:** Plays local audio files (MP3, FLAC, WAV, OGG, AAC)
- **ProviderManager:** Routes requests, handles fallbacks

### 2. Playback Engine (`src/services/playback/`)
- HTML5 `<audio>` element for playback
- Web Audio API pipeline: source → analyser → gain → destination
- Queue management (ordered list + shuffle permutation)
- Repeat modes: off, all, one
- Seek, volume, media session integration
- Crossfade support
- Event emitter for state changes

### 3. Lyrics Engine (`src/services/lyrics/`)
- **LRCLIBProvider:** Fetch synced lyrics from lrclib.net
- **LRCParser:** Parse `[MM:SS.CC] text` format
- **WordTimingEstimator:** Estimate per-word timing from line-level timestamps
- **SyncEngine:** Real-time synchronization using playback position
- **LyricsCache:** Local file/JSON cache for retrieved lyrics
- **LRCImporter:** Manual LRC file import

### 4. Audio Analyzer (`src/services/audio/`)
- Web Audio API `AnalyserNode`
- FFT frequency data extraction
- Band separation: bass (20-250Hz), mid (250-4kHz), high (4k-20kHz)
- Beat detection algorithm
- Smooth interpolation with configurable decay
- RMS energy calculation

### 5. Visualization Engine (`src/visualization/`)
- **ConstellationRenderer:** Primary constellation lyrics mode (Canvas 2D)
- **CinematicRenderer:** Large centered text mode
- **FloatingRenderer:** 3D drifting words
- **KaraokeRenderer:** Progressive word highlighting
- **MinimalRenderer:** Clean typography
- **OrbitRenderer:** Rotating words
- **ParticleRenderer:** Particle dissolution
- **WaveRenderer:** Audio-frequency word movement
- **BackgroundEngine:** GPU-accelerated backgrounds (starfield, nebula, aurora, etc.)

### 6. Edge Lighting (`src/services/lighting/`)
- Transparent overlay window (Electron BrowserWindow)
- Audio-reactive border glow rendering
- Colour extraction from album artwork
- Configurable thickness, intensity, palette
- Beat-reactive and ambient modes

### 7. State Management (`src/stores/`)
- Zustand stores for:
  - Player state (current track, queue, playback status)
  - UI state (current page, panels, theme)
  - Settings (all user preferences)
  - Library (favorites, playlists, history)

### 8. Electron Layer (`electron/`)
- **main.ts:** Window creation, tray, media keys
- **preload.ts:** Secure IPC bridge (context isolation)
- **overlay.ts:** Transparent click-through overlay window

## Directory Structure

```
nocturne/
├── electron/
│   ├── main.ts              # Main process
│   ├── preload.ts           # Preload script (IPC bridge)
│   └── overlay.ts           # Edge lighting overlay
├── src/
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Root component
│   ├── components/          # React UI components
│   │   ├── layout/          # App shell, sidebar, header
│   │   ├── player/          # Playback controls, now playing
│   │   ├── pages/           # Home, Search, Settings, etc.
│   │   ├── visualization/   # Viz mode components
│   │   └── ui/              # Shared UI primitives
│   ├── services/            # Core business logic
│   │   ├── music/           # Music provider abstraction
│   │   ├── playback/        # Playback engine
│   │   ├── lyrics/          # Lyrics fetching/parsing/sync
│   │   ├── audio/           # Audio analysis
│   │   └── lighting/        # Edge lighting
│   ├── visualization/       # Canvas/WebGL renderers
│   │   ├── constellation/   # Primary constellation mode
│   │   ├── backgrounds/     # Background renderers
│   │   └── modes/           # Additional lyric modes
│   ├── stores/              # Zustand state stores
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Shared utilities
│   └── types/               # TypeScript type definitions
├── public/                  # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── tailwind.config.ts
└── index.html
```

## Security Model

- Context isolation enabled
- Node.js integration disabled in renderer
- IPC methods explicitly whitelisted in preload
- No `nodeIntegration: true`
- CSP headers configured
- File system access only through IPC

## Performance Strategy

- Canvas 2D for constellation (lighter than WebGL for text)
- `requestAnimationFrame` rendering loop
- Visibility-based render throttling
- Worker threads for heavy computation (FFT, beat detection)
- React.memo + useMemo for component optimization
- Lazy loading for visualization modes
- GPU compositing hints (`will-change`, `transform: translateZ(0)`)
