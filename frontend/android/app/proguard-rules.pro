# Capacitor bridge — keep all public members so JS↔native calls aren't stripped
-keep class com.getcapacitor.** { *; }
-keep class com.uncoverroads.** { *; }

# WebView JS interface annotations must survive shrinking
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep source file line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Suppress warnings for unused platform classes
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
