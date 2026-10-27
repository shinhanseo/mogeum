import { useState } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { CellarManageScreen } from '../../src/features/cellar/CellarManageScreen';
import { colors, typography } from '../../src/theme/tokens';
export default function Preview() {
 const router = useRouter(); const { count = '3', conflict, confirm } = useLocalSearchParams<{count?:string;conflict?:string;confirm?:string}>(); const [deleted, setDeleted] = useState(false);
 if (!__DEV__) return <Redirect href="/" />;
 return <View style={{flex:1,backgroundColor:colors.background}}><Text style={{...typography.caption,color:colors.primary,textAlign:'center'}}>합성 시안 · 실제 데이터 삭제 없음</Text><CellarManageScreen initialConfirm={confirm==='1'} context={deleted ? {entryId:'10000000-0000-4000-8000-000000000001',deleted:true} : {entryId:'10000000-0000-4000-8000-000000000001',deleted:false,name:'발베니 더블우드 12년',count:Number(count)||1,latestRecordId:'10000000-0000-4000-8000-000000000002',snapshot:'a'.repeat(32)}} onClose={()=>router.replace('/dev/cellar')} onRecords={()=>router.push('/dev/edit')} onReload={()=>router.replace('/dev/cellar-manage')} onDelete={async()=>{if(conflict==='1') throw Object.assign(Error('changed'),{code:'40001'});setDeleted(true);}} /></View>;
}
