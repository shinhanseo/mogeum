import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';
export default function NotFound() {
  return <><Stack.Screen options={{ title: '페이지를 찾을 수 없어요', headerShown: true }} /><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}><Text>페이지를 찾을 수 없어요.</Text><Link href="/">시작 화면으로</Link></View></>;
}
