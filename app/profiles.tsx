import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {StatusBar} from 'expo-status-bar';
import {useRouter, type Href} from 'expo-router';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Image, Pressable, Text, View} from 'react-native';
import Color from 'color';
import ImageColors from 'react-native-image-colors';
import coverImage from '../assets/images/cinema-cover.webp';

import {getActiveProfileId, getProfiles, setActiveProfileId} from '@/lib/storage';
import type {XtreamProfile} from '@/lib/types';

const COVER_SOURCE = coverImage;
const FALLBACK_COLOR = '#0b0b0f';

export default function ProfilesScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<XtreamProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState(FALLBACK_COLOR);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [list, active] = await Promise.all([getProfiles(), getActiveProfileId()]);
        if (!mounted) return;
        if (list.length === 0) {
          router.replace('/login');
          return;
        }
        if (list.length === 1) {
          await setActiveProfileId(list[0].id);
          if (!mounted) return;
          router.replace('/home' as Href);
          return;
        }
        setProfiles(list);
        setActiveId(active ?? null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    let mounted = true;
    async function loadCoverColor() {
      try {
        const source = Image.resolveAssetSource(COVER_SOURCE);
        const uri = source?.uri;
        if (!uri) {
          if (mounted) setDominantColor(FALLBACK_COLOR);
          return;
        }
        const result: any = await ImageColors.getColors(uri, {
          fallback: FALLBACK_COLOR,
          cache: true,
          key: 'profiles-cover',
        });
        const color =
          result?.dominant || result?.background || result?.average || result?.primary;
        if (mounted && color) setDominantColor(color);
      } catch {
        if (mounted) setDominantColor(FALLBACK_COLOR);
      }
    }
    loadCoverColor();
    return () => {
      mounted = false;
    };
  }, []);

  const gradientColors = useMemo<[string, string, string]>(() => {
    const base = Color(dominantColor);
    return [
      base.alpha(0.1).rgb().string(),
      base.alpha(0.45).darken(0.2).rgb().string(),
      base.darken(0.7).rgb().string(),
    ];
  }, [dominantColor]);

  const handleSelect = async (profile: XtreamProfile) => {
    if (selectingId) return;
    setSelectingId(profile.id);
    await setActiveProfileId(profile.id);
    router.replace('/home' as Href);
  };

  const handleAddProfile = () => {
    router.push({ pathname: '/login', params: { next: '/profiles' } });
  };

  const handleEditProfiles = () => {
    if (!activeId) return;
    router.replace('/(tabs)/account');
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ink">
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <Image source={COVER_SOURCE} className="absolute inset-0 h-full w-full opacity-20" resizeMode="cover" />
      <LinearGradient colors={gradientColors} locations={[0, 0.55, 1]} className="absolute inset-0" />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.88)']}
        locations={[0.25, 1]}
        className="absolute inset-0"
      />
      <View className="flex-1 justify-end px-6 pb-32">
        <Text className="text-center font-body text-lg text-white/80 mb-6">
          Choisissez votre profil
        </Text>

        <View className="mt-4 flex-row flex-wrap justify-center gap-5">
          {profiles.map((profile) => {
            const isActive = profile.id === activeId;
            const isSelecting = selectingId === profile.id;
            return (
              <Pressable
                key={profile.id}
                onPress={() => handleSelect(profile)}
                disabled={!!selectingId}
                className="items-center"
              >
                <View
                  className={`h-20 w-20 overflow-hidden rounded-3xl bg-white/10 ${
                    isActive ? 'opacity-100' : 'opacity-90'
                  }`}
                >
                  <Image source={{ uri: profile.profileAvatarUrl }} className="h-full w-full" />
                  {isSelecting ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/60">
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  ) : null}
                </View>
                <Text
                  className={`mt-2 font-bodySemi text-sm ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {profile.profileName}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={handleAddProfile}
            disabled={!!selectingId}
            className={`items-center ${selectingId ? 'opacity-50' : ''}`}
          >
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-white/15">
              <Ionicons name="add" size={24} color="#ffffff" />
            </View>
            <Text className="mt-2 font-body text-xs text-white/70">Ajouter</Text>
          </Pressable>
          <Pressable
            onPress={handleEditProfiles}
            disabled={!activeId || !!selectingId}
            className={`items-center ${!activeId || selectingId ? 'opacity-50' : ''}`}
          >
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-white/15">
              <Ionicons name="pencil" size={22} color="#ffffff" />
            </View>
            <Text className="mt-2 font-body text-xs text-white/70">Modifier</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
