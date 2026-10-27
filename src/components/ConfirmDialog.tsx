import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { colors, radius, space, typography } from '../theme/tokens';

type DialogAction = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };
type Dialog = { title: string; message: string; actions: DialogAction[] };
/** Screen-owned: leaving the screen unmounts the confirmation and its callbacks. */
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const current = useRef<Dialog | null>(null);
  const show = useCallback((title: string, message: string, actions: DialogAction[]) => {
    if (current.current) return;
    Keyboard.dismiss();
    const next = { title, message, actions };
    current.current = next;
    setDialog(next);
  }, []);
  const cancel = useCallback(() => {
    const value = current.current;
    current.current = null;
    setDialog(null);
    // Back, scrim and accessibility escape only dismiss; never run a destructive action.
    value?.actions.find(action => action.style === 'cancel')?.onPress?.();
  }, []);
  function choose(action: DialogAction) {
    if (!current.current) return;
    current.current = null;
    setDialog(null);
    action.onPress?.();
  }
  const destructive = dialog?.actions.some(action => action.style === 'destructive');
  const modal = <Modal visible={dialog !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={cancel}
    onShow={() => { if (current.current) AccessibilityInfo.announceForAccessibility(current.current.title); }}>
    <SafeAreaView style={styles.overlay}>
      <Pressable style={styles.scrim} accessibilityRole="button" accessibilityLabel="확인창 닫기" onPress={cancel} />
      <View accessibilityViewIsModal onAccessibilityEscape={cancel} style={styles.card}>
        <ScrollView bounces={false} contentContainerStyle={styles.copy}>
          <View style={styles.mark}><Text style={styles.markText}>{destructive ? '!' : '· · ·'}</Text></View>
          <Text accessibilityRole="header" style={styles.title}>{dialog?.title}</Text>
          <Text style={styles.message}>{dialog?.message}</Text>
        </ScrollView>
        <View style={styles.actions}>
          {dialog?.actions.filter(action => action.style !== 'cancel').map((action, index) =>
            <Button key={`${index}-${action.text}`} label={action.text} variant={index === 0 && dialog.actions.filter(a => a.style !== 'cancel').length > 1 ? 'secondary' : 'primary'} onPress={() => choose(action)} />)}
          {dialog?.actions.filter(action => action.style === 'cancel').map((action, index) =>
            <Button key={`${index}-${action.text}`} label={action.text} variant="text" onPress={() => choose(action)} />)}
        </View>
      </View>
    </SafeAreaView>
  </Modal>;
  return { show, modal };
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  card: { width: '100%', maxWidth: 360, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl, gap: space.xl },
  copy: { gap: space.md },
  mark: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.selected, justifyContent: 'center', alignItems: 'center', marginBottom: space.xs },
  markText: { ...typography.title, color: colors.primary, textAlign: 'center' },
  title: { ...typography.title, color: colors.text },
  message: { ...typography.body, color: colors.muted },
  actions: { gap: space.sm },
});
