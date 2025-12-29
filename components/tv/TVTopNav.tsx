import {Animated, Easing, Pressable, StyleSheet, Text, View} from 'react-native';
import {usePathname, useRouter} from 'expo-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Ionicons} from '@expo/vector-icons';

type NavItem = {
    label: string;
    href: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
    {label: 'Recherche', href: '/(tv)/search', icon: 'search-outline', iconOnly: true},
    {label: 'Films', href: '/(tv)/movies'},
    {label: 'Séries', href: '/(tv)/series'},
    {label: 'Chaînes TV', href: '/(tv)/tv'},
    {label: 'Mon compte', href: '/(tv)/account'},
];

function TVNavItem({
    item,
    isActive,
    isCurrent,
    preferred,
    onFocus,
    onBlur,
    onPress,
}: {
    item: NavItem;
    isActive: boolean;
    isCurrent: boolean;
    preferred: boolean;
    onFocus: () => void;
    onBlur: () => void;
    onPress: () => void;
}) {
    const anim = useRef(new Animated.Value(isCurrent ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: isCurrent ? 1 : 0,
            duration: 160,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [anim, isCurrent]);

    const scale = anim.interpolate({inputRange: [0, 1], outputRange: [1, 1.04]});
    const overlayStyle = {
        opacity: anim,
        transform: [{scale}],
    };

    const baseClasses = 'relative rounded-full px-6 py-3 overflow-hidden';
    const textClasses = isCurrent ? 'text-black' : 'text-white/70';

    return (
        <Animated.View style={{transform: [{scale}]}}>
            <Pressable
                focusable
                hasTVPreferredFocus={preferred}
                onFocus={onFocus}
                onBlur={onBlur}
                onPress={onPress}
                className={`${baseClasses} ${item.iconOnly ? 'h-12 w-12 px-0 items-center justify-center' : ''}`}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.overlay,
                        overlayStyle,
                        item.iconOnly ? styles.overlayCircle : styles.overlayPill,
                    ]}
                />
                {item.iconOnly ? (
                    <Ionicons
                        name={item.icon}
                        size={24}
                        color={isCurrent ? '#000000' : '#ffffff'}
                    />
                ) : (
                    <Text className={`font-bodySemi text-lg ${textClasses}`}>{item.label}</Text>
                )}
            </Pressable>
        </Animated.View>
    );
}

export default function TVTopNav() {
    const router = useRouter();
    const pathname = usePathname();
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
            return normalizedPath.startsWith(normalizedHref);
        });
        return match?.href ?? '/(tv)/movies';
    }, [pathname]);

    return (
        <View className="flex-row items-center justify-center gap-4 px-10 pt-8 pb-6">
            {NAV_ITEMS.map((item, index) => {
                const isActive = activeHref === item.href;
                const isFocused = focused === item.href;
                const isCurrent = focused ? isFocused : isActive;
                return (
                    <TVNavItem
                        key={item.href}
                        item={item}
                        isActive={isActive}
                        isCurrent={isCurrent}
                        preferred={isActive}
                        onFocus={() => {
                            setFocused(item.href);
                        }}
                        onBlur={() => setFocused(null)}
                        onPress={() => {
                            setFocused(item.href);
                            if (activeHref !== item.href) {
                                router.replace(item.href);
                            }
                        }}
                    />
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff',
    },
    overlayCircle: {
        borderRadius: 999,
    },
    overlayPill: {
        borderRadius: 999,
    },
});
