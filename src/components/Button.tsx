import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import {colors, spacing} from '../theme';

type Props = {
  title: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  color = colors.primary,
  disabled = false,
  loading = false,
  large = false,
  style,
}: Props): React.JSX.Element {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: inactive}}
      onPress={onPress}
      disabled={inactive}
      style={({pressed}) => [
        styles.button,
        large && styles.large,
        {backgroundColor: color, opacity: inactive ? 0.5 : pressed ? 0.8 : 1},
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.onColor} />
      ) : (
        <Text style={[styles.title, large && styles.largeTitle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  large: {
    minHeight: 72,
    borderRadius: 16,
  },
  title: {
    color: colors.onColor,
    fontSize: 16,
    fontWeight: '600',
  },
  largeTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
});
