import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, View} from 'react-native';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';

import TVScreen from '@/components/tv/TVScreen';
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {getActiveProfileId, getProfiles, removeProfile, updateProfile} from '@/lib/storage';
import type {XtreamProfile} from '@/lib/types';
import {type EditProfileFormValues, editProfileSchema} from '@/schemas/edit-profile.schema';

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

export default function TvProfileEditScreen() {
    const router = useRouter();
    const [activeProfile, setActiveProfile] = useState<XtreamProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const avatarScrollRef = useRef<ScrollView>(null);

    const focusBaseStyle = {borderWidth: 2, borderColor: 'transparent'};
    const focusRingStyle = {
        transform: [{scale: 1.04}],
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#ffffff',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 0},
    };
    const focusFillStyle = {
        transform: [{scale: 1.03}],
        borderWidth: 2,
        borderColor: '#ffffff',
        shadowColor: '#ffffff',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 0},
    };

    const {
        control,
        handleSubmit,
        formState: {errors, isSubmitting},
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

    const loadProfile = useCallback(async () => {
        setLoading(true);
        const [list, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
        const active = list.find((profile) => profile.id === activeId) ?? list[0] ?? null;
        if (!active) {
            router.replace('/login');
            return;
        }
        setActiveProfile(active);
        reset({
            profileName: active.profileName,
            avatarSeed: getAvatarSeedFromUrl(active.profileAvatarUrl),
            host: active.host,
            username: active.username,
            password: active.password,
        });
        setLoading(false);
    }, [reset, router]);

    useEffect(() => {
        void loadProfile();
    }, [loadProfile]);

    useEffect(() => {
        if (!avatarSeed) return;
        const index = AVATAR_SEEDS.indexOf(avatarSeed);
        if (index < 0) return;
        const itemSize = 96;
        const gap = 20;
        const x = Math.max(0, index * (itemSize + gap) - 120);
        setTimeout(() => {
            avatarScrollRef.current?.scrollTo({x, animated: true});
        }, 0);
    }, [avatarSeed]);

    const handleSaveProfile = handleSubmit(async (values) => {
        if (!activeProfile) return;
        await updateProfile(activeProfile.id, {
            profileName: values.profileName.trim(),
            profileAvatarUrl: buildAvatarUrl(values.avatarSeed),
            host: values.host.trim(),
            username: values.username.trim(),
            password: values.password,
        });
        router.back();
    });

    const handleDeleteProfile = useCallback(() => {
        if (!activeProfile || isDeleting) return;
        Alert.alert(
            'Supprimer ce profil ?',
            "Ce profil sera retiré de l'application et vous devrez le recréer pour l'utiliser à nouveau.",
            [
                {text: 'Annuler', style: 'cancel'},
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        await removeProfile(activeProfile.id);
                        const remaining = await getProfiles();
                        setIsDeleting(false);
                        if (!remaining.length) {
                            router.replace('/(tv)/profiles');
                            return;
                        }
                        router.back();
                    },
                },
            ]
        );
    }, [activeProfile, isDeleting, router]);

    return (
        <TVScreen>
            {loading ? (
                <View className="flex-1 items-center justify-center pt-12">
                    <ActivityIndicator size="large" color="#ffffff"/>
                </View>
            ) : (
                <View className="flex-1 pt-12">
                    <Text className="mb-4 font-bodySemi text-xl text-white text-center">Modifier le profil</Text>
                    <ScrollView
                        className="flex-1 w-full max-w-3xl self-center px-12"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{paddingBottom: 220, paddingHorizontal: 6}}
                    >
                        <View>
                            <View className="mb-6">
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    Avatar
                                </Text>
                                <ScrollView
                                    ref={avatarScrollRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                >
                                    <View className="flex-row gap-5 px-2 py-2">
                                        {AVATAR_SEEDS.map((seed) => {
                                            const isSelected = seed === avatarSeed;
                                            return (
                                                <TVFocusPressable
                                                    key={seed}
                                                    onPress={() => setValue('avatarSeed', seed, {shouldValidate: true})}
                                                    className={`h-24 w-24 overflow-hidden rounded-3xl border-2 ${
                                                        isSelected ? 'border-ember' : 'border-white/10'
                                                    }`}
                                                    style={focusBaseStyle}
                                                    focusedStyle={focusRingStyle}
                                                >
                                                    <Image
                                                        source={{uri: buildAvatarUrl(seed)}}
                                                        className="h-full w-full"
                                                    />
                                                </TVFocusPressable>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                            </View>

                            <View className="mb-4">
                                <Text className="mb-2 font-body text-base text-[#9ca3af]">
                                    Nom du profil
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
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
                                                    lineHeight: 22,
                                                    paddingVertical: 0,
                                                    paddingTop: 0,
                                                    paddingBottom: 0,
                                                }}
                                            />
                                        )}
                                    />
                                </View>
                                {errors.profileName?.message ? (
                                    <Text className="mt-2 font-body text-sm text-[#ff4d5a]">
                                        {errors.profileName.message}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="mb-4">
                                <Text className="mb-2 font-body text-base text-[#9ca3af]">
                                    URL du serveur Xtream
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
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
                                                    lineHeight: 22,
                                                    paddingVertical: 0,
                                                    paddingTop: 0,
                                                    paddingBottom: 0,
                                                }}
                                            />
                                        )}
                                    />
                                </View>
                                {errors.host?.message ? (
                                    <Text className="mt-2 font-body text-sm text-[#ff4d5a]">
                                        {errors.host.message}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="mb-4">
                                <Text className="mb-2 font-body text-base text-[#9ca3af]">
                                    Identifiant
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
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
                                                    lineHeight: 22,
                                                    paddingVertical: 0,
                                                    paddingTop: 0,
                                                    paddingBottom: 0,
                                                }}
                                            />
                                        )}
                                    />
                                </View>
                                {errors.username?.message ? (
                                    <Text className="mt-2 font-body text-sm text-[#ff4d5a]">
                                        {errors.username.message}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="mb-8">
                                <Text className="mb-2 font-body text-base text-[#9ca3af]">
                                    Mot de passe
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
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
                                                autoCapitalize="none"
                                                secureTextEntry={!showPassword}
                                                className="flex-1 font-body text-base text-white p-0 placeholder:text-white/70"
                                                textAlignVertical="center"
                                                style={{
                                                    height: '100%',
                                                    lineHeight: 22,
                                                    paddingVertical: 0,
                                                    paddingTop: 0,
                                                    paddingBottom: 0,
                                                }}
                                            />
                                        )}
                                    />
                                    <TVFocusPressable
                                        onPress={() => setShowPassword((prev) => !prev)}
                                        className="h-12 w-12 items-center justify-center"
                                        style={focusBaseStyle}
                                        focusedStyle={focusFillStyle}
                                    >
                                        <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#ffffff"/>
                                    </TVFocusPressable>
                                </View>
                                {errors.password?.message ? (
                                    <Text className="mt-2 font-body text-sm text-[#ff4d5a]">
                                        {errors.password.message}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="gap-4 pb-10">
                                <TVFocusPressable
                                    onPress={handleSaveProfile}
                                    className="rounded-2xl bg-white/10 py-4"
                                    style={focusBaseStyle}
                                    focusedStyle={{
                                        transform: [{scale: 1.02}],
                                        backgroundColor: '#ed0341',
                                    }}
                                >
                                    <Text className="text-center font-bodySemi text-base text-white">
                                        {isSubmitting ? 'Enregistrement…' : 'Enregistrer'}
                                    </Text>
                                </TVFocusPressable>
                                <TVFocusPressable
                                    onPress={handleDeleteProfile}
                                    className="rounded-2xl bg-white/10 py-4"
                                    style={focusBaseStyle}
                                    focusedStyle={{
                                        transform: [{scale: 1.02}],
                                        backgroundColor: '#ed0341',
                                    }}
                                >
                                    <Text className="text-center font-bodySemi text-base text-white">
                                        {isDeleting ? 'Suppression…' : 'Supprimer le profil'}
                                    </Text>
                                </TVFocusPressable>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            )}
        </TVScreen>
    );
}
