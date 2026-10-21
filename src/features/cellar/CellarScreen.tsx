import { useState } from 'react';
import { FlatList, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { ChoiceChip } from '../../components/ChoiceChip';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { categories, shelfRows, type Category, type CellarItem } from './model';

function PhotoCard({ item }: { item: CellarItem }) {
  const [failed, setFailed] = useState(false);
  return <View style={styles.card}>
    {item.photoUri && !failed ? <Image source={{ uri: item.photoUri }} onError={() => setFailed(true)} resizeMode="cover" style={styles.photo} accessibilityLabel={`${item.name ?? '이름 없는 술'} 사진`} /> : <View style={[styles.photo, styles.fallback]}><Icon name="photo" /><Text style={styles.category}>사진 없음</Text></View>}
    <Text numberOfLines={2} style={styles.name}>{item.name || '이름 없는 술'}</Text>
    <Text style={styles.category}>{item.category || '종류 미정'}</Text>
  </View>;
}
export function CellarScreen({ items, onRecord }: { items: CellarItem[]; onRecord: () => void }) {
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [query, setQuery] = useState('');
  const filtered = items.filter(item => (category === '전체' || category === item.category) && (item.name ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const empty = items.length === 0;
  return <View style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.title}>나의 술장</Text><Text style={styles.count}>모아둔 술 {items.length}</Text>
      {!empty && <TextInput accessibilityLabel="술 이름 검색" placeholder="술 이름으로 찾기" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.search} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>{(['전체', ...categories] as const).map(value => <ChoiceChip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} compact />)}</ScrollView>
    </View>
    {!empty && filtered.length === 0 ? <View style={styles.noResults}><Text style={styles.emptyTitle}>찾는 술이 없어요</Text><Button label="검색 조건 지우기" variant="secondary" onPress={() => { setCategory('전체'); setQuery(''); }} /></View> :
      <FlatList data={shelfRows(filtered)} keyExtractor={(_, index) => `shelf-${index}`} contentContainerStyle={styles.list} renderItem={({ item: row, index }) => <View style={styles.shelf}>
        <View style={styles.slots}>{row.map((item, column) => <View key={item?.id ?? `empty-${column}`} style={styles.slot}>{item && <PhotoCard item={item} />}</View>)}</View>
        {empty && index === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>아직 비어 있어도 괜찮아.</Text><Text style={styles.emptyBody}>마신 한 잔의 사진부터 모아볼까요?</Text><Button label="첫 사진 남기기" onPress={onRecord} /></View>}
        <View style={styles.shelfTop} /><View style={styles.shelfFront} />
      </View>} />}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, header: { padding: 20, paddingBottom: 16, gap: 4 }, title: { fontSize: 24, lineHeight: 36, fontFamily: fonts.bold, color: colors.text },
  count: { fontSize: 13, lineHeight: 22, fontFamily: fonts.regular, color: colors.muted }, filterScroll: { marginTop: 12 }, filters: { flexDirection: 'row', gap: 6 },
  search: { minHeight: 44, backgroundColor: colors.cabinet.top, paddingHorizontal: 14, borderRadius: 12, color: colors.text, fontFamily: fonts.regular },
  list: { paddingHorizontal: 16, paddingBottom: 24 }, shelf: { minHeight: 228, backgroundColor: colors.cabinet.back, borderLeftWidth: 10, borderRightWidth: 10, borderColor: colors.cabinet.side },
  slots: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 5, paddingTop: 20, minHeight: 212 }, slot: { flex: 1, minWidth: 0 },
  card: { padding: 6, backgroundColor: colors.surface, borderRadius: 3, gap: 4 }, photo: { width: '100%', aspectRatio: 3 / 4 },
  fallback: { backgroundColor: colors.cabinet.top, alignItems: 'center', justifyContent: 'center', gap: 8 },
  name: { minHeight: 34, fontSize: 12, lineHeight: 17, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' }, category: { fontSize: 10, lineHeight: 16, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  shelfTop: { height: 6, backgroundColor: colors.cabinet.top }, shelfFront: { height: 10, backgroundColor: colors.cabinet.front, borderBottomWidth: 2, borderBottomColor: colors.cabinet.shadow },
  empty: { position: 'absolute', top: 32, left: 20, right: 20, gap: 12 }, emptyTitle: { fontSize: 16, lineHeight: 26, color: colors.text, fontFamily: fonts.medium, textAlign: 'center' },
  emptyBody: { fontSize: 12, lineHeight: 20, color: colors.muted, fontFamily: fonts.regular, textAlign: 'center' }, noResults: { padding: 24, gap: 20 },
});
