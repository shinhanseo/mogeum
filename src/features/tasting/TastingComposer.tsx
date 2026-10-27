import { useScreenBack } from '../../hooks/useScreenBack';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ChoiceChip } from '../../components/ChoiceChip';
import { colors, fonts, typography } from '../../theme/tokens';
import { aromaCatalogs, type NoteMode } from './catalog';
import { changeAroma, emptyAroma } from './aroma';
import { aromaLabel, choose, composeNote, emptyAnswer, textAnswer } from './answers';
import { cancelNoteEdit, restoredTastingView, setAnswer, switchMode, type TastingDraft, type TastingView } from './draft';
import { isFieldVisible, questionsFor, type Field } from './questions';
import { ModeSheet } from './ModeSheet';

type Props = { initial: TastingDraft; onChange: (draft: TastingDraft) => void; onSave: (draft: TastingDraft, note: string, edited: boolean) => Promise<void>; onClose: () => void; previewOnly?: boolean };
const categoryLabels = { whisky:'위스키',wine:'와인',beer:'맥주',traditional:'전통주' };
export function TastingComposer({ initial, onChange, onSave, onClose, previewOnly }: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(initial);
  const [view, setView] = useState<TastingView>(()=>restoredTastingView(initial));
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState(initial.composition?.text ?? '');
  const [editText, setEditText] = useState(initial.composition?.editBuffer??'');
  const [edited, setEdited] = useState(initial.composition?.edited ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [retryOnly,setRetryOnly]=useState(!!initial.pendingSave);
  const busy = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const revealSaveError = useCallback(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, []);
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(revealSaveError);
    return () => cancelAnimationFrame(frame);
  }, [error, revealSaveError]);
  const focusedInput=useRef<string|null>(null);
  const inputs=useRef<Record<string,ComponentRef<typeof TextInput>|null>>({});
  const scrollY=useRef(0);
  const focusOrigin=useRef<number|null>(null);
  const revealInput=useCallback(()=>{
    const input=focusedInput.current?inputs.current[focusedInput.current]:null;
    const keyboard=Keyboard.metrics();
    const focusId=focusedInput.current;
    if(!input||!keyboard||!scroll.current)return;
    scroll.current.measureInWindow((_sx,sy,_sw,sh)=>{
      input.measureInWindow((_x,y,_w,h)=>{
        if(focusedInput.current!==focusId||!Keyboard.isVisible())return;
        const visibleBottom=Math.min(sy+sh,keyboard.screenY);
        const overlap=y+h+16-visibleBottom;
        if(overlap>0)scroll.current?.scrollTo({y:scrollY.current+overlap,animated:true});
      });
    });
  },[]);
  useEffect(()=>{
    const shown=Keyboard.addListener('keyboardDidShow',revealInput);
    const changed=Keyboard.addListener('keyboardDidChangeFrame',revealInput);
    const hidden=Keyboard.addListener('keyboardDidHide',()=>{
      const origin=focusOrigin.current;
      focusOrigin.current=null;
      focusedInput.current=null;
      if(origin!==null)scroll.current?.scrollTo({y:origin,animated:true});
    });
    return ()=>{shown.remove();changed.remove();hidden.remove();};
  },[revealInput]);
  function focusInput(id:string){
    if(focusOrigin.current===null)focusOrigin.current=scrollY.current;
    focusedInput.current=id;revealInput();
  }
  function dismissInput(){
    focusedInput.current=null;focusOrigin.current=null;Keyboard.dismiss();
  }
  const doneInput = { returnKeyType:'done' as const, submitBehavior:'blurAndSubmit' as const, onSubmitEditing:()=>Keyboard.dismiss() };
  const questions = questionsFor(draft.category, draft.mode);
  const modeDraft = draft.modes[draft.mode];
  const index = Math.max(0, questions.findIndex(q => q.id === modeDraft.currentQuestion));
  const question = questions[index];
  const choiceWidth=(Math.min(useWindowDimensions().width,600)-56)/2;
  const intensityWidth=(choiceWidth*2+8-32)/5;
  const label = draft.mode === 'light' ? '가볍게' : '자세히';
  function update(value: TastingDraft) { setDraft(value); onChange(value); }
  function changeView(next: TastingView, value = draft) {
    update({...value,stage:next});setView(next);
  }
  function move(next: number, value = draft) {
    dismissInput();
    const target = questions[next];
    if (!target) { showPreview(value); return; }
    update({ ...value, modes:{ ...value.modes,[value.mode]:{ ...value.modes[value.mode],currentQuestion:target.id } } });
    scroll.current?.scrollTo({ y:0, animated:false });
  }
  function showPreview(value: TastingDraft) {
    if(edited&&value.composition?.sourceRevision===value.revision){changeView('preview',value);return;}
    const generated = composeNote(value);
    if (edited && note !== generated) {
      Alert.alert('직접 다듬은 문장이 있어요', '기존 문장을 유지하거나 새 답변으로 다시 정리할 수 있어요.', [
        { text:'기존 문장 유지', onPress:()=>changeView('preview',value) },
        { text:'다시 정리', onPress:()=>{setNote(generated);setEdited(false);changeView('preview',{...value,composition:{text:generated,edited:false,sourceRevision:value.revision}});} },
      ]); return;
    }
    setNote(generated); changeView('preview',{...value,composition:{text:generated,edited:false,sourceRevision:value.revision}});
  }
  function skip() {
    let next = draft;
    for (const field of question.fields) {
      if (field.kind === 'aroma') {
        next = { ...next, revision:next.revision+1,modes:{...next.modes,[next.mode]:{...next.modes[next.mode],aromas:{...next.modes[next.mode].aromas,[field.id]:{...emptyAroma(),skipped:true}}}} };
      } else next = setAnswer(next, field.id, { ...emptyAnswer(),status:'skipped' });
    }
    update(next); move(index+1,next);
  }
  async function save() {
    if (busy.current) return;
    busy.current=true;setSaving(true);setError(null);
    try { await onSave(draft,note,edited); }
    catch { setRetryOnly(true);setError({message:'노트를 저장하지 못했어요. 작성한 내용은 기기에 남아 있어요. 같은 내용으로 다시 시도해주세요.'}); }
    finally { busy.current=false;setSaving(false); }
  }
  function selectMode(mode: NoteMode) {
    dismissInput();
    const next=switchMode(draft,mode);changeView('questions',next);setSheet(false);scroll.current?.scrollTo({y:0,animated:false});
  }
  function cancelEdit() {
    dismissInput();
    changeView('preview',cancelNoteEdit(draft));
    setEditText(note);
  }
  function back() {
    if (busy.current) return;
    if (retryOnly) { onClose(); return; }
    if (view === 'edit') cancelEdit();
    else if (view === 'preview') changeView('questions');
    else if (index > 0) move(index - 1);
    else onClose();
  }
  useScreenBack(back);
  function aroma(field: Field) {
    const value = modeDraft.aromas[field.id] ?? emptyAroma();
    const catalog = aromaCatalogs[draft.category];
    const change = (action: Parameters<typeof changeAroma>[1]) => update({ ...draft, revision:draft.revision+1, modes:{ ...draft.modes,[draft.mode]:{...modeDraft,aromas:{...modeDraft.aromas,[field.id]:changeAroma(value,action,catalog)}}} });
    return <View key={field.id} style={styles.field}><Text style={styles.label}>{field.label}</Text>
      <View style={styles.grid}>{Object.keys(catalog).map(code=><ChoiceChip key={code} label={aromaLabel(code)} selected={!value.unknown&&value.families.includes(code)} onPress={()=>change({type:'family',code})} style={[styles.halfChip,{width:choiceWidth}]}/>)}</View>
      {!value.unknown && Object.entries(catalog).filter(([code])=>value.families.includes(code)).map(([family,details])=>details.length>0&&<View key={family} style={styles.field}><Text style={styles.label}>{aromaLabel(family)} › 세부 향 · 복수 선택</Text><View style={styles.grid}>{details.map((code:string)=><ChoiceChip key={code} label={aromaLabel(code)} selected={value.details[family]?.includes(code)} onPress={()=>change({type:'detail',family,code})} style={[styles.halfChip,{width:choiceWidth}]}/>)}</View></View>)}
      <TextInput {...doneInput} ref={node=>{inputs.current[field.id]=node;}} onFocus={()=>focusInput(field.id)} onBlur={()=>{focusedInput.current=null;}} onContentSizeChange={revealInput} onSelectionChange={revealInput} accessibilityLabel="내가 떠올린 다른 향" placeholder="다른 향이 떠오르면 적어주세요" placeholderTextColor={colors.muted} maxLength={2000} value={value.freeText} onChangeText={text=>change({type:'text',value:text})} style={styles.input} multiline />
      {draft.category!=='traditional'&&<><Text style={styles.label}>향의 선명함</Text><View style={styles.grid}>{(['subtle','moderate','clear','unknown'] as const).map((code,i)=><ChoiceChip key={code} label={['은은해요','적당해요','선명해요','잘 모르겠어요'][i]} selected={value.clarity===code} onPress={()=>change({type:'clarity',value:value.clarity===code?null:code})} style={[styles.halfChip,{width:choiceWidth}]}/>)}</View></>}
      <ChoiceChip label="향을 구분하기 어려워요" selected={value.unknown} onPress={()=>change({type:'unknown'})} style={styles.chip}/>
    </View>;
  }
  function renderField(field: Field) {
    if (field.kind === 'aroma') return aroma(field);
    const answer=modeDraft.answers[field.id]??emptyAnswer();
    const answerChange=(next:ReturnType<typeof emptyAnswer>)=>{
      let value=setAnswer(draft,field.id,next);
      if(draft.mode==='light'&&question.id==='nose'){
        if(field.kind==='text'&&next.freeText.trim()&&modeDraft.answers.nose?.status==='unknown')value=setAnswer(value,'nose',emptyAnswer());
        if(field.id==='nose'&&next.status==='unknown')value=setAnswer(value,'nose.memo',emptyAnswer());
      }
      update(value);
    };
    return <View key={field.id} style={styles.field}>{!!field.label&&!field.id.startsWith('appearance.color')&&!(draft.mode==='light'&&field.kind==='text')&&<Text style={styles.label}>{field.label}</Text>}
      {field.kind==='text'?<TextInput {...doneInput} ref={node=>{inputs.current[field.id]=node;}} onFocus={()=>focusInput(field.id)} onBlur={()=>{focusedInput.current=null;}} onContentSizeChange={revealInput} onSelectionChange={revealInput} accessibilityLabel={field.label} placeholder={draft.mode==='light'?field.label:'내 말로 남기기'} placeholderTextColor={colors.muted} value={answer.freeText} multiline maxLength={2000} onChangeText={text=>answerChange(textAnswer(text))} style={styles.input}/>:<View style={styles.grid}>{field.options?.map(option=><ChoiceChip key={option.code} label={option.label} swatch={option.color} selected={option.code==='unknown'?answer.status==='unknown':option.code==='none'?answer.status==='none':answer.descriptors.includes(option.code)} onPress={()=>answerChange(choose(answer,field,option.code))} style={[styles.halfChip,{width:field.intensity?intensityWidth:choiceWidth,minHeight:draft.mode==='deep'?44:48,paddingVertical:draft.mode==='deep'?8:10},!!option.color&&{minHeight:92,paddingVertical:10}]}/>)}</View>}
    </View>;
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={insets.top}>
    {!!previewOnly&&<Text style={styles.fixture}>개발용 화면 미리보기 · 실제 계정/저장과 무관</Text>}
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="뒤로" onPress={back} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><Text style={styles.nav}>테이스팅 노트</Text><Pressable accessibilityRole="button" accessibilityLabel="기록 방식 변경" onPress={()=>{if(!saving&&!retryOnly)setSheet(true);}} style={styles.mode}><Text style={styles.modeText}>{label} ▾</Text></Pressable></View>
    <ScrollView style={styles.flex} ref={scroll} onScroll={event=>{scrollY.current=event.nativeEvent.contentOffset.y;}} scrollEventThrottle={16} onLayout={revealInput} onContentSizeChange={error?revealSaveError:revealInput} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,draft.mode==='deep'&&view==='questions'&&{gap:16}]} showsVerticalScrollIndicator={false} pointerEvents={saving?'none':'auto'}>
      {view==='questions'?<><Text style={styles.caption}>{categoryLabels[draft.category]} · {label}{draft.mode==='deep'?' 남기기':''} · {index+1} / {questions.length}</Text><View style={styles.progress}>{questions.map((q,i)=><View key={q.id} style={[styles.segment,i<=index&&styles.done]}/>)}</View><Text style={styles.title}>{question.title}</Text><Text style={[styles.hint,draft.mode==='deep'&&typography.body]}>{question.hint}</Text>{question.fields.filter(f=>isFieldVisible(f,modeDraft.answers)).map(renderField)}<Text style={styles.hint}>떠오르는 게 없다면 넘어가도 괜찮아요.</Text></>:view==='preview'?<><Text style={styles.caption}>{categoryLabels[draft.category]} · {label} 남긴 노트</Text><Text style={styles.title}>내가 느낀 만큼,{`\n`}한 잔의 기록.</Text><View style={styles.noteCard}><Text style={styles.note}>{note||'아직 남긴 느낌이 없어요. 기본 기록은 그대로 보관돼요.'}</Text></View><Text style={styles.hint}>{edited?'내 말로 다듬은 노트예요.':'선택한 답변만 문장으로 정리했어요.'}</Text><Button label="문장 직접 수정  ›" disabled={retryOnly} variant="text" onPress={()=>{setEditText(note);changeView('edit',{...draft,composition:{text:note,edited,sourceRevision:draft.revision,editBuffer:note}});}}/></>:<><Text style={styles.title}>내 말로{`\n`}다듬어볼까요?</Text><Text style={styles.caption}>{categoryLabels[draft.category]} · {label} 남긴 노트</Text><TextInput {...doneInput} ref={node=>{inputs.current.editor=node;}} onFocus={()=>focusInput('editor')} onBlur={()=>{focusedInput.current=null;}} onContentSizeChange={revealInput} onSelectionChange={revealInput} accessibilityLabel="노트 문장 직접 수정" value={editText} onChangeText={text=>{setEditText(text);update({...draft,composition:{text:note,edited,sourceRevision:draft.revision,editBuffer:text}});}} multiline maxLength={10000} style={[styles.input,styles.editor]}/><Text style={styles.hint}>선택한 감각을 바꾸려면 답변 수정을 이용해요.</Text></>}
      {!!error&&<Text accessibilityRole="alert" style={styles.caption}>{error.message}</Text>}
    </ScrollView>
    <View style={styles.actions}>{view==='questions'?<><Button label={index===questions.length-1?'내 노트 미리보기':'다음'} onPress={()=>move(index+1)}/><Button label={draft.mode==='deep'?'이 질문 건너뛰기':'건너뛰기'} variant="text" onPress={skip}/></>:view==='preview'?<><Button label={note.trim()?'노트 저장':'기록으로 돌아가기'} loading={saving} onPress={()=>{if(note.trim())void save();else onClose();}}/><Button label="답변 수정" disabled={saving||retryOnly} variant="text" onPress={()=>changeView('questions')}/></>:<><Button label="수정한 문장 적용" onPress={()=>{setNote(editText);setEdited(true);changeView('preview',{...draft,composition:{text:editText,edited:true,sourceRevision:draft.revision}});}}/><Button label="취소" variant="text" onPress={cancelEdit}/></>}</View>
    <ModeSheet visible={sheet} category={draft.category} onChoose={selectMode} onClose={()=>setSheet(false)}/>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.background},flex:{flex:1},header:{height:48,marginHorizontal:24,flexDirection:'row',alignItems:'center'},back:{minWidth:44,minHeight:44,justifyContent:'center'},backText:{fontFamily:fonts.bold,fontSize:24,color:colors.primary},nav:{position:'absolute',left:44,right:44,textAlign:'center',...typography.questionNav,color:colors.text,pointerEvents:'none'},mode:{marginLeft:'auto',minWidth:84,minHeight:44,justifyContent:'center',alignItems:'center'},modeText:{...typography.button,color:colors.primary},
  content:{padding:24,gap:12,width:'100%',maxWidth:600,alignSelf:'center'},caption:{...typography.caption,color:colors.primary},progress:{flexDirection:'row',gap:8,height:4},segment:{height:4,flex:1,borderRadius:2,backgroundColor:colors.border},done:{backgroundColor:colors.primary},title:{...typography.question,color:colors.text},hint:{...typography.caption,color:colors.muted},field:{gap:8},label:{...typography.fieldLabel,color:colors.text},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},halfChip:{minHeight:44,paddingVertical:8,paddingHorizontal:8,width:'48.8%',flexGrow:0},chip:{minHeight:44,paddingVertical:8},input:{minHeight:64,borderRadius:12,paddingHorizontal:16,paddingVertical:16,backgroundColor:colors.surface,fontFamily:fonts.regular,fontSize:14,lineHeight:24,includeFontPadding:true,color:colors.text,textAlignVertical:'top'},actions:{paddingHorizontal:24,paddingTop:12,gap:8,paddingBottom:16,width:'100%',maxWidth:600,alignSelf:'center'},noteCard:{backgroundColor:colors.surface,borderRadius:16,padding:20},note:{...typography.body,color:colors.text,lineHeight:26},editor:{minHeight:280},fixture:{fontFamily:fonts.regular,fontSize:10,textAlign:'center',color:colors.primary,padding:4},
});
