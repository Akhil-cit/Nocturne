# Nocturne — Security, Dependency & Privacy Audit

**Date:** 2026-11-27  
**Scope:** `electron/main.ts`, `electron/preload.ts`, `src/`, `package.json`, `.gitignore`

## 1. Electron & IPC Security
- `contextIsolation: true` and `nodeIntegration: false` are enforced in `electron/main.ts`.
- `setWindowOpenHandler(() => ({ action: 'deny' }))` is enforced on `mainWindow` and `web-contents-created`.
- `shell:openExternal` parses and validates URLs before invoking `shell.openExternal`.
- **Note:** `sandbox: false` is currently used for preload compatibility with local file/audio helpers.

## 2. Dependency Audit
- `npm audit --omit=dev`: **0 vulnerabilities** found in production dependencies.

## 3. Filesystem, Backup & Privacy
- **Local-First:** Listening analytics (`nocturne-analytics-events-v1`), playback sessions (`nocturne-playback-session-v1`), and `.nocturne-backup` exports are stored strictly locally.
- **No Telemetry / No Accounts:** Nocturne does not transmit listening history, playlists, or local filenames to any Nocturne server.
- **External Network Requests:** Limited to authorized music/metadata providers (Tracks, JioSaavn, iTunes, Commons), lyrics (`lrclib`), artwork resolution, and optional lyrics translation (`MyMemory` public API).
- **Ephemeral Streams:** Temporary `streamUrl`s are stripped from persisted sessions and `.nocturne-backup` exports.

## 4. Remaining Risks & Recommendations
- Unencrypted `.nocturne-backup` files contain listening history and playlists in plain JSON; users should store exported backups securely.
- Reference repositories (`monochrome`, `BitChord-main`, `BloomeeTunes`) remain external and unmodified; Apache 2.0 / MIT attributions are preserved.
