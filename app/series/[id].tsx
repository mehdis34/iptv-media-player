import Ionicons from '@expo/vector-icons/Ionicons';
import {BlurView} from 'expo-blur';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Image, Modal, Pressable, ScrollView, Text, useWindowDimensions, View,} from 'react-native';

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
    getResumeItems,
    setCatalogCache,
    toggleFavoriteItem,
} from '@/lib/storage';
import {buildTrailerMeta} from '@/lib/trailer.utils';
import {fetchSeries, fetchSeriesInfo} from '@/lib/xtream';
import type {FavoriteItem, ResumeItem, XtreamEpisode, XtreamSeries, XtreamSeriesInfo} from '@/lib/types';

export default function SeriesDetailScreen() {
    const router = useRouter();
    const {height} = useWindowDimensions();
    const params = useLocalSearchParams<{ id?: string; name?: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null);
    const [seriesList, setSeriesList] = useState<XtreamSeries[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
    const [resumeEntry, setResumeEntry] = useState<ResumeItem | null>(null);
    const [resumeEpisode, setResumeEpisode] = useState<XtreamEpisode | null>(null);
    const [heroTone, setHeroTone] = useState('#000000');
    const [activeTab, setActiveTab] = useState<'episodes' | 'similar' | 'trailer'>('episodes');
    const [seasonOptions, setSeasonOptions] = useState<number[]>([]);
    const [season, setSeason] = useState<number | null>(null);
    const [showFullPlot, setShowFullPlot] = useState(false);
    const [showSeasonPicker, setShowSeasonPicker] = useState(false);
    const [tabLayouts, setTabLayouts] = useState<{
        episodes?: { x: number; width: number; pad: number };
        similar?: { x: number; width: number; pad: number };
        trailer?: { x: number; width: number; pad: number };
    }>({});
    const underlineX = useRef(new Animated.Value(0)).current;
    const underlineWidth = useRef(new Animated.Value(0)).current;
    const tabsScrollRef = useRef<ScrollView>(null);

    const seriesId = Number(params.id ?? 0);
    const heroHeight = Math.round(height * 0.3);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const creds = await getCredentials();
                if (!creds || !seriesId) {
                    router.replace('/login');
                    return;
                }
                const cache = await getCatalogCache(['seriesList']);
                if (!mounted) return;
                if (cache.data.seriesList) {
                    setSeriesList(cache.data.seriesList);
                }
                const [info, favs] = await Promise.all([
                    fetchSeriesInfo(creds, seriesId),
                    getFavoriteItems(),
                ]);
                if (!mounted) return;
                setSeriesInfo(info);
                setFavorites(favs);
                setLoading(false);

                const now = Date.now();
                const cacheFresh =
                    cache.updatedAt.seriesList &&
                    now - cache.updatedAt.seriesList < CATALOG_CACHE_TTL_MS;
                if (!cacheFresh) {
                    try {
                        const list = await fetchSeries(creds);
                        if (!mounted) return;
                        setSeriesList(list);
                        await setCatalogCache({seriesList: list});
                    } catch {
                        if (!mounted) return;
                        if (!cache.data.seriesList?.length) {
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
    }, [router, seriesId]);

    const details = useMemo(() => seriesInfo?.info ?? {}, [seriesInfo]);
    const trailer = details.trailer ?? details.youtube_trailer ?? '';
    const trailerMeta = useMemo(() => buildTrailerMeta(trailer), [trailer]);
    const trailerUrl = trailerMeta.url;
    const trailerThumb = trailerMeta.thumbnail;

    const title = details.name ?? params.name ?? 'Série';
    const cover = details.backdrop_path?.[0] ?? details.cover;
    const safeCover = safeImageUri(cover);
    const plot = details.plot ?? details.description ?? '';
    const cast = details.cast ?? details.actors ?? '';
    const genre = details.genre ?? '';
    const rating = details.rating ? String(details.rating) : '';
    const release = details.releaseDate ?? details.releasedate ?? '';
    const releaseYear = release ? String(release).slice(0, 4) : '';
    const metaParts = [releaseYear, genre, rating && `${rating}/10`]
        .filter(Boolean)
        .join(' • ');

    const episodesBySeason = useMemo(() => seriesInfo?.episodes ?? {}, [seriesInfo]);

    const refreshResume = useCallback(() => {
        if (!seriesId) {
            setResumeItems([]);
            setResumeEntry(null);
            setResumeEpisode(null);
            return;
        }
        getResumeItems().then((items) => {
            setResumeItems(items);
            const matches = items.filter(
                (item) => item.type === 'series' && item.seriesId === seriesId
            );
            if (!matches.length) {
                setResumeEntry(null);
                setResumeEpisode(null);
                return;
            }
            const latestNonCompleted = matches
                .filter((item) => !item.completed)
                .sort((a, b) => b.updatedAt - a.updatedAt)[0];
            const latest = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
            const activeResume = latestNonCompleted ?? latest ?? null;
            setResumeEntry(activeResume);
            const seasonKey = activeResume?.season ? String(activeResume.season) : null;
            const list = seasonKey ? episodesBySeason[seasonKey] : null;
            const found =
                list?.find((episode) => String(episode.id) === String(activeResume?.id)) ?? null;
            setResumeEpisode(found);
        });
    }, [episodesBySeason, seriesId]);

    useEffect(() => {
        refreshResume();
    }, [refreshResume]);

    useFocusEffect(
        useCallback(() => {
            refreshResume();
            return () => undefined;
        }, [refreshResume])
    );

    useEffect(() => {
        const seasons = Object.keys(episodesBySeason)
            .map((key) => Number(key))
            .filter((value) => !Number.isNaN(value))
            .sort((a, b) => a - b);
        setSeasonOptions(seasons);
        if (season === null && seasons.length) {
            setSeason(seasons[0]);
        }
    }, [episodesBySeason, season]);

    const episodes = useMemo<XtreamEpisode[]>(() => {
        if (season === null) return [];
        const key = String(season);
        return episodesBySeason[key] ?? [];
    }, [episodesBySeason, season]);

    const firstEpisode = useMemo(() => {
        return episodes.find((item) => Number.isFinite(Number(item.id))) ?? null;
    }, [episodes]);
    const firstSeasonEpisode = useMemo(() => {
        const firstSeason = seasonOptions[0];
        if (firstSeason === undefined) return null;
        return (
            episodesBySeason[String(firstSeason)]?.find((item) =>
                Number.isFinite(Number(item.id))
            ) ?? null
        );
    }, [episodesBySeason, seasonOptions]);
    const firstEpisodeOverall = useMemo(() => {
        const seasons = Object.keys(episodesBySeason)
            .map((key) => Number(key))
            .filter((value) => !Number.isNaN(value))
            .sort((a, b) => a - b);
        for (const value of seasons) {
            const episode =
                episodesBySeason[String(value)]?.find((item) =>
                    Number.isFinite(Number(item.id))
                ) ?? null;
            if (episode) {
                return {episode, season: value};
            }
        }
        return null;
    }, [episodesBySeason]);

    const resumeSeason = resumeEntry?.season ?? null;
    const resumePlayable = resumeEpisode ?? null;
    const hasResume = !!resumeEntry && !resumeEntry.completed;
    const isCompleted = !!resumeEntry?.completed;
    const resumeEpisodeLabel = useMemo(() => {
        if (!hasResume) return '';
        const seasonValue = resumeEntry?.season ?? null;
        const titleValue = resumeEpisode?.title ?? resumeEpisode?.name ?? '';
        const seMatch = titleValue.match(/S(\d+)\D*E(\d+)/i);
        if (seMatch) {
            const s = String(seMatch[1]).padStart(2, '0');
            const e = String(seMatch[2]).padStart(2, '0');
            return `S${s}E${e}`;
        }
        const epMatch = titleValue.match(/Épisode\s*(\d+)/i);
        if (seasonValue !== null && epMatch) {
            const s = String(seasonValue).padStart(2, '0');
            const e = String(epMatch[1]).padStart(2, '0');
            return `S${s}E${e}`;
        }
        if (seasonValue !== null && resumeEpisode?.episode_num) {
            const s = String(seasonValue).padStart(2, '0');
            const e = String(resumeEpisode.episode_num).padStart(2, '0');
            return `S${s}E${e}`;
        }
        return '';
    }, [hasResume, resumeEntry?.season, resumeEpisode?.episode_num, resumeEpisode?.name, resumeEpisode?.title]);
    const playLabel = isCompleted
        ? 'Revoir'
        : hasResume
            ? `Reprendre${resumeEpisodeLabel ? ` ${resumeEpisodeLabel}` : ''}`
            : 'Lecture';

    const similarItems = useMemo(() => {
        const fallbackCategoryId = seriesList.find((item) => item.series_id === seriesId)?.category_id;
        const categoryId = seriesInfo?.series?.category_id ?? fallbackCategoryId;
        if (!categoryId) return [];
        return seriesList
            .filter((item) => item.category_id === categoryId && item.series_id !== seriesId)
            .slice(0, 21);
    }, [seriesId, seriesInfo, seriesList]);

    const resumeEpisodeMap = useMemo(() => {
        const map = new Map<number, ResumeItem>();
        resumeItems
            .filter((item) => item.type === 'series' && item.seriesId === seriesId)
            .forEach((item) => map.set(Number(item.id), item));
        return map;
    }, [resumeItems, seriesId]);

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

    useEffect(() => {
        const target =
            activeTab === 'episodes'
                ? tabLayouts.episodes
                : activeTab === 'similar'
                    ? tabLayouts.similar
                    : tabLayouts.trailer;
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

    const openSeasonPicker = () => {
        if (!seasonOptions.length) return;
        setShowSeasonPicker(true);
    };

    const isFavorite = favorites.some((fav) => fav.type === 'series' && fav.id === seriesId);
    const handleToggleFavorite = async () => {
        if (!seriesId) return;
        const next = await toggleFavoriteItem('series', seriesId);
        setFavorites(next);
    };

    const handlePlay = () => {
        const target = resumePlayable ?? firstSeasonEpisode ?? firstEpisodeOverall?.episode ?? firstEpisode;
        if (!target) return;
        const start =
            hasResume && !isCompleted ? Math.floor(resumeEntry?.positionSec ?? 0) : undefined;
        router.push({
            pathname: '/player/[id]' as const,
            params: {
                id: String(target.id),
                name: title,
                type: 'series',
                ext: target.container_extension ?? 'mp4',
                seriesId: String(seriesId),
                season: resumePlayable
                    ? resumeSeason !== null
                        ? String(resumeSeason)
                        : undefined
                    : firstSeasonEpisode
                        ? String(seasonOptions[0] ?? '')
                        : firstEpisodeOverall
                            ? String(firstEpisodeOverall.season)
                            : season
                                ? String(season)
                                : undefined,
                ...(start ? {start: String(start)} : {}),
            },
        });
    };

    if (!seriesId) {
        return (
            <View className="flex-1 items-center justify-center bg-black px-6">
                <Text className="font-body text-ember">Série introuvable.</Text>
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

    const tabs = [
        {key: 'episodes', label: 'Épisodes'},
        {key: 'similar', label: 'Séries similaires'},
        ...(trailerUrl ? [{key: 'trailer', label: 'Bande-annonce'}] : []),
    ];

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
                </View>

                {activeTab === 'episodes' ? (
                    <View className="mt-6 px-6">
                        <View className="self-start">
                            <Pressable
                                onPress={openSeasonPicker}
                                className="relative self-start rounded-xl bg-white/10 px-8 py-3"
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="font-bodySemi text-base text-white">
                                        Saison {season ?? '-'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#ffffff"/>
                                </View>
                            </Pressable>
                        </View>

                        <FlatList
                            data={episodes}
                            keyExtractor={(item, index) => `ep-${item.id ?? index}`}
                            scrollEnabled={false}
                            contentContainerStyle={{paddingTop: 16, gap: 20}}
                            renderItem={({item}) => (
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/player/[id]' as const,
                                            params: {
                                                id: String(item.id),
                                                name: title,
                                                type: 'series',
                                                ext: item.container_extension ?? 'mp4',
                                                seriesId: String(seriesId),
                                                season: season ? String(season) : undefined,
                                            },
                                        })
                                    }
                                >
                                    <View className="flex-row gap-4">
                                        <View className="h-20 w-32 overflow-hidden rounded-xl bg-slate">
                                            {safeImageUri(
                                                item.info?.movie_image ??
                                                item.info?.cover_big ??
                                                item.info?.backdrop_path?.[0]
                                            ) ? (
                                                <Image
                                                    source={{
                                                        uri: safeImageUri(
                                                            item.info?.movie_image ??
                                                            item.info?.cover_big ??
                                                            item.info?.backdrop_path?.[0]
                                                        ),
                                                    }}
                                                    className="h-full w-full"
                                                    resizeMode="cover"
                                                />
                                            ) : null}
                                            <View className="absolute inset-0 items-center justify-center">
                                                <View
                                                    className="h-8 w-8 items-center justify-center rounded-full bg-black/60">
                                                    <Ionicons name="play" size={16} color="#ffffff"/>
                                                </View>
                                            </View>
                                            {(() => {
                                                const resume = resumeEpisodeMap.get(Number(item.id));
                                                if (!resume || !resume.durationSec) return null;
                                                const progress = resume.positionSec / resume.durationSec;
                                                if (progress <= 0) return null;
                                                return (
                                                    <View
                                                        className="absolute bottom-1 left-1 right-1 h-1 overflow-hidden rounded-full bg-black/60">
                                                        <View
                                                            className="h-full bg-ember"
                                                            style={{width: `${Math.min(100, progress * 100)}%`}}
                                                        />
                                                    </View>
                                                );
                                            })()}
                                        </View>
                                        <View className="flex-1 justify-center">
                                            <Text className="font-bodySemi text-base text-white" numberOfLines={2}>
                                                {item.title ?? item.name ?? `Episode ${item.episode_num ?? ''}`}
                                            </Text>
                                            {item.info?.duration ? (
                                                <Text className="mt-1 font-body text-sm text-white/70">
                                                    {item.info.duration}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <Text className="mt-2 font-body text-sm text-mist" numberOfLines={3}>
                                        {item.info?.plot ?? 'Description indisponible.'}
                                    </Text>
                                </Pressable>
                            )}
                        />
                    </View>
                ) : null}

                {activeTab === 'similar' ? (
                    <View className="mt-6 px-3">
                        <MediaGrid
                            data={similarItems}
                            keyExtractor={(item) => String(item.series_id)}
                            columnWrapperStyle={{paddingHorizontal: 12, marginTop: 12}}
                            renderItem={({item}) => (
                                <MediaCard
                                    title={item.name}
                                    image={item.cover ?? item.backdrop_path?.[0]}
                                    progress={(() => {
                                        const resume = resumeItems.find(
                                            (entry) =>
                                                entry.type === 'series' &&
                                                entry.seriesId === item.series_id
                                        );
                                        if (!resume || !resume.durationSec) return undefined;
                                        return resume.positionSec / resume.durationSec;
                                    })()}
                                    size="grid"
                                    onPress={() =>
                                        router.push({
                                            pathname: '/series/[id]' as const,
                                            params: {id: String(item.series_id), name: item.name},
                                        })
                                    }
                                />
                            )}
                        />
                    </View>
                ) : null}

                {activeTab === 'trailer' && trailerUrl ? (
                    <View className="mt-6 px-6">
                        <TrailerCard url={trailerUrl} thumbnail={trailerThumb} />
                    </View>
                ) : null}
            </ScrollView>

            <Modal
                transparent
                visible={showSeasonPicker}
                animationType="fade"
                onRequestClose={() => setShowSeasonPicker(false)}
            >
                <Pressable
                    onPress={() => setShowSeasonPicker(false)}
                    className="flex-1 items-center justify-center"
                >
                    <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                    <View className="max-h-[60vh] w-full items-center justify-center">
                        <ScrollView
                            contentContainerStyle={{
                                alignItems: 'center',
                                paddingVertical: 12,
                                flexGrow: 1,
                                justifyContent: 'center',
                            }}
                        >
                            <View className="items-center gap-4">
                                {seasonOptions.map((value) => {
                                    const selected = season === value;
                                    return (
                                        <Pressable
                                            key={`season-${value}`}
                                            onPress={() => {
                                                setSeason(value);
                                                setShowSeasonPicker(false);
                                            }}
                                            className="rounded-full px-6 py-3"
                                        >
                                            <Text
                                                className={`font-bodySemi text-xl ${
                                                    selected ? 'text-white' : 'text-white/60'
                                                }`}
                                            >
                                                Saison {value}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
