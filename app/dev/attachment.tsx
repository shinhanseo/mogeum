import { useCallback,useState } from 'react';
import { Redirect,useLocalSearchParams,useRouter } from 'expo-router';
import { Image,Text,View } from 'react-native';
import { AttachmentScreen,type MoveTarget } from '../../src/features/records/AttachmentScreen';
import type { RecordDetail } from '../../src/features/records/detail';
const fixture:RecordDetail={id:'fixture',revision:1,cellar_entry_id:'fixture-entry',entered_name:'발베니 더블우드 12년',category:'whisky',consumed_at:'2026-10-19T12:00:00Z',revisit:'again',rating:4,vintage_status:null,vintage_year:null,record_photos:[],record_notes:{confirmed_note:'과일 향과 부드러운 여운.',mode:'deep',catalog_version:2}};
const targets:MoveTarget[]=[{id:'fixture-target',display_name:'글렌리벳 12년',category:'whisky',record_count:2},{id:'fixture-target2',display_name:'이름 없는 맥주 기록',category:'beer',record_count:1}];
export default function AttachmentPreview(){
 const {kind,selected}=useLocalSearchParams<{kind:string;selected:string}>();const router=useRouter();const [status,setStatus]=useState('');
 const load=useCallback(async(query:string)=>targets.filter(t=>(t.display_name??'').includes(query)),[]);
 if(!__DEV__)return <Redirect href="/"/>;const photo=Image.resolveAssetSource(require('../../assets/fixtures/figma-whisky.jpg'));
 return <View style={{flex:1}}><Text style={{fontSize:11,textAlign:'center',backgroundColor:'#F2E5E8'}}>개발 시안 · 서버 저장 없음 {status}</Text><AttachmentScreen record={fixture} photoUri={photo?.uri??null} kind={kind==='photo'?'photo':'move'} pending={null} loadTargets={load} onApply={async input=>{setStatus(input.kind==='photo'?'사진 교체 확인':input.kind==='split'?'새 술 분리 확인':'기록 이동 확인');}} onRetry={async()=>{}} onDiscard={async()=>{}} onClose={()=>router.replace('/dev/edit')} previewPhoto={selected==='1'&&photo?{uri:photo.uri,width:900,height:1200}:undefined}/></View>;
}
