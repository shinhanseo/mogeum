import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { loadRecordDetail } from '../src/features/records/detail';
import { RecordDetailScreen } from '../src/features/records/RecordDetailScreen';
import { Button } from '../src/components/Button';
import { colors, typography } from '../src/theme/tokens';
export default function Detail(){
 const auth=useAuth();const router=useRouter();const params=useLocalSearchParams<{recordId?:string;entryId?:string}>();
 const owner=auth.status==='signed-in'?auth.session.user.id:null;
 const [result,setResult]=useState<{owner:string;target:string;value:Awaited<ReturnType<typeof loadRecordDetail>>}|null>(null);const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
 const target=JSON.stringify([params.recordId,params.entryId]);
 useFocusEffect(useCallback(()=>{void retry;let active=true;setError(false);const client=getSupabase();if(owner&&client)void loadRecordDetail(client,owner,{recordId:params.recordId,entryId:params.entryId}).then(value=>{if(active)setResult({owner,target,value});}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[owner,target,retry,params.recordId,params.entryId]));
 if(auth.status==='signed-out')return <Redirect href="/login"/>;
 const close=()=>router.replace('/');
 if(result?.owner===owner&&result.target===target&&!error){const value=result.value;return <RecordDetailScreen {...value} onRepeat={()=>router.push({pathname:'/record',params:{entryId:value.record.cellar_entry_id}})} onClose={close} onNote={()=>router.push({pathname:'/tasting',params:{recordId:value.record.id}})} onSelect={recordId=>router.replace({pathname:'/detail',params:{recordId}})}/>;}
 return <View style={{flex:1,backgroundColor:colors.background,justifyContent:'center',padding:24,gap:16}}>{error?<><Text accessibilityRole="alert" style={{...typography.body,color:colors.text}}>기록을 불러오지 못했어요. 삭제되었거나 접근할 수 없는 기록일 수 있어요.</Text><Button label="다시 시도" onPress={()=>setRetry(n=>n+1)}/><Button label="술장으로 돌아가기" variant="secondary" onPress={close}/></>:<ActivityIndicator color={colors.primary} accessibilityLabel="기록 불러오는 중"/>}</View>;
}
