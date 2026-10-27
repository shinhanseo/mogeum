import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { Button } from '../../src/components/Button';
import { TastingComposer } from '../../src/features/tasting/TastingComposer';
import { RecordDetailScreen } from '../../src/features/records/RecordDetailScreen';
import { loadRecordDetail } from '../../src/features/records/detail';
import { tastingRepository } from '../../src/features/tasting/repository';
import { composeNote } from '../../src/features/tasting/answers';
import { proseFixture } from '../../src/dev/tasting-prose-fixture';
import type { TastingDraft } from '../../src/features/tasting/draft';
import type { TastingCategory } from '../../src/features/tasting/catalog';
import { colors } from '../../src/theme/tokens';
/** Loopback-only Auth/DB QA. Never reads or changes the app's signed-in session. */
export default function ProseQA(){
 const [draft,setDraft]=useState<TastingDraft|null>(null), [detail,setDetail]=useState<Awaited<ReturnType<typeof loadRecordDetail>>|null>(null);
 const [message,setMessage]=useState('합성 노트 · 로컬 Auth/DB 실제 저장 검증'),[busy,setBusy]=useState(false);
 const sdk=useRef<SupabaseClient|null>(null), revision=useRef(0), owner=useRef(''), run=useRef('');
 async function begin(category:TastingCategory){
  setBusy(true);
  try{
   if(!sdk.current){
    const config=await (await fetch('http://127.0.0.1:8766/config')).json();
    if(config.url!=='http://127.0.0.1:54321'||typeof config.publicKey!=='string')throw Error('LOCAL_ONLY');
    const client=createClient(config.url,config.publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
    run.current=`prose-${randomUUID()}`;
    const result=await client.auth.signUp({email:`native-${randomUUID()}@example.test`,password:randomUUID()+'Aa1!',options:{data:{mogeum_native_probe:run.current}}});
    if(result.error||!result.data.session||!result.data.user)throw Error('SIGNUP');
    owner.current=result.data.user.id;sdk.current=client;
    await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}prose-qa-private.json`,JSON.stringify({runId:run.current,userIds:[owner.current]}));
   }
   const created=await sdk.current.rpc('create_tasting_record',{p_operation_id:randomUUID(),p_record:{enteredName:`합성 ${category} 문장 검증`,category,revisit:'again'}});
   if(created.error)throw Error('CREATE');
   revision.current=created.data.revision;
   let next=proseFixture(owner.current,created.data.recordId,category);
   const text=composeNote(next);
   next={...next,stage:'preview',composition:{text,edited:false,sourceRevision:next.revision}};
   setDraft(next);setDetail(null);
  }catch{setMessage('검증 연결 실패 · 로컬 서비스 확인 필요');}finally{setBusy(false);}
 }
 if(!__DEV__||Platform.OS==='web')return <Redirect href="/"/>;
 if(detail)return <RecordDetailScreen record={detail.record} photoUri={null} history={detail.history} onClose={()=>{setDraft(null);setDetail(null);}} onNote={()=>setDetail(null)} onSelect={()=>{}} onRepeat={()=>{setDraft(null);setDetail(null);}} onEdit={()=>{}}/>;
 if(draft)return <TastingComposer key={draft.recordId} initial={draft} onChange={setDraft} onClose={()=>setDraft(null)} onSave={async(value,note,edited)=>{
  const saved=await tastingRepository(sdk.current!).save(value,randomUUID(),revision.current,note,edited);
  const fresh=await loadRecordDetail(sdk.current!,owner.current,{recordId:value.recordId});
  if(fresh.record.record_notes?.confirmed_note!==note)throw Error('READBACK');
  revision.current=saved.revision;
  await FileSystem.writeAsStringAsync(`${FileSystem.documentDirectory}prose-qa-report.json`,JSON.stringify({synthetic:true,platform:Platform.OS,category:value.category,saved:true,readBackExact:true,note,edited}));
  setDetail(fresh);
 }}/ >;
 return <View style={{flex:1,padding:24,paddingTop:80,gap:16,backgroundColor:colors.background}}><Text>{message}</Text>{(['whisky','wine','beer','traditional'] as const).map(c=><Button key={c} label={`${c} 합성 노트`} disabled={busy} onPress={()=>{void begin(c);}}/>)}</View>;
}
