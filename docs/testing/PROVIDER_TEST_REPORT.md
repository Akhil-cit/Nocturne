# Nocturne — Multi-Provider & Tamil Discovery Test Report

**Date:** 2026-11-25  
**Executable:** `D:\Music\nocturne\release\win-unpacked\Nocturne.exe`

## 1. Automated Multi-Provider Playwright Results (`tests/providers.spec.mjs`)
| Test Case | Result | Details |
|---|---|---|
| Search `"Rathinamo"` across providers | **PASS** | Multi-provider search returned results (`ItunesProvider` + `TracksProvider`) |
| `iTunes` provider filter pill | **PASS** | Filtering to `iTunes` displayed `"Rathinamo"` results |
| Tamil Unicode search (`"முன்பே வா"`) | **PASS** | Returned Tamil catalog results |
| Transliteration search (`"Munbe Vaa"`) | **PASS** | Returned matching `"Munbe Vaa"` tracks |
| Settings → Music Sources UI | **PASS** | Rendered provider toggles, quality selector, and health status |
| Mini Player transparent window (`?mini=1`) | **PASS** | Opened transparent `?mini=1` window; `mini_player_fixed.png` verified `rgba(0, 0, 0, 0)` corners |

## 2. Playback Regression Results (`tests/playback.spec.mjs`)
- Re-executed against the newly built `Nocturne.exe` (see `test-artifacts/playback/regression_results.json`).

## 3. Phase 10 — 30-Second Preview Guard & Full-Track Filtering (`tests/providers.spec.mjs`, 9/9 PASS)
- **Root Cause Confirmed (`repro_unakke_log.json`):** `ItunesProvider` returned `Unakke Nizhalaanen` with full metadata duration (`2:39`) and `streamUrl: previewUrl` (`30.019s` AAC preview) when `TracksProvider` lacked the track.
- **Verified Fixes:**
  - `Full tracks only` filter is enabled by default and hides 30s-only iTunes previews (`Unakke Nizhalaanen` hidden by default).
  - When `Full tracks only` is toggled off, attempting to play `Unakke Nizhalaanen` refuses silent 30s preview substitution and displays an explicit error.
  - `playback.spec.mjs` re-verified **10/10 PASS** against `Nocturne.exe`.
