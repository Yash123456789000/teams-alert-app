/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {registerCallKeepHandlers} from './src/services/callkeep';
import {registerBackgroundMessageHandler} from './src/services/messaging';

// These two MUST run at module load, outside any React component. When a push arrives while the
// app process is dead, Android boots the JS bundle headless: only this file runs (no <App/>), and
// the FCM background handler + CallKeep listeners have to already be in place.
registerCallKeepHandlers();
registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
