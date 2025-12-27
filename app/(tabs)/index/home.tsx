import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View,} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {BlurView} from 'expo-blur';

import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import SectionHeader from '@/components/SectionHeader';
import TvRowContent from '@/components/TvRowContent';
import {EPG_CACHE_TTL_MS, getEpgCache, isEpgCacheFresh, setEpgCache} from '@/lib/epg-cache';
import {useFavoritesAndResumesState} from '@/lib/catalog.hooks';
import {CATALOG_CACHE_TTL_MS} from '@/lib/catalog.utils';
import {ensureLogoTone as ensureLogoToneCached, getLatestSeries, getLatestVod} from '@/lib/media';
import {
    getActiveProfileId,
    getCatalogCache,
    getCredentials,
    getFavoriteItems,
    getResumeItems,
    setCatalogCache,
    toggleFavoriteItem,
} from '@/lib/storage';
import {
    fetchLiveCategories,
    fetchLiveStreams,
    fetchSeries,
    fetchSeriesCategories,
    fetchVodCategories,
    fetchVodStreams,
    fetchXmltvEpg,
} from '@/lib/xtream';
import {getTvNowInfo} from '@/lib/tv.utils';
import {parseEpgDate, resolveXmltvChannelId} from '@/lib/epg.utils';
import type {FavoriteItem, ResumeItem, XtreamEpgListing, XtreamSeries, XtreamStream, XtreamVod} from '@/lib/types';

export default function HomeScreen() {
    const router = useRouter();
    const prefetchingRef = useRef(false);
    const lastPrefetchProfileRef = useRef<string | null>(null);
    const [isPrefetching, setIsPrefetching] = useState(false);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const [seriesList, setSeriesList] = useState<XtreamSeries[]>([]);
    const [liveStreams, setLiveStreams] = useState<XtreamStream[]>([]);
    const {favorites, setFavorites, resumeItems, setResumeItems} = useFavoritesAndResumesState();
    const [tvXmltvListings, setTvXmltvListings] = useState<Record<string, XtreamEpgListing[]>>({});
    const [tvXmltvChannelIdByName, setTvXmltvChannelIdByName] = useState<Record<string, string>>(
        {}
    );
    const [logoToneByUri, setLogoToneByUri] = useState<Record<string, string>>({});
    const pendingLogoTones = useRef(new Set<string>());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [prefetchMessage, setPrefetchMessage] = useState('Chargement du catalogue...');
    const headerHeight = 168;
    const headerTopPadding = 64;
    const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);

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
                    let liveStreams = cache.data.liveStreams ?? [];
                    let vodStreams = cache.data.vodStreams ?? [];
                    let seriesList = cache.data.seriesList ?? [];

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
                        liveStreams = live;
                        tasks.push(setCatalogCache({liveCategories: cats, liveStreams: live}));
                    }

                    if (!vodCacheFresh) {
                        if (mounted) setPrefetchMessage('Chargement des films...');
                        const [vodCats, vod] = await Promise.all([
                            fetchVodCategories(creds),
                            fetchVodStreams(creds),
                        ]);
                        if (!mounted) return;
                        vodStreams = vod;
                        tasks.push(setCatalogCache({vodCategories: vodCats, vodStreams: vod}));
                    }

                    if (!seriesCacheFresh) {
                        if (mounted) setPrefetchMessage('Chargement des séries...');
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
                        if (mounted) setPrefetchMessage('Chargement du guide TV...');
                        const xmltv = await fetchXmltvEpg(creds);
                        if (!mounted) return;
                        await setEpgCache(profileId, {
                            listingsByChannel: xmltv.listingsByChannel ?? {},
                            channelIdByName: xmltv.channelIdByName ?? {},
                        });
                    }

                    if (mounted) {
                        setLiveStreams(liveStreams);
                        setVodStreams(vodStreams);
                        setSeriesList(seriesList);
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

    useFocusEffect(
        useCallback(() => {
            let mounted = true;

            async function loadHomeData() {
                try {
                    const profileId = await getActiveProfileId();
                    const [cache, favs, resumes] = await Promise.all([
                        getCatalogCache(['vodStreams', 'seriesList', 'liveStreams']),
                        getFavoriteItems(),
                        getResumeItems(),
                    ]);
                    if (!mounted) return;
                    setVodStreams(cache.data.vodStreams ?? []);
                    setSeriesList(cache.data.seriesList ?? []);
                    setLiveStreams(cache.data.liveStreams ?? []);
                    setFavorites(favs);
                    setResumeItems(resumes);
                    if (profileId) {
                        const cachedEpg = await getEpgCache(profileId);
                        if (!mounted) return;
                        if (cachedEpg) {
                            setTvXmltvListings(cachedEpg.listingsByChannel ?? {});
                            setTvXmltvChannelIdByName(cachedEpg.channelIdByName ?? {});
                        }
                    }
                    setError('');
                } catch (err) {
                    if (!mounted) return;
                    setError(err instanceof Error ? err.message : 'Chargement impossible.');
                } finally {
                    if (mounted) setLoading(false);
                }
            }

            void loadHomeData();
            return () => {
                mounted = false;
            };
        }, [])
    );

    const vodById = useMemo(() => {
        return new Map(vodStreams.map((item) => [item.stream_id, item]));
    }, [vodStreams]);

    const seriesById = useMemo(() => {
        return new Map(seriesList.map((item) => [item.series_id, item]));
    }, [seriesList]);

    const liveById = useMemo(() => {
        return new Map(liveStreams.map((item) => [item.stream_id, item]));
    }, [liveStreams]);

    const continueItems = useMemo(() => {
        return resumeItems
            .filter((item) => item.type !== 'tv' && !item.completed)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((item) => {
                if (item.type === 'movie') {
                    const movie = vodById.get(item.id);
                    const title = item.title ?? movie?.name;
                    if (!title) return null;
                    const image = item.image ?? movie?.cover ?? movie?.stream_icon;
                    const progress = item.durationSec ? item.positionSec / item.durationSec : undefined;
                    return {
                        key: `resume-movie-${item.id}`,
                        type: 'movie' as const,
                        id: item.id,
                        title,
                        image,
                        progress,
                        extension: movie?.container_extension ?? 'mp4',
                        resume: item,
                    };
                }
                if (item.type === 'series' && item.seriesId) {
                    const series = seriesById.get(item.seriesId);
                    const title = item.title ?? series?.name;
                    if (!title) return null;
                    const image = item.image ?? series?.cover ?? series?.backdrop_path?.[0];
                    const progress = item.durationSec ? item.positionSec / item.durationSec : undefined;
                    return {
                        key: `resume-series-${item.seriesId}`,
                        type: 'series' as const,
                        id: item.seriesId,
                        title,
                        image,
                        progress,
                        resume: item,
                    };
                }
                return null;
            })
            .filter((item): item is NonNullable<typeof item> => !!item);
    }, [resumeItems, seriesById, vodById]);

    const favoriteMedia = useMemo(() => {
        return favorites
            .filter((item) => item.type !== 'tv')
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((item) => {
                if (item.type === 'movie') {
                    const movie = vodById.get(item.id);
                    if (!movie) return null;
                    return {
                        key: `fav-movie-${movie.stream_id}`,
                        type: 'movie' as const,
                        id: movie.stream_id,
                        title: movie.name,
                        image: movie.cover ?? movie.stream_icon,
                    };
                }
                const series = seriesById.get(item.id);
                if (!series) return null;
                return {
                    key: `fav-series-${series.series_id}`,
                    type: 'series' as const,
                    id: series.series_id,
                    title: series.name,
                    image: series.cover ?? series.backdrop_path?.[0],
                };
            })
            .filter((item): item is NonNullable<typeof item> => !!item);
    }, [favorites, seriesById, vodById]);

    const favoriteChannels = useMemo(() => {
        return favorites
            .filter((item) => item.type === 'tv')
            .sort((a, b) => b.addedAt - a.addedAt)
            .map((item) => liveById.get(item.id))
            .filter((item): item is XtreamStream => !!item);
    }, [favorites, liveById]);

    const recentMovies = useMemo(() => {
        return vodStreams.slice(-14).reverse();
    }, [vodStreams]);

    const recentSeries = useMemo(() => {
        return seriesList.slice(-14).reverse();
    }, [seriesList]);

    const hasCurrentProgram = useCallback(
        (stream: XtreamStream) => {
            const channelId = resolveXmltvChannelId(stream, tvXmltvChannelIdByName);
            const listings = tvXmltvListings[channelId];
            if (!listings?.length) return false;
            const now = Date.now();
            return listings.some((listing) => {
                const start = parseEpgDate(listing, 'start');
                const end = parseEpgDate(listing, 'end');
                if (!start || !end) return false;
                const startMs = start.getTime();
                const endMs = end.getTime();
                return startMs <= now && endMs >= now;
            });
        },
        [tvXmltvChannelIdByName, tvXmltvListings]
    );

    const favoriteChannelsWithEpg = useMemo(() => {
        return favoriteChannels.filter(
            (stream) => !!stream.stream_icon?.trim() && hasCurrentProgram(stream)
        );
    }, [favoriteChannels, hasCurrentProgram]);

    const liveHighlights = useMemo(() => {
        return liveStreams
            .filter((stream) => !!stream.stream_icon?.trim() && hasCurrentProgram(stream))
            .slice(0, 12);
    }, [liveStreams, hasCurrentProgram]);

    const ensureLogoTone = useCallback(
        (logoUri: string) =>
            ensureLogoToneCached(logoUri, {
                cache: logoToneByUri,
                pending: pendingLogoTones.current,
                setCache: setLogoToneByUri,
            }),
        [logoToneByUri]
    );

    const renderTvRow = (item: XtreamStream, showDivider: boolean) => {
        const {image, title, subtitle, metaLabel, progress} = getTvNowInfo({
            stream: item,
            channelIdByName: tvXmltvChannelIdByName,
            listingsByChannel: tvXmltvListings,
            isLoading: isPrefetching && !Object.keys(tvXmltvListings).length,
        });
        if (image) {
            void ensureLogoTone(image);
        }
        return (
            <Pressable
                key={`home-tv-${item.stream_id}`}
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
                className="px-6 py-4"
            >
                <TvRowContent
                    image={image}
                    tone={image ? logoToneByUri[image] : undefined}
                    name={item.name}
                    title={title}
                    subtitle={subtitle}
                    metaLabel={metaLabel}
                    progress={progress}
                />
                {showDivider ? <View className="mt-3 h-px w-full bg-white/10"/> : null}
            </Pressable>
        );
    };

    const featured = useMemo(() => {
        const resume = continueItems[0];
        if (resume?.type === 'movie') {
            return {
                ...resume,
                badge: 'Reprendre',
                subtitle: 'Continuer la lecture',
            };
        }
        if (resume?.type === 'series') {
            return {
                ...resume,
                badge: 'Série',
                subtitle: resume.resume?.episodeTitle
                    ? `Episode: ${resume.resume.episodeTitle}`
                    : 'Continuer la serie',
            };
        }
        const latestMovie = getLatestVod(vodStreams);
        const latestSeries = getLatestSeries(seriesList);
        return latestMovie ?? latestSeries;
    }, [continueItems, seriesList, vodStreams]);

    const handleToggleFavorite = async (type: FavoriteItem['type'], id: number) => {
        const next = await toggleFavoriteItem(type, id);
        setFavorites(next);
    };

    const handleMoviePlay = (movie: XtreamVod, resume?: ResumeItem) => {
        const start =
            resume && resume.positionSec > 30 ? Math.floor(resume.positionSec) : undefined;
        router.push({
            pathname: '/player/[id]' as const,
            params: {
                id: String(movie.stream_id),
                name: movie.name,
                type: 'vod',
                ext: movie.container_extension ?? 'mp4',
                ...(start ? {start: String(start)} : {}),
            },
        });
    };

    const handleSeriesOpen = (seriesId: number, title?: string) => {
        router.push({
            pathname: '/series/[id]' as const,
            params: {id: String(seriesId), name: title ?? ''},
        });
    };

    const handleMovieOpen = (movieId: number, title?: string) => {
        router.push({
            pathname: '/movie/[id]' as const,
            params: {id: String(movieId), name: title ?? ''},
        });
    };

    const isEmpty =
        !vodStreams.length && !seriesList.length && !liveStreams.length && !loading;

    const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number } } }) => {
        const y = event.nativeEvent.contentOffset.y;
        setIsHeaderBlurred(y > 10);
    }, []);

    return (
        <View className="flex-1 bg-black">
            <View
                className="absolute left-0 right-0 top-0 z-10"
                style={{height: headerHeight, paddingTop: headerTopPadding}}
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
                <View className="px-6">
                    <View className="flex-row items-center justify-between">
                        <Text className="flex-1 font-display text-3xl text-white">Accueil</Text>
                        <View className="flex-row items-center gap-4">
                            <Ionicons name="download-outline" size={22} color="#ffffff"/>
                            <Ionicons name="notifications-outline" size={22} color="#ffffff"/>
                        </View>
                    </View>
                    <View className="mt-3 flex-row gap-1.5">
                        <Pressable
                            onPress={() => router.push('/series')}
                            className="flex-1 items-center justify-center rounded-l-full rounded-r-lg border border-white/10 bg-white/5 py-3"
                        >
                            <Text className="font-semibold text-base text-white">Séries</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => router.push('/movies')}
                            className="flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 py-3"
                        >
                            <Text className="font-semibold text-base text-white">Films</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => router.push('/tv')}
                            className="flex-1 items-center justify-center rounded-r-full border border-white/10 bg-white/5 py-3"
                        >
                            <Text className="font-semibold text-base text-white">Chaînes TV</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{paddingBottom: 120}}
                showsVerticalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <View style={{height: headerHeight}}/>
                {featured ? (
                    <View className="px-6">
                        <FeaturedCard
                            title={featured.title}
                            image={featured.image}
                            badge={featured.badge}
                            subtitle={'subtitle' in featured ? featured.subtitle : undefined}
                            progress={'progress' in featured ? featured.progress : undefined}
                            onPress={() => {
                                if (featured.type === 'movie') {
                                    handleMovieOpen(featured.id, featured.title);
                                } else if (featured.type === 'series') {
                                    handleSeriesOpen(featured.id, featured.title);
                                }
                            }}
                            onPlay={() => {
                                if (featured.type === 'movie') {
                                    const movie = vodById.get(featured.id);
                                    if (movie) {
                                        handleMoviePlay(
                                            movie,
                                            'resume' in featured ? featured.resume : undefined
                                        );
                                    } else {
                                        handleMovieOpen(featured.id, featured.title);
                                    }
                                } else if (featured.type === 'series') {
                                    handleSeriesOpen(featured.id, featured.title);
                                }
                            }}
                            playLabel={featured.type === 'series' ? 'Ouvrir' : 'Lecture'}
                            isFavorite={favorites.some(
                                (item) => item.type === featured.type && item.id === featured.id
                            )}
                            onToggleFavorite={() =>
                                handleToggleFavorite(
                                    featured.type === 'movie' ? 'movie' : 'series',
                                    featured.id
                                )
                            }
                        />
                    </View>
                ) : null}

                {continueItems.length ? (
                    <View className="pt-2">
                        <SectionHeader title="Reprendre la lecture"/>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={continueItems}
                            keyExtractor={(item) => item.key}
                            renderItem={({item}) => (
                                <MediaCard
                                    title={item.title}
                                    image={item.image}
                                    progress={item.progress}
                                    onPress={() => {
                                        if (item.type === 'movie') {
                                            const movie = vodById.get(item.id);
                                            if (movie) {
                                                handleMoviePlay(movie, item.resume);
                                            } else {
                                                handleMovieOpen(item.id, item.title);
                                            }
                                        } else {
                                            handleSeriesOpen(item.id, item.title);
                                        }
                                    }}
                                />
                            )}
                            contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                            initialNumToRender={8}
                            maxToRenderPerBatch={8}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    </View>
                ) : null}

                {favoriteMedia.length ? (
                    <View className="pt-6">
                        <SectionHeader title="Ma liste"/>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={favoriteMedia.slice(0, 14)}
                            keyExtractor={(item) => item.key}
                            renderItem={({item}) => (
                                <MediaCard
                                    title={item.title}
                                    image={item.image}
                                    onPress={() => {
                                        if (item.type === 'movie') {
                                            handleMovieOpen(item.id, item.title);
                                        } else {
                                            handleSeriesOpen(item.id, item.title);
                                        }
                                    }}
                                />
                            )}
                            contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                            initialNumToRender={8}
                            maxToRenderPerBatch={8}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    </View>
                ) : null}

                {recentMovies.length ? (
                    <View className="pt-6">
                        <SectionHeader
                            title="Films récents"
                            link="/movies"
                        />
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={recentMovies}
                            keyExtractor={(item) => `movie-${item.stream_id}`}
                            renderItem={({item}) => (
                                <MediaCard
                                    title={item.name}
                                    image={item.cover ?? item.stream_icon}
                                    onPress={() => handleMovieOpen(item.stream_id, item.name)}
                                />
                            )}
                            contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                            initialNumToRender={8}
                            maxToRenderPerBatch={8}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    </View>
                ) : null}

                {recentSeries.length ? (
                    <View className="pt-6">
                        <SectionHeader
                            title="Séries récentes"
                            link="/series"
                        />
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            data={recentSeries}
                            keyExtractor={(item) => `series-${item.series_id}`}
                            renderItem={({item}) => (
                                <MediaCard
                                    title={item.name}
                                    image={item.cover ?? item.backdrop_path?.[0]}
                                    onPress={() => handleSeriesOpen(item.series_id, item.name)}
                                />
                            )}
                            contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                            initialNumToRender={8}
                            maxToRenderPerBatch={8}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    </View>
                ) : null}

                {favoriteChannelsWithEpg.length ? (
                    <View className="pt-6">
                        <SectionHeader
                            title="Chaînes favorites"
                            link="/tv"
                        />
                        <View className="mt-2">
                            {favoriteChannelsWithEpg.slice(0, 10).map((item, index, list) =>
                                renderTvRow(item, index < list.length - 1)
                            )}
                        </View>
                    </View>
                ) : null}

                {liveHighlights.length ? (
                    <View className="pt-6">
                        <SectionHeader title="En direct" link="/tv"/>
                        <View className="mt-2">
                            {liveHighlights.slice(0, 10).map((item, index, list) =>
                                renderTvRow(item, index < list.length - 1)
                            )}
                        </View>
                    </View>
                ) : null}

                {loading && !isPrefetching && !vodStreams.length && !seriesList.length ? (
                    <View className="pt-10 items-center">
                        <ActivityIndicator size="large" color="#ffffff"/>
                        <Text className="mt-4 font-body text-sm text-white/80">
                            Chargement du contenu...
                        </Text>
                    </View>
                ) : null}

                {error && !loading ? (
                    <View className="px-6 pt-6">
                        <Text className="font-body text-ember">{error}</Text>
                    </View>
                ) : null}

                {isEmpty ? (
                    <View className="px-6 pt-10">
                        <Text className="font-body text-mist">
                            Aucun contenu en cache pour le moment.
                        </Text>
                    </View>
                ) : null}
            </ScrollView>

            {isPrefetching ? (
                <View className="absolute inset-0 items-center justify-center bg-black/90 h-screen w-screen z-50">
                    <ActivityIndicator size="large" color="#ffffff"/>
                    <Text className="mt-4 font-semibold text-base text-white/80">
                        {prefetchMessage}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}
