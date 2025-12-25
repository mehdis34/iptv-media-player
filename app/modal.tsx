import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

import EditScreenInfo from '@/components/EditScreenInfo';
import { Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-ink">
      <Text className="font-bodySemi text-xl text-white">Modal</Text>
      <View className="my-8 h-px w-4/5 bg-ash/70" />
      <EditScreenInfo path="app/modal.tsx" />

      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}
