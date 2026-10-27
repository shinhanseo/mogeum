import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, fonts, layout, radius, space, typography } from '../../theme/tokens';
import type { CellarDeletionContext } from './deletion';
export function CellarManageScreen({ context, onClose, onRecords, onDelete, onReload, initialConfirm = false }: { context: CellarDeletionContext; onClose: () => void; onRecords: (id: string | null) => void; onDelete: () => Promise<void>; onReload: () => void; initialConfirm?: boolean }) {
  const [confirm, setConfirm] = useState(initialConfirm), [busy, setBusy] = useState(false), [error, setError] = useState(''), [conflict, setConflict] = useState(false), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await onDelete(); }
    catch (e) {
      const changed = (e as { code?: string }).code === '40001';
      setConflict(changed); setUncertain(!changed);
      setError(changed ? '연결된 기록이 바뀌었어요. 최신 기록 수를 확인하고 다시 선택해주세요.' : '삭제 결과를 확인하지 못했어요. 같은 삭제 요청으로 다시 확인해주세요.');
    } finally { lock.current = false; setBusy(false); }
  }
  return <SafeAreaView style={s.page}><ScreenHeader title="술 관리" onBack={busy ? undefined : onClose} onClose={busy ? undefined : onClose} /><ScrollView contentContainerStyle={s.content}>
    <Text style={s.heading}>{context.deleted ? '이미 삭제된 술이에요' : context.name || '이름 없는 술'}</Text>
    {context.deleted ? <Button label="술장으로 돌아가기" onPress={onClose} /> : <>
      <Text style={s.body}>이 술에 남긴 기록 {context.count}개</Text>
      {!confirm ? <>
        <View style={s.card}><Text style={s.label}>기록을 하나씩 관리하기</Text><Text style={s.body}>특정 날짜의 사진이나 노트만 수정·삭제할 수 있어요.</Text><Button label={context.count > 1 ? '날짜별 기록 수정·삭제' : '기록 수정·삭제'} variant="secondary" disabled={!context.latestRecordId} onPress={() => onRecords(context.latestRecordId)} /></View>
        <View style={s.card}><Text style={s.label}>술장에서 이 술 삭제</Text><Text style={s.body}>이 술과 연결된 모든 날짜의 기록을 함께 지워요.</Text><Button label="술 전체 삭제…" variant="text" onPress={() => setConfirm(true)} /></View>
      </> : <View style={[s.card, s.confirm]}><Text style={s.label}>이 술과 기록 {context.count}개를 삭제할까요?</Text><Text style={s.body}>연결된 사진과 테이스팅 노트도 모두 삭제돼요. 삭제한 내용은 되돌릴 수 없어요.</Text><Text style={s.body}>다른 술의 기록은 그대로 남아요.</Text>
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        {conflict ? <Button label="최신 기록 다시 확인" onPress={onReload} /> : <Button label={uncertain ? '같은 삭제 요청으로 다시 확인' : `이 술과 기록 ${context.count}개 삭제`} loading={busy} onPress={() => void remove()} />}
        <Button label={uncertain || conflict ? '술장으로 돌아가기' : '취소'} variant="secondary" disabled={busy} onPress={uncertain || conflict ? onClose : () => setConfirm(false)} />
      </View>}
    </>}
  </ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.background }, content: { padding: layout.screenPadding, gap: space.lg, width: '100%', maxWidth: 600, alignSelf: 'center' }, heading: { ...typography.question, color: colors.text }, body: { ...typography.body, color: colors.muted }, label: { ...typography.fieldLabel, fontFamily: fonts.bold, color: colors.text }, card: { padding: space.lg, gap: space.md, borderRadius: radius.md, backgroundColor: colors.surface }, confirm: { backgroundColor: colors.selected }, error: { ...typography.body, color: colors.primary } });
