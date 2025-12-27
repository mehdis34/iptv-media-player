import * as SQLite from 'expo-sqlite';

import type {XtreamEpgListing} from './types';

export const EPG_CACHE_TTL_MS = 3 * 60 * 60 * 1000;

type EpgCacheEntry = {
  updatedAt: number;
  listingsByChannel: Record<string, XtreamEpgListing[]>;
  channelIdByName: Record<string, string>;
};

const DB_NAME = 'epg-cache.db';
const TABLE_NAME = 'epg_cache';

const epgCacheByProfile: Record<string, EpgCacheEntry> = {};

let dbPromise: Promise<ReturnType<typeof SQLite.openDatabaseAsync>> | null = null;
let initPromise: Promise<void> | null = null;

function getProfileKey(profileId: string | null) {
  return profileId ?? 'default';
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

async function ensureDb() {
  if (!initPromise) {
    initPromise = (async () => {
      const database = await getDb();
      await database.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          profile_id TEXT PRIMARY KEY,
          updated_at INTEGER NOT NULL,
          listings_json TEXT NOT NULL,
          channels_json TEXT NOT NULL
        );`
      );
    })();
  }
  return initPromise;
}

export async function getEpgCache(profileId: string | null) {
  const key = getProfileKey(profileId);
  const inMemory = epgCacheByProfile[key];
  if (inMemory) return inMemory;
  await ensureDb();
  const database = await getDb();
  const row = await database.getFirstAsync<{
    updated_at: number;
    listings_json: string;
    channels_json: string;
  }>(`SELECT updated_at, listings_json, channels_json FROM ${TABLE_NAME} WHERE profile_id = ?`, key);
  if (!row) return null;
  let listingsByChannel: Record<string, XtreamEpgListing[]> = {};
  let channelIdByName: Record<string, string> = {};
  try {
    listingsByChannel = JSON.parse(row.listings_json) ?? {};
  } catch {
    listingsByChannel = {};
  }
  try {
    channelIdByName = JSON.parse(row.channels_json) ?? {};
  } catch {
    channelIdByName = {};
  }
  const entry: EpgCacheEntry = {
    updatedAt: row.updated_at,
    listingsByChannel,
    channelIdByName,
  };
  epgCacheByProfile[key] = entry;
  return entry;
}

export async function setEpgCache(
  profileId: string | null,
  data: Omit<EpgCacheEntry, 'updatedAt'>
) {
  const key = getProfileKey(profileId);
  const entry: EpgCacheEntry = {
    updatedAt: Date.now(),
    listingsByChannel: data.listingsByChannel,
    channelIdByName: data.channelIdByName,
  };
  epgCacheByProfile[key] = entry;
  await ensureDb();
  const database = await getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO ${TABLE_NAME} (profile_id, updated_at, listings_json, channels_json) VALUES (?, ?, ?, ?)`,
    key,
    entry.updatedAt,
    JSON.stringify(entry.listingsByChannel),
    JSON.stringify(entry.channelIdByName)
  );
}

export async function clearEpgCache(profileId: string | null) {
  const key = getProfileKey(profileId);
  delete epgCacheByProfile[key];
  await ensureDb();
  const database = await getDb();
  await database.runAsync(`DELETE FROM ${TABLE_NAME} WHERE profile_id = ?`, key);
}

export function isEpgCacheFresh(entry: EpgCacheEntry, ttlMs = EPG_CACHE_TTL_MS) {
  return Date.now() - entry.updatedAt < ttlMs;
}
