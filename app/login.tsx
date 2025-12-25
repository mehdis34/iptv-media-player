import {StatusBar} from 'expo-status-bar';
import {useLocalSearchParams, useRouter} from 'expo-router';
import {useState} from 'react';
import {Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {FontAwesome6} from '@expo/vector-icons';
import {Controller, useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';

import {saveCredentials} from '@/lib/storage';
import {validateCredentials} from '@/lib/xtream';
import {type LoginFormValues, loginSchema} from '@/schemas/login.schema';

const AVATAR_SEEDS = ['atlas', 'ember', 'nova', 'luna', 'drift', 'hex'];
const PROFILE_NAMES = ['Mehdi', 'Salon', 'Guest', 'Kids', 'Cinema', 'Voyage'];

function buildAvatarUrl(seed: string) {
    const encoded = encodeURIComponent(seed.trim());
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${encoded}&backgroundColor=0b0b0f`;
}

export default function LoginScreen() {
    const router = useRouter();
    const {next} = useLocalSearchParams<{next?: string}>();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
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

    const fillDemo = () => {
        const randomSeed = AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)];
        const randomName =
            PROFILE_NAMES[Math.floor(Math.random() * PROFILE_NAMES.length)];
        setValue('profileName', randomName, {shouldValidate: true});
        setValue('avatarSeed', randomSeed, {shouldValidate: true});
        setValue('host', 'http://tvchallenge.tn:7040', {shouldValidate: true});
        setValue('username', 'mehdi30', {shouldValidate: true});
        setValue('password', '2QabubLAD2yQ', {shouldValidate: true});
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
            router.replace((next as any) ?? '/(tabs)');
        } catch (err) {
            setError('root', {
                message: err instanceof Error ? err.message : 'Connexion impossible.',
            });
        } finally {
            setLoading(false);
        }
    });

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            className="flex-1 bg-ink">
            <StatusBar style="light"/>

            <View className="flex-1 justify-center px-6 py-10">
                <View className="mb-4 rounded-3xl border border-white/10 bg-[#0c0c10]/90 p-5 shadow-lg shadow-black/60">
                    <View className="mb-4">
                        <Text className="mb-2 font-body text-xs tracking-[2.2px] text-[#9ca3af]">
                            NOM DE PROFIL
                        </Text>
                        <View
                            className="h-12 flex-row items-center rounded-2xl border border-white/10 bg-black/80 px-4">
                            <FontAwesome6 name="user" size={16} color="#a7a7b3"/>
                            <Controller
                                control={control}
                                name="profileName"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="ml-3 flex-1 py-0 font-body text-base leading-none text-white"
                                        placeholder="Ex: Salon, Mehdi, Enfants..."
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="words"
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                        <Text className="mb-2 font-body text-xs tracking-[2.2px] text-[#9ca3af]">
                            AVATAR
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
                        <Text className="mb-2 font-body text-xs tracking-[2.2px] text-[#9ca3af]">
                            HOTE
                        </Text>
                        <View
                            className="h-12 flex flex-row items-center rounded-2xl border border-white/10 bg-black/80 px-4">
                            <FontAwesome6 name="globe" size={16} color="#a7a7b3"/>
                            <Controller
                                control={control}
                                name="host"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="ml-3 flex-1 py-0 font-body text-base leading-none text-white"
                                        placeholder="https://example.com:8080"
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                        <Text className="mb-2 font-body text-xs tracking-[2.2px] text-[#9ca3af]">
                            USERNAME
                        </Text>
                        <View
                            className="h-12 flex-row items-center rounded-2xl border border-white/10 bg-black/80 px-4">
                            <FontAwesome6 name="user-astronaut" size={16} color="#a7a7b3"/>
                            <Controller
                                control={control}
                                name="username"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="ml-3 flex-1 py-0 font-body text-base leading-none text-white"
                                        placeholder="Identifiant"
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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
                        <Text className="mb-2 font-body text-xs tracking-[2.2px] text-[#9ca3af]">
                            PASSWORD
                        </Text>
                        <View
                            className="h-12 flex-row items-center rounded-2xl border border-white/10 bg-black/80 px-4">
                            <FontAwesome6 name="key" size={16} color="#a7a7b3"/>
                            <Controller
                                control={control}
                                name="password"
                                render={({field: {onChange, value, onBlur}}) => (
                                    <TextInput
                                        className="ml-3 flex-1 py-0 font-body text-base leading-none text-white"
                                        placeholder="Mot de passe"
                                        placeholderTextColor="#6b7280"
                                        secureTextEntry={!showPassword}
                                        textAlignVertical="center"
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
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

                <View className="mt-4 flex-row items-center justify-between">
                    <Text className="font-body text-xs text-[#9ca3af]">
                        Connexion securisee
                    </Text>
                    <Text className="font-body text-xs text-[#9ca3af]">Support 24/7</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
