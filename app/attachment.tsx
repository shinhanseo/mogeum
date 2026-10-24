import { useCallback, useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { loadRecordDetail } from '../src/features/records/detail';
import { listMoveTargets,type PendingAttachment } from '../src/features/records/attachment';
import { finishAttachment,readAttachment,saveAttachment } from '../src/features/records/attachment-device';
import { preparePhoto } from '../src/features/records/device';
import { drainPhotoDeletions } from '../src/features/records/edit';
import { AttachmentScreen,type AttachmentInput } from '../src/features/records/AttachmentScreen';
import { Button } from '../src/components/Button';
import { colors,typography } from '../src/theme/tokens';
export default function AttachmentRoute(){
 const auth=useAuth();const params=useLocalSearchParams<{recordId:string;kind:string}>();
 if(auth.status==='loading')return <ActivityIndicator color={colors.primary}/>;
 if(auth.status!=='signed-in')return <Redirect href="/login"/>;
 return <ConnectedAttachment key={`${auth.session.user.id}-${params.recordId}-${params.kind}`} owner={auth.session.user.id} recordId={params.recordId} kind={params.kind==='photo'?'photo':'move'}/>;
}
function ConnectedAttachment({owner,recordId,kind}:{owner:string;recordId:string;kind:'photo'|'move'}){
 const router=useRouter();const ownerRef=useRef<string|null>(owner);const [data,setData]=useState<Awaited<ReturnType<typeof loadRecordDetail>>|null>(null);const [pending,setPending]=useState<PendingAttachment|null>(null);const pendingRef=useRef<PendingAttachment|null>(null);const [error,setError]=useState(false);const [reload,setReload]=useState(0);
 useEffect(()=>{ownerRef.current=owner;return()=>{ownerRef.current=null;};},[owner]);
 useEffect(()=>{let active=true;const client=getSupabase();if(client)void Promise.all([loadRecordDetail(client,owner,{recordId}),readAttachment(owner,recordId)]).then(([value,stored])=>{if(active){pendingRef.current=stored;setPending(stored);setData(value);}}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[owner,recordId,reload]);
 const close=()=>router.replace({pathname:'/detail',params:{recordId}});
 const loadTargets=useCallback(async(query:string,from:number)=>{const client=getSupabase();if(!client||!data)throw new Error('Missing backend');return listMoveTargets(client,owner,data.record.cellar_entry_id,query,from);},[owner,data]);
 async function finish(value:PendingAttachment){await saveAttachment(value,()=>ownerRef.current);await finishAttachment(value);if(ownerRef.current===owner){const client=getSupabase();if(client)void drainPhotoDeletions(client,owner).catch(()=>{});close();}}
 async function apply(input:AttachmentInput){
  if(!data)throw new Error('Missing record');
  if(pendingRef.current){await finish(pendingRef.current);return;}
  const operationId=Crypto.randomUUID();let value:PendingAttachment;
  if(input.kind==='photo'){
   const photo=await preparePhoto(input.asset.uri,input.asset.width,input.asset.height,operationId);
   value={version:1,owner,recordId,operationId,expectedRevision:data.record.revision,change:{kind:'photo',storagePath:`${owner}/records/${operationId}/photo.jpg`,width:photo.width,height:photo.height},localPhoto:photo.localUri};
  }else value={version:1,owner,recordId,operationId,expectedRevision:data.record.revision,change:input};
  if(ownerRef.current!==owner)throw new Error('Account changed');pendingRef.current=value;setPending(value);await finish(value);
 }
 if(data&&!error)return <AttachmentScreen record={data.record} photoUri={data.photoUri} kind={kind} pending={pending} loadTargets={loadTargets} onApply={apply} onRetry={async()=>{if(pendingRef.current)await finish(pendingRef.current);}} onDiscard={async()=>{
   const value=pendingRef.current;if(value){const client=getSupabase();if(value.change.kind==='photo'&&client){const removed=await client.storage.from('record-photos').remove([value.change.storagePath]);if(removed.error)throw removed.error;}await finishAttachment(value);pendingRef.current=null;setPending(null);}close();
 }} onClose={close}/>;
 return <View style={{flex:1,justifyContent:'center',padding:24,gap:16,backgroundColor:colors.background}}>{error?<><Text style={{...typography.body,color:colors.text}}>기록과 보관한 변경을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={()=>{setError(false);setReload(n=>n+1);}}/><Button variant="text" label="술장으로 돌아가기" onPress={()=>router.replace('/')}/></>:<ActivityIndicator color={colors.primary}/>}</View>;
}
