import type { Router } from 'expo-router';

import { getCredentials } from './storage';
import { fetchSeriesInfo } from './xtream';

export async function handlePlaySeries(
  router: Router,
  seriesId: number,
  seriesName: string
) {
  try {
    const creds = await getCredentials();
    if (!creds) {
      router.replace('/login');
      return;
    }
    const info = await fetchSeriesInfo(creds, seriesId);
    const episodesBySeason = info.episodes ?? {};
    const seasons = Object.keys(episodesBySeason)
      .map((key) => Number(key))
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b);
    const firstSeason = seasons[0];
    const firstEpisode =
      firstSeason !== undefined
        ? episodesBySeason[String(firstSeason)]?.find((ep) => ep.id)
        : undefined;
    if (!firstEpisode) {
      router.push({
        pathname: '/series/[id]' as const,
        params: { id: String(seriesId), name: seriesName },
      });
      return;
    }
    router.push({
      pathname: '/player/[id]' as const,
      params: {
        id: String(firstEpisode.id),
        name: seriesName,
        type: 'series',
        ext: firstEpisode.container_extension ?? 'mp4',
        seriesId: String(seriesId),
        season: firstSeason !== undefined ? String(firstSeason) : undefined,
      },
    });
  } catch (_err) {
    router.push({
      pathname: '/series/[id]' as const,
      params: { id: String(seriesId), name: seriesName },
    });
  }
}
