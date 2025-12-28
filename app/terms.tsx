import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {ScrollView, Pressable, Text, View} from 'react-native';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-ink">
      <View className="px-6 pt-16 pb-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
            <Ionicons name="chevron-back" size={22} color="#ffffff" />
          </Pressable>
          <Text className="font-display text-3xl text-white">Conditions d'utilisation</Text>
        </View>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 80}}>
        <View className="px-6">
          <Text className="font-body text-base leading-7 text-white/90">
            En utilisant l’application, vous acceptez les présentes conditions générales
            d’utilisation. Vous êtes responsable des informations de connexion fournies par
            votre fournisseur IPTV et de leur exactitude. L’application ne fournit aucun
            contenu et ne stocke pas de médias : elle se connecte uniquement aux services
            dont vous disposez déjà.
          </Text>
          <Text className="mt-4 font-body text-base leading-7 text-white/90">
            Vous vous engagez à utiliser l’application conformément aux lois en vigueur et
            aux conditions de votre fournisseur. En cas de non‑respect, l’accès peut être
            suspendu ou restreint. Ces conditions peuvent évoluer pour améliorer le service.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
