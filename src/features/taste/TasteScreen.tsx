import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Mogu } from '../../components/Mogu';
import { Icon } from '../../components/Icon';
import { colors, fonts, layout, radius, space, typography } from '../../theme/tokens';
import { analyzeTaste, selectedFacts, type TasteContext } from './repository';

type Props = {
  context: TasteContext | null;
  photos?: Record<string, string>;
  busy?: boolean;
  error?: string;
  onGenerate: () => void;
  onEvidence: (factId?: string) => void;
  onRecord: () => void;
  onOpen: (id: string) => void;
  onMenu?: () => void;
  onNext?: () => void;
  onAccount?: () => void;
};
export function TasteScreen({ context, photos = {}, busy = false, error = '', onGenerate, onEvidence, onRecord, onOpen, onMenu, onNext, onAccount }: Props) {
  const analysis = context ? analyzeTaste(context.snapshot) : null;
  const facts = analysis && !context?.stale ? selectedFacts(analysis, context?.cached ?? null) : [];
  const ready = facts.length > 0;
  const first = analysis?.stage === 'early';
  const ids = [...new Set(facts.flatMap(f => f.positiveIds))];
  const records = context?.snapshot.records.filter(record => ids.includes(record.id)) ?? [];
  const candidates = analysis?.facts.some(fact => fact.positiveIds.length > 0) ?? false;
  const status = context?.stale ? '업데이트 필요' : ready ? (first ? '첫 발견' : '취향 요약') : '시작하기';
  const headline = ready ? facts[0].label : analysis?.recordCount ? '기록 속 취향을\n찾아볼까요?' : '한 잔의 느낌부터\n모아볼까요?';
  return <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
    <View style={s.header}>
      <Text style={s.heading}>내 취향</Text>
      {onAccount ? <Pressable accessibilityRole="button" accessibilityLabel="계정 관리" onPress={onAccount} style={s.account}><Text style={s.link}>계정 관리</Text></Pressable> : null}
    </View>
    <View style={s.summary}>
      <View style={s.heroTop}><Text style={s.eyebrow}>모구의 취향 노트</Text><View style={s.badge}><Text style={s.badgeText}>{status}</Text></View></View>
      <View style={s.heroBody}>
        <View style={s.copy}>{ready ? <Pressable accessibilityRole="button" accessibilityLabel={`${facts[0].label} 근거 보기`} onPress={() => onEvidence(facts[0].id)}><Text style={s.statement}>{headline}</Text><Text style={s.heroHint}>좋게 남긴 기록에서 찾았어요. ›</Text></Pressable> : <><Text style={s.statement}>{headline}</Text><Text style={s.heroHint}>{analysis?.recordCount ? '느낀 특징과 좋아한 느낌을 함께 살펴봐요.' : '사진에 느낌을 더하면 취향이 보여요.'}</Text></>}</View>
        <View style={s.character}><View style={s.scaled}><Mogu /></View></View>
      </View>
      <View style={s.heroMeta}>
        <Text style={s.meta}>{analysis ? `느낌을 남긴 ${analysis.recordCount}잔` : '기록을 불러오는 중'}</Text>
        {analysis ? <Text style={s.meta}>서로 다른 술 {analysis.drinkCount}종</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    </View>
    {context?.stale ? <Text style={s.notice}>새 기록이 생겼어요. 최신 느낌으로 다시 살펴봐요.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={s.notice}>{error}</Text> : null}
    {busy ? <View accessibilityRole="progressbar" style={s.loading}><ActivityIndicator color={colors.primary} /><Text style={s.caption}>기록 속 공통점을 찾고 있어요.</Text></View> : null}
    {!context && error ? <Button label="기록 다시 불러오기" onPress={onGenerate} /> : !ready && candidates ? <Button label={context?.stale ? '최신 기록으로 다시 요약하기' : '내 기록으로 AI 취향 요약'} loading={busy} onPress={onGenerate} /> : !ready && context ? <Button label={context.snapshot.totalRecords ? '내 기록에 느낌 남기기' : '첫 한 잔 남기기'} onPress={onRecord} /> : null}
    {ready ? <View style={s.section}>
      {facts.length > 1 ? <View style={s.chips}>{facts.slice(1).map(fact => <Pressable accessibilityRole="button" accessibilityLabel={`${fact.label} 근거 보기`} key={fact.id} style={s.chip} onPress={() => onEvidence(fact.id)}><Text style={s.chipText}>{fact.label}</Text></Pressable>)}</View> : null}
      <View style={s.sectionHeading}><Text style={s.label}>취향의 근거가 된 한 잔</Text><Pressable accessibilityRole="button" onPress={() => onEvidence()} style={s.evidenceLink}><Text style={s.link}>기록 {ids.length}개 ›</Text></Pressable></View>
      {records.slice(0, 3).map(record => <Pressable accessibilityRole="button" accessibilityLabel={`${record.name || '이름 없는 술'} 기록 열기`} key={record.id} style={s.record} onPress={() => onOpen(record.id)}>
        {photos[record.id] ? <Image source={{ uri: photos[record.id] }} style={s.photo} resizeMode="contain" /> : <View style={[s.photo, s.placeholder]}><Icon name="photo" /></View>}
        <View style={s.recordCopy}><Text numberOfLines={2} style={s.recordName}>{record.name || '이름 없는 술'}</Text><Text style={s.caption}>{record.date.slice(0, 10).replace(/-/g, '.')} · 좋게 남긴 기록</Text><Text style={s.recordHint}>내가 남긴 느낌 다시 보기</Text></View><Text style={s.chevron}>›</Text>
      </Pressable>)}
      {analysis!.stage !== 'established' ? <Text style={s.caption}>아직 작은 발견이에요. 기록이 쌓이면 달라질 수 있어요.</Text> : null}
      {analysis!.facts.some(fact => fact.positiveIds.length && fact.negativeIds.length) ? <Button variant="text" label="다르게 남긴 느낌도 있어요 ›" onPress={() => onEvidence()} /> : null}
      {first ? <Button variant="text" label="내 기록에 느낌 더 남기기 ›" onPress={onRecord} /> : null}
    </View> : null}
    {context?.snapshot.omittedCount ? <Text style={s.caption}>감각 비교에는 최근 200개 기록을 사용했어요.</Text> : null}
    <View style={s.section}>
      <Text style={s.label}>취향으로 고르는 다음 한 잔</Text>
      <View style={s.destinations}>
        <TasteDestination icon="heart" title="다음 한 잔" description="내 기록과 닮은 술 둘러보기" disabled={!onNext} onPress={() => onNext?.()} />
        <View style={s.divider} />
        <TasteDestination icon="photo" title="메뉴판에서 찾기" description="지금 고를 수 있는 술과 비교하기" disabled={!onMenu} onPress={() => onMenu?.()} />
      </View>
      <Text style={s.caption}>추천은 출처를 확인한 술 정보와 내 기록을 비교해요.</Text>
    </View>
  </ScrollView>;
}
function TasteDestination({ icon, title, description, disabled, onPress }: { icon: 'heart' | 'photo'; title: string; description: string; disabled: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={`${title}, ${description}`} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.destination, pressed && s.pressed, disabled && s.disabled]}><View style={s.destinationIcon}><Icon name={icon} color={colors.primary} /></View><View style={s.recordCopy}><Text style={s.recordName}>{title}</Text><Text style={s.caption}>{description}</Text></View><Text style={s.chevron}>›</Text></Pressable>;
}
const s = StyleSheet.create({
  content: { padding: layout.screenPadding, gap: space.xl, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  heading: { ...typography.heading, color: colors.text },
  account: { minHeight: 44, justifyContent: 'center', paddingLeft: space.md },
  link: { ...typography.caption, color: colors.primary, fontFamily: fonts.bold },
  summary: { padding: space.xl, gap: space.lg, borderRadius: radius.lg, backgroundColor: colors.selected },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  eyebrow: { ...typography.caption, fontFamily: fonts.bold, color: colors.primary },
  badge: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.surface },
  badgeText: { ...typography.caption, color: colors.primary },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  copy: { flex: 1, gap: space.sm },
  statement: { ...typography.question, color: colors.primary },
  heroHint: { ...typography.caption, color: colors.muted },
  character: { width: 88, height: 88 },
  scaled: { position: 'absolute', width: 170, height: 153, left: -41, top: -32, transform: [{ scale: .5 }] },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border },
  meta: { ...typography.caption, color: colors.primary },
  section: { gap: space.md },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  label: { ...typography.fieldLabel, fontFamily: fonts.bold, color: colors.text },
  evidenceLink: { minHeight: 44, justifyContent: 'center', paddingLeft: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, backgroundColor: colors.surface, minHeight: 44, justifyContent: 'center' },
  chipText: { ...typography.caption, color: colors.text },
  record: { flexDirection: 'row', alignItems: 'center', gap: space.lg, borderRadius: radius.md, backgroundColor: colors.surface, padding: space.md },
  photo: { width: 64, aspectRatio: 3 / 4, borderRadius: radius.sm, backgroundColor: colors.illustration },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  recordCopy: { flex: 1, gap: space.xs },
  recordName: { ...typography.fieldLabel, fontFamily: fonts.bold, color: colors.text },
  recordHint: { ...typography.caption, color: colors.primary },
  caption: { ...typography.caption, color: colors.muted },
  chevron: { ...typography.title, color: colors.primary },
  notice: { ...typography.body, color: colors.primary },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  destinations: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  destination: { minHeight: 76, flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  destinationIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.selected, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: space.lg },
  pressed: { opacity: .75 }, disabled: { opacity: .45 },
});
