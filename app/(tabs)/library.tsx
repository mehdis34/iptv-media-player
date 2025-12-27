import {useCallback, useMemo, useRef, useState} from 'react';
import {Alert, FlatList, Image, Pressable, Text, View} from 'react-native';
import {useRouter} from 'expo-router';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import {getCredentials, getFavoriteItems, toggleFavoriteItem} from '@/lib/storage';
import {fetchLiveStreams, fetchSeries, fetchVodStreams} from '@/lib/xtream';
import type {FavoriteItem, XtreamSeries, XtreamStream, XtreamVod} from '@/lib/types';
import {safeImageUri} from '@/lib/media';

type LibraryItem =
    | { type: 'tv'; item: XtreamStream }
    | { type: 'series'; item: XtreamSeries }
    | { type: 'movie'; item: XtreamVod };

export default function LibraryScreen() {
    const router = useRouter();
    const [streams, setStreams] = useState<XtreamStream[]>([]);
    const [movies, setMovies] = useState<XtreamVod[]>([]);
    const [series, setSeries] = useState<XtreamSeries[]>([]);
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
    const [activeFilter, setActiveFilter] = useState<'movie' | 'series' | 'tv'>('movie');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const hasLoadedOnce = useRef(false);

    const loadData = useCallback(() => {
        let mounted = true;
        setLoading(true);
        setError('');

        async function load() {
            try {
                const creds = await getCredentials();
                if (!creds) {
                    router.replace('/login');
                    return;
                }
                const [live, vod, seriesList, favs] = await Promise.all([
                    fetchLiveStreams(creds),
                    fetchVodStreams(creds),
                    fetchSeries(creds),
                    getFavoriteItems(),
                ]);
                if (!mounted) return;
                setStreams(live);
                setMovies(vod);
                setSeries(seriesList);
                setFavorites(favs);
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err.message : 'Favoris indisponibles.');
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => {
            mounted = false;
        };
    }, [router]);

    useFocusEffect(
        useCallback(() => {
            if (hasLoadedOnce.current) return;
            hasLoadedOnce.current = true;
            return loadData();
        }, [loadData])
    );

    useFocusEffect(
        useCallback(() => {
            let active = true;
            const refreshFavorites = async () => {
                const favs = await getFavoriteItems();
                if (active) setFavorites(favs);
            };
            void refreshFavorites();
            return () => {
                active = false;
            };
        }, [])
    );

    const filteredItems = useMemo<LibraryItem[]>(() => {
        const ids = favorites.filter((fav) => fav.type === activeFilter).map((fav) => fav.id);
        if (activeFilter === 'tv') {
            return streams
                .filter((stream) => ids.includes(stream.stream_id))
                .map((stream) => ({type: 'tv' as const, item: stream}));
        }
        if (activeFilter === 'series') {
            return series
                .filter((item) => ids.includes(item.series_id))
                .map((item) => ({type: 'series' as const, item}));
        }
        return movies
            .filter((item) => ids.includes(item.stream_id))
            .map((item) => ({type: 'movie' as const, item}));
    }, [activeFilter, favorites, movies, series, streams]);

    const handleRemove = (type: FavoriteItem['type'], id: number, name?: string) => {
        const label = name ? `“${name}”` : 'cet élément';
        Alert.alert('Retirer des favoris ?', `Supprimer ${label} de votre liste ?`, [
            {text: 'Annuler', style: 'cancel'},
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                    const next = await toggleFavoriteItem(type, id);
                    setFavorites(next);
                },
            },
        ]);
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

    return (
        <View className="flex-1 bg-ink">
            <View className="px-6 pt-16 pb-6">
                <Text className="font-display text-3xl text-white">Ma liste</Text>
                <View className="mt-3 flex-row gap-1.5">
                    {[
                        {key: 'movie', label: 'Films'},
                        {key: 'series', label: 'Séries'},
                        {key: 'tv', label: 'Chaînes TV'},
                    ].map((item) => (
                        <Pressable
                            key={item.key}
                            onPress={() => setActiveFilter(item.key as 'movie' | 'series' | 'tv')}
                            className={`flex-1 items-center justify-center ${
                                item.key === 'movie'
                                    ? 'rounded-l-full'
                                    : item.key === 'tv'
                                        ? 'rounded-r-full'
                                        : 'rounded-none'
                            } ${
                                activeFilter === item.key
                                    ? 'bg-white/15'
                                    : 'bg-white/5'
                            } py-3`}
                        >
                            <Text className="font-semibold text-base text-white">{item.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
            <FlatList
                data={filteredItems}
                keyExtractor={(entry) =>
                    entry.type === 'tv'
                        ? `tv-${entry.item.stream_id}`
                        : entry.type === 'series'
                            ? `series-${entry.item.series_id}`
                            : `movie-${entry.item.stream_id}`
                }
                contentContainerStyle={{paddingBottom: 80}}
                showsVerticalScrollIndicator={false}
                renderItem={({item: entry}) => {
                    if (entry.type === 'tv') {
                        const stream = entry.item as XtreamStream;
                        const logo = safeImageUri(stream.stream_icon);
                        return (
                            <View className="px-6">
                                <View className="flex-row items-center gap-4 pb-3">
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
                                        className="h-20 w-36 overflow-hidden rounded-xl bg-white/10"
                                    >
                                        {logo ? (
                                            <Image source={{uri: logo}} className="h-full w-full" resizeMode="contain"/>
                                        ) : null}
                                    </Pressable>
                                    <Text className="flex-1 font-bodySemi text-sm text-white" numberOfLines={2}>
                                        {stream.name}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
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
                                            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                        >
                                            <Ionicons name="play" size={16} color="#ffffff"/>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleRemove('tv', stream.stream_id, stream.name)}
                                            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#ff4d5a"/>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        );
                    }

                    if (entry.type === 'series') {
                        const item = entry.item as XtreamSeries;
                        const image = safeImageUri(item.cover ?? item.backdrop_path?.[0]);
                        return (
                            <View className="px-6">
                                <View className="flex-row items-center gap-4 pb-3">
                                    <Pressable
                                        onPress={() =>
                                            router.push({
                                                pathname: '/series/[id]' as const,
                                                params: {id: String(item.series_id), name: item.name},
                                            })
                                        }
                                        className="h-20 w-36 overflow-hidden rounded-xl bg-white/10"
                                    >
                                        {image ? (
                                            <Image source={{uri: image}} className="h-full w-full" resizeMode="cover"/>
                                        ) : null}
                                    </Pressable>
                                    <Text className="flex-1 font-bodySemi text-sm text-white" numberOfLines={2}>
                                        {item.name}
                                    </Text>
                                    <View className="flex-row items-center gap-2">
                                        <Pressable
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/series/[id]' as const,
                                                    params: {id: String(item.series_id), name: item.name},
                                                })
                                            }
                                            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                        >
                                            <Ionicons name="play" size={16} color="#ffffff"/>
                                        </Pressable>
                                        <Pressable
                                            onPress={() => handleRemove('series', item.series_id, item.name)}
                                            className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                        >
                                            <Ionicons name="trash-outline" size={16} color="#ff4d5a"/>
                                        </Pressable>
                                    </View>
                                </View>
                            </View>
                        );
                    }

                    const item = entry.item as XtreamVod;
                    const image = safeImageUri(item.cover ?? item.stream_icon);
                    return (
                        <View className="px-6">
                            <View className="flex-row items-center gap-4 pb-3">
                                <Pressable
                                    onPress={() =>
                                        router.push({
                                            pathname: '/movie/[id]' as const,
                                            params: {id: String(item.stream_id), name: item.name},
                                        })
                                    }
                                    className="h-20 w-36 overflow-hidden rounded-xl bg-white/10"
                                >
                                    {image ? (
                                        <Image source={{uri: image}} className="h-full w-full" resizeMode="cover"/>
                                    ) : null}
                                </Pressable>
                                <Text className="flex-1 font-bodySemi text-sm text-white" numberOfLines={2}>
                                    {item.name}
                                </Text>
                                <View className="flex-row items-center gap-2">
                                    <Pressable
                                        onPress={() =>
                                            router.push({
                                                pathname: '/player/[id]' as const,
                                                params: {
                                                    id: String(item.stream_id),
                                                    name: item.name,
                                                    type: 'vod',
                                                    ext: item.container_extension ?? 'mp4',
                                                },
                                            })
                                        }
                                        className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                    >
                                        <Ionicons name="play" size={16} color="#ffffff"/>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => handleRemove('movie', item.stream_id, item.name)}
                                        className="h-10 w-10 items-center justify-center rounded-full bg-white/10"
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#ff4d5a"/>
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View className="px-6">
                        <View className="flex-1 items-center justify-center px-16 pb-16 pt-8">
                            <Text className="text-center font-bodySemi text-3xl text-white">
                                Aucun favori pour le moment.
                            </Text>
                            <Text className="mt-2 px-4 text-center font-body text-xl text-white/60">
                                Ajoutez des films, séries ou chaînes TV pour les retrouver ici.
                            </Text>
                        </View>
                    </View>
                }
            />
        </View>
    );
}
