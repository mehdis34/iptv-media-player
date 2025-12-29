import Ionicons from '@expo/vector-icons/Ionicons';
import {useRouter} from 'expo-router';
import {useState} from 'react';
import {Modal, Pressable, ScrollView, Text, View} from 'react-native';

import {helpSections, type HelpSection} from '@/lib/help-content';

export default function HelpScreen() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState<HelpSection | null>(null);

    const sections = helpSections;

    return (
        <View className="flex-1 bg-ink">
            <View className="px-6 pt-16 pb-6">
                <View className="flex-row items-center gap-3">
                    <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center">
                        <Ionicons name="chevron-back" size={22} color="#ffffff"/>
                    </Pressable>
                    <Text className="font-display text-3xl text-white">Aide</Text>
                </View>
            </View>
            <ScrollView className="flex-1" contentContainerStyle={{paddingBottom: 80}}>
                <View className="px-6">
                    <View className="flex-row flex-wrap gap-4">
                        {sections.map((section) => (
                            <Pressable
                                key={section.id}
                                onPress={() => setActiveSection(section)}
                                className="w-[47%] rounded-3xl bg-ash px-4 py-5"
                            >
                                <View className="items-center">
                                    <View className="h-14 w-14 items-center justify-center rounded-2xl">
                                        <Ionicons name={section.icon} size={26} color="#ffffff"/>
                                    </View>
                                    <Text className="mt-3 text-center font-bodySemi text-sm text-white">
                                        {section.title}
                                    </Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </ScrollView>
            <Modal
                transparent
                visible={!!activeSection}
                animationType="fade"
                onRequestClose={() => setActiveSection(null)}
            >
                <View className="flex-1 bg-black/70">
                    <Pressable className="flex-1" onPress={() => setActiveSection(null)} />
                    <View className="absolute bottom-0 left-0 right-0 rounded-t-[32px] bg-ash px-6 pb-16 pt-6">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                                    <Ionicons
                                        name={activeSection?.icon ?? 'help-circle-outline'}
                                        size={20}
                                        color="#ffffff"
                                    />
                                </View>
                                <Text className="font-bodySemi text-xl text-white">
                                    {activeSection?.title}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setActiveSection(null)}
                                className="h-10 w-10 items-center justify-center"
                            >
                                <Ionicons name="close" size={22} color="#ffffff"/>
                            </Pressable>
                        </View>
                        <View className="mt-4 gap-3">
                            {activeSection?.items.map((item, index) => (
                                <View key={`${activeSection.id}-${index}`} className="flex-row items-center gap-3">
                                    <View className="h-2 w-2 rounded-full bg-ember"/>
                                    <Text className="flex-1 font-body text-base text-white/80">
                                        {item}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
