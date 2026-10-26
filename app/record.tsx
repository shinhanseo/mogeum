import { useScreenBack } from '../src/hooks/useScreenBack';
import { discoveryPrefill } from '../src/features/discovery/prefill';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { useAuth } from '../src/features/auth/AuthProvider';
import { readPending, preparePhoto, savePending, finishPending } from '../src/features/records/device';
import { usePhotoPicker } from '../src/features/records/usePhotoPicker';
import { PhotoAccessSheet } from '../src/features/records/PhotoAccessSheet';
import { ExistingDrinkChoice } from '../src/features/records/ExistingDrinkChoice';
import type { EntryCandidate } from '../src/features/records/candidates';
import type { PendingRecord } from '../src/features/records/pending';
import { loadRepeatEntry, type RepeatEntry } from '../src/features/records/repeat';
import { getSupabase } from '../src/lib/supabase';
import type { RecordInput } from '../src/features/records/repository';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { ChoiceChip } from '../src/components/ChoiceChip';
import { RatingStar } from '../src/components/RatingStar';
import { Mogu } from '../src/components/Mogu';
import { ScreenHeader, WebStatusSpace } from '../src/components/ScreenHeader';
import { categories, type Category } from '../src/features/cellar/model';
import { colors, fonts, typography } from '../src/theme/tokens';

import { composerContext, type ComposerPhoto, type RecordComposerDraft } from '../src/features/records/composer-draft';
import { composerDraftStorage, composerDraftSupported, composerPhotoQueue, prepareComposerPhoto, restoreComposerPhoto, removeComposerPhoto, composerPhotoForPending } from '../src/features/records/composer-draft-device';
const kindLabels = { whisky:'위스키',wine:'와인',beer:'맥주',traditional:'전통주',other:'기타' } as const;
const kindCodes = { 위스키:'whisky',와인:'wine',맥주:'beer',전통주:'traditional',기타:'other' } as const;
const feelingLabels = { again:'또 마시고 싶어요',okay:'괜찮아요',not_for_me:'내 취향이 아니에요' } as const;
const feelingCodes:Record<string,'again'|'okay'|'not_for_me'> = { '또 마시고 싶어요':'again','괜찮아요':'okay','내 취향이 아니에요':'not_for_me' };
type Step = 'start' | 'info' | 'rating';
type Sheet = 'category' | 'date' | 'vintage' | null;
export default function RecordScreen() {
  const auth = useAuth();
  const { entryId, productId } = useLocalSearchParams<{entryId?:string;productId?:string}>();
  if (auth.status === 'loading') return <View style={{ flex:1, backgroundColor:colors.background }} />;
  if (auth.status !== 'signed-in') return <Redirect href="/login" />;
  return <RecordComposer key={`${auth.session.user.id}-${entryId??productId??'new'}`} owner={auth.session.user.id} entryId={entryId} productId={productId} />;
}
export function RecordComposer({ owner, entryId, productId, previewEntry, previewCandidates }: { owner:string; entryId?:string; productId?:string; previewEntry?:RepeatEntry; previewCandidates?:EntryCandidate[] }) {
  const router = useRouter();
  const ownerRef = useRef<string | null>(owner);
  useEffect(() => { ownerRef.current = owner; return () => { ownerRef.current = null; }; }, [owner]);
  const busyRef = useRef(false);
  const context = useMemo(()=>{try{return composerContext(entryId,productId);}catch{return null;}},[entryId,productId]);
  const keepDraft = composerDraftSupported && !previewEntry && !previewCandidates;
  const draftId = useRef(Crypto.randomUUID());
  const draftRevision = useRef(0);
  const [draftPhoto,setDraftPhoto] = useState<ComposerPhoto|null>(null);
  const [photoPreparing,setPhotoPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(!previewEntry&&!previewCandidates);
  const [pending, setPending] = useState<PendingRecord | null>(null);
  const [step, setStep] = useState<Step>(previewEntry||previewCandidates?'info':'start');
  const [repeatEntry, setRepeatEntry] = useState<RepeatEntry|null>(previewEntry??null);
  const [separateName,setSeparateName]=useState<string|null>(null);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [name, setName] = useState(previewEntry?.name??'');
  const [category, setCategory] = useState<Category | null>(previewEntry?.category??null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [sheet, setSheetValue] = useState<Sheet>(null);
  const [lastSheet, setLastSheet] = useState<Exclude<Sheet, null>>('category');
  const activeSheet = sheet ?? lastSheet;
  function setSheet(value: Sheet) { if (value) { Keyboard.dismiss(); setLastSheet(value); } setSheetValue(value); }
  const [date, setDate] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date());
  const [vintage, setVintage] = useState('');
  const [vintageMode, setVintageMode] = useState<'year' | 'NV' | 'unknown'>('year');
  const [vintageYear, setVintageYear] = useState('');
  const [error, setError] = useState('');
  const composerContent = JSON.stringify({step,name,category:category?kindCodes[category]:null,feeling:feeling?feelingCodes[feeling]:null,stars,consumedAt:date.toISOString(),vintageMode,vintageYear,vintage,entryId:repeatEntry?.id??null,separateName,photo:draftPhoto});
  const persistComposer = useCallback(async (override?:Partial<Pick<RecordComposerDraft,"photo"|"step">>) => {
    if (!keepDraft || !context || ownerRef.current!==owner) return null;
    const value:RecordComposerDraft={...JSON.parse(composerContent),version:1,ownerId:owner,context,id:draftId.current,revision:++draftRevision.current,...override};
    await composerDraftStorage.persist(value);
    return value;
  },[composerContent,keepDraft,context,owner]);
  useEffect(()=>{
    if(!keepDraft||restoring||restoreFailed||pending||saving||photoPreparing||step==='start'&&!name&&!photo&&!category&&!feeling)return;
    void persistComposer().catch(()=>{if(ownerRef.current===owner)setError('작성 중인 내용을 기기에 보관하지 못했어요. 앱을 닫기 전에 다시 시도해주세요.');});
  },[keepDraft,restoring,restoreFailed,pending,saving,photoPreparing,step,name,photo,category,feeling,persistComposer,owner]);
  useEffect(() => {
    let active = true;
    if(previewEntry||previewCandidates)return;
    if (owner) void readPending(owner).then(async value => {
      if (!active) return;
      if(!value){
        if(keepDraft){
          if(!context)throw new Error('Invalid draft context');
          const restored=await composerDraftStorage.restore(owner,context);
          if(!active)return;
          if(restored){
            draftId.current=restored.id;draftRevision.current=restored.revision;setDraftPhoto(restored.photo);
            setStep(restored.step);setName(restored.name);setCategory(restored.category?kindLabels[restored.category]:null);
            setFeeling(restored.feeling?feelingLabels[restored.feeling]:null);setStars(restored.stars);setDate(new Date(restored.consumedAt));setMonth(new Date(restored.consumedAt));
            setVintageMode(restored.vintageMode);setVintageYear(restored.vintageYear);setVintage(restored.vintage);setSeparateName(restored.separateName);
            if(restored.entryId)setRepeatEntry({id:restored.entryId,name:restored.name||null,category:restored.category?kindLabels[restored.category]:null});
            if(restored.photo){try{const asset=await restoreComposerPhoto(owner,restored.photo);if(active)setPhoto(asset);}catch{if(active)setError('작성한 내용은 복구했어요. 사진을 찾지 못해 다시 선택해야 해요.');}}
            return;
          }
        }
        if(entryId){const client=getSupabase();if(!client)throw new Error('Missing backend');const entry=await loadRepeatEntry(client,owner,entryId);if(active){setRepeatEntry(entry);setName(entry.name??'');setCategory(entry.category);setStep('info');}}
        else { const initial=discoveryPrefill(productId);if(initial&&active){setName(initial.name);setCategory(initial.category);setVintageMode(initial.vintageMode);setVintageYear(initial.vintageYear);setVintage(initial.vintageYear || (initial.vintageMode==='NV'?'NV':initial.category==='와인'?'모름':''));setStep('info');} }
        return;
      }
      setPending(value); setName(value.input.enteredName ?? '');
      const kinds = { whisky: '위스키', wine: '와인', beer: '맥주', traditional: '전통주', other: '기타' } as const;
      setCategory(value.input.category ? kinds[value.input.category] : null);
      const feelings = { again: '또 마시고 싶어요', okay: '괜찮아요', not_for_me: '내 취향이 아니에요' };
      setFeeling(value.input.revisit ? feelings[value.input.revisit] : null); setStars(value.input.rating ?? 0);
      if (value.input.consumedAt) { setDate(new Date(value.input.consumedAt)); setMonth(new Date(value.input.consumedAt)); }
      if (value.localPhoto && value.input.photo) setPhoto({ uri: value.localPhoto, width: value.input.photo.width, height: value.input.photo.height });
      setVintage(value.input.vintageStatus === 'year' ? String(value.input.vintageYear) : value.input.vintageStatus === 'nv' ? 'NV' : value.input.vintageStatus === 'unknown' ? '모름' : '');
      setStep('rating');
    }).catch(() => { if (active) {setRestoreFailed(true);setError('기록을 준비하지 못했어요. 술장으로 돌아가 다시 열어주세요.');} }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [owner, entryId, productId, previewEntry, previewCandidates, keepDraft, context]);
  const close = () => { if (!busyRef.current) router.back(); };
  const back = () => { if (busyRef.current) return; if (pending) { setError('저장 중인 기록을 먼저 완료해주세요.'); return; } if (step === 'start') close(); else setStep(step === 'rating' ? 'info' : 'start'); };
  useScreenBack(back);
  const dateLabel = `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}.`;
  async function rememberPhoto(asset:ImagePicker.ImagePickerAsset) {
    if(!keepDraft){setPhoto(asset);setStep('info');return;}
    if(!context||busyRef.current)return;
    busyRef.current=true;setPhotoPreparing(true);setError('');
    const old=draftPhoto;
    try {
      await composerPhotoQueue.run(owner,{
        count:1,active:()=>ownerRef.current===owner,
        prepare:async()=>{
          const prepared=await prepareComposerPhoto(owner,Crypto.randomUUID(),asset);
          try {
            if(ownerRef.current!==owner)return prepared;
            await persistComposer({photo:prepared.photo,step:'info'});
            if(old&&old.id!==prepared.photo.id)await removeComposerPhoto(owner,old).catch(()=>{});
            return prepared;
          }catch(error){
            const stored=await composerDraftStorage.restore(owner,context).catch(()=>null);
            if(stored?.photo?.id!==prepared.photo.id)await removeComposerPhoto(owner,prepared.photo).catch(()=>{});
            throw error;
          }
        },
        commit:([prepared])=>{setDraftPhoto(prepared.photo);setPhoto(prepared.asset);setStep('info');},
        discard:async prepared=>{
          const stored=await composerDraftStorage.restore(owner,context);
          if(stored?.photo?.id!==prepared.photo.id)await removeComposerPhoto(owner,prepared.photo);
        },
      });
    }catch{if(ownerRef.current===owner)setError('사진을 기기에 보관하지 못했어요. 기존 입력은 그대로예요. 다시 선택해주세요.');}
    finally{busyRef.current=false;if(ownerRef.current===owner)setPhotoPreparing(false);}
  }
  const picker=usePhotoPicker(asset=>{void rememberPhoto(asset);});
  const pickPhoto=(camera=false)=>{if(!busyRef.current&&!pending)void picker.open(camera);};

  async function saveRecord(withNote = false) {
    if (busyRef.current) return;
    if(previewEntry||previewCandidates){setError('개발 시안에서는 서버에 저장하지 않아요.');return;}
    if(restoreFailed)return;
    if (!owner) { router.push('/login'); return; }
    if (!pending && !photo && !name.trim()) { setError('사진이나 술 이름을 남겨주세요.'); return; }
    if (!pending && (name.trim().length > 200 || (category === '와인' && vintage && vintage !== 'NV' && vintage !== '모름' && Number(vintage) < 1))) { setError('술 이름과 빈티지를 확인해주세요.'); return; }
    if (!pending && !feeling) { setError('이 술이 어땠는지 골라주세요.'); return; }
    if (withNote && (!category || category === '기타')) { if(pending){setError('저장 중인 기록을 먼저 완료해주세요. 술 종류는 저장 후 보완할 수 있어요.');return;} setStep('info');setSheet('category');setError('테이스팅 노트를 쓸 술 종류를 골라주세요.');return; }
    busyRef.current = true; setSaving(true); setError('');
    try {
      let operation = pending;
      if (!operation) {
        const composerDraft = await persistComposer();
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
        operation = { version:1, ownerId:owner, operationId, input, ...(repeatEntry?{entryId:repeatEntry.id}:{}), ...(composerDraft?{composerDraft}:{}) };
        if (photo) {
          const prepared = keepDraft&&draftPhoto ? await composerPhotoForPending(owner,draftPhoto,operationId) : await preparePhoto(photo.uri, photo.width, photo.height, operationId);
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
    } catch (error) {
      if((error as {code?:string}).code==='P0002'&&pending){
        try{await finishPending(pending);if(ownerRef.current===owner)router.replace('/');}
        catch{setError('삭제한 기록의 임시 저장을 정리하지 못했어요. 다시 시도해주세요.');}
      }
      else setError('저장을 완료하지 못했어요. 사진과 입력을 확인한 뒤 같은 기록으로 다시 시도해주세요.');
    }
    finally { busyRef.current = false; setSaving(false); }
  }
  if (restoring) return <View style={styles.page} />;
  if(restoreFailed)return <SafeAreaView style={[styles.page,{padding:24,justifyContent:'center',gap:16}]}><Text accessibilityRole="alert" style={styles.body}>{error}</Text><Button label="술장으로 돌아가기" onPress={()=>router.replace('/')} /></SafeAreaView>;
  const summary = <View style={styles.summary}>
    {photo ? <Image source={{ uri: photo.uri }} resizeMode="cover" style={styles.photo} accessibilityLabel="선택한 술 사진" /> : <View style={[styles.photo, styles.noPhoto]}><Text style={styles.caption}>사진 없이{`\n`}남기는 한 잔</Text></View>}
    <View style={styles.summaryText}>{step === 'info' ? <><Text style={styles.title}>오늘의 한 잔</Text><Text style={styles.body}>{photo ? '사진으로 가볍게 남겨요.' : '이름으로 가볍게 남겨요.'}</Text><Button label={photo ? "사진 변경" : "사진 추가"} variant="text" onPress={() => pickPhoto()} style={styles.changePhoto} /></> : <><Text style={styles.caption}>{category ?? '종류 미정'}</Text><Text style={styles.title} numberOfLines={3}>{name || '이름 없는 술'}</Text><Text style={styles.caption}>{dateLabel}{category === '와인' && vintage ? ` · ${vintage}` : ''}</Text></>}</View>
  </View>;
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <PhotoAccessSheet access={picker.access} busy={picker.busy} onClose={picker.close} onContinue={picker.proceed} onDismiss={picker.onDismiss}/>
    <WebStatusSpace /><ScreenHeader title={step === 'start' ? '한 잔 기록' : step === 'info' ? (repeatEntry || pending?.entryId || category === '와인' ? '기록하기' : '사진 확인') : '기록하기'} onBack={back} onClose={close} />
    <ScrollView pointerEvents={saving||photoPreparing ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {step === 'start' ? <View style={styles.start}>
        <Text style={styles.display}>오늘의 한 잔을{`\n`}사진으로 남겨볼까?</Text><Text style={[styles.body, { marginTop: 8 }]}>잘 찍은 사진이 아니어도 괜찮아요.</Text>
        <View style={styles.hero}><Mogu /><Text style={[styles.body, { marginTop: 24 }]}>사진 한 장이면 시작할 수 있어요</Text><Text style={[styles.caption, { marginTop: 8 }]}>이름과 느낌은 천천히 채워요.</Text></View>
        <View style={styles.startActions}><Button label="앨범에서 사진 선택" onPress={() => pickPhoto()} /><Button label="카메라로 촬영" variant="secondary" onPress={() => pickPhoto(true)} /><Pressable accessibilityRole="button" onPress={() => setStep('info')} style={styles.nameOnly}><Text style={styles.nameOnlyText}>사진 없이 이름으로 기록</Text></Pressable></View>
        <Text style={styles.private}>내 기록은 기본적으로 나만 볼 수 있어요.</Text>
      </View> : <View style={styles.form}>
        {(repeatEntry||pending?.entryId)&&<Text style={[styles.caption,{marginBottom:12}]}>같은 술에 새로운 한 잔을 남겨요.</Text>}
        {pending&&<Text style={[styles.caption,{marginBottom:12}]}>이전에 저장 중이던 기록을 먼저 완료해주세요.</Text>}
        {summary}
        {step === 'info' ? <><View style={styles.fields}><View><Text style={styles.label}>술 이름</Text><TextInput accessibilityLabel="술 이름" maxLength={200} value={name} onChangeText={text=>{setName(text);if(repeatEntry)setRepeatEntry(null);setSeparateName(null);}} placeholder="술 이름을 입력해주세요" placeholderTextColor={colors.muted} style={styles.input} />{!pending&&(repeatEntry||separateName!==name)&&<ExistingDrinkChoice owner={owner} query={name} selected={repeatEntry} fixtures={previewCandidates} onSelect={entry=>{Keyboard.dismiss();setRepeatEntry(entry);setName(entry.name??name);setCategory(entry.category);setSeparateName(null);}} onSeparate={()=>{setRepeatEntry(null);setSeparateName(name);}}/>}</View>
          <View><Text style={styles.label}>술 종류</Text><Button label={`${category ?? '종류 선택'}  ›`} variant="secondary" onPress={() => setSheet('category')} /></View>
          {category === '와인' && <View><Text style={styles.label}>빈티지 · 선택</Text><Button label={`${vintage || '연도 · NV · 모름'}  ›`} variant="secondary" onPress={() => setSheet('vintage')} /></View>}
          <View><Text style={styles.label}>언제 마셨나요?</Text><Button label={`${dateLabel}  ›`} variant="secondary" onPress={() => { setMonth(new Date(date)); setSheet('date'); }} /></View></View>
          <Text style={[styles.caption, { marginTop: 28 }]}>다음에서 간단한 평가를 남겨요.</Text><View style={styles.bottomAction}><Button label="다음" onPress={() => setStep('rating')} /></View>
        </> : <><View style={styles.feelings}><Text style={styles.title}>이 술, 어땠어요?</Text>{['또 마시고 싶어요', '괜찮아요', '내 취향이 아니에요'].map(value => <ChoiceChip key={value} label={value} selected={feeling === value} onPress={() => { if (!pending) setFeeling(value); }} style={{ minHeight: 44, paddingVertical: 10 }} />)}</View>
          <View style={styles.rating}><Text style={[styles.label, { marginBottom: 0 }]}>별점</Text><Text style={styles.caption}>원할 때만 남겨주세요.</Text><View style={styles.starRow}>{[1, 2, 3, 4, 5].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`별점 ${n}점`} accessibilityState={{ selected: stars === n }} onPress={() => { if (!pending) setStars(n); }} style={styles.starButton}><RatingStar filled={stars >= n} /></Pressable>)}</View>{stars > 0 && <Pressable accessibilityRole="button" accessibilityLabel="별점 지우기" onPress={() => { if (!pending) setStars(0); }}><Text style={styles.clear}>{stars}점 · 지우기</Text></Pressable>}</View>
          <View style={[styles.bottomAction, { marginBottom: 4 }]}><Text style={styles.connection}>{pending ? '저장 중인 원래 기록으로 다시 시도해요.' : '내 계정에 안전하게 보관해요.'}</Text><Button label={owner ? '기록 저장' : '로그인하고 저장'} loading={saving} onPress={() => saveRecord()} /><Button label="저장하고 테이스팅 노트 쓰기" variant="secondary" disabled={saving} onPress={() => saveRecord(true)} /></View>
        </>}
      </View>}
      {!!picker.error&&<Text accessibilityRole="alert" style={styles.body}>{picker.error}</Text>}{!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
    <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}><KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Pressable accessibilityLabel="선택 닫기" accessibilityRole="button" style={styles.scrim} onPress={() => setSheet(null)} /><View accessibilityViewIsModal style={styles.sheet}><View style={styles.handle} />
      <Text style={styles.title}>{activeSheet === 'category' ? '어떤 종류의 술인가요?' : activeSheet === 'date' ? '언제 마셨나요?' : '어느 해의\n와인인가요?'}</Text>
      {activeSheet === 'category' ? <View style={styles.sheetOptions}>{([...categories, '기타'] as const).map(value => <ChoiceChip key={value} label={value} selected={category === value} onPress={() => {setCategory(value);if(repeatEntry&&repeatEntry.category!==value){setRepeatEntry(null);setSeparateName(name);}}} style={{ minHeight: 44, paddingVertical: 10 }} />)}</View> : activeSheet === 'vintage' ? <View style={styles.vintageForm}><Text style={styles.caption}>빈티지</Text><View style={styles.vintageModes}>{([['year', '연도 입력'], ['NV', 'NV'], ['unknown', '모름']] as const).map(([value, label]) => <ChoiceChip key={value} label={label} selected={vintageMode === value} onPress={() => setVintageMode(value)} style={{ flex: 1, minHeight: 44, paddingVertical: 10, paddingHorizontal: 8 }} />)}</View>{vintageMode === 'year' && <><Text style={[styles.caption, { marginTop: 8 }]}>생산연도 · 예: 2020</Text><TextInput accessibilityLabel="빈티지 연도" value={vintageYear} onChangeText={text => setVintageYear(text.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder="연도 입력" style={styles.vintageInput} /></>}</View> : <View style={styles.calendar}>
        <View style={styles.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="이전 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Text style={styles.monthArrow}>‹</Text></Pressable><Text style={styles.label}>{month.getFullYear()}년 {month.getMonth() + 1}월</Text><Pressable accessibilityRole="button" accessibilityLabel="다음 달" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Text style={styles.monthArrow}>›</Text></Pressable></View>
        <View style={styles.days}>{['일', '월', '화', '수', '목', '금', '토'].map(day => <Text key={day} style={styles.dayLabel}>{day}</Text>)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth(), 1).getDay() }, (_, i) => <View key={`blank-${i}`} style={styles.day} />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => { const day = i + 1; const selected = date.getDate() === day && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear(); return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${month.getFullYear()}년 ${month.getMonth() + 1}월 ${day}일`} accessibilityState={{ selected }} style={styles.day} onPress={() => setDate(new Date(month.getFullYear(), month.getMonth(), day))}><Text style={[styles.dayText, selected && styles.daySelected]}>{day}</Text></Pressable>; })}</View>
      </View>}
      <Button label={activeSheet === 'category' ? '이 종류로 선택' : activeSheet === 'date' ? '이 날짜로 선택' : '빈티지 적용'} disabled={activeSheet === 'vintage' && vintageMode === 'year' && (vintageYear.length !== 4 || Number(vintageYear) < 1)} onPress={() => { if (activeSheet === 'vintage') setVintage(vintageMode === 'year' ? vintageYear : vintageMode === 'NV' ? 'NV' : '모름'); setSheet(null); }} />
    </View></KeyboardAvoidingView></Modal>
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
