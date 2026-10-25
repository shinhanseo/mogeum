import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader, WebStatusSpace } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { RatingStar } from '../../components/RatingStar';
import { Icon } from '../../components/Icon';
import { colors, fonts, typography } from '../../theme/tokens';
import { recordDate, type RecordDetail } from './detail';
const categories:Record<string,string>={whisky:'위스키',wine:'와인',beer:'맥주',traditional:'전통주',other:'기타'};
const feelings={again:'또 마시고 싶어요',okay:'괜찮아요',not_for_me:'내 취향이 아니에요'};
export function RecordDetailScreen({record,photoUri,history,onClose,onNote,onSelect,onRepeat,onEdit,onPhotoError,onCutout}:{record:RecordDetail;photoUri:string|null;history:{id:string;consumed_at:string}[];onClose:()=>void;onNote:()=>void;onSelect:(id:string)=>void;onRepeat:()=>void;onEdit:()=>void;onPhotoError?:(uri:string)=>void;onCutout?:()=>void}){
 const [failed,setFailed]=useState<string|null>(null);
 const note=record.record_notes?.confirmed_note;
 return <SafeAreaView style={s.page}><WebStatusSpace/><ScreenHeader title="내 술 기록" onBack={onClose} onClose={onClose}/><ScrollView contentContainerStyle={s.content}>
 {photoUri&&photoUri!==failed?<Image source={{uri:photoUri}} onError={()=>{setFailed(photoUri);onPhotoError?.(photoUri);}} style={s.photo} resizeMode="cover" accessibilityLabel="마신 술 사진"/>:<View style={[s.photo,s.placeholder]}><Icon name="photo"/><Text style={s.meta}>{record.record_photos.length>0?'사진을 불러오지 못했어요':'사진 없이 남긴 한 잔'}</Text></View>}
 {photoUri&&onCutout&&<Button label="술장에 배경 없이 놓기" variant="text" onPress={onCutout}/>}
 <Text style={s.category}>{categories[record.category??'']??'종류 미정'}</Text><Text style={s.name}>{record.entered_name||'이름 없는 술'}</Text>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><Text style={s.meta}>{recordDate(record.consumed_at)} · 나만 보기{record.vintage_status==='year'?` · ${record.vintage_year} 빈티지`:record.vintage_status==='nv'?' · NV':''}</Text><Pressable accessibilityRole="button" accessibilityLabel="기록 기본 정보 수정" onPress={onEdit} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={[s.meta,{color:colors.primary}]}>수정</Text></Pressable></View>
 {record.revisit&&<Text style={s.feeling}>{feelings[record.revisit]}</Text>}
 {note?<View style={s.note}><Text style={s.noteTitle}>나의 테이스팅 노트</Text><Text style={s.prose}>{note}</Text></View>:<Text style={s.meta}>테이스팅 노트는 나중에 추가해도 돼요.</Text>}
 {record.rating!==null&&<View style={s.stars} accessibilityLabel={`내 별점 ${record.rating}점`}>{[1,2,3,4,5].map(n=><RatingStar key={n} filled={n<=record.rating!}/>)}</View>}
 {history.length>1&&<View style={s.history}><Text style={s.noteTitle}>이 술을 마신 날</Text>{history.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:item.id===record.id}} onPress={()=>onSelect(item.id)} style={s.historyRow}><Text style={[s.meta,item.id===record.id&&s.active]}>{recordDate(item.consumed_at)}</Text><Text style={s.meta}>{item.id===record.id?'보고 있는 기록':'기록 보기 ›'}</Text></Pressable>)}</View>}
 </ScrollView><View style={s.footer}><Button label={note?'한 번 더 기록하기':'테이스팅 노트 추가'} onPress={note?onRepeat:onNote}/><Button variant="text" label={note?'테이스팅 노트 수정':'한 번 더 기록하기'} onPress={note?onNote:onRepeat}/></View></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{paddingHorizontal:24,paddingTop:13,paddingBottom:24,width:'100%',maxWidth:600,alignSelf:'center'},photo:{width:'100%',aspectRatio:3/4,borderRadius:16},placeholder:{backgroundColor:colors.illustration,justifyContent:'center',alignItems:'center',gap:12},category:{alignSelf:'flex-start',marginTop:17,borderRadius:15,paddingHorizontal:16,paddingVertical:7,backgroundColor:colors.chip,color:colors.muted,fontSize:11,lineHeight:16,fontFamily:fonts.regular},name:{fontSize:26,lineHeight:36,fontFamily:fonts.bold,color:colors.text,marginTop:7},meta:{...typography.caption,color:colors.muted,marginTop:6},feeling:{alignSelf:'flex-start',...typography.caption,color:colors.primary,backgroundColor:colors.selected,borderRadius:16,paddingHorizontal:18,paddingVertical:7,marginTop:14,marginBottom:19},note:{padding:18,borderRadius:16,backgroundColor:colors.surface,gap:12},noteTitle:{...typography.fieldLabel,color:colors.text},prose:{fontSize:13,lineHeight:25,fontFamily:fonts.regular,color:colors.text},stars:{flexDirection:'row',gap:16,marginVertical:16},footer:{paddingHorizontal:24,paddingTop:16,paddingBottom:14,width:'100%',maxWidth:600,alignSelf:'center'},history:{marginTop:24,gap:12},historyRow:{minHeight:48,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderColor:colors.border},active:{color:colors.primary,fontFamily:fonts.bold}});
