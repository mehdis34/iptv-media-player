import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Animated, FlatList, Image, Modal, Pressable, ScrollView, SectionList, Text, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';

import ScreenHeader from '@/components/ScreenHeader';
import {EPG_CACHE_TTL_MS, clearEpgCache, getEpgCache, isEpgCacheFresh, setEpgCache} from '@/lib/epg-cache';
import {getDominantColor, safeImageUri} from '@/lib/media';
import {formatDayLabel} from '@/lib/date.utils';
import {decodeEpgText, parseEpgDate, resolveXmltvChannelId as resolveXmltvChannelIdFromStream} from '@/lib/epg.utils';
import {
    getActiveProfileId,
    getCatalogCache,
    getCredentials,
    getFavoriteItems,
    setCatalogCache,
    toggleFavoriteItem,
} from '@/lib/storage';
import {fetchLiveCategories, fetchLiveStreams, fetchXmltvEpg} from '@/lib/xtream';
import type {FavoriteItem, XtreamCategory, XtreamEpgListing, XtreamStream} from '@/lib/types';

export default function TvScreen() {
    const router = useRouter();
    const [categories, setCategories] = useState<XtreamCategory[]>([]);
    const [streams, setStreams] = useState<XtreamStream[]>([]);
    const [tvTab, setTvTab] = useState<'now' | 'guide'>('now');
    const [showTvThemes, setShowTvThemes] = useState(false);
    const [tvCategoryId, setTvCategoryId] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
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
    const [tvTabLayouts, setTvTabLayouts] = useState<{
        now?: { x: number; width: number; pad: number };
        guide?: { x: number; width: number; pad: number };
    }>({});
    const tvUnderlineX = useRef(new Animated.Value(0)).current;
    const tvUnderlineWidth = useRef(new Animated.Value(0)).current;
    const tvTabsScrollRef = useRef<ScrollView>(null);
    const tvThemeListRef = useRef<FlatList<{id: string; name: string}> | null>(null);
    const tvThemeItemHeight = 56;
    const tvThemeItemGap = 16;
    const lastProfileKey = useRef<string | null>(null);
    const hasLoadedOnce = useRef(false);
    const hasLoadedEpg = useRef(false);

    const tvCategoryStreams = useMemo(() => {
        return tvCategoryId
            ? streams.filter((stream) => stream.category_id === tvCategoryId)
            : streams;
    }, [streams, tvCategoryId]);

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

    const resolveXmltvChannelId = useCallback(
        (stream: XtreamStream) =>
            resolveXmltvChannelIdFromStream(stream, tvXmltvChannelIdByName),
        [tvXmltvChannelIdByName]
    );

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

    const formatClock = (date: Date | null) => {
        if (!date) return '--:--';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}h${minutes}`;
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

    const loadEpgData = useCallback(
        async (sourceStreams: XtreamStream[]) => {
            if (!sourceStreams.length) {
                setTvXmltvListings({});
                setTvXmltvChannelIdByName({});
                return;
            }
            const profileId = await getActiveProfileId();
            const cachedEpg = getEpgCache(profileId);
            if (cachedEpg && isEpgCacheFresh(cachedEpg, EPG_CACHE_TTL_MS)) {
                setTvXmltvListings(cachedEpg.listingsByChannel ?? {});
                setTvXmltvChannelIdByName(cachedEpg.channelIdByName ?? {});
                hasLoadedEpg.current = true;
                return;
            }
            setTvGuideLoading(true);
            setTvNowEpgLoading(true);
            try {
                const creds = await getCredentials();
                if (!creds) return;
                const xmltv = await fetchXmltvEpg(creds);
                const listingsByChannel = xmltv.listingsByChannel ?? {};
                const channelIdByName = xmltv.channelIdByName ?? {};
                setTvXmltvListings(listingsByChannel);
                setTvXmltvChannelIdByName(channelIdByName);
                setEpgCache(profileId, {listingsByChannel, channelIdByName});
            } catch {
                setTvXmltvListings({});
                setTvXmltvChannelIdByName({});
            } finally {
                setTvGuideLoading(false);
                setTvNowEpgLoading(false);
                hasLoadedEpg.current = true;
            }
        },
        []
    );

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
                if (profileChanged) {
                    hasLoadedEpg.current = false;
                }
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
                    now - cache.updatedAt.liveCategories < catalogCacheTtl &&
                    now - cache.updatedAt.liveStreams < catalogCacheTtl;

                if (cache.data.liveCategories) setCategories(cache.data.liveCategories);
                if (cache.data.liveStreams) setStreams(cache.data.liveStreams);

                const favs = await getFavoriteItems();
                if (!mounted) return;
                setFavorites(favs);

                if (cacheFresh) {
                    if (!hasLoadedEpg.current) {
                        const cachedLive = cache.data.liveStreams ?? [];
                        const filteredLive = tvCategoryId
                            ? cachedLive.filter((stream) => stream.category_id === tvCategoryId)
                            : cachedLive;
                        if (filteredLive.length) {
                            void loadEpgData(filteredLive);
                        }
                    }
                    hasLoadedOnce.current = true;
                    setLoading(false);
                    return;
                }

                setShowInitialLoader(true);
                setInitialLoadingMessage('Chargement du catalogue...');

                const [cats, live] = await Promise.all([
                    fetchLiveCategories(creds),
                    fetchLiveStreams(creds),
                ]);
                if (!mounted) return;
                setCategories(cats);
                setStreams(live);
                await setCatalogCache({
                    liveCategories: cats,
                    liveStreams: live,
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

    const handleToggleFavorite = async (streamId: number) => {
        const next = await toggleFavoriteItem('tv', streamId);
        setFavorites(next);
    };

    const handleRefreshEpg = useCallback(async () => {
        setShowEpgRefreshConfirm(false);
        setTvXmltvListings({});
        setTvXmltvChannelIdByName({});
        setTvVisibleEpgByChannel({});
        const profileId = await getActiveProfileId();
        clearEpgCache(profileId);
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

    if (loading && !showInitialLoader && streams.length === 0) {
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
                    onPress={() => router.replace('/tv')}>
                    <Text className="font-body text-white">Réessayer</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-black">
            <ScreenHeader title="TV" onBack={() => router.back()} />
            <View className="px-6">
                <View className="flex-row items-center justify-between">
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
                <View className="mt-4">{renderTvTabs()}</View>
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
                    renderItem={({item}) => {
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
                                                                icon: item.stream_icon ?? undefined,
                                                                categoryId: item.category_id ?? undefined,
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
                                                                    icon: item.stream_icon ?? undefined,
                                                                    categoryId: item.category_id ?? undefined,
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
                    renderItem={({item}) => {
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
                                            icon: item.stream_icon ?? undefined,
                                            categoryId: item.category_id ?? undefined,
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
                                        icon: epgInfoStream.stream_icon ?? undefined,
                                        categoryId: epgInfoStream.category_id ?? undefined,
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
