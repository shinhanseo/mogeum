import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Image, Text, View } from 'react-native';
import { RecordEditScreen } from '../../src/features/records/RecordEditScreen';
import { basicPatch } from '../../src/features/records/edit';
import type { RecordDetail } from '../../src/features/records/detail';
const fixture:RecordDetail={id:'fixture',revision:1,cellar_entry_id:'fixture-entry',entered_name:'발베니 더블우드 12년',category:'whisky',consumed_at:'2026-10-19T12:00:00Z',revisit:'again',rating:4,vintage_status:null,vintage_year:null,record_photos:[],record_notes:{confirmed_note:'과일과 꿀·바닐라가 떠오르는 향.\n살짝 달고 입안을 매끈하게 감쌌다.',mode:'light',catalog_version:2}};
export default function EditPreview(){
 const router=useRouter();const [record,setRecord]=useState(fixture);const [status,setStatus]=useState('');const [revision,setRevision]=useState(0);
 if(!__DEV__)return <Redirect href="/"/>;
 return <View style={{flex:1}}><Text style={{fontSize:11,textAlign:'center',backgroundColor:'#F2E5E8'}}>개발 시안 · 서버 저장 없음 {status}</Text><RecordEditScreen key={revision} record={record} multiple={false} onDeleteEntry={()=>router.push({pathname:"/dev/cellar-manage",params:{confirm:"1"}})} onPhoto={()=>router.push({pathname:'/dev/attachment',params:{kind:'photo'}})} onMove={()=>router.push({pathname:'/dev/attachment',params:{kind:'move'}})} photoUri={Image.resolveAssetSource(require('../../assets/fixtures/figma-whisky.jpg'))?.uri??null} onSave={async value=>{const patch=basicPatch(record,value);setRecord({...record,entered_name:patch.enteredName,consumed_at:patch.consumedAt,revisit:patch.revisit,rating:patch.rating});setStatus('로컬 저장 확인');setRevision(n=>n+1);}} onDelete={async()=>{setStatus('삭제 확인 · fixture 유지');}} onClose={()=>{setStatus('취소 · 원본 복원');setRevision(n=>n+1);}} onReload={()=>setRevision(n=>n+1)}/></View>;
}
