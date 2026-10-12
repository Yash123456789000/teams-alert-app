# TeamsAlert (Android)
Shared secret- 38abac0567f36f388adb318041f87b2917c2eab8545b936d80f14458628e02bb
url- https://teamsalert-ddaecre7enfngue3.southindia-01.azurewebsites.net
Personal Android app that turns a Firebase Cloud Messaging push into a **ringing, full-screen
"incoming call" alert** when a specific person messages you on Microsoft Teams.

* React Native CLI (not Expo), **Android only**, package name `com.teamsalert.app`
* React Native `0.76.9`, React `18.3.1`, TypeScript, Hermes, classic architecture (see *Design notes*)
* Push: `@react-native-firebase/app` + `@react-native-firebase/messaging` `21.14.0`
* Call UI plumbing: `react-native-callkeep` `4.3.16` (self-managed Telecom account)
* Storage: `@react-native-async-storage/async-storage` `1.24.0`

Every dependency is pinned to an exact version in `package.json` (no `^` / `~`).

> This project was authored on a machine with no JDK / Android SDK, so it had never been compiled when
> it was written. If something fails on first build, see **Troubleshooting** and the
> "things to double-check" list at the bottom of this file.

---

## How it works

```
Teams message ──► Azure Function ──► FCM (high priority, DATA-ONLY push)
                                         │  data: { type: "teams_alert", sender, message }
                                         ▼
                      Android starts the app headless if it is killed
                      messaging().setBackgroundMessageHandler   (index.js, module level)
                                         ▼
                      RNCallKeep.displayIncomingCall()  → Telecom ringing Connection
                                         ▼  `showIncomingCallUi` event
                      Kotlin module posts a ringing full-screen-intent notification
                      (Answer / Decline buttons, looping ringtone, vibration)
                                         ▼  user taps Answer
                      end call session → open app → Alert screen (sender + message)
```

In the foreground, `messaging().onMessage` runs the same code and also opens the in-app Incoming screen.

### What the backend must send

* `POST <Backend URL>/api/register` receives `{ "secret": "...", "token": "<FCM token>" }`.
* `POST <Backend URL>/api/notify` is called by the **Send test alert** button with
  `{ "secret": "...", "sender": "Test Sender", "message": "This is a test alert from the Teams Alert app." }`.
* The FCM message must be **data-only** (no `notification` block) with Android priority `high`, and
  `data.type` must equal `"teams_alert"`; `data.sender` and `data.message` are shown to you.
  A push that carries a `notification` block is displayed by the system tray instead and never
  reaches the handler while the app is in the background.

---

## Prerequisites (on the build machine)

| Tool | Version |
| --- | --- |
| Node.js | 18 or newer (20 LTS recommended) |
| JDK | **17** (React Native Firebase's build aborts below 17) |
| Android SDK | Platform `android-35`, Build-Tools `35.0.0`, NDK `26.1.10909125`, platform-tools (`adb`) |

Easiest route: install Android Studio, open **SDK Manager**, and install the items above.
Then set the environment variables (adjust paths):

```bash
# macOS / Linux
export JAVA_HOME=/path/to/jdk-17
export ANDROID_HOME=$HOME/Android/Sdk          # macOS: $HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

```powershell
# Windows (PowerShell) - also add these as permanent user environment variables
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17..."
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:ANDROID_HOME\platform-tools"
```

Accept the SDK licences once: `sdkmanager --licenses` (in `$ANDROID_HOME/cmdline-tools/latest/bin`).

Alternatively create `android/local.properties` containing `sdk.dir=/path/to/Android/Sdk`
(Windows: `sdk.dir=C\:\\Users\\you\\AppData\\Local\\Android\\Sdk`). It is git-ignored.

---

## 1. Install JavaScript dependencies

```bash
npm install
```

(`package-lock.json` does not exist yet. Commit the one this generates so future installs reproduce
the same *transitive* versions too; the direct dependencies are already exact.)

Optional sanity check of the TypeScript: `npm run typecheck`.

## 2. Put `google-services.json` in place

The file must be at exactly:

```
android/app/google-services.json
```

* Get it from Firebase console → Project settings → *Your apps* → the Android app whose package name is
  **`com.teamsalert.app`** → *Download google-services.json*.
* Confirm it is there and the package name matches:

  ```bash
  ls android/app/google-services.json
  grep '"package_name"' android/app/google-services.json     # must print com.teamsalert.app
  ```
* Without it the build **fails on purpose** with `File google-services.json is missing`.
* `android/app/google-services.json.PLACEHOLDER.txt` is only a reminder; delete it once the real file exists.

## 3. Debug build (for testing)

Connect a phone with USB debugging enabled (or start an emulator **with Google Play services**), then:

```bash
adb devices                       # the device must be listed as "device"
npx react-native run-android
```

This builds the debug APK, installs it, starts Metro, and launches the app. A debug build loads its
JavaScript from Metro, so for a realistic "app fully killed" test use the release build below.

On Linux/macOS, if you see `Permission denied` for `gradlew`, run `chmod +x android/gradlew`
(and, so it sticks in git: `git update-index --chmod=+x android/gradlew`).

## 4. Create a release keystore (one time)

Run from the repository root. `keytool` ships with the JDK.

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore android/app/teamsalert-release.keystore \
  -alias teamsalert -keyalg RSA -keysize 2048 -validity 10000
```

(One line for Windows `cmd`/PowerShell:
`keytool -genkeypair -v -storetype PKCS12 -keystore android/app/teamsalert-release.keystore -alias teamsalert -keyalg RSA -keysize 2048 -validity 10000`)

It asks for a keystore password and some name fields. **Use the same password for the keystore and the
key** (PKCS12 does not support different ones). Back the keystore file and the password up somewhere
safe: if you lose them you can never ship an update that installs over this one.

## 5. Fill in `keystore.properties`

```bash
cp android/keystore.properties.example android/keystore.properties      # Windows: copy ...
```

Edit `android/keystore.properties`:

```properties
storeFile=teamsalert-release.keystore
storePassword=<the password you typed>
keyAlias=teamsalert
keyPassword=<the same password>
```

`storeFile` is resolved **relative to `android/app/`**, so the value above points at
`android/app/teamsalert-release.keystore`. An absolute path also works.
Both `android/keystore.properties` and every `*.keystore` / `*.jks` file are git-ignored; never commit them.
(The one exception is the standard React Native `android/app/debug.keystore`, which is public and must stay committed.)

## 6. Build the signed release APK

```bash
cd android
./gradlew assembleRelease          # Windows: gradlew.bat assembleRelease
```

Output (relative to the repository root):

```
android/app/build/outputs/apk/release/app-release.apk
```

Install it on a connected phone: `adb install -r android/app/build/outputs/apk/release/app-release.apk`
(or copy the file to the phone and open it).

If `keystore.properties` is missing or incomplete, the build stops with a message saying what is wrong
instead of producing an unsigned APK.

### ⚠️ Debug → release over-the-top installs fail

A release-signed APK cannot be installed over a previously installed **debug** build of the same app
(and vice versa): Android rejects it with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` / "signatures do not match".
**Uninstall the debug version first**, either from the phone or with:

```bash
adb uninstall com.teamsalert.app
```

Uninstalling clears the app's data, so re-enter the Backend URL and secret in Settings afterwards.

---

## First run on the phone

1. Open the app and **allow notifications** (Android 13+ asks).
2. On Android 14+ side-loaded installs may have *Full-screen notifications* switched off. Home shows
   a "Needs your attention" card with a button that opens the right settings page. Without it the ringing
   screen does not pop up over the lock screen (the heads-up notification still rings).
3. **Settings** → enter *Backend URL* (e.g. `https://my-func.azurewebsites.net`) and *Shared secret* → **Save**.
   Saving re-registers immediately. Home should show **Registered**.
4. **Send test alert** (needs the backend to be deployed). The phone should ring. Test it three ways:
   app open, app in the background, and app swiped away / phone locked.
5. For reliable delivery set the app's battery usage to **Unrestricted** and, on Xiaomi / Huawei / OnePlus /
   Samsung, allow auto-start / disable aggressive battery management for the app.
   Do-Not-Disturb silences the ringing notification unless you allow it.

---

## Project layout

```
index.js                      Entry. Registers the FCM background handler + CallKeep listeners at module level
App.tsx                       Startup, navigation state, deep-link handling
src/screens/                  Home, Settings, Incoming (ringing UI), Alert (after answering)
src/services/messaging.ts     FCM → alert, foreground + background handlers
src/services/callkeep.ts      CallKeep setup, ring / answer / end flow
src/services/registration.ts  FCM token → POST /api/register, observable status
src/services/backend.ts       fetch helpers (register, test alert)
src/storage/                  AsyncStorage: settings, pending/answered alerts
android/app/src/main/java/com/teamsalert/app/
  CallNotifications.kt        Builds the ringing full-screen-intent notification
  TeamsAlertCallModule.kt     JS bridge for the above (+ full-screen-intent permission helpers)
  CallActionReceiver.kt       "Decline" button handler (works with the app dead)
android/app/build.gradle      Google Services plugin + release signing from keystore.properties
```

## Design notes (where this goes beyond the minimum brief)

* **A small Kotlin module posts the ringing notification.** react-native-callkeep in *self-managed* mode
  does not draw any incoming-call UI: Android requires the app to post its own high-priority
  full-screen-intent notification when CallKeep fires `showIncomingCallUi`. No notification library
  was on the dependency list, so `CallNotifications.kt` does it natively
  (channel with ringtone sound, looping `FLAG_INSISTENT`, vibration, Answer/Decline, 45 s timeout).
* **A fourth screen, `IncomingScreen`.** The full-screen intent needs something to show. It is a
  big Answer/Decline screen; answering opens the specified Alert screen.
* **No navigation library.** Three/four screens are handled with a few lines of state in `App.tsx`.
* **New Architecture is off** (`newArchEnabled=false` in `android/gradle.properties`) because
  react-native-callkeep 4.x is an old-style module that gates event delivery on
  `hasActiveCatalystInstance()`.
* **`READ_PHONE_STATE` is declared but never requested at runtime.** If it were granted, callkeep would
  register a telephony listener (on Android ≤ 11 via a blocking `Looper.loop()` on the calling thread).
* **No CallKeep foreground service is configured.** Telecom already keeps the process alive for a
  self-managed call; CallKeep's would add a sticky notification. `FOREGROUND_SERVICE` /
  `FOREGROUND_SERVICE_PHONE_CALL` are declared as requested.
* CallKeep's `onHostDestroy` intentionally kills the app process when the Activity is destroyed.
  That is library behaviour, not a crash.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `File google-services.json is missing` | Step 2. |
| `No matching client found for package name 'com.teamsalert.app'` | The Firebase Android app was registered with a different package name. |
| `Unsupported class file major version` / Firebase "minimum JVM 17" error | Wrong JDK; use 17. Check `java -version` and `JAVA_HOME`. |
| `SDK location not found` | Set `ANDROID_HOME` or create `android/local.properties`. |
| `Release build requested but android/keystore.properties was not found` | Step 5. |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | Uninstall the debug build first (see above). |
| Home shows *Error: Server responded 401/403* | Wrong shared secret or Backend URL. |
| Home shows *Error: Network request failed* | Phone has no internet, wrong host, or (release builds) the URL is plain `http://` – cleartext is only allowed in debug builds. |
| Push arrives but nothing rings | Notifications blocked; battery-restricted app; payload has a `notification` block or is not high priority; `data.type` is not `teams_alert`. Check `adb logcat -s TeamsAlertCall ReactNativeJS RNCallKeep`. |
| Rings, but no full-screen pop-up on the lock screen | Android 14+ *Full-screen notifications* permission is off (see Home). |

---

## Things to double-check on the machine that builds this

These could not be verified where the project was written (no JDK / Android SDK; nothing was built or run):

1. **First `gradlew` build** – nothing was compiled. Treat compile errors in the Kotlin files or
   Gradle scripts as likely, small, and fixable.
2. **`react-native-callkeep` 4.3.16 on AGP 8 / RN 0.76** – the library declares no `namespace` (RN's Gradle
   plugin 0.76.9 does fill it in from the library manifest; confirmed in its source) and a
   `com.android.tools.build:gradle:3.0.1` buildscript classpath, which is the part not checked. This exact
   combination was not built.
3. **Self-managed Telecom flow end to end** – ringing, `showIncomingCallUi` firing in a headless
   context, `answerIncomingCall`, `endCall`, and `backToForeground` from a killed app. The code was written
   against callkeep's 4.3.16 source but never run.
4. **The call handle `'0000'`** passed to `displayIncomingCall` (Telecom builds a `tel:` URI from it).
   If some device rejects it, change `CALL_HANDLE` in `src/services/callkeep.ts`.
5. **`android:foregroundServiceType="phoneCall"`** on `VoiceConnectionService` in the manifest, plus the
   `tools:remove="android:maxSdkVersion"` on `READ_PHONE_STATE` (manifest merge result). Inspect
   `android/app/build/intermediates/merged_manifests/` after the first build.
6. **Full-screen intent behaviour** – lock-screen pop-up, `showWhenLocked` / `turnScreenOn`, and the
   Android 14+ permission flow differ between OEMs.
7. **Exact backend contract** – the body of `/api/notify` (`secret`, `sender`, `message`) and `/api/register`
   (`secret`, `token`) is assumed; adjust `src/services/backend.ts` if your Azure Function differs.
8. **`google-services` plugin 4.4.2 / Firebase BoM** pulled in by RNFB 21.14.0 – versions were checked to
   exist, not built. Transitive npm versions float until you commit a `package-lock.json`.
9. **Launcher icons** are the stock React Native ones copied from the template; the debug keystore and
   Gradle wrapper (`8.10.2`) are likewise copied from the official RN 0.76.9 template.
10. **READ_CALL_LOG** – callkeep's README says self-managed mode needs it; its source does not reference it,
    so it is not declared. If Telecom rejects calls with a `SecurityException`, add
    `<uses-permission android:name="android.permission.READ_CALL_LOG" />`.
