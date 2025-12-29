import TVScreen from '@/components/tv/TVScreen';
import {Text, View} from 'react-native';

export default function TvSearchScreen() {
    return (
        <TVScreen>
            <View className="px-10 pt-2">
                <Text className="font-display text-4xl text-white">Recherche</Text>
                <Text className="mt-3 font-body text-lg text-white/70">
                    Vue TV en préparation.
                </Text>
            </View>
        </TVScreen>
    );
}
