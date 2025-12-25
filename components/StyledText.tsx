import { Text, type TextProps } from 'react-native';

type MonoTextProps = TextProps & { className?: string };

export function MonoText(props: MonoTextProps) {
  return <Text {...props} style={[props.style, { fontFamily: 'SpaceMono' }]} />;
}
