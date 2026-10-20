# Supabase / kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.fets.live.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.fets.live.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
