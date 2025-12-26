import {Stack, useRouter, type Href} from 'expo-router';
import {LinearGradient} from 'expo-linear-gradient';
import {Image, Pressable, Text, View} from 'react-native';

import coverImage from '../assets/images/cinema-cover.webp';

export default function NotFoundScreen() {
    const router = useRouter()
  return (
    <>
      <Stack.Screen options={{title: 'Introuvable', headerShown: false}} />
      <View className="flex-1 bg-ink">
        <Image source={coverImage} className="absolute inset-0 h-full w-full opacity-20" resizeMode="cover" />
        <LinearGradient
          colors={['rgba(11,11,15,0.7)', 'rgba(11,11,15,0.3)', 'rgba(11,11,15,0.7)']}
          locations={[0, 0.5, 1]}
          className="absolute inset-0"
        />
        <View className="flex-1 items-center justify-center px-6">
          <View className="items-center px-10">
            <Text className="font-display text-[92px] text-white/90">404</Text>
            <Text className="mt-2 font-display text-4xl text-white">Oups...</Text>
            <Text className="mt-3 text-center font-body text-lg text-mist">
              Cette page n'existe pas. Revenez a l'accueil pour reprendre votre lecture.
            </Text>
            <View className="mt-8 w-full max-w-[260px]">
                <Pressable
                  className="items-center rounded-full bg-ember px-4 py-3"
                  onPress={() => router.replace('/home' as Href)}
                >
                  <Text className="font-bodySemi text-sm text-white">Revenir à l'accueil</Text>
                </Pressable>
            </View>
          </View>
        </View>
      </View>
    </>
  );
}
