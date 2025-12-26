import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { Image, Pressable, View } from 'react-native';

type TrailerCardProps = {
  url: string;
  thumbnail?: string;
};

export default function TrailerCard({ url, thumbnail }: TrailerCardProps) {
  return (
    <Pressable
      onPress={() => WebBrowser.openBrowserAsync(url)}
      className="overflow-hidden rounded-2xl border border-white/10 bg-black"
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} className="h-64 w-full" resizeMode="cover" />
      ) : (
        <LinearGradient colors={['#1b1b24', '#0b0b0f']} className="h-64 w-full" />
      )}
      <View className="absolute inset-0 items-center justify-center">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-black/60">
          <Ionicons name="play" size={24} color="#ffffff" />
        </View>
      </View>
    </Pressable>
  );
}
