import {Pressable, type PressableProps, type StyleProp, type ViewStyle} from 'react-native';
import {ReactNode, useCallback, useState} from 'react';

type TVFocusPressableProps = PressableProps & {
    className?: string;
    focusedClassName?: string;
    focusedStyle?: StyleProp<ViewStyle>;
    children: ReactNode;
};

export default function TVFocusPressable({
    className = '',
    focusedClassName = '',
    focusedStyle,
    children,
    onFocus,
    onBlur,
    style,
    ...props
}: TVFocusPressableProps) {
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

    return (
        <Pressable
            focusable
            {...props}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`${className} ${isFocused ? focusedClassName : ''}`.trim()}
            style={[style, isFocused ? focusedStyle : null]}
        >
            {children}
        </Pressable>
    );
}
