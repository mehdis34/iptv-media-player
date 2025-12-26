import ImageColors from 'react-native-image-colors';
import type { XtreamSeries, XtreamVod } from './types';

export function safeImageUri(uri?: string) {
  if (!uri) return undefined;
  const trimmed = uri.trim();
  if (!trimmed) return undefined;
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

export function getLatestVod(vod: XtreamVod[]) {
  const latestVod = vod[vod.length - 1];
  if (!latestVod) return null;
  return {
    id: latestVod.stream_id,
    type: 'movie' as const,
    extension: latestVod.container_extension,
    title: latestVod.name,
    image: safeImageUri(latestVod.cover ?? latestVod.stream_icon),
    badge: 'Film',
  };
}

export function getLatestSeries(series: XtreamSeries[]) {
  const latestSeries = series[series.length - 1];
  if (!latestSeries) return null;
  return {
    id: latestSeries.series_id,
    type: 'series' as const,
    title: latestSeries.name,
    image: safeImageUri(latestSeries.cover ?? latestSeries.backdrop_path?.[0]),
    badge: 'Série',
  };
}

export async function getDominantColor(uri?: string) {
  const safe = safeImageUri(uri);
  if (!safe) return undefined;
  try {
    const result: any = await ImageColors.getColors(safe, {
      cache: true,
      key: safe,
      fallback: '#000000',
    });
    const color =
      result?.dominant || result?.background || result?.average || result?.primary;
    return darkenHex(color ?? '#000000', 0.5);
  } catch {
    return undefined;
  }
}

function darkenHex(hex: string, amount: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const factor = Math.max(0, Math.min(1, 1 - amount));
  const nr = Math.round(r * factor);
  const ng = Math.round(g * factor);
  const nb = Math.round(b * factor);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}
