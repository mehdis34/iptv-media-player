import {Link} from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {Pressable, Text, View} from 'react-native';

type SectionHeaderProps = {
    title: string;
    href?: { type: 'tv' | 'movies' | 'series'; id: string; name?: string };
};

export default function SectionHeader({title, href}: SectionHeaderProps) {
    const baseHref = href ? `/category/${href.type}/${href.id}` : '';
    const url =
        href && href.name && href.name.trim()
            ? `${baseHref}?name=${encodeURIComponent(href.name)}`
            : baseHref;
    return (
        <View className="mb-3 flex-row items-center justify-between px-6">
            <Text
                className="max-w-[68%] font-bodySemi text-lg text-white tracking-[0.4px]"
                numberOfLines={2}>
                {title}
            </Text>
            {href ? (
                <Link href={url as any} asChild>
                    <Pressable className="flex-row items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2">
                        <Text className="font-bodySemi text-sm text-white">Tout voir</Text>
                        <Ionicons name="chevron-forward" size={14} color="#ffffff"/>
                    </Pressable>
                </Link>
            ) : (
                <View/>
            )}
        </View>
    );
}
