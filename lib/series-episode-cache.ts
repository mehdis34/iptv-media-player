import AsyncStorage from '@react-native-async-storage/async-storage';

type SeriesEpisodeCache = {
  updatedAt: number;
  items: Record<string, number>;
};

type SeriesEpisodeCacheByProfile = Record<string, SeriesEpisodeCache>;

const STORAGE_KEY = 'xtream:series_episode_meta_v1';

export async function getSeriesEpisodeCache(profileId: string | null) {
  if (!profileId) return { updatedAt: 0, items: {} as Record<string, number> };
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { updatedAt: 0, items: {} as Record<string, number> };
  try {
    const parsed = JSON.parse(raw) as SeriesEpisodeCacheByProfile;
    const entry = parsed[profileId];
    if (!entry) return { updatedAt: 0, items: {} as Record<string, number> };
    return entry;
  } catch {
    return { updatedAt: 0, items: {} as Record<string, number> };
  }
}

export async function setSeriesEpisodeCache(
  profileId: string | null,
  items: Record<string, number>
) {
  if (!profileId) return;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const existing = raw ? (JSON.parse(raw) as SeriesEpisodeCacheByProfile) : {};
  existing[profileId] = {
    updatedAt: Date.now(),
    items,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}
