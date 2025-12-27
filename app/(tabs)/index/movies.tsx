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
import {getDominantColor, getLatestVod} from '@/lib/media';
import {CATALOG_CACHE_TTL_MS, applyFavoritesAndResumes, shouldReloadForProfile} from '@/lib/catalog.utils';
import {getCatalogCache, getCredentials, setCatalogCache, toggleFavoriteItem} from '@/lib/storage';
import {fetchVodCategories, fetchVodStreams} from '@/lib/xtream';
import type {ResumeItem, XtreamCategory, XtreamVod} from '@/lib/types';

type CategoryParams = {
    type: 'movies';
    id: string;
    name?: string;
};

type MovieRow = {
    key: string;
    title: string;
    items: XtreamVod[];
    href?: CategoryParams;
};

export default function MoviesScreen() {
    const {height} = useWindowDimensions();
    const router = useRouter();
    const headerHeight = 96;
    const [vodCategories, setVodCategories] = useState<XtreamCategory[]>([]);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const {favorites, setFavorites, resumeItems, setResumeItems} = useFavoritesAndResumesState();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [heroTone, setHeroTone] = useState('#000000');
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [initialLoadingMessage, setInitialLoadingMessage] = useState('Chargement en cours...');
    const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);

    const resumeMovieMap = useMemo(() => {
        const map = new Map<number, ResumeItem>();
        resumeItems
            .filter((item) => item.type === 'movie')
            .forEach((item) => map.set(item.id, item));
        return map;
    }, [resumeItems]);

    const hero = useMemo(() => getLatestVod(vodStreams), [vodStreams]);

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
                const cache = await getCatalogCache(['vodCategories', 'vodStreams']);
                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.vodCategories &&
                    cache.updatedAt.vodStreams &&
                    now - cache.updatedAt.vodCategories < CATALOG_CACHE_TTL_MS &&
                    now - cache.updatedAt.vodStreams < CATALOG_CACHE_TTL_MS;

                if (cache.data.vodCategories) setVodCategories(cache.data.vodCategories);
                if (cache.data.vodStreams) setVodStreams(cache.data.vodStreams);

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

                const [vodCats, vod] = await Promise.all([
                    fetchVodCategories(creds),
                    fetchVodStreams(creds),
                ]);
                if (!mounted) return;
                setVodCategories(vodCats);
                setVodStreams(vod);
                await setCatalogCache({
                    vodCategories: vodCats,
                    vodStreams: vod,
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

    const makeCategoryHref = (id: string, name?: string): CategoryParams => ({
        type: 'movies',
        id,
        name,
    });

    const vodRows = useMemo(() => {
        return vodCategories.map((category) => ({
            category,
            items: vodStreams
                .filter((stream) => stream.category_id === category.category_id)
                .slice(0, 12),
        }));
    }, [vodCategories, vodStreams]);

    const movieRows = useMemo<MovieRow[]>(() => {
        return [
            {
                key: 'popular',
                title: 'Films populaires',
                items: vodStreams.slice(0, 14),
                href: makeCategoryHref('all', 'Films populaires'),
            },
            ...vodRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items,
                href: makeCategoryHref(row.category.category_id, row.category.category_name),
            })),
        ];
    }, [vodRows, vodStreams]);

    const renderHeader = useCallback(() => {
        if (!hero) return <View className="px-6 pb-6"/>;
        const resume = resumeMovieMap.get(hero.id);
        const playLabel = !resume
            ? 'Lecture'
            : resume.completed
                ? 'Déjà vu'
                : resume.positionSec > 30
                    ? 'Reprendre'
                    : 'Lecture';
        const progress =
            resume && resume.durationSec ? resume.positionSec / resume.durationSec : undefined;
        const isFavorite = favorites.some((fav) => fav.type === 'movie' && fav.id === hero.id);
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
                            pathname: '/movie/[id]' as const,
                            params: {id: String(hero.id), name: hero.title},
                        })
                    }
                    onPlay={() =>
                        router.push({
                            pathname: '/player/[id]' as const,
                            params: {
                                id: String(hero.id),
                                name: hero.title,
                                type: 'vod',
                                ext: hero.extension ?? 'mp4',
                            },
                        })
                    }
                    isFavorite={isFavorite}
                    onToggleFavorite={() =>
                        toggleFavoriteItem('movie', hero.id).then(setFavorites)
                    }
                />
            </View>
        );
    }, [favorites, hero, resumeMovieMap, router]);

    const renderRow = useCallback(
        (item: MovieRow) => (
            <Section title={item.title} href={item.href}>
                <FlatList<XtreamVod>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(entry) => `vod-${entry.stream_id}`}
                    renderItem={({item: entry}) => (
                        <MediaCard
                            title={entry.name}
                            image={entry.cover ?? entry.stream_icon}
                            progress={(() => {
                                const resume = resumeMovieMap.get(entry.stream_id);
                                if (!resume || !resume.durationSec) return undefined;
                                return resume.positionSec / resume.durationSec;
                            })()}
                            onPress={() =>
                                router.push({
                                    pathname: '/movie/[id]' as const,
                                    params: {id: String(entry.stream_id), name: entry.name},
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
        [resumeMovieMap, router]
    );

    if (loading && !showInitialLoader && vodStreams.length === 0) {
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
                    onPress={() => router.replace('/movies')}>
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
                    Films
                </Text>
                <View className="w-10" />
            </View>
            <FlatList<MovieRow>
                className="flex-1"
                data={movieRows}
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
