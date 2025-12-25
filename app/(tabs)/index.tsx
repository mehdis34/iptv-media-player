import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Animated, FlatList, Image, Modal, Pressable, ScrollView, SectionList, Text, useWindowDimensions, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';
import {Buffer} from 'buffer';

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
    fetchSeriesInfo,
    fetchXmltvEpg,
    fetchVodCategories,
    fetchVodStreams,
} from '@/lib/xtream';
import type {
    FavoriteItem,
    ResumeItem,
    XtreamCategory,
    XtreamEpgListing,
    XtreamSeries,
    XtreamStream,
    XtreamVod
} from '@/lib/types';
import {getDominantColor, getLatestSeries, getLatestVod, safeImageUri} from '@/lib/media';
import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import SectionHeader from '@/components/SectionHeader';
import ChannelCard from '@/components/ChannelCard';

type CategoryParams = {
    type: 'tv' | 'movies' | 'series';
    id: string;
    name?: string;
};
type TvRow = {
    key: string;
    title: string;
    items: XtreamStream[];
    href?: CategoryParams;
    kind: 'tv';
};
type MediaRow = {
    key: string;
    title: string;
    items: Array<XtreamVod | XtreamSeries>;
    href?: CategoryParams;
    kind: 'media';
};
type SectionRow = TvRow | MediaRow;

export default function HomeScreen() {
    const {height} = useWindowDimensions();
    const router = useRouter();
    const [categories, setCategories] = useState<XtreamCategory[]>([]);
    const [streams, setStreams] = useState<XtreamStream[]>([]);
    const [vodCategories, setVodCategories] = useState<XtreamCategory[]>([]);
    const [vodStreams, setVodStreams] = useState<XtreamVod[]>([]);
    const [seriesCategories, setSeriesCategories] = useState<XtreamCategory[]>([]);
    const [series, setSeries] = useState<XtreamSeries[]>([]);
    const [activeSection, setActiveSection] = useState<'tv' | 'movies' | 'series'>('tv');
    const [tvTab, setTvTab] = useState<'now' | 'guide'>('now');
    const [showTvThemes, setShowTvThemes] = useState(false);
    const [tvCategoryId, setTvCategoryId] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [resumeItems, setResumeItems] = useState<ResumeItem[]>([]);
    const [tvGuideLoading, setTvGuideLoading] = useState(false);
    const [tvNowEpgLoading, setTvNowEpgLoading] = useState(false);
    const [tvXmltvListings, setTvXmltvListings] = useState<Record<string, XtreamEpgListing[]>>({});
    const [tvXmltvChannelIdByName, setTvXmltvChannelIdByName] = useState<Record<string, string>>({});
    const [tvVisibleEpgByChannel, setTvVisibleEpgByChannel] = useState<
        Record<string, XtreamEpgListing[]>
    >({});
    const [logoToneByUri, setLogoToneByUri] = useState<Record<string, string>>({});
    const pendingLogoTones = useRef(new Set<string>());
    const [showEpgRefreshConfirm, setShowEpgRefreshConfirm] = useState(false);
    const [showEpgRefreshDone, setShowEpgRefreshDone] = useState(false);
    const isRefreshingEpg = tvGuideLoading || tvNowEpgLoading;
    const [showInitialLoader, setShowInitialLoader] = useState(false);
    const [initialLoadingMessage, setInitialLoadingMessage] = useState('Chargement en cours...');
    const [showEpgInfo, setShowEpgInfo] = useState(false);
    const [epgInfoListing, setEpgInfoListing] = useState<XtreamEpgListing | null>(null);
    const [epgInfoStream, setEpgInfoStream] = useState<XtreamStream | null>(null);
    const catalogCacheTtl = 6 * 60 * 60 * 1000;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [heroTone, setHeroTone] = useState('#000000');
    const [tvTabLayouts, setTvTabLayouts] = useState<{
        now?: { x: number; width: number; pad: number };
        guide?: { x: number; width: number; pad: number };
    }>({});
    const tvUnderlineX = useRef(new Animated.Value(0)).current;
    const tvUnderlineWidth = useRef(new Animated.Value(0)).current;
    const tvTabsScrollRef = useRef<ScrollView>(null);
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);

    const handlePlaySeries = useCallback(
        async (seriesId: number, seriesName: string) => {
            try {
                const creds = await getCredentials();
                if (!creds) {
                    router.replace('/login');
                    return;
                }
                const info = await fetchSeriesInfo(creds, seriesId);
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
                        params: {id: String(seriesId), name: seriesName},
                    });
                    return;
                }
                router.push({
                    pathname: '/player/[id]' as const,
                    params: {
                        id: String(firstEpisode.id),
                        name: seriesName,
                        type: 'series',
                        ext: firstEpisode.container_extension ?? 'mp4',
                        seriesId: String(seriesId),
                        season: firstSeason !== undefined ? String(firstSeason) : undefined,
                    },
                });
            } catch (_err) {
                router.push({
                    pathname: '/series/[id]' as const,
                    params: {id: String(seriesId), name: seriesName},
                });
            }
        },
        [router]
    );

    const loadData = useCallback(() => {
        let mounted = true;

        async function load() {
            try {
                const activeId = await getActiveProfileId();
                const profileKey = activeId ?? 'default';
                if (hasLoadedOnce.current && lastProfileKey.current === profileKey) {
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
                    cache.updatedAt.liveCategories &&
                    cache.updatedAt.liveStreams &&
                    cache.updatedAt.vodCategories &&
                    cache.updatedAt.vodStreams &&
                    cache.updatedAt.seriesCategories &&
                    cache.updatedAt.seriesList &&
                    now - cache.updatedAt.liveCategories < catalogCacheTtl &&
                    now - cache.updatedAt.liveStreams < catalogCacheTtl &&
                    now - cache.updatedAt.vodCategories < catalogCacheTtl &&
                    now - cache.updatedAt.vodStreams < catalogCacheTtl &&
                    now - cache.updatedAt.seriesCategories < catalogCacheTtl &&
                    now - cache.updatedAt.seriesList < catalogCacheTtl;

                if (cache.data.liveCategories) setCategories(cache.data.liveCategories);
                if (cache.data.liveStreams) setStreams(cache.data.liveStreams);
                if (cache.data.vodCategories) setVodCategories(cache.data.vodCategories);
                if (cache.data.vodStreams) setVodStreams(cache.data.vodStreams);
                if (cache.data.seriesCategories) setSeriesCategories(cache.data.seriesCategories);
                if (cache.data.seriesList) setSeries(cache.data.seriesList);

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

                const [
                    cats,
                    live,
                    vodCats,
                    vod,
                    seriesCats,
                    seriesList,
                ] = await Promise.all([
                    fetchLiveCategories(creds),
                    fetchLiveStreams(creds),
                    fetchVodCategories(creds),
                    fetchVodStreams(creds),
                    fetchSeriesCategories(creds),
                    fetchSeries(creds),
                ]);
                if (!mounted) return;
                setCategories(cats);
                setStreams(live);
                setVodCategories(vodCats);
                setVodStreams(vod);
                setSeriesCategories(seriesCats);
                setSeries(seriesList);
                await setCatalogCache({
                    liveCategories: cats,
                    liveStreams: live,
                    vodCategories: vodCats,
                    vodStreams: vod,
                    seriesCategories: seriesCats,
                    seriesList,
                });
                setInitialLoadingMessage('Chargement du guide TV...');
                const filteredLive = tvCategoryId
                    ? live.filter((stream) => stream.category_id === tvCategoryId)
                    : live;
                await loadEpgData(filteredLive);
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
    }, [loadEpgData, router, tvCategoryId]);

    useFocusEffect(loadData);

    const featured = useMemo(() => streams.slice(0, 10), [streams]);
    const rows = useMemo(() => {
        return categories.map((category) => ({
            category,
            items: streams.filter((stream) => stream.category_id === category.category_id).slice(0, 12),
        }));
    }, [categories, streams]);
    const vodRows = useMemo(() => {
        return vodCategories.map((category) => ({
            category,
            items: vodStreams.filter((stream) => stream.category_id === category.category_id).slice(0, 12),
        }));
    }, [vodCategories, vodStreams]);
    const seriesRows = useMemo(() => {
        return seriesCategories.map((category) => ({
            category,
            items: series.filter((item) => item.category_id === category.category_id).slice(0, 12),
        }));
    }, [seriesCategories, series]);

    const resumeMovieMap = useMemo(() => {
        const map = new Map<number, ResumeItem>();
        resumeItems
            .filter((item) => item.type === 'movie')
            .forEach((item) => map.set(item.id, item));
        return map;
    }, [resumeItems]);

    const tvCategoryStreams = useMemo(() => {
        return tvCategoryId
            ? streams.filter((stream) => stream.category_id === tvCategoryId)
            : streams;
    }, [streams, tvCategoryId]);

    const tvThemeListRef = useRef<FlatList<{id: string; name: string}> | null>(null);
    const tvThemeItemHeight = 56;
    const tvThemeItemGap = 16;
    const tvThemeOptions = useMemo(
        () => [
            {id: 'all', name: 'Toutes les chaînes'},
            ...categories.map((category) => ({
                id: category.category_id,
                name: category.category_name,
            })),
        ],
        [categories]
    );
    const selectedTvThemeIndex = useMemo(() => {
        const selectedId = tvCategoryId ?? 'all';
        return tvThemeOptions.findIndex((item) => item.id === selectedId);
    }, [tvCategoryId, tvThemeOptions]);

    const guideViewabilityConfig = useRef({itemVisiblePercentThreshold: 60}).current;
    const guideViewableUpdateRef = useRef<{
        timer: ReturnType<typeof setTimeout> | null;
        pending: Array<{item: XtreamStream}> | null;
    }>({timer: null, pending: null});
    const handleGuideViewableItemsChanged = useCallback(
        ({viewableItems}: {viewableItems: Array<{item: XtreamStream}>}) => {
            const run = (items: Array<{item: XtreamStream}>) => {
                const next: Record<string, XtreamEpgListing[]> = {};
                items.forEach(({item}) => {
                    const channelId = resolveXmltvChannelId(item);
                    next[channelId] = tvXmltvListings[channelId] ?? [];
                });
                setTvVisibleEpgByChannel(next);
                guideViewableUpdateRef.current.pending = null;
            };

            guideViewableUpdateRef.current.pending = viewableItems;
            if (guideViewableUpdateRef.current.timer) {
                clearTimeout(guideViewableUpdateRef.current.timer);
            }
            guideViewableUpdateRef.current.timer = setTimeout(() => {
                const pending = guideViewableUpdateRef.current.pending ?? [];
                run(pending);
                guideViewableUpdateRef.current.timer = null;
            }, 220);
        },
        [resolveXmltvChannelId, tvXmltvListings]
    );

    const loadEpgData = useCallback(
        async (sourceStreams: XtreamStream[]) => {
            if (!sourceStreams.length) {
                setTvXmltvListings({});
                setTvXmltvChannelIdByName({});
                return;
            }
            setTvGuideLoading(true);
            setTvNowEpgLoading(true);
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const xmltv = await fetchXmltvEpg(creds);
                setTvXmltvListings(xmltv.listingsByChannel ?? {});
                setTvXmltvChannelIdByName(xmltv.channelIdByName ?? {});
            } catch {
                setTvXmltvListings({});
                setTvXmltvChannelIdByName({});
            } finally {
                setTvGuideLoading(false);
                setTvNowEpgLoading(false);
            }
        },
        []
    );

    const handleRefreshEpg = useCallback(async () => {
        setShowEpgRefreshConfirm(false);
        setTvXmltvListings({});
        setTvXmltvChannelIdByName({});
        setTvVisibleEpgByChannel({});
        await loadEpgData(tvCategoryStreams);
        setShowEpgRefreshDone(true);
    }, [loadEpgData, tvCategoryStreams]);

    useEffect(() => {
        if (!showEpgRefreshDone) return;
        const timer = setTimeout(() => {
            setShowEpgRefreshDone(false);
        }, 1400);
        return () => clearTimeout(timer);
    }, [showEpgRefreshDone]);

    const tvList = useMemo(() => {
        if (tvTab === 'guide') return tvCategoryStreams.slice(0, 50);
        return tvCategoryStreams;
    }, [tvCategoryStreams, tvTab]);

    useEffect(() => {
        if (!showTvThemes) return;
        if (selectedTvThemeIndex < 0) return;
        const timer = setTimeout(() => {
            tvThemeListRef.current?.scrollToIndex({
                index: selectedTvThemeIndex,
                animated: true,
                viewPosition: 0.5,
                viewOffset: 0,
            });
        }, 0);
        return () => clearTimeout(timer);
    }, [showTvThemes, selectedTvThemeIndex]);

    useEffect(() => {
        if (tvTab !== 'guide') return;
        setTvVisibleEpgByChannel({});
    }, [tvCategoryId, tvTab]);

    const animateTvUnderline = useCallback(
        (target: { x: number; width: number; pad: number }) => {
            Animated.parallel([
                Animated.timing(tvUnderlineX, {
                    toValue: target.x,
                    duration: 220,
                    useNativeDriver: false,
                }),
                Animated.timing(tvUnderlineWidth, {
                    toValue: target.width - target.pad * 2,
                    duration: 220,
                    useNativeDriver: false,
                }),
            ]).start();
        },
        [tvUnderlineWidth, tvUnderlineX]
    );

    useEffect(() => {
        const target = tvTabLayouts[tvTab];
        if (!target) return;
        animateTvUnderline(target);
    }, [animateTvUnderline, tvTab, tvTabLayouts]);

    const formatClock = (date: Date | null) => {
        if (!date) return '--:--';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}h${minutes}`;
    };

    const parseEpgDate = (
        listing: XtreamEpgListing,
        kind: 'start' | 'end'
    ): Date | null => {
        const timestampKey = kind === 'start' ? 'start_timestamp' : 'stop_timestamp';
        const rawTimestamp = listing[timestampKey];
        if (typeof rawTimestamp === 'number' || /^\d+$/.test(String(rawTimestamp ?? ''))) {
            const numeric = Number(rawTimestamp);
            if (Number.isFinite(numeric)) {
                const ms = numeric > 1e12 ? numeric : numeric * 1000;
                return new Date(ms);
            }
        }
        const raw = kind === 'start' ? listing.start : listing.end;
        if (!raw) return null;
        const xmltvMatch = raw.match(/^(\d{14})/);
        if (xmltvMatch) {
            const compact = xmltvMatch[1];
            const year = Number(compact.slice(0, 4));
            const month = Number(compact.slice(4, 6)) - 1;
            const day = Number(compact.slice(6, 8));
            const hour = Number(compact.slice(8, 10));
            const minute = Number(compact.slice(10, 12));
            const second = Number(compact.slice(12, 14));
            return new Date(year, month, day, hour, minute, second);
        }
        if (/^\d{14}$/.test(raw)) {
            const year = Number(raw.slice(0, 4));
            const month = Number(raw.slice(4, 6)) - 1;
            const day = Number(raw.slice(6, 8));
            const hour = Number(raw.slice(8, 10));
            const minute = Number(raw.slice(10, 12));
            const second = Number(raw.slice(12, 14));
            return new Date(year, month, day, hour, minute, second);
        }
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const decodeEpgText = (value?: string | null) => {
        if (!value) return '';
        const trimmed = value.trim();
        if (!/^[A-Za-z0-9+/=]+$/.test(trimmed) || trimmed.length % 4 !== 0) {
            return value;
        }
        try {
            const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
            if (!decoded) return value;
            const nonPrintableRatio =
                decoded.replace(/[\x20-\x7E\u00A0-\u00FF]/g, '').length / decoded.length;
            return nonPrintableRatio > 0.3 ? value : decoded;
        } catch {
            return value;
        }
    };

    const normalizeXmltvName = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const resolveXmltvChannelId = useCallback(
        (stream: XtreamStream) => {
            if (stream.epg_channel_id) return stream.epg_channel_id;
            if (stream.epg_id) return stream.epg_id;
            const normalized = normalizeXmltvName(stream.name);
            return tvXmltvChannelIdByName[normalized] ?? String(stream.stream_id);
        },
        [tvXmltvChannelIdByName]
    );

    const formatDayLabel = (date: Date, today: Date) => {
        const startOfDay = (value: Date) =>
            new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
        const target = startOfDay(date);
        const base = startOfDay(today);
        const diffDays = Math.round((target - base) / (24 * 60 * 60 * 1000));
        if (diffDays === 0) return "Aujourd'hui";
        if (diffDays === 1) return 'Demain';
        if (diffDays === 2) return 'Après-demain';
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
    };

    const ensureLogoTone = useCallback(
        async (logoUri: string) => {
            if (logoToneByUri[logoUri] || pendingLogoTones.current.has(logoUri)) return;
            pendingLogoTones.current.add(logoUri);
            try {
                const tone = await getDominantColor(logoUri);
                if (tone) {
                    setLogoToneByUri((prev) => ({...prev, [logoUri]: tone}));
                }
            } catch {
                // Ignore failures; fall back to default background.
            } finally {
                pendingLogoTones.current.delete(logoUri);
            }
        },
        [logoToneByUri]
    );

    const buildEpgSections = (listings: XtreamEpgListing[]) => {
        const today = new Date();
        const now = new Date();
        const sorted = [...listings].sort((a, b) => {
            const aTime = parseEpgDate(a, 'start')?.getTime() ?? 0;
            const bTime = parseEpgDate(b, 'start')?.getTime() ?? 0;
            return aTime - bTime;
        });
        const sections: Array<{title: string; data: XtreamEpgListing[]}> = [];
        const sectionMap = new Map<string, XtreamEpgListing[]>();
        sorted.forEach((listing) => {
            const start = parseEpgDate(listing, 'start');
            if (!start) return;
            if (start < now) return;
            if (!start) return;
            const label = formatDayLabel(start, today);
            if (!sectionMap.has(label)) {
                sectionMap.set(label, []);
            }
            sectionMap.get(label)?.push(listing);
        });
        sectionMap.forEach((data, title) => {
            sections.push({title, data});
        });
        return sections;
    };

    const isSameListing = (a: XtreamEpgListing | null, b: XtreamEpgListing) => {
        if (!a) return false;
        if (a.epg_id && b.epg_id) return String(a.epg_id) === String(b.epg_id);
        return (
            a.start === b.start &&
            a.end === b.end &&
            decodeEpgText(a.title) === decodeEpgText(b.title)
        );
    };

    const renderTvTabs = () => (
        <ScrollView
            ref={tvTabsScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: 24, paddingRight: 24}}
        >
            <View className="relative flex-row gap-10">
                {[
                    {key: 'now', label: 'Maintenant'},
                    {key: 'guide', label: 'Programme TV'},
                ].map((tab) => {
                    const active = tvTab === tab.key;
                    return (
                        <Pressable
                            key={tab.key}
                            onPress={() => {
                                setTvTab(tab.key as 'now' | 'guide');
                                const target = tvTabLayouts[tab.key as 'now' | 'guide'];
                                if (target) {
                                    animateTvUnderline(target);
                                    tvTabsScrollRef.current?.scrollTo({x: target.x, animated: true});
                                }
                            }}
                            onLayout={(event) => {
                                const {x, width} = event.nativeEvent.layout;
                                setTvTabLayouts((prev) => ({
                                    ...prev,
                                    [tab.key]: {x, width, pad: 10},
                                }));
                            }}
                            className="pb-3"
                        >
                            <Text
                                className={`pt-4 font-bodySemi text-xl ${
                                    active ? 'text-white' : 'text-white/50'
                                }`}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        height: 4,
                        borderRadius: 999,
                        backgroundColor: '#e50914',
                        transform: [{translateX: tvUnderlineX}],
                        width: tvUnderlineWidth,
                    }}
                />
            </View>
        </ScrollView>
    );

    const hero = useMemo(() => {
        if (activeSection === 'movies') return getLatestVod(vodStreams);
        if (activeSection === 'series') return getLatestSeries(series);
        return null;
    }, [activeSection, series, vodStreams]);

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

    const handleToggleFavorite = async (streamId: number) => {
        const next = await toggleFavoriteItem('tv', streamId);
        setFavorites(next);
    };

    const makeCategoryHref = (
        type: CategoryParams['type'],
        id: string,
        name?: string
    ): CategoryParams => ({type, id, name});

    const tvRows = useMemo<TvRow[]>(() => {
        return [
            {key: 'featured', title: 'Populaires', items: featured, kind: 'tv' as const},
            ...rows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items,
                href: makeCategoryHref('tv', row.category.category_id, row.category.category_name),
                kind: 'tv' as const,
            })),
        ];
    }, [featured, rows]);

    const movieRows = useMemo<MediaRow[]>(() => {
        return [
            {
                key: 'popular',
                title: 'Films populaires',
                items: vodStreams.slice(0, 14),
                kind: 'media' as const,
                href: makeCategoryHref('movies', 'all', 'Films populaires'),
            },
            ...vodRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items as Array<XtreamVod | XtreamSeries>,
                href: makeCategoryHref('movies', row.category.category_id, row.category.category_name),
                kind: 'media' as const,
            })),
        ];
    }, [vodRows, vodStreams]);

    const seriesRowsData = useMemo<MediaRow[]>(() => {
        return [
            {
                key: 'popular',
                title: 'Séries populaires',
                items: series.slice(0, 14),
                kind: 'media' as const,
                href: makeCategoryHref('series', 'all', 'Séries populaires'),
            },
            ...seriesRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items as Array<XtreamVod | XtreamSeries>,
                href: makeCategoryHref('series', row.category.category_id, row.category.category_name),
                kind: 'media' as const,
            })),
        ];
    }, [series, seriesRows]);

    const renderHeader = useCallback(() => {
        return (
            <View className="px-6 pt-12 bg-transparent">
                <View className="mb-4 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <Text className="font-display text-3xl text-ember">N</Text>
                        <Text className="font-bodySemi text-xl text-white">Accueil</Text>
                    </View>
                    {activeSection === 'tv' ? (
                        <View className="flex-row items-center gap-3">
                            <Pressable
                                onPress={() => setShowTvThemes(true)}
                                className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            >
                                <Text className="font-body text-xs text-white/80">
                                    {tvCategoryId
                                        ? categories.find(
                                            (category) => category.category_id === tvCategoryId
                                        )?.category_name ?? 'Thématique'
                                        : 'Thématique'}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color="#ffffff"/>
                            </Pressable>
                            <Pressable
                                onPress={() => setShowEpgRefreshConfirm(true)}
                                className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2"
                            >
                                {isRefreshingEpg ? (
                                    <ActivityIndicator size="small" color="#ffffff"/>
                                ) : (
                                    <Ionicons name="refresh" size={16} color="#ffffff"/>
                                )}
                                <Text className="font-body text-xs text-white/80">Rafraîchir</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View className="flex-row items-center gap-4">
                            <Ionicons name="download-outline" size={20} color="#ffffff"/>
                            <Ionicons name="notifications-outline" size={20} color="#ffffff"/>
                        </View>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
                    <View className="flex-row gap-3">
                        <Pressable
                            onPress={() => setActiveSection('series')}
                            className={`rounded-full border px-4 py-2 ${
                                activeSection === 'series'
                                    ? 'border-white/30 bg-white/15'
                                    : 'border-white/10 bg-white/5'
                            }`}>
                            <Text className="font-body text-sm text-white">Séries</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveSection('movies')}
                            className={`rounded-full border px-4 py-2 ${
                                activeSection === 'movies'
                                    ? 'border-white/30 bg-white/15'
                                    : 'border-white/10 bg-white/5'
                            }`}>
                            <Text className="font-body text-sm text-white">Films</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setActiveSection('tv')}
                            className={`rounded-full border px-4 py-2 ${
                                activeSection === 'tv'
                                    ? 'border-white/30 bg-white/15'
                                    : 'border-white/10 bg-white/5'
                            }`}>
                            <Text className="font-body text-sm text-white">TV</Text>
                        </Pressable>
                    </View>
                </ScrollView>

                {hero ? (
                    <FeaturedCard
                        title={hero.title}
                        image={hero.image}
                        badge={hero.badge}
                        playLabel={
                            hero.type === 'movie'
                                ? (() => {
                                    const resume = resumeMovieMap.get(hero.id);
                                    if (!resume) return 'Lecture';
                                    if (resume.completed) return 'Déjà vu';
                                    if (resume.positionSec > 30) return 'Reprendre';
                                    return 'Lecture';
                                })()
                                : hero.type === 'series'
                                    ? (() => {
                                        const resume = resumeItems.find(
                                            (item) => item.type === 'series' && item.seriesId === hero.id
                                        );
                                        if (!resume) return 'Lecture';
                                        if (resume.completed) return 'Déjà vu';
                                        return 'Reprendre';
                                    })()
                                    : 'Lecture'
                        }
                        progress={
                            hero.type === 'movie'
                                ? (() => {
                                    const resume = resumeMovieMap.get(hero.id);
                                    if (!resume || !resume.durationSec) return undefined;
                                    return resume.positionSec / resume.durationSec;
                                })()
                                : hero.type === 'series'
                                    ? (() => {
                                        const resume = resumeItems.find(
                                            (item) => item.type === 'series' && item.seriesId === hero.id
                                        );
                                        if (!resume || !resume.durationSec) return undefined;
                                        return resume.positionSec / resume.durationSec;
                                    })()
                                    : undefined
                        }
                        onPress={
                            hero.type === 'movie'
                                ? () =>
                                    router.push({
                                        pathname: '/movie/[id]' as const,
                                        params: {id: String(hero.id), name: hero.title},
                                    })
                                : hero.type === 'series'
                                    ? () =>
                                        router.push({
                                            pathname: '/series/[id]' as const,
                                            params: {id: String(hero.id), name: hero.title},
                                        })
                                    : undefined
                        }
                        onPlay={
                            hero.type === 'movie'
                                ? () =>
                                    router.push({
                                        pathname: '/player/[id]' as const,
                                        params: {
                                            id: String(hero.id),
                                            name: hero.title,
                                            type: 'vod',
                                            ext: hero.extension ?? 'mp4',
                                        },
                                    })
                                : () => handlePlaySeries(hero.id, hero.title)
                        }
                        isFavorite={favorites.some((fav) => fav.type === hero.type && fav.id === hero.id)}
                        onToggleFavorite={() => toggleFavoriteItem(hero.type, hero.id).then(setFavorites)}
                    />
                ) : null}
            </View>
        );
    }, [activeSection, categories, hero, isRefreshingEpg, tvCategoryId]);

    const renderTvRow = useCallback(
        (item: TvRow) => (
            <Section title={item.title} href={item.href}>
                <FlatList<XtreamStream>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(stream) => String(stream.stream_id)}
                    renderItem={({item: stream}) => (
                        <ChannelCard
                            stream={stream}
                            isFavorite={favorites.some((fav) => fav.type === 'tv' && fav.id === stream.stream_id)}
                            onPress={() =>
                                router.push({
                                    pathname: '/player/[id]' as const,
                                    params: {
                                        id: String(stream.stream_id),
                                        name: stream.name,
                                        icon: stream.stream_icon ?? '',
                                        type: 'tv',
                                    },
                                })
                            }
                            onToggleFavorite={() => handleToggleFavorite(stream.stream_id)}
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
        [favorites, handleToggleFavorite, router]
    );

    const renderMediaRow = useCallback(
        (item: MediaRow) => (
            <Section title={item.title} href={item.href}>
                <FlatList<XtreamVod | XtreamSeries>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(entry) =>
                        'stream_id' in entry ? `vod-${entry.stream_id}` : `series-${entry.series_id}`
                    }
                    renderItem={({item: entry}) => (
                        <MediaCard
                            title={entry.name}
                            image={
                                'stream_id' in entry
                                    ? entry.cover ?? entry.stream_icon
                                    : entry.cover ?? entry.backdrop_path?.[0]
                            }
                            progress={
                                'stream_id' in entry
                                    ? (() => {
                                        const resume = resumeMovieMap.get(entry.stream_id);
                                        if (!resume || !resume.durationSec) return undefined;
                                        return resume.positionSec / resume.durationSec;
                                    })()
                                    : (() => {
                                        const resume = resumeItems.find(
                                            (item) =>
                                                item.type === 'series' &&
                                                item.seriesId === ('series_id' in entry ? entry.series_id : undefined)
                                        );
                                        if (!resume || !resume.durationSec) return undefined;
                                        return resume.positionSec / resume.durationSec;
                                    })()
                            }
                            onPress={
                                'stream_id' in entry
                                    ? () =>
                                        router.push({
                                            pathname: '/movie/[id]' as const,
                                            params: {id: String(entry.stream_id), name: entry.name},
                                        })
                                    : () =>
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
        [resumeMovieMap, router]
    );

    const data: SectionRow[] =
        activeSection === 'tv' ? tvRows : activeSection === 'movies' ? movieRows : seriesRowsData;

    if (loading && !showInitialLoader) {
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
                    onPress={() => router.replace('/(tabs)')}>
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
            {activeSection === 'tv' ? (
                <View className="flex-1">
                    {renderHeader()}
                    <View className="mt-2 px-6">
                        <View className="flex-row items-center justify-between">
                            {renderTvTabs()}
                        </View>
                        <View className="mt-4"/>
                    </View>
                    {tvTab === 'guide' ? (
                        <FlatList
                            className="flex-1"
                            data={tvCategoryStreams}
                            keyExtractor={(item) => String(item.stream_id)}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            key={`tv-guide-${tvCategoryId ?? 'all'}`}
                            viewabilityConfig={guideViewabilityConfig}
                            onViewableItemsChanged={handleGuideViewableItemsChanged}
                            renderItem={({item, index}) => {
                                const logo = safeImageUri(item.stream_icon);
                                if (logo) {
                                    void ensureLogoTone(logo);
                                }
                                const channelId = resolveXmltvChannelId(item);
                                const allListings = tvXmltvListings[channelId] ?? [];
                                const now = new Date();
                                const currentListing =
                                    allListings.find((listing) => {
                                        const start = parseEpgDate(listing, 'start');
                                        const end = parseEpgDate(listing, 'end');
                                        return !!start && !!end && start <= now && end >= now;
                                    }) ?? null;
                                const currentStart = currentListing ? parseEpgDate(currentListing, 'start') : null;
                                const currentEnd = currentListing ? parseEpgDate(currentListing, 'end') : null;
                                const currentProgress =
                                    currentStart && currentEnd
                                        ? Math.min(
                                            1,
                                            Math.max(
                                                0,
                                                (now.getTime() - currentStart.getTime()) /
                                                    (currentEnd.getTime() - currentStart.getTime())
                                            )
                                        )
                                        : null;
                                const visibleListings = tvVisibleEpgByChannel[channelId] ?? [];
                                const isVisible = channelId in tvVisibleEpgByChannel;
                                return (
                                    <View className="w-[33vw] px-2 pb-6 h-full border-r border-white/10" style={{height: '100%'}}>
                                        <View
                                            className="h-11 w-24 items-center justify-center overflow-hidden rounded-lg border border-white/10"
                                            style={{
                                                backgroundColor:
                                                    logo && logoToneByUri[logo]
                                                        ? logoToneByUri[logo]
                                                        : 'rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            {logo ? (
                                                <Image
                                                    source={{uri: logo}}
                                                    className="h-full w-full"
                                                    resizeMode="contain"
                                                />
                                            ) : (
                                                <Text className="font-bodySemi text-[10px] text-white/80" numberOfLines={2}>
                                                    {item.name}
                                                </Text>
                                            )}
                                        </View>
                                        {tvGuideLoading || !isVisible ? (
                                            <Text className="mt-3 font-body text-xs text-white/60">
                                                Chargement...
                                            </Text>
                                        ) : visibleListings.length ? (
                                            <SectionList
                                                className="mt-3 flex-1"
                                                sections={buildEpgSections(visibleListings)}
                                                keyExtractor={(listing, listingIndex) =>
                                                    String(listing.epg_id ?? listingIndex)
                                                }
                                                stickySectionHeadersEnabled
                                                showsVerticalScrollIndicator={false}
                                                contentContainerStyle={{paddingBottom: 200}}
                                                ListHeaderComponent={
                                                    currentListing ? (
                                                        <Pressable
                                                            onPress={() =>
                                                                router.push({
                                                                    pathname: '/player/[id]' as const,
                                                                    params: {
                                                                        id: String(item.stream_id),
                                                                        name: item.name,
                                                                        icon: item.stream_icon ?? '',
                                                                        type: 'tv',
                                                                    },
                                                                })
                                                            }
                                                            className="mb-4 px-2 py-1.5"
                                                        >
                                                            <View className="flex-row items-center gap-2">
                                                                <View className="h-2.5 w-2.5 rounded-full bg-ember"/>
                                                                <Text className="font-bodySemi text-[11px] uppercase text-ember">
                                                                    Live
                                                                </Text>
                                                            </View>
                                                            <Text
                                                                className="mt-1 font-bodySemi text-sm text-white"
                                                                numberOfLines={2}
                                                            >
                                                                {decodeEpgText(currentListing.title) || 'Programme'}
                                                            </Text>
                                                            <Text className="mt-1 font-body text-xs text-white/70">
                                                                {currentStart && currentEnd
                                                                    ? `${formatClock(currentStart)} - ${formatClock(
                                                                          currentEnd
                                                                      )}`
                                                                    : '--:--'}{' '}
                                                                {currentListing.category
                                                                    ? `| ${decodeEpgText(currentListing.category)}`
                                                                    : ''}
                                                            </Text>
                                                            {currentProgress !== null ? (
                                                                <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                                                                    <View
                                                                        className="h-full rounded-full bg-ember"
                                                                        style={{
                                                                            width: `${Math.round(
                                                                                currentProgress * 100
                                                                            )}%`,
                                                                        }}
                                                                    />
                                                                </View>
                                                            ) : null}
                                                        </Pressable>
                                                    ) : null
                                                }
                                                renderSectionHeader={({section}) => (
                                                    <View className="bg-black/80 py-2 w-full">
                                                        <Text className="font-bodySemi text-xs uppercase text-white/60">
                                                            {section.title}
                                                        </Text>
                                                    </View>
                                                )}
                                                renderItem={({item: listing, index: listingIndex}) => {
                                                    const start = parseEpgDate(listing, 'start');
                                                    const end = parseEpgDate(listing, 'end');
                                                    const durationMinutes =
                                                        start && end
                                                            ? Math.max(
                                                                1,
                                                                Math.round(
                                                                    (end.getTime() - start.getTime()) / 60000
                                                                )
                                                            )
                                                            : null;
                                                    return (
                                                        <Pressable
                                                            key={`${listing.epg_id ?? listingIndex}`}
                                                            onPress={() => {
                                                                if (isSameListing(currentListing, listing)) {
                                                                    router.push({
                                                                        pathname: '/player/[id]' as const,
                                                                        params: {
                                                                            id: String(item.stream_id),
                                                                            name: item.name,
                                                                            icon: item.stream_icon ?? '',
                                                                            type: 'tv',
                                                                        },
                                                                    });
                                                                } else {
                                                                    setEpgInfoListing(listing);
                                                                    setEpgInfoStream(item);
                                                                    setShowEpgInfo(true);
                                                                }
                                                            }}
                                                            className="gap-1 border-b border-white/10 pb-3 pt-2"
                                                        >
                                                            <Text className="font-bodySemi text-xs text-white/70">
                                                                {formatClock(start)}
                                                            </Text>
                                                            <Text
                                                                className="font-bodySemi text-sm text-white"
                                                                numberOfLines={2}
                                                            >
                                                                {decodeEpgText(listing.title) || 'Programme'}
                                                            </Text>
                                                            <Text className="font-body text-xs text-white/60">
                                                                {durationMinutes ? `${durationMinutes}mn` : '--'}
                                                                {listing.category
                                                                    ? `, ${decodeEpgText(listing.category)}`
                                                                    : ''}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <Text className="mt-3 font-body text-xs text-white/60">
                                                Aucun programme.
                                            </Text>
                                        )}
                                    </View>
                                );
                            }}
                            ListFooterComponent={<View className="h-10"/>}
                            initialNumToRender={6}
                            maxToRenderPerBatch={6}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    ) : (
                        <FlatList<XtreamStream>
                            className="flex-1"
                            data={tvList}
                            keyExtractor={(item) => String(item.stream_id)}
                            key="tv-now"
                            renderItem={({item, index}) => {
                                const image = safeImageUri(item.stream_icon);
                                if (image) {
                                    void ensureLogoTone(image);
                                }
                                const channelId = resolveXmltvChannelId(item);
                                const listings = tvXmltvListings[channelId] ?? [];
                                const now = new Date();
                                const listing =
                                    listings.find((candidate) => {
                                        const start = parseEpgDate(candidate, 'start');
                                        const end = parseEpgDate(candidate, 'end');
                                        return !!start && !!end && start <= now && end >= now;
                                    }) ?? listings[0] ?? null;
                                const start = listing ? parseEpgDate(listing, 'start') : null;
                                const end = listing ? parseEpgDate(listing, 'end') : null;
                                const progress =
                                    start && end
                                        ? Math.min(
                                            1,
                                            Math.max(0, (Date.now() - start.getTime()) / (end.getTime() - start.getTime()))
                                        )
                                        : null;
                                const subtitle =
                                    start && end
                                        ? `${formatClock(start)} - ${formatClock(end)}`
                                        : tvNowEpgLoading
                                            ? 'Chargement...'
                                            : '';
                                const title = listing?.title
                                    ? decodeEpgText(listing.title)
                                    : item.name;
                                const meta = listing?.category
                                    ? decodeEpgText(listing.category)
                                    : item.stream_type ?? 'Divertissement';
                                const metaLabel =
                                    meta && meta.toLowerCase() === 'live' ? '' : meta;
                                return (
                                    <Pressable
                                        onPress={() =>
                                            router.push({
                                                pathname: '/player/[id]' as const,
                                                params: {
                                                    id: String(item.stream_id),
                                                    name: item.name,
                                                    icon: item.stream_icon ?? '',
                                                    type: 'tv',
                                                },
                                            })
                                        }
                                        className="px-6 py-4"
                                    >
                                        <View className="flex-row items-center gap-3">
                                            <View
                                                className="relative h-16 w-24 items-center justify-center overflow-hidden rounded-lg"
                                                style={{
                                                    backgroundColor:
                                                        image && logoToneByUri[image]
                                                            ? logoToneByUri[image]
                                                            : 'rgba(255,255,255,0.06)',
                                                }}
                                            >
                                                {image ? (
                                                    <Image
                                                        source={{uri: image}}
                                                        className="h-full w-full"
                                                        resizeMode="contain"
                                                    />
                                                ) : (
                                                    <Text className="font-bodySemi text-xs text-white/70">
                                                        TV
                                                    </Text>
                                                )}
                                                {progress !== null ? (
                                                    <View
                                                        className="absolute bottom-1 left-1 right-1 h-1 overflow-hidden rounded-full bg-white/25">
                                                        <View
                                                            className="h-full rounded-full bg-ember"
                                                            style={{width: `${Math.round(progress * 100)}%`}}
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="font-bodySemi text-xs text-white/70" numberOfLines={1}>
                                                    {item.name}
                                                </Text>
                                                <Text className="mt-1 font-bodySemi text-sm text-white"
                                                      numberOfLines={2}>
                                                    {title}
                                                </Text>
                                                <Text className="mt-1 font-body text-xs text-white/60">
                                                    {subtitle ? subtitle : ''}
                                                    {metaLabel ? ` • ${metaLabel}` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                        <View className="mt-3 h-px w-full bg-white/10"/>
                                    </Pressable>
                                );
                            }}
                            ListFooterComponent={<View className="h-10"/>}
                            contentContainerStyle={{paddingBottom: 80}}
                            initialNumToRender={12}
                            maxToRenderPerBatch={12}
                            windowSize={7}
                            removeClippedSubviews
                        />
                    )}
                </View>
            ) : (
                <FlatList<SectionRow>
                    className="flex-1"
                    data={data}
                    keyExtractor={(item) => item.key}
                    renderItem={({item}) => (item.kind === 'tv' ? renderTvRow(item) : renderMediaRow(item))}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={<View className="h-10"/>}
                    ItemSeparatorComponent={() => <View className="h-4"/>}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews
                />
            )}
            {activeSection === 'tv' ? (
                <>
                    <Modal
                        transparent
                        visible={showTvThemes}
                        animationType="fade"
                        onRequestClose={() => setShowTvThemes(false)}
                    >
                        <View className="flex-1 items-center justify-center">
                            <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                            <Pressable
                                onPress={() => setShowTvThemes(false)}
                                className="absolute inset-0"
                            />
                            <View className="flex-1 w-full items-center justify-center">
                                <FlatList
                                    ref={tvThemeListRef}
                                    data={tvThemeOptions}
                                    keyExtractor={(item) => item.id}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{
                                        alignItems: 'center',
                                        paddingTop: 250,
                                        paddingBottom: 250,
                                        flexGrow: 1,
                                        justifyContent: 'center',
                                    }}
                                    ItemSeparatorComponent={() => <View style={{height: tvThemeItemGap}}/>}
                                    getItemLayout={(_, index) => ({
                                        length: tvThemeItemHeight + tvThemeItemGap,
                                        offset: (tvThemeItemHeight + tvThemeItemGap) * index,
                                        index,
                                    })}
                                    onScrollToIndexFailed={() => {
                                        tvThemeListRef.current?.scrollToOffset({offset: 0, animated: false});
                                    }}
                                    renderItem={({item}) => {
                                        const isAll = item.id === 'all';
                                        const selected =
                                            (tvCategoryId === null && isAll) || item.id === tvCategoryId;
                                        return (
                                            <Pressable
                                                onPress={() => {
                                                    setTvCategoryId(isAll ? null : item.id);
                                                    setShowTvThemes(false);
                                                }}
                                                style={{height: tvThemeItemHeight, justifyContent: 'center'}}
                                                className="rounded-full px-6"
                                            >
                                                <Text
                                                    className={`font-bodySemi text-xl ${
                                                        selected ? 'text-white' : 'text-white/60'
                                                    }`}
                                                >
                                                    {item.name}
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
                    <Modal
                        transparent
                        visible={showEpgRefreshConfirm}
                        animationType="fade"
                        onRequestClose={() => setShowEpgRefreshConfirm(false)}
                    >
                        <View className="flex-1 items-center justify-center px-6">
                            <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                            <View className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-ash/90 px-6 py-5">
                                <Text className="font-bodySemi text-lg text-white">
                                    Rafraîchir l’EPG ?
                                </Text>
                                <Text className="mt-2 font-body text-sm text-white/70">
                                    Cela mettra à jour les programmes en cours.
                                </Text>
                                <View className="mt-5 flex-row items-center justify-end gap-3">
                                    <Pressable
                                        onPress={() => setShowEpgRefreshConfirm(false)}
                                        className="rounded-full border border-white/10 px-4 py-2"
                                    >
                                        <Text className="font-body text-sm text-white/80">Annuler</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={handleRefreshEpg}
                                        disabled={isRefreshingEpg}
                                        className="rounded-full bg-white/15 px-4 py-2"
                                    >
                                        <Text className="font-bodySemi text-sm text-white">
                                            {isRefreshingEpg ? 'Chargement...' : 'Rafraîchir'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </Modal>
                    <Modal
                        transparent
                        visible={showEpgRefreshDone}
                        animationType="fade"
                        onRequestClose={() => setShowEpgRefreshDone(false)}
                    >
                        <View className="flex-1 items-center justify-center">
                            <View className="rounded-full border border-white/10 bg-black/80 px-4 py-2">
                                <Text className="font-body text-sm text-white">
                                    EPG mis à jour
                                </Text>
                            </View>
                        </View>
                    </Modal>
                    <Modal
                        transparent
                        visible={showEpgInfo}
                        animationType="fade"
                        onRequestClose={() => setShowEpgInfo(false)}
                    >
                        <View className="flex-1">
                            <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                            <View className="flex-1 px-6 pt-12">
                                {epgInfoStream?.stream_icon && logoToneByUri[epgInfoStream.stream_icon] ? (
                                    <LinearGradient
                                        colors={[
                                            `${logoToneByUri[epgInfoStream.stream_icon]}80`,
                                            'rgba(0,0,0,0.6)',
                                        ]}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                        }}
                                    />
                                ) : null}
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-2">
                                        <Text className="font-bodySemi text-base text-white">
                                            {epgInfoStream?.name ?? 'Chaîne'}
                                        </Text>
                                    </View>
                                    <Pressable
                                        onPress={() => setShowEpgInfo(false)}
                                        className="h-10 w-10 items-center justify-center"
                                    >
                                        <Ionicons name="close" size={24} color="#ffffff"/>
                                    </Pressable>
                                </View>
                                {epgInfoStream?.stream_icon ? (
                                    <View className="mt-6 h-16 w-32 overflow-hidden rounded-xl border border-white/10">
                                        <Image
                                            source={{uri: epgInfoStream.stream_icon}}
                                            className="h-full w-full"
                                            resizeMode="contain"
                                        />
                                    </View>
                                ) : null}
                                <ScrollView className="mt-8 flex-1" showsVerticalScrollIndicator={false}>
                                    <Text className="font-bodySemi text-2xl text-white">
                                        {decodeEpgText(epgInfoListing?.title) || 'Programme'}
                                    </Text>
                                    <Text className="mt-3 font-body text-sm text-white/70">
                                        {(() => {
                                            const start = epgInfoListing
                                                ? parseEpgDate(epgInfoListing, 'start')
                                                : null;
                                            const end = epgInfoListing
                                                ? parseEpgDate(epgInfoListing, 'end')
                                                : null;
                                            const dayLabel =
                                                start && epgInfoListing
                                                    ? formatDayLabel(start, new Date())
                                                    : '';
                                            return `${dayLabel} ${
                                                start && end
                                                    ? `• ${formatClock(start)} - ${formatClock(end)}`
                                                    : ''
                                            }`;
                                        })()}
                                    </Text>
                                    {epgInfoListing?.category ? (
                                        <Text className="mt-2 font-body text-sm text-white/60">
                                            {decodeEpgText(epgInfoListing.category)}
                                        </Text>
                                    ) : null}
                                    {epgInfoListing?.description ? (
                                        <Text className="mt-4 font-body text-base text-white/80">
                                            {decodeEpgText(epgInfoListing.description)}
                                        </Text>
                                    ) : null}
                                </ScrollView>
                                <Pressable
                                    onPress={() => {
                                        if (!epgInfoStream) return;
                                        setShowEpgInfo(false);
                                        router.push({
                                            pathname: '/player/[id]' as const,
                                            params: {
                                                id: String(epgInfoStream.stream_id),
                                                name: epgInfoStream.name,
                                                icon: epgInfoStream.stream_icon ?? '',
                                                type: 'tv',
                                            },
                                        });
                                    }}
                                    className="mb-10 items-center justify-center rounded-full bg-white/15 py-4"
                                >
                                    <View className="flex-row items-center gap-2">
                                        <Ionicons name="play" size={16} color="#ffffff"/>
                                        <Text className="font-bodySemi text-base text-white">
                                            Regarder la chaîne
                                        </Text>
                                    </View>
                                </Pressable>
                            </View>
                        </View>
                    </Modal>
                </>
            ) : null}
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
