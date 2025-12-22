import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getCredentials, getFavorites, toggleFavorite } from '@/lib/storage';
import { fetchLiveStreams } from '@/lib/xtream';
import type { XtreamStream } from '@/lib/types';

export default function LibraryScreen() {
  const router = useRouter();
  const [streams, setStreams] = useState<XtreamStream[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const creds = await getCredentials();
        if (!creds) {
          router.replace('/login');
          return;
        }
        const [live, favs] = await Promise.all([fetchLiveStreams(creds), getFavorites()]);
        if (!mounted) return;
        setStreams(live);
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

  const favoriteStreams = useMemo(
    () => streams.filter((stream) => favorites.includes(stream.stream_id)),
    [favorites, streams]
  );

  const handleToggleFavorite = async (streamId: number) => {
    const next = await toggleFavorite(streamId);
    setFavorites(next);
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
    <View className="flex-1 bg-ink px-6 pt-12">
      <Text className="font-display text-3xl text-white tracking-[3px]">Bibliothèque</Text>
      <Text className="mt-1 font-body text-sm text-mist">Vos chaînes favorites</Text>

      <ScrollView className="mt-6">
        <View className="gap-3 pb-12">
          {favoriteStreams.length === 0 ? (
            <View className="rounded-2xl border border-ash bg-ash/40 px-4 py-6">
              <Text className="font-body text-center text-mist">
                Ajoutez des chaînes en favoris pour les retrouver ici.
              </Text>
            </View>
          ) : (
            favoriteStreams.map((stream) => (
              <Pressable
                key={stream.stream_id}
                onPress={() =>
                  router.push({
                    pathname: '/player/[id]',
                    params: { id: String(stream.stream_id), name: stream.name },
                  })
                }
                className="rounded-2xl border border-ash bg-ash/40 px-4 py-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-body text-base text-white" numberOfLines={1}>
                    {stream.name}
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      handleToggleFavorite(stream.stream_id);
                    }}>
                    <Text className="font-body text-xs text-ember">Retirer</Text>
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
