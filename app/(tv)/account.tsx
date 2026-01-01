import Ionicons from '@expo/vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {Href, useRouter} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, Image, Text, View,} from 'react-native';
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {clearCredentials, getActiveProfileId, getProfiles, setActiveProfileId,} from '@/lib/storage';
import {fetchAccountInfo} from '@/lib/xtream';
import {clearCatalogCacheEntries} from '@/lib/catalog-cache';
import {clearEpgCache} from '@/lib/epg-cache';
import type {XtreamProfile} from '@/lib/types';
import TVScreenScrollView from "@/components/tv/TVScreenScrollView";

export default function TvAccountScreen() {
    const router = useRouter();
    const topPadding = 96;
    const [profiles, setProfiles] = useState<XtreamProfile[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [accountExpiry, setAccountExpiry] = useState<string>('');
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
    const pendingSwitchRef = useRef<string | null>(null);
    const focusRingClass = '';
    const focusBaseStyle = {borderWidth: 2};
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

    const activeProfile = useMemo(
        () => profiles.find((profile) => profile.id === activeId) ?? profiles[0],
        [activeId, profiles]
    );
    const orderedProfiles = useMemo(() => {
        if (!activeId) return profiles;
        return [...profiles].sort((a, b) => {
            if (a.id === activeId) return -1;
            if (b.id === activeId) return 1;
            return 0;
        });
    }, [activeId, profiles]);

    useEffect(() => {
        let mounted = true;
        const loadAccountInfo = async () => {
            if (!activeProfile) {
                if (mounted) setAccountExpiry('—');
                return;
            }
            try {
                const info = await fetchAccountInfo(activeProfile);
                if (!mounted) return;
                const raw = info?.user_info?.exp_date;
                if (!raw) {
                    setAccountExpiry('—');
                    return;
                }
                const numeric = Number(raw);
                const ms = Number.isFinite(numeric)
                    ? numeric < 2_000_000_000
                        ? numeric * 1000
                        : numeric
                    : NaN;
                if (!Number.isFinite(ms)) {
                    setAccountExpiry('—');
                    return;
                }
                const formatted = new Date(ms).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
                setAccountExpiry(formatted);
            } catch {
                if (mounted) setAccountExpiry('—');
            }
        };
        void loadAccountInfo();
        return () => {
            mounted = false;
        };
    }, [activeProfile]);

    useEffect(() => {
        if (pendingSwitchRef.current && activeId === pendingSwitchRef.current) {
            pendingSwitchRef.current = null;
            setTimeout(() => {
                router.replace('/(tv)/movies');
            }, 0);
        }
    }, [activeId, router]);

    const handleSwitch = async (profileId: string) => {
        if (profileId === activeId) {
            router.replace('/(tv)/movies');
            return
        }
        pendingSwitchRef.current = profileId;
        await setActiveProfileId(profileId);
        setActiveId(profileId);
    };

    const handleLogout = () => {
        Alert.alert(
            'Se déconnecter ?',
            'Cette action supprime tous les profils enregistrés et leurs réglages (playlist, favoris, reprises de lecture). Vous devrez vous reconnecter pour continuer.',
            [
                {text: 'Annuler', style: 'cancel'},
                {
                    text: 'Se déconnecter',
                    style: 'destructive',
                    onPress: async () => {
                        await clearCredentials();
                        router.replace('/login');
                    },
                },
            ]
        );
    };

    const handleRefreshCatalog = () => {
        if (isRefreshingCatalog) return;
        Alert.alert(
            'Rafraîchir la playlist ?',
            'Utilisez cette fonctionnalité pour rafraîchir votre catalogue de films, de séries, de chaînes TV ainsi que vos programmes TV.',
            [
                {text: 'Annuler', style: 'cancel'},
                {
                    text: 'Rafraîchir',
                    onPress: async () => {
                        setIsRefreshingCatalog(true);
                        try {
                            const profileId = activeId ?? (await getActiveProfileId());
                            if (!profileId) {
                                Alert.alert('Aucun profil actif', 'Sélectionnez un profil puis réessayez.');
                                return;
                            }
                            await Promise.all([clearCatalogCacheEntries(profileId), clearEpgCache(profileId)]);
                        } catch {
                            Alert.alert('Impossible de rafraîchir', 'Réessayez dans un instant.');
                        } finally {
                            setIsRefreshingCatalog(false);
                            router.navigate('/(tv)' as Href);
                        }
                    },
                },
            ]
        );
    };

    const menuItems = useMemo(
        () => [
            {key: 'account', label: 'Mon compte'},
            {key: 'refresh', label: 'Rafraîchir la playlist'},
            {key: 'help', label: 'Aide'},
        ],
        []
    );

    return (
        <TVScreenScrollView>
            <View className="w-full max-w-3xl self-center" style={{paddingTop: topPadding}}>
                <View className="px-12">
                    <Text className="mb-4 font-bodySemi text-xl text-white">Profils</Text>
                    <FlatList
                        data={[{id: 'add'}, ...orderedProfiles]}
                        keyExtractor={(item) => ('id' in item ? item.id : 'add')}
                        scrollEnabled={false}
                        horizontal={true}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{gap: 20, paddingBottom: 12, paddingHorizontal: 32, paddingTop: 6}}
                        style={{overflow: 'visible'}}
                        renderItem={({item}) => {
                            if ('id' in item && item.id === 'add') {
                                return (
                                    <View>
                                        <TVFocusPressable
                                            onPress={() =>
                                                router.push({
                                                    pathname: '/login',
                                                    params: {next: '/(tv)/account'},
                                                })
                                            }
                                            className="h-36 w-36 rounded-full flex items-center justify-center bg-ash"
                                            focusedClassName={focusRingClass}
                                            style={focusBaseStyle}
                                            focusedStyle={focusRingStyle}
                                        >
                                            <Ionicons name="add" size={56} color="#ffffff"/>
                                        </TVFocusPressable>
                                        <Text className="mt-4 text-center font-bodySemi text-lg text-white">
                                            Ajouter
                                        </Text>
                                    </View>
                                );
                            }
                            const profile = item as XtreamProfile;
                            const isActive = profile.id === activeId;
                            return (
                                <View className="items-center">
                                    <TVFocusPressable
                                        onPress={() => handleSwitch(profile.id)}
                                        className="h-36 w-36 rounded-full flex items-center justify-center bg-ash"
                                        focusedClassName={focusRingClass}
                                        style={[
                                            focusBaseStyle,
                                            {borderColor: isActive ? '#ed0341' : 'transparent'},
                                        ]}
                                        focusedStyle={focusRingStyle}
                                    >
                                        <Image
                                            source={{uri: profile.profileAvatarUrl}}
                                            className="h-full w-full rounded-full"
                                        />
                                    </TVFocusPressable>
                                    <Text className="mt-4 text-center font-bodySemi text-lg text-white">
                                        {profile.profileName}
                                    </Text>
                                </View>
                            );
                        }}
                    />
                    <TVFocusPressable
                        onPress={() => router.push('/(tv)/profiles')}
                        className="w-full rounded-2xl bg-white/10 px-6 py-5 mt-3"
                        focusedStyle={{
                            transform: [{scale: 1.02}],
                            backgroundColor: '#ed0341',
                        }}
                    >
                        <View className="flex-row items-center justify-between">
                            <Text className="font-bodySemi text-base text-white">Gérer les profils</Text>
                            <Ionicons name="chevron-forward" size={22} color="#ffffff"/>
                        </View>
                    </TVFocusPressable>
                </View>
                <View className="mt-12 px-12">
                    <Text className="mb-4 font-bodySemi text-xl text-white">Paramètres</Text>
                    <View className="flex-col gap-4">
                        {menuItems.map((item) => {
                            const isRefreshing = item.key === 'refresh' && isRefreshingCatalog;
                            return (
                                <TVFocusPressable
                                    key={item.key}
                                    disabled={isRefreshing}
                                    onPress={() => {
                                        if (item.key === 'account') {
                                            router.push('/(tv)/account-info');
                                        } else if (item.key === 'refresh') {
                                            handleRefreshCatalog();
                                        } else if (item.key === 'help') {
                                            router.push('/(tv)/help');
                                        }
                                    }}
                                    className="w-full rounded-2xl bg-white/10 px-6 py-5"
                                    focusedStyle={{
                                        transform: [{scale: 1.02}],
                                        backgroundColor: '#ed0341',
                                    }}
                                >
                                    <View className="flex-row items-center justify-between">
                                        <Text className="font-bodySemi text-base text-white">{item.label}</Text>
                                        {isRefreshing ? (
                                            <ActivityIndicator size="small" color="#ffffff"/>
                                        ) : (
                                            <Ionicons name="chevron-forward" size={22} color="#ffffff"/>
                                        )}
                                    </View>
                                </TVFocusPressable>
                            );
                        })}

                        <TVFocusPressable
                            onPress={handleLogout}
                            className="w-full rounded-2xl bg-white/10 px-6 py-5"
                            focusedStyle={{
                                transform: [{scale: 1.02}],
                                backgroundColor: '#ed0341',
                            }}
                        >
                            <View className="flex-row items-center justify-between">
                                <Text className="font-bodySemi text-base text-white">Se déconnecter</Text>
                                <Ionicons name="chevron-forward" size={22} color="#ffffff"/>
                            </View>
                        </TVFocusPressable>
                    </View>
                </View>
            </View>
        </TVScreenScrollView>
    );
}
