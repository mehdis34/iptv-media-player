import {Stack} from 'expo-router';

export default function IndexLayout() {
    return (
        <Stack initialRouteName="home" screenOptions={{headerShown: false}}>
            <Stack.Screen name="movies"/>
            <Stack.Screen name="series"/>
            <Stack.Screen name="tv"/>
        </Stack>
    );
}
