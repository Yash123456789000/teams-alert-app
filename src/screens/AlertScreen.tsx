import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Button} from '../components/Button';
import type {AlertPayload} from '../types';
import {colors, spacing} from '../theme';

type Props = {
  alert: AlertPayload;
  onDismiss: () => void;
};

/** Shown after an incoming alert is answered: who it is from and what they wrote. */
export function AlertScreen({alert, onDismiss}: Props): React.JSX.Element {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Teams message from</Text>
        <Text style={styles.sender}>{alert.sender}</Text>
        <Text style={styles.message}>
          {alert.message.length > 0 ? alert.message : '(No message text)'}
        </Text>
      </ScrollView>
      <Button title="Dismiss" onPress={onDismiss} large style={styles.dismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  content: {flexGrow: 1, justifyContent: 'center', gap: spacing.md},
  kicker: {color: colors.textMuted, fontSize: 20},
  sender: {color: colors.text, fontSize: 40, fontWeight: '800'},
  message: {color: colors.text, fontSize: 28, lineHeight: 38},
  dismiss: {marginTop: spacing.md},
});
