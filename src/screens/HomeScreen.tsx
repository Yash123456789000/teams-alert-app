import React, {useCallback, useEffect, useState} from 'react';
import {
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {
  registerWithBackend,
  useRegistrationState,
} from '../services/registration';
import {
  Readiness,
  checkReadiness,
  requestNotificationPermission,
} from '../services/permissions';
import {openFullScreenIntentSettings} from '../services/incomingCallUi';
import {colors, spacing} from '../theme';

type Props = {
  onOpenSettings: () => void;
};

const STATUS_LABEL = {
  registered: 'Registered',
  unregistered: 'Not registered',
  registering: 'Registering…',
  error: 'Error',
} as const;

export function HomeScreen({onOpenSettings}: Props): React.JSX.Element {
  const registration = useRegistrationState();
  const [readiness, setReadiness] = useState<Readiness | null>(null);

  const refreshReadiness = useCallback(() => {
    checkReadiness()
      .then(setReadiness)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshReadiness();
    // Re-check when returning from the system settings screens.
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refreshReadiness();
      }
    });
    return () => subscription.remove();
  }, [refreshReadiness]);

  const statusColor =
    registration.status === 'registered'
      ? colors.success
      : registration.status === 'error'
      ? colors.danger
      : colors.warning;

  const busy = registration.status === 'registering';
  const buttonTitle =
    registration.status === 'registered' ? 'Re-register' : 'Register now';

  const allowNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (!granted) {
      // Denied (possibly "don't ask again"): only the system settings can fix it now.
      Linking.openSettings().catch(() => undefined);
    }
    refreshReadiness();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}>
      <Text style={styles.title}>Teams Alert</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Registration</Text>
        <Text style={[styles.status, {color: statusColor}]}>
          {STATUS_LABEL[registration.status]}
        </Text>
        {registration.message ? (
          <Text style={styles.message}>{registration.message}</Text>
        ) : null}
        <Button
          title={buttonTitle}
          onPress={() => {
            registerWithBackend();
          }}
          loading={busy}
          style={styles.cardButton}
        />
      </View>

      {readiness && (!readiness.notifications || !readiness.fullScreenIntent) ? (
        <View style={styles.card}>
          <Text style={styles.label}>Needs your attention</Text>
          {!readiness.notifications ? (
            <>
              <Text style={styles.message}>
                Notifications are blocked. Alerts cannot ring without them.
              </Text>
              <Button
                title="Allow notifications"
                color={colors.warning}
                onPress={allowNotifications}
                style={styles.cardButton}
              />
            </>
          ) : null}
          {!readiness.fullScreenIntent ? (
            <>
              <Text style={styles.message}>
                Full-screen alerts are blocked, so the ringing screen will not
                pop up over the lock screen.
              </Text>
              <Button
                title="Open full-screen settings"
                color={colors.warning}
                onPress={openFullScreenIntentSettings}
                style={styles.cardButton}
              />
            </>
          ) : null}
        </View>
      ) : null}

      <Button
        title="Settings"
        color={colors.surface}
        onPress={onOpenSettings}
        style={styles.settingsButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  content: {padding: spacing.lg, gap: spacing.md},
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {color: colors.textMuted, fontSize: 14, textTransform: 'uppercase'},
  status: {fontSize: 26, fontWeight: '700'},
  message: {color: colors.text, fontSize: 15, lineHeight: 21},
  cardButton: {marginTop: spacing.sm},
  settingsButton: {borderWidth: 1, borderColor: colors.border},
});
