import type { NativeLine } from "../../modules/menu-ocr";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { Button } from "../../src/components/Button";
import { colors, typography } from "../../src/theme/tokens";
import manifest from "../../assets/fixtures/ocr-benchmark/manifest.json";
import type { BenchmarkCase } from "../../src/features/menu/benchmark-metrics";
const ocrBenchmarkFixtures = manifest as BenchmarkCase[];
import { benchmarkMetrics } from "../../src/features/menu/benchmark-metrics";
import {
  prepareMenuPhoto,
  readMenuPhoto,
} from "../../src/features/menu/device";
import { parseMenu } from "../../supabase/functions/_shared/menu-domain";
type Result = {
  id: string;
  engine?: string;
  prepareMs?: number;
  ocrMs?: number;
  parseMs?: number;
  metrics?: ReturnType<typeof benchmarkMetrics>;
  error?: string;
  rawNative?: {
    width: number;
    height: number;
    engine: string;
    lines: NativeLine[];
  };
  invalidPoints?: number;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  lines?: { text: string; confidence: number | null }[];
};
type Report = {
  version: 1;
  synthetic: true;
  platform: string;
  osVersion: string;
  runId: string;
  status: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  finishedAt?: string;
  cases: Result[];
};
const elapsed = (start: number) => Math.round(performance.now() - start);
export default function OcrBenchmark() {
  const query = useLocalSearchParams<{ run?: string; runId?: string }>(),
    router = useRouter();
  const runId =
    query.runId && /^[a-z0-9_-]{1,60}$/i.test(query.runId)
      ? query.runId
      : `${Platform.OS}-synthetic`;
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState("");
  const active = useRef(false),
    sequence = useRef(0),
    busy = useRef(false);
  const run = useCallback(async () => {
    if (!__DEV__ || busy.current || !active.current) return;
    busy.current = true;
    const token = ++sequence.current,
      session = randomUUID();
    const output = `${FileSystem.documentDirectory}ocr-benchmark-${runId}.json`;
    const value: Report = {
      version: 1,
      synthetic: true,
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      runId,
      status: "running",
      startedAt: new Date().toISOString(),
      cases: [],
    };
    const publish = async () => {
      await FileSystem.writeAsStringAsync(
        output,
        JSON.stringify(value, null, 2),
      );
      if (active.current && sequence.current === token)
        setReport({ ...value, cases: [...value.cases] });
    };
    try {
      setError("");
      await publish();
      for (const fixture of ocrBenchmarkFixtures) {
        if (!active.current || sequence.current !== token) {
          value.status = "cancelled";
          break;
        }
        const result: Result = { id: fixture.id };
        const source = `http://127.0.0.1:8765/${fixture.id}.png`;
        const cache = `${FileSystem.cacheDirectory}ocr-benchmark-${runId}-${fixture.id}.png`;
        try {
          const prepareStart = performance.now();
          let local = source;
          if (/^https?:/.test(source)) {
            await FileSystem.downloadAsync(source, cache);
            local = cache;
          }
          const prepared = await prepareMenuPhoto(
            "ocr-benchmark-fixture",
            session,
            local,
          );
          result.prepareMs = elapsed(prepareStart);
          const ocrStart = performance.now(),
            read = await readMenuPhoto(prepared, (raw) => {
              result.rawNative = raw;
              result.engine = raw.engine;
              result.lines = raw.lines.map((l) => ({
                text: l.text,
                confidence: l.confidence,
              }));
              const points = raw.lines.flatMap((l) => l.polygon);
              result.invalidPoints = points.filter(
                (p) =>
                  p.x < 0 ||
                  p.x > 1 ||
                  p.y < 0 ||
                  p.y > 1 ||
                  !Number.isFinite(p.x) ||
                  !Number.isFinite(p.y),
              ).length;
              if (points.length)
                result.bounds = {
                  minX: Math.min(...points.map((p) => p.x)),
                  maxX: Math.max(...points.map((p) => p.x)),
                  minY: Math.min(...points.map((p) => p.y)),
                  maxY: Math.max(...points.map((p) => p.y)),
                };
            });
          result.ocrMs = elapsed(ocrStart);
          result.engine = read.ocr!.engine;
          const parseStart = performance.now(),
            items = parseMenu([read.ocr!]);
          result.parseMs = elapsed(parseStart);
          result.metrics = benchmarkMetrics(fixture, read.ocr!, items);
          result.lines = read.ocr!.lines.map((l) => ({
            text: l.text,
            confidence: l.confidence,
          }));
        } catch (e) {
          result.error =
            e instanceof Error ? e.message.slice(0, 200) : "OCR_FAILED";
        } finally {
          await FileSystem.deleteAsync(cache, { idempotent: true }).catch(
            () => {},
          );
        }
        value.cases.push(result);
        await publish();
      }
      if (value.status === "running") value.status = "completed";
      value.finishedAt = new Date().toISOString();
      await publish();
    } catch (e) {
      value.status = "failed";
      value.finishedAt = new Date().toISOString();
      if (active.current)
        setError(e instanceof Error ? e.message : "REPORT_FAILED");
    } finally {
      await FileSystem.deleteAsync(
        `${FileSystem.documentDirectory}menu-drafts/ocr-benchmark-fixture/${session}/`,
        { idempotent: true },
      ).catch(() => {});
      busy.current = false;
    }
  }, [runId]);
  const stop = useCallback(() => {
    active.current = false;
    sequence.current++;
  }, []);
  useEffect(() => {
    active.current = true;
    const token = ++sequence.current;
    void Promise.resolve().then(() => {
      if (
        __DEV__ &&
        query.run === "1" &&
        active.current &&
        sequence.current === token
      )
        void run();
    });
    return stop;
  }, [query.run, run, stop]);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text style={typography.heading}>기기 OCR 개발 검증</Text>
        <Text style={typography.body}>
          합성 메뉴 14종 · 개인 사진/외부 AI 서버 미사용 · 실메뉴 정확도 지표
          아님
        </Text>
        <Text style={typography.caption}>
          {Platform.OS} · {report?.status ?? "idle"} ·{" "}
          {report?.cases.length ?? 0}/{ocrBenchmarkFixtures.length}
        </Text>
        <Button
          label="합성 메뉴 실제 OCR 실행"
          onPress={() => void run()}
          disabled={report?.status === "running"}
        />
        <Button label="닫기" variant="text" onPress={() => router.back()} />
        {report?.cases.map((c) => (
          <View key={c.id}>
            <Text style={typography.body}>
              {c.id} · {c.engine ?? "오류"} ·{" "}
              {c.ocrMs === undefined ? "미집계" : `${c.ocrMs}ms`}
            </Text>
            <Text style={typography.caption}>
              {c.error ??
                `이름 ${c.metrics?.namesObserved}/${c.metrics?.expectedEntries} · 가격 연결 ${c.metrics?.correctPrices}`}
            </Text>
          </View>
        ))}
        {!!error && (
          <Text accessibilityRole="alert" style={typography.body}>
            {error}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
