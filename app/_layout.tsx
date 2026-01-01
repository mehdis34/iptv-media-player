import FontAwesome from '@expo/vector-icons/FontAwesome';
import {DarkTheme, ThemeProvider} from '@react-navigation/native';
import {useFonts} from 'expo-font';
import {Stack} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {useEffect} from 'react';
import 'react-native-reanimated';
import './global.css'
import '@/lib/nativewind';
import {Poppins_400Regular, Poppins_600SemiBold} from '@expo-google-fonts/poppins';
import {LogBox, Platform} from 'react-native';

export {
    ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync().then();
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
const originalWarn = console.warn;
console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('SafeAreaView has been deprecated')) {
        return;
    }
    originalWarn(...args);
};

export default function RootLayout() {
    const [loaded, error] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
        Poppins_400Regular,
        Poppins_600SemiBold,
        ...FontAwesome.font,
    });

    // Expo Router uses Error Boundaries to catch errors in the navigation tree.
    useEffect(() => {
        if (error) throw error;
    }, [error]);

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync().then();
        }
    }, [loaded]);


    if (!loaded) {
        return null;
    }

    return <RootLayoutNav/>;
}

function RootLayoutNav() {
    return (
        <ThemeProvider value={DarkTheme}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    gestureEnabled: true,
                    orientation: Platform.isTV ? 'landscape' : 'portrait',
                }}>
                <Stack.Screen name="(tabs)"/>
                <Stack.Screen name="(tv)"/>
                <Stack.Screen name="login"/>
                <Stack.Screen name="profiles"/>
                <Stack.Screen name="modal" options={{presentation: 'modal'}}/>
                <Stack.Screen name="movie/[id]" options={{presentation: 'modal'}}/>
                <Stack.Screen name="series/[id]" options={{presentation: 'modal'}}/>
                <Stack.Screen name="player/[id]" options={{orientation: 'landscape'}}/>
            </Stack>
        </ThemeProvider>
    );
}
