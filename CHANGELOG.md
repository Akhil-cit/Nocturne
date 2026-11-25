# Changelog

All notable changes to Nocturne are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-11-25

### Added

#### Core Player
- Full-featured Electron desktop music player for Windows.
- Queue management with repeat and shuffle modes.
- Keyboard media-key support (play/pause, next, previous).
- Floating mini-player mode.

#### Visualizations
Eight real-time audio-reactive visualization modes:
- **Constellation** — star-field particle system with beat-synchronized word-by-word lyrics.
- **Cinematic** — full-screen ambient color wash derived from album art.
- **Floating** — drifting geometric shapes.
- **Karaoke** — large-text lyrics display with glow effects.
- **Minimal** — clean oscilloscope waveform.
- **Orbit** — rotating rings around album artwork.
- **Particle** — explosive frequency-reactive particle bursts.
- **Wave** — classic waveform bars.

#### Music Providers
- **Tracks** provider — mainstream global catalog with full-track playback.
- **JioSaavn** provider — extensive Indian music library (Hindi, Tamil, Telugu, etc.) with 320 kbps streams via public CDN URL decryption.
- **iTunes** metadata enrichment — album art and track metadata.
- **Local file** support — drag-and-drop playback.
- Automatic provider fallback chain with quality negotiation.
- 30-second preview guard preventing preview-only content from being misidentified as full tracks.

#### Lyrics
- Synchronized lyrics fetched from lrclib.
- Estimated word-level timing for Constellation mode.
- Fine-tune offset controls (+0.1 s / −0.1 s).
- Full Tamil and Unicode script support.

#### Audio
- Web Audio API integration for real-time frequency analysis.
- Audio-reactive edge lighting around the player shell.
- Animated album-art background using `color-thief-browser` palette extraction.

#### Testing
- Playwright Electron E2E test suite covering provider availability, JioSaavn regression (7 checks), and playback duration verification.

#### Documentation
- Architecture guide (`docs/architecture/ARCHITECTURE.md`).
- Music provider architecture overview.
- Provider comparison notes.
- Apache 2.0 license with Monochrome attribution.

---

[0.1.0]: https://github.com/Akhil-cit/Nocturne/releases/tag/v0.1.0
