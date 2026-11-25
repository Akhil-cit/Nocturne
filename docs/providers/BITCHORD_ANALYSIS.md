# BitChord Repository Analysis (`BitChord-main/`)

## 1. Overview & License
- **Location:** `d:\Music\BitChord-main\BitChord-main\`
- **License:** **GNU General Public License v3.0 (GPL-3.0)** (`LICENSE`).
  - **Compatibility Note:** Because Nocturne is Apache-2.0 compatible, **no GPL-3.0 source code from BitChord is copied into Nocturne**. Instead, we analyze its architecture, public APIs, and engineering patterns to design our own original TypeScript implementations.

## 2. Architecture & Technology Stack
- **Multi-Platform Monorepo:**
  - `app/` — Android (Kotlin / Jetpack Compose)
  - `tv/` & `wearos/` — Android TV & Wear OS
  - `backend/` — Go server (`clock`, `codes`, `hub`, `party`, `presence`)
  - `native/` — C++ (`analyzer`, `ffmpeg`, `loopmix`, `onnxruntime`)
  - `web/` — Web app (`pnpm` workspace: `@bitchord/app`, `@bitchord/extension`, `@bitchord/shared`) using React + TypeScript + Vite.

## 3. Music Sources, Search & Playback Flow (`web/app/src/`)
- **Catalog & Metadata (`data/music/`, `data/apple/`, `data/spotify/`):**
  - Uses Apple Music / Spotify metadata APIs (via extension/web tokens) for catalog browsing, artist pages, and motion artwork.
  - **Track Matching (`data/match/trackMatcher.ts`):** Matches catalog tracks to playable streams using normalized title, artist, duration, and version/remix/live/instrumental guards.
- **Audio Stream Resolution (`playback/youtube/`):**
  - Uses YouTube InnerTube (`innertube.ts`, `resolver.ts`, `botguard.ts`) + `ShakaPlayerAdapter.ts` for DASH/video/audio playback.
  - **Authorization/Restrictions:** InnerTube + BotGuard requires browser-extension or PoToken/session workarounds and is subject to YouTube's Terms of Service. Therefore, Nocturne does **not** bundle unauthenticated YouTube scraping or BotGuard bypasses.
- **Lyrics (`lyrics/`):**
  - `providers.ts` & `sources.ts`: Multi-provider lyrics (LRCLIB, TTML, YouTube captions) with `clock.ts` synchronization, `parse.ts` (LRC/TTML), and `repository.ts` local caching.
- **Queue & AutoMix (`playback/queue/`, `playback/automix/`):**
  - `builder.ts` & `timeline.ts` for queue management; `automix/` for beat-matched crossfading.

## 4. Key Takeaways for Nocturne
1. **Multi-Provider Search & Ranking:** BitChord's `data/match/trackMatcher.ts` pattern (normalizing titles, guarding against mixing live/remix/instrumental/cover versions) is ideal for Nocturne's unified multi-provider search.
2. **Additional Authorized Free Catalog Coverage:** To solve missing Tamil, independent, and regional Indian tracks (such as `"Rathinamo"`), Nocturne can integrate **iTunes Search API** (`https://itunes.apple.com/search` — free, no auth, massive Tamil/Indian/independent catalog, 30s AAC previews + rich metadata/artwork/ISRC) and **Jamendo / Audius** or **MusicBrainz** metadata, alongside `TracksProvider` (`tracks.monochrome.st`) and `LocalFileProvider`!
3. **Multi-Source Lyrics:** BitChord's `lyrics/repository.ts` pattern reinforces Nocturne's LRCLIB + local cache + `.lrc` import pipeline.
