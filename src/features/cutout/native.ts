import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";
export type CutoutImage = { uri: string; width: number; height: number };
type Native = {
  removeBackground: (
    uri: string,
    options: { cropToSubject: boolean; maxDimension: number },
  ) => Promise<CutoutImage>;
};
export function cutoutAvailable() {
  return (
    Platform.OS !== "web" &&
    (Platform.OS !== "ios" ||
      Number.parseInt(String(Platform.Version), 10) >= 17) &&
    !!requireOptionalNativeModule("ExpoBackgroundRemoval")
  );
}
let running: Promise<unknown> = Promise.resolve();
/** Bound decode size and serialize calls: never run several native segmentations at once. */
export function createCutout(uri: string): Promise<CutoutImage> {
  const task = running
    .catch(() => {})
    .then(async () => {
      const native = requireOptionalNativeModule<Native>(
        "ExpoBackgroundRemoval",
      );
      if (!cutoutAvailable() || !native) throw Error("CUTOUT_UNAVAILABLE");
      if (!/^(file|content):\/\//.test(uri))
        throw Error("LOCAL_IMAGE_REQUIRED");
      const result = await native.removeBackground(uri, {
        cropToSubject: true,
        maxDimension: 1600,
      });
      if (
        !result.uri.startsWith("file://") ||
        !Number.isInteger(result.width) ||
        !Number.isInteger(result.height) ||
        result.width < 1 ||
        result.height < 1 ||
        Math.max(result.width, result.height) > 1600
      )
        throw Error("INVALID_CUTOUT");
      return result;
    });
  running = task;
  return task;
}
export function cutoutError() {
  return "배경을 분리하지 못했어요. Android 첫 사용에는 모델 다운로드가 필요해요. 연결을 확인하고 다시 시도하거나 원본을 사용해주세요.";
}
