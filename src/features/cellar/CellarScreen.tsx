import { useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Button } from '../../components/Button';
import { ChoiceChip } from '../../components/ChoiceChip';
import { Icon } from '../../components/Icon';
import { colors, fonts, typography, layout } from '../../theme/tokens';
import { categories, shelfRows, type Category, type CellarItem } from './model';

function PhotoCard({ item, onPress }: { item: CellarItem; onPress: () => void }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name ?? '이름 없는 술'} 기록 보기`} onPress={onPress} style={styles.card}>
    {item.photoUri && item.photoUri !== failedUri ? <Image source={{ uri: item.photoUri }} onError={() => setFailedUri(item.photoUri)} resizeMode="cover" style={styles.photo} accessibilityLabel={`${item.name ?? '이름 없는 술'} 사진`} /> : <View style={[styles.photo, styles.fallback]}><Icon name="photo" /><Text style={styles.category}>사진 없음</Text></View>}
    <Text numberOfLines={2} style={styles.name}>{item.name || '이름 없는 술'}</Text>
    <Text style={styles.category}>{item.category || '종류 미정'}</Text>
  </Pressable>;
}
export function CellarScreen({ items, onRecord, onOpen }: { items: CellarItem[]; onRecord: () => void; onOpen: (entryId: string) => void }) {
  const { width } = useWindowDimensions();
  const filterScale = Math.min(1, (width - 48) / 352);
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const filtered = items.filter(item => (category === '전체' || category === item.category) && (item.name ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const empty = items.length === 0;
  return <View style={styles.page}>
    <View style={styles.header}>
      <View style={styles.titleRow}><Text style={styles.title}>나의 술장</Text><Pressable accessibilityRole="button" accessibilityLabel="술 찾기" onPress={() => setSearchOpen(!searchOpen)} style={styles.searchAction}><Icon name="search" color={colors.text} /></Pressable></View><Text style={styles.count}>모아둔 술 {items.length}</Text>
      {searchOpen && <TextInput accessibilityLabel="술 이름 검색" placeholder="술 이름으로 찾기" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={styles.search} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>{(['전체', ...categories] as const).map(value => <ChoiceChip key={value} label={value} selected={category === value} onPress={() => setCategory(value)} compact style={{ paddingHorizontal: 15 * filterScale, minWidth: ({ 전체: 49, 위스키: 67, 와인: 53, 맥주: 53, 전통주: 74 })[value] * filterScale }} />)}</ScrollView>
    </View>
    {!empty && filtered.length === 0 ? <View style={styles.noResults}><Text style={styles.emptyTitle}>찾는 술이 없어요</Text><Button label="검색 조건 지우기" variant="secondary" onPress={() => { setCategory('전체'); setQuery(''); }} /></View> :
      <FlatList data={shelfRows(filtered)} keyExtractor={(_, index) => `shelf-${index}`} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} renderItem={({ item: row, index }) => <View style={styles.shelf}>
        <View style={styles.slots}>{row.map((item, column) => <View key={item?.id ?? `empty-${column}`} style={styles.slot}>{item && <PhotoCard item={item} onPress={() => onOpen(item.id)} />}</View>)}</View>
        {empty && index === 0 && <View style={styles.empty}><Text style={styles.emptyTitle}>아직 비어 있어도 괜찮아.</Text><Text style={styles.emptyBody}>마신 한 잔의 사진부터 모아볼까요?</Text><Button label="첫 사진 남기기" onPress={onRecord} style={{ marginTop: 4, marginHorizontal: 20 }} /></View>}
        <View style={styles.shelfTop} /><View style={styles.shelfFront} />
      </View>} />}
  </View>;
}
const styles = StyleSheet.create({
  page: { flex: 1 }, header: { minHeight: layout.cellarHeader, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 27 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, searchAction: { width: 36, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { ...typography.heading, color: colors.text },
  count: { marginTop: 4, fontSize: 13, lineHeight: 22, fontFamily: fonts.regular, color: colors.muted }, filterScroll: { marginTop: 24, flexGrow: 0 }, filters: { flexDirection: 'row', gap: 6 },
  search: { minHeight: 44, backgroundColor: colors.cabinet.top, paddingHorizontal: 14, borderRadius: 12, color: colors.text, fontFamily: fonts.regular },
  list: { paddingHorizontal: 16, paddingBottom: 24 }, shelf: { minHeight: 228, backgroundColor: colors.cabinet.back, borderLeftWidth: 10, borderRightWidth: 10, borderColor: colors.cabinet.side },
  slots: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 6, paddingTop: 20, minHeight: 212 }, slot: { flex: 1, minWidth: 0 },
  card: { padding: 4, backgroundColor: colors.surface, borderRadius: 3, gap: 4 }, photo: { width: '100%', aspectRatio: 3 / 4 },
  fallback: { backgroundColor: colors.cabinet.top, alignItems: 'center', justifyContent: 'center', gap: 8 },
  name: { minHeight: 32, fontSize: 11, lineHeight: 16, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' }, category: { fontSize: 10, lineHeight: 16, fontFamily: fonts.regular, color: colors.muted, textAlign: 'center' },
  shelfTop: { height: 6, backgroundColor: colors.cabinet.top }, shelfFront: { height: 10, backgroundColor: colors.cabinet.front, borderBottomWidth: 2, borderBottomColor: colors.cabinet.shadow },
  empty: { position: 'absolute', top: 36, left: 14, right: 14, gap: 12 }, emptyTitle: { fontSize: 20, lineHeight: 24, color: colors.muted, fontFamily: fonts.regular, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.muted, fontFamily: fonts.regular, textAlign: 'center' }, noResults: { padding: 24, gap: 20 },
});
