import type {Dispatch, RefObject, SetStateAction} from 'react';
import {Animated, Pressable, ScrollView, Text, View} from 'react-native';

type TabLayout = { x: number; width: number; pad: number };

type UnderlineTab = {
    key: string;
    label: string;
};

type UnderlineTabsProps = {
    tabs: UnderlineTab[];
    activeKey: string;
    tabLayouts: Record<string, TabLayout>;
    setTabLayouts: Dispatch<SetStateAction<Record<string, TabLayout>>>;
    underlineX: Animated.Value;
    underlineWidth: Animated.Value;
    scrollRef: RefObject<ScrollView>;
    onTabPress: (key: string) => void;
};

export default function UnderlineTabs({
    tabs,
    activeKey,
    tabLayouts,
    setTabLayouts,
    underlineX,
    underlineWidth,
    scrollRef,
    onTabPress,
}: UnderlineTabsProps) {
    if (!tabs.length) return null;
    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{gap: 24, paddingRight: 24}}
        >
            <View className="relative flex-row gap-10">
                {tabs.map((tab) => (
                    <Pressable
                        key={tab.key}
                        onPress={() => {
                            onTabPress(tab.key);
                            const target = tabLayouts[tab.key];
                            if (target) {
                                scrollRef.current?.scrollTo({x: target.x, animated: true});
                            }
                        }}
                        onLayout={(event) => {
                            const {x, width} = event.nativeEvent.layout;
                            setTabLayouts((prev) => ({
                                ...prev,
                                [tab.key]: {x, width, pad: 10},
                            }));
                        }}
                        className="pb-3"
                    >
                        <Text
                            className={`pt-4 font-bodySemi text-xl ${
                                activeKey === tab.key ? 'text-white' : 'text-white/50'
                            }`}
                        >
                            {tab.label}
                        </Text>
                    </Pressable>
                ))}
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        height: 4,
                        borderRadius: 999,
                        backgroundColor: '#e50914',
                        transform: [{translateX: underlineX}],
                        width: underlineWidth,
                    }}
                />
            </View>
        </ScrollView>
    );
}
