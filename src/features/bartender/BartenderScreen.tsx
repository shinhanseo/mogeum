import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Button } from "../../components/Button";
import { ChoiceChip } from "../../components/ChoiceChip";
import { ScreenHeader, WebStatusSpace } from "../../components/ScreenHeader";
import { useConfirmDialog } from "../../components/ConfirmDialog";
import { colors, fonts, radius, space, typography } from "../../theme/tokens";
import { getSupabase } from "../../lib/supabase";
import { accountStorage } from "../auth/account-storage";
import { wishlistRepository } from "../discovery/device";
import { loadWishlist } from "../discovery/wishlist-repository";
import { DrinkArt } from "../discovery/DrinkArt";
import { BartenderOtter } from "./BartenderOtter";
import {
  chatError,
  clearConversation,
  loadConversation,
  sendChat,
} from "./repository";
import {
  emptyConversation,
  showDrinkRefinements,
  parseChatRequest,
  type ChatCard,
  type ChatRequest,
  type ChatState,
} from "../../../supabase/functions/_shared/bartender-domain";
const labels = {
  whisky: "위스키",
  wine: "와인",
  beer: "맥주",
  traditional: "전통주",
};
const starts = [
  { label: "오늘의 한 잔", message: "오늘 마실 술을 함께 골라줘" },
  { label: "내 기록에서 고르기", message: "내 기록과 비슷한 술을 골라줘" },
  { label: "새로운 술 만나기", message: "조금 새로운 술을 마시고 싶어" },
  { label: "음식과 함께", message: "음식에 어울리는 술을 찾고 있어" },
];
export function BartenderScreen({
  owner,
  tabMode = false,
}: {
  owner: string;
  tabMode?: boolean;
}) {
  const router = useRouter(),
    dialog = useConfirmDialog(),
    scroll = useRef<ScrollViewInstance>(null),
    alive = useRef(true),
    lock = useRef(false);
  const [state, setState] = useState<ChatState>({
      revision: 0,
      document: emptyConversation(),
    }),
    [input, setInput] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState<ChatRequest | null>(null),
    [saving, setSaving] = useState<string | null>(null),
    [saved, setSaved] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const key = `mogeum:bartender:v1:${owner}`;
  async function refresh() {
    const sdk = getSupabase();
    if (!sdk) return;
    setLoading(true);
    setError("");
    try {
      const [next, raw] = await Promise.all([
        loadConversation(sdk, owner),
        accountStorage.getItem(key),
      ]);
      if (!alive.current) return;
      setState(next);
      void loadWishlist(sdk, owner)
        .then((rows) => {
          if (alive.current)
            setSaved(rows.filter((r) => r.saved).map((r) => r.productId));
        })
        .catch(() => {});
      if (raw) {
        const request = parseChatRequest(JSON.parse(raw));
        if (request.revision === next.revision) setPending(request);
        else {
          await accountStorage.removeItem(key);
          if (alive.current) setPending(null);
        }
      }
    } catch {
      if (alive.current)
        setError("대화를 불러오지 못했어요. 다시 불러와 주세요.");
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    queueMicrotask(() => {
      if (alive.current) void refresh();
    });
    return () => {
      alive.current = false;
    }; /* owner is the screen identity. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner]);
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      scroll.current?.scrollToEnd({
        animated: state.document.messages.length > 0,
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [state.document.messages.length, busy, pending?.operationId]);
  async function send(
    text: string,
    action: "say" | "research" = "say",
    retry?: ChatRequest,
  ) {
    if (lock.current || loading || (!retry && pending)) return;
    const sdk = getSupabase();
    if (!sdk) return;
    const request = retry ?? {
      operationId: randomUUID(),
      revision: state.revision,
      action,
      text: text.trim(),
    };
    if (action === "say" && !request.text) return;
    lock.current = true;
    setBusy(true);
    setError("");
    Keyboard.dismiss();
    try {
      await accountStorage.setItem(key, JSON.stringify(request));
      if (!alive.current) return;
      setPending(request);
      const next = await sendChat(sdk, owner, request);
      await accountStorage.removeItem(key);
      if (!alive.current) return;
      setState(next);
      setPending(null);
      setInput("");
    } catch (e) {
      if (!alive.current) return;
      const code = e instanceof Error ? e.message : "";
      setError(chatError(code));
      if (
        [
          "STALE_CONVERSATION",
          "PREVIOUS_FAILED",
          "DAILY_LIMIT",
          "SERVICE_LIMIT",
          "REQUEST_CONFLICT",
          "NOT_CONFIGURED",
        ].includes(code)
      ) {
        await accountStorage.removeItem(key);
        if (!alive.current) return;
        setPending(null);
        if (request.action === "say") setInput(request.text);
        if (code === "STALE_CONVERSATION") {
          try {
            const next = await loadConversation(sdk, owner);
            if (alive.current) setState(next);
          } catch {
            /* Preserve safe error and input. */
          }
        }
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function save(card: ChatCard) {
    const sdk = getSupabase();
    if (!sdk || lock.current) return;
    lock.current = true;
    setSaving(card.product.id);
    setError("");
    try {
      const repo = wishlistRepository(sdk);
      await repo.resume(owner);
      const rows = await loadWishlist(sdk, owner),
        row = rows.find((r) => r.productId === card.product.id);
      if (!row?.saved)
        await repo.set(owner, card.product.id, true, row?.revision ?? 0);
      if (alive.current)
        setSaved((values) => [...new Set([...values, card.product.id])]);
    } catch {
      if (alive.current)
        setError("저장을 완료하지 못했어요. 다시 눌러 확인할 수 있어요.");
    } finally {
      lock.current = false;
      if (alive.current) setSaving(null);
    }
  }
  async function clear() {
    const sdk = getSupabase();
    if (!sdk || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await clearConversation(sdk, owner);
      await accountStorage.removeItem(key);
      const next = await loadConversation(sdk, owner);
      if (alive.current) {
        setState(next);
        setPending(null);
        setInput("");
        setError("");
      }
    } catch {
      if (alive.current)
        setError(
          "대화를 비우지 못했어요. 진행 중인 답변이 있으면 잠시 뒤 다시 시도해주세요.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const blocked = busy || loading || !!saving;
  const c = state.document.conditions;
  return (
    <SafeAreaView style={s.page} edges={tabMode ? ["top"] : ["top", "bottom"]}>
      <WebStatusSpace />
      <ScreenHeader
        title="AI 바텐더"
        onBack={tabMode ? undefined : () => router.back()}
        onClose={tabMode ? undefined : () => router.back()}
      />
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          contentContainerStyle={s.content}
        >
          {loading ? (
            <ActivityIndicator
              color={colors.primary}
              accessibilityLabel="대화 불러오는 중"
            />
          ) : null}
          {!state.document.messages.length && !loading ? (
            <>
              <Text style={s.heading}>
                오늘은 어떤 한 잔을{"\n"}찾고 있나요?
              </Text>
              <Text style={s.muted}>평소 취향에 오늘의 마음을 더해볼게요.</Text>
              <View style={s.intro}>
                <View style={s.flex}>
                  <Text style={s.eyebrow}>모금의 단골 바텐더</Text>
                  <Text style={s.title}>
                    고르는 건 가볍게,{"\n"}취향은 조금 더 가깝게.
                  </Text>
                </View>
                <BartenderOtter size={88} />
              </View>
              <Text style={s.muted}>어디서 시작할까요?</Text>
              <View style={s.choices}>
                {starts.map(({ label, message }) => (
                  <ChoiceChip
                    key={label}
                    label={label}
                    disabled={blocked || !!pending}
                    onPress={() => void send(message)}
                    style={s.choice}
                  />
                ))}
              </View>
              <Text style={s.caption}>
                내 기록의 감각과 오늘 말한 조건을 따로 참고해요.{"\n"}기록이
                없어도 오늘 원하는 느낌부터 시작할 수 있어요.
              </Text>
            </>
          ) : null}
          {state.document.recommendationsStale ? (
            <Text style={s.caption}>
              내 기록이 바뀌어 이전 추천 카드는 숨겼어요. 최신 기록으로 다시
              골라볼까요?
            </Text>
          ) : null}
          {state.document.messages.map((m, i) => (
            <View
              key={`${state.revision}-${i}`}
              style={m.role === "user" ? s.user : s.assistant}
            >
              {m.role === "assistant" ? (
                <View style={s.speaker}>
                  <BartenderOtter size={30} />
                  <Text style={s.eyebrow}>모금 바텐더</Text>
                </View>
              ) : null}
              <Text selectable style={s.body}>
                {m.text}
              </Text>
              {m.cards?.slice(0, expanded[i] ? 3 : 1).map((card) => (
                <View key={card.product.id} style={s.card}>
                  <View style={s.product}>
                    <View style={s.flex}>
                      <Text style={s.caption}>
                        {labels[card.product.category]} · {card.product.edition}
                      </Text>
                      <Text style={s.title}>{card.product.name}</Text>
                    </View>
                    <DrinkArt category={card.product.category} size={64} />
                  </View>
                  <Text style={s.eyebrow}>
                    {card.basis === "research"
                      ? "검색으로 찾은 제품 후보"
                      : card.basis === "records"
                        ? "내 기록에서 이어진 한 잔"
                        : "오늘의 선택으로 고른 후보"}
                  </Text>
                  {card.evidence.length ? (
                    <View>
                      <Text style={s.body}>
                        좋게 남긴 기록과 겹치는 느낌 ·{" "}
                        {card.evidence
                          .slice(0, 3)
                          .map((f) => f.label)
                          .join(" · ")}
                      </Text>
                      <Button
                        label="비교한 내 기록 보기 ›"
                        variant="text"
                        onPress={() =>
                          router.push({
                            pathname: "/detail",
                            params: { recordId: card.evidence[0].recordIds[0] },
                          })
                        }
                      />
                    </View>
                  ) : null}
                  {card.matched.length ? (
                    <Text style={s.body}>
                      오늘 원하는 느낌 · {card.matched.join(" · ")}
                    </Text>
                  ) : null}
                  {card.basis === "today" ? (
                    <Text style={s.caption}>
                      제품 설명을 참고한 후보예요. 내 기록으로 확인한 취향은
                      아니에요.
                    </Text>
                  ) : null}
                  {card.unknown.length ? (
                    <Text style={s.caption}>
                      아직 내 취향과 비교하지 못한 특징 ·{" "}
                      {card.unknown.slice(0, 3).join(" · ")}
                    </Text>
                  ) : null}
                  <Text style={s.caption}>
                    제품의 특징은 실제로 마셨을 때 다르게 느껴질 수 있어요.
                  </Text>
                  <Button
                    label={`제품 정보 출처 · ${card.product.source.title} ↗`}
                    variant="text"
                    onPress={() =>
                      void Linking.openURL(card.product.source.url).catch(() =>
                        setError("출처 페이지를 열지 못했어요."),
                      )
                    }
                  />
                  {card.basis === "research" ? (
                    <Text style={s.caption}>
                      연산·빈티지가 같은지 확인해 주세요. 이 검색 후보는 공통
                      카탈로그에 자동 등록되지 않아요.
                    </Text>
                  ) : (
                    <Button
                      label={
                        saved.includes(card.product.id)
                          ? "마셔보고 싶은 술에 저장됨"
                          : "마셔보고 싶은 술에 저장"
                      }
                      variant="secondary"
                      disabled={blocked || saved.includes(card.product.id)}
                      loading={saving === card.product.id}
                      onPress={() => void save(card)}
                    />
                  )}
                </View>
              ))}
              {(m.cards?.length ?? 0) > 1 ? (
                <Button
                  label={expanded[i] ? "다른 후보 접기" : "다른 후보도 보기"}
                  variant="text"
                  onPress={() =>
                    setExpanded((value) => ({ ...value, [i]: !value[i] }))
                  }
                />
              ) : null}
            </View>
          ))}
          {pending ? (
            <View style={s.user}>
              <Text style={s.body}>
                {pending.action === "research"
                  ? "제품 정보 찾아보기"
                  : pending.text}
              </Text>
            </View>
          ) : null}
          {busy ? (
            <View style={s.speaker}>
              <ActivityIndicator color={colors.primary} />
              <Text accessibilityLiveRegion="polite" style={s.muted}>
                {pending?.action === "research"
                  ? "출처를 확인하고 있어요. 잠시 걸릴 수 있어요."
                  : "이야기를 듣고 있어요."}
              </Text>
            </View>
          ) : null}
          {c.budget !== null || c.food ? (
            <Text style={s.caption}>
              예산·음식은 오늘의 조건으로만 보관해요. 현재 제품 가격·재고나 음식
              궁합을 확인한 추천은 아니에요.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}
          {!busy && pending ? (
            <Button
              label="같은 요청 다시 확인하기"
              variant="secondary"
              onPress={() => void send("", pending.action, pending)}
            />
          ) : null}
          {!loading && error && !state.document.messages.length && !pending ? (
            <Button
              label="대화 다시 불러오기"
              variant="text"
              onPress={() => void refresh()}
            />
          ) : null}
          {!blocked && !pending && state.document.research ? (
            <Button
              label={`${state.document.research.name} 정보 찾아보기`}
              variant="secondary"
              onPress={() => void send("", "research")}
            />
          ) : null}
          {showDrinkRefinements(state.document) && !blocked && !pending ? (
            <View style={s.choices}>
              {[
                "다른 술로 골라줘",
                "조금 더 가벼운 걸로",
                "오늘은 다른 주종",
              ].map((label) => (
                <ChoiceChip
                  key={label}
                  label={label}
                  outlined
                  onPress={() => void send(label)}
                />
              ))}
            </View>
          ) : null}
          {!!state.document.messages.length ? (
            <Button
              label="대화 비우기"
              variant="text"
              disabled={blocked}
              onPress={() =>
                dialog.show(
                  "새롭게 이야기할까요?",
                  "대화와 오늘의 조건을 지워요. 술 기록과 저장한 술은 유지돼요.",
                  [
                    { text: "취소", style: "cancel" },
                    {
                      text: "대화 비우기",
                      style: "destructive",
                      onPress: () => void clear(),
                    },
                  ],
                )
              }
            />
          ) : null}
        </ScrollView>
        <View style={s.composer}>
          <TextInput
            accessibilityLabel="바텐더에게 이야기하기"
            placeholder="오늘 있었던 일도 편하게 이야기해요"
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            editable={!blocked && !pending}
            maxLength={800}
            multiline
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={s.input}
          />
          <Button
            label="보내기"
            disabled={blocked || !!pending || !input.trim()}
            onPress={() => void send(input)}
            style={s.send}
          />
        </View>
        <Text style={s.footer}>
          AI 답변은 틀릴 수 있어요. 대화는 저장되며 언제든 비울 수 있어요.
        </Text>
      </KeyboardAvoidingView>
      {dialog.modal}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
  heading: { ...typography.heading, color: colors.text },
  title: { ...typography.title, color: colors.text },
  body: { ...typography.body, color: colors.text },
  muted: { ...typography.body, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  eyebrow: {
    ...typography.caption,
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  intro: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  choice: { flexGrow: 1, flexBasis: "45%" },
  user: {
    alignSelf: "flex-end",
    maxWidth: "92%",
    padding: space.lg,
    backgroundColor: colors.selected,
    borderRadius: radius.md,
    gap: space.sm,
  },
  assistant: { gap: space.md },
  speaker: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    flexShrink: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  product: { flexDirection: "row", alignItems: "center", gap: space.sm },
  error: { ...typography.body, color: colors.primary },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 52,
    maxHeight: 120,
    paddingHorizontal: space.md,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: "top",
    includeFontPadding: false,
  },
  send: { paddingHorizontal: space.md },
  footer: {
    ...typography.caption,
    color: colors.muted,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
  },
});
