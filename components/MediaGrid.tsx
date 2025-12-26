import type {ReactElement} from 'react';
import type {FlatListProps, StyleProp, ViewStyle} from 'react-native';
import {FlatList} from 'react-native';

type MediaGridProps<ItemT> = Omit<FlatListProps<ItemT>, 'numColumns' | 'scrollEnabled'> & {
    columnWrapperStyle?: StyleProp<ViewStyle>;
    className?: string;
    scrollEnabled?: boolean;
};

export default function MediaGrid<ItemT>({
    columnWrapperStyle,
    scrollEnabled = false,
    ...rest
}: MediaGridProps<ItemT>): ReactElement {
    return (
        <FlatList
            {...rest}
            numColumns={3}
            scrollEnabled={scrollEnabled}
            columnWrapperStyle={
                columnWrapperStyle ?? {paddingHorizontal: 12, marginTop: 12}
            }
        />
    );
}
