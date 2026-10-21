import { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/features/auth/AuthProvider';
import { readPending, preparePhoto, savePending, finishPending } from '../src/features/records/device';
import type { PendingRecord } from '../src/features/records/pending';
import type { RecordInput } from '../src/features/records/repository';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { ChoiceChip } from '../src/components/ChoiceChip';
import { RatingStar } from '../src/components/RatingStar';
import { Mogu } from '../src/components/Mogu';
import { ScreenHeader, WebStatusSpace } from '../src/components/ScreenHeader';
import { categories, type Category } from '../src/features/cellar/model';
import { colors, fonts, typography } from '../src/theme/tokens';

type Step = 'start' | 'info' | 'rating';
type Sheet = 'category' | 'date' | 'vintage' | null;
export default function RecordScreen() {
  const auth = useAuth();
  if (auth.status === 'loading') return <View style={{ flex:1, backgroundColor:colors.background }} />;
  if (auth.status !== 'signed-in') return <Redirect href="/login" />;
  return <RecordComposer key={auth.session.user.id} owner={auth.session.user.id} />;
}
function RecordComposer({ owner }: { owner:string }) {
  const router = useRouter();
  const ownerRef = useRef<string | null>(owner);
  useEffect(() => { ownerRef.current = owner; return () => { ownerRef.current = null; }; }, [owner]);
  const busyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [pending, setPending] = useState<PendingRecord | null>(null);
  const [step, setStep] = useState<Step>('start');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [sheet, setSheetValue] = useState<Sheet>(null);
  const [lastSheet, setLastSheet] = useState<Exclude<Sheet, null>>('category');
  const activeSheet = sheet ?? lastSheet;
  function setSheet(value: Sheet) { if (value) setLastSheet(value); setSheetValue(value); }
  const [date, setDate] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date());
  const [vintage, setVintage] = useState('');
  const [vintageMode, setVintageMode] = useState<'year' | 'NV' | 'unknown'>('year');
  const [vintageYear, setVintageYear] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (owner) void readPending(owner).then(value => {
      if (!active || !value) return;
      setPending(value); setName(value.input.enteredName ?? '');
      const kinds = { whisky: '위스키', wine: '와인', beer: '맥주', traditional: '전통주', other: '기타' } as const;
      setCategory(value.input.category ? kinds[value.input.category] : null);
      const feelings = { again: '또 마시고 싶어요', okay: '괜찮아요', not_for_me: '내 취향이 아니에요' };
      setFeeling(value.input.revisit ? feelings[value.input.revisit] : null); setStars(value.input.rating ?? 0);
      if (value.input.consumedAt) setDate(new Date(value.input.consumedAt));
      if (value.localPhoto && value.input.photo) setPhoto({ uri: value.localPhoto, width: value.input.photo.width, height: value.input.photo.height });
      setVintage(value.input.vintageStatus === 'year' ? String(value.input.vintageYear) : value.input.vintageStatus === 'nv' ? 'NV' : value.input.vintageStatus === 'unknown' ? '모름' : '');
      setStep('rating');
    }).catch(() => { if (active) setError('저장 중인 기록을 불러오지 못했어요. 다시 열어주세요.'); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [owner]);
  const close = () => { if (!busyRef.current) router.back(); };
  const back = () => { if (busyRef.current) return; if (pending) { setError('저장 중인 기록을 먼저 완료해주세요.'); return; } if (step === 'start') close(); else setStep(step === 'rating' ? 'info' : 'start'); };
  const dateLabel = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
  async function pickPhoto(camera = false) {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setError('촬영하려면 카메라 접근을 허용해주세요.'); return; }
      const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: false, quality: 0.85 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) { setPhoto(result.assets[0]); setStep('info'); }
    } catch { setError('사진을 열지 못했어요. 접근 권한을 확인하고 다시 시도해주세요.'); }
  }

  async function saveRecord(withNote = false) {
    if (busyRef.current) return;
    if (!owner) { router.push('/login'); return; }
    if (!pending && !photo && !name.trim()) { setError('사진이나 술 이름을 남겨주세요.'); return; }
    if (!pending && (name.trim().length > 200 || (category === '와인' && vintage && vintage !== 'NV' && vintage !== '모름' && Number(vintage) < 1))) { setError('술 이름과 빈티지를 확인해주세요.'); return; }
    if (!pending && !feeling) { setError('이 술이 어땠는지 골라주세요.'); return; }
    if (withNote && (!category || category === '기타')) { if(pending){setError('저장 중인 기록을 먼저 완료해주세요. 술 종류는 저장 후 보완할 수 있어요.');return;} setStep('info');setSheet('category');setError('테이스팅 노트를 쓸 술 종류를 골라주세요.');return; }
    busyRef.current = true; setSaving(true); setError('');
    try {
      let operation = pending;
      if (!operation) {
        const operationId = Crypto.randomUUID();
        const input: RecordInput = { consumedAt: date.toISOString() };
        if (name.trim()) input.enteredName = name.trim();
        if (category) input.category = ({ 위스키:'whisky', 와인:'wine', 맥주:'beer', 전통주:'traditional', 기타:'other' } as const)[category];
        input.revisit = ({ '또 마시고 싶어요':'again', '괜찮아요':'okay', '내 취향이 아니에요':'not_for_me' } as const)[feeling as '또 마시고 싶어요'];
        if (stars) input.rating = stars;
        if (category === '와인' && vintage) {
          input.vintageStatus = vintage === 'NV' ? 'nv' : vintage === '모름' ? 'unknown' : 'year';
          if (input.vintageStatus === 'year') input.vintageYear = Number(vintage);
        }
        operation = { version:1, ownerId:owner, operationId, input };
        if (photo) {
          const prepared = await preparePhoto(photo.uri, photo.width, photo.height, operationId);
          operation.localPhoto = prepared.localUri;
          input.photo = { storagePath:`${owner}/records/${operationId}/photo.jpg`, width:prepared.width, height:prepared.height };
        }
        setPending(operation);
      }
      const saved = await savePending(operation, () => ownerRef.current);
      await finishPending(operation);
      if (ownerRef.current === owner) {
        if(withNote) router.replace({pathname:'/tasting',params:{recordId:saved.recordId}});
        else router.replace({pathname:'/detail',params:{recordId:saved.recordId}});
      }
    } catch { setError('저장을 완료하지 못했어요. 사진과 입력을 확인한 뒤 같은 기록으로 다시 시도해주세요.'); }
    finally { busyRef.current = false; setSaving(false); }
  }
  if (restoring) return <View style={styles.page} />;
  const summary = <View style={styles.summary}>
    {photo ? <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.photo} accessibilityLabel="선택한 술 사진" /> : <View style={[styles.photo, styles.noPhoto]}><Text style={styles.caption}>사진 없이{`\n`}남기는 한 잔</Text></View>}
    <View style={styles.summaryText}>{step === 'info' ? <><Text style={styles.title}>오늘의 한 잔</Text><Text style={styles.body}>{photo ? '사진으로 가볍게 남겨요.' : '이름으로 가볍게 남겨요.'}</Text><Button label="사진 변경" variant="text" onPress={() => pickPhoto()} style={styles.changePhoto} /></> : <><Text style={styles.caption}>{category ?? '종류 미정'}</Text><Text style={styles.title} numberOfLines={3}>{name || '이름 없는 술'}</Text><Text style={styles.caption}>{dateLabel}{category === '와인' && vintage ? ` · ${vintage}` : ''}</Text></>}</View>
  </View>;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <WebStatusSpace /><ScreenHeader title={step === 'start' ? '한 잔 기록' : step === 'info' ? (category === '와인' ? '기록하기' : '사진 확인') : '기록하기'} onBack={back} onClose={close} />
    <ScrollView pointerEvents={saving ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {step === 'start' ? <View style={styles.start}>
        <Text style={styles.display}>오늘의 한 잔을{`\n`}사진으로 남겨볼까?</Text><Text style={[styles.body, { marginTop: 8 }]}>잘 찍은 사진이 아니어도 괜찮아요.</Text>
        <View style={styles.hero}><Mogu /><Text style={[styles.body, { marginTop: 24 }]}>사진 한 장이면 시작할 수 있어요</Text><Text style={[styles.caption, { marginTop: 8 }]}>이름과 느낌은 천천히 채워요.</Text></View>
        <View style={styles.startActions}><Button label="앨범에서 사진 선택" onPress={() => pickPhoto()} /><Button label="카메라로 촬영" variant="secondary" onPress={() => pickPhoto(true)} /><Pressable accessibilityRole="button" onPress={() => setStep('info')} style={styles.nameOnly}><Text style={styles.nameOnlyText}>사진 없이 이름으로 기록</Text></Pressable></View>
        <Text style={styles.private}>내 기록은 기본적으로 나만 볼 수 있어요.</Text>
      </View> : <View style={styles.form}>
        {summary}
        {step === 'info' ? <><View style={styles.fields}><View><Text style={styles.label}>술 이름</Text><TextInput accessibilityLabel="술 이름" maxLength={200} value={name} onChangeText={setName} placeholder="술 이름을 입력해주세요" placeholderTextColor={colors.muted} style={styles.input} /></View>
          <View><Text style={styles.label}>술 종류</Text><Button label={`${category ?? '종류 선택'}  ›`} variant="secondary" onPress={() => setSheet('category')} /></View>
          {category === '와인' && <View><Text style={styles.label}>빈티지 · 선택</Text><Button label={`${vintage || '연도 · NV · 모름'}  ›`} variant="secondary" onPress={() => setSheet('vintage')} /></View>}
          <View><Text style={styles.label}>언제 마셨나요?</Text><Button label={`${dateLabel}  ›`} variant="secondary" onPress={() => { setMonth(new Date(date)); setSheet('date'); }} /></View></View>
          <Text style={[styles.caption, { marginTop: 28 }]}>다음에서 간단한 평가를 남겨요.</Text><View style={styles.bottomAction}><Button label="다음" onPress={() => setStep('rating')} /></View>
        </> : <><View style={styles.feelings}><Text style={styles.title}>이 술, 어땠어요?</Text>{['또 마시고 싶어요', '괜찮아요', '내 취향이 아니에요'].map(value => <ChoiceChip key={value} label={value} selected={feeling === value} onPress={() => { if (!pending) setFeeling(value); }} style={{ minHeight: 44, paddingVertical: 10 }} />)}</View>
          <View style={styles.rating}><Text style={[styles.label, { marginBottom: 0 }]}>별점</Text><Text style={styles.caption}>원할 때만 남겨주세요.</Text><View style={styles.starRow}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`별점 ${n}점`} accessibilityState={{ selected: stars === n }} onPress={() => { if (!pending) setStars(n); }} style={styles.starButton}><RatingStar filled={stars >= n} /></Pressable>)}</View>{stars > 0 && <Pressable accessibilityRole="button" accessibilityLabel="별점 지우기" onPress={() => { if (!pending) setStars(0); }}><Text style={styles.clear}>{stars}점 · 지우기</Text></Pressable>}</View>
          <View style={[styles.bottomAction, { marginBottom: 4 }]}><Text style={styles.connection}>{pending ? '저장 중인 원래 기록으로 다시 시도해요.' : '내 계정에 안전하게 보관해요.'}</Text><Button label={owner ? '기록 저장' : '로그인하고 저장'} loading={saving} onPress={() => saveRecord()} /><Button label="저장하고 테이스팅 노트 쓰기" variant="secondary" disabled={saving} onPress={() => saveRecord(true)} /></View>
        </>}
      </View>}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}><View style={styles.modalRoot}><Pressable accessibilityLabel="선택 닫기" accessibilityRole="button" style={styles.scrim} onPress={() => setSheet(null)} /><View accessibilityViewIsModal style={styles.sheet}><View style={styles.handle} />
      <Text style={styles.title}>{activeSheet === 'category' ? '어떤 종류의 술인가요?' : activeSheet === 'date' ? '언제 마셨나요?' : '어느 해의\n와인인가요?'}</Text>
      {activeSheet === 'category' ? <View style={styles.sheetOptions}>{([...categories, '기타'] as const).map(value => <ChoiceChip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} style={{ minHeight: 44, paddingVertical: 10 }} />)}</View> : activeSheet === 'vintage' ? <View style={styles.vintageForm}><Text style={styles.caption}>빈티지</Text><View style={styles.vintageModes}>{([['year', '연도 입력'], ['NV', 'NV'], ['unknown', '모름']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selected={vintageMode === value} onPress={() => setVintageMode(value)} style={{ flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8 }} />)}</View>{vintageMode === 'year' && <><Text style={[styles.caption, { marginTop: 8 }]}>생산연도 · 예: 2020</Text><TextInput accessibilityLabel="빈티지 연도" value={vintageYear} onChangeText={text => setVintageYear(text.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="연도 입력" style={styles.vintageInput} /></>}</View> : <View style={styles.calendar}>
        <View style={styles.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={styles.monthArrow}>‹</Text></Pressable><Text style={styles.label}>{month.getFullYear()}년 {month.getMonth() + 1}월</Text><Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={styles.monthArrow}>›</Text></Pressable></View>
        <View style={styles.days}>{['일', '월', '화', '수', '목', '금', '토'].map(day => <Text key={day} style={styles.dayLabel}>{day}</Text>)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, i) => <View key={`blank-${i}`} style={styles.day} />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const day = i + 1; const selected = date.getDate() === day && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(); return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${month.getFullYear()}년 ${month.getMonth() + 1}월 ${day}일`} accessibilityState={{ selected }} style={styles.day} onPress={() => setDate(new Date(month.getFullYear(), month.getMonth(), day))}><Text style={[styles.dayText, selected && styles.daySelected]}>{day}</Text></Pressable>; })}</View>
      </View>}
      <Button label={activeSheet === 'category' ? '이 종류로 선택' : activeSheet === 'date' ? '이 날짜로 선택' : '빈티지 적용'} disabled={activeSheet === 'vintage' && vintageMode === 'year' && (vintageYear.length !== 4 || Number(vintageYear) < 1)} onPress={() => { if (activeSheet === 'vintage') setVintage(vintageMode === 'year' ? vintageYear : vintageMode === 'NV' ? 'NV' : '모름'); setSheet(null); }} />
    </View></View></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, scroll: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingBottom: 48 },
  start: { paddingHorizontal: 24, paddingTop: 24 }, display: { ...typography.display, color: colors.text }, title: { ...typography.title, color: colors.text }, body: { ...typography.body, color: colors.muted }, caption: { ...typography.caption, color: colors.muted },
  hero: { marginTop: 28, minHeight: 306, borderRadius: 24, backgroundColor: colors.illustration, alignItems: 'center', justifyContent: 'center', paddingTop: 24, paddingBottom: 36 },
  startActions: { marginTop: 35, gap: 12 }, nameOnly: { minHeight: 52, justifyContent: 'center', alignItems: 'center' }, nameOnlyText: { fontSize: 13, lineHeight: 22, color: colors.primary, fontFamily: fonts.regular }, private: { marginTop: 10, fontSize: 11, lineHeight: 18, color: colors.muted, textAlign: 'center', fontFamily: fonts.regular },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 24 }, summary: { flexDirection: 'row', gap: 16, minHeight: 128 }, photo: { width: 96, height: 128, borderRadius: 8 }, noPhoto: { backgroundColor: colors.illustration, justifyContent: 'center', alignItems: 'center' }, summaryText: { flex: 1, minWidth: 0, justifyContent: 'space-between', paddingVertical: 8 }, changePhoto: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 36, paddingVertical: 4 },
  fields: { marginTop: 24, gap: 24 }, label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.text, marginBottom: 6 }, input: { minHeight: 52, backgroundColor: colors.selected, borderRadius: 16, paddingHorizontal: 16, color: colors.primary, fontFamily: fonts.bold, fontSize: 15, textAlign: 'center' }, bottomAction: { marginTop: 'auto', paddingTop: 32, gap: 8 },
  feelings: { marginTop: 24, gap: 12 }, rating: { marginTop: 24, gap: 3 }, starRow: { flexDirection: 'row', width: 280, maxWidth: '100%', marginTop: 8 }, starButton: { width: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, clear: { ...typography.caption, color: colors.primary, paddingVertical: 8 }, connection: { fontSize: 11, lineHeight: 18, color: colors.muted, textAlign: 'center', fontFamily: fonts.regular }, error: { ...typography.caption, color: colors.primary, padding: 24 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' }, scrim: { ...StyleSheet.absoluteFill, backgroundColor: '#00000055' }, sheet: { backgroundColor: colors.surface, padding: 24, paddingBottom: 56, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 16, width: '100%', maxWidth: 600, alignSelf: 'center' }, handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: -12 }, sheetOptions: { gap: 8 }, vintageForm: { gap: 8 }, vintageModes: { flexDirection: 'row', gap: 8 }, vintageInput: { minHeight: 52, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, fontSize: 14, color: colors.text, fontFamily: fonts.regular }, calendar: { gap: 12 }, monthRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, monthArrow: { fontSize: 28, color: colors.text, paddingHorizontal: 12 }, days: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: `${100 / 7}%`, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, dayLabel: { minHeight: 20, width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12 }, dayText: { fontSize: 14, lineHeight: 40, width: 40, textAlign: 'center', fontFamily: fonts.regular, color: colors.text }, daySelected: { borderRadius: 12, backgroundColor: colors.selected, color: colors.primary },
});
