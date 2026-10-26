import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { randomUUID } from 'expo-crypto';
import { createTastingDraftStorage } from '../../src/features/tasting/draft-storage';
import { newTastingDraft, restoredTastingView, setAnswer, type TastingDraft } from '../../src/features/tasting/draft';
import { choose, composeNote, emptyAnswer, textAnswer } from '../../src/features/tasting/answers';
import { questionsFor } from '../../src/features/tasting/questions';
import { parseTastingDraft } from '../../src/features/tasting/validate-draft';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ensure = (value: unknown) => { if (!value) throw new Error('PROBE_EXPECTATION'); };
type Manifest = { version: 1; synthetic: true; runId: string; owner: string; drafts: TastingDraft[] };
/** Owns fresh random synthetic draft keys only. No Auth client, remote request or user-key scan. */
export default function TastingRelaunchProbe() {
  const params = useLocalSearchParams<{ runId?: string; phase?: string }>();
  const runId = params.runId ?? '';
  const phase = params.phase ?? '';
  const started = useRef('');
  const [status, setStatus] = useState('개발용 native 초안 복구 검증');
  useEffect(() => {
    if (!__DEV__ || Platform.OS === 'web' || !/^[a-z0-9_-]{1,60}$/i.test(runId) || !['seed', 'verify'].includes(phase)) return;
    const attempt = `${runId}:${phase}`;
    if (started.current === attempt) return;
    started.current = attempt;
    let alive = true;
    const run = async () => {
      const directory = FileSystem.documentDirectory;
      ensure(directory);
      const manifestUri = `${directory}tasting-relaunch-private-${runId}.json`;
      const reportUri = `${directory}tasting-relaunch-report-${runId}.json`;
      const storage = createTastingDraftStorage(AsyncStorage);
      if (phase === 'seed') {
        ensure(!(await FileSystem.getInfoAsync(manifestUri)).exists);
        const owner = randomUUID();
        const drafts: TastingDraft[] = [];
        for (const category of ['whisky', 'wine', 'beer', 'traditional'] as const) {
          for (const mode of ['light', 'deep'] as const) {
            for (const stage of ['questions', 'preview', 'edit'] as const) {
              let draft = newTastingDraft(owner, randomUUID(), category, mode);
              // Keep both mode drafts populated to verify they remain independent after restart.
              for (const savedMode of ['light', 'deep'] as const) {
                draft = { ...draft, mode: savedMode };
                const questions = questionsFor(category, savedMode);
                const fields = questions.flatMap(question => question.fields);
                const text = fields.find(field => field.kind === 'text');
                const choice = fields.find(field => field.kind === 'choice' && !field.when && !field.unless);
                ensure(text && choice?.options?.length);
                draft = setAnswer(draft, text!.id, textAnswer(`합성 ${category} ${savedMode} 한글 답변 · 재실행 후 유지`));
                draft = setAnswer(draft, choice!.id, choose(emptyAnswer(), choice!, choice!.options![0].code));
                draft.modes[savedMode].currentQuestion = questions[questions.length - 1].id;
              }
              draft = { ...draft, mode, stage };
              draft.composition = { text: composeNote(draft), edited: false, sourceRevision: draft.revision, ...(stage === 'edit' ? { editBuffer: '' } : {}) };
              // Refuse the extremely unlikely collision rather than overwriting any existing draft.
              ensure(await storage.restore(owner, draft.recordId) === null);
              parseTastingDraft(JSON.stringify(draft), owner, draft.recordId);
              await storage.persist(draft);
              drafts.push(draft);
            }
          }
        }
        const manifest: Manifest = { version: 1, synthetic: true, runId, owner, drafts };
        await FileSystem.writeAsStringAsync(manifestUri, JSON.stringify(manifest));
        const report = { version: 1, synthetic: true, platform: Platform.OS, runId, phase: 'seeded', cases: drafts.length, status: 'ready_for_process_restart' };
        await FileSystem.writeAsStringAsync(reportUri, JSON.stringify(report));
        if (alive) setStatus(JSON.stringify(report, null, 2));
        return;
      }
      const manifest = JSON.parse(await FileSystem.readAsStringAsync(manifestUri)) as Manifest;
      ensure(manifest.version === 1 && manifest.synthetic === true && manifest.runId === runId && uuid.test(manifest.owner) && manifest.drafts.length === 24);
      let checked = 0;
      for (const expected of manifest.drafts) {
        ensure(uuid.test(expected.recordId) && expected.ownerId === manifest.owner);
        parseTastingDraft(JSON.stringify(expected), manifest.owner, expected.recordId);
        const actual = await storage.restore(manifest.owner, expected.recordId);
        ensure(actual && JSON.stringify(actual) === JSON.stringify(expected));
        ensure(restoredTastingView(actual!) === expected.stage);
        ensure(actual!.stage !== 'edit' || actual!.composition?.editBuffer === '');
        ensure(await storage.restore(`not-${manifest.owner}`, expected.recordId) === null);
        checked++;
      }
      const report = { version: 1, synthetic: true, platform: Platform.OS, runId, phase: 'verified', status: 'passed', cases: checked, categories: 4, modes: 2, stages: ['questions', 'preview', 'edit'], bothModeAnswersPreserved: true, emptyEditPreserved: true, wrongOwnerSeesNoDraft: true, uiInteractionVerified: false, serverWritePerformed: false };
      await FileSystem.writeAsStringAsync(reportUri, JSON.stringify(report));
      if (alive) setStatus(JSON.stringify(report, null, 2));
    };
    void run().catch(() => { if (alive) setStatus('failed · 합성 초안 복구 검증. 기존 초안은 지우지 않아요.'); });
    return () => { alive = false; };
  }, [runId, phase]);
  if (!__DEV__) return <Redirect href="/" />;
  return <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 72 }}><Text>개발 검증 · 실제 native 저장소 · 서버 저장 없음</Text><Text selectable>{status}</Text></ScrollView>;
}
