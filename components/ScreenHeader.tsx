import Ionicons from '@expo/vector-icons/Ionicons';
import {Pressable, Text, View} from 'react-native';

type ScreenHeaderProps = {
    title: string;
    onBack?: () => void;
};

export default function ScreenHeader({title, onBack}: ScreenHeaderProps) {
    return (
        <View className="px-6 pt-12 pb-4">
            <View className="flex-row items-center">
                {onBack ? (
                    <Pressable onPress={onBack} className="h-10 w-10 items-center justify-center">
                        <Ionicons name="chevron-back" size={24} color="#ffffff"/>
                    </Pressable>
                ) : (
                    <View className="h-10 w-10"/>
                )}
                <Text className="flex-1 text-center font-bodySemi text-lg text-white">
                    {title}
                </Text>
                <View className="h-10 w-10"/>
            </View>
        </View>
    );
}
