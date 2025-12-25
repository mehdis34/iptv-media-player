import { Pressable, Text, View, Image } from 'react-native';

import { safeImageUri } from '@/lib/media';
import type { XtreamStream } from '@/lib/types';

type ChannelCardProps = {
  stream: XtreamStream;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
};

export default function ChannelCard({
  stream,
  isFavorite,
  onPress,
  onToggleFavorite,
}: ChannelCardProps) {
  const image = safeImageUri(stream.stream_icon);

  return (
    <Pressable onPress={onPress} className="w-46">
      <View className="overflow-hidden rounded-2xl border border-ash bg-ash/70">
        {image ? (
          <Image source={{ uri: image }} className="h-24 w-full" resizeMode="cover" />
        ) : (
          <View className="h-24 w-full items-center justify-center bg-slate">
            <Text className="font-display text-xl text-white">LIVE</Text>
          </View>
        )}
        <View className="gap-2 p-3">
          <Text className="font-body text-sm text-white" numberOfLines={2}>
            {stream.name}
          </Text>
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
            className="self-start">
            <Text className="font-body text-xs text-ember">
              {isFavorite ? 'Retirer' : 'Favori'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
