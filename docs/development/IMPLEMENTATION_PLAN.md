# Nocturne — Implementation Plan

## Phase 1: Project Scaffolding ✅
- [x] Analyze Monochrome repository
- [ ] Initialize Electron + React + Vite + TypeScript project
- [ ] Configure Tailwind CSS
- [ ] Set up Electron main/preload/renderer structure
- [ ] Configure build tooling (electron-builder)

## Phase 2: Music Engine (Core Vertical Slice)
- [ ] Music provider abstraction layer (`IMusicProvider` interface)
- [ ] Implement TracksProvider (using tracks.monochrome.st concepts)
- [ ] Local file playback provider
- [ ] Playback engine (HTML5 Audio + Web Audio API)
- [ ] Queue management (add, remove, reorder, shuffle, repeat)
- [ ] Search UI + results display
- [ ] Album artwork display
- [ ] Media Session API integration
- [ ] Keyboard shortcuts + media key support

## Phase 3: Lyrics Engine
- [ ] LRCLIB lyrics fetcher (no auth required)
- [ ] LRC parser (line-level timestamps)
- [ ] Word timing estimator (from line-level to word-level)
- [ ] Lyrics synchronization engine (tied to playback position)
- [ ] Local lyrics cache (JSON file storage)
- [ ] Manual LRC file import
- [ ] Handle pause, seek, track change gracefully

## Phase 4: Constellation Visualization (PRIMARY FEATURE)
- [ ] Canvas 2D constellation renderer
- [ ] Word → star node positioning algorithm
- [ ] Constellation line drawing (connecting nearby words)
- [ ] Active word highlighting (larger, brighter, glowing)
- [ ] Upcoming words (subtle transparency)
- [ ] Past words (gradual fade)
- [ ] Gentle float/pulse animation
- [ ] Camera movement and subtle zoom
- [ ] Smooth phrase transitions
- [ ] Anti-overlap word placement
- [ ] Integration with lyrics sync engine
- [ ] Integration with audio analyser (subtle reactivity)

## Phase 5: Audio Analysis + Edge Lighting
- [ ] Web Audio API AnalyserNode setup
- [ ] FFT frequency band separation (bass/mid/high)
- [ ] Beat detection algorithm
- [ ] Edge lighting overlay window (transparent, click-through)
- [ ] Audio-reactive border glow
- [ ] Album art colour extraction
- [ ] Configurable lighting modes (beat, ambient, breathing)

## Phase 6: Desktop Experience
- [ ] Fullscreen immersive mode
- [ ] Transparent overlay mode
- [ ] Floating lyrics window
- [ ] System tray mode
- [ ] Clock + date display in immersive mode
- [ ] Auto-hiding playback controls

## Phase 7: Additional Features
- [ ] Background visualization engine (starfield, nebula, etc.)
- [ ] Additional lyrics modes (cinematic, floating, karaoke, etc.)
- [ ] Visualization studio (live controls)
- [ ] Settings page

## Phase 8: Polish + Packaging
- [ ] Performance optimization
- [ ] Memory leak prevention
- [ ] Battery saving mode
- [ ] Windows installer generation (electron-builder)
- [ ] README with setup instructions

## Integration Strategy

### Music Source
Monochrome uses `tracks.monochrome.st` which is domain-restricted. For Nocturne:
1. **Local files** — primary, fully offline support (MP3, FLAC, WAV, OGG, AAC, M4A)
2. **Modular provider interface** — easily add new streaming sources
3. **tracks.monochrome.st** — attempt integration on localhost (per Monochrome docs, works on localhost)

### Lyrics Source
- **LRCLIB** (`lrclib.net`) — free, no auth, works from any domain
- Query by: track name, artist name, album name, duration
- Returns synced LRC + plain text

### Reused Patterns from Monochrome
- LRC parsing regex and logic (adapted to TypeScript)
- Track data normalization patterns
- Queue state management approach
- Web Audio API analyser setup pattern
- Media Session API integration pattern

### Attribution
Per Apache 2.0, Nocturne includes attribution to Monochrome in README and NOTICE files.
