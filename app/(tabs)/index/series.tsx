import {type Href, useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View,} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';

import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import MediaGrid from '@/components/MediaGrid';
import SectionHeader from '@/components/SectionHeader';
import {useFavoritesAndResumesState} from '@/lib/catalog.hooks';
import {getDominantColor, safeImageUri} from '@/lib/media';
import {applyFavoritesAndResumes, CATALOG_CACHE_TTL_MS, getProfileReloadState} from '@/lib/catalog.utils';
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

let seriesMemoryCache: XtreamSeries[] = [];
let seriesCategoryMemoryCache: XtreamCategory[] = [];
const seriesHeroToneCache: Record<number, string> = {};

export default function SeriesScreen() {
    const {height} = useWindowDimensions();
    const router = useRouter();
    const headerHeight = 132;
    const [seriesCategories, setSeriesCategories] = useState<XtreamCategory[]>(
        seriesCategoryMemoryCache
    );
    const [series, setSeries] = useState<XtreamSeries[]>(seriesMemoryCache);
    const {favorites, setFavorites, resumeItems, setResumeItems} = useFavoritesAndResumesState();
    const [loading, setLoading] = useState(seriesMemoryCache.length === 0);
    const [error, setError] = useState('');
    const [heroTone, setHeroTone] = useState('#000000');
    const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);
    const [showSeriesCategories, setShowSeriesCategories] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);
    const categoryListRef = useRef<FlatList<XtreamCategory> | null>(null);
    const categoryListScrollRef = useRef<FlatList<SeriesRow> | null>(null);
    const categoryGridScrollRef = useRef<FlatList<XtreamSeries> | null>(null);
    const categoryButtonScale = useRef(new Animated.Value(1)).current;
    const categoryItemHeight = 56;
    const categoryItemGap = 12;
    const hasAnimatedCategory = useRef(false);

    const seriesWithImages = useMemo(() => {
        return series.filter((item) => !!safeImageUri(item.cover ?? item.backdrop_path?.[0]));
    }, [series]);

    const orderedSeries = useMemo(() => seriesWithImages, [seriesWithImages]);

    const selectedCategoryItems = useMemo(() => {
        if (!selectedCategoryId) return [];
        return orderedSeries.filter((item) => item.category_id === selectedCategoryId);
    }, [orderedSeries, selectedCategoryId]);

    const categoryHero = useMemo(() => {
        const first = selectedCategoryItems.find((item) => !!safeImageUri(item.cover ?? item.backdrop_path?.[0]));
        if (!first) return null;
        return {
            id: first.series_id,
            type: 'series' as const,
            title: first.name,
            image: safeImageUri(first.cover ?? first.backdrop_path?.[0]),
            badge: 'Série',
        };
    }, [selectedCategoryItems]);

    const defaultHero = useMemo(() => {
        const firstCategoryId = seriesCategories[0]?.category_id;
        const firstFromCategory = firstCategoryId
            ? orderedSeries.find(
                (item) => item.category_id === firstCategoryId
            )
            : null;
        const first =
            firstFromCategory ??
            orderedSeries[0] ??
            series.find((item) => !!safeImageUri(item.cover ?? item.backdrop_path?.[0]));
        if (!first) return null;
        return {
            id: first.series_id,
            type: 'series' as const,
            title: first.name,
            image: safeImageUri(first.cover ?? first.backdrop_path?.[0]),
            badge: 'Série',
        };
    }, [orderedSeries, series, seriesCategories]);

    const hero = useMemo(
        () => (selectedCategoryId ? categoryHero : defaultHero),
        [categoryHero, defaultHero, selectedCategoryId]
    );

    useEffect(() => {
        if (!hero?.id) return;
        const cachedTone = seriesHeroToneCache[hero.id];
        if (cachedTone && cachedTone !== heroTone) {
            setHeroTone(cachedTone);
        }
    }, [hero?.id]);

    useEffect(() => {
        let active = true;
        const image = hero?.image;
        if (!image) return;
        getDominantColor(image).then((color) => {
            if (!active) return;
            const next = color ?? '#000000';
            if (hero?.id) {
                seriesHeroToneCache[hero.id] = next;
            }
            setHeroTone(next);
        });
        return () => {
            active = false;
        };
    }, [hero?.image]);

    useEffect(() => {
        if (!hasAnimatedCategory.current) {
            hasAnimatedCategory.current = true;
            return;
        }
        Animated.sequence([
            Animated.timing(categoryButtonScale, {
                toValue: 0.96,
                duration: 120,
                useNativeDriver: true,
            }),
            Animated.timing(categoryButtonScale, {
                toValue: 1,
                duration: 140,
                useNativeDriver: true,
            }),
        ]).start();
    }, [categoryButtonScale, selectedCategoryId]);

    useEffect(() => {
        if (!showSeriesCategories) return;
        if (!selectedCategoryId) return;
        const index = seriesCategories.findIndex(
            (category) => category.category_id === selectedCategoryId
        );
        if (index < 0) return;
        const handle = requestAnimationFrame(() => {
            categoryListRef.current?.scrollToIndex({index, animated: true});
        });
        return () => cancelAnimationFrame(handle);
    }, [selectedCategoryId, showSeriesCategories, seriesCategories]);

    useEffect(() => {
        const handle = requestAnimationFrame(() => {
            if (selectedCategoryId) {
                categoryGridScrollRef.current?.scrollToOffset({offset: 0, animated: false});
                return;
            }
            categoryListScrollRef.current?.scrollToOffset({offset: 0, animated: false});
        });
        return () => cancelAnimationFrame(handle);
    }, [selectedCategoryId]);


    const loadData = useCallback(() => {
        let mounted = true;

        async function load() {
            try {
                const {profileChanged, shouldReload} = await getProfileReloadState({
                    lastProfileKey,
                    hasLoadedOnce,
                });
                if (!shouldReload) {
                    return;
                }
                const hasMemoryData =
                    seriesMemoryCache.length > 0 && seriesCategoryMemoryCache.length > 0;
                if (hasMemoryData && !profileChanged) {
                    const applied = await applyFavoritesAndResumes({
                        setFavorites,
                        setResumes: setResumeItems,
                        isMounted: () => mounted,
                    });
                    if (!applied) return;
                    setLoading(false);
                    hasLoadedOnce.current = true;
                    return;
                }
                const hasData = series.length > 0 || seriesCategories.length > 0;
                if (!hasData) {
                    setLoading(true);
                }
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

                const applied = await applyFavoritesAndResumes({
                    setFavorites,
                    setResumes: setResumeItems,
                    isMounted: () => mounted,
                });
                if (!applied) return;

                if (cacheFresh && hasData) {
                    hasLoadedOnce.current = true;
                    setLoading(false);
                    return;
                }

                if (cache.data.seriesCategories) setSeriesCategories(cache.data.seriesCategories);
                if (cache.data.seriesList) setSeries(cache.data.seriesList);
                if (cache.data.seriesCategories) seriesCategoryMemoryCache = cache.data.seriesCategories;
                if (cache.data.seriesList) seriesMemoryCache = cache.data.seriesList;


                const [seriesCats, seriesList] = await Promise.all([
                    fetchSeriesCategories(creds),
                    fetchSeries(creds),
                ]);
                if (!mounted) return;
                setSeriesCategories(seriesCats);
                setSeries(seriesList);
                seriesCategoryMemoryCache = seriesCats;
                seriesMemoryCache = seriesList;
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
        const categories = selectedCategoryId
            ? seriesCategories.filter((category) => category.category_id === selectedCategoryId)
            : seriesCategories;
        return categories.map((category) => ({
            category,
            items: orderedSeries
                .filter((item) => item.category_id === category.category_id)
                .slice(0, 12),
        }));
    }, [orderedSeries, selectedCategoryId, seriesCategories]);

    const seriesRowsData = useMemo<SeriesRow[]>(() => {
        if (selectedCategoryId) {
            return seriesRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items,
                href: makeCategoryHref(row.category.category_id, row.category.category_name),
            }));
        }
        return seriesRows.map((row) => ({
            key: row.category.category_id,
            title: row.category.category_name,
            items: row.items,
            href: makeCategoryHref(row.category.category_id, row.category.category_name),
        }));
    }, [orderedSeries, selectedCategoryId, seriesRows]);

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

    const renderCategoryHeader = useCallback(() => {
        const first = selectedCategoryItems[0];
        const resume = resumeItems.find(
            (item) => item.type === 'series' && item.seriesId === first?.series_id
        );
        const playLabel = !resume
            ? 'Lecture'
            : resume.completed
                ? 'Déjà vu'
                : 'Reprendre';
        const progress =
            resume && resume.durationSec ? resume.positionSec / resume.durationSec : undefined;
        const isFavorite = first
            ? favorites.some((fav) => fav.type === 'series' && fav.id === first.series_id)
            : false;
        return (
            <View className="px-6 pb-2">
                {first ? (
                    <FeaturedCard
                        title={first.name}
                        image={first.cover ?? first.backdrop_path?.[0]}
                        badge="Série"
                        playLabel={playLabel}
                        progress={progress}
                        onPress={() =>
                            router.push({
                                pathname: '/series/[id]' as const,
                                params: {id: String(first.series_id), name: first.name},
                            })
                        }
                        onPlay={() => handlePlaySeries(first.series_id, first.name)}
                        isFavorite={isFavorite}
                        onToggleFavorite={() =>
                            toggleFavoriteItem('series', first.series_id).then(setFavorites)
                        }
                    />
                ) : null}
            </View>
        );
    }, [favorites, handlePlaySeries, resumeItems, router, selectedCategoryItems]);

    const renderSeriesCard = useCallback(
        (entry: XtreamSeries, size?: 'grid') => (
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
                size={size}
                onPress={() =>
                    router.push({
                        pathname: '/series/[id]' as const,
                        params: {id: String(entry.series_id), name: entry.name},
                    })
                }
            />
        ),
        [resumeItems, router]
    );

    const renderRow = useCallback(
        (item: SeriesRow) => (
            <Section
                title={item.title}
                href={item.href}
                onPress={() => setSelectedCategoryId(item.href?.id ?? null)}
            >
                <FlatList<XtreamSeries>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(entry) => `series-${entry.series_id}`}
                    renderItem={({item: entry}) => renderSeriesCard(entry)}
                    contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews
                />
            </Section>
        ),
        [renderSeriesCard, setSelectedCategoryId]
    );

    if (loading && series.length === 0) {
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
                    onPress={() => router.replace('/series' as Href)}>
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
                className="absolute left-0 right-0 top-0 z-10 px-6 bg-transparent"
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
                <View className="w-full">
                    <View className="flex-row items-center justify-between">
                        <Pressable
                            onPress={() => router.back()}
                            className="h-10 w-10 items-center justify-center"
                        >
                            <Ionicons name="chevron-back" size={24} color="#ffffff"/>
                        </Pressable>
                        <Text className="max-w-[60%] font-bold text-xl text-white" numberOfLines={1}>
                            Séries
                        </Text>
                        <View className="w-10"/>
                    </View>
                    <View className="mt-2 items-center">
                        <Animated.View style={{transform: [{scale: categoryButtonScale}]}}>
                            <Pressable
                                onPress={() => {
                                    setShowSeriesCategories(true);
                                }}
                                onPressIn={() => {
                                    Animated.spring(categoryButtonScale, {
                                        toValue: 0.97,
                                        useNativeDriver: true,
                                    }).start();
                                }}
                                onPressOut={() => {
                                    Animated.spring(categoryButtonScale, {
                                        toValue: 1,
                                        useNativeDriver: true,
                                    }).start();
                                }}
                                className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
                                    selectedCategoryId ? 'bg-white/90' : 'border border-white/15 bg-white/10'
                                }`}
                            >
                                <Text
                                    className={`font-bodySemi text-sm ${
                                        selectedCategoryId ? 'text-black' : 'text-white'
                                    }`}
                                >
                                    {selectedCategoryId
                                        ? seriesCategories.find(
                                        (category) => category.category_id === selectedCategoryId
                                    )?.category_name ?? 'Catégories'
                                        : 'Catégories'}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color={selectedCategoryId ? '#000000' : '#ffffff'}
                                />
                            </Pressable>
                        </Animated.View>
                    </View>
                </View>
            </View>
            {selectedCategoryId ? (
                <MediaGrid
                    className="flex-1"
                    data={selectedCategoryItems}
                    keyExtractor={(item) => `series-${item.series_id}`}
                    columnWrapperStyle={{paddingHorizontal: 12, marginBottom: 12}}
                    scrollEnabled
                    showsVerticalScrollIndicator={false}
                    ref={categoryGridScrollRef}
                    ListHeaderComponent={renderCategoryHeader}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{paddingTop: headerHeight + 16, paddingBottom: 24}}
                    initialNumToRender={9}
                    maxToRenderPerBatch={9}
                    windowSize={7}
                    removeClippedSubviews
                    renderItem={({item}) => renderSeriesCard(item, 'grid')}
                />
            ) : (
                <FlatList<SeriesRow>
                    ref={categoryListScrollRef}
                    className="flex-1"
                    data={seriesRowsData}
                    keyExtractor={(item) => item.key}
                    renderItem={({item}) => renderRow(item)}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={<View className="h-10"/>}
                    ItemSeparatorComponent={() => <View className="h-4"/>}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{paddingTop: headerHeight + 16, paddingBottom: 40}}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews
                />
            )}
            <Modal
                transparent
                visible={showSeriesCategories}
                animationType="fade"
                onRequestClose={() => setShowSeriesCategories(false)}
            >
                <View className="flex-1 items-center justify-center bg-ash/50">
                    <BlurView intensity={50} tint="dark" className="absolute inset-0"/>
                    <Pressable
                        onPress={() => setShowSeriesCategories(false)}
                        className="absolute inset-0"
                    />
                    <View className="flex-1 w-full items-center justify-center">
                        <FlatList
                            ref={categoryListRef}
                            data={seriesCategories}
                            keyExtractor={(item) => item.category_id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{
                                alignItems: 'center',
                                paddingTop: 250,
                                paddingBottom: 250,
                                flexGrow: 1,
                                justifyContent: 'center',
                            }}
                            ItemSeparatorComponent={() => <View style={{height: categoryItemGap}}/>}
                            getItemLayout={(_, index) => ({
                                length: categoryItemHeight + categoryItemGap,
                                offset: (categoryItemHeight + categoryItemGap) * index,
                                index,
                            })}
                            onScrollToIndexFailed={() => {
                                categoryListRef.current?.scrollToOffset({offset: 0, animated: false});
                            }}
                            ListHeaderComponent={
                                <Pressable
                                    onPress={() => {
                                        setSelectedCategoryId(null);
                                        setShowSeriesCategories(false);
                                    }}
                                    style={{height: categoryItemHeight, justifyContent: 'center'}}
                                    className="rounded-full px-6"
                                >
                                    <Text
                                        className={`font-bodySemi text-xl text-center ${
                                            selectedCategoryId ? 'text-white/60' : 'text-white'
                                        }`}
                                    >
                                        Toutes les séries
                                    </Text>
                                </Pressable>
                            }
                            ListHeaderComponentStyle={{marginBottom: categoryItemGap}}
                            renderItem={({item}) => {
                                const selected = item.category_id === selectedCategoryId;
                                return (
                                    <Pressable
                                        onPress={() => {
                                            setSelectedCategoryId(item.category_id);
                                            setShowSeriesCategories(false);
                                        }}
                                        style={{height: categoryItemHeight, justifyContent: 'center'}}
                                        className="rounded-full px-6"
                                    >
                                        <Text
                                            className={`font-bodySemi text-xl text-center ${
                                                selected ? 'text-white' : 'text-white/60'
                                            }`}
                                        >
                                            {item.category_name}
                                        </Text>
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                    <View className="absolute bottom-12 items-center justify-center">
                        <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.5)"/>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function Section({
                     title,
                     href,
                     onPress,
                     children,
                 }: {
    title: string;
    href?: CategoryParams;
    onPress?: () => void;
    children: ReactNode;
}) {
    return (
        <View>
            <SectionHeader title={title} href={href} onPress={onPress}/>
            {children}
        </View>
    );
}
