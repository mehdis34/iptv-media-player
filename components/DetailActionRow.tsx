import Ionicons from '@expo/vector-icons/Ionicons';
import {Pressable, Text, View} from 'react-native';

type DetailActionRowProps = {
    playLabel: string;
    onPlay: () => void;
    onToggleFavorite: () => void;
    isFavorite: boolean;
    favoriteLabel?: string;
};

export default function DetailActionRow({
    playLabel,
    onPlay,
    onToggleFavorite,
    isFavorite,
    favoriteLabel = 'Ma liste',
}: DetailActionRowProps) {
    return (
        <View className="mt-5 flex-row items-center gap-3">
            <Pressable
                onPress={onPlay}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-white py-3"
            >
                <Ionicons name="play" size={18} color="#111111"/>
                <Text className="font-bodySemi text-sm text-black">{playLabel}</Text>
            </Pressable>
            <Pressable
                onPress={onToggleFavorite}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-3"
            >
                <Ionicons name={isFavorite ? 'checkmark' : 'add'} size={18} color="#ffffff"/>
                <Text className="font-bodySemi text-sm text-white">{favoriteLabel}</Text>
            </Pressable>
        </View>
    );
}
