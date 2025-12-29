import TVScreen from '@/components/tv/TVScreen';
import {Text, View} from 'react-native';

export default function TvHomeScreen() {
    return (
        <TVScreen>
            <View className="px-10 pt-2">
                <Text className="font-display text-4xl text-white">Accueil</Text>
                <Text className="mt-3 font-body text-lg text-white/70">
                    Interface TV en cours d’adaptation. Les écrans Films, Séries, TV, Recherche et Ma liste sont
                    accessibles depuis le menu.
                </Text>
            </View>
        </TVScreen>
    );
}
