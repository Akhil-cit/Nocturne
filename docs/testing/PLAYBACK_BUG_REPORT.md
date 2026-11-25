# Nocturne — Playback Bug Report

**Date:** 2026-11-25  
**Severity:** Critical / Release-Blocking  
**Status:** Fixed & Verified in `Nocturne.exe`

---

## 1. Original Reported Issue
- **Track:** `Verappa - From "Karuppu"` (1:40 / 100.29s)
- **Symptoms:** Playback stopped unexpectedly around `0:56` (`74.41s` in automated reproduction), and pressing the Play/Pause button failed to resume playback.

## 2. Reproduction & Runtime Evidence
- **Before Fix (`test-artifacts/playback/repro_verappa_log.json`):**
  - Streamed `https://tracks.monochrome.st/track/211827590276022272` (`206 Partial Content`, `23,435,172` bytes).
  - At `~58s` into playback, Chromium logged `Failed to load resource: net::ERR_QUIC_PROTOCOL_ERROR`.
  - The fallback range request (`6,657,956` bytes) over HTTP/3 QUIC stalled (`buffered` crawled `72.08 -> 72.39 -> 72.57 -> 76.23`), exhausting the buffer (`readyState: 2`, `networkState: 2`, `waiting` event at `72.96s` and `74.411s`).
  - Clicking the Play/Pause button resulted in `AFTER_PLAY_CLICK: {"currentTime":74.410667,"paused":true,"readyState":3,"networkState":2}`.

## 3. Confirmed Root Causes
1. **HTTP/3 QUIC Stream Drops (`net::ERR_QUIC_PROTOCOL_ERROR`):** Electron/Chromium's QUIC transport dropped long-lived `206` range requests for large lossless FLAC streams from `tracks.monochrome.st`, causing severe throttling and buffer starvation.
2. **PlaybackEngine State & Recovery Gaps (`src/services/playback/engine.ts`):**
   - `PlaybackEngine` had no stall watchdog or bounded retry/recovery with position restoration.
   - `PlaybackEngine.playing` remained `true` during `waiting`/`stalled` buffering, so `toggle()` saw `if (this.playing)` and called `this.pause()` instead of recovering or resuming!
   - `loadAndPlayIndex()` lacked a monotonic sequence guard against stale async stream resolution races.

## 4. Affected Files & Fix Implementation
- [`electron/main.ts`](file:///d:/Music/nocturne/electron/main.ts): Added `app.commandLine.appendSwitch('disable-quic')` before `app.whenReady()` to force reliable HTTP/2 over TCP for long audio streams.
- [`src/services/playback/engine.ts`](file:///d:/Music/nocturne/src/services/playback/engine.ts):
  - Added explicit `PlaybackStatus` (`'idle' | 'loading' | 'buffering' | 'playing' | 'paused' | 'error'`) and `statuschange` event.
  - Added `userPaused` flag so automatic recovery never overrides an intentional user pause.
  - Added `6000ms` stall watchdog on `waiting`/`stalled` and bounded exponential-backoff recovery (`maxRecoveryAttempts = 3`) with stream URL refresh and `currentTime` restoration on `loadedmetadata`.
  - Added monotonic `loadSequence` guard in `loadAndPlayIndex()`.
  - Updated `toggle()` to call `retry()` when `status === 'error'` or stalled in `buffering`, and added public `retry()`.
- [`src/stores/playerStore.ts`](file:///d:/Music/nocturne/src/stores/playerStore.ts): Exposed `status`, `isBuffering`, and `retry()`.
- [`src/components/player/NowPlaying.tsx`](file:///d:/Music/nocturne/src/components/player/NowPlaying.tsx): Added `Buffering stream...` indicator and error banner with a functional **Retry** button.

## 5. Verification Results (After Fix in Packaged `Nocturne.exe`)
- **Live `"Verappa - From Karuppu"` Full-Track Run (`test-artifacts/playback/after_verappa_log.json`):**
  - Played smoothly from `0:00` through `0:56` (`56.13s`) all the way to `100.29s` (`readyState: 4`, `0` errors, `0` stalls), and automatically transitioned to the next queued track (`168.32s`).
- **Automated Playwright Regression Suite (`npm run test:playback` / `tests/playback.spec.mjs`):** **10/10 PASS**:
  1. Audio playback advances (`t0=1.50 -> t1=3.01`)
  2. Intentional pause holds position
  3. Resume from intentional pause
  4. Seek forward via lyric line (`t=8.99`)
  5. Continuous playback in Immersive mode
  6. Queue transitions to next track on end (`fixture_track_2`)
  7. Rapid track switching remains stable
  8. Playback continues across minimize/restore
  9. Live search & stream playback advances (`Verappa`, `t1=2.98 -> t2=4.99`)
  10. Transient `503` stream failure recovers automatically (`intercepts=2`, `t1=2.14 -> t2=4.15`)

## 6. Remaining Limitations
- A 20–30 minute continuous soak test was not executed within this session's time budget; `tests/playback.spec.mjs` and `repro_verappa.mjs` are preserved in the repository for extended soak verification.
