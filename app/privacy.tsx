import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {ScrollView, Pressable, Text, View} from 'react-native';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink">
      <View className="px-6 pt-16 pb-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>
          <Text className="font-display text-3xl text-white">Politique de confidentialité</Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 80}}>
        <View className="px-6">
          <Text className="font-body text-base leading-7 text-white/90">
            Vos informations de connexion sont stockées localement sur votre appareil afin
            de vous permettre de vous reconnecter facilement. Elles ne sont pas partagées
            avec des tiers et ne sont utilisées que pour établir la connexion aux services
            de votre fournisseur IPTV.
          </Text>
          <Text className="mt-4 font-body text-base leading-7 text-white/90">
            Les données d’usage (favoris, reprise de lecture, profils) restent également
            sur votre appareil. Vous pouvez supprimer ces données en vous déconnectant ou
            en supprimant un profil.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
