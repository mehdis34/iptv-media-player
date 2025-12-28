import Ionicons from '@expo/vector-icons/Ionicons';
import {usePathname} from 'expo-router';
import {useEffect, useState} from 'react';
import {Icon, Label, NativeTabs, VectorIcon} from 'expo-router/unstable-native-tabs';

import {getActiveProfileId, getProfiles} from '@/lib/storage';

export default function TabLayout() {
    const pathname = usePathname();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const loadAvatar = async () => {
            const [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
            if (!mounted) return;
            const active = profiles.find((profile) => profile.id === activeId) ?? profiles[0];
            setAvatarUrl(active?.profileAvatarUrl ?? null);
        };
        loadAvatar();
        return () => {
            mounted = false;
        };
    }, [pathname]);

    return (
        <NativeTabs
            backgroundColor="#0b0b0f"
            shadowColor="#1b1b24"
            iconColor={{default: '#a7a7b3', selected: '#e50914'}}
            labelStyle={{default: {color: '#a7a7b3'}, selected: {color: '#e50914'}}}
        >
            <NativeTabs.Trigger name="index">
                <Icon src={<VectorIcon family={Ionicons} name="home"/>}/>
                <Label hidden/>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="search">
                <Icon src={<VectorIcon family={Ionicons} name="search"/>}/>
                <Label hidden/>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="library">
                <Icon src={<VectorIcon family={Ionicons} name="heart"/>}/>
                <Label hidden/>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="account">
                <Icon src={<VectorIcon family={Ionicons} name="person"/>}/>
                <Label hidden/>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
