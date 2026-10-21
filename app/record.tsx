import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { ChoiceChip } from '../src/components/ChoiceChip';
import { Icon } from '../src/components/Icon';
import { categories, type Category } from '../src/features/cellar/model';
import { colors, fonts } from '../src/theme/tokens';

export default function RecordScreen() {
  const router = useRouter();
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function pickPhoto() {
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.85 });
      if (!result.canceled && result.assets[0]) setPhoto(result.assets[0]);
    } catch { setError('사진을 열지 못했어요. 앨범 접근 권한을 확인하고 다시 시도해주세요.'); }
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><Text style={styles.title}>한 잔 남기기</Text><Pressable accessibilityRole="button" accessibilityLabel="기록 닫기" onPress={() => router.back()} style={styles.close}><Icon name="close" /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {photo ? <><Image source={{ uri: photo.uri }} resizeMode="contain" style={styles.photo} /><Button label="사진 바꾸기" variant="text" onPress={pickPhoto} /></> : <Button label="앨범에서 사진 고르기" onPress={pickPhoto} />}
      {!!error && <Text accessibilityRole="alert" style={styles.body}>{error}</Text>}
      <Text style={styles.label}>술 이름 · 선택</Text><TextInput accessibilityLabel="술 이름" value={name} onChangeText={setName} placeholder="어떤 술을 마셨나요?" placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.label}>종류 · 선택</Text><View style={styles.choices}>{categories.map(value => <ChoiceChip key={value} label={value} selected={category === value} onPress={() => setCategory(category === value ? null : value)} />)}</View>
      <Text style={styles.label}>이 술, 어땠어요?</Text>{['또 마시고 싶어요', '괜찮아요', '내 취향이 아니에요'].map(value => <ChoiceChip key={value} label={value} selected={feeling === value} onPress={() => setFeeling(value)} />)}
      <Text style={styles.body}>저장 기능을 연결하고 있어요. 지금 입력한 내용은 아직 저장되지 않아요.</Text>
      <Button label="기록 저장 · 연결 준비 중" disabled onPress={() => {}} />
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: colors.text }, close: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 24, gap: 12, paddingBottom: 40 }, photo: { height: 220, width: '100%', backgroundColor: colors.cabinet.top, borderRadius: 12 },
  label: { marginTop: 8, fontFamily: fonts.medium, fontSize: 14, color: colors.text }, input: { minHeight: 52, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, color: colors.text, fontFamily: fonts.regular, fontSize: 16 },
  choices: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 22, color: colors.muted },
});
