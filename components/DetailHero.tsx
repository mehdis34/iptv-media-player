import Ionicons from '@expo/vector-icons/Ionicons';
import {LinearGradient} from 'expo-linear-gradient';
import {Image, Pressable, View} from 'react-native';

type DetailHeroProps = {
    height: number;
    heroHeight: number;
    heroTone: string;
    coverUri?: string;
    onClose: () => void;
};

export default function DetailHero({
    height,
    heroHeight,
    heroTone,
    coverUri,
    onClose,
}: DetailHeroProps) {
    return (
        <>
            <LinearGradient
                colors={[heroTone, '#000000']}
                locations={[0, 1]}
                style={{position: 'absolute', top: 0, left: 0, right: 0, height}}
                pointerEvents="none"
            />
            <View style={{position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight}}>
                {coverUri ? (
                    <Image source={{uri: coverUri}} resizeMode="cover" style={{height: '100%'}}/>
                ) : (
                    <LinearGradient colors={['#1b1b24', '#0b0b0f']} style={{height: '100%'}}/>
                )}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.95)']}
                    locations={[0.4, 1]}
                    style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: heroHeight}}
                    pointerEvents="none"
                />
            </View>

            <View className="absolute right-6 top-12 z-10">
                <Pressable
                    onPress={onClose}
                    className="h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                >
                    <LinearGradient
                        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.25)']}
                        className="absolute inset-0"
                    />
                    <Ionicons name="close" size={24} color="#ffffff"/>
                </Pressable>
            </View>
        </>
    );
}
