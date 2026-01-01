import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';

import TVScreenScrollView from '@/components/tv/TVScreenScrollView';
import {EPG_CACHE_TTL_MS, getEpgCache, isEpgCacheFresh, setEpgCache} from '@/lib/epg-cache';
import {CATALOG_CACHE_TTL_MS} from '@/lib/catalog.utils';
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

export default function TvHomeScreen() {
    const topPadding = 96;
    const prefetchingRef = useRef(false);
    const lastPrefetchProfileRef = useRef<string | null>(null);
    const [isPrefetching, setIsPrefetching] = useState(false);
    const [prefetchMessage, setPrefetchMessage] = useState('Chargement du catalogue...');
    const formatPrefetchMessage = (labels: string[]) => {
        if (!labels.length) return 'Chargement du catalogue...';
        if (labels.length === 1) return `Chargement ${labels[0]}...`;
        if (labels.length === 2) return `Chargement ${labels[0]} et ${labels[1]}...`;
        return `Chargement ${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}...`;
    };

    useFocusEffect(
        useCallback(() => {
            let mounted = true;

            async function prefetch() {
                const profileId = await getActiveProfileId();
                const profileKey = profileId ?? 'default';
                const profileChanged = lastPrefetchProfileRef.current !== profileKey;
                if (prefetchingRef.current && !profileChanged) {
                    return;
                }
                prefetchingRef.current = true;
                lastPrefetchProfileRef.current = profileKey;
                try {
                    const creds = await getCredentials();
                    if (!creds) return;
                    const cache = await getCatalogCache([
                        'liveCategories',
                        'liveStreams',
                        'vodCategories',
                        'vodStreams',
                        'seriesCategories',
                        'seriesList',
                    ]);
                    const now = Date.now();
                    const liveCacheFresh =
                        cache.updatedAt.liveCategories &&
                        cache.updatedAt.liveStreams &&
                        now - cache.updatedAt.liveCategories < CATALOG_CACHE_TTL_MS &&
                        now - cache.updatedAt.liveStreams < CATALOG_CACHE_TTL_MS;
                    const vodCacheFresh =
                        cache.updatedAt.vodCategories &&
                        cache.updatedAt.vodStreams &&
                        now - cache.updatedAt.vodCategories < CATALOG_CACHE_TTL_MS &&
                        now - cache.updatedAt.vodStreams < CATALOG_CACHE_TTL_MS;
                    const seriesCacheFresh =
                        cache.updatedAt.seriesCategories &&
                        cache.updatedAt.seriesList &&
                        now - cache.updatedAt.seriesCategories < CATALOG_CACHE_TTL_MS &&
                        now - cache.updatedAt.seriesList < CATALOG_CACHE_TTL_MS;

                    const cachedEpg = await getEpgCache(profileId);
                    const needsEpg = !cachedEpg || !isEpgCacheFresh(cachedEpg, EPG_CACHE_TTL_MS);
                    const needsCatalog = !liveCacheFresh || !vodCacheFresh || !seriesCacheFresh;

                    if (!needsCatalog && !needsEpg) {
                        return;
                    }
                    if (mounted) {
                        const targets: string[] = [];
                        if (!liveCacheFresh) targets.push('TV');
                        if (!vodCacheFresh) targets.push('films');
                        if (!seriesCacheFresh) targets.push('series');
                        if (needsEpg) targets.push('guide TV');
                        setPrefetchMessage(formatPrefetchMessage(targets));
                        setIsPrefetching(true);
                    }

                    const tasks: Promise<void>[] = [];
                    if (!liveCacheFresh) {
                        if (mounted) setPrefetchMessage('Chargement des chaînes TV...');
                        const [cats, live] = await Promise.all([
                            fetchLiveCategories(creds),
                            fetchLiveStreams(creds),
                        ]);
                        if (!mounted) return;
                        tasks.push(setCatalogCache({liveCategories: cats, liveStreams: live}));
                    }

                    if (!vodCacheFresh) {
                        if (mounted) setPrefetchMessage('Chargement des films...');
                        const [vodCats, vod] = await Promise.all([
                            fetchVodCategories(creds),
                            fetchVodStreams(creds),
                        ]);
                        if (!mounted) return;
                        tasks.push(setCatalogCache({vodCategories: vodCats, vodStreams: vod}));
                    }

                    if (!seriesCacheFresh) {
                        if (mounted) setPrefetchMessage('Chargement des séries...');
                        const [seriesCats, series] = await Promise.all([
                            fetchSeriesCategories(creds),
                            fetchSeries(creds),
                        ]);
                        if (!mounted) return;
                        tasks.push(setCatalogCache({seriesCategories: seriesCats, seriesList: series}));
                    }

                    if (tasks.length) {
                        await Promise.all(tasks);
                    }

                    if (needsEpg) {
                        if (mounted) setPrefetchMessage('Chargement du guide TV...');
                        const xmltv = await fetchXmltvEpg(creds);
                        if (!mounted) return;
                        await setEpgCache(profileId, {
                            listingsByChannel: xmltv.listingsByChannel ?? {},
                            channelIdByName: xmltv.channelIdByName ?? {},
                        });
                    }
                } finally {
                    if (mounted) {
                        setPrefetchMessage('Chargement du catalogue...');
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
        <TVScreenScrollView>
            <View className="px-10" style={{paddingTop: topPadding}}>
                <Text className="font-display text-4xl text-white">Accueil</Text>
                {isPrefetching ? (
                    <View className="mt-10 flex-row items-center gap-3">
                        <ActivityIndicator size="small" color="#ffffff"/>
                        <Text className="font-body text-base text-white/70">{prefetchMessage}</Text>
                    </View>
                ) : null}
            </View>
        </TVScreenScrollView>
    );
}
