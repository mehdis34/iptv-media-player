import Ionicons from '@expo/vector-icons/Ionicons';
import {useEffect, useMemo, useState} from 'react';
import {FlatList, Image, Pressable, Text, TextInput, View} from 'react-native';
import {useRouter} from 'expo-router';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';

import {getActiveProfileId, getCatalogCache, getCredentials} from '@/lib/storage';
import {getEpgCache} from '@/lib/epg-cache';
import {parseEpgDate, resolveXmltvChannelId} from '@/lib/epg.utils';
import {fetchSeriesInfo} from '@/lib/xtream';
import type {XtreamSeries, XtreamStream, XtreamVod} from '@/lib/types';
import {safeImageUri} from '@/lib/media';
import {type SearchFormValues, searchSchema} from '@/schemas/search.schema';

export default function SearchScreen() {
    const router = useRouter();
    const [streams, setStreams] = useState<XtreamStream[]>([]);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const [series, setSeries] = useState<XtreamSeries[]>([]);
    const [epgCache, setEpgCacheState] = useState<Awaited<ReturnType<typeof getEpgCache>>>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const {
        control,
        watch,
        formState: {errors},
    } = useForm<SearchFormValues>({
        resolver: zodResolver(searchSchema),
        defaultValues: {
            query: '',
        },
        mode: 'onChange',
    });
    const query = watch('query');
    const getAdded = (value?: string | number) => {
        if (value === undefined || value === null) return 0;
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : 0;
    };
    const getReleaseYear = (item: XtreamVod | XtreamSeries) => {
        const candidate = (item as { releaseDate?: string; releasedate?: string }).releaseDate ??
            (item as { releasedate?: string }).releasedate;
        const match = candidate?.match(/\d{4}/);
        if (match) return Number(match[0]);
        return 0;
    };
    const normalizeSearch = (value: string) =>
        value
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    const getMediaKeyFromItem = (item: XtreamVod | XtreamSeries) =>
        'stream_id' in item ? `movie-${item.stream_id}` : `series-${item.series_id}`;
    const matchesMediaQuery = (item: XtreamVod | XtreamSeries, normalizedQuery: string) =>
        !!normalizedQuery && normalizeSearch(item.name).includes(normalizedQuery);
    const getReleaseDate = (item: XtreamVod | XtreamSeries) => {
        const candidate = (item as { releaseDate?: string; releasedate?: string }).releaseDate ??
            (item as { releasedate?: string }).releasedate;
        if (!candidate) return null;
        const parsed = new Date(candidate);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const isRecentRelease = (item: XtreamVod | XtreamSeries) => {
        const date = getReleaseDate(item);
        if (!date) return false;
        const now = Date.now();
        const diff = now - date.getTime();
        return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
    };

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const [cache, profileId] = await Promise.all([getCatalogCache(), getActiveProfileId()]);
                const epg = await getEpgCache(profileId);
                if (mounted) {
                    setStreams(cache.data.liveStreams ?? []);
                    setVodStreams(cache.data.vodStreams ?? []);
                    setSeries(cache.data.seriesList ?? []);
                    setEpgCacheState(epg);
                }
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : 'Recherche indisponible.');
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [router]);

    const {tvResults, mediaResults, tvSuggested, mediaSuggested} = useMemo(() => {
        const trimmedQuery = query.trim();
        const normalizedQuery = normalizeSearch(trimmedQuery);
        const currentYear = new Date().getFullYear();
        const previousYear = currentYear - 1;
        const applyRecentYearFilter = <T extends { item: XtreamVod | XtreamSeries }>(
            items: T[],
            desiredCount: number
        ) => {
            const current = items.filter((entry) => entry.item && getReleaseYear(entry.item) === currentYear);
            if (current.length >= desiredCount) return current;
            const previous = items.filter((entry) => getReleaseYear(entry.item) === previousYear);
            const selected = [...current, ...previous];
            if (selected.length >= desiredCount) return selected;
            const selectedKeys = new Set(selected.map((entry) => getMediaKeyFromItem(entry.item)));
            const remaining = items.filter((entry) => {
                const key = getMediaKeyFromItem(entry.item);
                return !selectedKeys.has(key);
            });
            return [...selected, ...remaining];
        };
        if (!trimmedQuery) {
            const now = Date.now();
            const channelIdByName = epgCache?.channelIdByName ?? {};
            const listingsByChannel = epgCache?.listingsByChannel ?? {};
            const hasCurrentProgram = (stream: XtreamStream) => {
                const channelId = resolveXmltvChannelId(stream, channelIdByName);
                const listings = listingsByChannel[channelId];
                if (!listings?.length) return false;
                return listings.some((listing) => {
                    const start = parseEpgDate(listing, 'start');
                    const end = parseEpgDate(listing, 'end');
                    if (!start || !end) return false;
                    const startMs = start.getTime();
                    const endMs = end.getTime();
                    return startMs <= now && endMs >= now;
                });
            };
            const suggestedMixed = [
                ...vodStreams
                    .filter((item) => !!safeImageUri(item.cover ?? item.stream_icon))
                    .map((item) => ({
                        type: 'movie' as const,
                        item,
                        added: getAdded(item.added),
                    })),
                ...series
                    .filter((item) => !!safeImageUri(item.cover ?? item.backdrop_path?.[0]))
                    .map((item) => ({
                        type: 'series' as const,
                        item,
                        added: getAdded(item.added),
                    })),
            ];
            const filteredSuggestedMixed = applyRecentYearFilter(suggestedMixed, 20)
                .sort((a, b) => b.added - a.added)
                .slice(0, 20)
                .map(({type, item}) => ({type, item}));
            const suggestedTv = streams
                .filter((stream) => !!safeImageUri(stream.stream_icon))
                .filter((stream) => hasCurrentProgram(stream))
                .slice(0, 12);
            return {
                tvResults: streams.slice(0, 12),
                mediaResults: [
                    ...vodStreams.slice(0, 8).map((item) => ({type: 'movie' as const, item})),
                    ...series.slice(0, 8).map((item) => ({type: 'series' as const, item})),
                ].slice(0, 10),
                tvSuggested: suggestedTv,
                mediaSuggested: filteredSuggestedMixed,
            };
        }
        if (!normalizedQuery) {
            return {
                tvResults: [],
                mediaResults: [],
                tvSuggested: [],
                mediaSuggested: [],
            };
        }
        const filteredMedia = [
            ...vodStreams
                .filter((item) => matchesMediaQuery(item, normalizedQuery))
                .map((item) => ({type: 'movie' as const, item, added: getAdded(item.added)})),
            ...series
                .filter((item) => matchesMediaQuery(item, normalizedQuery))
                .map((item) => ({type: 'series' as const, item, added: getAdded(item.added)})),
        ];
        const recentMedia = applyRecentYearFilter(filteredMedia, 40)
            .sort((a, b) => b.added - a.added)
            .slice(0, 40)
            .map(({type, item}) => ({type, item}));
        return {
            tvResults: streams
                .filter((stream) => normalizeSearch(stream.name).includes(normalizedQuery))
                .slice(0, 20),
            mediaResults: recentMedia,
            tvSuggested: [],
            mediaSuggested: [],
        };
    }, [query, series, streams, vodStreams, epgCache]);

    const handlePlaySeries = async (seriesItem: XtreamSeries) => {
        try {
            const creds = await getCredentials();
            if (!creds) {
                router.replace('/login');
                return;
            }
            const info = await fetchSeriesInfo(creds, Number(seriesItem.series_id));
            const episodesBySeason = info.episodes ?? {};
            const seasons = Object.keys(episodesBySeason)
                .map((key) => Number(key))
                .filter((value) => !Number.isNaN(value))
                .sort((a, b) => a - b);
            const firstSeason = seasons[0];
            const firstEpisode =
                firstSeason !== undefined
                    ? episodesBySeason[String(firstSeason)]?.find((ep) => ep.id)
                    : undefined;
            if (!firstEpisode) {
                router.push({
                    pathname: '/series/[id]' as const,
                    params: {id: String(seriesItem.series_id), name: seriesItem.name},
                });
                return;
            }
            router.push({
                pathname: '/player/[id]' as const,
                params: {
                    id: String(firstEpisode.id),
                    name: seriesItem.name,
                    type: 'series',
                    ext: firstEpisode.container_extension ?? 'mp4',
                    seriesId: String(seriesItem.series_id),
                    season: firstSeason !== undefined ? String(firstSeason) : undefined,
                },
            });
        } catch {
            router.push({
                pathname: '/series/[id]' as const,
                params: {id: String(seriesItem.series_id), name: seriesItem.name},
            });
        }
    };

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-ink">
                <Text className="font-body text-mist">Chargement...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View className="flex-1 items-center justify-center bg-ink px-6">
                <Text className="font-body text-ember">{error}</Text>
            </View>
        );
    }

    const mediaList = query.trim() ? mediaResults : mediaSuggested;
    const listPaddingTop = query.trim() ? 0 : 16;
    const hasMedia = mediaList.length > 0;
    const hasTv = query.trim() ? tvResults.length > 0 : tvSuggested.length > 0;
    const showEmptyState = !hasMedia && !hasTv;
    const renderTvCard = (stream: XtreamStream, marginRight = true) => {
        const logo = safeImageUri(stream.stream_icon);
        return (
            <Pressable
                onPress={() =>
                    router.push({
                        pathname: '/player/[id]' as const,
                        params: {
                            id: String(stream.stream_id),
                            name: stream.name,
                            icon: stream.stream_icon ?? undefined,
                            categoryId: stream.category_id ?? undefined,
                            type: 'tv',
                        },
                    })
                }
                className={`${marginRight ? 'mr-4' : ''} w-32`}
            >
                <View className="h-20 w-32 overflow-hidden rounded-2xl bg-white/10">
                    {logo ? <Image source={{uri: logo}} className="h-full w-full" resizeMode="contain"/> : null}
                </View>
                <Text className="mt-2 font-bodySemi text-xs text-white" numberOfLines={2}>
                    {stream.name}
                </Text>
            </Pressable>
        );
    };

    return (
        <View className="flex-1 bg-ink">
            <View className="px-6 pb-6 pt-16">
            <View className="flex-row items-center justify-between">
                <Text className="font-display text-3xl text-white flex-1">Rechercher</Text>
                <View className="flex-row items-center gap-4">
                    <Ionicons name="download-outline" size={22} color="#ffffff"/>
                    <Ionicons name="notifications-outline" size={22} color="#ffffff"/>
                </View>
            </View>
                <View className="mt-4 h-12 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                    <Ionicons name="search" size={20} color="#9ca3af"/>
                    <Controller
                        control={control}
                        name="query"
                        render={({field: {onChange, value, onBlur}}) => (
                            <View className="relative flex-1 justify-center">
                                <TextInput
                                    className="flex-1 font-body text-base text-white p-0 pr-7 placeholder:text-white/70"
                                    placeholder="Rechercher des séries, films, chaînes..."
                                    placeholderTextColor="#6b7280"
                                    value={value}
                                    onChangeText={onChange}
                                    onBlur={onBlur}
                                    textAlignVertical="center"
                                    returnKeyType="search"
                                    style={{
                                        height: '100%',
                                        lineHeight: 20,
                                        paddingVertical: 0,
                                        paddingTop: 0,
                                        paddingBottom: 0,
                                    }}
                                />
                                <Pressable
                                    onPress={() => (value ? onChange('') : null)}
                                    className="absolute right-0 h-6 w-6 items-center justify-center"
                                    style={{opacity: value ? 1 : 0}}
                                >
                                    <Ionicons name="close-circle" size={18} color="#9ca3af"/>
                                </Pressable>
                            </View>
                        )}
                    />
                </View>
                {errors.query?.message ? (
                    <Text className="mt-2 font-body text-sm text-ember">{errors.query.message}</Text>
                ) : null}
            </View>

            <FlatList
                data={mediaList}
                keyExtractor={(entry) =>
                    `${entry.type}-${'stream_id' in entry.item ? entry.item.stream_id : entry.item.series_id}`
                }
                contentContainerStyle={{paddingBottom: 80, paddingTop: listPaddingTop}}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View className="px-6 pb-4">
                        {!query.trim() && tvSuggested.length ? (
                            <View className="gap-3">
                                <Text className="font-bodySemi text-base text-white">Chaînes TV suggérées</Text>
                                <FlatList
                                    data={tvSuggested}
                                    keyExtractor={(stream) => String(stream.stream_id)}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    renderItem={({item: stream}) => renderTvCard(stream)}
                                />
                            </View>
                        ) : null}

                        {query.trim() && tvResults.length ? (
                            <View className="mt-6 gap-3">
                                <Text className="font-bodySemi text-base text-white">Chaînes TV</Text>
                                <FlatList
                                    data={tvResults}
                                    keyExtractor={(stream) => String(stream.stream_id)}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    renderItem={({
                                                     item: stream,
                                                     index
                                                 }) => renderTvCard(stream, index !== tvResults.length - 1)}
                                />
                            </View>
                        ) : null}

                        {hasMedia ? (
                            <View className="mt-6">
                                <Text className="font-bodySemi text-base text-white">
                                    {query.trim() ? 'Films et séries' : 'Séries et films suggérés'}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                }
                renderItem={({item: entry}) => {
                    const item = entry.item;
                    const image =
                        entry.type === 'movie'
                            ? safeImageUri((item as XtreamVod).cover ?? (item as XtreamVod).stream_icon)
                            : safeImageUri((item as XtreamSeries).cover ?? (item as XtreamSeries).backdrop_path?.[0]);
                    const recentRelease = isRecentRelease(item);
                    return (
                        <View className="px-6">
                            <View className="flex-row items-center gap-4 pb-3">
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: entry.type === 'movie' ? '/movie/[id]' : '/series/[id]',
                                            params: {
                                                id: String('stream_id' in item ? item.stream_id : item.series_id),
                                                name: item.name,
                                            },
                                        })
                                    }
                                    className="h-20 w-36 overflow-hidden rounded-xl bg-white/10"
                                >
                                    {image ? (
                                        <Image source={{uri: image}} className="h-full w-full" resizeMode="cover"/>
                                    ) : null}
                                    {recentRelease ? (
                                        <View className="absolute bottom-0 left-0 right-0 items-center">
                                            <View className="bg-ember px-2 py-0.5">
                                                <Text className="font-bodySemi text-[8px] text-white">Ajout
                                                    récent</Text>
                                            </View>
                                        </View>
                                    ) : null}
                                </Pressable>
                                <Text className="flex-1 font-bodySemi text-sm text-white" numberOfLines={2}>
                                    {item.name}
                                </Text>
                                <Pressable
                                    onPress={() => {
                                        if (entry.type === 'movie') {
                                            router.push({
                                                pathname: '/player/[id]' as const,
                                                params: {
                                                    id: String((item as XtreamVod).stream_id),
                                                    name: item.name,
                                                    type: 'vod',
                                                    ext: (item as XtreamVod).container_extension ?? 'mp4',
                                                },
                                            });
                                        } else {
                                            void handlePlaySeries(item as XtreamSeries);
                                        }
                                    }}
                                    className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                >
                                    <Ionicons name="play" size={16} color="#ffffff"/>
                                </Pressable>
                            </View>
                        </View>
                    );
                }}
                ListFooterComponent={<View className="h-10"/>}
                ListEmptyComponent={
                    showEmptyState ? (
                    <View className="flex-1 items-center justify-center px-16 pb-16 pt-8">
                        <Text className="text-center font-bodySemi text-3xl text-white">
                            Désolé ! Nous n'avons pas trouvé ce titre.
                        </Text>
                        <Text className="mt-2 px-4 text-center font-body text-xl text-white/60">
                            Essayez un autre titre de film, série ou chaîne TV.
                        </Text>
                    </View>
                    ) : null
                }
            />
        </View>
    );
}
