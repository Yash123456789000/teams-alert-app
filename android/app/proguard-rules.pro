# Add project specific ProGuard rules here.
# Minification is disabled for release builds (enableProguardInReleaseBuilds = false in
# app/build.gradle), so these only matter if you turn it on.

# react-native-callkeep is looked up by the Android Telecom framework via the manifest.
-keep class io.wazo.callkeep.** { *; }
# App-local native module / receiver.
-keep class com.teamsalert.app.** { *; }
