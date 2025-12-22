import AsyncStorage from '@react-native-async-storage/async-storage';

import type { XtreamCredentials } from './types';

const STORAGE_KEYS = {
  creds: 'xtream:creds',
  favorites: 'xtream:favorites',
};

export async function saveCredentials(creds: XtreamCredentials) {
  await AsyncStorage.setItem(STORAGE_KEYS.creds, JSON.stringify(creds));
}

export async function getCredentials(): Promise<XtreamCredentials | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.creds);
  return raw ? (JSON.parse(raw) as XtreamCredentials) : null;
}

export async function clearCredentials() {
  await AsyncStorage.removeItem(STORAGE_KEYS.creds);
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
