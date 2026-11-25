# Music Provider Architecture

Nocturne uses a modular, provider-agnostic music source layer (`src/services/music/`) coordinated by `MusicProviderManager` and persisted via `useProviderStore` (`src/stores/providerStore.ts`).

## 1. Core Contract (`IMusicProvider`)

All music sources implement `IMusicProvider` in `src/services/music/types.ts`:

```ts
export interface IMusicProvider {
  name: string;
  search(query: string): Promise<SearchResults>;
  getTrack(id: string): Promise<Track>;
  getStreamUrl(id: string): Promise<string>;
  getAlbum(id: string): Promise<Album & { tracks: Track[] }>;
  getArtist(id: string): Promise<Artist & { topTracks: Track[]; albums: Album[] }>;
}
```

### Extended Track & Quality Metadata
`Track` carries source-agnostic playback and matching metadata:
- **Source & Codec**: `provider`, `codec`, `bitrateKbps`, `sampleRateHz`, `isLossless`, `isPreview`, `quality`
- **Cross-Provider Linking**: `isrc`, `alternateSources?: TrackAlternateSource[]` (`{ provider, trackId, streamUrl?, quality? }`)
- **Quality Preferences**: `AudioQualityPreference = 'auto' | 'low' | 'standard' | 'high' | 'lossless'`

## 2. Registered Providers

| Provider ID | Class / Module | Role & Characteristics |
| --- | --- | --- |
| `tracks` | `TracksProvider` (`src/services/music/tracksProvider.ts`) | Streams catalog audio and release metadata from `https://tracks.monochrome.st` (`tracks:` prefixed IDs). |
| `itunes` | `ITunesProvider` (`src/services/music/itunesProvider.ts`) | Queries Apple's unauthenticated iTunes Search API (`country=IN` with `US` fallback) for broad Tamil, Indian, and independent catalog coverage. Returns `AAC` preview streams (`isPreview: true`, `isLossless: false`, `quality: 'STANDARD'`, `600x600bb` artwork). |
| `local` | `LocalFileProvider` (`src/services/music/provider.ts`) | Reads local audio files via Electron IPC (`window.electronAPI.openFiles`) or browser `File` objects. |

## 3. Unified Concurrent Search (`searchAll`)

`MusicProviderManager.searchAll(query, { providers?, signal?, timeoutMs? })` in `src/services/music/provider.ts`:

1. **Provider Selection**: Filters to enabled providers (or an explicit `providers` subset) ordered by configured priority (`providerPriority`).
2. **Concurrent Execution & Independent Timeouts**: Queries selected providers in parallel with independent per-provider timeouts (default `8000 ms`) and `AbortSignal` support.
3. **Partial Results on Failure**: If one provider times out or errors, healthy providers still return results while the failing provider's `ProviderHealth` status is updated (`degraded` / `offline` with `lastError`).
4. **Search Result Caching**: Caches normalized unified search responses by query/provider key; users can clear the cache via `clearSearchCache()` in Settings.
5. **Deduplication & Ranking**: Passes combined track results through `deduplicateAndRankTracks(tracks, query)`.

## 4. Unicode Normalization & Track Matching (`trackMatcher.ts`)

`src/services/music/trackMatcher.ts` provides Unicode-aware matching and deduplication without merging distinct recordings:

- **Unicode / Tamil Normalization**: `normalizeUnicodeQuery` and `normalizeTitle` apply Unicode normalization (NFC/NFKC), strip zero-width/control characters, normalize whitespace and punctuation, and preserve non-Latin scripts (such as Tamil Unicode and transliterated queries).
- **Version / Variant Guards**: Separate recordings are **not** merged into the same canonical track when they differ on:
  - Remixes / edits / club mixes
  - Live / acoustic / unplugged versions
  - Instrumental / karaoke / acapella versions
  - Covers / tribute versions
  - Explicit vs. clean variants
- **Alternate Source Merging**: Identical recordings across providers are merged into a single primary `Track` with additional sources attached to `alternateSources`.
- **Relevance Ranking**: Exact title + artist matches rank first, followed by prefix/substring matches and source quality/availability.

## 5. Provider Health Monitoring & Stream Fallback

- **Health Tracking**: `MusicProviderManager` maintains `ProviderHealth` per provider (`id`, `name`, `enabled`, `priority`, `status: 'healthy' | 'degraded' | 'offline' | 'unknown'`, `lastSuccessAt`, `lastError`).
- **Stream Resolution & Bounded Fallback**:
  - `getStreamUrl(id)` routes prefixed IDs (`tracks:`, `itunes:`, `local:`) to their owning provider.
  - When `autoFallback` is enabled in `useProviderStore` and the primary provider fails to resolve a stream URL, `MusicProviderManager` performs a bounded fallback across verified `alternateSources` attached to the track.
