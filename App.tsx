import React, {useCallback, useEffect, useState} from 'react';
import {BackHandler, Linking, StatusBar, StyleSheet, View} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {AlertScreen} from './src/screens/AlertScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {IncomingScreen} from './src/screens/IncomingScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {
  answerAlert,
  declineAlert,
  setupCallKeep,
} from './src/services/callkeep';
import {subscribeAppEvents} from './src/services/appBus';
import {handleRemoteMessage} from './src/services/messaging';
import {requestNotificationPermission} from './src/services/permissions';
import {registerWithBackend} from './src/services/registration';
import {
  clearAnswered,
  getAlert,
  removeAlert,
  takeAnswered,
} from './src/storage/alertStore';
import {colors} from './src/theme';
import type {Route} from './src/types';

/** Deep links posted by the ringing notification (see CallNotifications.kt). */
const ALERT_URL = /^teamsalert:\/\/(incoming|answer)\/([^/?#]+)/;

// Survives App re-mounts within one process, so a replayed launch intent is not handled twice.
const handledUrls = new Set<string>();

export default function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({name: 'home'});
  const goHome = useCallback(() => setRoute({name: 'home'}), []);

  // ---- startup: permission, CallKeep, FCM token + registration, message listeners -------------
  useEffect(() => {
    const unsubscribeMessage = messaging().onMessage(message =>
      handleRemoteMessage(message, 'foreground'),
    );
    // Token rotated: re-register silently with the new token.
    const unsubscribeToken = messaging().onTokenRefresh(token => {
      registerWithBackend(token);
    });

    (async () => {
      await requestNotificationPermission();
      try {
        await setupCallKeep();
      } catch (error) {
        console.warn('[App] CallKeep setup failed', error);
      }
      // Firebase itself is initialised natively by the Google Services plugin; this fetches the
      // token and, if Settings are saved, POSTs it to <Backend URL>/api/register.
      await registerWithBackend();
    })();

    return () => {
      unsubscribeMessage();
      unsubscribeToken();
    };
  }, []);

  // ---- navigation driven by alerts -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = subscribeAppEvents(event => {
      switch (event.type) {
        case 'incoming':
          setRoute({name: 'incoming', alert: event.alert});
          break;
        case 'answered':
          setRoute({name: 'alert', alert: event.alert});
          clearAnswered();
          break;
        case 'ended':
          setRoute(current =>
            current.name === 'incoming' && current.alert.uuid === event.uuid
              ? {name: 'home'}
              : current,
          );
          break;
      }
    });

    // The alert may have been answered while no UI was mounted (app was killed/backgrounded).
    takeAnswered()
      .then(alert => {
        if (alert) {
          setRoute({name: 'alert', alert});
        }
      })
      .catch(() => undefined);

    return unsubscribe;
  }, []);

  // ---- deep links from the notification (Answer button / full-screen intent / tap) ----------------
  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || handledUrls.has(url)) {
        return;
      }
      const match = ALERT_URL.exec(url);
      if (!match) {
        return;
      }
      handledUrls.add(url);

      const [, kind, uuid] = match;
      const alert = await getAlert(uuid);
      if (!alert) {
        return; // stale link (alert already answered/declined or app data cleared)
      }
      if (kind === 'answer') {
        await answerAlert(uuid);
      } else {
        setRoute({name: 'incoming', alert});
      }
    };

    Linking.getInitialURL()
      .then(handleUrl)
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => {
      handleUrl(event.url);
    });
    return () => subscription.remove();
  }, []);

  // ---- hardware back button --------------------------------------------------------------------
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'home') {
        return false; // let Android leave the app
      }
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [route, goHome]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {route.name === 'home' && (
        <HomeScreen onOpenSettings={() => setRoute({name: 'settings'})} />
      )}
      {route.name === 'settings' && <SettingsScreen onBack={goHome} />}
      {route.name === 'incoming' && (
        <IncomingScreen
          alert={route.alert}
          onAnswer={() => {
            answerAlert(route.alert.uuid);
          }}
          onDecline={() => {
            declineAlert(route.alert.uuid);
            goHome();
          }}
        />
      )}
      {route.name === 'alert' && (
        <AlertScreen
          alert={route.alert}
          onDismiss={() => {
            removeAlert(route.alert.uuid).catch(() => undefined);
            clearAnswered();
            goHome();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.background},
});
