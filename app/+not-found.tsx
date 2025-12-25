import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center bg-ink px-6">
        <Text className="font-bodySemi text-xl text-white">
          This screen doesn't exist.
        </Text>
        <View className="mt-4">
          <Link href="/">
            <Text className="font-body text-sm text-[#2e78b7]">
              Go to home screen!
            </Text>
          </Link>
        </View>
      </View>
    </>
  );
}
