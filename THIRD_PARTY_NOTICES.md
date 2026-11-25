# Third-Party Notices & Attributions

Nocturne is an original desktop music player and visualization engine. Below are the attributions for open-source projects, external APIs, and runtime dependencies used or referenced by Nocturne.

---

## Architectural References

### Monochrome
- **Repository**: https://github.com/monochrome-music/monochrome
- **License**: Apache License, Version 2.0
- **Copyright**: Copyright 2026 Monochrome Team
- **Usage**: Architectural inspiration for modular music provider abstractions (`IMusicProvider`) and lyric/playback concepts. See [NOTICE](./NOTICE) for the full Apache 2.0 notice.

### BitChord
- **License**: GNU General Public License v3.0 (GPL-3.0)
- **Usage**: Analyzed strictly for high-level architectural patterns (multi-provider search orchestration, track matching concepts, and fallback design). **No GPL-3.0 source code was copied into Nocturne**; all Nocturne provider, matcher, and store implementations are original TypeScript.

---

## External APIs & Services

### LRCLIB
- **Endpoint**: `https://lrclib.net/api`
- **Usage**: Fetches synced (`.lrc`) and plain lyrics for currently playing tracks (`src/services/lyrics/lrclib.ts`).

### Apple iTunes Search API
- **Endpoint**: `https://itunes.apple.com/search`
- **Usage**: Catalog metadata search and official track links (`src/services/music/itunesProvider.ts`).

### Tracks (`tracks.monochrome.st`)
- **Endpoint**: `https://tracks.monochrome.st`
- **Usage**: Catalog search and metadata (`src/services/music/tracksProvider.ts`).

### JioSaavn Public API
- **Endpoint**: `https://www.jiosaavn.com/api.php`
- **Usage**: Search and streaming URL resolution for the Indian music catalog (`src/services/music/jiosaavnProvider.ts`). No authentication required. CDN stream URLs are decoded using the DES key published by JioSaavn's own public CDN scheme, documented in numerous open-source JioSaavn clients.

---

## Runtime & Build Dependencies

| Package | Purpose | License |
| --- | --- | --- |
| `react` / `react-dom` | UI rendering | MIT |
| `react-router-dom` | Client-side routing | MIT |
| `zustand` | State management | MIT |
| `motion` | UI animations | MIT |
| `lucide-react` | Iconography | ISC |
| `color-thief-browser` | Dominant album art color extraction | MIT |
| `des.js` | Pure-JS DES cipher — used to decrypt JioSaavn CDN stream URLs (`src/services/music/jiosaavnProvider.ts`) | MIT |
| `electron` | Desktop application runtime | MIT |
| `electron-builder` | Desktop packaging & Windows NSIS installer | MIT |
| `vite` / `@vitejs/plugin-react` | Build tool & dev server | MIT |
| `vite-plugin-electron` / `vite-plugin-electron-renderer` | Electron + Vite integration | MIT |
| `tailwindcss` / `@tailwindcss/vite` | Utility-first CSS framework | MIT |
| `autoprefixer` | CSS vendor prefixing | MIT |
| `typescript` | Static type checking | Apache-2.0 |

## Phase 11 additions
Wikimedia Commons files have individual reuse declarations. Audio Info carries creator, license and file page for the chosen source. See https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia . BloomeeTunes and Bloom Factory were studied as architecture references. Their plugin binaries and source are not distributed.
