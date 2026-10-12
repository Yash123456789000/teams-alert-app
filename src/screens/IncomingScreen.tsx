import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button} from '../components/Button';
import type {AlertPayload} from '../types';
import {colors, spacing} from '../theme';

type Props = {
  alert: AlertPayload;
  onAnswer: () => void;
  onDecline: () => void;
};

/**
 * Full-screen "ringing" screen. Opened by the notification's full-screen intent (screen locked /
 * off), by tapping the notification, or directly in-app when an alert arrives in the foreground.
 */
export function IncomingScreen({
  alert,
  onAnswer,
  onDecline,
}: Props): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <Text style={styles.kicker}>Incoming Teams alert</Text>
        <Text style={styles.sender} adjustsFontSizeToFit numberOfLines={3}>
          {alert.sender}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          title="Decline"
          color={colors.danger}
          onPress={onDecline}
          large
          style={styles.action}
        />
        <Button
          title="Answer"
          color={colors.success}
          onPress={onAnswer}
          large
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  top: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md},
  kicker: {color: colors.textMuted, fontSize: 20},
  sender: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.lg},
  action: {flex: 1},
});
