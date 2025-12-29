import {type Href, Redirect} from 'expo-router';
import {useEffect, useState} from 'react';

import {getActiveProfileId, getCredentials, getProfiles, setActiveProfileId,} from '@/lib/storage';
import {Platform} from "react-native";

export default function Index() {
    const [target, setTarget] = useState<Href | null>(null);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const profiles = await getProfiles();
                if (!mounted) return;
                if (profiles.length > 1) {
                    setTarget('/profiles');
                    return;
                }
                if (profiles.length === 1) {
                    const activeId = await getActiveProfileId();
                    if (!activeId || activeId !== profiles[0].id) {
                        await setActiveProfileId(profiles[0].id);
                    }
                    if (mounted) setTarget(Platform.isTV ? '/(tv)' : '/(tabs)' as Href);
                    return;
                }
                const creds = await getCredentials();
                if (mounted) {
                    setTarget((creds ? (Platform.isTV ? '/(tv)' : '/(tabs)') : '/login') as Href);
                }
            } catch {
                if (mounted) setTarget('/login');
            }
        }

        load();

        return () => {
            mounted = false;
        };
    }, []);

    if (!target) return null;

    return <Redirect href={target}/>;
}
