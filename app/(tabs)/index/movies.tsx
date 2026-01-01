import {type Href, useRouter} from 'expo-router';
import {type ReactNode, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Animated,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {BlurView} from 'expo-blur';

import FeaturedCard from '@/components/FeaturedCard';
import MediaCard from '@/components/MediaCard';
import MediaGrid from '@/components/MediaGrid';
import SectionHeader from '@/components/SectionHeader';
import {getDominantColor} from '@/lib/media';
import {toggleFavoriteItem} from '@/lib/storage';
import {useMoviesCatalog} from '@/lib/movies.hooks';
import {
    buildMovieCategoryRows,
    buildMovieHero,
    buildResumeMovieMap,
    getSelectedCategoryItems,
    getResumePlaybackState,
} from '@/lib/movies.utils';
import type {XtreamCategory, XtreamVod} from '@/lib/types';

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
    const headerHeight = 132;
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
    const [heroTone, setHeroTone] = useState('#000000');
    const [isHeaderBlurred, setIsHeaderBlurred] = useState(false);
    const [showMovieCategories, setShowMovieCategories] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const categoryListRef = useRef<FlatList<XtreamCategory> | null>(null);
    const categoryListScrollRef = useRef<FlatList<MovieRow> | null>(null);
    const categoryGridScrollRef = useRef<FlatList<XtreamVod> | null>(null);
    const categoryButtonScale = useRef(new Animated.Value(1)).current;
    const categoryItemHeight = 56;
    const categoryItemGap = 12;

    const orderedVodStreams = useMemo(() => vodStreams, [vodStreams]);

    const resumeMovieMap = useMemo(() => buildResumeMovieMap(resumeItems), [resumeItems]);

    const selectedCategoryItems = useMemo(() => {
        return getSelectedCategoryItems(orderedVodStreams, selectedCategoryId);
    }, [orderedVodStreams, selectedCategoryId]);

    const hero = useMemo(
        () =>
            buildMovieHero({
                categories: vodCategories,
                streams: orderedVodStreams,
                selectedCategoryId,
            }),
        [orderedVodStreams, selectedCategoryId, vodCategories]
    );
    const selectedCategory = useMemo(
        () => vodCategories.find((category) => category.category_id === selectedCategoryId),
        [selectedCategoryId, vodCategories]
    );

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

    useEffect(() => {
        Animated.sequence([
            Animated.timing(categoryButtonScale, {
                toValue: 0.96,
                duration: 120,
                useNativeDriver: true,
            }),
            Animated.timing(categoryButtonScale, {
                toValue: 1,
                duration: 140,
                useNativeDriver: true,
            }),
        ]).start();
    }, [categoryButtonScale, selectedCategoryId]);

    useEffect(() => {
        if (!showMovieCategories) return;
        if (!selectedCategoryId) return;
        const index = vodCategories.findIndex(
            (category) => category.category_id === selectedCategoryId
        );
        if (index < 0) return;
        const handle = requestAnimationFrame(() => {
            categoryListRef.current?.scrollToIndex({index, animated: true});
        });
        return () => cancelAnimationFrame(handle);
    }, [selectedCategoryId, showMovieCategories, vodCategories]);

    useEffect(() => {
        const handle = requestAnimationFrame(() => {
            if (selectedCategoryId) {
                categoryGridScrollRef.current?.scrollToOffset({offset: 0, animated: false});
                return;
            }
            categoryListScrollRef.current?.scrollToOffset({offset: 0, animated: false});
        });
        return () => cancelAnimationFrame(handle);
    }, [selectedCategoryId]);

    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const next = offsetY > 12;
        setIsHeaderBlurred((prev) => (prev !== next ? next : prev));
    };

    const vodRows = useMemo(
        () =>
            buildMovieCategoryRows({
                categories: vodCategories,
                streams: orderedVodStreams,
                selectedCategoryId,
                limit: 12,
            }),
        [orderedVodStreams, selectedCategoryId, vodCategories]
    );

    const movieRows = useMemo<MovieRow[]>(() => {
        if (selectedCategoryId) {
            return vodRows.map((row) => ({
                key: row.category.category_id,
                title: row.category.category_name,
                items: row.items,
                href: {
                    type: 'movies',
                    id: row.category.category_id,
                    name: row.category.category_name,
                },
            }));
        }
        return vodRows.map((row) => ({
            key: row.category.category_id,
            title: row.category.category_name,
            items: row.items,
            href: {
                type: 'movies',
                id: row.category.category_id,
                name: row.category.category_name,
            },
        }));
    }, [orderedVodStreams, selectedCategoryId, vodRows]);

    const renderHeader = useCallback(() => {
        if (!hero) return <View className="px-6 pb-6"/>;
        const resume = resumeMovieMap.get(hero.id);
        const {label: playLabel, progress} = getResumePlaybackState(resume);
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

    const renderMovieCard = useCallback(
        (item: XtreamVod, size?: 'grid') => (
            <MediaCard
                title={item.name}
                image={item.cover ?? item.stream_icon}
                progress={(() => {
                    const resume = resumeMovieMap.get(item.stream_id);
                    if (!resume || !resume.durationSec) return undefined;
                    return resume.positionSec / resume.durationSec;
                })()}
                size={size}
                onPress={() =>
                    router.push({
                        pathname: '/movie/[id]' as const,
                        params: {id: String(item.stream_id), name: item.name},
                    })
                }
            />
        ),
        [resumeMovieMap, router]
    );

    const renderRow = useCallback(
        (item: MovieRow) => (
            <Section
                title={item.title}
                href={item.href}
                onPress={() => setSelectedCategoryId(item.href?.id ?? null)}
            >
                <FlatList<XtreamVod>
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={item.items}
                    keyExtractor={(entry) => `vod-${entry.stream_id}`}
                    renderItem={({item: entry}) => renderMovieCard(entry)}
                    contentContainerStyle={{paddingLeft: 24, paddingRight: 24, gap: 16}}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews
                />
            </Section>
        ),
        [renderMovieCard, setSelectedCategoryId]
    );

    const renderCategoryHeader = useCallback(() => {
        const first = selectedCategoryItems[0];
        const resume = first ? resumeMovieMap.get(first.stream_id) : undefined;
        const {label: playLabel, progress} = getResumePlaybackState(resume);
        const isFavorite = first
            ? favorites.some((fav) => fav.type === 'movie' && fav.id === first.stream_id)
            : false;
        return (
            <View className="px-6 pb-2">
                {first ? (
                    <FeaturedCard
                        title={first.name}
                        image={first.cover ?? first.stream_icon}
                        badge="Film"
                        playLabel={playLabel}
                        progress={progress}
                        onPress={() =>
                            router.push({
                                pathname: '/movie/[id]' as const,
                                params: {id: String(first.stream_id), name: first.name},
                            })
                        }
                        onPlay={() =>
                            router.push({
                                pathname: '/player/[id]' as const,
                                params: {
                                    id: String(first.stream_id),
                                    name: first.name,
                                    type: 'vod',
                                    ext: first.container_extension ?? 'mp4',
                                },
                            })
                        }
                        isFavorite={isFavorite}
                        onToggleFavorite={() =>
                            toggleFavoriteItem('movie', first.stream_id).then(setFavorites)
                        }
                    />
                ) : null}
            </View>
        );
    }, [favorites, resumeMovieMap, router, selectedCategory, selectedCategoryItems]);

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
                    onPress={() => router.replace('/movies' as Href)}>
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
            <View
                className="absolute left-0 right-0 top-0 z-10 px-6 bg-transparent"
                style={{height: headerHeight, paddingTop: 36}}
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
                <View className="w-full">
                    <View className="flex-row items-center justify-between">
                        <Pressable
                            onPress={() => router.back()}
                            className="h-10 w-10 items-center justify-center"
                        >
                            <Ionicons name="chevron-back" size={24} color="#ffffff"/>
                        </Pressable>
                        <Text className="max-w-[60%] font-bold text-xl text-white" numberOfLines={1}>
                            Films
                        </Text>
                        <View className="w-10"/>
                    </View>
                    <View className="mt-2 items-center">
                        <Animated.View style={{transform: [{scale: categoryButtonScale}]}}>
                            <Pressable
                                onPress={() => {
                                    setShowMovieCategories(true);
                                }}
                                onPressIn={() => {
                                    Animated.spring(categoryButtonScale, {
                                        toValue: 0.97,
                                        useNativeDriver: true,
                                    }).start();
                                }}
                                onPressOut={() => {
                                    Animated.spring(categoryButtonScale, {
                                        toValue: 1,
                                        useNativeDriver: true,
                                    }).start();
                                }}
                                className={`flex-row items-center gap-2 rounded-full px-4 py-2 ${
                                    selectedCategoryId ? 'bg-white/90' : 'border border-white/15 bg-white/10'
                                }`}
                            >
                                <Text
                                    className={`font-bodySemi text-sm ${
                                        selectedCategoryId ? 'text-black' : 'text-white'
                                    }`}
                                >
                                    {selectedCategory?.category_name ?? 'Catégories'}
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color={selectedCategoryId ? '#000000' : '#ffffff'}
                                />
                            </Pressable>
                        </Animated.View>
                    </View>
                </View>
            </View>
            {selectedCategoryId ? (
                <MediaGrid
                    className="flex-1"
                    data={selectedCategoryItems}
                    keyExtractor={(item) => `vod-${item.stream_id}`}
                    columnWrapperStyle={{paddingHorizontal: 12, marginBottom: 12}}
                    scrollEnabled
                    showsVerticalScrollIndicator={false}
                    ref={categoryGridScrollRef}
                    ListHeaderComponent={renderCategoryHeader}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{paddingTop: headerHeight + 16, paddingBottom: 24}}
                    initialNumToRender={9}
                    maxToRenderPerBatch={9}
                    windowSize={7}
                    removeClippedSubviews
                    renderItem={({item}) => renderMovieCard(item, 'grid')}
                />
            ) : (
                <FlatList<MovieRow>
                    ref={categoryListScrollRef}
                    className="flex-1"
                    data={movieRows}
                    keyExtractor={(item) => item.key}
                    renderItem={({item}) => renderRow(item)}
                    ListHeaderComponent={renderHeader}
                    ListFooterComponent={<View className="h-10"/>}
                    ItemSeparatorComponent={() => <View className="h-4"/>}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{paddingTop: headerHeight + 16, paddingBottom: 40}}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={7}
                    removeClippedSubviews
                />
            )}
            <Modal
                transparent
                visible={showInitialLoader}
                animationType="fade"
            >
                <View className="flex-1 items-center justify-center px-6">
                    <BlurView intensity={40} tint="dark" className="absolute inset-0"/>
                    <View
                        className="w-full max-w-[360px] items-center rounded-2xl border border-white/10 bg-black/80 px-6 py-8">
                        <ActivityIndicator size="large" color="#ffffff"/>
                        <Text className="mt-4 font-bodySemi text-base text-white">
                            {initialLoadingMessage}
                        </Text>
                    </View>
                </View>
            </Modal>
            <Modal
                transparent
                visible={showMovieCategories}
                animationType="fade"
                onRequestClose={() => setShowMovieCategories(false)}
            >
                <View className="flex-1 items-center justify-center bg-ash/50">
                    <BlurView intensity={50} tint="dark" className="absolute inset-0"/>
                    <Pressable
                        onPress={() => setShowMovieCategories(false)}
                        className="absolute inset-0"
                    />
                    <View className="flex-1 w-full items-center justify-center">
                        <FlatList
                            ref={categoryListRef}
                            data={vodCategories}
                            keyExtractor={(item) => item.category_id}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{
                                alignItems: 'center',
                                paddingTop: 250,
                                paddingBottom: 250,
                                flexGrow: 1,
                                justifyContent: 'center',
                            }}
                            ItemSeparatorComponent={() => <View style={{height: categoryItemGap}}/>}
                            getItemLayout={(_, index) => ({
                                length: categoryItemHeight + categoryItemGap,
                                offset: (categoryItemHeight + categoryItemGap) * index,
                                index,
                            })}
                            onScrollToIndexFailed={() => {
                                categoryListRef.current?.scrollToOffset({offset: 0, animated: false});
                            }}
                            ListHeaderComponent={
                                <Pressable
                                    onPress={() => {
                                        setSelectedCategoryId(null);
                                        setShowMovieCategories(false);
                                    }}
                                    style={{height: categoryItemHeight, justifyContent: 'center'}}
                                    className="rounded-full px-6"
                                >
                                    <Text
                                        className={`font-bodySemi text-xl text-center ${
                                            selectedCategoryId ? 'text-white/60' : 'text-white'
                                        }`}
                                    >
                                        Tous les films
                                    </Text>
                                </Pressable>
                            }
                            ListHeaderComponentStyle={{marginBottom: categoryItemGap}}
                            renderItem={({item}) => {
                                const selected = item.category_id === selectedCategoryId;
                                return (
                                    <Pressable
                                        onPress={() => {
                                            setSelectedCategoryId(item.category_id);
                                            setShowMovieCategories(false);
                                        }}
                                        style={{height: categoryItemHeight, justifyContent: 'center'}}
                                        className="rounded-full px-6"
                                    >
                                        <Text
                                            className={`font-bodySemi text-xl text-center ${
                                                selected ? 'text-white' : 'text-white/60'
                                            }`}
                                        >
                                            {item.category_name}
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
        </View>
    );
}

function Section({
                     title,
                     href,
                     onPress,
                     children,
                 }: {
    title: string;
    href?: CategoryParams;
    onPress?: () => void;
    children: ReactNode;
}) {
    return (
        <View>
            <SectionHeader title={title} href={href} onPress={onPress}/>
            {children}
        </View>
    );
}
