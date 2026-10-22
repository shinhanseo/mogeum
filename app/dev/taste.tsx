import { Image, Text, View } from 'react-native';
import { Redirect,useLocalSearchParams,useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TasteScreen } from '../../src/features/taste/TasteScreen';
import { TasteEvidenceScreen } from '../../src/features/taste/TasteEvidenceScreen';
import { analyzeTaste,type TasteContext,type TasteRecord } from '../../src/features/taste/repository';
import { BottomTabBar } from '../../src/components/BottomTabBar';
import { colors,typography } from '../../src/theme/tokens';
export default function DevTaste(){
 const {count='8',evidence,factId}=useLocalSearchParams<{count?:string;evidence?:string;factId?:string}>();const router=useRouter();
 if(!__DEV__)return <Redirect href="/"/>;
 const records:TasteRecord[]=Array.from({length:Math.min(8,Math.max(0,Number(count)||0))},(_,n)=>({id:`fixture-${n}`,entryId:`drink-${n}`,revision:1,category:n%2?'beer':'whisky',name:n%2?'시트러스 IPA':'발베니 더블우드 12년',date:'2026-10-19',revisit:'again',rating:4,note:{mode:'light',version:2,inputRevision:1,confirmedInputRevision:1,confirmed:true,text:'과일 향이 떠올랐어요. 가볍게 마시기 좋았어요.',answers:[{questionId:'nose',status:'answered',descriptorCodes:['fruit']},{questionId:'body',status:'answered',descriptorCodes:['light']}]}}));
 const snapshot={hash:'fixture',records,totalRecords:records.length,omittedCount:0};const analysis=analyzeTaste(snapshot);const selected=analysis.facts.filter(f=>f.positiveIds.length).slice(0,3).map(f=>f.id);
 const context:TasteContext={snapshot,cached:selected.length?{version:'taste-v1',selection:{highlightIds:selected},generatedAt:'2026-10-23',model:'explicit-fixture'}:null,stale:false,running:false};
 const uri=Image.resolveAssetSource(require('../../assets/fixtures/figma-whisky.jpg'))!.uri;const photos=Object.fromEntries(records.map(r=>[r.id,uri]));
 return <View style={{flex:1,backgroundColor:colors.background}}><Text style={{...typography.caption,textAlign:'center',color:colors.primary,backgroundColor:colors.selected}}>개발 시안 · AI 호출·서버 저장 없음</Text>{evidence==='1'?<TasteEvidenceScreen context={context} factId={factId} photos={photos} onClose={()=>router.replace({pathname:'/dev/taste',params:{count}})} onOpen={()=>router.push('/dev/detail')}/>:<SafeAreaView edges={['top','left','right']} style={{flex:1}}><TasteScreen context={context} photos={photos} onGenerate={()=>{}} onRecord={()=>router.push('/dev/edit')} onOpen={()=>router.push('/dev/detail')} onEvidence={id=>router.push({pathname:'/dev/taste',params:{count,evidence:'1',...(id?{factId:id}:{})}})}/><BottomTabBar selected="taste" onSelect={()=>{}} onRecord={()=>router.push('/dev/existing')}/></SafeAreaView>}</View>;
}
