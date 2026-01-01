import {Animated, Easing, Pressable, StyleSheet, Text, View} from 'react-native';
import {Href, usePathname, useRouter} from 'expo-router';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Ionicons} from '@expo/vector-icons';

import {useTvNavScroll} from '@/components/tv/TVNavScrollContext';

type NavItem = {
    label?: string;
    href: string;
    icon?: keyof typeof Ionicons.glyphMap;
};

const NAV_ITEMS: NavItem[] = [
    {href: '/(tv)/search', icon: 'search-outline'},
    {label: 'Accueil', href: '/(tv)'},
    {label: 'Films', href: '/(tv)/movies'},
    {label: 'Séries', href: '/(tv)/series'},
    {label: 'Chaînes TV', href: '/(tv)/tv'},
    {label: 'Mon compte', href: '/(tv)/account'},
];

function TVNavItem({
    item,
    isCurrent,
    preferred,
    onFocus,
    onBlur,
    onPress,
}: {
    item: NavItem;
    isCurrent: boolean;
    preferred: boolean;
    onFocus: () => void;
    onBlur: () => void;
    onPress: () => void;
}) {
    const anim = useRef(new Animated.Value(isCurrent ? 1 : 0)).current;
    const [hasFocus, setHasFocus] = useState(false);
    const isHighlighted = isCurrent || hasFocus;

    const handleFocus = useCallback(() => {
        setHasFocus(true);
        onFocus();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
        setHasFocus(false);
        onBlur();
    }, [onBlur]);

    useEffect(() => {
        Animated.timing(anim, {
            toValue: isHighlighted ? 1 : 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [anim, isHighlighted]);

    const scale = anim.interpolate({inputRange: [0, 1], outputRange: [1, 1.04]});
    const overlayStyle = {
        opacity: anim,
        transform: [{scale}],
    };

    const baseClasses = 'relative rounded-full px-6 py-3 overflow-hidden';
    const textClasses = isHighlighted ? 'text-black' : 'text-white/70';
    const isIconOnly = !item.label;

    return (
        <Animated.View style={{transform: [{scale}]}}>
            <Pressable
                focusable
                hasTVPreferredFocus={preferred}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onPress={onPress}
                className={`${baseClasses} flex-row items-center gap-3 ${isIconOnly ? 'justify-center' : ''}`}
            >
                <Animated.View pointerEvents="none" style={[styles.overlay, overlayStyle, styles.overlayPill]} />
                {item.icon ? (
                    <Ionicons name={item.icon} size={22} color={isHighlighted ? '#000000' : '#ffffff'} />
                ) : null}
                {item.label ? (
                    <Text className={`font-bodySemi text-lg ${textClasses}`}>{item.label}</Text>
                ) : null}
            </Pressable>
        </Animated.View>
    );
}

export default function TVTopNav() {
    const router = useRouter();
    const pathname = usePathname();
    const {isScrolled} = useTvNavScroll();
    const [focused, setFocused] = useState<string | null>(null);
    const activeHref = useMemo(() => {
        const normalizedPath = pathname.replace(/^\/\(tv\)/, '');
        if (
            normalizedPath.startsWith('/help') ||
            normalizedPath.startsWith('/account-info') ||
            normalizedPath.startsWith('/profile-edit')
        ) {
            return '/(tv)/account';
        }
        const match = NAV_ITEMS.find((item) => {
            const normalizedHref = item.href.replace(/^\/\(tv\)/, '');
            if (!normalizedHref || normalizedHref === '/') {
                return normalizedPath === '' || normalizedPath === '/';
            }
            return normalizedPath.startsWith(normalizedHref);
        });
        return match?.href ?? '/(tv)';
    }, [pathname]);

    return (
        <View className="relative">
            {isScrolled ? (
                <View className="absolute inset-0 bg-black" pointerEvents="none"/>
            ) : null}
            <View className="flex-row items-center justify-center gap-4 px-10 pt-8 pb-6">
                {NAV_ITEMS.map((item) => {
                    const isActive = activeHref === item.href;
                    const isFocused = focused === item.href;
                    const isCurrent = focused ? isFocused : isActive;
                    return (
                        <TVNavItem
                            key={item.href}
                            item={item}
                            isCurrent={isCurrent}
                            preferred={isActive}
                            onFocus={() => {
                                setFocused(item.href);
                                if (activeHref !== item.href) {
                                    router.replace(item.href as Href);
                                }
                            }}
                            onBlur={() => setFocused(null)}
                            onPress={() => {
                                setFocused(item.href);
                            }}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff',
    },
    overlayPill: {
        borderRadius: 999,
    },
});
