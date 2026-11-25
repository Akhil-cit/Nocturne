# Nocturne — Test Report

**Date:** 2026-11-25  
**Target:** `d:\Music\nocturne\` (Electron + React + TypeScript + Vite)

## 1. Static & Build Verification
| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `npx tsc --noEmit` | **PASS** (exit 0, 0 errors) |
| Production bundle | `npx vite build` | **PASS** (`dist/`, `dist-electron/main.js`, `dist-electron/preload.js`) |
| Windows NSIS packaging | `npx electron-builder --win` | **PASS** (exit 0; generated `release/Nocturne Setup 0.1.0.exe` & `release/win-unpacked/Nocturne.exe`) |
| Reference repo integrity | `git -C "d:\Music\monochrome" status --short` | **PASS** (clean, untouched) |

## 2. Live Electron + Playwright Functional & Visual Verification
Executed against `d:\Music\nocturne\node_modules\electron\dist\electron.exe` loading `d:\Music\nocturne`:

| Test Area | Observed Result | Evidence |
|---|---|---|
| Local audio playback (`Open Local Files`) | **PASS** — Opened local `.wav`, populated `PlayerBar` & `NowPlaying`, played audio (`0:02 / 0:20`). | `10_normal_with_offset.png` |
| Search (`tracks.monochrome.st`) | **PASS** — Live search returned tracks with album artwork and durations (`Reflections` — `The Neighbourhood`, `4:04`). | `02_search_results.png` |
| Normal Player Mode (`#/now-playing`) | **PASS** — Cleanly separated from Immersive Mode; no constellation behind album art or lyrics panel; `-0.1s` / `+0.1s` / `Reset` offset buttons work (`Offset: +0.1s`). | `03_normal_now_playing.png`, `10_normal_with_offset.png` |
| Immersive Constellation Mode (English & Tamil) | **PASS** — Fullscreen 9-layer hierarchy: Starfield/Aurora background, delicate constellation lines, 4-pointed stars, active-word glow, Tamil script shaping (`நட்சத்திரம்`, `நிலவின்`, `ஒளியில்`, `போல`, `மின்னுதே`) with zero overlap or clipping. | `04_immersive_constellation_english.png`, `07_immersive_tamil.png`, `11_immersive_aurora.png` |
| Window resize & auto-hiding HUD | **PASS** — Resizing to `1024×680` re-laid out constellation cleanly; HUD controls auto-hid on mouse idle; `Escape` exited immersive mode. | `05_immersive_resized.png` |
| Visualization Studio & Presets (`#/studio`) | **PASS** — All 10 built-in presets, 8 lyrics modes, 12 backgrounds, and 8 edge lighting presets rendered and applied (`Aurora` preset switched background to Aurora waves). | `08_studio_presets.png`, `11_immersive_aurora.png` |
| Settings (`#/settings`) | **PASS** — FPS Limit (`60 FPS`), Graphics Quality, Lyrics Source, and Desktop Overlay / Wallpaper notes rendered cleanly. | `09_settings.png` |
| Floating Mini Player (`?mini=1`) & Desktop Overlay (`?overlay=1`) | **BUILD VERIFIED / INTERACTIVE WINDOW NOT CAPTURED** — `electron/miniPlayer.ts`, `electron/overlay.ts`, `MiniPlayerApp.tsx`, and `OverlayApp.tsx` compiled cleanly; Playwright selector in `task-412` did not open a second window during automated run (`WINDOWS_BEFORE_MINI: 1 WINDOWS_AFTER_MINI: 1`). | `task-412` log |
| Console / Runtime JS Errors | **PASS** — Zero uncaught page errors or app JS errors (only expected LRCLIB `404` for synthetic `Nocturne Test Track.wav`). | `task-340`, `task-412` logs |
