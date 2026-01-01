import {
    Pressable,
    type PressableProps,
    type PressableStateCallbackType,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import {ReactNode, forwardRef, useCallback, useMemo, useState, type ElementRef} from 'react';

type TVFocusPressableProps = PressableProps & {
    className?: string;
    focusedClassName?: string;
    focusedStyle?: StyleProp<ViewStyle>;
    children: ReactNode;
};

type TVFocusPressableRef = ElementRef<typeof Pressable>;

const TVFocusPressable = forwardRef<TVFocusPressableRef, TVFocusPressableProps>(
    (
        {
            className = '',
            focusedClassName = '',
            focusedStyle,
            children,
            onFocus,
            onBlur,
            style,
            ...props
        },
        ref
    ) => {
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = useCallback(
        (event: any) => {
            setIsFocused(true);
            onFocus?.(event);
        },
        [onFocus]
    );

    const handleBlur = useCallback(
        (event: any) => {
            setIsFocused(false);
            onBlur?.(event);
        },
        [onBlur]
    );

    const resolvedStyle = useMemo(() => {
        if (typeof style === 'function') {
            return (state: PressableStateCallbackType) => {
                const baseStyle = style(state);
                return isFocused ? [baseStyle, focusedStyle] : baseStyle;
            };
        }
        return isFocused ? [style, focusedStyle] : style;
    }, [focusedStyle, isFocused, style]);

        return (
            <Pressable
                ref={ref}
                focusable
                {...props}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={`${className} ${isFocused ? focusedClassName : ''}`.trim()}
                style={resolvedStyle}
            >
                {children}
            </Pressable>
        );
    }
);

TVFocusPressable.displayName = 'TVFocusPressable';

export default TVFocusPressable;
