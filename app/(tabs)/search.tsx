import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { getCredentials } from '@/lib/storage';
import { fetchLiveStreams } from '@/lib/xtream';
import type { XtreamStream } from '@/lib/types';
import { searchSchema, type SearchFormValues } from '@/schemas/search.schema';

export default function SearchScreen() {
  const router = useRouter();
  const [streams, setStreams] = useState<XtreamStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const {
    control,
    watch,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      query: '',
    },
    mode: 'onChange',
  });
  const query = watch('query');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const creds = await getCredentials();
        if (!creds) {
          router.replace('/login');
          return;
        }
        const live = await fetchLiveStreams(creds);
        if (mounted) setStreams(live);
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

  const results = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return streams.slice(0, 20);
    const q = trimmedQuery.toLowerCase();
    return streams.filter((stream) => stream.name.toLowerCase().includes(q)).slice(0, 40);
  }, [query, streams]);

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
      <Text className="font-display text-3xl text-white tracking-[3px]">Recherche</Text>
      <View className="mt-4 rounded-2xl border border-ash bg-ash/60 px-4 py-3">
        <Controller
          control={control}
          name="query"
          render={({ field: { onChange, value, onBlur } }) => (
            <TextInput
              className="font-body text-base text-white"
              placeholder="Chaîne, catégorie, sport..."
              placeholderTextColor="#6b7280"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
      </View>
      {errors.query?.message ? (
        <Text className="mt-2 font-body text-sm text-ember">{errors.query.message}</Text>
      ) : null}

      <ScrollView className="mt-6">
        <View className="gap-3 pb-12">
          {results.map((stream) => (
            <Pressable
              key={stream.stream_id}
              onPress={() =>
                router.push({
                  pathname: '/player/[id]' as const,
                  params: { id: String(stream.stream_id), name: stream.name, type: 'tv' },
                })
              }
              className="rounded-2xl border border-ash bg-ash/40 px-4 py-3">
              <Text className="font-body text-base text-white" numberOfLines={1}>
                {stream.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
