import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useConfirmDialog } from '../../src/components/ConfirmDialog';
import { Button } from '../../src/components/Button';
import { colors, space, typography } from '../../src/theme/tokens';
export default function DialogPreview() {
 const dialog=useConfirmDialog();
 const [status,setStatus]=useState('개발용 미리보기 · 실제 저장·삭제 없음');
 if(!__DEV__||Platform.OS==='web')return <Redirect href="/"/>;
 return <SafeAreaView style={s.page}><ScrollView contentContainerStyle={s.content}>
  <Text style={s.title}>모금 확인창</Text><Text style={s.body}>{status}</Text>
  <Button label="기록 삭제 확인" onPress={()=>dialog.show('이 날짜의 기록을 삭제할까요?','사진과 노트도 삭제돼요. 같은 술의 다른 날짜 기록은 남아요.',[{text:'취소',style:'cancel'},{text:'삭제',style:'destructive',onPress:()=>setStatus('삭제 행동 선택 · 실제 삭제 없음')}])}/>
  <Button label="변경 취소 확인" variant="secondary" onPress={()=>dialog.show('수정을 취소할까요?','저장하지 않은 변경은 사라져요.',[{text:'계속 수정',style:'cancel'},{text:'수정 취소',style:'destructive',onPress:()=>setStatus('수정 취소 선택')}])}/>
  <Button label="문장 다시 정리 확인" variant="secondary" onPress={()=>dialog.show('직접 다듬은 문장이 있어요','기존 문장을 유지하거나 새 답변으로 다시 정리할 수 있어요.',[{text:'기존 문장 유지',onPress:()=>setStatus('기존 문장 유지')},{text:'다시 정리',onPress:()=>setStatus('다시 정리 선택')}])}/>
 </ScrollView>{dialog.modal}</SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{padding:space.xl,gap:space.lg},title:{...typography.title,color:colors.text},body:{...typography.body,color:colors.muted}});
