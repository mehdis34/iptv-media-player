import type {XtreamEpgListing} from './types';

export const EPG_CACHE_TTL_MS = 30 * 60 * 1000;

type EpgCacheEntry = {
  updatedAt: number;
  listingsByChannel: Record<string, XtreamEpgListing[]>;
  channelIdByName: Record<string, string>;
};

const epgCacheByProfile: Record<string, EpgCacheEntry> = {};

function getProfileKey(profileId: string | null) {
  return profileId ?? 'default';
}

export function getEpgCache(profileId: string | null) {
  return epgCacheByProfile[getProfileKey(profileId)] ?? null;
}

export function setEpgCache(
  profileId: string | null,
  data: Omit<EpgCacheEntry, 'updatedAt'>
) {
  epgCacheByProfile[getProfileKey(profileId)] = {
    updatedAt: Date.now(),
    ...data,
  };
}

export function clearEpgCache(profileId: string | null) {
  delete epgCacheByProfile[getProfileKey(profileId)];
}

export function isEpgCacheFresh(entry: EpgCacheEntry, ttlMs = EPG_CACHE_TTL_MS) {
  return Date.now() - entry.updatedAt < ttlMs;
}
