# The beta SDK registers internal dependency-injection components by Class identity.
# R8 optimization in Release caused getClient() to receive a null internal provider.
# Preserve this specific SDK package; do not disable optimization for the whole app.
-keep class com.google.mlkit.vision.segmentation.subject.** { *; }
-keep class com.google.mlkit.common.** { *; }
