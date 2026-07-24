# Capacitor bridge — keep all public members so JS↔native calls aren't stripped
-keep class com.getcapacitor.** { *; }
-keep class com.uncoverroads.travel.** { *; }

# WebView JS interface annotations must survive shrinking
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# AndroidX / support library
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep source file line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
