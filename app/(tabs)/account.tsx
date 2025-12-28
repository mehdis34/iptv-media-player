import Ionicons from '@expo/vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import {Href, useRouter} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';

import {
    clearCredentials,
    getActiveProfileId,
    getProfiles,
    removeProfile,
    setActiveProfileId,
    updateProfile,
} from '@/lib/storage';
import {fetchAccountInfo} from '@/lib/xtream';
import {clearCatalogCacheEntries} from '@/lib/catalog-cache';
import {clearEpgCache} from '@/lib/epg-cache';
import type {XtreamProfile} from '@/lib/types';
import {type EditProfileFormValues, editProfileSchema,} from '@/schemas/edit-profile.schema';

const AVATAR_SEEDS = ['atlas', 'ember', 'nova', 'luna', 'drift', 'hex'];

function buildAvatarUrl(seed: string) {
    const encoded = encodeURIComponent(seed.trim());
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${encoded}&backgroundColor=0b0b0f`;
}

function getAvatarSeedFromUrl(url?: string) {
    if (!url) return AVATAR_SEEDS[0];
    const match = url.match(/seed=([^&]+)/i);
    if (!match?.[1]) return AVATAR_SEEDS[0];
    return decodeURIComponent(match[1]);
}

export default function AccountScreen() {
    const router = useRouter();
    const [profiles, setProfiles] = useState<XtreamProfile[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [accountExpiry, setAccountExpiry] = useState<string>('');
    const [manageMode, setManageMode] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
    const avatarScrollRef = useRef<ScrollView>(null);
    const {
        control,
        handleSubmit,
        formState: {errors},
        reset,
        setValue,
        watch,
    } = useForm<EditProfileFormValues>({
        resolver: zodResolver(editProfileSchema),
        defaultValues: {
            profileName: '',
            avatarSeed: AVATAR_SEEDS[0],
            host: '',
            username: '',
            password: '',
        },
    });
    const avatarSeed = watch('avatarSeed');

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

    const handleSwitch = async (profileId: string) => {
        await setActiveProfileId(profileId);
        setActiveId(profileId);
    };

    const handleDelete = (profileId: string) => {
        Alert.alert('Supprimer ce profil ?', 'Cette action est définitive.', [
            {text: 'Annuler', style: 'cancel'},
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                    const next = await removeProfile(profileId);
                    if (!next.length) {
                        router.replace('/login');
                        return;
                    }
                    await loadProfiles();
                },
            },
        ]);
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
                            router.navigate('/(tabs)' as Href);
                        }
                    },
                },
            ]
        );
    };

    const openEditModal = () => {
        if (!activeProfile) return;
        reset({
            profileName: activeProfile.profileName,
            avatarSeed: getAvatarSeedFromUrl(activeProfile.profileAvatarUrl),
            host: activeProfile.host,
            username: activeProfile.username,
            password: activeProfile.password,
        });
        setShowEditModal(true);
    };

    useEffect(() => {
        if (!showEditModal) return;
        const index = AVATAR_SEEDS.indexOf(avatarSeed);
        if (index < 0) return;
        const itemSize = 80;
        const gap = 16;
        const x = Math.max(0, index * (itemSize + gap) - 32);
        setTimeout(() => {
            avatarScrollRef.current?.scrollTo({x, animated: true});
        }, 0);
    }, [avatarSeed, showEditModal]);

    const handleSaveProfile = handleSubmit(async (values) => {
        if (!activeProfile) return;
        const next = await updateProfile(activeProfile.id, {
            profileName: values.profileName.trim(),
            profileAvatarUrl: buildAvatarUrl(values.avatarSeed),
            host: values.host.trim(),
            username: values.username.trim(),
            password: values.password,
        });
        setProfiles(next);
        setShowEditModal(false);
    });

    const menuItems = useMemo(
        () => [
            {key: 'account', label: 'Mon compte', icon: 'person-outline'},
            {key: 'refresh', label: 'Rafraîchir la playlist', icon: 'refresh-outline'},
            {key: 'help', label: 'Aide', icon: 'help-circle-outline'},
        ],
        []
    );

    return (
        <View className="flex-1 bg-ink">
            <View className="px-6 pt-16 pb-6">
                <Text className="font-display text-3xl text-white">Mon compte</Text>
            </View>
            <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 60}}>
                <View className="px-6">
                    <View className="rounded-[32px] bg-ash px-6 py-6">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                                <Image
                                    source={{uri: activeProfile?.profileAvatarUrl}}
                                    className="h-16 w-16 rounded-2xl"
                                />
                                <View>
                                    <Text className="font-bodySemi text-xl text-white">
                                        {activeProfile?.profileName ?? 'Profil'}
                                    </Text>
                                    <Text className="mt-1 font-body text-xs text-white/50">
                                        Expire le {accountExpiry || '—'}
                                    </Text>
                                </View>
                            </View>
                            <Pressable
                                onPress={openEditModal}
                                className="h-9 w-9 items-center justify-center rounded-full bg-white/10"
                            >
                                <Ionicons name="pencil" size={16} color="#ffffff"/>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <View className="mt-6">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{paddingHorizontal: 24, gap: 18, paddingTop: 8, paddingBottom: 8}}
                    >
                        {profiles.map((profile) => {
                            const isActive = profile.id === activeId;
                            return (
                                <Pressable
                                    key={profile.id}
                                    onPress={() => handleSwitch(profile.id)}
                                    className="items-center overflow-visible"
                                >
                                    <View className="relative">
                                        <Image
                                            source={{uri: profile.profileAvatarUrl}}
                                            className={`h-20 w-20 rounded-2xl ${
                                                isActive ? 'border border-ember' : ''
                                            }`}
                                        />
                                        {manageMode ? (
                                            <Pressable
                                                onPress={() => handleDelete(profile.id)}
                                                className="absolute -right-2 -top-2 h-8 w-8 items-center justify-center rounded-full bg-ember"
                                            >
                                                <Ionicons name="close" size={14} color="#ffffff"/>
                                            </Pressable>
                                        ) : null}
                                    </View>
                                    <Text className="mt-2 font-body text-xs text-white/70" numberOfLines={1}>
                                        {profile.profileName}
                                    </Text>
                                </Pressable>
                            );
                        })}

                        <Pressable
                            onPress={() =>
                                router.push({
                                    pathname: '/login',
                                    params: {next: '/(tabs)/account'},
                                })
                            }
                            className="items-center"
                        >
                            <View className="h-20 w-20 items-center justify-center rounded-2xl bg-white/10">
                                <Ionicons name="add" size={24} color="#ffffff"/>
                            </View>
                            <Text className="mt-2 text-center font-body text-xs text-white/60">
                                Ajouter un profil
                            </Text>
                        </Pressable>
                    </ScrollView>
                </View>

                <View className="mt-6 px-6">
                    <Pressable
                        onPress={() => setManageMode((prev) => !prev)}
                        className="self-start rounded-full bg-white/10 px-6 py-3"
                    >
                        <Text className="font-bodySemi text-xs text-white">
                            {manageMode ? 'Terminer' : 'Gérer les profils'}
                        </Text>
                    </Pressable>
                </View>

                <View className="mt-8 px-6">
                    <View className="rounded-3xl border border-white/10 bg-white/5 px-2 py-2">
                        {menuItems.map((item) => {
                            return (
                                <Pressable
                                    key={item.key}
                                    disabled={item.key === 'refresh' && isRefreshingCatalog}
                                    onPress={() => {
                                        if (item.key === 'account') {
                                            router.push('/account-info');
                                        } else if (item.key === 'refresh') {
                                            handleRefreshCatalog();
                                        } else if (item.key === 'help') {
                                            router.push('/help');
                                        }
                                    }}
                                    className="flex-row items-center justify-between rounded-2xl border-b border-white/10 px-3 py-3"
                                >
                                    <View className="flex-row items-center gap-3">
                                        <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                                            {item.key === 'refresh' && isRefreshingCatalog ? (
                                                <ActivityIndicator size="small" color="#ffffff"/>
                                            ) : (
                                                <Ionicons name={item.icon as any} size={16} color="#ffffff"/>
                                            )}
                                        </View>
                                        <Text className="font-bodySemi text-sm text-white">{item.label}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color="#ffffff"/>
                                </Pressable>
                            );
                        })}
                        <Pressable
                            onPress={handleLogout}
                            className="flex-row items-center justify-between rounded-2xl px-3 py-3"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                                    <Ionicons name="log-out-outline" size={16} color="#ff4d5a"/>
                                </View>
                                <Text className="font-bodySemi text-sm text-white">Se déconnecter</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color="#ffffff"/>
                        </Pressable>
                    </View>
                </View>

                <Modal
                    transparent
                    visible={showEditModal}
                    animationType="fade"
                    onRequestClose={() => setShowEditModal(false)}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        className="flex-1 bg-ink"
                    >
                        <View className="px-6 pt-16 pb-6">
                            <View className="flex-row items-center justify-between">
                                <Text className="font-bodySemi text-2xl text-white">Modifier le profil</Text>
                                <Pressable
                                    onPress={() => setShowEditModal(false)}
                                    className="h-12 w-12 items-center justify-center"
                                >
                                    <Ionicons name="close" size={26} color="#ffffff"/>
                                </Pressable>
                            </View>
                        </View>
                        <ScrollView className="flex-1"
                                    contentContainerStyle={{paddingHorizontal: 24, paddingBottom: 170}}>
                            <View>
                                <View className="mb-6">
                                    <Text className="mb-3 font-body text-sm text-[#9ca3af]">
                                        Avatar
                                    </Text>
                                    <ScrollView
                                        ref={avatarScrollRef}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                    >
                                        <View className="flex-row gap-4">
                                            {AVATAR_SEEDS.map((seed) => {
                                                const isSelected = seed === avatarSeed;
                                                return (
                                                    <Pressable
                                                        key={seed}
                                                        onPress={() => setValue('avatarSeed', seed, {shouldValidate: true})}
                                                        className={`h-20 w-20 overflow-hidden rounded-2xl border-2 ${
                                                            isSelected ? 'border-ember' : 'border-white/10'
                                                        }`}
                                                    >
                                                        <Image
                                                            source={{uri: buildAvatarUrl(seed)}}
                                                            className="h-full w-full"
                                                        />
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    </ScrollView>
                                </View>

                                <View className="mb-4">
                                    <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                                        Nom
                                    </Text>
                                    <View className="h-12 flex-row items-center rounded-2xl bg-white/10 px-4">
                                        <Controller
                                            control={control}
                                            name="profileName"
                                            render={({field: {onChange, value, onBlur}}) => (
                                                <TextInput
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    placeholder="Nom du profil"
                                                    placeholderTextColor="#6b7280"
                                                    className="flex-1 font-body text-base text-white p-0 placeholder:text-white/70"
                                                    textAlignVertical="center"
                                                    style={{
                                                        height: '100%',
                                                        lineHeight: 20,
                                                        paddingVertical: 0,
                                                        paddingTop: 0,
                                                        paddingBottom: 0,
                                                    }}
                                                />
                                            )}
                                        />
                                    </View>
                                    {errors.profileName?.message ? (
                                        <Text className="mt-2 font-body text-xs text-[#ff4d5a]">
                                            {errors.profileName.message}
                                        </Text>
                                    ) : null}
                                </View>

                                <View className="mb-4">
                                    <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                                        Hôte
                                    </Text>
                                    <View className="h-12 flex-row items-center rounded-2xl bg-white/10 px-4">
                                        <Controller
                                            control={control}
                                            name="host"
                                            render={({field: {onChange, value, onBlur}}) => (
                                                <TextInput
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    placeholder="https://example.com:8080"
                                                    placeholderTextColor="#6b7280"
                                                    autoCapitalize="none"
                                                    className="flex-1 font-body text-base text-white p-0 placeholder:text-white/70"
                                                    textAlignVertical="center"
                                                    style={{
                                                        height: '100%',
                                                        lineHeight: 20,
                                                        paddingVertical: 0,
                                                        paddingTop: 0,
                                                        paddingBottom: 0,
                                                    }}
                                                />
                                            )}
                                        />
                                    </View>
                                    {errors.host?.message ? (
                                        <Text className="mt-2 font-body text-xs text-[#ff4d5a]">
                                            {errors.host.message}
                                        </Text>
                                    ) : null}
                                </View>

                                <View className="mb-4">
                                    <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                                        Identifiant
                                    </Text>
                                    <View className="h-12 flex-row items-center rounded-2xl bg-white/10 px-4">
                                        <Controller
                                            control={control}
                                            name="username"
                                            render={({field: {onChange, value, onBlur}}) => (
                                                <TextInput
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    placeholder="Identifiant"
                                                    placeholderTextColor="#6b7280"
                                                    autoCapitalize="none"
                                                    className="flex-1 font-body text-base text-white p-0 placeholder:text-white/70"
                                                    textAlignVertical="center"
                                                    style={{
                                                        height: '100%',
                                                        lineHeight: 20,
                                                        paddingVertical: 0,
                                                        paddingTop: 0,
                                                        paddingBottom: 0,
                                                    }}
                                                />
                                            )}
                                        />
                                    </View>
                                    {errors.username?.message ? (
                                        <Text className="mt-2 font-body text-xs text-[#ff4d5a]">
                                            {errors.username.message}
                                        </Text>
                                    ) : null}
                                </View>

                                <View className="mb-5">
                                    <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                                        Mot de passe
                                    </Text>
                                    <View className="h-12 flex-row items-center rounded-2xl bg-white/10 px-4">
                                        <Controller
                                            control={control}
                                            name="password"
                                            render={({field: {onChange, value, onBlur}}) => (
                                                <TextInput
                                                    value={value}
                                                    onChangeText={onChange}
                                                    onBlur={onBlur}
                                                    placeholder="Mot de passe"
                                                    placeholderTextColor="#6b7280"
                                                    secureTextEntry={!showPassword}
                                                    className="flex-1 font-body text-base text-white p-0 placeholder:text-white/70"
                                                    textAlignVertical="center"
                                                    style={{
                                                        height: '100%',
                                                        lineHeight: 20,
                                                        paddingVertical: 0,
                                                        paddingTop: 0,
                                                        paddingBottom: 0,
                                                    }}
                                                />
                                            )}
                                        />
                                        <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                                            <Ionicons
                                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                                size={18}
                                                color="#a7a7b3"
                                            />
                                        </Pressable>
                                    </View>
                                    {errors.password?.message ? (
                                        <Text className="mt-2 font-body text-xs text-[#ff4d5a]">
                                            {errors.password.message}
                                        </Text>
                                    ) : null}
                                </View>

                            </View>
                        </ScrollView>
                        <View className="absolute bottom-8 left-6 right-6 gap-3">
                            <Pressable
                                onPress={handleSaveProfile}
                                className="w-full rounded-full bg-white py-4"
                            >
                                <Text className="text-center font-bodySemi text-base text-black">Enregistrer</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setShowEditModal(false)}
                                className="w-full rounded-full border border-white/15 py-4"
                            >
                                <Text className="text-center font-bodySemi text-base text-white">Annuler</Text>
                            </Pressable>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>
            </ScrollView>
        </View>
    );
}
