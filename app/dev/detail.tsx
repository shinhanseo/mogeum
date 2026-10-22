import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { RecordDetailScreen } from '../../src/features/records/RecordDetailScreen';
import type { RecordDetail } from '../../src/features/records/detail';
export default function DetailPreview(){
 const params=useLocalSearchParams<{note?:string}>();const router=useRouter();if(!__DEV__)return <Redirect href="/"/>;
 const record:RecordDetail={id:'fixture',cellar_entry_id:'fixture-entry',entered_name:'발베니 더블우드 12년',category:'whisky',consumed_at:'2026-10-19T12:00:00Z',revisit:'again',rating:4,vintage_status:null,vintage_year:null,record_photos:[],record_notes:params.note==='1'?{confirmed_note:'과일과 꿀·바닐라가 떠오르는 향.\n살짝 달고 입안을 매끈하게 감쌌다.\n향이나 맛이 오래 남았다.',mode:'light',catalog_version:2}:null};
 return <View style={{flex:1}}><Text accessibilityRole="alert" style={{fontSize:11,textAlign:'center',backgroundColor:'#F2E5E8'}}>개발 시안 · 예시 기록 · 서버 저장 없음</Text><RecordDetailScreen record={record} photoUri={Image.resolveAssetSource(require('../../assets/fixtures/figma-whisky.jpg'))?.uri??null} history={[{id:'fixture',consumed_at:record.consumed_at},{id:'fixture2',consumed_at:'2026-10-10T12:00:00Z'}]} onClose={()=>router.replace('/')} onNote={()=>router.push('/dev/tasting')} onSelect={()=>{}} onRepeat={()=>router.push('/dev/repeat')}/></View>;
}
