import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {ScrollView, Pressable, Text, View} from 'react-native';

export default function LegalScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink">
      <View className="px-6 pt-16 pb-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>
          <Text className="font-display text-3xl text-white">Mentions légales</Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 80}}>
        <View className="px-6">
          <Text className="font-body text-base leading-7 text-white/90">
            Cette application est un lecteur IPTV qui se connecte à votre fournisseur.
            Aucun contenu n’est hébergé ou distribué par l’application.
          </Text>
          <Text className="mt-4 font-body text-base leading-7 text-white/90">
            Pour toute demande légale ou de support, contactez directement votre fournisseur
            de service. Les droits d’auteur et licences des contenus diffusés relèvent de
            ce dernier.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
