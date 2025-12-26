import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import ChannelCard from '@/components/ChannelCard';
import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import MediaGrid from '@/components/MediaGrid';
import SectionHeader from '@/components/SectionHeader';
import { getDominantColor } from '@/lib/media';
import {
  getCatalogCache,
  getCredentials,
  getFavoriteItems,
  getResumeItems,
  setCatalogCache,
  toggleFavoriteItem,
} from '@/lib/storage';
import { fetchLiveStreams, fetchSeries, fetchVodStreams } from '@/lib/xtream';
import type { FavoriteItem, ResumeItem, XtreamSeries, XtreamStream, XtreamVod } from '@/lib/types';
import { handlePlaySeries as handlePlaySeriesFromUtils } from '@/lib/series.utils';

type RouteParams = {
  type?: 'tv' | 'movies' | 'series';
  id?: string;
  name?: string;
};

export default function CategoryScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const headerHeight = 96;
  const { type, id, name } = useLocalSearchParams<RouteParams>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
  const [tvItems, setTvItems] = useState<XtreamStream[]>([]);
  const [movieItems, setMovieItems] = useState<XtreamVod[]>([]);
  const [seriesItems, setSeriesItems] = useState<XtreamSeries[]>([]);
  const catalogCacheTtl = 6 * 60 * 60 * 1000;

  const handlePlaySeries = useCallback(
    async (seriesId: number, seriesName: string) => {
      await handlePlaySeriesFromUtils(router, seriesId, seriesName);
    },
    [router]
  );
  const [heroTone, setHeroTone] = useState('#000000');
  const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const creds = await getCredentials();
        if (!creds || !type || !id) {
          return;
        }
        const cache = await getCatalogCache();
        const now = Date.now();
        const cacheFresh =
          cache.updatedAt.liveStreams &&
          cache.updatedAt.vodStreams &&
          cache.updatedAt.seriesList &&
          now - cache.updatedAt.liveStreams < catalogCacheTtl &&
          now - cache.updatedAt.vodStreams < catalogCacheTtl &&
          now - cache.updatedAt.seriesList < catalogCacheTtl;

        if (cache.data.liveStreams && type === 'tv') {
          const live = cache.data.liveStreams;
          setTvItems(id === 'all' ? live : live.filter((item) => item.category_id === id));
        }
        if (cache.data.vodStreams && type === 'movies') {
          const vod = cache.data.vodStreams;
          setMovieItems(id === 'all' ? vod : vod.filter((item) => item.category_id === id));
        }
        if (cache.data.seriesList && type === 'series') {
          const list = cache.data.seriesList;
          setSeriesItems(id === 'all' ? list : list.filter((item) => item.category_id === id));
        }

        const [favs, resumes] = await Promise.all([getFavoriteItems(), getResumeItems()]);
        if (!mounted) return;
        setFavorites(favs);
        setResumeItems(resumes);

        if (cacheFresh) return;

        const [live, vod, series] = await Promise.all([
          fetchLiveStreams(creds),
          fetchVodStreams(creds),
          fetchSeries(creds),
        ]);
        if (!mounted) return;
        if (type === 'tv') {
          setTvItems(id === 'all' ? live : live.filter((item) => item.category_id === id));
        } else if (type === 'movies') {
          setMovieItems(id === 'all' ? vod : vod.filter((item) => item.category_id === id));
        } else if (type === 'series') {
          setSeriesItems(id === 'all' ? series : series.filter((item) => item.category_id === id));
        }
        await setCatalogCache({
          liveStreams: live,
          vodStreams: vod,
          seriesList: series,
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Chargement impossible.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id, type]);

  const title = useMemo(() => {
    if (typeof name === 'string' && name.trim()) return name;
    if (type === 'movies') return 'Films';
    if (type === 'series') return 'Séries';
    return 'TV';
  }, [name, type]);

  const mediaItems = useMemo<Array<XtreamVod | XtreamSeries>>(() => {
    return type === 'movies' ? movieItems : seriesItems;
  }, [movieItems, seriesItems, type]);

  const resumeMovieMap = useMemo(() => {
    const map = new Map<number, ResumeItem>();
    resumeItems
      .filter((item) => item.type === 'movie')
      .forEach((item) => map.set(item.id, item));
    return map;
  }, [resumeItems]);

  const isVod = (item: XtreamVod | XtreamSeries): item is XtreamVod =>
    'stream_id' in item;

  const latest = useMemo(() => {
    if (type === 'movies' && movieItems.length) {
      const first = movieItems[0];
      return {
        title: first.name,
        image: first.cover ?? first.stream_icon,
        badge: 'Film',
      };
    }
    if (type === 'series' && seriesItems.length) {
      const first = seriesItems[0];
      return {
        title: first.name,
        image: first.cover ?? first.backdrop_path?.[0],
        badge: 'Série',
      };
    }
    return null;
  }, [movieItems, seriesItems, type]);

  useEffect(() => {
    let active = true;
    const image = latest?.image;
    getDominantColor(image).then((color) => {
      if (!active) return;
      setHeroTone(color ?? '#000000');
    });
    return () => {
      active = false;
    };
  }, [latest?.image]);

  const handleToggleFavorite = async (streamId: number) => {
    const next = await toggleFavoriteItem('tv', streamId);
    setFavorites(next);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const next = offsetY > 12;
    setIsHeaderBlurred((prev) => (prev !== next ? next : prev));
  };

  if (!type || !id) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="font-body text-ember">Catégorie invalide.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="font-body text-mist">Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="font-body text-ember">{error}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <LinearGradient
        colors={[heroTone, '#000000']}
        locations={[0, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}
        pointerEvents="none"
      />
      <View
        className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-6 bg-transparent"
        style={{ height: headerHeight, paddingTop: 36 }}
      >
        <BlurView
          tint="dark"
          intensity={isHeaderBlurred ? 30 : 0}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: isHeaderBlurred ? 'rgba(0,0,0,0.35)' : 'transparent' },
          ]}
          pointerEvents="none"
        />
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center">
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </Pressable>
        <Text className="max-w-[60%] font-bodySemi text-base text-white" numberOfLines={1}>
          {title}
        </Text>
        <View className="w-10" />
      </View>

      {type === 'tv' ? (
        <FlatList
          className="flex-1"
          data={tvItems}
          keyExtractor={(item) => String(item.stream_id)}
          renderItem={({ item }) => (
            <View className="px-6 pb-4">
              <ChannelCard
                stream={item}
                isFavorite={favorites.some((fav) => fav.type === 'tv' && fav.id === item.stream_id)}
                onPress={() =>
                  router.push({
                  pathname: '/player/[id]' as const,
                    params: {
                      id: String(item.stream_id),
                      name: item.name,
                      icon: item.stream_icon ?? undefined,
                      categoryId: item.category_id ?? undefined,
                      type: 'tv',
                    },
                  })
                }
                onToggleFavorite={() => handleToggleFavorite(item.stream_id)}
              />
            </View>
          )}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: 24 }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews
        />
      ) : (
        <MediaGrid<XtreamVod | XtreamSeries>
          className="flex-1"
          data={mediaItems}
          keyExtractor={(item) =>
            isVod(item) ? `vod-${item.stream_id}` : `series-${item.series_id}`
          }
          columnWrapperStyle={{ paddingHorizontal: 12, marginBottom: 12 }}
          scrollEnabled
          ListHeaderComponent={
            <View className="px-6 pb-6">
              {latest ? (
                <FeaturedCard
                  title={latest.title}
                  image={latest.image}
                  badge={latest.badge}
                  playLabel={
                    type === 'movies'
                      ? (() => {
                          const id = movieItems[0]?.stream_id;
                          if (!id) return 'Lecture';
                          const resume = resumeMovieMap.get(id);
                          if (!resume) return 'Lecture';
                          if (resume.completed) return 'Déjà vu';
                          if (resume.positionSec > 30) return 'Reprendre';
                          return 'Lecture';
                        })()
                      : 'Lecture'
                  }
                  progress={
                    type === 'movies'
                      ? (() => {
                          const id = movieItems[0]?.stream_id;
                          if (!id) return undefined;
                          const resume = resumeMovieMap.get(id);
                          if (!resume || !resume.durationSec) return undefined;
                          return resume.positionSec / resume.durationSec;
                        })()
                      : undefined
                  }
                  onPress={
                    type === 'movies'
                      ? () =>
                          router.push({
                            pathname: '/movie/[id]' as const,
                            params: { id: String(movieItems[0]?.stream_id ?? ''), name: latest.title },
                          })
                      : type === 'series'
                        ? () =>
                            seriesItems[0]?.series_id
                              ? router.push({
                                  pathname: '/series/[id]' as const,
                                  params: { id: String(seriesItems[0].series_id), name: latest.title },
                                })
                              : undefined
                        : undefined
                  }
                  onPlay={
                    type === 'movies'
                      ? () =>
                          router.push({
                            pathname: '/player/[id]' as const,
                            params: {
                              id: String(movieItems[0]?.stream_id ?? ''),
                              name: latest.title,
                              type: 'vod',
                              ext: movieItems[0]?.container_extension ?? 'mp4',
                            },
                          })
                      : type === 'series'
                        ? () =>
                            seriesItems[0]?.series_id
                              ? handlePlaySeries(seriesItems[0].series_id, latest.title)
                              : undefined
                        : undefined
                  }
                  isFavorite={
                    type === 'movies'
                      ? favorites.some(
                          (fav) => fav.type === 'movie' && fav.id === movieItems[0]?.stream_id
                        )
                      : type === 'series'
                        ? favorites.some(
                            (fav) => fav.type === 'series' && fav.id === seriesItems[0]?.series_id
                          )
                        : false
                  }
                  onToggleFavorite={
                    type === 'movies'
                      ? () =>
                          movieItems[0]?.stream_id
                            ? toggleFavoriteItem('movie', movieItems[0].stream_id).then(setFavorites)
                            : undefined
                      : type === 'series'
                        ? () =>
                            seriesItems[0]?.series_id
                              ? toggleFavoriteItem('series', seriesItems[0].series_id).then(
                                  setFavorites
                                )
                              : undefined
                        : undefined
                  }
                />
              ) : null}
              <SectionHeader title={title} />
            </View>
          }
          renderItem={({ item }) => (
            <MediaCard
              title={item.name}
              image={
                isVod(item)
                  ? item.cover ?? item.stream_icon
                  : item.cover ?? item.backdrop_path?.[0]
              }
              progress={
                isVod(item)
                  ? (() => {
                      const resume = resumeMovieMap.get(item.stream_id);
                      if (!resume || !resume.durationSec) return undefined;
                      return resume.positionSec / resume.durationSec;
                    })()
                  : (() => {
                      const resume = resumeItems.find(
                        (entry) => entry.type === 'series' && entry.seriesId === item.series_id
                      );
                      if (!resume || !resume.durationSec) return undefined;
                      return resume.positionSec / resume.durationSec;
                    })()
              }
              size="grid"
              onPress={
                isVod(item)
                  ? () =>
                      router.push({
                        pathname: '/movie/[id]' as const,
                        params: { id: String(item.stream_id), name: item.name },
                      })
                  : () =>
                      router.push({
                        pathname: '/series/[id]' as const,
                        params: { id: String(item.series_id), name: item.name },
                      })
              }
            />
          )}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: 24 }}
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </View>
  );
}
