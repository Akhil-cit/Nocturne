# Monochrome Repository Analysis

## Overview

**Monochrome** is an open-source (Apache 2.0), privacy-respecting, ad-free web music player built with Vite + TypeScript/JavaScript. It runs as a web application (PWA) and targets browsers directly.

## Architecture

### Technology Stack
- **Build:** Vite 7.x
- **Language:** TypeScript/JavaScript (vanilla, no React/Vue)
- **UI:** Custom web components, vanilla DOM manipulation
- **Audio:** HTML5 Audio element + Web Audio API + Shaka Player (DASH) + HLS.js
- **Lyrics:** `@uimaxbai/am-lyrics` web component + LRCLIB API + Genius API
- **State:** localStorage + IndexedDB (`db.js`)
- **Accounts:** PocketBase + BetterAuth (optional)
- **Styling:** Custom CSS with theme system

### Key Modules

| Module | Purpose |
|--------|---------|
| `js/api.js` | `LosslessAPI` class — search, track resolution, stream URL extraction, caching |
| `js/HiFi.ts` | `HiFiClient` — direct TIDAL API client with typed responses |
| `js/music-api.js` | `MusicAPI` — unified wrapper combining TIDAL (via HiFi) + tracks.monochrome.st |
| `js/tracks-api.js` | `TracksStreamerAPI` — Monochrome's own track streaming proxy (`tracks.monochrome.st`) |
| `js/player.js` | `Player` — playback engine: queue, shuffle, repeat, crossfade, seek, media session |
| `js/lyrics.js` | `LyricsManager` — LRCLIB + Genius lyrics fetching, LRC parsing, timing sync |
| `js/audio-context.js` | `AudioContextManager` — Web Audio API setup, analyser nodes, equalizer |
| `js/db.js` | IndexedDB wrapper for playlists, favorites, history, settings |
| `js/storage.js` | localStorage-based settings (quality, crossfade, replay gain, etc.) |
| `js/events.js` | DOM event wiring for playback controls, keyboard shortcuts, UI interactions |
| `js/cache.js` | `APICache` — TTL-based cache for API responses |
| `js/vibrant-color.js` | Album art dominant colour extraction |
| `js/visualizer.js` | Butterchurn (Milkdrop) + custom visualizer engine |
| `js/router.js` | Hash-based client-side routing |

## Music Sources

### 1. TIDAL (via HiFi API)
- **`HiFiClient`** (`js/HiFi.ts`) communicates with TIDAL's APIs through proxy workers
- Routes: `/search`, `/info`, `/track`, `/album`, `/artist`, `/cover`, `/recommendations`, `/playlist`
- Returns typed responses (`TidalTrack`, `TidalAlbum`, `TidalArtistProfile`, etc.)
- Stream manifest decoding: Base64 → JSON with `urls` array → streaming URL
- Supports DASH manifests for lossless/hi-res
- Instance failover: tries native TIDAL query first, then falls back to configured HiFi API instances

### 2. Monochrome Tracks API
- **`TracksStreamerAPI`** (`js/tracks-api.js`) at `https://tracks.monochrome.st`
- Endpoints: `/search`, `/track/{id}`, `/release/{id}`, `/artist/{id}`, `/stream/{id}`
- Normalizes data into Monochrome's internal track/album/artist format
- Provides streaming URLs independently of TIDAL

### 3. Apple Music (metadata only)
- **`AppleMusicAPI`** (`js/apple-music-api.js`) fetches developer tokens from `am-mint.binimum.org`
- Used for search ordering, autocomplete suggestions, and animated album artwork
- Not used for actual audio streaming

## Playback Flow

```
User searches → LosslessAPI.search() → HiFiClient.query("/search/?q=...") → TIDAL API
                                      ↓ fallback
                                      TracksStreamerAPI.search()

Track selected → Player.playTrack(track)
              → LosslessAPI.getStreamUrl(trackId, quality)
              → HiFi: /track/?id={id}&quality={quality}
              → Extract manifest → Decode Base64 → Get streaming URL
              → Set audio.src = streamUrl
              → audio.play()
```

### Stream Resolution
1. `LosslessAPI.getStreamUrl()` calls `/track/?id=X&quality=LOSSLESS`
2. Response contains a `manifest` field (Base64-encoded JSON)
3. Decoded manifest has `urls` array and codec info
4. For DASH: creates blob URL from XML manifest, uses Shaka Player
5. For direct: uses first URL from manifest `urls` array
6. Fallback: `TracksStreamerAPI.getStream()` for alternate source

## Lyrics System

### Sources
1. **LRCLIB** (`https://lrclib.net/api/get`) — primary, free, no auth required
   - Query params: `track_name`, `artist_name`, `album_name`, `duration`
   - Returns: `syncedLyrics` (LRC format), `plainLyrics`
2. **Genius** — annotations/meanings, requires API token via CORS proxy
3. **Apple Music TTML** — word-level timing via `@uimaxbai/am-lyrics`

### LRC Parsing
```javascript
// Format: [MM:SS.CC] text
parseSyncedLyrics(subtitles) {
    // Returns: [{ time: seconds, text: "lyrics text" }, ...]
}
```

### Synchronization
- `getCurrentLine(currentTime)` — binary scan to find active lyric line
- Uses `am-lyrics` web component for Apple Music TTML (word-level karaoke)
- Timing offset support (per-track, stored in localStorage)
- Romaji conversion for Japanese lyrics via Kuroshiro

## Audio Analysis
- `AudioContextManager` creates `AnalyserNode` connected to audio source
- Used by visualizer (Butterchurn/custom)
- FFT data available for frequency analysis

## Local Storage Schema
- **IndexedDB** (`db.js`): playlists, favorites, history, queue state
- **localStorage** (`storage.js`): settings, quality preferences, offsets

## API Limitations & Restrictions

> [!WARNING]
> - TIDAL HiFi API instances are configured to accept only official Monochrome domains
> - Self-hosted instances can only stream on `localhost`
> - `tracks.monochrome.st` may have rate limits and domain restrictions
> - Apple Music token minting requires authorized domains

## License
- **Apache 2.0** — allows derivative works with attribution
- Must retain copyright notices and state changes
- Cannot use Monochrome trademarks

## Reusable Concepts for Nocturne

### Can Reuse (concepts/patterns)
- LRCLIB lyrics fetching approach (free, no auth)
- LRC parsing logic
- Track data normalization patterns
- Queue/shuffle/repeat state management patterns
- Web Audio API analyser setup
- Media Session API integration

### Cannot Directly Reuse
- TIDAL HiFi API (domain-restricted, proprietary API)
- `tracks.monochrome.st` streaming (domain-restricted)
- Apple Music token minting
- PocketBase account system
- Genius API tokens (domain-specific)

### Integration Strategy for Nocturne
1. **Music Source:** Use `tracks.monochrome.st` API (runs on localhost per README) or implement modular provider that supports local files + pluggable streaming sources
2. **Lyrics:** Use LRCLIB directly (free, no domain restriction)
3. **Playback:** Build own Player class using HTML5 Audio + Web Audio API
4. **Audio Analysis:** Build own AnalyserNode pipeline for visualization
5. **Storage:** Use Electron's local file system + SQLite/JSON for persistence
