import Ionicons from '@expo/vector-icons/Ionicons';
import {useState} from 'react';
import {Modal, ScrollView, Text, View} from 'react-native';
import TVFocusPressable from '@/components/tv/TVFocusPressable';
import {type HelpSection, helpSections} from '@/lib/help-content';
import TVScreenScrollView from "@/components/tv/TVScreenScrollView";

export default function TvHelpScreen() {
    const topPadding = 96;
    const [activeSection, setActiveSection] = useState<HelpSection | null>(null);

    return (
        <TVScreenScrollView>
            <View className="w-full max-w-3xl self-center px-12" style={{paddingTop: topPadding}}>
                <Text className="font-display text-4xl text-white">Aide</Text>
                <Text className="mt-2 font-body text-lg text-white/60">
                    Sélectionnez un thème pour afficher les explications.
                </Text>

                <View className="pt-8">
                    <View className="flex-col gap-4">
                        {helpSections.map((section) => (
                            <TVFocusPressable
                                key={section.id}
                                onPress={() => setActiveSection(section)}
                                className="w-full rounded-2xl bg-white/10 px-6 py-5"
                                focusedStyle={{
                                    transform: [{scale: 1.02}],
                                    backgroundColor: '#ed0341',
                                }}
                            >
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-4">
                                        <Ionicons name={section.icon} size={22} color="#ffffff"/>
                                        <Text className="font-bodySemi text-base text-white">{section.title}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={22} color="#ffffff"/>
                                </View>
                            </TVFocusPressable>
                        ))}
                    </View>
                </View>
            </View>
            <Modal
                transparent
                visible={!!activeSection}
                animationType="fade"
                onRequestClose={() => setActiveSection(null)}
            >
                <View className="flex-1 bg-ash">
                    <View className="flex-1 w-full max-w-3xl self-center px-12 pt-10 pb-10">
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                                <Ionicons
                                    name={activeSection?.icon ?? 'help-circle-outline'}
                                    size={26}
                                    color="#ffffff"
                                />
                                <Text className="font-bodySemi text-2xl text-white">
                                    {activeSection?.title ?? ''}
                                </Text>
                            </View>
                            <TVFocusPressable
                                onPress={() => setActiveSection(null)}
                                hasTVPreferredFocus
                                className="h-12 w-12 items-center justify-center rounded-full border-2 border-transparent bg-white/10"
                                focusedClassName="bg-white/20"
                                style={{borderWidth: 2, borderColor: 'transparent'}}
                                focusedStyle={{
                                    transform: [{scale: 1.05}],
                                    borderWidth: 2,
                                    borderColor: '#ffffff',
                                    shadowColor: '#ffffff',
                                    shadowOpacity: 0.35,
                                    shadowRadius: 8,
                                    shadowOffset: {width: 0, height: 0},
                                }}
                            >
                                <Ionicons name="close" size={22} color="#ffffff"/>
                            </TVFocusPressable>
                        </View>
                        <ScrollView
                            className="mt-12"
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{paddingBottom: 60}}
                        >
                            <View className="gap-4">
                                {activeSection?.items.map((item, index) => (
                                    <View key={`${activeSection.id}-${index}`} className="flex-row gap-3">
                                        <View className="mt-2 h-2 w-2 rounded-full bg-white/70"/>
                                        <Text className="flex-1 font-body text-lg text-white/80">{item}</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </TVScreenScrollView>
    );
}
