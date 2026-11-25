# Nocturne — Known Issues & Limitations

## Active Limitations
1. **Music Streaming Provider Limitations:** Per Monochrome's `README.md`, TIDAL HiFi API instances are domain-restricted and `tracks.monochrome.st` may have rate limits or domain restrictions. Nocturne treats local audio files as a first-class offline source and keeps streaming providers modular.
2. **Desktop Wallpaper Mode:** Embedding an Electron window behind Windows 10/11 desktop icons requires native Win32 `Progman`/`WorkerW` HWND reparenting (`SetParent`), which is fragile across Windows 11 shell updates and Explorer restarts without native C++ addons. Nocturne provides a safe **Transparent Desktop Overlay** and **Immersive Fullscreen Mode** instead.
3. **Mini Player Automated Click Test:** In `task-412` Playwright verification, `WINDOWS_BEFORE_MINI: 1 WINDOWS_AFTER_MINI: 1` (the automated selector did not open the second window, though `electron/miniPlayer.ts`, `MiniPlayerApp.tsx`, and `main.tsx` compile cleanly).

## Resolved Issues
- **Runtime & Visual Verification:** Completed in `task-340`, `task-352`, and `task-412` (see `TEST_REPORT.md`).
- **Tray Icon:** Replaced `nativeImage.createEmpty()` in `electron/main.ts` with a generated 16×16 PNG data-URL icon.
- **Constellation Behind Artwork / Opaque Background:** Fixed in `NowPlaying.tsx`, `ImmersiveView.tsx`, `renderer.ts`, `layout.ts`, and `Sidebar.tsx`.
