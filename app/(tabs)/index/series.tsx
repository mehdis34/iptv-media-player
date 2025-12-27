import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';

import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import SectionHeader from '@/components/SectionHeader';
import {useFavoritesAndResumesState} from '@/lib/catalog.hooks';
import {getDominantColor, getLatestSeries} from '@/lib/media';
import {CATALOG_CACHE_TTL_MS, applyFavoritesAndResumes, shouldReloadForProfile} from '@/lib/catalog.utils';
import {getCatalogCache, getCredentials, setCatalogCache, toggleFavoriteItem} from '@/lib/storage';
import {handlePlaySeries as handlePlaySeriesFromUtils} from '@/lib/series.utils';
import {fetchSeries, fetchSeriesCategories} from '@/lib/xtream';
import type {XtreamCategory, XtreamSeries} from '@/lib/types';

type CategoryParams = {
    type: 'series';
    id: string;
    name?: string;
};

type SeriesRow = {
    key: string;
    title: string;
    items: XtreamSeries[];
    href?: CategoryParams;
};

export default function SeriesScreen() {
    const {height} = useWindowDimensions();
    const router = useRouter();
    const headerHeight = 96;
    const [seriesCategories, setSeriesCategories] = useState<XtreamCategory[]>([]);
    const [series, setSeries] = useState<XtreamSeries[]>([]);
    const {favorites, setFavorites, resumeItems, setResumeItems} = useFavoritesAndResumesState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [heroTone, setHeroTone] = useState('#000000');
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [initialLoadingMessage, setInitialLoadingMessage] = useState('Chargement en cours...');
    const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);

    const hero = useMemo(() => getLatestSeries(series), [series]);

    useEffect(() => {
        let active = true;
        const image = hero?.image;
        getDominantColor(image).then((color) => {
            if (!active) return;
            setHeroTone(color ?? '#000000');
        });
        return () => {
            active = false;
        };
    }, [hero?.image]);

    const loadData = useCallback(() => {
        let mounted = true;

        async function load() {
            try {
                if (
                    !(await shouldReloadForProfile({
                        lastProfileKey,
                        hasLoadedOnce,
                    }))
                ) {
                    return;
                }
                setLoading(true);
                setShowInitialLoader(false);
                setError('');
                const creds = await getCredentials();
                if (!creds) {
                    router.replace('/login');
                    return;
                }
                const cache = await getCatalogCache(['seriesCategories', 'seriesList']);
                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.seriesCategories &&
                    cache.updatedAt.seriesList &&
                    now - cache.updatedAt.seriesCategories < CATALOG_CACHE_TTL_MS &&
                    now - cache.updatedAt.seriesList < CATALOG_CACHE_TTL_MS;

                if (cache.data.seriesCategories) setSeriesCategories(cache.data.seriesCategories);
                if (cache.data.seriesList) setSeries(cache.data.seriesList);

                const applied = await applyFavoritesAndResumes({
                    setFavorites,
                    setResumes: setResumeItems,
                    isMounted: () => mounted,
                });
                if (!applied) return;

                if (cacheFresh) {
                    hasLoadedOnce.current = true;
                    setLoading(false);
                    return;
                }

                setShowInitialLoader(true);
                setInitialLoadingMessage('Chargement du catalogue...');

                const [seriesCats, seriesList] = await Promise.all([
                    fetchSeriesCategories(creds),
                    fetchSeries(creds),
                ]);
                if (!mounted) return;
                setSeriesCategories(seriesCats);
                setSeries(seriesList);
                await setCatalogCache({
                    seriesCategories: seriesCats,
                    seriesList,
                });
                hasLoadedOnce.current = true;
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Chargement impossible.');
            } finally {
                if (mounted) {
                    setLoading(false);
                    setShowInitialLoader(false);
                }
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [router]);

    useFocusEffect(loadData);

    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const next = offsetY > 12;
        setIsHeaderBlurred((prev) => (prev !== next ? next : prev));
    };

    const handlePlaySeries = useCallback(
        async (seriesId: number, seriesName: string) => {
            await handlePlaySeriesFromUtils(router, seriesId, seriesName);
        },
        [router]
    );

    const makeCategoryHref = (id: string, name?: string): CategoryParams => ({
        type: 'series',
        id,
        name,
    });

    const seriesRows = useMemo(() => {
        return seriesCategories.map((category) => ({
            category,
            items: series
                .filter((item) => item.category_id === category.category_id)
                .slice(0, 12),
        }));
    }, [seriesCategories, series]);

    const seriesRowsData = useMemo<SeriesRow[]>(() => {
        return [
            {
                key: 'popular',
                title: 'Séries populaires',
                items: series.slice(0, 14),
                href: makeCategoryHref('all', 'Séries populaires'),
            },
            ...seriesRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items,
                href: makeCategoryHref(row.category.category_id, row.category.category_name),
            })),
        ];
    }, [series, seriesRows]);

    const renderHeader = useCallback(() => {
        if (!hero) return <View className="px-6 pb-6"/>;
        const resume = resumeItems.find(
            (item) => item.type === 'series' && item.seriesId === hero.id
        );
        const playLabel = !resume
            ? 'Lecture'
            : resume.completed
                ? 'Déjà vu'
                : 'Reprendre';
        const progress =
            resume && resume.durationSec ? resume.positionSec / resume.durationSec : undefined;
        const isFavorite = favorites.some((fav) => fav.type === 'series' && fav.id === hero.id);
        return (
            <View className="px-6 pb-6">
                <FeaturedCard
                    title={hero.title}
                    image={hero.image}
                    badge={hero.badge}
                    playLabel={playLabel}
                    progress={progress}
                    onPress={() =>
                        router.push({
                            pathname: '/series/[id]' as const,
                            params: {id: String(hero.id), name: hero.title},
                        })
                    }
                    onPlay={() => handlePlaySeries(hero.id, hero.title)}
                    isFavorite={isFavorite}
                    onToggleFavorite={() =>
                        toggleFavoriteItem('series', hero.id).then(setFavorites)
                    }
                />
            </View>
        );
    }, [favorites, handlePlaySeries, hero, resumeItems, router]);

    const renderRow = useCallback(
        (item: SeriesRow) => (
            <Section title={item.title} href={item.href}>
                <FlatList<XtreamSeries>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(entry) => `series-${entry.series_id}`}
                    renderItem={({item: entry}) => (
                        <MediaCard
                            title={entry.name}
                            image={entry.cover ?? entry.backdrop_path?.[0]}
                            progress={(() => {
                                const resume = resumeItems.find(
                                    (item) => item.type === 'series' && item.seriesId === entry.series_id
                                );
                                if (!resume || !resume.durationSec) return undefined;
                                return resume.positionSec / resume.durationSec;
                            })()}
                            onPress={() =>
                                router.push({
                                    pathname: '/series/[id]' as const,
                                    params: {id: String(entry.series_id), name: entry.name},
                                })
                            }
                        />
                    )}
                    contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews
                />
            </Section>
        ),
        [resumeItems, router]
    );

    if (loading && !showInitialLoader && series.length === 0) {
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
                <Pressable
                    className="mt-4 rounded-full border border-ash px-6 py-2"
                    onPress={() => router.replace('/series')}>
                    <Text className="font-body text-white">Réessayer</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={[heroTone, '#000000']}
                locations={[0, 1]}
                style={{position: 'absolute', top: 0, left: 0, right: 0, height}}
                pointerEvents="none"
            />
            <View
                className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-6 bg-transparent"
                style={{height: headerHeight, paddingTop: 36}}
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
                        {backgroundColor: isHeaderBlurred ? 'rgba(0,0,0,0.35)' : 'transparent'},
                    ]}
                    pointerEvents="none"
                />
                <Pressable
                    onPress={() => router.back()}
                    className="h-10 w-10 items-center justify-center"
                >
                    <Ionicons name="chevron-back" size={24} color="#ffffff" />
                </Pressable>
                <Text className="max-w-[60%] font-bodySemi text-base text-white" numberOfLines={1}>
                    Séries
                </Text>
                <View className="w-10" />
            </View>
            <FlatList<SeriesRow>
                className="flex-1"
                data={seriesRowsData}
                keyExtractor={(item) => item.key}
                renderItem={({item}) => renderRow(item)}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={<View className="h-10"/>}
                ItemSeparatorComponent={() => <View className="h-4"/>}
                contentContainerStyle={{paddingTop: headerHeight + 16, paddingBottom: 40}}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                initialNumToRender={6}
                maxToRenderPerBatch={6}
                windowSize={7}
                removeClippedSubviews
            />
            <Modal
                transparent
                visible={showInitialLoader}
                animationType="fade"
            >
                <View className="flex-1 items-center justify-center px-6">
                    <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                    <View className="w-full max-w-[360px] items-center rounded-2xl border border-white/10 bg-black/80 px-6 py-8">
                        <ActivityIndicator size="large" color="#ffffff"/>
                        <Text className="mt-4 font-bodySemi text-base text-white">
                            {initialLoadingMessage}
                        </Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function Section({
    title,
    href,
    children,
}: {
    title: string;
    href?: CategoryParams;
    children: ReactNode;
}) {
    return (
        <View>
            <SectionHeader title={title} href={href}/>
            {children}
        </View>
    );
}
