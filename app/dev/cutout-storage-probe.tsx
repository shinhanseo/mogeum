import { useEffect, useRef, useState } from "react";
import { Redirect, useLocalSearchParams } from "expo-router";
import { ScrollView, Text } from "react-native";
import { Asset } from "expo-asset";
import * as FS from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { getBackendState } from "../../src/lib/env";
import { getSupabase } from "../../src/lib/supabase";
import { createCutout } from "../../src/features/cutout/native";
import {
  clearLocalCutouts,
  readLocalCutout,
  saveLocalCutout,
} from "../../src/features/cutout/storage";
import { createRecordRepository } from "../../src/features/records/repository";
import { createCellarRepository } from "../../src/features/cellar/repository";
import { applyAttachment } from "../../src/features/records/attachment";
import { loadRecordDetail } from "../../src/features/records/detail";
import { colors } from "../../src/theme/tokens";
/** Explicit synthetic loopback verification only. Existing sessions are never replaced. */
export default function CutoutStorageProbe() {
  const { runId } = useLocalSearchParams<{ runId?: string }>();
  const started = useRef(false);
  const [status, setStatus] = useState("로컬 누끼 저장 검증 준비");
  const config = getBackendState();
  const allowed =
    __DEV__ &&
    config.configured &&
    config.config.url === "http://127.0.0.1:54321";
  useEffect(() => {
    if (
      !allowed ||
      started.current ||
      !runId ||
      !/^[a-z0-9_-]{1,60}$/.test(runId)
    )
      return;
    started.current = true;
    void (async () => {
      const client = getSupabase();
      if (!client) throw Error("NO_LOCAL_CLIENT");
      const privateFile =
          FS.documentDirectory + `native-record-probe-private-${runId}.json`,
        out = FS.documentDirectory + `cutout-storage-${runId}.json`;
      const report: {
        status: string;
        phase: string;
        passed: string[];
        error?: string;
      } = { status: "running", phase: "start", passed: [] };
      const users: string[] = [];
      let derivative: string | null = null;
      const publish = async () => {
        await FS.writeAsStringAsync(out, JSON.stringify(report));
        setStatus([report.status, report.phase, ...report.passed].join("\n"));
      };
      const ensure = (value: unknown, code: string) => {
        if (!value) throw Error(code);
      };
      const pass = async (name: string) => {
        report.passed.push(name);
        report.phase = name;
        await publish();
      };
      try {
        ensure(!(await FS.getInfoAsync(privateFile)).exists, "EXISTING_RUN");
        ensure(
          !(await client.auth.getSession()).data.session,
          "EXISTING_SESSION_REFUSED",
        );
        await publish();
        const signup = async () => {
          const result = await client.auth.signUp({
            email: `native-${randomUUID()}@example.test`,
            password: randomUUID() + "Aa1!",
            options: { data: { mogeum_native_probe: runId } },
          });
          ensure(
            !result.error && result.data.user && result.data.session,
            "SIGNUP_FAILED",
          );
          const owner = result.data.user!.id;
          users.push(owner);
          await FS.writeAsStringAsync(
            privateFile,
            JSON.stringify({ runId, userIds: users }),
          );
          return owner;
        };
        const owner = await signup();
        await pass("real_local_auth");
        const asset = Asset.fromModule(
          require("../../assets/fixtures/figma-whisky.jpg"),
        );
        await asset.downloadAsync();
        const source = asset.localUri ?? asset.uri;
        const result = await createCutout(source);
        derivative = result.uri;
        await pass("native_mlkit_cutout");
        const bytes = await (await fetch(source)).arrayBuffer();
        ensure(bytes.byteLength > 0, "EMPTY_SOURCE");
        const operation = randomUUID(),
          path = `${owner}/records/${operation}/photo.jpg`,
          repo = createRecordRepository(client);
        await repo.uploadPhoto(path, bytes, "image/jpeg");
        const record = await repo.save(operation, {
          enteredName: "누끼 검증용 예시 술",
          category: "whisky",
          photo: { storagePath: path, width: 384, height: 512 },
        });
        const detail = await loadRecordDetail(client, owner, {
          recordId: record.recordId,
        });
        ensure(
          detail.photoUri &&
            detail.record.record_photos.some((p) => p.storage_path === path),
          "DETAIL_ORIGINAL",
        );
        await pass("real_upload_record_detail");
        await saveLocalCutout(owner, path, result);
        const first = await createCellarRepository(client, owner).page(
          { query: "", category: "전체" },
          null,
          () => true,
        );
        const item = first.items.find((v) => v.id === record.cellarEntryId);
        ensure(
          item?.cutoutUri && (await FS.getInfoAsync(item.cutoutUri)).exists,
          "CELLAR_CUTOUT_MISSING",
        );
        await pass("apply_and_cellar_requery");
        ensure(
          (await readLocalCutout(owner, path)) === item!.cutoutUri,
          "RESTORE_MISMATCH",
        );
        await pass("persisted_cache_read");
        await saveLocalCutout(owner, path, null);
        const original = await createCellarRepository(client, owner).page(
          { query: "", category: "전체" },
          null,
          () => true,
        );
        ensure(
          original.items[0].photoUri && !original.items[0].cutoutUri,
          "ORIGINAL_RESTORE",
        );
        await pass("return_to_original");
        await saveLocalCutout(owner, path, result);
        const nextOperation = randomUUID(),
          newPath = `${owner}/records/${nextOperation}/photo.jpg`;
        await repo.uploadPhoto(newPath, bytes, "image/jpeg");
        await applyAttachment(client, {
          version: 1,
          owner,
          recordId: record.recordId,
          operationId: nextOperation,
          expectedRevision: record.revision,
          change: {
            kind: "photo",
            storagePath: newPath,
            width: 384,
            height: 512,
          },
          localPhoto: source,
        });
        const replaced = await createCellarRepository(client, owner).page(
          { query: "", category: "전체" },
          null,
          () => true,
        );
        ensure(
          replaced.items[0].photoUri && !replaced.items[0].cutoutUri,
          "OLD_CUTOUT_REUSED",
        );
        await pass("photo_replacement_excludes_old_cutout");
        await client.auth.signOut({ scope: "local" });
        const other = await signup();
        let blocked = false;
        try {
          await saveLocalCutout(owner, path, result);
        } catch {
          blocked = true;
        }
        ensure(blocked, "FOREIGN_APPLY_ALLOWED");
        const foreign = await createCellarRepository(client, other).page(
          { query: "", category: "전체" },
          null,
          () => true,
        );
        ensure(foreign.items.length === 0, "FOREIGN_RECORDS_VISIBLE");
        await pass("account_switch_blocks_apply_and_read");
        await clearLocalCutouts(owner);
        ensure(
          (await readLocalCutout(owner, path)) === null,
          "CACHE_NOT_CLEARED",
        );
        await pass("owner_cache_cleanup");
        report.status = "passed";
      } catch (e) {
        report.status = "failed";
        report.error = e instanceof Error ? e.message : "failed";
        report.phase = report.error;
      } finally {
        if (derivative)
          await FS.deleteAsync(derivative, { idempotent: true }).catch(
            () => {},
          );
        const current = (await client.auth.getSession()).data.session;
        if (
          current &&
          users.includes(current.user.id) &&
          current.user.user_metadata.mogeum_native_probe === runId
        )
          await client.auth.signOut({ scope: "local" });
        await publish();
      }
    })().catch(() =>
      setStatus("검증 시작 실패 · 기존 계정은 변경하지 않아요."),
    );
  }, [allowed, runId]);
  if (!allowed) return <Redirect href="/" />;
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 24,
        paddingTop: 70,
        backgroundColor: colors.background,
      }}
    >
      <Text style={{ color: colors.primary }}>
        개발 검증 · 로컬 합성 계정 · 개인 계정 사용 안 함{`\n`}
        {status}
      </Text>
    </ScrollView>
  );
}
