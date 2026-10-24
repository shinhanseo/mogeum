import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { RecordComposer } from '../record';
const fixtures=[{id:'fixture-entry',name:'발베니 더블우드 12년',category:'위스키',recordCount:3}] as const;
const entries=[...fixtures];
export default function ExistingPreview(){if(!__DEV__)return <Redirect href="/"/>;return <View style={{flex:1}}><Text style={{fontSize:11,textAlign:'center',backgroundColor:'#F2E5E8'}}>개발 시안 · 후보 예시 · 서버 저장 없음</Text><RecordComposer owner="fixture-owner" previewCandidates={entries}/></View>;}
