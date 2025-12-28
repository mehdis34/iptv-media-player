import type {ReactElement, Ref} from 'react';
import {forwardRef} from 'react';
import type {FlatListProps, StyleProp, ViewStyle} from 'react-native';
import {FlatList} from 'react-native';

type MediaGridProps<ItemT> = Omit<FlatListProps<ItemT>, 'numColumns' | 'scrollEnabled'> & {
    columnWrapperStyle?: StyleProp<ViewStyle>;
    className?: string;
    scrollEnabled?: boolean;
};

type MediaGridComponent = <ItemT>(
    props: MediaGridProps<ItemT> & { ref?: Ref<FlatList<ItemT>> }
) => ReactElement | null;

const MediaGrid = forwardRef(function MediaGrid<ItemT>(
    {
        columnWrapperStyle,
        scrollEnabled = false,
        ...rest
    }: MediaGridProps<ItemT>,
    ref: Ref<FlatList<ItemT>>
): ReactElement {
    return (
        <FlatList
            ref={ref}
            {...rest}
            numColumns={3}
            scrollEnabled={scrollEnabled}
            columnWrapperStyle={
                columnWrapperStyle ?? {paddingHorizontal: 12, marginTop: 12}
            }
        />
    );
}) as MediaGridComponent;

export default MediaGrid;
