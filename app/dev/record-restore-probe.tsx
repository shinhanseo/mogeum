import { useEffect, useState } from "react";
import { Image, Platform, ScrollView, Text } from "react-native";
import { Redirect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { preparePhoto } from "../../src/features/records/device";
import { decodePendingRecord } from "../../src/features/records/pending-restore";
import { decodePreparedAttachment } from "../../src/features/records/attachment-restore";

/** No session, remote writes or user pending keys: this owns only a unique synthetic operation. */
export default function RecordRestoreProbe() {
  const [status, setStatus] = useState("running");
  useEffect(() => {
    if (!__DEV__ || Platform.OS === "web") return;
    let alive = true;
    const operation = randomUUID();
    const key = `mogeum-dev-restore-probe-${operation}`;
    const directory = FileSystem.documentDirectory;
    const uri = `${directory}record-drafts/${operation}.jpg`;
    const run = async () => {
      const ensure = (ok: unknown) => {
        if (!ok) throw new Error("PROBE_EXPECTATION");
      };
      try {
        ensure(directory);
        const asset = Image.resolveAssetSource(
          require("../../assets/fixtures/figma-whisky.jpg"),
        );
        if (!asset) throw new Error('PROBE_ASSET');
        const photo = await preparePhoto(asset.uri, 900, 1200, operation);
        ensure(photo.localUri === uri);
        // iOS changes only the application container segment. Android intentionally keeps its exact path.
        const previous =
          Platform.OS === "ios"
            ? photo.localUri.replace(
                /\/Application\/[0-9a-f-]{36}\/Documents\//i,
                "/Application/10000000-0000-4000-8000-000000000001/Documents/",
              )
            : photo.localUri;
        if (Platform.OS === "ios") ensure(previous !== uri);
        const owner = "90000000-0000-4000-8000-000000000001";
        const recordId = "90000000-0000-4000-8000-000000000003";
        const input = {
          enteredName: "합성 복구 검증",
          photo: {
            storagePath: `${owner}/records/${operation}/photo.jpg`,
            width: photo.width,
            height: photo.height,
          },
        };
        const raw = JSON.stringify({
          version: 1,
          ownerId: owner,
          operationId: operation,
          input,
          localPhoto: previous,
        });
        await AsyncStorage.setItem(key, raw);
        const stored = await AsyncStorage.getItem(key);
        ensure(stored === raw);
        const restored = decodePendingRecord(stored!, owner, directory);
        ensure(restored.localPhoto === uri);
        ensure(JSON.stringify(restored.input) === JSON.stringify(input));
        const replacement = decodePreparedAttachment(
          JSON.stringify({
            version: 1,
            owner,
            recordId,
            operationId: operation,
            expectedRevision: 4,
            change: { kind: "photo", ...input.photo },
            localPhoto: previous,
          }),
          owner,
          recordId,
          directory,
        );
        ensure(replacement.localPhoto === uri);
        const bytes = await FileSystem.readAsStringAsync(restored.localPhoto!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        ensure(bytes.length > 100);
        ensure((await AsyncStorage.getItem(key)) === raw);
        const report = {
          synthetic: true,
          platform: Platform.OS,
          status: "passed",
          relocated: Platform.OS === "ios",
          recordRestored: true,
          replacementRestored: true,
          photoReadable: true,
          storedRawUnchanged: true,
        };
        await FileSystem.writeAsStringAsync(
          `${directory}record-restore-probe-report.json`,
          JSON.stringify(report),
        );
        if (alive) setStatus(JSON.stringify(report, null, 2));
      } catch {
        if (alive) setStatus("failed — synthetic restore probe");
      } finally {
        await AsyncStorage.removeItem(key);
        if (directory && uri === `${directory}record-drafts/${operation}.jpg`)
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(
            () => {},
          );
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 72 }}>
      <Text>개발 검증 · 합성 사진 · 서버 저장 없음</Text>
      <Text selectable>{status}</Text>
    </ScrollView>
  );
}
