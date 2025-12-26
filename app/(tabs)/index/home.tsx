import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, Text, View} from 'react-native';

import {EPG_CACHE_TTL_MS, getEpgCache, isEpgCacheFresh, setEpgCache} from '@/lib/epg-cache';
import {getActiveProfileId, getCatalogCache, getCredentials, setCatalogCache} from '@/lib/storage';
import {
    fetchLiveCategories,
    fetchLiveStreams,
    fetchSeries,
    fetchSeriesCategories,
    fetchVodCategories,
    fetchVodStreams,
    fetchXmltvEpg,
} from '@/lib/xtream';

export default function HomeScreen() {
    const router = useRouter();
    const prefetchingRef = useRef(false);
    const lastPrefetchProfileRef = useRef<string | null>(null);
    const catalogCacheTtl = 6 * 60 * 60 * 1000;
    const [isPrefetching, setIsPrefetching] = useState(false);

    useFocusEffect(
        useCallback(() => {
            let mounted = true;

            async function prefetch() {
                if (mounted) {
                    setIsPrefetching(true);
                }
                const profileId = await getActiveProfileId();
                const profileKey = profileId ?? 'default';
                const profileChanged = lastPrefetchProfileRef.current !== profileKey;
                if (prefetchingRef.current && !profileChanged) {
                    if (mounted) {
                        setIsPrefetching(false);
                    }
                    return;
                }
                prefetchingRef.current = true;
                lastPrefetchProfileRef.current = profileKey;
                try {
                    const creds = await getCredentials();
                    if (!creds) return;
                    const cache = await getCatalogCache();
                    const now = Date.now();
                    const liveCacheFresh =
                        cache.updatedAt.liveCategories &&
                        cache.updatedAt.liveStreams &&
                        now - cache.updatedAt.liveCategories < catalogCacheTtl &&
                        now - cache.updatedAt.liveStreams < catalogCacheTtl;
                    const vodCacheFresh =
                        cache.updatedAt.vodCategories &&
                        cache.updatedAt.vodStreams &&
                        now - cache.updatedAt.vodCategories < catalogCacheTtl &&
                        now - cache.updatedAt.vodStreams < catalogCacheTtl;
                    const seriesCacheFresh =
                        cache.updatedAt.seriesCategories &&
                        cache.updatedAt.seriesList &&
                        now - cache.updatedAt.seriesCategories < catalogCacheTtl &&
                        now - cache.updatedAt.seriesList < catalogCacheTtl;
                    let liveStreams = cache.data.liveStreams ?? [];
                    let vodStreams = cache.data.vodStreams ?? [];
                    let seriesList = cache.data.seriesList ?? [];

                    const cachedEpg = getEpgCache(profileId);
                    const needsEpg = !cachedEpg || !isEpgCacheFresh(cachedEpg, EPG_CACHE_TTL_MS);
                    const needsCatalog = !liveCacheFresh || !vodCacheFresh || !seriesCacheFresh;

                    if (!needsCatalog && !needsEpg) {
                        return;
                    }

                    const tasks: Promise<void>[] = [];
                    if (!liveCacheFresh) {
                        const [cats, live] = await Promise.all([
                            fetchLiveCategories(creds),
                            fetchLiveStreams(creds),
                        ]);
                        if (!mounted) return;
                        liveStreams = live;
                        tasks.push(setCatalogCache({liveCategories: cats, liveStreams: live}));
                    }

                    if (!vodCacheFresh) {
                        const [vodCats, vod] = await Promise.all([
                            fetchVodCategories(creds),
                            fetchVodStreams(creds),
                        ]);
                        if (!mounted) return;
                        vodStreams = vod;
                        tasks.push(setCatalogCache({vodCategories: vodCats, vodStreams: vod}));
                    }

                    if (!seriesCacheFresh) {
                        const [seriesCats, series] = await Promise.all([
                            fetchSeriesCategories(creds),
                            fetchSeries(creds),
                        ]);
                        if (!mounted) return;
                        seriesList = series;
                        tasks.push(setCatalogCache({seriesCategories: seriesCats, seriesList: series}));
                    }

                    if (tasks.length) {
                        await Promise.all(tasks);
                    }

                    if (!liveStreams.length && !vodStreams.length && !seriesList.length) return;
                    if (needsEpg) {
                        const xmltv = await fetchXmltvEpg(creds);
                        if (!mounted) return;
                        setEpgCache(profileId, {
                            listingsByChannel: xmltv.listingsByChannel ?? {},
                            channelIdByName: xmltv.channelIdByName ?? {},
                        });
                    }
                } finally {
                    if (mounted) {
                        setIsPrefetching(false);
                    }
                    prefetchingRef.current = false;
                }
            }

            void prefetch();

            return () => {
                mounted = false;
            };
        }, [])
    );

    return (
        <View className="flex-1 bg-black">
            <View className="px-6 pt-12">
                <View className="flex-row gap-3">
                    <Pressable
                        onPress={() => router.push('/series')}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
                    >
                        <Text className="font-body text-sm text-white">Séries</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/movies')}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
                    >
                        <Text className="font-body text-sm text-white">Films</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/tv')}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2"
                    >
                        <Text className="font-body text-sm text-white">TV</Text>
                    </Pressable>
                </View>
            </View>
            {isPrefetching ? (
                <View className="absolute inset-0 items-center justify-center bg-black/70">
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text className="mt-4 font-body text-sm text-white/80">
                        Preparation du catalogue...
                    </Text>
                </View>
            ) : null}
        </View>
    );
}
