import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { safeImageUri } from '@/lib/media';

type MediaCardProps = {
  title: string;
  image?: string;
  size?: 'poster' | 'compact' | 'grid';
  onPress?: () => void;
  progress?: number;
};

export default function MediaCard({
  title,
  image,
  size = 'poster',
  onPress,
  progress,
}: MediaCardProps) {
  const safeImage = safeImageUri(image);
  const [hasError, setHasError] = useState(false);
  const widthClass =
    size === 'grid' ? 'w-1/3 px-1.5' : size === 'compact' ? 'w-28' : 'w-44';
  const clampedProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : 0;

  useEffect(() => {
    setHasError(false);
  }, [safeImage]);

  return (
    <View className={widthClass}>
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        className="relative overflow-hidden rounded-xl border border-ash bg-ash/70"
      >
        {safeImage && !hasError ? (
          <Image
            source={{ uri: safeImage }}
            className="w-full aspect-[9/16]"
            resizeMode="cover"
            onError={() => setHasError(true)}
          />
        ) : (
          <View className="w-full aspect-[9/16] items-center justify-center bg-slate px-2">
            <Text className="text-center font-bodySemi text-sm text-white" numberOfLines={3}>
              {title}
            </Text>
          </View>
        )}
        {clampedProgress > 0 ? (
          <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
            <View
              className="h-full bg-ember"
              style={{ width: `${clampedProgress * 100}%` }}
            />
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
