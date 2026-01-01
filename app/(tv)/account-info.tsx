import {useFocusEffect} from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';

import TVScreen from '@/components/tv/TVScreen';
import {getCredentials} from '@/lib/storage';
import {fetchAccountInfo} from '@/lib/xtream';
import type {XtreamAccountInfo} from '@/lib/types';
import TVScreenScrollView from '@/components/tv/TVScreenScrollView';

const formatUnixDate = (value?: string | number) => {
    if (!value) return '—';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '—';
    const ms = numeric < 2_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const formatValue = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return '—';
    return String(value);
};

export default function TvAccountInfoScreen() {
    const topPadding = 96;
    const [info, setInfo] = useState<XtreamAccountInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileName, setProfileName] = useState('');
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('');

    useFocusEffect(
        useCallback(() => {
            let active = true;
            const load = async () => {
                try {
                    setLoading(true);
                    setError('');
                    const creds = await getCredentials();
                    if (!creds) {
                        if (active) {
                            setError('Informations indisponibles.');
                        }
                        return;
                    }
                    if (!active) return;
                    setProfileName(creds.profileName);
                    setHost(creds.host);
                    setUsername(creds.username);
                    const data = await fetchAccountInfo(creds);
                    if (!active) return;
                    setInfo(data);
                } catch (err) {
                    if (active) {
                        setError(
                            err instanceof Error ? err.message : 'Informations indisponibles.'
                        );
                    }
                } finally {
                    if (active) setLoading(false);
                }
            };
            void load();
            return () => {
                active = false;
            };
        }, [])
    );

    const status = info?.user_info?.status;
    const isTrial = info?.user_info?.is_trial;
    const allowedFormats = useMemo(() => {
        const formats = info?.user_info?.allowed_output_formats ?? [];
        return Array.isArray(formats) ? formats.join(', ') : '—';
    }, [info]);

    if (loading) {
        return (
            <TVScreen>
                <View
                    className="flex-1 items-center justify-center"
                    style={{paddingTop: topPadding, paddingBottom: topPadding}}
                >
                    <ActivityIndicator size="large" color="#ffffff"/>
                </View>
            </TVScreen>
        );
    }

    if (error) {
        return (
            <TVScreen>
                <View
                    className="flex-1 items-center justify-center px-6"
                    style={{paddingTop: topPadding, paddingBottom: topPadding}}
                >
                    <Text className="font-body text-ember">{error}</Text>
                </View>
            </TVScreen>
        );
    }

    return (
        <TVScreenScrollView
            className="flex-1 w-full max-w-3xl self-center"
            contentContainerStyle={{paddingBottom: 80, paddingTop: topPadding}}
            showsVerticalScrollIndicator={false}
        >
            <View className="px-12">
                <Text className="mb-4 font-bodySemi text-xl text-white text-center">Informations du compte</Text>
                <AccountSection title="Profil actif" icon="person-circle-outline">
                    <InfoRow label="Profil" value={profileName || '—'}/>
                    <InfoRow label="Hôte" value={host || '—'}/>
                    <InfoRow label="Identifiant" value={username || '—'}/>
                </AccountSection>
            </View>

            <View className="mt-6 px-12">
                <AccountSection title="Abonnement" icon="card-outline">
                    <InfoRow label="Statut" value={status ?? '—'}/>
                    <InfoRow label="Expiration" value={formatUnixDate(info?.user_info?.exp_date)}/>
                    <InfoRow label="Essai" value={isTrial ? 'Oui' : 'Non'}/>
                    <InfoRow label="Connexions actives" value={formatValue(info?.user_info?.active_cons)}/>
                    <InfoRow label="Connexions max" value={formatValue(info?.user_info?.max_connections)}/>
                </AccountSection>
            </View>

            <View className="mt-6 px-12">
                <AccountSection title="Serveur" icon="server-outline">
                    <InfoRow label="URL" value={formatValue(info?.server_info?.url)}/>
                    <InfoRow label="Port" value={formatValue(info?.server_info?.port)}/>
                    <InfoRow label="HTTPS" value={formatValue(info?.server_info?.https_port)}/>
                    <InfoRow label="Protocole" value={formatValue(info?.server_info?.server_protocol)}/>
                    <InfoRow label="Fuseau horaire" value={formatValue(info?.server_info?.timezone)}/>
                    <InfoRow label="Heure serveur" value={formatValue(info?.server_info?.time_now)}/>
                    <InfoRow label="Créé le" value={formatUnixDate(info?.user_info?.created_at)}/>
                </AccountSection>
            </View>

            <View className="mt-6 px-12">
                <AccountSection title="Formats autorisés" icon="options-outline">
                    {allowedFormats ? (
                        <View className="mt-2 flex-row flex-wrap gap-2">
                            {allowedFormats
                                .split(',')
                                .map((format) => format.trim())
                                .filter(Boolean)
                                .map((format) => (
                                    <View
                                        key={format}
                                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5"
                                    >
                                        <Text className="font-bodySemi text-xs text-white">
                                            {format.toUpperCase()}
                                        </Text>
                                    </View>
                                ))}
                        </View>
                    ) : (
                        <Text className="mt-1 font-body text-base text-white">—</Text>
                    )}
                </AccountSection>
            </View>
        </TVScreenScrollView>
    );
}

function InfoRow({label, value}: { label: string; value: string }) {
    return (
        <View className="flex-row items-center justify-between gap-4">
            <Text className="font-body text-sm text-white/60">{label}</Text>
            <Text className="font-bodySemi text-sm text-white" numberOfLines={1}>
                {value}
            </Text>
        </View>
    );
}

function AccountSection({
                            title,
                            icon,
                            children,
                        }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    children: React.ReactNode;
}) {
    return (
        <View className="rounded-3xl bg-ash px-5 py-5">
            <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <Ionicons name={icon} size={18} color="#ffffff"/>
                </View>
                <Text className="font-bodySemi text-lg text-white tracking-[0.4px]">{title}</Text>
            </View>
            <View className="mt-4 gap-2">{children}</View>
        </View>
    );
}
