import {Text, View} from 'react-native';

type ResumeStatusPillProps = {
    label: string;
};

export default function ResumeStatusPill({label}: ResumeStatusPillProps) {
    return (
        <View className="mt-3 items-center">
            <View className="rounded-full bg-white/10 px-4 py-1.5">
                <Text className="font-bodySemi text-xs uppercase tracking-[1px] text-white">
                    {label}
                </Text>
            </View>
        </View>
    );
}
