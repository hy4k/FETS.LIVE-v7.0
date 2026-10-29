# Supabase / kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.fets.staffapp.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.fets.staffapp.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
