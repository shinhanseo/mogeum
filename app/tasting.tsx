import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { colors, typography } from '../src/theme/tokens';
import { Button } from '../src/components/Button';
import { TastingComposer } from '../src/features/tasting/TastingComposer';
import { ModeSheet } from '../src/features/tasting/ModeSheet';
import { newTastingDraft, type TastingDraft } from '../src/features/tasting/draft';
import { type NoteMode, type TastingCategory } from '../src/features/tasting/catalog';
import { clearDraft, persistDraft, restoreDraft } from '../src/features/tasting/persistence';
import { restoreAnswers } from '../src/features/tasting/restore-answers';
import { tastingRepository, TASTING_REQUEST_TIMEOUT_MS } from '../src/features/tasting/repository';
import * as Crypto from 'expo-crypto';

export default function TastingScreen() {
  const auth=useAuth(); const params=useLocalSearchParams<{recordId:string}>();
  if (auth.status==='loading') return <View style={{flex:1,backgroundColor:colors.background}}/>;
  if (auth.status!=='signed-in') return <Redirect href="/login"/>;
  return <ConnectedTasting key={`${auth.session.user.id}-${params.recordId}`} owner={auth.session.user.id} recordId={params.recordId}/>;
}
function ConnectedTasting({ owner, recordId }: {owner:string;recordId:string}) {
  const router=useRouter();const [draft,setDraft]=useState<TastingDraft|null>(null);const [category,setCategory]=useState<TastingCategory|null>(null);
  const [modeSheet,setModeSheet]=useState(false);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const revision=useRef(0);const active=useRef(true);const operation=useRef<string|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    let mounted=true;
    void (async()=>{
      const client=getSupabase();if(!client||!recordId)throw new Error('Missing record');
      const record=await tastingRepository(client).context(recordId);
      if(!['whisky','wine','beer','traditional'].includes(record.category))throw new Error('주종을 먼저 확인해주세요.');
      const restored=await restoreDraft(owner,recordId);
      const {data:note,error:noteError}=await client.from('record_notes').select('mode,catalog_version,confirmed_note,edited_by_user').eq('record_id',recordId).abortSignal(AbortSignal.timeout(TASTING_REQUEST_TIMEOUT_MS)).maybeSingle();
      if(noteError)throw noteError;
      const {data:settings,error:settingsError}=await client.from('user_settings').select('last_note_mode').eq('user_id',owner).abortSignal(AbortSignal.timeout(TASTING_REQUEST_TIMEOUT_MS)).maybeSingle();
      if(settingsError)throw settingsError;
      if(!mounted)return;
      revision.current=restored?.pendingSave?.expectedRevision??restored?.baseRecordRevision??record.revision;setCategory(record.category as TastingCategory);
      if(restored){if(restored.category!==record.category)throw new Error('Record category changed');setDraft(restored);}
      else if(note){
        if(note.catalog_version!==2)throw new Error('Unsupported legacy note');
        const {data:answers,error:answerError}=await client.from('record_answers').select('mode,question_id,status,descriptor_codes,intensity,free_text').eq('record_id',recordId).eq('catalog_version',2).abortSignal(AbortSignal.timeout(TASTING_REQUEST_TIMEOUT_MS));
        if(answerError)throw answerError;if(!mounted)return;
        const value=restoreAnswers({...newTastingDraft(owner,recordId,record.category as TastingCategory,note.mode),baseRecordRevision:record.revision},answers);
        if(note.confirmed_note)value.composition={text:note.confirmed_note,edited:note.edited_by_user===true,sourceRevision:value.revision};
        setDraft(value);
      }
      // Defaults in user_settings are not evidence that a person has chosen a mode.
      else {
        const {count,error:countError}=await client.from('record_notes').select('record_id',{count:'exact',head:true}).abortSignal(AbortSignal.timeout(TASTING_REQUEST_TIMEOUT_MS));
        if(countError)throw countError;if(!mounted)return;
        if(count&&settings?.last_note_mode)setDraft({...newTastingDraft(owner,recordId,record.category as TastingCategory,settings.last_note_mode),baseRecordRevision:record.revision});
        else setModeSheet(true);
      }
    })().catch(()=>{if(mounted)setError('노트를 열지 못했어요. 기본 기록은 저장되어 있어요. 술 종류와 연결 상태를 확인해주세요.');}).finally(()=>{if(mounted)setLoading(false);});
    return()=>{mounted=false;};
  },[owner,recordId]);
  const close=()=>router.replace({pathname:'/detail',params:{recordId}});
  function chooseMode(mode:NoteMode){if(!category)return;const value={...newTastingDraft(owner,recordId,category,mode),baseRecordRevision:revision.current};setDraft(value);setModeSheet(false);void persistDraft(value).catch(()=>setError('임시 저장에 실패했어요. 앱을 닫기 전에 다시 시도해주세요.'));}
  async function save(value:TastingDraft,note:string,edited:boolean){
    const client=getSupabase();if(!client)throw new Error('Missing backend');
    const session=(await client.auth.getSession()).data.session;
    if(!active.current||session?.user.id!==owner)throw new Error('Account changed');
    const operationId=value.pendingSave?.operationId??operation.current??Crypto.randomUUID();
    operation.current=operationId;
    const frozen={...value,composition:{text:note,edited,sourceRevision:value.revision},pendingSave:{operationId,expectedRevision:revision.current}};
    await persistDraft(frozen);
    await tastingRepository(client).save(frozen,operationId,revision.current,note,edited);
    if (!await clearDraft(owner,recordId,frozen)) throw new Error('A newer draft was preserved');
    if(active.current)router.replace({pathname:'/detail',params:{recordId}});
  }
  if(draft)return <><TastingComposer initial={draft} onChange={value=>{void persistDraft(value).catch(()=>setError('임시 저장에 실패했어요.'));}} onSave={save} onClose={close}/>{!!error&&<Text accessibilityRole="alert" style={{...typography.caption,color:colors.primary,padding:12}}>{error}</Text>}</>;
  return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',padding:24,gap:16}}>{loading?<ActivityIndicator color={colors.primary}/>:<><Text style={{...typography.body,color:colors.text}}>{error||'기본 기록을 저장했어요.'}</Text><Button label="술장으로 돌아가기" onPress={close}/></>}{category&&<ModeSheet visible={modeSheet} category={category} onChoose={chooseMode} onClose={close}/>}</View>;
}
