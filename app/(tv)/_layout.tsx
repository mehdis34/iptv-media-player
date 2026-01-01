import {Stack} from 'expo-router';
import {View} from 'react-native';

import {TVNavScrollProvider} from '@/components/tv/TVNavScrollContext';
import TVTopNav from '@/components/tv/TVTopNav';

export default function TvLayout() {
    return (
        <TVNavScrollProvider>
            <View className="flex-1 h-full bg-black">
                <Stack
                    screenOptions={{headerShown: false, gestureEnabled: false, orientation: 'landscape'}}
                />
                <View className="absolute left-0 right-0 top-0 z-20">
                    <TVTopNav/>
                </View>
            </View>
        </TVNavScrollProvider>
    );
}
