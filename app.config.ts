import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: '모금',
  slug: 'mogeum',
  version: '0.1.0',
  scheme: 'mogeum-dev',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, ...(process.env.MOGEUM_IOS_BUNDLE_ID ? { bundleIdentifier: process.env.MOGEUM_IOS_BUNDLE_ID } : {}) },
  android: { ...(process.env.MOGEUM_ANDROID_PACKAGE ? { package: process.env.MOGEUM_ANDROID_PACKAGE } : {}) },
  web: { output: 'static' },
  plugins: ['./plugins/with-subject-segmentation.cjs', 'expo-secure-store', 'expo-font', 'expo-web-browser', 'expo-router', 'expo-dev-client', ['expo-image-picker', { photosPermission: '술 사진을 기록하기 위해 사진 접근이 필요해요.', cameraPermission: '마신 술의 사진을 촬영하기 위해 카메라 접근이 필요해요.', microphonePermission: false }]],
  experiments: { typedRoutes: true },
});
