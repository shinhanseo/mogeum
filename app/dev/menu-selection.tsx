/** Synthetic layout fixture only. No auth, storage, OCR or provider calls. */
import {useState} from "react";
import {Text,View} from "react-native";
import {Redirect,useLocalSearchParams} from "expo-router";
import {MenuScreen,type MenuStep} from "../../src/features/menu/MenuScreen";
import type {MenuResult} from "../../src/features/menu/result-contract";
import {products} from "../../supabase/functions/_shared/product-catalog";
import {colors,typography} from "../../src/theme/tokens";
export default function MenuSelectionFixture(){
 const {state}=useLocalSearchParams<{state?:string}>();
 const [step,setStep]=useState<MenuStep>("results");
 if(!__DEV__)return <Redirect href="/"/>;
 const selected=state!=="daily-limit";
 const result:MenuResult={recommendations:[{itemId:"synthetic-menu",productId:products[0].id,status:"similar",similar:[{factId:"향:과일 향",label:"과일 향",recordIds:["synthetic-record"],negativeIds:[]}],other:[],knownRecordIds:[],score:1}],evidenceRecords:[{id:"synthetic-record",name:"합성 기록",date:"2026-10-30",revision:1,category:"whisky",revisit:"again",noteText:null}],tasteHash:"synthetic",recordCount:1,method:selected?"gemini-menu-selection-v1":"evidence-rules-v1",modelUsed:selected,selectionState:selected?"generated":"daily-limit",limitedCatalog:true,catalog:products};
 return <View style={{flex:1,backgroundColor:colors.background}}><Text style={{...typography.caption,textAlign:"center",color:colors.primary}}>개발 시안 · 합성 결과 · 서버 호출 없음</Text><MenuScreen
  step={step} onStep={setStep} result={result} busy={false} error=""
  draft={{id:"synthetic",revision:0,photos:[],items:[{id:"synthetic-menu",photoId:"synthetic-photo",imageRevision:1,lineIds:[],name:products[0].name,productId:products[0].id,price:15000,serving:"30ml",confirmed:true}]}}
  onAdd={()=>{}} onRemove={()=>{}} onRetry={()=>{}} onCancel={()=>{}} onParse={()=>{}} onRecommend={()=>{}} onEdit={()=>{}} onDeleteItem={()=>{}} onManual={()=>null} onClose={()=>{}} onEvidence={()=>{}}
 /></View>;
}
