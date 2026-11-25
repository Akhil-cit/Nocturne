# Nocturne — Task Roadmap & Status

Statuses: `TODO` | `IN_PROGRESS` | `IMPLEMENTED` | `TESTING` | `VERIFIED` | `BLOCKED` | `FAILED`

## Phase 1: Project Scaffolding & Core Services
- **T1.1** `[VERIFIED]` — Project scaffolding (`package.json`, `tsconfig.json`, `vite.config.ts`, `electron-builder.yml`, Electron main/preload, React shell, `npm install`, `npx tsc --noEmit`).
- **T1.2** `[IMPLEMENTED]` — Core service layer & Zustand stores (`src/services/music/{types,provider}.ts`, `src/services/playback/engine.ts`, `src/services/lyrics/{lrclib,parser,sync}.ts`, `src/services/audio/analyzer.ts`, `src/stores/{playerStore,uiStore}.ts`). Needs runtime verification & local-file/streaming IPC integration.

## Phase 2: Functional Vertical Slice (Music + Lyrics + Constellation + UI)
- **T2.1** `[VERIFIED]` — Electron IPC for local audio file picker (`dialog:openAudioFiles`), file metadata/artwork extraction, and local JSON persistence (`storage:get/set`) + Monochrome `tracks.monochrome.st` modular provider (`src/services/music/tracksProvider.ts`) + keyboard shortcuts & global media-key wiring.
- **T2.2** `[VERIFIED]` — Constellation Lyrics Visualization (`src/visualization/constellation/{layout,connections,effects,renderer}.ts`, `src/visualization/backgrounds/starfield.ts`, `src/components/visualization/ConstellationView.tsx`, `src/hooks/useVisualization.ts`).
- **T2.3** `[VERIFIED]` — Complete Core UI Pages & Controls (`Titlebar.tsx`, `Sidebar.tsx`, `AppShell.tsx`, `PlayerBar.tsx`, `NowPlaying.tsx`, `HomePage.tsx`, `SearchPage.tsx`, `SettingsPage.tsx`, `Slider.tsx`, `TrackList.tsx`, `QueueDrawer.tsx`).
- **T2.4** `[VERIFIED]` — Local lyrics cache (`src/services/lyrics/cache.ts`) & manual `.lrc` file import (`src/services/lyrics/importer.ts`).
- **T2.5** `[VERIFIED]` — Vertical slice build & runtime verification (`npx tsc --noEmit`, `vite build`, `electron .` startup smoke test).

## Phase 3: Audio-Reactive Edge Lighting & Immersive Desktop Mode
- **T3.1** `[VERIFIED]` — Album-art colour palette extraction (`src/services/lighting/colorExtractor.ts`) & audio-reactive edge lighting engine (`src/services/lighting/edgeLighting.ts`, `src/components/lighting/EdgeLightingOverlay.tsx`).
- **T3.2** `[VERIFIED]` — Transparent, click-through, always-on-top Edge Lighting overlay window (`electron/overlay.ts`, IPC sync from main renderer).
- **T3.3** `[VERIFIED]` — Immersive Fullscreen Mode (`src/components/player/ImmersiveView.tsx` with clock, date, auto-hiding controls, per-element visibility toggles) integrated into `NowPlaying.tsx` / `AppShell.tsx`.

## Phase 4: Additional Visualization Modes, Backgrounds & Studio
- **T4.1** `[VERIFIED]` — Additional 7 Lyrics Modes (`Cinematic`, `Floating`, `Karaoke`, `Minimal`, `Orbit`, `Particle`, `Wave`) sharing the same lyric sync engine.
- **T4.2** `[VERIFIED]` — Customizable Background Engine (Starfield, Nebula, Aurora, Fluid Gradients, Dark Clouds, Atmospheric Fog, Audio Particles, Abstract Waves, Album-Art Blur, Custom Image/Video, Pure Black).
- **T4.3** `[VERIFIED]` — Visualization Studio page (`src/components/pages/StudioPage.tsx`), `LyricsStage` integration in `NowPlaying.tsx` & `ImmersiveView.tsx`, Studio route in `App.tsx` & `Sidebar.tsx`, and `libraryStore` integration in `HomePage.tsx`.

## Phase 5: Library Persistence, Performance & Windows Packaging
- **T5.1** `[VERIFIED]` — Local playlists, favorites, recently played, and persistent playback preferences (`src/stores/libraryStore.ts` + Electron JSON storage).
- **T5.2** `[VERIFIED]` — Performance optimization & final verification (`npx tsc --noEmit`, `npx vite build`, Electron smoke test, `npx electron-builder --win` NSIS installer `release/Nocturne Setup 0.1.0.exe`).
- **T5.3** `[VERIFIED]` — `README.md` & `NOTICE` with setup instructions, architecture, dependency attribution, and Monochrome Apache 2.0 attribution.

## Phase 6: Visualization Layout, Layering & Multilingual Fixes
- **T6.1** `[VERIFIED]` — Separate Normal Player Mode (`NowPlaying.tsx`) from Immersive Constellation Mode (`ImmersiveView.tsx`) with strict 9-layer hierarchy and dynamic album accent colour.
- **T6.2** `[VERIFIED]` — Fix `ConstellationRenderer` transparency over `BackgroundEngineCanvas`, safe screen margins, worst-case active-word anti-overlap layout, and Tamil/Unicode font & grapheme support (`renderer.ts`, `layout.ts`, `parser.ts`, `studioStore.ts`, `Sidebar.tsx`).
- **T6.3** `[VERIFIED]` — Build, launch live Electron app, test Normal + Immersive modes, English + Tamil lyrics, resizing, and visually inspect screenshots.
- **T6.4** `[VERIFIED]` — Rebuild Windows NSIS installer (`npx electron-builder --win`) after visual verification.

## Phase 7: Premium Immersive Experience, Presets, Desktop Modes & Final Refinement
- **T7.1** `[VERIFIED]` — Per-track lyrics offset, instrumental gap handling, 8 Edge Lighting presets + adaptive normalization, and 10-preset Visualization Preset System (`sync.ts`, `playerStore.ts`, `edgeLighting.ts`, `lightingStore.ts`, `presetStore.ts`).
- **T7.2** `[VERIFIED]` — Transparent Overlay monitor/opacity/unlock/Ctrl+Shift+O recovery, Floating Mini Player (`?mini=1`), Tray icon, IPC security hardening (`overlay.ts`, `miniPlayer.ts`, `main.ts`, `preload.ts`, `electron.d.ts`, `OverlayApp.tsx`, `MiniPlayerApp.tsx`, `main.tsx`).
- **T7.3** `[VERIFIED]` — Studio Preset Manager UI, Edge Lighting preset/monitor controls, NowPlaying lyrics offset & sync-type badge, Mini Player button, and Settings FPS/Wallpaper documentation (`StudioPage.tsx`, `NowPlaying.tsx`, `PlayerBar.tsx`, `SettingsPage.tsx`).
- **T7.4** `[VERIFIED]` — Comprehensive live Electron testing, screenshots, `TEST_REPORT.md`, and final Windows NSIS installer build.

## Phase 8: Critical Playback Bug Fix & Regression Suite
- **T8.1** `[VERIFIED]` — Live Electron reproduction & runtime diagnostics on `"Verappa"` (From "Karuppu") in `Nocturne.exe` (`test-artifacts/playback/repro_verappa_log.json`).
- **T8.2** `[VERIFIED]` — Root cause analysis confirmed: (1) `net::ERR_QUIC_PROTOCOL_ERROR` on 23.4MB lossless stream from `tracks.monochrome.st` around ~0:58 causing `waiting` stall; (2) `PlaybackEngine` had no stall/error recovery, no `userPaused` vs `buffering` distinction, so `toggle()` called `pause()` instead of recovering.
- **T8.3** `[VERIFIED]` — Permanent playback engine fix (`disable-quic` in `electron/main.ts`, `PlaybackEngine` stall/error recovery + `loadSequence` + `userPaused` + `retry()`, `playerStore`, `NowPlaying.tsx`).
- **T8.4** `[VERIFIED]` — Permanent Playwright Electron regression test suite (`tests/playback.spec.mjs`, 10/10 passing against `Nocturne.exe`), live full-track `"Verappa"` verification, `PLAYBACK_BUG_REPORT.md`, and updated `Nocturne Setup 0.1.0.exe`.

## Phase 9: Mini Player Fix, BitChord Analysis & Multi-Provider Music Engine
- **T9.1** `[VERIFIED]` — Fix Mini Player transparent rounded corners (`electron/miniPlayer.ts`, `MiniPlayerApp.tsx`, `globals.css`) & verified with Playwright (`mini_player_fixed.png`).
- **T9.2** `[VERIFIED]` — Comprehensive `BitChord-main` repository analysis (`BITCHORD_ANALYSIS.md`) & 3-way comparison (`REFERENCE_COMPARISON.md`).
- **T9.3** `[VERIFIED]` — Multi-Provider Music Architecture (`ItunesProvider`, `TracksProvider`, `LocalFileProvider`, `trackMatcher.ts`, unified concurrent search with Tamil/Unicode normalization & ranking, provider health/status, audio quality preference).
- **T9.4** `[VERIFIED]` — Music Sources Settings UI, Search provider filter & quality badges, `MUSIC_PROVIDER_ARCHITECTURE.md`, & `THIRD_PARTY_NOTICES.md`.
- **T9.5** `[VERIFIED]` — Live Playwright Electron testing (`tests/providers.spec.mjs` 6/6 PASS, `tests/playback.spec.mjs` against `Nocturne.exe`), `PROVIDER_TEST_REPORT.md`, & final Windows NSIS build (`release/Nocturne Setup 0.1.0.exe`).

## Phase 10: Fix 30-Second Preview Substitution & Provider Capabilities
- **T10.1** `[VERIFIED]` — Reproduced `"Unakke Nizhalaanen"` 30-second iTunes preview substitution in `Nocturne.exe` (`repro_unakke_log.json`).
- **T10.2** `[VERIFIED]` — Separated Metadata/Preview-Only (`itunes`) from Full-Track (`tracks`, `local`) capabilities, blocked silent 30s preview substitution in `PlaybackEngine`, and added `"Full tracks only"` filter (enabled by default in `SearchPage.tsx` & `providerStore.ts`).
- **T10.3** `[VERIFIED]` — Added clickable Audio Info popover in `NowPlaying.tsx` displaying real playback provider, metadata provider, availability, quality, codec, expected vs. actual duration.
- **T10.4** `[VERIFIED]` — `tests/providers.spec.mjs` (9/9 PASS) & `tests/playback.spec.mjs` (10/10 PASS) against rebuilt `Nocturne.exe` & `Nocturne Setup 0.1.0.exe`.

## Phase 11
- T11.1 [VERIFIED] Recover baseline, extract and audit references and provider permissions.
- T11.2 [IN_PROGRESS] Full-track resolution, source matching, recovery and reporting.
- T11.3 [IN_PROGRESS] Discovery preferences, complementary provider capabilities, official player handoff.
- T11.4 [IN_PROGRESS] Isolated real Electron runtime verification.
- T11.5 [IN_PROGRESS] Wikimedia Commons licensed audio discovery, attribution and quality negotiation.

## Phase 12: Restore Tracks Playback & Additive JioSaavn Provider
- **T12.1** `[VERIFIED]` — Restored `TracksProvider` full-track playback (`availability: 'full'` in `tracksProvider.ts`, `registerResolver(this.tracksProvider)` in `provider.ts`) and added HTTP 429 first-probe cooldown handling in `PlaybackEngine.recoverPlayback()`.
- **T12.2** `[VERIFIED]` — Implemented additive `JioSaavnProvider` (`src/services/music/jiosaavnProvider.ts`) using `des.js` + Web APIs, search cache, in-flight deduplication, and HTTP 429 `Retry-After` cooldowns; registered in `provider.ts`, `providerStore.ts`, and `SearchPage.tsx`. Verified 7/7 tracks in Electron (`tests/jiosaavn_regression.spec.mjs`).
- **T12.3** `[IN_PROGRESS]` — Rebuild `Nocturne.exe` and `Nocturne Setup 0.1.0.exe` via `electron-builder --win`.
