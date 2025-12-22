import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getCredentials } from '@/lib/storage';
import { buildStreamUrl } from '@/lib/xtream';

export default function PlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const creds = await getCredentials();
        if (!creds || !params.id) {
          router.replace('/login');
          return;
        }
        const url = buildStreamUrl(creds, Number(params.id));
        if (mounted) setStreamUrl(url);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Lecture impossible.');
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [params.id, router]);

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <View className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-6 pt-14">
        <Pressable onPress={() => router.back()} className="rounded-full bg-ash/70 px-4 py-2">
          <Text className="font-body text-white">Retour</Text>
        </Pressable>
        <Text className="max-w-[60%] font-body text-base text-white" numberOfLines={1}>
          {params.name ?? 'Lecture'}
        </Text>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="font-body text-ember">{error}</Text>
        </View>
      ) : (
        <View className="flex-1 items-center justify-center">
          {streamUrl ? (
            <Video
              source={{ uri: streamUrl }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              useNativeControls
            />
          ) : (
            <Text className="font-body text-mist">Préparation du flux...</Text>
          )}
        </View>
      )}
    </View>
  );
}
