import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { getCredentials, getFavoriteItems, toggleFavoriteItem } from '@/lib/storage';
import { fetchLiveStreams, fetchSeries, fetchVodStreams } from '@/lib/xtream';
import type { FavoriteItem, XtreamSeries, XtreamStream, XtreamVod } from '@/lib/types';

export default function LibraryScreen() {
  const router = useRouter();
  const [streams, setStreams] = useState<XtreamStream[]>([]);
  const [movies, setMovies] = useState<XtreamVod[]>([]);
  const [series, setSeries] = useState<XtreamSeries[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'movie' | 'series' | 'tv'>('movie');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    async function load() {
      try {
        const creds = await getCredentials();
        if (!creds) {
          router.replace('/login');
          return;
        }
        const [live, vod, seriesList, favs] = await Promise.all([
          fetchLiveStreams(creds),
          fetchVodStreams(creds),
          fetchSeries(creds),
          getFavoriteItems(),
        ]);
        if (!mounted) return;
        setStreams(live);
        setMovies(vod);
        setSeries(seriesList);
        setFavorites(favs);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Favoris indisponibles.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  useFocusEffect(loadData);

  const filteredItems = useMemo(() => {
    const ids = favorites.filter((fav) => fav.type === activeFilter).map((fav) => fav.id);
    if (activeFilter === 'tv') {
      return streams.filter((stream) => ids.includes(stream.stream_id));
    }
    if (activeFilter === 'series') {
      return series.filter((item) => ids.includes(item.series_id));
    }
    return movies.filter((item) => ids.includes(item.stream_id));
  }, [activeFilter, favorites, movies, series, streams]);

  const handleRemove = async (type: FavoriteItem['type'], id: number) => {
    const next = await toggleFavoriteItem(type, id);
    setFavorites(next);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <Text className="font-body text-mist">Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-ink px-6">
        <Text className="font-body text-ember">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink px-6 pt-12">
      <Text className="font-display text-3xl text-white tracking-[3px]">Ma liste</Text>
      <Text className="mt-1 font-body text-sm text-mist">Vos favoris</Text>

      <View className="mt-5 flex-row gap-3">
        {[
          { key: 'movie', label: 'Films' },
          { key: 'series', label: 'Séries' },
          { key: 'tv', label: 'TV' },
        ].map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setActiveFilter(item.key as 'movie' | 'series' | 'tv')}
            className={`rounded-full border px-4 py-2 ${
              activeFilter === item.key
                ? 'border-white/30 bg-white/15'
                : 'border-white/10 bg-white/5'
            }`}
          >
            <Text className="font-body text-sm text-white">{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="mt-6">
        <View className="gap-3 pb-12">
          {filteredItems.length === 0 ? (
            <View className="rounded-2xl border border-ash bg-ash/40 px-4 py-6">
              <Text className="font-body text-center text-mist">
                Aucun favori pour le moment.
              </Text>
            </View>
          ) : activeFilter === 'tv' ? (
            (filteredItems as XtreamStream[]).map((stream) => (
              <Pressable
                key={stream.stream_id}
                onPress={() =>
                  router.push({
                    pathname: '/player/[id]' as const,
                    params: { id: String(stream.stream_id), name: stream.name, type: 'tv' },
                  })
                }
                className="rounded-2xl border border-ash bg-ash/40 px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-base text-white" numberOfLines={1}>
                    {stream.name}
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRemove('tv', stream.stream_id);
                    }}
                  >
                    <Text className="font-body text-xs text-ember">Retirer</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          ) : activeFilter === 'series' ? (
            (filteredItems as XtreamSeries[]).map((item) => (
              <Pressable
                key={item.series_id}
                onPress={() =>
                  router.push({
                    pathname: '/series/[id]' as const,
                    params: { id: String(item.series_id), name: item.name },
                  })
                }
                className="rounded-2xl border border-ash bg-ash/40 px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-base text-white" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRemove('series', item.series_id);
                    }}
                  >
                    <Text className="font-body text-xs text-ember">Retirer</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          ) : (
            (filteredItems as XtreamVod[]).map((item) => (
              <Pressable
                key={item.stream_id}
                onPress={() =>
                  router.push({
                    pathname: '/movie/[id]' as const,
                    params: { id: String(item.stream_id), name: item.name },
                  })
                }
                className="rounded-2xl border border-ash bg-ash/40 px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-base text-white" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleRemove('movie', item.stream_id);
                    }}
                  >
                    <Text className="font-body text-xs text-ember">Retirer</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
