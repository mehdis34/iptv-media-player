import * as SQLite from 'expo-sqlite';

import {getProfileCacheKey} from '@/lib/catalog.utils';
import {getActiveProfileId, getCredentials} from '@/lib/storage';
import type {XtreamVodInfo} from '@/lib/types';
import {fetchVodInfo} from '@/lib/xtream';

type VodInfoCacheEntry = {
    updatedAt: number;
    info: XtreamVodInfo;
};

const DB_NAME = 'vod-info-cache.db';
const TABLE_NAME = 'vod_info_cache';

const cacheByProfile: Record<string, Map<number, VodInfoCacheEntry>> = {};
const pendingByKey = new Map<string, Promise<XtreamVodInfo | null>>();

let dbPromise: Promise<ReturnType<typeof SQLite.openDatabaseAsync>> | null = null;
let initPromise: Promise<void> | null = null;

function getProfileMap(profileKey: string) {
    if (!cacheByProfile[profileKey]) {
        cacheByProfile[profileKey] = new Map();
    }
    return cacheByProfile[profileKey];
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
          profile_id TEXT NOT NULL,
          stream_id INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          info_json TEXT NOT NULL,
          PRIMARY KEY (profile_id, stream_id)
        );
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_profile_id ON ${TABLE_NAME}(profile_id);`
            );
        })();
    }
    return initPromise;
}

export async function getVodInfoCache(
    profileId: string | null,
    streamId: number
): Promise<VodInfoCacheEntry | null> {
    if (!streamId) return null;
    const profileKey = getProfileCacheKey(profileId);
    const profileCache = getProfileMap(profileKey);
    const inMemory = profileCache.get(streamId);
    if (inMemory) return inMemory;

    await ensureDb();
    const database = await getDb();
    const row = await database.getFirstAsync<{
        updated_at: number;
        info_json: string;
    }>(
        `SELECT updated_at, info_json FROM ${TABLE_NAME} WHERE profile_id = ? AND stream_id = ?`,
        profileKey,
        streamId
    );
    if (!row) return null;
    let info: XtreamVodInfo = {};
    try {
        info = JSON.parse(row.info_json) as XtreamVodInfo;
    } catch {
        info = {};
    }
    const entry: VodInfoCacheEntry = {
        updatedAt: row.updated_at,
        info,
    };
    profileCache.set(streamId, entry);
    return entry;
}

export async function setVodInfoCache(
    profileId: string | null,
    streamId: number,
    info: XtreamVodInfo
) {
    if (!streamId) return;
    const profileKey = getProfileCacheKey(profileId);
    const entry: VodInfoCacheEntry = {
        updatedAt: Date.now(),
        info,
    };
    getProfileMap(profileKey).set(streamId, entry);
    await ensureDb();
    const database = await getDb();
    await database.runAsync(
        `INSERT OR REPLACE INTO ${TABLE_NAME} (profile_id, stream_id, updated_at, info_json) VALUES (?, ?, ?, ?)`,
        profileKey,
        streamId,
        entry.updatedAt,
        JSON.stringify(info)
    );
}

export async function getVodInfoWithCache(streamId: number) {
    if (!streamId) return null;
    const profileId = await getActiveProfileId();
    const profileKey = getProfileCacheKey(profileId);
    const cacheKey = `${profileKey}:${streamId}`;
    const existing = pendingByKey.get(cacheKey);
    if (existing) return existing;

    const pending = (async () => {
        try {
            const cached = await getVodInfoCache(profileId, streamId);
            if (cached?.info) return cached.info;
            const creds = await getCredentials();
            if (!creds) return null;
            const info = await fetchVodInfo(creds, streamId);
            await setVodInfoCache(profileId, streamId, info);
            return info;
        } catch {
            return null;
        }
    })().finally(() => {
        pendingByKey.delete(cacheKey);
    });

    pendingByKey.set(cacheKey, pending);
    return pending;
}
