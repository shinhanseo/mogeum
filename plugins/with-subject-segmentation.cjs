const { withAndroidManifest } = require("expo/config-plugins");
module.exports = (config) =>
  withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const app = manifest.application[0];
    const name = "com.google.mlkit.vision.DEPENDENCIES";
    const entries = (app["meta-data"] ??= []);
    const old = entries.find((value) => value.$["android:name"] === name);
    const models = new Set(
      (old?.$["android:value"] ?? "barcode_ui").split(",").filter(Boolean),
    );
    models.add("subject_segment");
    const value = {
      "android:name": name,
      "android:value": [...models].join(","),
      "tools:replace": "android:value",
    };
    if (old) old.$ = value;
    else entries.push({ $: value });
    return result;
  });
