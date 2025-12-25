import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeTabs, VectorIcon, Icon, Label } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
    return (
        <NativeTabs
            backgroundColor="#0b0b0f"
            shadowColor="#1b1b24"
            iconColor={{ default: '#a7a7b3', selected: '#e50914' }}
            labelStyle={{ default: { color: '#a7a7b3' }, selected: { color: '#e50914' } }}
        >
            <NativeTabs.Trigger name="index">
                <Icon src={<VectorIcon family={Ionicons} name="home" />} />
                <Label hidden />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="search">
                <Icon src={<VectorIcon family={Ionicons} name="search" />} />
                <Label hidden />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="library">
                <Icon src={<VectorIcon family={Ionicons} name="heart" />} />
                <Label hidden />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="account">
                <Icon src={<VectorIcon family={Ionicons} name="person" />} />
                <Label hidden />
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
