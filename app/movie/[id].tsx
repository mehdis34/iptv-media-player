import {useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, ScrollView, Text, useWindowDimensions, View} from 'react-native';

import DetailActionRow from '@/components/DetailActionRow';
import DetailHero from '@/components/DetailHero';
import MediaCard from '@/components/MediaCard';
import MediaGrid from '@/components/MediaGrid';
import ResumeStatusPill from '@/components/ResumeStatusPill';
import SynopsisBlock from '@/components/SynopsisBlock';
import TrailerCard from '@/components/TrailerCard';
import UnderlineTabs from '@/components/UnderlineTabs';
import {CATALOG_CACHE_TTL_MS} from '@/lib/catalog.utils';
import {getDominantColor, safeImageUri} from '@/lib/media';
import {
    getCatalogCache,
    getCredentials,
    getFavoriteItems,
    getResumeItem,
    getResumeItems,
    setCatalogCache,
    toggleFavoriteItem,
} from '@/lib/storage';
import {buildTrailerMeta} from '@/lib/trailer.utils';
import {fetchVodInfo, fetchVodStreams} from '@/lib/xtream';
import type {FavoriteItem, ResumeItem, XtreamVod, XtreamVodInfo} from '@/lib/types';

export default function MovieDetailScreen() {
    const router = useRouter();
    const {height} = useWindowDimensions();
    const params = useLocalSearchParams<{ id?: string; name?: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [vodInfo, setVodInfo] = useState<XtreamVodInfo | null>(null);
    const [vodList, setVodList] = useState<XtreamVod[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [resumeEntry, setResumeEntry] = useState<ResumeItem | null>(null);
    const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
    const [heroTone, setHeroTone] = useState('#000000');
    const [showFullPlot, setShowFullPlot] = useState(false);
    const [activeTab, setActiveTab] = useState<'similar' | 'trailer'>('similar');
    const [tabLayouts, setTabLayouts] = useState<{
        similar?: { x: number; width: number; pad: number };
        trailer?: { x: number; width: number; pad: number };
    }>({});
    const underlineX = useRef(new Animated.Value(0)).current;
    const underlineWidth = useRef(new Animated.Value(0)).current;
    const tabsScrollRef = useRef<ScrollView>(null);

    const streamId = Number(params.id ?? 0);
    const heroHeight = Math.round(height * 0.3);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const creds = await getCredentials();
                if (!creds || !streamId) {
                    router.replace('/login');
                    return;
                }
                const cache = await getCatalogCache(['vodStreams']);
                if (!mounted) return;
                if (cache.data.vodStreams) {
                    setVodList(cache.data.vodStreams);
                }
                const [info, favs, resumes] = await Promise.all([
                    fetchVodInfo(creds, streamId),
                    getFavoriteItems(),
                    getResumeItems(),
                ]);
                if (!mounted) return;
                setVodInfo(info);
                setFavorites(favs);
                setResumeItems(resumes);
                setLoading(false);

                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.vodStreams &&
                    now - cache.updatedAt.vodStreams < CATALOG_CACHE_TTL_MS;
                if (!cacheFresh) {
                    try {
                        const list = await fetchVodStreams(creds);
                        if (!mounted) return;
                        setVodList(list);
                        await setCatalogCache({vodStreams: list});
                    } catch {
                        if (!mounted) return;
                        if (!cache.data.vodStreams?.length) {
                            setError('Chargement impossible.');
                        }
                    }
                }
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Chargement impossible.');
                setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [router, streamId]);

    useEffect(() => {
        if (!streamId) {
            setResumeEntry(null);
            return;
        }
        getResumeItem('movie', streamId).then(setResumeEntry);
    }, [streamId]);

    const details = useMemo(() => vodInfo?.info ?? {}, [vodInfo]);
    const movieData = useMemo(() => vodInfo?.movie_data ?? {}, [vodInfo]);
    const fallbackItem = useMemo(
        () => vodList.find((item) => item.stream_id === streamId),
        [vodList, streamId]
    );

    const resumeMovieMap = useMemo(() => {
        const map = new Map<number, ResumeItem>();
        resumeItems
            .filter((item) => item.type === 'movie')
            .forEach((item) => map.set(item.id, item));
        return map;
    }, [resumeItems]);

    const title =
        details.name ?? movieData.name ?? fallbackItem?.name ?? params.name ?? 'Film';
    const cover =
        details.backdrop_path?.[0] ??
        details.cover_big ??
        details.movie_image ??
        fallbackItem?.cover ??
        fallbackItem?.stream_icon;
    const safeCover = safeImageUri(cover);
    const plot = details.plot ?? details.description ?? '';
    const cast = details.cast ?? details.actors ?? '';
    const trailer = details.trailer ?? details.youtube_trailer ?? '';
    const categoryId = movieData.category_id ?? fallbackItem?.category_id;
    const extension = movieData.container_extension ?? 'mp4';

    const release =
        details.releasedate ??
        details.releaseDate ??
        (movieData as { releasedate?: string }).releasedate ??
        '';
    const releaseYear = release ? String(release).slice(0, 4) : '';
    const duration = details.duration ?? details.episode_run_time ?? '';
    const genre = details.genre ?? '';
    const rating = details.rating ? String(details.rating) : '';

    const metaParts = [releaseYear, genre, duration, rating && `${rating}/10`]
        .filter(Boolean)
        .join(' • ');

    const similarItems = useMemo(() => {
        if (!categoryId) return [];
        return vodList
            .filter((item) => item.category_id === categoryId && item.stream_id !== streamId)
            .slice(0, 21);
    }, [categoryId, streamId, vodList]);

    useEffect(() => {
        let active = true;
        getDominantColor(safeCover).then((color) => {
            if (!active) return;
            setHeroTone(color ?? '#000000');
        });
        return () => {
            active = false;
        };
    }, [safeCover]);

    const isFavorite = favorites.some((fav) => fav.type === 'movie' && fav.id === streamId);
    const handleToggleFavorite = async () => {
        if (!streamId) return;
        const next = await toggleFavoriteItem('movie', streamId);
        setFavorites(next);
    };

    const hasResume = !!resumeEntry && resumeEntry.positionSec > 30;
    const isCompleted = !!resumeEntry?.completed;
    const playLabel = isCompleted ? 'Revoir' : hasResume ? 'Reprendre' : 'Lecture';

    const handlePlay = () => {
        if (!streamId) return;
        const start =
            hasResume && !isCompleted ? Math.floor(resumeEntry?.positionSec ?? 0) : undefined;
        router.push({
            pathname: '/player/[id]' as const,
            params: {
                id: String(streamId),
                name: title,
                type: 'vod',
                ext: extension,
                ...(start ? {start: String(start)} : {}),
            },
        });
    };

    const trailerMeta = useMemo(() => buildTrailerMeta(trailer), [trailer]);
    const trailerUrl = trailerMeta.url;
    const trailerThumb = trailerMeta.thumbnail;

    useEffect(() => {
        const target = activeTab === 'similar' ? tabLayouts.similar : tabLayouts.trailer;
        if (!target) return;
        Animated.parallel([
            Animated.timing(underlineX, {
                toValue: target.x,
                duration: 220,
                useNativeDriver: false,
            }),
            Animated.timing(underlineWidth, {
                toValue: target.width - target.pad * 2,
                duration: 220,
                useNativeDriver: false,
            }),
        ]).start();
    }, [activeTab, tabLayouts, underlineWidth, underlineX]);

    if (!streamId) {
        return (
            <View className="flex-1 items-center justify-center bg-black px-6">
                <Text className="font-body text-ember">Film introuvable.</Text>
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

    const tabs = trailerUrl
        ? [
            {key: 'similar', label: 'Films similaires'},
            {key: 'trailer', label: 'Bande-annonce'},
        ]
        : [];

    return (
        <View className="flex-1 bg-black">
            <DetailHero
                height={height}
                heroHeight={heroHeight}
                heroTone={heroTone}
                coverUri={safeCover}
                onClose={() => router.back()}
            />

            <ScrollView
                className="bg-black"
                style={{marginTop: heroHeight}}
                contentContainerStyle={{paddingTop: 24, paddingBottom: 40}}
                showsVerticalScrollIndicator={false}
            >
                <View className="px-6">
                    <Text className="text-center font-bodySemi text-2xl uppercase tracking-[2px] text-white">
                        {title}
                    </Text>
                    {metaParts ? (
                        <Text className="mt-2 text-center font-body text-sm text-mist">{metaParts}</Text>
                    ) : null}
                    {resumeEntry ? (
                        <ResumeStatusPill
                            label={isCompleted ? 'Déjà vu' : 'En cours de lecture'}
                        />
                    ) : null}

                    <DetailActionRow
                        playLabel={playLabel}
                        onPlay={handlePlay}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={isFavorite}
                    />

                    <SynopsisBlock
                        plot={plot}
                        showFull={showFullPlot}
                        onToggle={() => setShowFullPlot((prev) => !prev)}
                    />

                    <View className="mt-6">
                        <Text className="font-bodySemi text-lg text-white">Distribution</Text>
                        <Text className="mt-2 font-body text-base text-mist">
                            {cast ? cast : 'Distribution non renseignée.'}
                        </Text>
                    </View>

                    {tabs.length ? (
                        <View className="mt-8">
                            <UnderlineTabs
                                tabs={tabs}
                                activeKey={activeTab}
                                tabLayouts={tabLayouts}
                                setTabLayouts={setTabLayouts}
                                underlineX={underlineX}
                                underlineWidth={underlineWidth}
                                scrollRef={tabsScrollRef}
                                onTabPress={(key) => setActiveTab(key as typeof activeTab)}
                            />
                        </View>
                    ) : null}
                </View>

                <View className="mt-6">
                    {trailerUrl && activeTab === 'trailer' ? (
                        <View className="px-6">
                            <TrailerCard url={trailerUrl} thumbnail={trailerThumb} />
                        </View>
                    ) : (
                        <View className="px-3">
                            <MediaGrid
                                data={similarItems}
                                keyExtractor={(item) => String(item.stream_id)}
                                columnWrapperStyle={{paddingHorizontal: 12, marginTop: 12}}
                                renderItem={({item}) => (
                                    <MediaCard
                                        title={item.name}
                                        image={item.cover ?? item.stream_icon}
                                        progress={(() => {
                                            const resume = resumeMovieMap.get(item.stream_id);
                                            if (!resume || !resume.durationSec) return undefined;
                                            return resume.positionSec / resume.durationSec;
                                        })()}
                                        size="grid"
                                        onPress={() =>
                                            router.push({
                                                pathname: '/movie/[id]' as const,
                                                params: {id: String(item.stream_id), name: item.name},
                                            })
                                        }
                                    />
                                )}
                            />
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
