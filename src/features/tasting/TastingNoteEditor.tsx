import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, typography } from "../../theme/tokens";

/** The keyboard resizes this viewport; only the native input scrolls its caret. */
export function TastingNoteEditor({
  value,
  categoryLabel,
  modeLabel,
  onChange,
}: {
  value: string;
  categoryLabel: string;
  modeLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={s.page}>
      <Text style={s.title}>내 말로 다듬어볼까요?</Text>
      <Text style={s.caption}>
        {categoryLabel} · {modeLabel} 남긴 노트
      </Text>
      <TextInput
        accessibilityLabel="노트 문장 직접 수정"
        value={value}
        onChangeText={onChange}
        multiline
        scrollEnabled
        maxLength={10000}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => Keyboard.dismiss()}
        style={s.editor}
      />
      <Text style={s.hint}>감각을 바꾸려면 답변 수정을 이용해요.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  title: { ...typography.title, color: colors.text },
  caption: { ...typography.caption, color: colors.primary },
  hint: { ...typography.caption, color: colors.muted },
  editor: {
    flex: 1,
    minHeight: 0,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 24,
    color: colors.text,
    textAlignVertical: "top",
    includeFontPadding: true,
  },
});
