# MaxPlay R8 / ProGuard Security & Obfuscation Rules
-optimizationpasses 5
-allowaccessmodification
-repackageclasses 'o'

# Strip debug, verbose, info, and warning logging in release APK
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
}

# Keep WebView JavascriptInterface methods intact for window.MaxPlayNative
-keepattributes JavascriptInterface
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.maxplay.app.MaxPlayNativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Activity class name & Android lifecycle entrypoints only (obfuscate internal methods & constants)
-keep public class com.maxplay.app.MainActivity extends androidx.appcompat.app.AppCompatActivity {
    public <init>();
}

# OkHttp3 & Okio rules
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
