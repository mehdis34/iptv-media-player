import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, Image, GestureResponderEvent } from 'react-native';

import { safeImageUri } from '@/lib/media';

type FeaturedCardProps = {
  title: string;
  image?: string;
  badge: string;
  subtitle?: string;
  onPress?: () => void;
  onPlay?: () => void;
  playLabel?: string;
  progress?: number;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
};

export default function FeaturedCard({
  title,
  image,
  badge,
  subtitle,
  onPress,
  onPlay,
  playLabel = 'Lecture',
  progress,
  isFavorite = false,
  onToggleFavorite,
}: FeaturedCardProps) {
  const safeImage = safeImageUri(image);
  const clampedProgress =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(1, progress))
      : 0;
  const handlePlayPress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    onPlay?.();
  };
  const handleFavoritePress = (event: GestureResponderEvent) => {
    event.stopPropagation?.();
    onToggleFavorite?.();
  };

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-ash/60"
    >
      <View className="relative">
        {safeImage ? (
          <Image source={{ uri: safeImage }} className="h-[60vh] w-full" resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={['#1b1b24', '#0b0b0f']}
            className="h-[60vh] w-full"
          />
        )}
        <View className="absolute inset-0 bg-black/35" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          locations={[0.35, 1]}
          className="absolute inset-0"
        />
        <View className="absolute left-4 top-4">
          <Text className="font-display text-2xl text-ember">N</Text>
        </View>
        <View className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <Text
            className="text-center font-bodySemi text-lg uppercase tracking-[2px] text-white"
            numberOfLines={2}>
            {title}
          </Text>
          <Text className="mt-1 text-center font-body text-xs text-mist">
            {subtitle ?? `${badge} • Nouveauté`}
          </Text>
          <View className="mt-4 flex-row items-center gap-3">
            <Pressable
              onPress={handlePlayPress}
              disabled={!onPlay}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-2.5 ${
                onPlay ? 'bg-white' : 'bg-white/40'
              }`}
            >
              <Ionicons name="play" size={16} color="#111111" />
              <Text className="font-bodySemi text-sm text-black">{playLabel}</Text>
            </Pressable>
            <Pressable
              onPress={handleFavoritePress}
              disabled={!onToggleFavorite}
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 ${
                onToggleFavorite ? 'bg-white/10' : 'bg-white/5'
              }`}
            >
              <Ionicons
                name={isFavorite ? 'checkmark' : 'add'}
                size={18}
                color="#ffffff"
              />
              <Text className="font-bodySemi text-sm text-white">
                {isFavorite ? 'Dans ma liste' : 'Ma liste'}
              </Text>
            </Pressable>
          </View>
        </View>
        {clampedProgress > 0 ? (
          <View className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
            <View
              className="h-full bg-ember"
              style={{ width: `${clampedProgress * 100}%` }}
            />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
