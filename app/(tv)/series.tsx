import {Text, View} from 'react-native';
import TVScreenScrollView from "@/components/tv/TVScreenScrollView";

export default function TvSeriesScreen() {
    return (
        <TVScreenScrollView>
            <View className="px-10 pt-2">
                <Text className="font-display text-4xl text-white">Séries</Text>
                <Text className="mt-3 font-body text-lg text-white/70">
                    Vue TV en préparation.
                </Text>
            </View>
        </TVScreenScrollView>
    );
}
