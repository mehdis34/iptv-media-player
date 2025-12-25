import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  FavoriteItem,
  ResumeItem,
  XtreamCategory,
  XtreamCredentials,
  XtreamProfile,
  XtreamSeries,
  XtreamStream,
  XtreamVod,
} from './types';

const STORAGE_KEYS = {
  creds: 'xtream:creds',
  favorites: 'xtream:favorites',
  seriesFavorites: 'xtream:series_favorites',
  favoritesV2: 'xtream:favorites_v2',
  resumeV1: 'xtream:resume_v1',
  catalogCacheV1: 'xtream:catalog_cache_v1',
  profiles: 'xtream:profiles',
  activeProfileId: 'xtream:active_profile_id',
};
const DEFAULT_AVATAR_URL =
  'https://api.dicebear.com/7.x/avataaars/png?seed=Profil&backgroundColor=0b0b0f';
const DEFAULT_PROFILE_NAME = 'Profil';

export async function saveCredentials(creds: XtreamCredentials) {
  await addProfile(creds);
}

export async function getCredentials(): Promise<XtreamCredentials | null> {
  const profiles = await getProfiles();
  if (profiles.length) {
    const activeId = await getActiveProfileId();
    const active =
      profiles.find((profile) => profile.id === activeId) ?? profiles[0];
    return {
      host: active.host,
      username: active.username,
      password: active.password,
      profileName: active.profileName,
      profileAvatarUrl: active.profileAvatarUrl,
    };
  }

  const raw = await AsyncStorage.getItem(STORAGE_KEYS.creds);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Partial<XtreamCredentials>;
  const migrated: XtreamProfile = {
    id: `profile-${Date.now()}`,
    createdAt: Date.now(),
    host: parsed.host ?? '',
    username: parsed.username ?? '',
    password: parsed.password ?? '',
    profileName: parsed.profileName ?? DEFAULT_PROFILE_NAME,
    profileAvatarUrl: parsed.profileAvatarUrl ?? DEFAULT_AVATAR_URL,
  };
  await setProfiles([migrated]);
  await setActiveProfileId(migrated.id);
  return {
    host: migrated.host,
    username: migrated.username,
    password: migrated.password,
    profileName: migrated.profileName,
    profileAvatarUrl: migrated.profileAvatarUrl,
  };
}

export async function clearCredentials() {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.creds,
    STORAGE_KEYS.profiles,
    STORAGE_KEYS.activeProfileId,
  ]);
}

export async function getFavorites(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.favorites);
  return raw ? (JSON.parse(raw) as number[]) : [];
}

export async function toggleFavorite(streamId: number) {
  const favorites = await getFavorites();
  const next = favorites.includes(streamId)
    ? favorites.filter((id) => id !== streamId)
    : [...favorites, streamId];
  await AsyncStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(next));
  return next;
}

export async function getSeriesFavorites(): Promise<number[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.seriesFavorites);
  return raw ? (JSON.parse(raw) as number[]) : [];
}

export async function toggleSeriesFavorite(seriesId: number) {
  const favorites = await getSeriesFavorites();
  const next = favorites.includes(seriesId)
    ? favorites.filter((id) => id !== seriesId)
    : [...favorites, seriesId];
  await AsyncStorage.setItem(STORAGE_KEYS.seriesFavorites, JSON.stringify(next));
  return next;
}

type FavoritesByProfile = Record<string, FavoriteItem[]>;
type ResumeByProfile = Record<string, ResumeItem[]>;
type CatalogCacheKey =
  | 'liveCategories'
  | 'liveStreams'
  | 'vodCategories'
  | 'vodStreams'
  | 'seriesCategories'
  | 'seriesList';
type CatalogCache = {
  liveCategories: XtreamCategory[];
  liveStreams: XtreamStream[];
  vodCategories: XtreamCategory[];
  vodStreams: XtreamVod[];
  seriesCategories: XtreamCategory[];
  seriesList: XtreamSeries[];
};
type CatalogCacheEntry = { updatedAt: number; data: CatalogCache[CatalogCacheKey] };
type CatalogCacheMap = Record<string, Partial<Record<CatalogCacheKey, CatalogCacheEntry>>>;

export async function getFavoriteItems(): Promise<FavoriteItem[]> {
  const profileId = await getActiveProfileId();
  if (!profileId) return [];
  const map = await getFavoritesMap(profileId);
  if (map[profileId]) return map[profileId];

  const [legacyTv, legacySeries] = await Promise.all([
    getFavorites(),
    getSeriesFavorites(),
  ]);
  if (!legacyTv.length && !legacySeries.length) {
    map[profileId] = [];
    await setFavoritesMap(map);
    return [];
  }

  const now = Date.now();
  const migrated: FavoriteItem[] = [
    ...legacyTv.map((id) => ({ id, type: 'tv' as const, addedAt: now })),
    ...legacySeries.map((id) => ({ id, type: 'series' as const, addedAt: now })),
  ];
  map[profileId] = migrated;
  await setFavoritesMap(map);
  return migrated;
}

export async function toggleFavoriteItem(type: FavoriteItem['type'], id: number) {
  const profileId = await getActiveProfileId();
  if (!profileId) return [];
  const map = await getFavoritesMap(profileId);
  const favorites = map[profileId] ?? [];
  const exists = favorites.some((item) => item.type === type && item.id === id);
  const next = exists
    ? favorites.filter((item) => !(item.type === type && item.id === id))
    : [...favorites, { id, type, addedAt: Date.now() }];
  map[profileId] = next;
  await setFavoritesMap(map);
  return next;
}

export async function setFavoriteItems(items: FavoriteItem[]) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;
  const map = await getFavoritesMap(profileId);
  map[profileId] = items;
  await setFavoritesMap(map);
}

export async function getResumeItems(): Promise<ResumeItem[]> {
  const profileId = await getActiveProfileId();
  if (!profileId) return [];
  const map = await getResumeMap(profileId);
  return map[profileId] ?? [];
}

export async function getResumeItem(
  type: ResumeItem['type'],
  id: number
): Promise<ResumeItem | null> {
  const items = await getResumeItems();
  return items.find((item) => item.type === type && item.id === id) ?? null;
}

export async function upsertResumeItem(item: ResumeItem) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;
  const map = await getResumeMap(profileId);
  const items = map[profileId] ?? [];
  const index = items.findIndex(
    (entry) => entry.type === item.type && entry.id === item.id
  );
  if (index >= 0) {
    items[index] = { ...items[index], ...item };
  } else {
    items.push(item);
  }
  map[profileId] = items;
  await setResumeMap(map);
}

export async function clearResumeItem(type: ResumeItem['type'], id: number) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;
  const map = await getResumeMap(profileId);
  const items = map[profileId] ?? [];
  map[profileId] = items.filter((entry) => !(entry.type === type && entry.id === id));
  await setResumeMap(map);
}

export async function getProfiles(): Promise<XtreamProfile[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.profiles);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as XtreamProfile[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function getActiveProfileId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.activeProfileId);
}

export async function setActiveProfileId(profileId: string) {
  const profiles = await getProfiles();
  const active = profiles.find((profile) => profile.id === profileId);
  if (!active) return;
  await AsyncStorage.setItem(STORAGE_KEYS.activeProfileId, profileId);
  await AsyncStorage.setItem(
    STORAGE_KEYS.creds,
    JSON.stringify({
      host: active.host,
      username: active.username,
      password: active.password,
      profileName: active.profileName,
      profileAvatarUrl: active.profileAvatarUrl,
    })
  );
}

export async function addProfile(creds: XtreamCredentials) {
  const profiles = await getProfiles();
  const profile: XtreamProfile = {
    id: `profile-${Date.now()}`,
    createdAt: Date.now(),
    host: creds.host,
    username: creds.username,
    password: creds.password,
    profileName: creds.profileName || DEFAULT_PROFILE_NAME,
    profileAvatarUrl: creds.profileAvatarUrl || DEFAULT_AVATAR_URL,
  };
  const next = [profile, ...profiles];
  await setProfiles(next);
  await setActiveProfileId(profile.id);
  return profile;
}

export async function removeProfile(profileId: string) {
  const profiles = await getProfiles();
  const next = profiles.filter((profile) => profile.id !== profileId);
  await setProfiles(next);
  const favoritesMap = await getFavoritesMap(profileId);
  if (favoritesMap[profileId]) {
    delete favoritesMap[profileId];
    await setFavoritesMap(favoritesMap);
  }
  const activeId = await getActiveProfileId();
  if (activeId === profileId) {
    if (next[0]) {
      await setActiveProfileId(next[0].id);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.activeProfileId);
      await AsyncStorage.removeItem(STORAGE_KEYS.creds);
    }
  }
  return next;
}

export async function updateProfile(
  profileId: string,
  updates: Partial<XtreamCredentials>
) {
  const profiles = await getProfiles();
  const next = profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          profileName: updates.profileName ?? profile.profileName,
          profileAvatarUrl: updates.profileAvatarUrl ?? profile.profileAvatarUrl,
          host: updates.host ?? profile.host,
          username: updates.username ?? profile.username,
          password: updates.password ?? profile.password,
        }
      : profile
  );
  await setProfiles(next);
  const activeId = await getActiveProfileId();
  if (activeId === profileId) {
    const active = next.find((profile) => profile.id === profileId);
    if (active) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.creds,
        JSON.stringify({
          host: active.host,
          username: active.username,
          password: active.password,
          profileName: active.profileName,
          profileAvatarUrl: active.profileAvatarUrl,
        })
      );
    }
  }
  return next;
}

async function setProfiles(profiles: XtreamProfile[]) {
  await AsyncStorage.setItem(STORAGE_KEYS.profiles, JSON.stringify(profiles));
}

async function getFavoritesMap(profileId: string): Promise<FavoritesByProfile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.favoritesV2);
  if (!raw) return {};
  const parsed = JSON.parse(raw) as FavoritesByProfile | FavoriteItem[];
  if (Array.isArray(parsed)) {
    return profileId ? { [profileId]: parsed } : {};
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}

export async function getCatalogCache(): Promise<{
  data: Partial<CatalogCache>;
  updatedAt: Partial<Record<CatalogCacheKey, number>>;
}> {
  const profileId = await getActiveProfileId();
  if (!profileId) return { data: {}, updatedAt: {} };
  const map = await getCatalogCacheMap(profileId);
  const entries = map[profileId] ?? {};
  const data: Partial<CatalogCache> = {};
  const updatedAt: Partial<Record<CatalogCacheKey, number>> = {};
  (Object.keys(entries) as CatalogCacheKey[]).forEach((key) => {
    const entry = entries[key];
    if (!entry) return;
    data[key] = entry.data as CatalogCache[CatalogCacheKey];
    updatedAt[key] = entry.updatedAt;
  });
  return { data, updatedAt };
}

export async function setCatalogCache(partial: Partial<CatalogCache>) {
  const profileId = await getActiveProfileId();
  if (!profileId) return;
  const map = await getCatalogCacheMap(profileId);
  const entries = map[profileId] ?? {};
  const now = Date.now();
  (Object.keys(partial) as CatalogCacheKey[]).forEach((key) => {
    const value = partial[key];
    if (!value) return;
    entries[key] = { updatedAt: now, data: value } as CatalogCacheEntry;
  });
  map[profileId] = entries;
  await setCatalogCacheMap(map);
}

async function setFavoritesMap(map: FavoritesByProfile) {
  await AsyncStorage.setItem(STORAGE_KEYS.favoritesV2, JSON.stringify(map));
}

async function getResumeMap(profileId: string): Promise<ResumeByProfile> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.resumeV1);
  const parsed = raw ? (JSON.parse(raw) as ResumeByProfile) : {};
  if (!parsed[profileId]) {
    parsed[profileId] = [];
  }
  return parsed;
}

async function setResumeMap(map: ResumeByProfile) {
  await AsyncStorage.setItem(STORAGE_KEYS.resumeV1, JSON.stringify(map));
}

async function getCatalogCacheMap(profileId: string): Promise<CatalogCacheMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.catalogCacheV1);
  const parsed = raw ? (JSON.parse(raw) as CatalogCacheMap) : {};
  if (!parsed[profileId]) {
    parsed[profileId] = {};
  }
  return parsed;
}

async function setCatalogCacheMap(map: CatalogCacheMap) {
  await AsyncStorage.setItem(STORAGE_KEYS.catalogCacheV1, JSON.stringify(map));
}
