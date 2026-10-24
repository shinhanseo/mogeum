import { useCallback, useState } from 'react';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../src/features/auth/AuthProvider';
import { getSupabase } from '../src/lib/supabase';
import { loadTasteContext,tastePhotoUrls,type TasteContext } from '../src/features/taste/repository';
import { TasteEvidenceScreen } from '../src/features/taste/TasteEvidenceScreen';
import { Button } from '../src/components/Button';
import { colors,typography } from '../src/theme/tokens';
export default function EvidenceRoute(){const auth=useAuth();if(auth.status==='loading')return <ActivityIndicator color={colors.primary}/>;if(auth.status!=='signed-in')return <Redirect href="/login"/>;return <ConnectedEvidence key={auth.session.user.id} owner={auth.session.user.id}/>;}
function ConnectedEvidence({owner}:{owner:string}){
 const router=useRouter();const {factId}=useLocalSearchParams<{factId?:string}>();const [data,setData]=useState<{context:TasteContext;photos:Record<string,string>}|null>(null);const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
 useFocusEffect(useCallback(()=>{void retry;let active=true;setError(false);setData(null);const client=getSupabase();if(client)void loadTasteContext(client).then(async context=>({context,photos:await tastePhotoUrls(client,owner,context.snapshot.records.map(r=>r.id))})).then(value=>{if(active)setData(value);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[owner,retry]));
 const close=()=>router.replace({pathname:'/',params:{tab:'taste'}});
 if(data)return <TasteEvidenceScreen {...data} factId={factId} onClose={close} onOpen={recordId=>router.push({pathname:'/detail',params:{recordId}})}/>;
 return <View style={{flex:1,padding:24,backgroundColor:colors.background,justifyContent:'center',gap:16}}>{error?<><Text style={{...typography.body,color:colors.text}}>최신 기록을 불러오지 못했어요.</Text><Button label="다시 시도" onPress={()=>setRetry(n=>n+1)}/><Button label="내 취향으로" variant="text" onPress={close}/></>:<ActivityIndicator color={colors.primary}/>}</View>;
}
