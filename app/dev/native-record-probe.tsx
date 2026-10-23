import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Text } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/tokens";
import {
  preparePhoto,
  readPending,
  finishPending,
} from "../../src/features/records/device";
import { decodePendingRecord } from "../../src/features/records/pending-restore";
import {
  submitPending,
  type PendingRecord,
} from "../../src/features/records/pending";
import { createRecordRepository } from "../../src/features/records/repository";
import { loadRecordDetail } from "../../src/features/records/detail";
import {
  deleteExperience,
  drainPhotoDeletions,
} from "../../src/features/records/edit";
import {
  tastePhotoUrls,
  loadTasteContext,
  analyzeTaste,
} from "../../src/features/taste/repository";
import { loadCellar } from "../../src/features/cellar/load";
import { probeNativeMenu } from "../../src/dev/menu-backend-probe";
type Report = {
  version: 1;
  synthetic: true;
  platform: string;
  runId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed";
  phase: string;
  passed: string[];
  menu?: Awaited<ReturnType<typeof probeNativeMenu>>;
};
const activeProbeRuns = new Set<string>();
const ensure = (condition: unknown) => {
  if (!condition) throw new Error("PROBE_EXPECTATION");
};
export default function NativeRecordProbe() {
  const query = useLocalSearchParams<{
    run?: string;
    runId?: string;
    menu?: string;
  }>();
  const [defaultRunId] = useState(
    () => `${Platform.OS}-native-${randomUUID()}`,
  );
  const runId =
    query.runId && /^[a-z0-9_-]{1,60}$/i.test(query.runId)
      ? query.runId
      : defaultRunId;
  const [report, setReport] = useState<Report | null>(null);
  const busy = useRef(false),
    alive = useRef(true),
    started = useRef<string | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = useCallback(async () => {
    if (!__DEV__ || Platform.OS === "web" || busy.current) return;
    if (activeProbeRuns.has(runId)) return;
    busy.current = true;
    activeProbeRuns.add(runId);
    const value: Report = {
      version: 1,
      synthetic: true,
      platform: Platform.OS,
      runId,
      startedAt: new Date().toISOString(),
      status: "running",
      phase: "local_config",
      passed: [],
    };
    const output = `${FileSystem.documentDirectory}native-record-probe-${runId}.json`;
    const privateOutput = `${FileSystem.documentDirectory}native-record-probe-private-${runId}.json`;
    const source = `${FileSystem.cacheDirectory}native-record-probe-${runId}.png`;
    const users: string[] = [];
    let guardUri: string | null = null;
    const publish = async () => {
      await FileSystem.writeAsStringAsync(
        output,
        JSON.stringify(value, null, 2),
      );
      if (alive.current) setReport({ ...value, passed: [...value.passed] });
    };
    const phase = async (name: string) => {
      value.phase = name;
      await publish();
    };
    const pass = async (name: string) => {
      value.passed.push(name);
      await publish();
    };
    try {
      const existing = await Promise.all([
        FileSystem.getInfoAsync(output),
        FileSystem.getInfoAsync(privateOutput),
      ]);
      if (existing.some((file) => file.exists)) {
        value.status = "failed";
        value.phase = "existing_run_use_new_id";
        if (alive.current) setReport(value);
        return;
      }
      await publish();
      const response = await fetch("http://127.0.0.1:8766/config", {
        signal: AbortSignal.timeout(10000),
      });
      ensure(response.ok);
      const config = await response.json();
      // This diagnostic must never register synthetic accounts in the configured managed project.
      ensure(
        config.url === "http://127.0.0.1:54321" &&
          typeof config.publicKey === "string",
      );
      const client = () =>
        createClient(config.url, config.publicKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
      const signup = async (sdk: SupabaseClient) => {
        const { data, error } = await sdk.auth.signUp({
          email: `native-${randomUUID()}@example.test`,
          password: `${randomUUID()}Aa1!`,
          options: { data: { mogeum_native_probe: runId } },
        });
        ensure(!error && data.session && data.user);
        const owner = data.user!.id;
        users.push(owner);
        // IDs for host-side cleanup only. Never copy this file into public verification artifacts.
        await FileSystem.writeAsStringAsync(
          privateOutput,
          JSON.stringify({ runId, userIds: users }),
        );
        return owner;
      };
      const a = client(),
        b = client();
      await phase("isolated_auth");
      const owner = await signup(a),
        other = await signup(b);
      ensure(owner !== other);
      await pass("real_local_auth_two_owners");
      await phase("native_photo_prepare");
      await FileSystem.downloadAsync(
        "http://127.0.0.1:8765/light.png",
        source,
        { sessionType: FileSystem.FileSystemSessionType.FOREGROUND },
      );
      const operation = randomUUID();
      const prepared = await preparePhoto(source, 1200, 1600, operation);
      const pending: PendingRecord = {
        version: 1,
        ownerId: owner,
        operationId: operation,
        localPhoto: prepared.localUri,
        input: {
          enteredName: "Native synthetic whisky",
          category: "whisky",
          revisit: "again",
          photo: {
            storagePath: `${owner}/records/${operation}/photo.jpg`,
            width: prepared.width,
            height: prepared.height,
          },
        },
      };
      ensure((await FileSystem.getInfoAsync(source)).exists);
      decodePendingRecord(
        JSON.stringify(pending),
        owner,
        FileSystem.documentDirectory,
      );
      const key = `mogeum-pending-v1-${owner}`;
      ensure((await AsyncStorage.getItem(key)) === null);
      const repo = createRecordRepository(a);
      let lose = true;
      const ports = {
        ownerId: () => owner,
        read: () => readPending(owner),
        write: async (p: PendingRecord) => {
          decodePendingRecord(
            JSON.stringify(p),
            owner,
            FileSystem.documentDirectory,
          );
          await AsyncStorage.setItem(key, JSON.stringify(p));
        },
        upload: async (path: string, uri: string) => {
          const file = await fetch(uri);
          ensure(file.ok);
          const bytes = await file.arrayBuffer();
          ensure(bytes.byteLength > 0 && bytes.byteLength <= 10 * 1024 * 1024);
          try {
            await repo.uploadPhoto(path, bytes, "image/jpeg");
          } catch (e) {
            if (Number((e as { statusCode?: string }).statusCode) !== 409)
              throw e;
          }
        },
        save: async (
          id: string,
          input: PendingRecord["input"],
          entryId: string | null,
        ) => {
          const saved = await repo.save(id, input, entryId);
          if (lose) {
            lose = false;
            throw new Error("SYNTHETIC_RESPONSE_LOSS");
          }
          return saved;
        },
      };
      await phase("upload_commit_response_loss");
      let lost = false;
      try {
        await submitPending(pending, ports);
      } catch (e) {
        if (e instanceof Error && e.message === "SYNTHETIC_RESPONSE_LOSS")
          lost = true;
        else throw e;
      }
      ensure(lost && !(await readPending(owner))?.saved);
      const saved = await submitPending(pending, ports);
      ensure(
        saved.replayed &&
          (await readPending(owner))?.saved?.recordId === saved.recordId,
      );
      await pass("native_upload_rpc_durable_replay");
      await phase("private_photo_and_rls");
      const urls = await tastePhotoUrls(a, owner, [saved.recordId]);
      ensure(
        typeof urls[saved.recordId] === "string" &&
          (await fetch(urls[saved.recordId])).ok,
      );
      const foreign = await b
        .from("tasting_records")
        .select("id")
        .eq("id", saved.recordId);
      ensure(!foreign.error && foreign.data?.length === 0);
      ensure(
        Object.keys(await tastePhotoUrls(b, owner, [saved.recordId])).length ===
          0,
      );
      const denied = await b.storage
        .from("record-photos")
        .download(pending.input.photo!.storagePath);
      ensure(denied.error && !denied.data);
      await pass("real_binary_read_and_foreign_owner_denied");
      await phase("native_cellar_batch_read");
      const cellar = await loadCellar(owner, {
        page: (from, size) => repo.listCellar(from, size),
        photos: (paths) => repo.photoUrls(owner, paths),
        active: () => alive.current,
      });
      const cellarItem = cellar?.find(
        (item) => item.id === saved.cellarEntryId,
      );
      ensure(cellarItem?.photoUri && (await fetch(cellarItem.photoUri)).ok);
      await pass("native_cellar_batch_read_binary");
      const context = await loadTasteContext(a);
      ensure(analyzeTaste(context.snapshot).facts.length === 0);
      await pass("photo_only_has_no_sensory_evidence");
      await phase("canonical_photo_cleanup");
      guardUri = `${FileSystem.documentDirectory}record-drafts/${randomUUID()}.jpg`;
      await FileSystem.writeAsStringAsync(guardUri, "owned synthetic guard");
      // A stale caller URI must not decide which file completion deletes.
      await finishPending({ ...pending, localPhoto: guardUri });
      await phase("canonical_pending_removed");
      ensure((await readPending(owner)) === null);
      await phase("canonical_photo_removed");
      ensure(!(await FileSystem.getInfoAsync(prepared.localUri)).exists);
      await phase("canonical_unrelated_files_preserved");
      ensure(
        (await FileSystem.getInfoAsync(guardUri)).exists &&
          (await FileSystem.getInfoAsync(source)).exists,
      );
      await pass("stored_operation_file_only_cleanup");
      if (query.menu === "1") {
        value.menu = await probeNativeMenu({
          client: a,
          foreign: b,
          owner,
          recordId: saved.recordId,
          revision: saved.revision,
          phase,
          pass,
        });
      }
      await phase("record_and_binary_delete");
      const detail = await loadRecordDetail(a, owner, {
        recordId: saved.recordId,
      });
      await deleteExperience(a, owner, detail.record);
      await drainPhotoDeletions(a, owner);
      const removed = await a.storage
        .from("record-photos")
        .download(pending.input.photo!.storagePath);
      ensure(removed.error && !removed.data);
      await pass("real_record_delete_and_storage_cleanup");
      value.status = "completed";
      value.phase = "completed";
      value.finishedAt = new Date().toISOString();
    } catch {
      value.status = "failed";
      value.finishedAt = new Date().toISOString();
    } finally {
      await FileSystem.deleteAsync(source, { idempotent: true }).catch(
        () => {},
      );
      if (guardUri)
        await FileSystem.deleteAsync(guardUri, { idempotent: true }).catch(
          () => {},
        );
      busy.current = false;
      activeProbeRuns.delete(runId);
      if (value.phase !== "existing_run_use_new_id")
        await publish().catch(() => {
          if (alive.current)
            setReport({
              ...value,
              status: "failed",
              phase: "report_write_failed",
            });
        });
    }
  }, [runId, query.menu]);
  useEffect(() => {
    if (query.run === "1" && started.current !== runId && !busy.current) {
      started.current = runId;
      void run();
    }
  }, [query.run, runId, run, report?.status]);
  if (!__DEV__ || Platform.OS === "web") return <Redirect href="/" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          네이티브 실제 서버 검증
        </Text>
        <Text>
          개발 전용 · 로컬 합성 계정과 사진 · 운영 프로젝트 사용 안 함
        </Text>
        <Button
          label={
            report?.status === "running"
              ? "검증 중"
              : report?.status === "completed"
                ? "검증 완료"
                : "검증 시작"
          }
          disabled={
            report?.status === "running" ||
            report?.status === "completed" ||
            report?.phase === "existing_run_use_new_id"
          }
          onPress={() => void run()}
        />
        <Text>
          {report?.status} · {report?.phase}
        </Text>
        {report?.passed.map((item) => (
          <Text key={item}>✓ {item}</Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
