import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { getCredentials, getFavorites, toggleFavorite } from '@/lib/storage';
import { fetchLiveCategories, fetchLiveStreams } from '@/lib/xtream';
import type { XtreamCategory, XtreamStream } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<XtreamCategory[]>([]);
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
        const [cats, live, favs] = await Promise.all([
          fetchLiveCategories(creds),
          fetchLiveStreams(creds),
          getFavorites(),
        ]);
        if (!mounted) return;
        setCategories(cats);
        setStreams(live);
        setFavorites(favs);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Chargement impossible.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const featured = useMemo(() => streams.slice(0, 10), [streams]);
  const rows = useMemo(() => {
    return categories.slice(0, 6).map((category) => ({
      category,
      items: streams.filter((stream) => stream.category_id === category.category_id).slice(0, 12),
    }));
  }, [categories, streams]);

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
        <Pressable
          className="mt-4 rounded-full border border-ash px-6 py-2"
          onPress={() => router.replace('/(tabs)')}>
          <Text className="font-body text-white">Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-ink">
      <View className="px-6 pt-12">
        <View className="mb-6">
          <Text className="font-display text-4xl text-white tracking-[4px]">
            IPTV MEDIA
          </Text>
          <Text className="font-body text-sm text-mist">Votre univers live</Text>
        </View>

        <View className="overflow-hidden rounded-3xl bg-ash">
          <LinearGradient
            colors={['#15151f', '#0b0b0f']}
            className="p-6">
            <Text className="font-display text-3xl text-white tracking-[3px]">
              Live Spotlight
            </Text>
            <Text className="mt-2 font-body text-sm text-mist">
              Les chaînes mises en avant pour votre serveur.
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View className="mt-8 gap-6">
        <Section title="Top picks">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6">
            <View className="flex-row gap-4">
              {featured.map((stream) => (
                <ChannelCard
                  key={stream.stream_id}
                  stream={stream}
                  isFavorite={favorites.includes(stream.stream_id)}
                  onPress={() =>
                    router.push({
                      pathname: '/player/[id]',
                      params: {
                        id: String(stream.stream_id),
                        name: stream.name,
                        icon: stream.stream_icon ?? '',
                      },
                    })
                  }
                  onToggleFavorite={() => handleToggleFavorite(stream.stream_id)}
                />
              ))}
            </View>
          </ScrollView>
        </Section>

        {rows.map((row) => (
          <Section key={row.category.category_id} title={row.category.category_name}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pl-6">
              <View className="flex-row gap-4">
                {row.items.map((stream) => (
                  <ChannelCard
                    key={stream.stream_id}
                    stream={stream}
                    isFavorite={favorites.includes(stream.stream_id)}
                    onPress={() =>
                      router.push({
                        pathname: '/player/[id]',
                        params: {
                          id: String(stream.stream_id),
                          name: stream.name,
                          icon: stream.stream_icon ?? '',
                        },
                      })
                    }
                    onToggleFavorite={() => handleToggleFavorite(stream.stream_id)}
                  />
                ))}
              </View>
            </ScrollView>
          </Section>
        ))}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between px-6">
        <Text className="font-bodySemi text-base text-white">{title}</Text>
        <Text className="font-body text-xs text-mist">Tout voir</Text>
      </View>
      {children}
    </View>
  );
}

function ChannelCard({
  stream,
  isFavorite,
  onPress,
  onToggleFavorite,
}: {
  stream: XtreamStream;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="w-44">
      <View className="overflow-hidden rounded-2xl border border-ash bg-ash/70">
        {stream.stream_icon ? (
          <Image
            source={{ uri: stream.stream_icon }}
            className="h-24 w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="h-24 w-full items-center justify-center bg-slate">
            <Text className="font-display text-xl text-white">LIVE</Text>
          </View>
        )}
        <View className="gap-2 p-3">
          <Text className="font-body text-sm text-white" numberOfLines={2}>
            {stream.name}
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className="self-start">
            <Text className="font-body text-xs text-ember">
              {isFavorite ? 'Retirer' : 'Favori'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
