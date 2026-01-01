import {useFocusEffect} from '@react-navigation/native';
import {ReactNode, useCallback, useRef} from 'react';
import {ScrollView, type ScrollViewProps} from 'react-native';

import {useTvNavScroll} from '@/components/tv/TVNavScrollContext';

type TVScreenProps = ScrollViewProps & {
    children: ReactNode;
};

export default function TVScreenScrollView({children, onScroll, contentContainerStyle, ...rest}: TVScreenProps) {
    const {setScrolled} = useTvNavScroll();
    const scrollRef = useRef<ScrollView>(null);
    const handleScroll = useCallback(
        (event: any) => {
            const offsetY = event?.nativeEvent?.contentOffset?.y ?? 0;
            setScrolled(offsetY > 8);
            onScroll?.(event);
        },
        [onScroll, setScrolled]
    );

    useFocusEffect(
        useCallback(() => {
            setScrolled(false);
            scrollRef.current?.scrollTo({y: 0, animated: false});
        }, [setScrolled])
    );

    return (
        <ScrollView
            ref={scrollRef}
            className="flex-1"
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={handleScroll}
            contentContainerStyle={[{paddingBottom: 80}, contentContainerStyle]}
            {...rest}
        >
            {children}
        </ScrollView>
    );
}
