import type { Track } from './types';
import { musicProviderManager } from './provider';
import { useRecommendationStore } from '@/stores/recommendationStore';

const radioCache = new Map<string, Track[]>();

function deduplicateTracks(candidates: Track[], excludeIds: Set<string>): Track[] {
  const seen = new Set<string>(excludeIds);
  const out: Track[] = [];
  for (const t of candidates) {
    if (!t.id || seen.has(t.id)) continue;
    const titleKey = `${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
    if (seen.has(titleKey)) continue;
    seen.add(t.id);
    seen.add(titleKey);
    out.push(t);
  }
  return out;
}

export async function getSongRadio(seed: Track, limit = 20): Promise<Track[]> {
  const cacheKey = `song:${seed.id}`;
  const cached = radioCache.get(cacheKey);
  if (cached) return cached.slice(0, limit);

  const primaryArtist = seed.artists?.[0]?.name || seed.artist.split(/[,&]/)[0]?.trim() || seed.artist;
  const excluded = new Set(useRecommendationStore.getState().excludedTrackIds);
  excluded.add(seed.id);

  const results = await musicProviderManager.searchAll(primaryArtist).catch(() => ({
    tracks: [],
    artists: [],
    albums: [],
  }));

  const unique = deduplicateTracks(results.tracks, excluded).slice(0, limit);
  const queue = [seed, ...unique];
  if (unique.length > 0) radioCache.set(cacheKey, queue);
  return queue;
}

export async function getArtistRadio(artistName: string, limit = 20): Promise<Track[]> {
  const cacheKey = `artist:${artistName.toLowerCase()}`;
  const cached = radioCache.get(cacheKey);
  if (cached) return cached.slice(0, limit);

  const excluded = new Set(useRecommendationStore.getState().excludedTrackIds);
  const results = await musicProviderManager.searchAll(artistName).catch(() => ({
    tracks: [],
    artists: [],
    albums: [],
  }));

  const unique = deduplicateTracks(results.tracks, excluded).slice(0, limit);
  if (unique.length > 0) radioCache.set(cacheKey, unique);
  return unique;
}

export async function getPlaylistRecommendations(
  playlistTracks: Track[],
  limit = 10
): Promise<Track[]> {
  if (playlistTracks.length === 0) return [];
  const excluded = new Set([
    ...useRecommendationStore.getState().excludedTrackIds,
    ...playlistTracks.map((t) => t.id),
  ]);

  const seedArtist =
    playlistTracks[0].artists?.[0]?.name ||
    playlistTracks[0].artist.split(/[,&]/)[0]?.trim() ||
    playlistTracks[0].artist;

  const results = await musicProviderManager.searchAll(seedArtist).catch(() => ({
    tracks: [],
    artists: [],
    albums: [],
  }));

  return deduplicateTracks(results.tracks, excluded).slice(0, limit);
}

export async function getAutoplayNextTrack(
  currentTrack: Track,
  recentIds: string[]
): Promise<Track | null> {
  const { autoplayEnabled, excludedTrackIds } = useRecommendationStore.getState();
  if (!autoplayEnabled) return null;

  const radio = await getSongRadio(currentTrack, 15);
  const skip = new Set([...recentIds, ...excludedTrackIds, currentTrack.id]);
  return radio.find((t) => !skip.has(t.id)) ?? null;
}
