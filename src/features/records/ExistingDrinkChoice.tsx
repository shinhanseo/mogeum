import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { colors, typography } from '../../theme/tokens';
import { getSupabase } from '../../lib/supabase';
import { findEntryCandidates, type EntryCandidate } from './candidates';
import type { RepeatEntry } from './repeat';
export function ExistingDrinkChoice({owner,query,selected,onSelect,onSeparate,fixtures}:{owner:string;query:string;selected:RepeatEntry|null;onSelect:(entry:RepeatEntry)=>void;onSeparate:()=>void;fixtures?:EntryCandidate[]}){
 const [result,setResult]=useState<{owner:string;query:string;items:EntryCandidate[]}|null>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{setFailed(false);if(fixtures){setResult({owner,query,items:fixtures.filter(item=>(item.name??'').includes(query.trim()))});return;}const client=getSupabase();if(!client)return;void findEntryCandidates(client,owner,query).then(items=>{if(active)setResult({owner,query,items});}).catch(()=>{if(active)setFailed(true);});},300);return()=>{active=false;clearTimeout(timer);};},[owner,query,fixtures]);
 if(selected)return <View style={s.box}><Text style={s.title}>이 술에 기록을 추가해요</Text><Text style={s.body}>{selected.name||'이름 없는 술'} · {selected.category??'종류 미정'}</Text><Button label="다른 술이에요" variant="text" onPress={onSeparate}/></View>;
 if(query.trim().length<2)return null;
 const items=result?.owner===owner&&result.query===query?result.items:[];
 if(!items.length&&!failed)return null;
 return <View style={s.box}><Text style={s.title}>내 술장에 있는 술인가요?</Text>{failed?<Text style={s.body}>후보를 불러오지 못했어요. 지금은 새 술로 기록할 수 있어요.</Text>:items.map(item=><View style={s.item} key={item.id}><Text style={s.title}>{item.name}</Text><Text style={s.body}>{item.category??'종류 미정'} · 기록 {item.recordCount}회</Text><Button label="이 술에 기록 추가" variant="secondary" onPress={()=>onSelect(item)}/></View>)}<Text style={s.body}>빈티지·연수·에디션이 같은지 확인해주세요.</Text><Button label="다른 술이에요" variant="text" onPress={onSeparate}/></View>;
}
const s=StyleSheet.create({box:{marginTop:12,padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:8},item:{paddingVertical:12,gap:8,borderBottomWidth:1,borderColor:colors.border},title:{...typography.fieldLabel,color:colors.text},body:{...typography.caption,color:colors.muted}});
