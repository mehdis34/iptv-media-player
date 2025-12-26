import {Stack} from 'expo-router';

export default function IndexLayout() {
    return <Stack initialRouteName="home" screenOptions={{headerShown: false}}/>;
}
