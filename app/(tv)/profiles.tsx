import Ionicons from '@expo/vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useRef, useState} from 'react';
import {FlatList, Image, Text, View} from 'react-native';

import TVScreen from '@/components/tv/TVScreen';
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {getActiveProfileId, getProfiles, setActiveProfileId} from '@/lib/storage';
import type {XtreamProfile} from '@/lib/types';
import {useRouter} from "expo-router";

export default function TvProfilesScreen() {
    const router = useRouter()
    const [profiles, setProfiles] = useState<XtreamProfile[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const pendingSwitchRef = useRef<string | null>(null);
    const focusBaseStyle = {borderWidth: 2, borderColor: 'transparent'};
    const focusRingStyle = {
        transform: [{scale: 1.04}],
        borderWidth: 2,
        borderColor: '#ffffff',
        borderRadius: 9999,
        shadowColor: '#ffffff',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 0},
    };

    const loadProfiles = useCallback(async () => {
        const [list, active] = await Promise.all([getProfiles(), getActiveProfileId()]);
        setProfiles(list);
        setActiveId(active ?? null);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadProfiles();
        }, [loadProfiles])
    );

    const orderedProfiles = useMemo(() => {
        if (!activeId) return profiles;
        return [...profiles].sort((a, b) => {
            if (a.id === activeId) return -1;
            if (b.id === activeId) return 1;
            return 0;
        });
    }, [activeId, profiles]);

    const handleSwitch = useCallback(
        async (id: string) => {
            if (activeId === id) return;
            pendingSwitchRef.current = id;
            await setActiveProfileId(id);
            setActiveId(id);
        },
        [activeId]
    );

    return (
        <TVScreen>
            <View className="w-full max-w-3xl self-center px-12 pt-12">
                <Text className="mb-4 font-bodySemi text-xl text-white text-center">Modifier un profil</Text>
                <FlatList
                    data={orderedProfiles}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    horizontal
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{gap: 20, paddingBottom: 12, paddingHorizontal: 32, paddingTop: 6}}
                    style={{overflow: 'visible'}}
                    renderItem={({item}) => {
                        const isActive = item.id === activeId;
                        return (
                            <View className="items-center">
                                <TVFocusPressable
                                    onPress={async () => {
                                        await handleSwitch(item.id);
                                        router.push('/(tv)/profile-edit');
                                    }}
                                    className="h-36 w-36 rounded-full flex items-center justify-center bg-ash"
                                    style={focusBaseStyle}
                                    focusedStyle={focusRingStyle}
                                >
                                    <View className="relative h-full w-full">
                                        <Image
                                            source={{uri: item.profileAvatarUrl}}
                                            className="h-full w-full rounded-full"
                                        />
                                        <View
                                            className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-ash">
                                            <Ionicons name="pencil" size={14} color="#ffffff"/>
                                        </View>
                                    </View>
                                </TVFocusPressable>
                                <Text className="mt-4 text-center font-bodySemi text-lg text-white">
                                    {item.profileName}
                                </Text>
                                {isActive ? (
                                    <View
                                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[180px] rounded-full bg-ember/95 px-3 py-1">
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            className="text-center font-bodySemi text-[10px] leading-none text-white"
                                        >
                                            Profil actif
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    }}
                />
            </View>
        </TVScreen>
    );
}
