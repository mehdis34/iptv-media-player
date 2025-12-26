import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Modal, Pressable, Text, useWindowDimensions, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';

import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import ScreenHeader from '@/components/ScreenHeader';
import SectionHeader from '@/components/SectionHeader';
import {getDominantColor, getLatestVod} from '@/lib/media';
import {
    getActiveProfileId,
    getCatalogCache,
    getCredentials,
    getFavoriteItems,
    getResumeItems,
    setCatalogCache,
    toggleFavoriteItem,
} from '@/lib/storage';
import {fetchVodCategories, fetchVodStreams} from '@/lib/xtream';
import type {FavoriteItem, ResumeItem, XtreamCategory, XtreamVod} from '@/lib/types';

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
    const [vodCategories, setVodCategories] = useState<XtreamCategory[]>([]);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
    const catalogCacheTtl = 6 * 60 * 60 * 1000;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [heroTone, setHeroTone] = useState('#000000');
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [initialLoadingMessage, setInitialLoadingMessage] = useState('Chargement en cours...');
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
                const activeId = await getActiveProfileId();
                const profileKey = activeId ?? 'default';
                const profileChanged = lastProfileKey.current !== profileKey;
                if (hasLoadedOnce.current && !profileChanged) {
                    return;
                }
                lastProfileKey.current = profileKey;
                setLoading(true);
                setShowInitialLoader(false);
                setError('');
                const creds = await getCredentials();
                if (!creds) {
                    router.replace('/login');
                    return;
                }
                const cache = await getCatalogCache();
                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.vodCategories &&
                    cache.updatedAt.vodStreams &&
                    now - cache.updatedAt.vodCategories < catalogCacheTtl &&
                    now - cache.updatedAt.vodStreams < catalogCacheTtl;

                if (cache.data.vodCategories) setVodCategories(cache.data.vodCategories);
                if (cache.data.vodStreams) setVodStreams(cache.data.vodStreams);

                const [favs, resumes] = await Promise.all([getFavoriteItems(), getResumeItems()]);
                if (!mounted) return;
                setFavorites(favs);
                setResumeItems(resumes);

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
            <ScreenHeader title="Films" onBack={() => router.back()} />
            <FlatList<MovieRow>
                className="flex-1"
                data={movieRows}
                keyExtractor={(item) => item.key}
                renderItem={({item}) => renderRow(item)}
                ListHeaderComponent={renderHeader}
                ListFooterComponent={<View className="h-10"/>}
                ItemSeparatorComponent={() => <View className="h-4"/>}
                contentContainerStyle={{paddingBottom: 40}}
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
