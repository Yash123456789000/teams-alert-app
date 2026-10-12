import React, {useEffect, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {Button} from '../components/Button';
import {
  hasCompleteSettings,
  loadSettings,
  saveSettings,
} from '../storage/settingsStorage';
import {sendTestAlert} from '../services/backend';
import {registerWithBackend} from '../services/registration';
import {colors, spacing} from '../theme';

type Props = {
  onBack: () => void;
};

type Feedback = {kind: 'ok' | 'error'; text: string} | null;

export function SettingsScreen({onBack}: Props): React.JSX.Element {
  const [backendUrl, setBackendUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [saved, setSaved] = useState({backendUrl: '', secret: ''});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let active = true;
    loadSettings()
      .then(settings => {
        if (!active) {
          return;
        }
        setBackendUrl(settings.backendUrl);
        setSecret(settings.secret);
        setSaved(settings);
        setLoaded(true);
      })
      .catch(error => {
        if (active) {
          setLoaded(true);
          setFeedback({kind: 'error', text: `Could not load settings: ${error}`});
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const dirty =
    backendUrl.trim() !== saved.backendUrl || secret.trim() !== saved.secret;

  const onSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const next = {backendUrl: backendUrl.trim(), secret: secret.trim()};
      await saveSettings(next);
      setSaved(next);
      setBackendUrl(next.backendUrl);
      setSecret(next.secret);
      setFeedback({kind: 'ok', text: 'Saved. Registering this device…'});
      // New credentials: register right away so Home reflects the result.
      registerWithBackend();
    } catch (error) {
      setFeedback({kind: 'error', text: `Could not save: ${error}`});
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      // Uses the SAVED values, not whatever is currently typed in the fields.
      const settings = await loadSettings();
      if (!hasCompleteSettings(settings)) {
        throw new Error('Save a Backend URL and shared secret first.');
      }
      await sendTestAlert(settings.backendUrl, settings.secret);
      setFeedback({
        kind: 'ok',
        text: 'Test alert sent. If this device is registered it should ring shortly.',
      });
    } catch (error) {
      setFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Settings</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.input}
            value={backendUrl}
            onChangeText={setBackendUrl}
            placeholder="https://my-function-app.azurewebsites.net"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={loaded}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Shared secret</Text>
          <TextInput
            style={styles.input}
            value={secret}
            onChangeText={setSecret}
            placeholder="Shared secret"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={loaded}
          />
        </View>

        <Button
          title="Save"
          onPress={onSave}
          loading={saving}
          disabled={!loaded || !dirty}
        />

        <Button
          title="Send test alert"
          color={colors.success}
          onPress={onTest}
          loading={testing}
          disabled={!loaded}
        />
        {dirty ? (
          <Text style={styles.hint}>
            You have unsaved changes. “Send test alert” uses the saved values.
          </Text>
        ) : null}

        {feedback ? (
          <Text
            style={[
              styles.feedback,
              {color: feedback.kind === 'ok' ? colors.success : colors.danger},
            ]}>
            {feedback.text}
          </Text>
        ) : null}

        <Button
          title="Back"
          color={colors.surface}
          onPress={onBack}
          style={styles.back}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
  field: {gap: spacing.xs},
  label: {color: colors.textMuted, fontSize: 14, textTransform: 'uppercase'},
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  hint: {color: colors.textMuted, fontSize: 13},
  feedback: {fontSize: 15, lineHeight: 21},
  back: {borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm},
});
