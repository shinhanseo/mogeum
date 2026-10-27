import { useEffect, useRef, useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { loadRecordDetail } from '../src/features/records/detail';
import { deleteExperience, drainPhotoDeletions, saveBasicEdit } from '../src/features/records/edit';
import { clearDraft } from '../src/features/tasting/persistence';
import { RecordEditScreen } from '../src/features/records/RecordEditScreen';
import { Button } from '../src/components/Button';
import { colors, typography } from '../src/theme/tokens';
export default function Edit(){
 const auth=useAuth();const {recordId}=useLocalSearchParams<{recordId:string}>();
 if(auth.status!=='loading'&&auth.status!=='signed-in')return <Redirect href="/login"/>;
 if(auth.status==='loading')return <ActivityIndicator color={colors.primary}/>;
 return <ConnectedEdit key={`${auth.session.user.id}-${recordId}`} owner={auth.session.user.id} recordId={recordId}/>;
}
function ConnectedEdit({owner,recordId}:{owner:string;recordId:string}){
 const router=useRouter();const active=useRef(true);const [result,setResult]=useState<Awaited<ReturnType<typeof loadRecordDetail>>|null>(null);const [reload,setReload]=useState(0);const [error,setError]=useState(false);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{let current=true;const client=getSupabase();if(client)void loadRecordDetail(client,owner,{recordId}).then(value=>{if(current)setResult(value);}).catch(()=>{if(current)setError(true);});return()=>{current=false;};},[owner,recordId,reload]);
 const close=()=>router.replace({pathname:'/detail',params:{recordId}});
 if(result&&!error)return <RecordEditScreen key={`${result.record.revision}-${reload}`} record={result.record} photoUri={result.photoUri} multiple={result.history.length>1} onDeleteEntry={()=>router.push({pathname:"/cellar-manage",params:{entryId:result.record.cellar_entry_id,confirm:"1"}})} onPhoto={()=>router.push({pathname:'/attachment',params:{recordId,kind:'photo'}})} onMove={()=>router.push({pathname:'/attachment',params:{recordId,kind:'move'}})} onClose={close} onReload={()=>{setResult(null);setError(false);setReload(n=>n+1);}} onSave={async value=>{const client=getSupabase();if(!client)throw new Error('서버 설정을 확인해주세요.');await saveBasicEdit(client,result.record,value);if(active.current)close();}} onDelete={async()=>{const client=getSupabase();if(!client)throw new Error('서버 설정을 확인해주세요.');await deleteExperience(client,owner,result.record);await clearDraft(owner,recordId);void drainPhotoDeletions(client,owner).catch(()=>{});if(active.current)router.replace('/');}}/>;
 return <View style={{flex:1,padding:24,justifyContent:'center',gap:16,backgroundColor:colors.background}}>{error?<><Text style={{...typography.body,color:colors.text}}>기록을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={()=>{setError(false);setReload(n=>n+1);}}/><Button label="술장으로 돌아가기" variant="text" onPress={()=>router.replace('/')}/></>:<ActivityIndicator color={colors.primary}/>}</View>;
}
