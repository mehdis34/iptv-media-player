import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState, type ElementRef} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import type {PressableProps, ViewStyle} from 'react-native';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Text,
    useWindowDimensions,
    View,
    findNodeHandle,
} from 'react-native';

import TVFeaturedMovie from '@/components/tv/TVFeaturedMovie';
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {useTvNavScroll} from '@/components/tv/TVNavScrollContext';
import TVPosterCard, {TV_POSTER_ROW_WIDTH} from '@/components/tv/TVPosterCard';
import {useMoviesCatalog} from '@/lib/movies.hooks';
import {
    buildMovieCategoryRows,
    buildMovieHero,
    buildResumeMovieMap,
    getResumePlaybackState,
    getSelectedCategoryItems,
} from '@/lib/movies.utils';
import {toggleFavoriteItem} from '@/lib/storage';
import type {XtreamCategory, XtreamVod} from '@/lib/types';

type CategoryFilterItem = XtreamCategory & {isAll?: boolean};

const TOP_NAV_HEIGHT = 96;

export default function TvMoviesScreen() {
    const {width, height} = useWindowDimensions();
    const router = useRouter();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const {setScrolled} = useTvNavScroll();
    const [layoutWidth, setLayoutWidth] = useState(0);
    const gridListRef = useRef<FlatList<XtreamVod> | null>(null);
    const rowsListRef = useRef<FlatList<{category: XtreamCategory; items: XtreamVod[]}> | null>(null);
    const rowListRefs = useRef<Record<string, FlatList<XtreamVod> | null>>({});
    const posterHandlesRef = useRef<Record<string, number[]>>({});
    const focusMapUpdateRef = useRef(false);
    const lastRowFocusRef = useRef<number | null>(null);
    const lastGridFocusRef = useRef<number | null>(null);
    const [focusMapVersion, setFocusMapVersion] = useState(0);

    const {
        vodCategories,
        vodStreams,
        favorites,
        setFavorites,
        resumeItems,
        loading,
        error,
        showInitialLoader,
        initialLoadingMessage,
    } = useMoviesCatalog({
        onMissingCredentials: () => router.replace('/login'),
    });

    const orderedVodStreams = useMemo(() => vodStreams, [vodStreams]);
    const resumeMovieMap = useMemo(() => buildResumeMovieMap(resumeItems), [resumeItems]);
    const fallbackWidth = Dimensions.get('window').width || Dimensions.get('screen').width || width;
    const viewportWidth = Math.max(layoutWidth, width, fallbackWidth);
    const expandedPosterWidth = useMemo(() => {
        const explicit = Math.round(viewportWidth * 0.53);
        return explicit > TV_POSTER_ROW_WIDTH ? explicit : TV_POSTER_ROW_WIDTH * 2;
    }, [viewportWidth]);

    const hero = useMemo(
        () =>
            buildMovieHero({
                categories: vodCategories,
                streams: orderedVodStreams,
                selectedCategoryId,
            }),
        [orderedVodStreams, selectedCategoryId, vodCategories]
    );
    const selectedCategoryItems = useMemo(
        () => getSelectedCategoryItems(orderedVodStreams, selectedCategoryId),
        [orderedVodStreams, selectedCategoryId]
    );
    const categoryRows = useMemo(
        () =>
            buildMovieCategoryRows({
                categories: vodCategories,
                streams: orderedVodStreams,
                selectedCategoryId,
                limit: 12,
            }),
        [orderedVodStreams, selectedCategoryId, vodCategories]
    );
    const categoryNameById = useMemo(() => {
        const map: Record<string, string> = {};
        vodCategories.forEach((category) => {
            map[category.category_id] = category.category_name;
        });
        return map;
    }, [vodCategories]);

    const categoryFilters = useMemo<CategoryFilterItem[]>(
        () => [
            {category_id: 'all', category_name: 'Tous les films', isAll: true},
            ...vodCategories,
        ],
        [vodCategories]
    );

    const gridColumns = useMemo(() => {
        if (width >= 1800) return 6;
        if (width >= 1500) return 5;
        return 4;
    }, [width]);

    const rowItemSpacing = 24;
    const rowItemLength = TV_POSTER_ROW_WIDTH + rowItemSpacing;

    const handleScroll = useCallback(
        (event: any) => {
            const offsetY = event?.nativeEvent?.contentOffset?.y ?? 0;
            setScrolled(offsetY > 8);
        },
        [setScrolled]
    );

    useEffect(() => {
        return () => {
            setScrolled(false);
        };
    }, [setScrolled]);

    useFocusEffect(
        useCallback(() => {
            setScrolled(false);
            gridListRef.current?.scrollToOffset({offset: 0, animated: false});
            rowsListRef.current?.scrollToOffset({offset: 0, animated: false});
        }, [setScrolled])
    );

    const renderCategoryPill = useCallback(
        ({item}: {item: CategoryFilterItem}) => {
            const isSelected = item.isAll
                ? !selectedCategoryId
                : item.category_id === selectedCategoryId;
            return (
                <TVFocusPressable
                    onPress={() => setSelectedCategoryId(item.isAll ? null : item.category_id)}
                    className={`rounded-full px-5 py-2 ${
                        isSelected ? 'bg-white' : 'bg-white/10'
                    }`}
                    style={{borderWidth: 2, borderColor: 'transparent'}}
                    focusedStyle={{
                        transform: [{scale: 1.06}],
                        borderColor: '#ffffff',
                        shadowColor: '#ffffff',
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        shadowOffset: {width: 0, height: 0},
                    }}
                >
                    <Text
                        className={`font-bodySemi text-base ${
                            isSelected ? 'text-black' : 'text-white'
                        }`}
                    >
                        {item.category_name}
                    </Text>
                </TVFocusPressable>
            );
        },
        [selectedCategoryId]
    );

    const handleRowFocus = useCallback((index: number) => {
        const listRef = rowsListRef.current;
        if (!listRef) return;
        if (lastRowFocusRef.current === index) return;
        lastRowFocusRef.current = index;
        try {
            listRef.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0,
                viewOffset: TOP_NAV_HEIGHT + 72,
            });
        } catch {
            // Ignore scroll failures.
        }
    }, []);

    const handleRowItemFocus = useCallback(
        (categoryId: string, index: number) => {
            const listRef = rowListRefs.current[categoryId];
            if (!listRef) return;
            try {
                listRef.scrollToIndex({
                    index,
                    animated: true,
                    viewPosition: 0,
                    viewOffset: 56,
                });
            } catch {
                const offset = Math.max(0, rowItemLength * index - 56);
                listRef.scrollToOffset({offset, animated: true});
            }
        },
        [rowItemLength]
    );

    const handlePosterRef = useCallback(
        (categoryId: string, index: number) => (ref: ElementRef<typeof TVFocusPressable> | null) => {
            const handle = ref ? findNodeHandle(ref) : null;
            const row = posterHandlesRef.current[categoryId] ?? [];
            if (handle != null) {
                row[index] = handle;
                posterHandlesRef.current[categoryId] = row;
                if (!focusMapUpdateRef.current) {
                    focusMapUpdateRef.current = true;
                    requestAnimationFrame(() => {
                        focusMapUpdateRef.current = false;
                        setFocusMapVersion((current) => current + 1);
                    });
                }
                return;
            }
            if (row[index] != null) {
                delete row[index];
                if (!focusMapUpdateRef.current) {
                    focusMapUpdateRef.current = true;
                    requestAnimationFrame(() => {
                        focusMapUpdateRef.current = false;
                        setFocusMapVersion((current) => current + 1);
                    });
                }
            }
        },
        []
    );

    const getNeighborHandle = useCallback(
        (rowIndex: number, itemIndex: number, delta: number) => {
            const targetRow = categoryRows[rowIndex + delta];
            if (!targetRow) return undefined;
            const handles = posterHandlesRef.current[targetRow.category.category_id];
            if (!handles || handles.length === 0) return undefined;
            const maxIndex = handles.length - 1;
            let probe = Math.min(itemIndex, maxIndex);
            if (handles[probe] != null) return handles[probe];
            for (let offset = 1; offset <= maxIndex; offset += 1) {
                const left = probe - offset;
                const right = probe + offset;
                if (left >= 0 && handles[left] != null) return handles[left];
                if (right <= maxIndex && handles[right] != null) return handles[right];
            }
            return undefined;
        },
        [categoryRows]
    );

    const handleGridFocus = useCallback((index: number) => {
        const listRef = gridListRef.current;
        if (!listRef) return;
        if (lastGridFocusRef.current === index) return;
        lastGridFocusRef.current = index;
        try {
            listRef.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0,
                viewOffset: TOP_NAV_HEIGHT + 72,
            });
        } catch {
            // Ignore scroll failures.
        }
    }, []);

    const handleRowScrollToIndexFailed = useCallback(
        ({index, averageItemLength}: {index: number; averageItemLength: number}) => {
            const listRef = rowsListRef.current;
            if (!listRef) return;
            const offset = Math.max(0, averageItemLength * index - (TOP_NAV_HEIGHT + 72));
            listRef.scrollToOffset({offset, animated: true});
        },
        []
    );

    const handleGridScrollToIndexFailed = useCallback(
        ({index, averageItemLength}: {index: number; averageItemLength: number}) => {
            const listRef = gridListRef.current;
            if (!listRef) return;
            const offset = Math.max(0, averageItemLength * index - (TOP_NAV_HEIGHT + 72));
            listRef.scrollToOffset({offset, animated: true});
        },
        []
    );

    const renderPoster = useCallback(
        (
            item: XtreamVod,
            size: 'row' | 'grid',
            rowCategoryName?: string,
            onFocus?: PressableProps['onFocus'],
            pressableRef?: (ref: ElementRef<typeof TVFocusPressable> | null) => void,
            nextFocusUp?: number,
            nextFocusDown?: number
        ) => {
            const resume = resumeMovieMap.get(item.stream_id);
            const {progress} = getResumePlaybackState(resume);
            const categoryLabel = rowCategoryName ?? (item.category_id ? categoryNameById[item.category_id] : undefined);
            return (
                <TVPosterCard
                    title={item.name}
                    image={item.cover ?? item.stream_icon}
                    streamId={item.stream_id}
                    categoryName={categoryLabel}
                    progress={progress}
                    size={size}
                    expandedWidth={expandedPosterWidth}
                    loadDetailsOnFocus
                    onFocus={onFocus}
                    pressableRef={pressableRef}
                    nextFocusUp={nextFocusUp}
                    nextFocusDown={nextFocusDown}
                    onPress={() =>
                        router.push({
                            pathname: '/movie/[id]' as const,
                            params: {id: String(item.stream_id), name: item.name},
                        })
                    }
                />
            );
        },
        [categoryNameById, resumeMovieMap, router]
    );

    const renderRow = useCallback(
        ({item, index}: {item: {category: XtreamCategory; items: XtreamVod[]}; index: number}) => (
            <View className="mb-10">
                <View className="mb-4 flex-row items-center justify-between px-14">
                    <Text className="font-bodySemi text-xl text-white">
                        {item.category.category_name}
                    </Text>
                </View>
                <FlatList
                    ref={(ref) => {
                        rowListRefs.current[item.category.category_id] = ref;
                    }}
                    data={item.items}
                    extraData={focusMapVersion}
                    horizontal
                    keyExtractor={(entry) => `tv-vod-${entry.stream_id}`}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({item: entry, index: itemIndex}) => (
                        <View className="mr-6" style={{overflow: 'visible'}}>
                            {renderPoster(
                                entry,
                                'row',
                                item.category.category_name,
                                () => {
                                    handleRowFocus(index);
                                    handleRowItemFocus(item.category.category_id, itemIndex);
                                },
                                handlePosterRef(item.category.category_id, itemIndex),
                                getNeighborHandle(index, itemIndex, -1),
                                getNeighborHandle(index, itemIndex, 1)
                            )}
                        </View>
                    )}
                    getItemLayout={(_, itemIndex) => ({
                        length: rowItemLength,
                        offset: rowItemLength * itemIndex,
                        index: itemIndex,
                    })}
                    contentContainerStyle={{paddingLeft: 56, paddingRight: 56, paddingVertical: 6}}
                    style={{overflow: 'visible'}}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={false}
                />
            </View>
        ),
        [handleRowFocus, handleRowItemFocus, renderPoster]
    );

    const renderHeader = useMemo(() => {
        if (!hero) {
            return (
                <View className="px-14 pt-4 pb-10">
                    <Text className="font-body text-white/70">
                        Aucun film disponible pour le moment.
                    </Text>
                </View>
            );
        }
        const resume = resumeMovieMap.get(hero.id);
        const {label: playLabel, progress} = getResumePlaybackState(resume);
        const isFavorite = favorites.some((fav) => fav.type === 'movie' && fav.id === hero.id);
        const heroHeight = height;
        return (
            <View>
                <View style={{height: heroHeight}}>
                    <TVFeaturedMovie
                        title={hero.title}
                        image={hero.image}
                        badge={hero.badge}
                        streamId={hero.id}
                        playLabel={playLabel}
                        progress={progress}
                        isFavorite={isFavorite}
                        fullBleed
                        height={heroHeight}
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
                        onToggleFavorite={() =>
                            toggleFavoriteItem('movie', hero.id).then(setFavorites)
                        }
                    />
                </View>
                <View className="px-12 pt-6 pb-8">
                    <FlatList
                        data={categoryFilters}
                        horizontal
                        keyExtractor={(item) => item.category_id}
                        showsHorizontalScrollIndicator={false}
                        renderItem={renderCategoryPill}
                        contentContainerStyle={{paddingHorizontal: 8, gap: 16}}
                    />
                </View>
            </View>
        );
    }, [categoryFilters, favorites, height, hero, renderCategoryPill, resumeMovieMap, router, setFavorites]);

    if (error) {
        return (
            <View
                className="flex-1 items-center justify-center bg-black px-6"
                style={{paddingTop: TOP_NAV_HEIGHT, paddingBottom: TOP_NAV_HEIGHT}}
            >
                <Text className="font-body text-ember">{error}</Text>
                <TVFocusPressable
                    onPress={() => router.replace('/(tv)/movies')}
                    className="mt-6 flex-row items-center gap-2 rounded-full border border-white/15 px-6 py-3"
                    style={{borderWidth: 2, borderColor: 'transparent'}}
                    focusedStyle={{
                        transform: [{scale: 1.04}],
                        borderColor: '#ffffff',
                        shadowColor: '#ffffff',
                        shadowOpacity: 0.35,
                        shadowRadius: 8,
                        shadowOffset: {width: 0, height: 0},
                    }}
                >
                    <Ionicons name="refresh" size={18} color="#ffffff"/>
                    <Text className="font-bodySemi text-base text-white">Réessayer</Text>
                </TVFocusPressable>
            </View>
        );
    }

    const showLoader = (loading && vodStreams.length === 0) || showInitialLoader;
    const hasContent = selectedCategoryId
        ? selectedCategoryItems.length > 0
        : categoryRows.length > 0;
    const emptyMinHeight = Math.max(0, height - TOP_NAV_HEIGHT);
    const emptyState = showLoader ? (
        <View className="flex-1 items-center justify-center" style={{minHeight: emptyMinHeight}}>
            <ActivityIndicator size="large" color="#ffffff"/>
            <Text className="mt-4 font-body text-white/70">{initialLoadingMessage}</Text>
        </View>
    ) : (
        <View className="flex-1 items-center justify-center" style={{minHeight: emptyMinHeight}}>
            <Text className="font-body text-white/70">Aucun film disponible pour le moment.</Text>
        </View>
    );

    const listHeader = hasContent ? renderHeader : null;
    const listContentStyle: ViewStyle = hasContent
        ? {paddingBottom: 80, paddingTop: TOP_NAV_HEIGHT}
        : {
              paddingBottom: 80,
              paddingTop: TOP_NAV_HEIGHT,
              flexGrow: 1,
              justifyContent: 'center',
          };

    return (
        <View
            className="flex-1 bg-black"
            onLayout={({nativeEvent}) => {
                const nextWidth = Math.round(nativeEvent.layout.width);
                if (nextWidth && nextWidth !== layoutWidth) {
                    setLayoutWidth(nextWidth);
                }
            }}
        >
            {selectedCategoryId ? (
                <FlatList
                    key={`tv-movies-grid-${gridColumns}`}
                    ref={gridListRef}
                    data={selectedCategoryItems}
                    keyExtractor={(item) => `tv-vod-grid-${item.stream_id}`}
                    numColumns={gridColumns}
                    renderItem={({item, index}) => (
                        <View className="mb-10" style={{overflow: 'visible'}}>
                            {renderPoster(item, 'grid', undefined, () => handleGridFocus(index))}
                        </View>
                    )}
                    columnWrapperStyle={{
                        paddingHorizontal: 56,
                        justifyContent: 'space-between',
                        overflow: 'visible',
                    }}
                    ListHeaderComponent={listHeader}
                    ListHeaderComponentStyle={hero ? {marginTop: -TOP_NAV_HEIGHT} : undefined}
                    ListEmptyComponent={emptyState}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={listContentStyle}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    initialNumToRender={12}
                    maxToRenderPerBatch={12}
                    windowSize={7}
                    removeClippedSubviews={false}
                    onScrollToIndexFailed={handleGridScrollToIndexFailed}
                    style={{overflow: 'visible'}}
                />
            ) : (
                <FlatList
                    key="tv-movies-rows"
                    ref={rowsListRef}
                    data={categoryRows}
                    extraData={focusMapVersion}
                    keyExtractor={(item) => item.category.category_id}
                    renderItem={renderRow}
                    ListHeaderComponent={listHeader}
                    ListHeaderComponentStyle={hero ? {marginTop: -TOP_NAV_HEIGHT} : undefined}
                    ListEmptyComponent={emptyState}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={listContentStyle}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews={false}
                    onScrollToIndexFailed={handleRowScrollToIndexFailed}
                    style={{overflow: 'visible'}}
                />
            )}
        </View>
    );
}
