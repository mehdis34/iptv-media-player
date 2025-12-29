import {ReactNode} from 'react';
import {ScrollView, View} from 'react-native';
import TVTopNav from '@/components/tv/TVTopNav';

type TVScreenProps = {
    children: ReactNode;
};

export default function TVScreen({children}: TVScreenProps) {
    return (
        <View className="flex-1 bg-black">
            <TVTopNav/>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{paddingBottom: 80}}
            >
                {children}
            </ScrollView>
        </View>
    );
}
