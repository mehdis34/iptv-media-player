import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Image, Pressable, ScrollView, Text, useWindowDimensions, View,} from 'react-native';

import MediaCard from '@/components/MediaCard';
import {getDominantColor, safeImageUri} from '@/lib/media';
import {getCredentials, getFavoriteItems, getResumeItem, getResumeItems, toggleFavoriteItem} from '@/lib/storage';
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
                const [info, list, favs, resumes] = await Promise.all([
                    fetchVodInfo(creds, streamId),
                    fetchVodStreams(creds),
                    getFavoriteItems(),
                    getResumeItems(),
                ]);
                if (!mounted) return;
                setVodInfo(info);
                setVodList(list);
                setFavorites(favs);
                setResumeItems(resumes);
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : 'Chargement impossible.');
            } finally {
                if (mounted) setLoading(false);
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
    const poster = details.movie_image ?? details.cover_big ?? fallbackItem?.cover ?? cover;
    const safePoster = safeImageUri(poster);
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

    const trailerUrl = useMemo(() => normalizeTrailerUrl(trailer), [trailer]);
    const trailerThumb = useMemo(() => getTrailerThumbnail(trailerUrl), [trailerUrl]);

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

    return (
        <View className="flex-1 bg-black">
            <LinearGradient
                colors={[heroTone, '#000000']}
                locations={[0, 1]}
                style={{position: 'absolute', top: 0, left: 0, right: 0, height}}
                pointerEvents="none"
            />
            <View style={{position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight}}>
                {safeCover ? (
                    <Image source={{uri: safeCover}} resizeMode="cover" style={{height: '100%'}}/>
                ) : (
                    <LinearGradient colors={['#1b1b24', '#0b0b0f']} style={{height: '100%'}}/>
                )}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.95)']}
                    locations={[0.4, 1]}
                    style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: heroHeight}}
                    pointerEvents="none"
                />
            </View>

            <View className="absolute right-6 top-12 z-10">
                <Pressable
                    onPress={() => router.back()}
                    className="h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.25)']}
                        className="absolute inset-0"
                    />
                    <Ionicons name="close" size={24} color="#ffffff"/>
                </Pressable>
            </View>

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
                        <View className="mt-3 items-center">
                            <View className="rounded-full bg-white/10 px-4 py-1.5">
                                <Text className="font-bodySemi text-xs uppercase tracking-[1px] text-white">
                                    {isCompleted ? 'Déjà vu' : 'En cours de lecture'}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    <View className="mt-5 flex-row items-center gap-3">
                        <Pressable
                            onPress={handlePlay}
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-white py-3"
                        >
                            <Ionicons name="play" size={18} color="#111111"/>
                            <Text className="font-bodySemi text-sm text-black">{playLabel}</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleToggleFavorite}
                            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-3"
                        >
                            <Ionicons name={isFavorite ? 'checkmark' : 'add'} size={18} color="#ffffff"/>
                            <Text className="font-bodySemi text-sm text-white">Ma liste</Text>
                        </Pressable>
                    </View>

                    <View className="mt-6">
                        <Text className="font-bodySemi text-lg text-white">Synopsis</Text>
                        <Text className="mt-2 font-body text-base text-mist">
                            {plot
                                ? showFullPlot
                                    ? plot
                                    : plot.slice(0, 300)
                                : 'Synopsis indisponible.'}
                            {plot && plot.length > 300 && !showFullPlot ? '…' : ''}
                            {plot && plot.length > 300 ? (
                                <Text
                                    onPress={() => setShowFullPlot((prev) => !prev)}
                                    className="font-bodySemi text-sm text-white">
                                    {showFullPlot ? ' Voir moins' : ' Voir plus'}
                                </Text>
                            ) : null}
                        </Text>
                    </View>

                    <View className="mt-6">
                        <Text className="font-bodySemi text-lg text-white">Distribution</Text>
                        <Text className="mt-2 font-body text-base text-mist">
                            {cast ? cast : 'Distribution non renseignée.'}
                        </Text>
                    </View>

                    {trailerUrl ? (
                        <View className="mt-8">
                            <ScrollView
                                ref={tabsScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{gap: 24, paddingRight: 24}}
                            >
                                <View className="relative flex-row gap-10">
                                    <Pressable
                                        onPress={() => {
                                            setActiveTab('similar');
                                            const target = tabLayouts.similar;
                                            if (target) tabsScrollRef.current?.scrollTo({x: target.x, animated: true});
                                        }}
                                        onLayout={(event) => {
                                            const {x, width} = event.nativeEvent.layout;
                                            setTabLayouts((prev) => ({...prev, similar: {x, width, pad: 10}}));
                                        }}
                                        className="pb-3"
                                    >
                                        <Text
                                            className={`pt-4 font-bodySemi text-xl ${
                                                activeTab === 'similar' ? 'text-white' : 'text-white/50'
                                            }`}>
                                            Films similaires
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            setActiveTab('trailer');
                                            const target = tabLayouts.trailer;
                                            if (target) tabsScrollRef.current?.scrollTo({x: target.x, animated: true});
                                        }}
                                        onLayout={(event) => {
                                            const {x, width} = event.nativeEvent.layout;
                                            setTabLayouts((prev) => ({...prev, trailer: {x, width, pad: 10}}));
                                        }}
                                        className="pb-3"
                                    >
                                        <Text
                                            className={`pt-4 font-bodySemi text-xl ${
                                                activeTab === 'trailer' ? 'text-white' : 'text-white/50'
                                            }`}>
                                            Bande-annonce
                                        </Text>
                                    </Pressable>
                                    <Animated.View
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            height: 4,
                                            borderRadius: 999,
                                            backgroundColor: '#e50914',
                                            transform: [{translateX: underlineX}],
                                            width: underlineWidth,
                                        }}
                                    />
                                </View>
                            </ScrollView>
                        </View>
                    ) : null}
                </View>

                <View className="mt-6">
                    {trailerUrl && activeTab === 'trailer' ? (
                        <View className="px-6">
                            <Pressable
                                onPress={() => WebBrowser.openBrowserAsync(trailerUrl)}
                                className="overflow-hidden rounded-2xl border border-white/10 bg-black"
                            >
                                {trailerThumb ? (
                                    <Image source={{uri: trailerThumb}} className="h-64 w-full" resizeMode="cover"/>
                                ) : (
                                    <LinearGradient
                                        colors={['#1b1b24', '#0b0b0f']}
                                        className="h-64 w-full"
                                    />
                                )}
                                <View className="absolute inset-0 items-center justify-center">
                                    <View className="h-14 w-14 items-center justify-center rounded-full bg-black/60">
                                        <Ionicons name="play" size={24} color="#ffffff"/>
                                    </View>
                                </View>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="px-3">
                            <FlatList
                                data={similarItems}
                                keyExtractor={(item) => String(item.stream_id)}
                                numColumns={3}
                                scrollEnabled={false}
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

function normalizeTrailerUrl(trailer?: string) {
    if (!trailer) return '';
    const trimmed = trailer.trim();
    if (!trimmed) return '';
    const isIdOnly = /^[a-zA-Z0-9_-]{10,14}$/.test(trimmed);
    if (isIdOnly) {
        return `https://www.youtube.com/watch?v=${trimmed}`;
    }
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (withScheme.includes('youtube.com') || withScheme.includes('youtu.be')) {
        const id = extractYouTubeId(withScheme);
        return id ? `https://www.youtube.com/watch?v=${id}` : withScheme;
    }
    return withScheme;
}

function extractYouTubeId(url: string) {
    const match =
        url.match(/[?&]v=([^&]+)/i) ||
        url.match(/youtu\.be\/([^?&]+)/i) ||
        url.match(/youtube\.com\/embed\/([^?&]+)/i);
    return match ? match[1] : null;
}

function getTrailerThumbnail(url?: string) {
    if (!url) return '';
    const id = extractYouTubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}
