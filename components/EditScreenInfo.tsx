import React from 'react';
import { Text, View } from 'react-native';

import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';

export default function EditScreenInfo({ path }: { path: string }) {
  return (
    <View>
      <View className="items-center px-6">
        <Text className="text-center font-body text-base text-mist">
          Open up the code for this screen:
        </Text>

        <View className="my-2 rounded bg-white/5 px-2 py-1">
          <MonoText className="text-white">{path}</MonoText>
        </View>

        <Text className="text-center font-body text-base text-mist">
          Change any of the text, save the file, and your app will automatically update.
        </Text>
      </View>

      <View className="mt-4 items-center px-6">
        <ExternalLink href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet">
          <Text className="text-center font-body text-sm text-[#2e78b7]">
            Tap here if your app doesn't automatically update after making changes
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}
