import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {StatusBar} from 'expo-status-bar';
import {type Href, useRouter} from 'expo-router';
import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Image, Platform, Pressable, Text, View} from 'react-native';
import Color from 'color';
import ImageColors from 'react-native-image-colors';
import coverImage from '../assets/images/cinema-cover.webp';

import {getActiveProfileId, getProfiles, setActiveProfileId} from '@/lib/storage';
import type {XtreamProfile} from '@/lib/types';
import TVFocusPressable from '@/components/tv/TVFocusPressable';

const COVER_SOURCE = coverImage;
const FALLBACK_COLOR = '#0b0b0f';

export default function ProfilesScreen() {
    const router = useRouter();
    const isTV = Platform.isTV;
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
                    router.replace((Platform.isTV ? '/(tv)' : '/(tabs)') as Href);
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
        router.replace((Platform.isTV ? '/(tv)' : '/(tabs)') as Href);
    };

    const handleAddProfile = () => {
        router.push({pathname: '/login', params: {next: '/profiles'}});
    };

    const handleEditProfiles = () => {
        if (!activeId) return;
        router.replace((Platform.isTV ? '/(tv)/account' : '/(tabs)/account') as Href);
    };

    const focusBaseStyle = {borderWidth: 2, borderColor: 'transparent'};
    const focusRingStyle = {
        transform: [{scale: 1.04}],
        borderWidth: 2,
        borderColor: '#ffffff',
        borderRadius: 24,
        shadowColor: '#ffffff',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 0},
    };
    const orderedProfiles = useMemo(() => {
        if (!activeId) return profiles;
        return [...profiles].sort((a, b) => {
            if (a.id === activeId) return -1;
            if (b.id === activeId) return 1;
            return 0;
        });
    }, [activeId, profiles]);

    if (loading) {
        return (
            <View className="flex-1 items-center justify-center bg-ink">
                <StatusBar style="light"/>
                <ActivityIndicator size="large" color="#ffffff"/>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-ink">
            <StatusBar style="light"/>
            <Image source={COVER_SOURCE} className="absolute inset-0 h-full w-full opacity-20" resizeMode="cover"/>
            <LinearGradient colors={gradientColors} locations={[0, 0.55, 1]} className="absolute inset-0"/>
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
                    {orderedProfiles.map((profile, index) => {
                        const isActive = profile.id === activeId;
                        const isSelecting = selectingId === profile.id;
                        return (
                            <View key={profile.id} className="items-center">
                                <View
                                    className={`relative h-20 w-20 rounded-3xl ${
                                        isActive ? 'opacity-100' : 'opacity-90'
                                    }`}
                                >
                                    <View className="absolute inset-1 overflow-hidden rounded-3xl bg-white/10">
                                        <Image source={{uri: profile.profileAvatarUrl}} className="h-full w-full rounded-3xl"/>
                                    </View>
                                    {isSelecting ? (
                                        <View className="absolute inset-1 items-center justify-center rounded-3xl bg-black/60">
                                            <ActivityIndicator size="small" color="#ffffff"/>
                                        </View>
                                    ) : null}
                                    {isTV ? (
                                        <TVFocusPressable
                                            onPress={() => handleSelect(profile)}
                                            disabled={!!selectingId}
                                            className="absolute inset-0"
                                            hasTVPreferredFocus={index === 0}
                                            style={focusBaseStyle}
                                            focusedStyle={focusRingStyle}
                                        >
                                            <View className="flex-1"/>
                                        </TVFocusPressable>
                                    ) : (
                                        <Pressable
                                            onPress={() => handleSelect(profile)}
                                            disabled={!!selectingId}
                                            className="absolute inset-0"
                                        />
                                    )}
                                </View>
                                <Text
                                    className={`mt-2 font-bodySemi text-sm ${
                                        isActive ? 'text-white' : 'text-white/70'
                                    }`}
                                >
                                    {profile.profileName}
                                </Text>
                            </View>
                        );
                    })}
                    {(() => {
                        const Focusable = (isTV ? TVFocusPressable : Pressable) as any;
                        return (
                            <View className={`items-center ${selectingId ? 'opacity-50' : ''}`}>
                                <View className="relative h-20 w-20 rounded-3xl">
                                    <View className="absolute inset-1 items-center justify-center rounded-3xl bg-white/15">
                                        <Ionicons name="add" size={24} color="#ffffff"/>
                                    </View>
                                    <Focusable
                                        onPress={handleAddProfile}
                                        disabled={!!selectingId}
                                        className="absolute inset-0 rounded-3xl"
                                        {...(isTV ? {style: focusBaseStyle, focusedStyle: focusRingStyle} : {})}
                                    >
                                        <View className="flex-1"/>
                                    </Focusable>
                                </View>
                                <Text className="mt-2 font-body text-xs text-white/70">Ajouter</Text>
                            </View>
                        );
                    })()}
                    {(() => {
                        const Focusable = (isTV ? TVFocusPressable : Pressable) as any;
                        return (
                            <View className={`items-center ${!activeId || selectingId ? 'opacity-50' : ''}`}>
                                <View className="relative h-20 w-20 rounded-3xl">
                                    <View className="absolute inset-1 items-center justify-center rounded-3xl bg-white/15">
                                        <Ionicons name="pencil" size={22} color="#ffffff"/>
                                    </View>
                                    <Focusable
                                        onPress={handleEditProfiles}
                                        disabled={!activeId || !!selectingId}
                                        className="absolute inset-0 rounded-3xl"
                                        {...(isTV ? {style: focusBaseStyle, focusedStyle: focusRingStyle} : {})}
                                    >
                                        <View className="flex-1"/>
                                    </Focusable>
                                </View>
                                <Text className="mt-2 font-body text-xs text-white/70">Modifier</Text>
                            </View>
                        );
                    })()}
                </View>
            </View>
        </View>
    );
}
