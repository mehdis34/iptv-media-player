import {Image, Text, View} from 'react-native';

type TvRowContentProps = {
    image?: string;
    tone?: string;
    name: string;
    title: string;
    subtitle?: string;
    metaLabel?: string;
    progress: number | null;
    logoClassName?: string;
    fallbackColor?: string;
    logoTextClassName?: string;
};

export default function TvRowContent({
    image,
    tone,
    name,
    title,
    subtitle,
    metaLabel,
    progress,
    logoClassName,
    fallbackColor,
    logoTextClassName,
}: TvRowContentProps) {
    const containerClassName =
        logoClassName ??
        'relative h-16 w-24 items-center justify-center overflow-hidden rounded-lg';
    const tvTextClassName = logoTextClassName ?? 'font-bodySemi text-xs text-white/70';
    const backgroundColor =
        image && tone ? tone : fallbackColor ?? 'rgba(255,255,255,0.06)';
    return (
        <View className="flex-row items-center gap-3">
            <View
                className={containerClassName}
                style={{
                    backgroundColor,
                }}
            >
                {image ? (
                    <Image source={{uri: image}} className="h-full w-full" resizeMode="contain" />
                ) : (
                    <Text className={tvTextClassName}>TV</Text>
                )}
                {progress !== null ? (
                    <View className="absolute bottom-1 left-1 right-1 h-1 overflow-hidden rounded-full bg-white/25">
                        <View
                            className="h-full rounded-full bg-ember"
                            style={{width: `${Math.round(progress * 100)}%`}}
                        />
                    </View>
                ) : null}
            </View>
            <View className="flex-1">
                <Text className="font-bodySemi text-xs text-white/70" numberOfLines={1}>
                    {name}
                </Text>
                <Text className="mt-1 font-bodySemi text-sm text-white" numberOfLines={2}>
                    {title}
                </Text>
                <Text className="mt-1 font-body text-xs text-white/60">
                    {subtitle ? subtitle : ''}
                    {metaLabel ? ` • ${metaLabel}` : ''}
                </Text>
            </View>
        </View>
    );
}
