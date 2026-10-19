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
  plugins: ['expo-router', 'expo-dev-client'],
  experiments: { typedRoutes: true },
});
