import * as SQLite from 'expo-sqlite';

import type {XtreamCategory, XtreamSeries, XtreamStream, XtreamVod} from './types';

export type CatalogCacheKey =
  | 'liveCategories'
  | 'liveStreams'
  | 'vodCategories'
  | 'vodStreams'
  | 'seriesCategories'
  | 'seriesList';

export type CatalogCache = {
  liveCategories: XtreamCategory[];
  liveStreams: XtreamStream[];
  vodCategories: XtreamCategory[];
  vodStreams: XtreamVod[];
  seriesCategories: XtreamCategory[];
  seriesList: XtreamSeries[];
};

type SqlValue = string | number | null;

export type CatalogCacheRow = {
  profileId: string;
  cacheKey: CatalogCacheKey;
  updatedAt: number;
  data: CatalogCache[CatalogCacheKey];
};

const DB_NAME = 'catalog-cache.db';
const TABLE_NAME = 'catalog_cache';

let dbPromise: Promise<ReturnType<typeof SQLite.openDatabaseAsync>> | null = null;
let initPromise: Promise<void> | null = null;

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
          cache_key TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (profile_id, cache_key)
        );
        CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_profile_id ON ${TABLE_NAME}(profile_id);`
      );
    })();
  }
  return initPromise;
}

export async function getCatalogCacheEntries(
  profileId: string,
  keys?: ReadonlyArray<CatalogCacheKey>
) {
  if (!profileId) {
    return { data: {}, updatedAt: {} };
  }
  await ensureDb();
  const params: SqlValue[] = [profileId];
  let sql = `SELECT cache_key, updated_at, data FROM ${TABLE_NAME} WHERE profile_id = ?`;
  if (keys && keys.length) {
    const placeholders = keys.map(() => '?').join(', ');
    sql += ` AND cache_key IN (${placeholders})`;
    params.push(...keys);
  }
  const database = await getDb();
  const rows = await database.getAllAsync<{
    cache_key: string;
    updated_at: number;
    data: string;
  }>(sql, ...params);
  const data: Partial<CatalogCache> = {};
  const updatedAt: Partial<Record<CatalogCacheKey, number>> = {};
  rows.forEach((row: { cache_key: string; updated_at: number; data: string }) => {
    const key = row.cache_key as CatalogCacheKey;
    updatedAt[key] = row.updated_at;
    if (!row.data) return;
    try {
      data[key] = JSON.parse(row.data) as CatalogCache[CatalogCacheKey];
    } catch {
      // Ignore invalid cache payloads.
    }
  });
  return { data, updatedAt };
}

export async function setCatalogCacheEntries(
  profileId: string,
  partial: Partial<CatalogCache>
) {
  if (!profileId) return;
  await ensureDb();
  const now = Date.now();
  const statements: Array<{ sql: string; params: SqlValue[] }> = [];
  (Object.keys(partial) as CatalogCacheKey[]).forEach((key) => {
    const value = partial[key];
    if (value === undefined) return;
    statements.push({
      sql: `INSERT OR REPLACE INTO ${TABLE_NAME} (profile_id, cache_key, updated_at, data) VALUES (?, ?, ?, ?)`,
      params: [profileId, key, now, JSON.stringify(value)],
    });
  });
  if (!statements.length) return;
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const statement of statements) {
      await database.runAsync(statement.sql, ...statement.params);
    }
  });
}

export async function upsertCatalogCacheEntries(entries: CatalogCacheRow[]) {
  if (!entries.length) return;
  await ensureDb();
  const statements = entries.map((entry) => ({
    sql: `INSERT OR REPLACE INTO ${TABLE_NAME} (profile_id, cache_key, updated_at, data) VALUES (?, ?, ?, ?)`,
    params: [
      entry.profileId,
      entry.cacheKey,
      entry.updatedAt,
      JSON.stringify(entry.data),
    ],
  }));
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    for (const statement of statements) {
      await database.runAsync(statement.sql, ...statement.params);
    }
  });
}

export async function clearCatalogCacheEntries(profileId?: string | null) {
  await ensureDb();
  const database = await getDb();
  if (profileId) {
    await database.runAsync(`DELETE FROM ${TABLE_NAME} WHERE profile_id = ?`, profileId);
    return;
  }
  await database.runAsync(`DELETE FROM ${TABLE_NAME}`);
}
