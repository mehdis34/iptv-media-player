import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {StatusBar} from 'expo-status-bar';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BlurView} from 'expo-blur';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    SectionList,
    StyleSheet,
    Text,
    useWindowDimensions,
    View
} from 'react-native';
import Slider from '@react-native-community/slider';

import {
    getCatalogCache,
    getCredentials,
    getFavoriteItems,
    getResumeItem,
    toggleFavoriteItem,
    upsertResumeItem
} from '@/lib/storage';
import {
    buildSeriesEpisodeUrl,
    buildStreamUrl,
    buildVodUrl,
    fetchLiveCategories,
    fetchLiveStreams,
    fetchSeriesInfo,
    fetchXmltvEpg
} from '@/lib/xtream';
import {VLCPlayer} from 'react-native-vlc-media-player';
import type {
    FavoriteItem,
    ResumeItem,
    XtreamCategory,
    XtreamEpgListing,
    XtreamEpisode,
    XtreamSeriesInfo,
    XtreamStream
} from '@/lib/types';
import {safeImageUri} from '@/lib/media';
import {
    decodeEpgText,
    normalizeXmltvName,
    parseXmltvDate,
    resolveXmltvChannelId as resolveXmltvChannelIdFromStream
} from '@/lib/epg.utils';
import {formatDayLabel} from '@/lib/date.utils';
import TvRowContent from '@/components/TvRowContent';

export default function PlayerScreen() {
    const router = useRouter();
    const {width} = useWindowDimensions();
    const params = useLocalSearchParams<{
        id?: string;
        name?: string;
        type?: string;
        ext?: string;
        seriesId?: string;
        season?: string;
        start?: string;
        categoryId?: string;
        icon?: string;
    }>();

    const playerRef = useRef<VLCPlayer>(null);
    const [streamUrl, setStreamUrl] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [paused, setPaused] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [showTracks, setShowTracks] = useState(false);
    const [audioTracks, setAudioTracks] = useState<Array<{ id: number; name: string }>>([]);
    const [textTracks, setTextTracks] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedAudio, setSelectedAudio] = useState<number | null>(null);
    const [selectedText, setSelectedText] = useState<number | null>(null);
    const [userSelectedAudio, setUserSelectedAudio] = useState(false);
    const [userSelectedText, setUserSelectedText] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSeekingRef = useRef(false);
    const hasEndedRef = useRef(false);
    const suppressCountdownRef = useRef(true);
    const [isReady, setIsReady] = useState(false);
    const [seriesInfo, setSeriesInfo] = useState<XtreamSeriesInfo | null>(null);
    const [seasonOptions, setSeasonOptions] = useState<number[]>([]);
    const [season, setSeason] = useState<number | null>(null);
    const [showEpisodes, setShowEpisodes] = useState(false);
    const [showSeasonPicker, setShowSeasonPicker] = useState(false);
    const [activeSidePanel, setActiveSidePanel] = useState<'epg' | 'zap' | null>(null);
    const [tvEpgLoading, setTvEpgLoading] = useState(false);
    const [tvEpgListings, setTvEpgListings] = useState<XtreamEpgListing[]>([]);
    const [tvXmltvListingsByChannel, setTvXmltvListingsByChannel] = useState<
        Record<string, XtreamEpgListing[]>
    >({});
    const [tvXmltvChannelIdByName, setTvXmltvChannelIdByName] = useState<Record<string, string>>({});
    const [zapCategories, setZapCategories] = useState<XtreamCategory[]>([]);
    const [zapCategoriesLoading, setZapCategoriesLoading] = useState(false);
    const [zapCategoryId, setZapCategoryId] = useState<string | null>(null);
    const [zapStreamsByCategory, setZapStreamsByCategory] = useState<
        Record<string, XtreamStream[]>
    >({});
    const [zapLoadingCategory, setZapLoadingCategory] = useState<string | null>(null);
    const [zapError, setZapError] = useState('');
    const [zapTabLayouts, setZapTabLayouts] = useState<
        Record<string, { x: number; width: number; pad: number }>
    >({});
    const [returnToEpisodes, setReturnToEpisodes] = useState(false);
    const [resumeEntry, setResumeEntry] = useState<ResumeItem | null>(null);
    const episodesListRef = useRef<FlatList<XtreamEpisode>>(null);
    const seasonScrollRef = useRef<ScrollView>(null);
    const episodeItemSize = 288 + 16;
    const seasonItemHeight = 56;
    const lastSavedRef = useRef(0);
    const hasSeekedRef = useRef(false);
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const zapAnim = useRef(new Animated.Value(0)).current;
    const zapUnderlineX = useRef(new Animated.Value(0)).current;
    const zapUnderlineWidth = useRef(new Animated.Value(0)).current;
    const zapTabsScrollRef = useRef<ScrollView>(null);
    const zapListRef = useRef<FlatList<XtreamStream>>(null);
    const pendingZapScrollId = useRef<number | null>(null);
    const zapScrollRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const zapClearPendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const zapItemHeight = 72;
    const lastZapScrollId = useRef<string | null>(null);
    const hasLoadedZapCategories = useRef(false);
    const isLive = params.type === 'tv';
    const isSidePanelOpen = isLive && activeSidePanel !== null;
    const zapWidth = Math.round(width * 0.4);
    const playerWidthValue = Math.max(0, width - zapWidth);
    const playerWidth = zapAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [width, playerWidthValue],
    });
    const zapPanelWidth = zapAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, zapWidth],
    });

    useEffect(() => {
        Animated.timing(zapAnim, {
            toValue: isSidePanelOpen ? 1 : 0,
            duration: 220,
            useNativeDriver: false,
        }).start();
    }, [isSidePanelOpen, zapAnim]);

    useEffect(() => {
        if (!zapCategoryId) {
            Animated.timing(zapUnderlineWidth, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
            }).start();
            return;
        }
        const target = zapTabLayouts[zapCategoryId];
        if (!target) return;
        Animated.parallel([
            Animated.timing(zapUnderlineX, {
                toValue: target.x,
                duration: 220,
                useNativeDriver: false,
            }),
            Animated.timing(zapUnderlineWidth, {
                toValue: target.width - target.pad * 2,
                duration: 220,
                useNativeDriver: false,
            }),
        ]).start();
    }, [zapCategoryId, zapTabLayouts, zapUnderlineWidth, zapUnderlineX]);

    useEffect(() => {
        if (activeSidePanel !== 'zap') {
            lastZapScrollId.current = null;
            if (zapScrollRetryRef.current) {
                clearTimeout(zapScrollRetryRef.current);
                zapScrollRetryRef.current = null;
            }
            if (zapClearPendingRef.current) {
                clearTimeout(zapClearPendingRef.current);
                zapClearPendingRef.current = null;
            }
            return;
        }
        if (!zapCategoryId) return;
        const target = zapTabLayouts[zapCategoryId];
        if (!target) return;
        if (lastZapScrollId.current === zapCategoryId) return;
        lastZapScrollId.current = zapCategoryId;
        const timer = setTimeout(() => {
            zapTabsScrollRef.current?.scrollTo({x: target.x, animated: true});
        }, 0);
        return () => clearTimeout(timer);
    }, [activeSidePanel, zapCategoryId, zapTabLayouts]);

    useEffect(() => {
        if (!isLive || activeSidePanel !== 'zap' || !zapCategoryId) return;
        const streamId = Number(params.id);
        if (!Number.isFinite(streamId)) return;
        pendingZapScrollId.current = streamId;
    }, [activeSidePanel, isLive, params.id, zapCategoryId]);

    const scrollZapToActive = useCallback(() => {
        if (!zapCategoryId) return;
        const list = zapStreamsByCategory[zapCategoryId];
        if (!list?.length) return;
        const targetId = pendingZapScrollId.current;
        if (!targetId) return;
        if (!zapListRef.current) {
            if (zapScrollRetryRef.current) clearTimeout(zapScrollRetryRef.current);
            zapScrollRetryRef.current = setTimeout(() => {
                scrollZapToActive();
            }, 120);
            return;
        }
        const index = list.findIndex((stream) => stream.stream_id === targetId);
        if (index < 0) return;
        requestAnimationFrame(() => {
            zapListRef.current?.scrollToOffset({
                offset: Math.max(0, index * zapItemHeight),
                animated: false,
            });
            if (zapClearPendingRef.current) clearTimeout(zapClearPendingRef.current);
            zapClearPendingRef.current = setTimeout(() => {
                pendingZapScrollId.current = null;
            }, 300);
        });
    }, [zapCategoryId, zapStreamsByCategory]);

    useEffect(() => {
        if (activeSidePanel !== 'zap') return;
        scrollZapToActive();
    }, [activeSidePanel, scrollZapToActive]);

    useEffect(() => {
        if (activeSidePanel !== 'zap') return;
        if (!zapStreams.length) return;
        scrollZapToActive();
    }, [activeSidePanel, scrollZapToActive, zapCategoryId]);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const creds = await getCredentials();
                if (!creds || !params.id) {
                    router.replace('/login');
                    return;
                }

                const isVod = params.type === 'vod';
                const isSeries = params.type === 'series';

                const url = isVod
                    ? buildVodUrl(creds, Number(params.id), params.ext ?? 'mp4')
                    : isSeries
                        ? buildSeriesEpisodeUrl(creds, Number(params.id), params.ext ?? 'mp4')
                        : buildStreamUrl(creds, Number(params.id));

                if (mounted) {
                    setStreamUrl(url);
                }
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : 'Lecture impossible.');
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [params.id, params.type, params.ext, router]);

    useEffect(() => {
        setSelectedAudio(null);
        setSelectedText(null);
        setUserSelectedAudio(false);
        setUserSelectedText(false);
        setPaused(false);
        setCurrentTime(0);
        setDuration(0);
        hasEndedRef.current = false;
        suppressCountdownRef.current = true;
        hasSeekedRef.current = false;
        lastSavedRef.current = 0;
        setIsReady(false);
        setControlsVisible(true);
        scheduleHide(true);
        setActiveSidePanel(null);
        setZapCategoryId(null);
    }, [params.id, params.type]);

    useEffect(() => {
        let active = true;
        async function loadLiveEpg() {
            if (!isLive || !params.name) {
                setTvEpgListings([]);
                setTvXmltvListingsByChannel({});
                setTvXmltvChannelIdByName({});
                return;
            }
            setTvEpgLoading(true);
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const xmltv = await fetchXmltvEpg(creds);
                const channelIdByName = xmltv.channelIdByName ?? {};
                setTvXmltvListingsByChannel(xmltv.listingsByChannel ?? {});
                setTvXmltvChannelIdByName(channelIdByName);
                const normalized = normalizeXmltvName(params.name);
                const channelId =
                    channelIdByName[normalized] ?? (params.id ? String(params.id) : '');
                const listings = channelId ? xmltv.listingsByChannel?.[channelId] ?? [] : [];
                if (!active) return;
                setTvEpgListings(listings);
            } catch {
                if (!active) return;
                setTvEpgListings([]);
                setTvXmltvListingsByChannel({});
                setTvXmltvChannelIdByName({});
            } finally {
                if (active) setTvEpgLoading(false);
            }
        }
        loadLiveEpg();
        return () => {
            active = false;
        };
    }, [isLive, params.name]);

    useEffect(() => {
        if (!isLive || activeSidePanel !== 'zap' || hasLoadedZapCategories.current) {
            return;
        }
        let active = true;
        setZapCategoriesLoading(true);
        setZapError('');
        async function loadZapCategories() {
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const categories = await fetchLiveCategories(creds);
                if (!active) return;
                setZapCategories(categories);
                hasLoadedZapCategories.current = true;
            } catch (err) {
                if (!active) return;
                setZapError(
                    err instanceof Error
                        ? err.message
                        : 'Chargement des catégories impossible.'
                );
            } finally {
                if (active) setZapCategoriesLoading(false);
            }
        }
        loadZapCategories();
        return () => {
            active = false;
        };
    }, [activeSidePanel, isLive]);

    useEffect(() => {
        if (!params.id) {
            setResumeEntry(null);
            return;
        }
        const resumeType: ResumeItem['type'] =
            params.type === 'vod' ? 'movie' : params.type === 'series' ? 'series' : 'tv';
        if (resumeType === 'tv') {
            setResumeEntry(null);
            return;
        }
        getResumeItem(resumeType, Number(params.id)).then(setResumeEntry);
    }, [params.id, params.type]);

    useEffect(() => {
        if (params.type !== 'series' || !params.seriesId) {
            setSeriesInfo(null);
            setSeasonOptions([]);
            setSeason(null);
            return;
        }
        let mounted = true;

        async function loadSeriesInfo() {
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const info = await fetchSeriesInfo(creds, Number(params.seriesId));
                if (!mounted) return;
                setSeriesInfo(info);
            } catch (_err) {
                if (mounted) setSeriesInfo(null);
            }
        }

        loadSeriesInfo();
        return () => {
            mounted = false;
        };
    }, [params.seriesId, params.type]);

    const episodesBySeason = useMemo(() => seriesInfo?.episodes ?? {}, [seriesInfo]);

    useEffect(() => {
        const seasons = Object.keys(episodesBySeason)
            .map((key) => Number(key))
            .filter((value) => !Number.isNaN(value))
            .sort((a, b) => a - b);
        setSeasonOptions(seasons);
        const paramSeason = params.season ? Number(params.season) : null;
        if (paramSeason && seasons.includes(paramSeason)) {
            setSeason(paramSeason);
            return;
        }
        if (!seasons.length) {
            setSeason(null);
            return;
        }
        if (params.id) {
            const episodeId = String(params.id);
            const found = seasons.find((value) =>
                (episodesBySeason[String(value)] ?? []).some(
                    (episode) => String(episode.id) === episodeId
                )
            );
            if (found) {
                setSeason(found);
                return;
            }
        }
        setSeason(seasons[0]);
    }, [episodesBySeason, params.id, params.season]);

    const episodes = useMemo<XtreamEpisode[]>(() => {
        if (season === null) return [];
        return episodesBySeason[String(season)] ?? [];
    }, [episodesBySeason, season]);

    const currentEpisodeIndex = useMemo(() => {
        if (!params.id) return -1;
        const episodeId = String(params.id);
        return episodes.findIndex((episode) => String(episode.id) === episodeId);
    }, [episodes, params.id]);

    const nextEpisode = useMemo(() => {
        if (currentEpisodeIndex < 0) return null;
        return episodes[currentEpisodeIndex + 1] ?? null;
    }, [episodes, currentEpisodeIndex]);

    const nextSeason = useMemo(() => {
        if (!season || !seasonOptions.length) return null;
        const index = seasonOptions.indexOf(season);
        if (index < 0) return null;
        return seasonOptions[index + 1] ?? null;
    }, [season, seasonOptions]);

    const remainingSeconds = useMemo(() => {
        if (!duration) return null;
        const remaining = Math.ceil(duration - currentTime);
        return remaining < 0 ? 0 : remaining;
    }, [duration, currentTime]);
    const showCountdown = remainingSeconds !== null && remainingSeconds <= 9;

    useEffect(() => {
        if (params.type === 'series' && currentEpisodeIndex >= 0) {
        }
    }, [currentEpisodeIndex, params.type]);

    useEffect(() => {
        if (!showEpisodes) return;
        if (currentEpisodeIndex < 0) return;
        const timer = setTimeout(() => {
            episodesListRef.current?.scrollToIndex({
                index: currentEpisodeIndex,
                animated: true,
                viewPosition: 0.5,
            });
        }, 200);
        return () => clearTimeout(timer);
    }, [showEpisodes, currentEpisodeIndex]);

    useEffect(() => {
        if (!duration || hasSeekedRef.current) return;
        const startParam = params.start ? Number(params.start) : null;
        const resumeStart =
            resumeEntry && !resumeEntry.completed && resumeEntry.positionSec > 30
                ? resumeEntry.positionSec
                : null;
        const startPosition = startParam !== null && Number.isFinite(startParam)
            ? startParam
            : resumeStart;
        if (startPosition === null) return;
        const ratio = Math.min(0.99, Math.max(0, startPosition / duration));
        if (!Number.isFinite(ratio)) return;
        playerRef.current?.seek(ratio);
        setCurrentTime(startPosition);
        hasSeekedRef.current = true;
    }, [duration, params.start, resumeEntry]);

    useEffect(() => {
        if (!showSeasonPicker || !season || !seasonOptions.length) return;
        const index = seasonOptions.indexOf(season);
        if (index < 0) return;
        const targetY = Math.max(0, index * seasonItemHeight - seasonItemHeight);
        requestAnimationFrame(() => {
            seasonScrollRef.current?.scrollTo({y: targetY, animated: false});
        });
    }, [showSeasonPicker, season, seasonOptions]);

    useEffect(() => {
        let mounted = true;

        async function loadFavorites() {
            const items = await getFavoriteItems();
            if (mounted) setFavorites(items);
        }

        loadFavorites();
        return () => {
            mounted = false;
        };
    }, [params.id, params.type]);

    useEffect(() => {
        return () => {
            if (hideTimer.current) {
                clearTimeout(hideTimer.current);
            }
        };
    }, []);

    const scheduleHide = (force = false) => {
        if (isSeekingRef.current) return;
        if (!force && remainingSeconds !== null && remainingSeconds <= 10) {
            return;
        }
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
        }
        hideTimer.current = setTimeout(() => {
            setControlsVisible(false);
        }, 5000);
    };

    useEffect(() => {
        if (remainingSeconds === null) return;
        if (suppressCountdownRef.current) return;
        if (remainingSeconds <= 10) {
            if (hideTimer.current) {
                clearTimeout(hideTimer.current);
            }
            setControlsVisible(true);
        }
    }, [remainingSeconds]);

    useEffect(() => {
        if (currentTime > 1) {
            suppressCountdownRef.current = false;
        }
    }, [currentTime]);

    useEffect(() => {
        Animated.timing(controlsOpacity, {
            toValue: controlsVisible ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
        }).start();
    }, [controlsOpacity, controlsVisible]);

    const toggleControls = () => {
        setControlsVisible((prev) => {
            const next = !prev;
            if (next && !paused) {
                scheduleHide();
            }
            return next;
        });
    };

    const handleTogglePlay = () => {
        setPaused((prev) => {
            const next = !prev;
            if (!next) {
                scheduleHide();
            } else if (hideTimer.current) {
                clearTimeout(hideTimer.current);
            }
            return next;
        });
        setControlsVisible(true);
    };

    const toSeconds = (value: number) => {
        if (!Number.isFinite(value)) return 0;
        return value > 10000 ? value / 1000 : value;
    };

    const formatTime = (value: number) => {
        const total = Math.max(0, Math.floor(value));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const seconds = total % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
                2,
                '0'
            )}`;
        }
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    };

    function formatClock(date: Date | null) {
        if (!date) return '--:--';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}h${minutes}`;
    }

    const resolveXmltvChannelId = useCallback(
        (stream: XtreamStream) => {
            return resolveXmltvChannelIdFromStream(stream, tvXmltvChannelIdByName);
        },
        [tvXmltvChannelIdByName]
    );

    const buildEpgSections = (listings: XtreamEpgListing[]) => {
        const today = new Date();
        const now = new Date();
        const sorted = [...listings].sort((a, b) => {
            const aTime = parseXmltvDate(a.start)?.getTime() ?? 0;
            const bTime = parseXmltvDate(b.start)?.getTime() ?? 0;
            return aTime - bTime;
        });
        const sections: Array<{title: string; data: XtreamEpgListing[]}> = [];
        const sectionMap = new Map<string, XtreamEpgListing[]>();
        sorted.forEach((listing) => {
            const start = parseXmltvDate(listing.start);
            const end = parseXmltvDate(listing.end);
            if (!start) return;
            const isCurrent = !!end && start <= now && end >= now;
            if (start < now && !isCurrent) return;
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

    const liveNow = useMemo(() => {
        if (!isLive || !tvEpgListings.length) return null;
        const now = new Date();
        return (
            tvEpgListings.find((listing) => {
                const start = parseXmltvDate(listing.start);
                const end = parseXmltvDate(listing.end);
                return !!start && !!end && start <= now && end >= now;
            }) ?? null
        );
    }, [isLive, tvEpgListings]);
    const liveProgress = useMemo(() => {
        if (!liveNow) return null;
        const start = parseXmltvDate(liveNow.start);
        const end = parseXmltvDate(liveNow.end);
        if (!start || !end) return null;
        const total = end.getTime() - start.getTime();
        if (total <= 0) return null;
        const elapsed = Date.now() - start.getTime();
        return Math.min(1, Math.max(0, elapsed / total));
    }, [liveNow]);

    const zapCategoryOptions = useMemo(() => {
        if (!isLive) return [];
        return [
            {category_id: 'all', category_name: 'Toutes les chaînes'},
            ...zapCategories,
        ];
    }, [isLive, zapCategories]);

    const zapStreams = useMemo(() => {
        if (!zapCategoryId) return [];
        return zapStreamsByCategory[zapCategoryId] ?? [];
    }, [zapCategoryId, zapStreamsByCategory]);

    const handleSelectZapCategory = useCallback(
        async (categoryId: string) => {
            setZapCategoryId(categoryId);
            setZapError('');
            if (zapStreamsByCategory[categoryId]) return;
            setZapLoadingCategory(categoryId);
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const streams = await fetchLiveStreams(
                    creds,
                    categoryId === 'all' ? undefined : categoryId
                );
                setZapStreamsByCategory((prev) => ({
                    ...prev,
                    [categoryId]: streams,
                }));
            } catch (err) {
                setZapError(
                    err instanceof Error ? err.message : 'Chargement des chaînes impossible.'
                );
            } finally {
                setZapLoadingCategory((prev) => (prev === categoryId ? null : prev));
            }
        },
        [zapStreamsByCategory]
    );

    useEffect(() => {
        if (!isLive || activeSidePanel !== 'zap' || zapCategoryId) {
            return;
        }
        let active = true;
        async function selectDefaultCategory() {
            let categoryId =
                typeof params.categoryId === 'string' && params.categoryId.trim()
                    ? params.categoryId
                    : null;
            if (!categoryId && params.id) {
                const cache = await getCatalogCache(['liveStreams']);
                const streamId = Number(params.id);
                const stream = cache.data.liveStreams?.find(
                    (item) => item.stream_id === streamId
                );
                categoryId = stream?.category_id ?? null;
            }
            if (!active || !categoryId) return;
            await handleSelectZapCategory(categoryId);
        }
        selectDefaultCategory();
        return () => {
            active = false;
        };
    }, [activeSidePanel, handleSelectZapCategory, isLive, params.categoryId, params.id, zapCategoryId]);

    const handleZapStreamPress = useCallback(
        (stream: XtreamStream) => {
            setActiveSidePanel(null);
            router.replace({
                pathname: '/player/[id]' as const,
                params: {
                    id: String(stream.stream_id),
                    name: stream.name,
                    icon: stream.stream_icon ?? undefined,
                    categoryId: stream.category_id ?? undefined,
                    type: 'tv',
                },
            });
        },
        [router]
    );

    const handleJump = (seconds: number) => {
        if (!duration || !playerRef.current) return;
        const current = Math.floor(currentTime);
        const total = Math.floor(duration);
        if (!total) return;
        const nextSeconds = Math.max(0, Math.min(total, current + seconds));
        playerRef.current.seek(nextSeconds / total);
        setCurrentTime(nextSeconds);
        scheduleHide();
    };

    const favoriteType: FavoriteItem['type'] =
        params.type === 'series' ? 'series' : params.type === 'vod' ? 'movie' : 'tv';
    const favoriteId = params.id ? Number(params.id) : null;
    const isFavorite =
        favoriteId !== null &&
        favorites.some((item) => item.type === favoriteType && item.id === favoriteId);
    const handleToggleFavorite = async () => {
        if (favoriteId === null) return;
        const next = await toggleFavoriteItem(favoriteType, favoriteId);
        setFavorites(next);
    };

    const resumeType: ResumeItem['type'] | null =
        params.type === 'vod' ? 'movie' : params.type === 'series' ? 'series' : null;
    const resumeId = params.id ? Number(params.id) : null;
    const currentEpisode = currentEpisodeIndex >= 0 ? episodes[currentEpisodeIndex] : null;
    const liveLogo = isLive ? safeImageUri(params.icon) : undefined;
    const resumeImage =
        params.type === 'series'
            ? currentEpisode?.info?.movie_image ??
              currentEpisode?.info?.cover_big ??
              currentEpisode?.info?.backdrop_path?.[0]
            : undefined;
    const resumeTitle = params.name ?? '';
    const resumeEpisodeTitle =
        params.type === 'series'
            ? currentEpisode?.title ?? currentEpisode?.name ?? undefined
            : undefined;

    const persistResume = (positionSec: number, durationSec: number, completed: boolean) => {
        if (!resumeType || resumeId === null || !durationSec) return;
        const payload: ResumeItem = {
            id: resumeId,
            type: resumeType,
            positionSec,
            durationSec,
            updatedAt: Date.now(),
            completed,
            title: resumeTitle,
            image: resumeImage,
            seriesId: params.seriesId ? Number(params.seriesId) : undefined,
            season: season ?? undefined,
            episodeTitle: resumeEpisodeTitle,
        };
        upsertResumeItem(payload);
        setResumeEntry(payload);
    };

    const applyTextTrack = (trackId: number) => {
        setSelectedText(trackId);
        setUserSelectedText(true);
        (playerRef.current as any)?.setNativeProps?.({textTrack: trackId});
    };

    const applyAudioTrack = (trackId: number) => {
        setSelectedAudio(trackId);
        setUserSelectedAudio(true);
        (playerRef.current as any)?.setNativeProps?.({audioTrack: trackId});
    };

    const closeSeasonPicker = () => {
        setShowSeasonPicker(false);
        if (returnToEpisodes) {
            setReturnToEpisodes(false);
            setShowEpisodes(true);
        }
    };

    const handlePlayEpisode = (episode: XtreamEpisode) => {
        if (!episode.id) return;
        router.setParams({
            id: String(episode.id),
            name: params.name ?? '',
            type: 'series',
            ext: episode.container_extension ?? 'mp4',
            seriesId: params.seriesId ?? '',
            season: season ? String(season) : undefined,
            start: undefined,
        });
        setShowEpisodes(false);
    };

    const handlePlayEpisodeWithSeason = (episode: XtreamEpisode, seasonValue: number | null) => {
        if (!episode.id) return;
        router.setParams({
            id: String(episode.id),
            name: params.name ?? '',
            type: 'series',
            ext: episode.container_extension ?? 'mp4',
            seriesId: params.seriesId ?? '',
            season: seasonValue ? String(seasonValue) : undefined,
            start: undefined,
        });
        setShowEpisodes(false);
    };

    const handleAutoAdvance = () => {
        if (hasEndedRef.current) return;
        hasEndedRef.current = true;
        if (resumeType && resumeId !== null && duration > 0) {
            persistResume(duration, duration, true);
            lastSavedRef.current = Date.now();
        }
        if (params.type === 'series') {
            if (nextEpisode) {
                handlePlayEpisodeWithSeason(nextEpisode, season);
                return;
            }
            if (nextSeason) {
                const firstEpisode = episodesBySeason[String(nextSeason)]?.[0] ?? null;
                if (firstEpisode) {
                    handlePlayEpisodeWithSeason(firstEpisode, nextSeason);
                    return;
                }
            }
        }
        router.back();
    };

    return (
        <View className="flex-1 bg-black">
            <StatusBar hidden/>

            {error ? (
                <View className="flex-1 items-center justify-center gap-4 px-6">
                    <Text className="font-body text-white">{error}</Text>
                    <Pressable
                        onPress={() => router.back()}
                        className="flex-row items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2"
                    >
                        <Ionicons name="close" size={16} color="#ffffff"/>
                        <Text className="font-bodySemi text-sm text-white">Fermer</Text>
                    </Pressable>
                </View>
            ) : streamUrl ? (
                <View className="flex-1 flex-row">
                    <Animated.View
                        className="h-full"
                        style={isLive ? {width: playerWidth} : {flex: 1}}
                    >
                    <VLCPlayer
                        ref={playerRef}
                        key={streamUrl ?? 'player'}
                        autoplay
                        paused={paused}
                        source={{
                            uri: streamUrl
                        }}
                        onProgress={(event: {
                            duration?: number;
                            currentTime?: number;
                            position?: number;
                        }) => {
                            if (isSeekingRef.current) return;
                            const nextDuration = toSeconds(event.duration ?? duration);
                            let nextCurrent = toSeconds(event.currentTime ?? currentTime);
                            if (
                                Number.isFinite(event.position) &&
                                nextDuration > 0 &&
                                typeof event.position === 'number'
                            ) {
                                nextCurrent = event.position * nextDuration;
                            }
                            if (nextDuration > 0 && nextCurrent > nextDuration) {
                                nextCurrent = nextDuration;
                            }
                            setDuration(nextDuration);
                            setCurrentTime(nextCurrent);
                            if (resumeType && resumeId !== null && nextDuration > 0 && nextCurrent > 0) {
                                const now = Date.now();
                                if (now - lastSavedRef.current >= 5000) {
                                    const completed = nextCurrent / nextDuration >= 0.95;
                                    persistResume(nextCurrent, nextDuration, completed);
                                    lastSavedRef.current = now;
                                }
                            }
                        }}
                        onLoad={(event: {
                            audioTracks?: Array<{ id?: number; name?: string }>;
                            textTracks?: Array<{ id?: number; name?: string }>;
                        }) => {
                            setIsReady(true);
                            setAudioTracks(event.audioTracks
                                ?.filter((track) => typeof track.id === 'number')
                                .map((track) => ({
                                    id: track.id as number,
                                    name: track.name ?? `Piste ${track.id}`,
                                })) ?? []);
                            setTextTracks(event.textTracks
                                ?.filter((track) => typeof track.id === 'number')
                                .map((track) => ({
                                    id: track.id as number,
                                    name: track.name ?? `Sous-titre ${track.id}`,
                                })) ?? []);
                        }}
                        onPlaying={() => {
                            setPaused(false);
                            setIsReady(true);
                        }}
                        onPaused={() => {
                            setPaused(true);
                            if (resumeType && resumeId !== null && duration > 0 && currentTime > 0) {
                                const completed = currentTime / duration >= 0.95;
                                persistResume(currentTime, duration, completed);
                                lastSavedRef.current = Date.now();
                            }
                        }}
                        onEnd={handleAutoAdvance}
                        {...(userSelectedAudio && selectedAudio !== null
                            ? {audioTrack: selectedAudio}
                            : {})}
                        {...(userSelectedText && selectedText !== null
                            ? {textTrack: selectedText}
                            : {})}
                        onError={() => {
                            setIsReady(false);
                            setError('Lecture impossible.');
                        }}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <View className="absolute inset-0" pointerEvents="box-none">
                        <Pressable
                            onPress={toggleControls}
                            className={`absolute inset-0 z-0 ${
                                controlsVisible ? 'bg-black/70' : 'bg-transparent'
                            }`}
                        />
                        {isSidePanelOpen ? (
                            <Pressable
                                onPress={() => setActiveSidePanel(null)}
                                className="absolute inset-0 z-20"
                            />
                        ) : null}
                        <Animated.View
                            className="absolute inset-0 z-10"
                            style={{opacity: controlsOpacity}}
                            pointerEvents={controlsVisible ? 'box-none' : 'none'}
                        >
                            <View
                                className="absolute left-6 top-6 right-6 z-10 flex-row items-center justify-between">
                                <View className="flex-1 flex-row items-center gap-3 min-w-0">
                                    {params.type === 'series' && currentEpisodeIndex >= 0 ? (
                                            <View className="h-12 w-12 overflow-hidden rounded-lg bg-slate">
                                                {safeImageUri(
                                                    episodes[currentEpisodeIndex]?.info?.movie_image ??
                                                    episodes[currentEpisodeIndex]?.info?.cover_big ??
                                                    episodes[currentEpisodeIndex]?.info?.backdrop_path?.[0]
                                                ) ? (
                                                    <Image
                                                        source={{
                                                            uri: safeImageUri(
                                                                episodes[currentEpisodeIndex]?.info?.movie_image ??
                                                                episodes[currentEpisodeIndex]?.info?.cover_big ??
                                                                episodes[currentEpisodeIndex]?.info
                                                                    ?.backdrop_path?.[0]
                                                            ),
                                                        }}
                                                        className="h-full w-full"
                                                        resizeMode="cover"
                                                    />
                                                ) : null}
                                            </View>
                                        ) : isLive && liveLogo ? (
                                            <View className="h-12 w-12 overflow-hidden rounded-lg bg-slate">
                                                <Image
                                                    source={{uri: liveLogo}}
                                                    className="h-full w-full"
                                                    resizeMode="contain"
                                                />
                                            </View>
                                        ) : null}
                                        <View className="flex-1 min-w-0 pr-4">
                                            <Text
                                                className="font-bodySemi text-lg text-white"
                                                numberOfLines={2}
                                            >
                                                {params.name ?? ''}
                                            </Text>
                                            {params.type === 'series' && currentEpisodeIndex >= 0 ? (
                                                <Text
                                                    className="font-bold text-sm text-white/70"
                                                    numberOfLines={1}
                                                >
                                                    {episodes[currentEpisodeIndex]?.title ??
                                                        episodes[currentEpisodeIndex]?.name ??
                                                        `Episode ${currentEpisodeIndex + 1}`}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                    <View className="flex-row items-center gap-3 shrink-0">
                                        <Pressable
                                            onPress={handleToggleFavorite}
                                            className="h-12 w-12 items-center justify-center rounded-full bg-black/60"
                                        >
                                            <Ionicons
                                                name={isFavorite ? 'heart' : 'heart-outline'}
                                                size={22}
                                                color="#ffffff"
                                            />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => router.back()}
                                            className="h-12 w-12 items-center justify-center rounded-full bg-black/60"
                                        >
                                            <Ionicons name="close" size={28} color="#ffffff"/>
                                        </Pressable>
                                    </View>
                                </View>
                                {!isLive ? (
                                    <View className="absolute inset-0 flex-row items-center justify-center">
                                        <Pressable
                                            onPress={() => handleJump(-10)}
                                            disabled={!isReady}
                                            className={`mr-10 h-14 w-14 items-center justify-center rounded-full bg-black/60 ${
                                                isReady ? '' : 'opacity-40'
                                            }`}
                                        >
                                            <Ionicons name="play-back" size={22} color="#ffffff"/>
                                            <Text className="font-body text-xs text-white">-10</Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={handleTogglePlay}
                                            disabled={!isReady}
                                            className={`h-20 w-20 items-center justify-center rounded-full bg-black/60 ${
                                                isReady ? '' : 'opacity-40'
                                            }`}
                                        >
                                            <Ionicons
                                                name={paused ? 'play' : 'pause'}
                                                size={36}
                                                color="#ffffff"
                                            />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleJump(10)}
                                            disabled={!isReady}
                                            className={`ml-10 h-14 w-14 items-center justify-center rounded-full bg-black/60 ${
                                                isReady ? '' : 'opacity-40'
                                            }`}
                                        >
                                            <Ionicons name="play-forward" size={22} color="#ffffff"/>
                                            <Text className="font-body text-xs text-white">+10</Text>
                                        </Pressable>
                                    </View>
                                ) : null}
                                <View className="absolute bottom-10 left-0 right-0 items-center">
                                    {isLive ? (
                                        <>
                                            <View className="w-[90%]">
                                                {liveNow?.title ? (
                                                    <Text
                                                        className="font-bodySemi text-sm text-white"
                                                        numberOfLines={2}
                                                    >
                                                        {liveNow.title}
                                                    </Text>
                                                ) : (
                                                    <View className="flex-row items-center gap-2">
                                                        <View className="h-2 w-2 rounded-full bg-ember" />
                                                        <Text className="font-bodySemi text-sm text-white">
                                                            En direct
                                                        </Text>
                                                    </View>
                                                )}
                                                {liveNow ? (
                                                    <Text className="mt-1 font-body text-xs text-white/70">
                                                        {`${formatClock(parseXmltvDate(liveNow.start))} - ${formatClock(
                                                            parseXmltvDate(liveNow.end)
                                                        )}`}
                                                    </Text>
                                                ) : null}
                                                {liveProgress !== null ? (
                                                    <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
                                                        <View
                                                            className="h-full rounded-full bg-ember"
                                                            style={{
                                                                width: `${Math.round(liveProgress * 100)}%`,
                                                            }}
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <View className="w-[90%]">
                                                <Slider
                                                    value={currentTime}
                                                    minimumValue={0}
                                                    maximumValue={Math.max(1, duration)}
                                                    step={1}
                                                    minimumTrackTintColor="#e50914"
                                                    maximumTrackTintColor="rgba(255,255,255,0.2)"
                                                    thumbTintColor="#e50914"
                                                    style={{height: 28, opacity: isReady ? 1 : 0.5}}
                                                    disabled={!isReady}
                                                    onSlidingStart={() => {
                                                        isSeekingRef.current = true;
                                                        if (hideTimer.current) {
                                                            clearTimeout(hideTimer.current);
                                                        }
                                                        setControlsVisible(true);
                                                    }}
                                                    onValueChange={(value) => {
                                                        setCurrentTime(value);
                                                    }}
                                                    onSlidingComplete={(value) => {
                                                        const total = Math.max(1, duration);
                                                        const ratio = value / total;
                                                        isSeekingRef.current = false;
                                                        playerRef.current?.seek(ratio);
                                                        setCurrentTime(value);
                                                        scheduleHide();
                                                    }}
                                                />
                                            </View>
                                            <View className="w-[90%] flex-row items-center justify-end">
                                                <Text className="font-body text-xs text-white">
                                                    {duration
                                                        ? formatTime(currentTime)
                                                        : '0:00'}{' '}
                                                    / {duration ? formatTime(duration) : '--:--'}
                                                </Text>
                                            </View>
                                        </>
                                    )}
                                    <View className="mt-3 w-[90%] min-h-[44px] flex-row items-center justify-center gap-6">
                                        {!isLive ? (
                                            <Pressable
                                                onPress={() => setShowTracks(true)}
                                                disabled={!isReady}
                                                className={`flex-row items-center gap-2 ${
                                                    isReady ? '' : 'opacity-50'
                                                }`}
                                            >
                                                <Ionicons
                                                    name="chatbubbles-outline"
                                                    size={18}
                                                    color="#ffffff"
                                                />
                                                <Text className="font-bold text-base text-white">
                                                    Audio et sous-titres
                                                </Text>
                                            </Pressable>
                                        ) : (
                                            <>
                                                <Pressable
                                                    onPress={() =>
                                                        setActiveSidePanel((prev) =>
                                                            prev === 'epg' ? null : 'epg'
                                                        )
                                                    }
                                                    className="flex-row items-center gap-2"
                                                >
                                                    <Ionicons
                                                        name="time-outline"
                                                        size={18}
                                                        color="#ffffff"
                                                    />
                                                    <Text className="font-bold text-base text-white">
                                                        Programme TV
                                                    </Text>
                                                </Pressable>
                                                <Pressable
                                                    onPress={() =>
                                                        setActiveSidePanel((prev) =>
                                                            prev === 'zap' ? null : 'zap'
                                                        )
                                                    }
                                                    className="flex-row items-center gap-2"
                                                >
                                                    <MaterialCommunityIcons
                                                        name="remote-tv"
                                                        size={18}
                                                        color="#ffffff"
                                                    />
                                                    <Text className="font-bold text-base text-white">ZAP</Text>
                                                </Pressable>
                                            </>
                                        )}
                                        {params.type === 'series' ? (
                                            <>
                                                <Pressable
                                                    onPress={() => setShowEpisodes(true)}
                                                    className="flex-row items-center gap-2"
                                                >
                                                    <Ionicons name="list" size={18} color="#ffffff"/>
                                                    <Text className="font-bold text-base text-white">
                                                        Épisodes
                                                    </Text>
                                                </Pressable>
                                                {nextEpisode ? (
                                                    <Pressable
                                                        onPress={() => handlePlayEpisodeWithSeason(nextEpisode, season)}
                                                        className={`flex-row items-center gap-2 ${
                                                            showCountdown
                                                                ? 'min-w-[240px] justify-center rounded-full bg-white/10 px-5 py-2'
                                                                : ''
                                                        }`}
                                                    >
                                                        <Ionicons name="play-skip-forward" size={18} color="#ffffff"/>
                                                        <Text className="font-bold text-base text-white">
                                                            {showCountdown
                                                                ? `Épisode suivant dans ${remainingSeconds}s`
                                                                : 'Épisode suivant'}
                                                        </Text>
                                                    </Pressable>
                                                ) : nextSeason ? (
                                                    <Pressable
                                                        onPress={() => {
                                                            const firstEpisode =
                                                                episodesBySeason[String(nextSeason)]?.[0] ?? null;
                                                            if (firstEpisode) {
                                                                handlePlayEpisodeWithSeason(firstEpisode, nextSeason);
                                                            }
                                                        }}
                                                        className={`flex-row items-center gap-2 ${
                                                            showCountdown
                                                                ? 'min-w-[240px] justify-center rounded-full bg-white/10 px-5 py-2'
                                                                : ''
                                                        }`}
                                                    >
                                                        <Ionicons name="play-skip-forward" size={18} color="#ffffff"/>
                                                        <Text className="font-bold text-base text-white">
                                                            {showCountdown
                                                                ? `Saison suivante dans ${remainingSeconds}s`
                                                                : 'Saison suivante'}
                                                        </Text>
                                                    </Pressable>
                                                ) : null}
                                            </>
                                        ) : null}
                                    </View>
                                </View>
                        </Animated.View>
                    </View>
                    </Animated.View>
                    {isLive ? (
                        <Animated.View
                            className="h-full border-l border-white/10 bg-black px-4 pt-8 overflow-hidden"
                            style={{width: zapPanelWidth}}
                            pointerEvents={activeSidePanel ? 'auto' : 'none'}
                        >
                                    {activeSidePanel === 'epg' ? (
                                <>
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-2">
                                            <Ionicons name="time-outline" size={18} color="#ffffff"/>
                                            <Text className="font-bodySemi text-lg text-white">
                                                À suivre
                                            </Text>
                                        </View>
                                        <Pressable onPress={() => setActiveSidePanel(null)}>
                                            <Ionicons name="close" size={20} color="#ffffff"/>
                                        </Pressable>
                                    </View>
                                    {tvEpgLoading ? (
                                        <Text className="mt-4 font-body text-xs text-white/60">
                                            Chargement...
                                        </Text>
                                    ) : tvEpgListings.length === 0 ? (
                                        <Text className="mt-4 font-body text-xs text-white/60">
                                            Programme indisponible.
                                        </Text>
                                    ) : (
                                        <SectionList
                                            className="mt-4"
                                            sections={buildEpgSections(tvEpgListings)}
                                            keyExtractor={(item, index) => String(item.epg_id ?? index)}
                                            showsVerticalScrollIndicator={false}
                                            stickySectionHeadersEnabled
                                            renderSectionHeader={({section}) => (
                                                <View className="bg-black/80 py-2">
                                                    <Text className="font-bodySemi text-xs uppercase text-white/60">
                                                        {section.title}
                                                    </Text>
                                                </View>
                                            )}
                                            renderItem={({item}) => {
                                                const start = parseXmltvDate(item.start);
                                                const end = parseXmltvDate(item.end);
                                                const now = new Date();
                                                const isCurrent =
                                                    !!start && !!end && start <= now && end >= now;
                                                return (
                                                    <View className="border-b border-white/10 pb-3 pt-2">
                                                        <View className="flex-row items-center gap-2">
                                                            {isCurrent ? (
                                                                <>
                                                                    <View className="h-2 w-2 rounded-full bg-ember"/>
                                                                    <Text className="font-bodySemi text-[11px] uppercase text-ember">
                                                                        Live
                                                                    </Text>
                                                                </>
                                                            ) : null}
                                                            <Text className="font-bodySemi text-xs text-white/70">
                                                                {formatClock(start)} - {formatClock(end)}
                                                            </Text>
                                                        </View>
                                                        <Text
                                                            className={`font-bodySemi text-sm ${
                                                                isCurrent ? 'text-white' : 'text-white/80'
                                                            }`}
                                                            numberOfLines={2}
                                                        >
                                                            {item.title ?? 'Programme'}
                                                        </Text>
                                                        {item.category ? (
                                                            <Text className="mt-1 font-body text-xs text-white/60">
                                                                {item.category}
                                                            </Text>
                                                        ) : null}
                                                    </View>
                                                );
                                            }}
                                        />
                                    )}
                                </>
                            ) : activeSidePanel === 'zap' ? (
                                <>
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center gap-2">
                                            <MaterialCommunityIcons name="remote-tv" size={18} color="#ffffff"/>
                                            <Text className="font-bodySemi text-lg text-white">
                                                ZAP
                                            </Text>
                                        </View>
                                        <Pressable onPress={() => setActiveSidePanel(null)}>
                                            <Ionicons name="close" size={20} color="#ffffff"/>
                                        </Pressable>
                                    </View>
                                    <View className="mt-4">
                                        {zapCategoriesLoading ? (
                                            <View className="items-center py-4">
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            </View>
                                        ) : zapCategoryOptions.length ? (
                                            <ScrollView
                                                ref={zapTabsScrollRef}
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                contentContainerStyle={{gap: 24, paddingRight: 24}}
                                            >
                                                <View className="relative flex-row gap-10">
                                                    {zapCategoryOptions.map((item) => (
                                                        <Pressable
                                                            key={item.category_id}
                                                            onPress={() => {
                                                                handleSelectZapCategory(item.category_id);
                                                                const target = zapTabLayouts[item.category_id];
                                                                if (target) {
                                                                    zapTabsScrollRef.current?.scrollTo({
                                                                        x: target.x,
                                                                        animated: true,
                                                                    });
                                                                }
                                                            }}
                                                            onLayout={(event) => {
                                                                const {x, width} = event.nativeEvent.layout;
                                                                setZapTabLayouts((prev) => ({
                                                                    ...prev,
                                                                    [item.category_id]: {x, width, pad: 10},
                                                                }));
                                                            }}
                                                            className="pb-3"
                                                        >
                                                            <Text
                                                                className={`pt-4 font-bodySemi text-base ${
                                                                    item.category_id === zapCategoryId
                                                                        ? 'text-white'
                                                                        : 'text-white/50'
                                                                }`}
                                                            >
                                                                {item.category_name}
                                                            </Text>
                                                        </Pressable>
                                                    ))}
                                                    <Animated.View
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            height: 4,
                                                            borderRadius: 999,
                                                            backgroundColor: '#e50914',
                                                            transform: [{translateX: zapUnderlineX}],
                                                            width: zapUnderlineWidth,
                                                        }}
                                                    />
                                                </View>
                                            </ScrollView>
                                        ) : (
                                            <Text className="font-body text-xs text-white/60">
                                                Aucune catégorie disponible.
                                            </Text>
                                        )}
                                    </View>
                                    <View className="mt-4 flex-1">
                                        {zapError ? (
                                            <Text className="font-body text-xs text-ember">
                                                {zapError}
                                            </Text>
                                        ) : null}
                                        {zapCategoriesLoading ? null : !zapCategoryId ? (
                                            <Text className="font-body text-xs text-white/60">
                                                Sélectionnez une catégorie.
                                            </Text>
                                        ) : zapLoadingCategory === zapCategoryId ? (
                                            <View className="items-center py-4">
                                                <ActivityIndicator size="small" color="#ffffff" />
                                            </View>
                                        ) : zapStreams.length ? (
                                            <FlatList
                                                ref={zapListRef}
                                                data={zapStreams}
                                                keyExtractor={(item) => String(item.stream_id)}
                                                showsVerticalScrollIndicator={false}
                                                contentContainerStyle={{paddingBottom: 24}}
                                                getItemLayout={(_, index) => ({
                                                    length: zapItemHeight,
                                                    offset: zapItemHeight * index,
                                                    index,
                                                })}
                                                initialNumToRender={12}
                                                maxToRenderPerBatch={12}
                                                windowSize={5}
                                                removeClippedSubviews
                                                onContentSizeChange={() => {
                                                    scrollZapToActive();
                                                }}
                                                onScrollToIndexFailed={({index}) => {
                                                    const streamId = Number(params.id);
                                                    if (Number.isFinite(streamId)) {
                                                        pendingZapScrollId.current = streamId;
                                                    }
                                                    zapListRef.current?.scrollToOffset({
                                                        offset: Math.max(0, index * zapItemHeight),
                                                        animated: true,
                                                    });
                                                    if (zapScrollRetryRef.current) clearTimeout(zapScrollRetryRef.current);
                                                    zapScrollRetryRef.current = setTimeout(() => {
                                                        scrollZapToActive();
                                                    }, 120);
                                                }}
                                                renderItem={({item}) => {
                                                    const isActiveStream =
                                                        Number(params.id) === item.stream_id;
                                                    const icon = safeImageUri(item.stream_icon);
                                                    const channelId = resolveXmltvChannelId(item);
                                                    const listings =
                                                        tvXmltvListingsByChannel[channelId] ?? [];
                                                    const now = new Date();
                                                    const listing =
                                                        listings.find((candidate) => {
                                                            const start = parseXmltvDate(candidate.start);
                                                            const end = parseXmltvDate(candidate.end);
                                                            return !!start && !!end && start <= now && end >= now;
                                                        }) ?? listings[0] ?? null;
                                                    const start = listing ? parseXmltvDate(listing.start) : null;
                                                    const end = listing ? parseXmltvDate(listing.end) : null;
                                                    const progress =
                                                        start && end
                                                            ? Math.min(
                                                                1,
                                                                Math.max(
                                                                    0,
                                                                    (Date.now() - start.getTime()) /
                                                                        (end.getTime() - start.getTime())
                                                                )
                                                            )
                                                            : null;
                                                    const subtitle =
                                                        start && end
                                                            ? `${formatClock(start)} - ${formatClock(end)}`
                                                            : tvEpgLoading
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
                                                            onPress={() => handleZapStreamPress(item)}
                                                            className={`border-b border-white/10 py-3 ${
                                                                isActiveStream ? 'bg-white/10' : ''
                                                            }`}
                                                        >
                                                            <TvRowContent
                                                                image={icon}
                                                                name={item.name}
                                                                title={title}
                                                                subtitle={subtitle}
                                                                metaLabel={metaLabel}
                                                                progress={progress}
                                                                logoClassName="relative h-12 w-20 items-center justify-center overflow-hidden rounded-md"
                                                                fallbackColor="rgba(255,255,255,0.05)"
                                                                logoTextClassName="font-body text-[10px] text-white/70"
                                                            />
                                                        </Pressable>
                                                    );
                                                }}
                                            />
                                        ) : (
                                            <Text className="font-body text-xs text-white/60">
                                                Aucune chaîne dans cette catégorie.
                                            </Text>
                                        )}
                                    </View>
                                </>
                            ) : null}
                        </Animated.View>
                    ) : null}
                </View>
            ) : (
                <View className="flex-1 items-center justify-center">
                    <Text className="font-body text-mist">Préparation du flux...</Text>
                </View>
            )}

            <Modal
                transparent
                visible={showTracks}
                animationType="fade"
                presentationStyle="overFullScreen"
                supportedOrientations={['landscape']}
                statusBarTranslucent
                onRequestClose={() => setShowTracks(false)}
            >
                <View className="flex-1 px-28 pt-6">
                    <BlurView intensity={90} tint="dark" className="absolute inset-0"/>
                    <View className="flex-1 w-full">
                        <View className="mb-4 flex-row items-center justify-end">
                            <Pressable
                                onPress={() => setShowTracks(false)}
                                className="h-12 w-12 items-center justify-center rounded-full bg-black/50"
                            >
                                <Ionicons name="close" size={26} color="#ffffff"/>
                            </Pressable>
                        </View>
                        <View className="flex-1 flex-row gap-10">
                            <View className="flex-1">
                                <Text className="font-bodySemi text-xs uppercase text-mist">
                                    Sous-titres
                                </Text>
                                <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
                                    <View className="items-start gap-3 pb-20">
                                        {textTracks.length === 0 ? (
                                            <Text className="font-bodySemi text-base text-white/60">
                                                Indisponible
                                            </Text>
                                        ) : (
                                            textTracks.map((track) => {
                                                const active = selectedText === track.id;
                                                return (
                                                    <Pressable
                                                        key={`text-${track.id}-${track.name}`}
                                                        onPress={() => applyTextTrack(track.id)}
                                                        className="rounded-full py-3"
                                                    >
                                                        <Text
                                                            className={`font-bodySemi text-lg ${
                                                                active
                                                                    ? 'text-white'
                                                                    : 'text-white/60'
                                                            }`}
                                                        >
                                                            {track.name}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })
                                        )}
                                    </View>
                                </ScrollView>
                            </View>

                            <View className="flex-1">
                                <Text className="font-bodySemi text-xs uppercase text-mist">
                                    Audio
                                </Text>
                                <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
                                    <View className="items-start gap-3 pb-20">
                                        {audioTracks.length === 0 ? (
                                            <Text className="font-bodySemi text-base text-white/60">
                                                Indisponible
                                            </Text>
                                        ) : (
                                            audioTracks.map((track) => {
                                                const active = selectedAudio === track.id;
                                                return (
                                                    <Pressable
                                                        key={`audio-${track.id}-${track.name}`}
                                                        onPress={() => applyAudioTrack(track.id)}
                                                        className="rounded-full py-3"
                                                    >
                                                        <Text
                                                            className={`font-bodySemi text-xl ${
                                                                active
                                                                    ? 'text-white'
                                                                    : 'text-white/60'
                                                            }`}
                                                        >
                                                            {track.name}
                                                        </Text>
                                                    </Pressable>
                                                );
                                            })
                                        )}
                                    </View>
                                </ScrollView>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={showEpisodes}
                animationType="none"
                presentationStyle="overFullScreen"
                supportedOrientations={['landscape']}
                statusBarTranslucent
                onRequestClose={() => setShowEpisodes(false)}
            >
                <View className="flex-1 px-10 pt-6">
                    <BlurView intensity={90} tint="dark" className="absolute inset-0"/>
                    <View className="flex-1 w-full">
                        <View className="mb-4 flex-row items-center justify-between">
                            <Pressable
                                onPress={() => {
                                    setReturnToEpisodes(true);
                                    setShowEpisodes(false);
                                    setShowSeasonPicker(true);
                                }}
                                className="rounded-xl bg-white/10 px-8 py-3"
                                disabled={!seasonOptions.length}
                            >
                                <View className="flex-row items-center gap-2">
                                    <Text className="font-bodySemi text-base text-white">
                                        Saison {season ?? '-'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#ffffff"/>
                                </View>
                            </Pressable>
                            <Pressable
                                onPress={() => setShowEpisodes(false)}
                                className="h-12 w-12 items-center justify-center rounded-full bg-black/50"
                            >
                                <Ionicons name="close" size={26} color="#ffffff"/>
                            </Pressable>
                        </View>

                        <FlatList
                            ref={episodesListRef}
                            horizontal
                            data={episodes}
                            keyExtractor={(item, index) => `ep-${item.id ?? index}`}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{gap: 28, paddingRight: 24}}
                            getItemLayout={(_, index) => ({
                                length: episodeItemSize,
                                offset: episodeItemSize * index,
                                index,
                            })}
                            renderItem={({item}) => {
                                const active = Number(item.id) === Number(params.id);
                                const cover = safeImageUri(
                                    item.info?.movie_image ??
                                    item.info?.cover_big ??
                                    item.info?.backdrop_path?.[0]
                                );
                                return (
                                    <Pressable
                                        onPress={() => handlePlayEpisode(item)}
                                        className="w-72"
                                    >
                                        <View className={active ? 'rounded-2xl bg-white/5 p-2' : 'p-2'}>
                                            <View className="h-40 w-full overflow-hidden rounded-xl bg-slate">
                                                {cover ? (
                                                    <Image
                                                        source={{uri: cover}}
                                                        className="h-full w-full"
                                                        resizeMode="cover"
                                                    />
                                                ) : null}
                                                {!active ? (
                                                    <View className="absolute inset-0 items-center justify-center">
                                                        <View
                                                            className="h-10 w-10 items-center justify-center rounded-full bg-black/60">
                                                            <Ionicons name="play" size={20} color="#ffffff"/>
                                                        </View>
                                                    </View>
                                                ) : null}
                                                {active ? (
                                                    <View
                                                        className="absolute bottom-2 left-2 right-2 h-1 overflow-hidden rounded-full bg-white/15">
                                                        <View
                                                            className="h-full rounded-full bg-ember"
                                                            style={{
                                                                width: `${Math.min(
                                                                    100,
                                                                    duration
                                                                        ? (currentTime / Math.max(1, duration)) *
                                                                        100
                                                                        : 0
                                                                )}%`,
                                                            }}
                                                        />
                                                    </View>
                                                ) : null}
                                            </View>
                                            <Text className="mt-3 font-bodySemi text-lg text-white" numberOfLines={2}>
                                                {item.title ??
                                                    item.name ??
                                                    `Episode ${item.episode_num ?? ''}`}
                                            </Text>
                                            {item.info?.duration ? (
                                                <Text className="mt-1 font-body text-base text-white/70">
                                                    {item.info.duration}
                                                </Text>
                                            ) : null}
                                            <Text className="mt-2 font-body text-base text-mist" numberOfLines={3}>
                                                {item.info?.plot ?? 'Description indisponible.'}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            }}
                        />
                    </View>
                </View>
            </Modal>

            <Modal
                transparent
                visible={showSeasonPicker}
                animationType="none"
                presentationStyle="overFullScreen"
                supportedOrientations={['landscape']}
                statusBarTranslucent
                onRequestClose={closeSeasonPicker}
            >
                <View className="flex-1 items-center justify-center">
                    <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                    <Pressable
                        onPress={closeSeasonPicker}
                        className="absolute inset-0"
                    />
                    <View className="relative max-h-[70vh] w-full items-center justify-center">
                        {seasonOptions.length > 4 ? (
                            <View
                                pointerEvents="none"
                                style={{
                                    position: 'absolute',
                                    bottom: 6,
                                    left: 0,
                                    right: 0,
                                    alignItems: 'center',
                                    opacity: 0.45,
                                }}
                            >
                                <Ionicons name="chevron-down" size={22} color="#ffffff"/>
                            </View>
                        ) : null}
                        <ScrollView
                            ref={seasonScrollRef}
                            contentContainerStyle={{
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingBottom: 80,
                                flexGrow: 1,
                                justifyContent: 'center',
                            }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View className="items-center gap-4">
                                {seasonOptions.map((value) => {
                                    const selected = season === value;
                                    return (
                                        <Pressable
                                            key={`season-${value}`}
                                            onPress={() => {
                                                setSeason(value);
                                                closeSeasonPicker();
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
                </View>
            </Modal>
        </View>
    );
}
