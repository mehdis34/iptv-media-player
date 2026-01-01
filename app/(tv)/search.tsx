import {Text, View} from 'react-native';
import TVScreenScrollView from "@/components/tv/TVScreenScrollView";

export default function TvSearchScreen() {
    const topPadding = 96;
    return (
        <TVScreenScrollView>
            <View className="px-10" style={{paddingTop: topPadding}}>
                <Text className="font-display text-4xl text-white">Recherche</Text>
                <Text className="mt-3 font-body text-lg text-white/70">
                    Vue TV en préparation.
                </Text>
            </View>
        </TVScreenScrollView>
    );
}
