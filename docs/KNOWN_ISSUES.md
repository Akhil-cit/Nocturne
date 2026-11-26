# Known Issues & Limitations

- **Windows Quick Settings / SMTC (`Win + A`)**: Chromium's `HardwareMediaKeyHandling` / `MediaSessionService` flags are enabled in `electron/main.ts`, but Windows Quick Settings media session registration may still be superseded or fail to appear when competing media apps (e.g., Spotify) are running.
- **Restored Playback Position**: Session restoration restores the track, queue, and saved timestamp; on some streaming sources, resuming may start from `0:00` if the media stream does not support seeking immediately on `canplay`.
- **Wired Headphone Inline Controls**: Hardware-dependent and not verified via automated testing.
- **Unsigned Windows Installer**: `Nocturne Setup 0.1.0.exe` is unsigned (`electron-builder` skips signing without a certificate), so Windows SmartScreen may display an unknown publisher warning.
- **Installer & Live Auto-Update**: Fresh NSIS installation, uninstallation, and version-to-version auto-update between two published GitHub Releases have not been verified end-to-end.
- **Provider Availability & Audio Quality**: Stream availability and codec/bitrate depend on upstream public providers (Tracks, JioSaavn, iTunes, Commons) and may vary by region or catalog entry.
