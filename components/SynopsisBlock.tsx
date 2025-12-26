import { Text, View } from 'react-native';

type SynopsisBlockProps = {
  plot?: string;
  showFull: boolean;
  onToggle: () => void;
  maxLength?: number;
};

export default function SynopsisBlock({
  plot,
  showFull,
  onToggle,
  maxLength = 300,
}: SynopsisBlockProps) {
  const content = plot
    ? showFull
      ? plot
      : plot.slice(0, maxLength)
    : 'Synopsis indisponible.';
  const canToggle = !!plot && plot.length > maxLength;
  const showEllipsis = canToggle && !showFull;

  return (
    <View className="mt-6">
      <Text className="font-bodySemi text-lg text-white">Synopsis</Text>
      <Text className="mt-2 font-body text-base text-mist">
        {content}
        {showEllipsis ? '…' : ''}
        {canToggle ? (
          <Text onPress={onToggle} className="font-bodySemi text-sm text-white">
            {showFull ? ' Voir moins' : ' Voir plus'}
          </Text>
        ) : null}
      </Text>
    </View>
  );
}
