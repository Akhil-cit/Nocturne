# 🌙 Nocturne — Music Beyond Sound

<div align="center">

![Nocturne](assets/branding/banner.png)

**An immersive desktop music player with real-time audio visualizations and synchronized lyrics.**

[![Download Nocturne](https://img.shields.io/badge/Download-Nocturne%20v0.1.1-black?style=for-the-badge&logo=windows)](https://github.com/Akhil-cit/Nocturne/releases/tag/v0.1.1)

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-lightgrey)](https://github.com/Akhil-cit/Nocturne/releases)
[![Built with Electron](https://img.shields.io/badge/Built%20with-Electron-47848F)](https://www.electronjs.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB)](https://react.dev/)

</div>

---

## ✨ Features

### 🎨 Visualization Modes
Eight real-time audio-reactive visualizations powered by the Web Audio API:
- **Constellation** — star-field particle system that pulses with the beat
- **Cinematic** — full-screen ambient color wash
- **Floating** — drifting geometric shapes
- **Karaoke** — lyrics front-and-center with glow effects
- **Minimal** — clean waveform display
- **Orbit** — rotating rings around album art
- **Particle** — explosive frequency-reactive particles
- **Wave** — classic oscilloscope-style waveform

### 🎵 Music Sources
- **Tracks** — mainstream global catalog
- **JioSaavn** — extensive Indian music library (Hindi, Tamil, Telugu, and more)
- **iTunes** — album art and metadata enrichment
- **Local files** — drag-and-drop any local audio file

### 📝 Lyrics
- Synchronized word-by-word highlighting (Constellation view)
- Fetched from lrclib and estimated word timing
- Full Tamil / Unicode support
- Offset fine-tuning (+0.1 s / −0.1 s)

### 🎛️ Player
- Audio-reactive edge lighting around the player
- Animated album-art backgrounds
- Floating mini-player mode
- Queue management and repeat/shuffle
- Keyboard media-key support

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 20
- **npm** ≥ 10
- **Windows 10/11** (macOS and Linux support planned)

### Install

```bash
git clone https://github.com/Akhil-cit/Nocturne.git
cd Nocturne
npm install
```

### Development

```bash
npm run dev          # start Vite dev server
```

> **Note:** The Electron shell is launched separately. For a full Electron dev session:
> ```bash
> npm run electron:dev
> ```

### Production Build

```bash
npm run build        # TypeScript compile → Vite bundle → electron-builder
```

The installer is written to `release/`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron 36 |
| UI framework | React 19 + React Router v7 |
| Language | TypeScript 5 |
| Bundler | Vite 6 |
| Styling | Tailwind CSS v4 |
| State | Zustand 5 |
| Audio | Web Audio API |
| Crypto | des.js (MIT) — JioSaavn URL decryption |
| Testing | Playwright (Electron) |

---

## 📁 Project Structure

```
nocturne/
├── electron/           # Main process (Electron entry, IPC handlers)
├── src/
│   ├── components/     # Reusable React components
│   ├── features/       # Feature slices (player, search, queue…)
│   ├── hooks/          # Custom React hooks
│   ├── services/       # Music provider adapters, lyrics service
│   ├── stores/         # Zustand stores
│   ├── styles/         # Global CSS and Tailwind config
│   ├── types/          # TypeScript interfaces and enums
│   └── utils/          # Helpers and formatters
├── tests/              # Playwright E2E test specs
├── docs/               # Architecture, provider notes, dev logs
├── assets/             # Icons, branding, screenshots
├── .github/            # CI workflow and issue templates
└── electron-builder.yml
```

---

## 🧪 Testing

```bash
npm run test:regression   # JioSaavn provider regression (7 checks)
npm run test:providers    # Provider availability test suite
npm run test:playback     # Full Electron playback E2E tests
```

> Tests require the production build (`release/win-unpacked/Nocturne.exe`). Run `npm run build` first.

---

## ⚠️ Known Limitations

- **Windows only** — macOS and Linux builds are not yet configured in `electron-builder.yml`.
- **JioSaavn** covers the Indian catalog; availability of Western tracks may be limited.
- **Tracks** covers the mainstream global catalog; regional language tracks may be limited.
- Full-track playback availability depends on the music provider's catalog.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

---

## 🔒 Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy.

---

## 📜 License

This project is released under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.

Nocturne's architecture was inspired by the [Monochrome](https://github.com/nicholasgasior/monochrome) project (Apache 2.0). See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution details.
