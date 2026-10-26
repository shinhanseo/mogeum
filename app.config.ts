import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.MOGEUM_APP_VARIANT ?? "development";
  if (!["development", "beta"].includes(variant))
    throw new Error("Unknown MOGEUM_APP_VARIANT");
  const beta = variant === "beta";
  return {
    ...config,
    owner: "shinhanseo",
    name: beta ? "모금 베타" : "모금",
    slug: "mogeum",
    version: "0.1.0",
    scheme: beta ? "mogeum-beta" : "mogeum-dev",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/brand/icon.png",
    ios: {
      supportsTablet: false,
      buildNumber: "1",
      ...(beta
        ? { bundleIdentifier: "com.hanseo.mogeum" }
        : process.env.MOGEUM_IOS_BUNDLE_ID
          ? { bundleIdentifier: process.env.MOGEUM_IOS_BUNDLE_ID }
          : {}),
    },
    android: {
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/brand/adaptive-foreground.png",
        backgroundColor: "#FAF7F2",
      },
      blockedPermissions: ["android.permission.RECORD_AUDIO"],
      ...(beta
        ? { package: "com.hanseo.mogeum" }
        : process.env.MOGEUM_ANDROID_PACKAGE
          ? { package: process.env.MOGEUM_ANDROID_PACKAGE }
          : {}),
    },
    extra: {
      ...config.extra,
      appVariant: variant,
      eas: { projectId: "23fc1222-7a05-4cf5-b061-41787ed71fbe" },
    },
    web: { output: "static" },
    plugins: [
      "./plugins/with-subject-segmentation.cjs",
      "expo-secure-store",
      "expo-font",
      "expo-web-browser",
      "expo-router",
      "expo-dev-client",
      [
        "expo-splash-screen",
        {
          image: "./assets/brand/splash.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: "#FAF7F2",
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "술 사진을 기록하기 위해 사진 접근이 필요해요.",
          cameraPermission:
            "마신 술의 사진을 촬영하기 위해 카메라 접근이 필요해요.",
          microphonePermission: false,
        },
      ],
    ],
    experiments: { typedRoutes: true },
  };
};
