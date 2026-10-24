import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { colors, fonts, typography } from '../../theme/tokens';
import { questionCounts, type NoteMode, type TastingCategory } from './catalog';
import { lightNoteIcon, deepNoteIcon } from './icons';

export function ModeSheet({ visible, category, onChoose, onClose }: { visible: boolean; category: TastingCategory; onChoose: (mode: NoteMode) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="기록 방식 선택 닫기" style={styles.scrim} onPress={onClose} />
    <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(24, insets.bottom + 16) }]}>
      <View style={styles.handle} /><Text style={styles.title}>어떻게 남길까요?</Text><Text style={styles.subtitle}>오늘의 한 잔, 원하는 깊이만큼.</Text>
      {(['light', 'deep'] as const).map(mode => <Pressable key={mode} accessibilityRole="button" onPress={() => onChoose(mode)} style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.selected }]}>
        <SvgXml xml={mode === 'light' ? lightNoteIcon : deepNoteIcon} />
        <View style={styles.copy}><Text style={styles.cardTitle}>{mode === 'light' ? '가볍게 남기기' : '자세히 남기기'}</Text><Text style={styles.description}>{mode === 'light' ? '떠오르는 향과 맛을 편하게' : '세부 향과 강도까지 차근차근'}</Text><Text style={styles.count}>{questionCounts[category][mode]}개의 질문</Text></View><Text style={styles.arrow}>›</Text>
      </Pressable>)}
    </View>
  </View></Modal>;
}
const styles = StyleSheet.create({
  root: { flex:1, justifyContent:'flex-end' }, scrim:{ ...StyleSheet.absoluteFill, backgroundColor:colors.scrim },
  sheet:{ width:'100%', maxWidth:600, alignSelf:'center', backgroundColor:colors.surface, borderTopLeftRadius:24, borderTopRightRadius:24, paddingHorizontal:24, paddingTop:12, gap:12 },
  handle:{ width:36,height:4,borderRadius:2,backgroundColor:colors.border,alignSelf:'center',marginBottom:8 },
  title:{...typography.sheetTitle,color:colors.text}, subtitle:{fontFamily:fonts.regular,fontSize:14,lineHeight:22,color:colors.muted,marginBottom:4},
  card:{borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.background,padding:16,flexDirection:'row',alignItems:'center',gap:16,minHeight:104},
  copy:{flex:1,gap:2},cardTitle:{...typography.modeTitle,color:colors.primary},description:{fontFamily:fonts.regular,fontSize:13,lineHeight:21,color:colors.muted},count:{fontFamily:fonts.regular,fontSize:12,lineHeight:20,color:colors.primary},arrow:{fontFamily:fonts.regular,fontSize:22,lineHeight:30,color:colors.primary},
});
