import {StatusBar} from 'expo-status-bar';
import {Href, useLocalSearchParams, useRouter} from 'expo-router';
import {useEffect, useMemo, useState} from 'react';
import {Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {FontAwesome6} from '@expo/vector-icons';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import Color from 'color';
import ImageColors from 'react-native-image-colors';
import coverImage from '../assets/images/cinema-cover.webp';

import {saveCredentials} from '@/lib/storage';
import {validateCredentials} from '@/lib/xtream';
import {type LoginFormValues, loginSchema} from '@/schemas/login.schema';
import {buildAvatarUrl} from "@/lib/avatar";
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import TVScreenScrollView from '@/components/tv/TVScreenScrollView';

const AVATAR_SEEDS = ['atlas', 'ember', 'nova', 'luna', 'drift', 'hex'];
const PROFILE_NAMES = ['Mehdi', 'Salon', 'Guest', 'Kids', 'Cinema', 'Voyage'];
const COVER_SOURCE = coverImage;
const FALLBACK_COLOR = '#0b0b0f';

export default function LoginScreen() {
    const router = useRouter();
    const {next} = useLocalSearchParams<{next?: string}>();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [dominantColor, setDominantColor] = useState(FALLBACK_COLOR);
    const {
        control,
        handleSubmit,
        setError,
        formState: {errors},
        setValue,
        watch,
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            profileName: '',
            avatarSeed: AVATAR_SEEDS[0],
            host: '',
            username: '',
            password: '',
        },
    });
    const selectedSeed = watch('avatarSeed');

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
                    key: 'login-cover',
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

    const fillDemo = () => {
        const randomSeed = AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)];
        const randomName =
            PROFILE_NAMES[Math.floor(Math.random() * PROFILE_NAMES.length)];
        setValue('profileName', randomName, {shouldValidate: true});
        setValue('avatarSeed', randomSeed, {shouldValidate: true});
        setValue('host', 'http://tvchallenge.tn:7040', {shouldValidate: true});
        setValue('username', 'mehdi30', {shouldValidate: true});
        setValue('password', '8xEW5uunD4d2', {shouldValidate: true});
    };

    const onSubmit = handleSubmit(async (values) => {
        setLoading(true);
        try {
            const creds = {
                host: values.host,
                username: values.username,
                password: values.password,
                profileName: values.profileName,
                profileAvatarUrl: buildAvatarUrl(values.avatarSeed),
            };
            await validateCredentials(creds);
            await saveCredentials(creds);
            router.replace(((next as any) ?? Platform.isTV ? '/(tv)' : '/(tabs)') as Href);
        } catch (err) {
            setError('root', {
                message: err instanceof Error ? err.message : 'Connexion impossible.',
            });
        } finally {
            setLoading(false);
        }
    });

    if (Platform.isTV) {
        const focusBaseStyle = {borderWidth: 2};
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
        const eyeBaseStyle = {borderWidth: 0};
        const eyeFocusStyle = {...focusFillStyle, borderRadius: 9999};

        return (
            <View className="flex-1 bg-ink">
                <StatusBar style="light"/>

                <Image
                    source={COVER_SOURCE}
                    className="absolute inset-0 h-full w-full opacity-20"
                    resizeMode="cover"
                />
                <LinearGradient colors={gradientColors} locations={[0, 0.55, 1]} className="absolute inset-0"/>
                <LinearGradient
                    colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.88)']}
                    locations={[0.25, 1]}
                    className="absolute inset-0"
                />

                <TVScreenScrollView>
                    <View className="flex-1 pt-12">
                        <Text className="mb-6 font-bodySemi text-2xl text-white text-center">
                            Ajouter un profil
                        </Text>
                        <View className="w-full max-w-4xl self-center px-12">
                            <View className="mb-6">
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    Nom du profil
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
                                    <Controller
                                        control={control}
                                        name="profileName"
                                        render={({field: {onChange, value, onBlur}}) => (
                                            <TextInput
                                                className="flex-1 p-0 font-body text-base text-white"
                                                placeholder="Ex : Salon, Mehdi, Enfants..."
                                                placeholderTextColor="#6b7280"
                                                autoCapitalize="words"
                                                textAlignVertical="center"
                                                value={value}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
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

                            <View className="mb-8">
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    Choisissez un avatar
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View className="flex-row gap-5 px-2 py-2">
                                        {AVATAR_SEEDS.map((seed) => {
                                            const isSelected = seed === selectedSeed;
                                            return (
                                                <TVFocusPressable
                                                    key={seed}
                                                    onPress={() =>
                                                        setValue('avatarSeed', seed, {shouldValidate: true})
                                                    }
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
                                {errors.avatarSeed?.message ? (
                                    <Text className="mt-2 font-body text-sm text-[#ff4d5a]">
                                        {errors.avatarSeed.message}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="mb-5">
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    URL du serveur Xtream
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
                                    <Controller
                                        control={control}
                                        name="host"
                                        render={({field: {onChange, value, onBlur}}) => (
                                            <TextInput
                                                className="flex-1 p-0 font-body text-base text-white"
                                                placeholder="https://example.com:8080"
                                                placeholderTextColor="#6b7280"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                textAlignVertical="center"
                                                value={value}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
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

                            <View className="mb-5">
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    Identifiant
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
                                    <Controller
                                        control={control}
                                        name="username"
                                        render={({field: {onChange, value, onBlur}}) => (
                                            <TextInput
                                                className="flex-1 p-0 font-body text-base text-white"
                                                placeholder="Identifiant"
                                                placeholderTextColor="#6b7280"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                textAlignVertical="center"
                                                value={value}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
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
                                <Text className="mb-3 font-body text-base text-[#9ca3af]">
                                    Mot de passe
                                </Text>
                                <View className="h-14 flex-row items-center rounded-2xl bg-white/10 px-4">
                                    <Controller
                                        control={control}
                                        name="password"
                                        render={({field: {onChange, value, onBlur}}) => (
                                            <TextInput
                                                className="flex-1 p-0 font-body text-base text-white"
                                                placeholder="Mot de passe"
                                                placeholderTextColor="#6b7280"
                                                secureTextEntry={!showPassword}
                                                textAlignVertical="center"
                                                value={value}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
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
                                        className="h-12 w-12 items-center justify-center rounded-full"
                                        style={eyeBaseStyle}
                                        focusedStyle={eyeFocusStyle}
                                    >
                                        <FontAwesome6
                                            name={showPassword ? 'eye-slash' : 'eye'}
                                            size={18}
                                            color="#ffffff"
                                        />
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
                                    onPress={onSubmit}
                                    className="rounded-2xl bg-white/10 py-4"
                                    style={focusBaseStyle}
                                    focusedStyle={{
                                        transform: [{scale: 1.02}],
                                        backgroundColor: '#ed0341',
                                    }}
                                    disabled={loading}
                                >
                                    <Text className="text-center font-bodySemi text-base text-white">
                                        {loading ? 'Connexion...' : 'Se connecter'}
                                    </Text>
                                </TVFocusPressable>

                                <TVFocusPressable
                                    onPress={fillDemo}
                                    className="rounded-2xl border border-white/10 bg-white/5 py-4"
                                    style={focusBaseStyle}
                                    focusedStyle={focusFillStyle}
                                >
                                    <Text className="text-center font-body text-sm text-white">
                                        Remplir avec un profil aléatoire
                                    </Text>
                                </TVFocusPressable>

                                {errors.root?.message ? (
                                    <Text className="text-center font-body text-sm text-ember">
                                        {errors.root.message}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </View>
                </TVScreenScrollView>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-ink">
            <StatusBar style="light"/>

            <Image
                source={COVER_SOURCE}
                className="absolute inset-0 h-full w-full opacity-20"
                resizeMode="cover"
            />
            <LinearGradient colors={gradientColors} locations={[0, 0.55, 1]} className="absolute inset-0"/>
            <LinearGradient
                colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.88)']}
                locations={[0.25, 1]}
                className="absolute inset-0"
            />

            <ScrollView
                className="flex-1"
                contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40}}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View className="mb-4 rounded-3xl bg-ash p-5 shadow-lg shadow-black/60">
                    <View className="mb-4">
                        <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                            Nom du profil
                        </Text>
                        <View className="h-12 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                            <Controller
                                control={control}
                                name="profileName"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="flex-1 p-0 font-body text-base text-white"
                                        placeholder="Ex : Salon, Mehdi, Enfants..."
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="words"
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                            Avatar
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View className="flex-row gap-3">
                                {AVATAR_SEEDS.map((seed) => {
                                    const isSelected = seed === selectedSeed;
                                    return (
                                        <Pressable
                                            key={seed}
                                            onPress={() => setValue('avatarSeed', seed, {shouldValidate: true})}
                                            className={`h-14 w-14 overflow-hidden rounded-full border-2 ${
                                                isSelected ? 'border-ember' : 'border-white/10'
                                            }`}>
                                            <Image
                                                source={{uri: buildAvatarUrl(seed)}}
                                                className="h-full w-full"
                                            />
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                        {errors.avatarSeed?.message ? (
                            <Text className="mt-2 font-body text-xs text-[#ff4d5a]">
                                {errors.avatarSeed.message}
                            </Text>
                        ) : null}
                    </View>

                    <View className="mb-4">
                        <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                            Hôte
                        </Text>
                        <View className="h-12 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                            <Controller
                                control={control}
                                name="host"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="flex-1 p-0 font-body text-base text-white"
                                        placeholder="https://example.com:8080"
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                        <View className="h-12 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                            <Controller
                                control={control}
                                name="username"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="flex-1 p-0 font-body text-base text-white"
                                        placeholder="Identifiant"
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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

                    <View>
                        <Text className="mb-2 font-body text-sm text-[#9ca3af]">
                            Mot de passe
                        </Text>
                        <View className="h-12 flex-row items-center gap-2 rounded-2xl bg-white/10 px-4">
                            <Controller
                                control={control}
                                name="password"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="flex-1 p-0 font-body text-base text-white"
                                        placeholder="Mot de passe"
                                        placeholderTextColor="#6b7280"
                                        secureTextEntry={!showPassword}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                                <FontAwesome6
                                    name={showPassword ? 'eye-slash' : 'eye'}
                                    size={16}
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

                <Pressable
                    onPress={fillDemo}
                    className="mb-4 rounded-full border border-ash bg-ash/50 px-4 py-3">
                    <Text className="text-center font-body text-sm text-white">
                        Remplir avec un profil aleatoire
                    </Text>
                </Pressable>

                {errors.root?.message ? (
                    <Text className="mb-3 font-body text-sm text-ember">
                        {errors.root.message}
                    </Text>
                ) : null}

                <Pressable
                    onPress={onSubmit}
                    disabled={loading}
                    className={`overflow-hidden rounded-full ${
                        loading ? 'opacity-60' : ''
                    }`}
                    style={({pressed}) => (pressed ? {opacity: 0.9} : undefined)}>
                    <LinearGradient
                        colors={['#e50914', '#c60e19']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 1}}
                        className="items-center py-4">
                        <Text className="font-bodySemi text-base text-white">
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </Text>
                    </LinearGradient>
                </Pressable>

                <Text className="mt-5 text-center font-body text-xs text-[#9ca3af]">
                    En ajoutant votre profil, vous acceptez les{' '}
                    <Text className="underline" onPress={() => router.push('/terms')}>
                        Conditions générales d'utilisation
                    </Text>
                    , la{' '}
                    <Text className="underline" onPress={() => router.push('/privacy')}>
                        Politique de confidentialité
                    </Text>{' '}
                    et les{' '}
                    <Text className="underline" onPress={() => router.push('/legal')}>
                        Mentions légales
                    </Text>
                    .
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
