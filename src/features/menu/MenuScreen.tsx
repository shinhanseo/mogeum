import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Polygon, SvgXml } from "react-native-svg";
import { Button } from "../../components/Button";
import { ChoiceChip } from "../../components/ChoiceChip";
import { ScreenHeader } from "../../components/ScreenHeader";
import { Mogu } from "../../components/Mogu";
import { Icon } from "../../components/Icon";
import { colors, fonts, typography } from "../../theme/tokens";
import {
  productCandidate,
  products,
  type MenuItem,
  type MenuRecommendation,
} from "../../../supabase/functions/_shared/menu-domain";
import type { MenuDraft, DevicePhoto } from "./device";
import { drinkArt } from "./drink-art";
import type { MenuResult } from "./repository";
export type MenuStep =
  | "start"
  | "photos"
  | "review"
  | "results"
  | "reason"
  | "evidence"
  | "original";
type Props = {
  draft: MenuDraft;
  step: MenuStep;
  result: MenuResult | null;
  busy: boolean;
  error: string;
  onStep: (s: MenuStep) => void;
  onAdd: (camera: boolean, replaceId?: string) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onCancel: () => void;
  onParse: () => void;
  onRecommend: () => void;
  onEdit: (item: MenuItem) => void;
  onDeleteItem: (id: string) => void;
  onManual: (photo: DevicePhoto) => MenuItem | null;
  onClose: () => void;
  onEvidence: (id: string) => void;
};
export function MenuScreen(p: Props) {
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [editError, setEditError] = useState("");
  const [originalReturn, setOriginalReturn] = useState<MenuStep>("review");
  const selectedItem = p.draft.items.find((i) => i.id === selected);
  const selectedRec = p.result?.recommendations.find(
    (r) => r.itemId === selected,
  );
  const selectedPhoto = p.draft.photos.find(
    (f) => f.id === selectedItem?.photoId,
  );
  const ready = p.draft.photos.filter((f) => f.state === "ready");
  const closeEditor = () => {
    setEditing(null);
    setEditError("");
  };
  const openReason = (r: MenuRecommendation) => {
    setSelected(r.itemId);
    p.onStep("reason");
  };
  const showOriginal = (item: MenuItem) => {
    setSelected(item.id);
    setOriginalReturn("review");
    p.onStep("original");
  };
  const back = () =>
    p.step === "start"
      ? p.onClose()
      : p.onStep(
          p.step === "reason"
            ? "results"
            : p.step === "evidence"
              ? "reason"
              : p.step === "original"
                ? originalReturn
                : p.step === "results"
                  ? "review"
                  : p.step === "review"
                    ? "photos"
                    : "start",
        );
  return (
    <SafeAreaView style={s.root} edges={["top", "bottom", "left", "right"]}>
      <ScreenHeader
        title={
          p.step === "start"
            ? "메뉴판에서 취향 찾기"
            : p.step === "photos"
              ? "메뉴판 사진 모으기"
              : p.step === "review"
                ? "읽은 메뉴 확인"
                : p.step === "results"
                  ? "나를 위한 메뉴"
                  : p.step === "original"
                    ? "메뉴판 원본"
                    : p.step === "evidence"
                      ? "비교에 쓰인 내 기록"
                      : "어떤 점이 닮았나요?"
        }
        onBack={back}
        onClose={p.onClose}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {p.step === "start" ? (
          <>
            <Text style={s.title}>
              오늘의 메뉴에서,{"\n"}내가 좋아할 한 잔.
            </Text>
            <Text style={s.body}>
              메뉴판 사진을 최대 5장까지 함께 올려요.{"\n"}모든 메뉴에서 내
              취향에 맞는 술을 찾아볼게요.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="메뉴판 사진 선택"
              style={s.upload}
              onPress={() => p.onAdd(false)}
            >
              <Icon name="photo" />
              <Text style={s.primary}>메뉴판을 보여주세요</Text>
              <Text style={s.caption}>
                이름과 가격이 잘 보이게 · 한 번에 최대 5장
              </Text>
            </Pressable>
            <Button label="메뉴판 촬영하기" onPress={() => p.onAdd(true)} />
            <Button
              label="앨범에서 여러 장 고르기"
              variant="secondary"
              onPress={() => p.onAdd(false)}
            />
            {p.draft.photos.length > 0 && (
              <Button
                label={`이어서 확인하기 · ${p.draft.photos.length}장`}
                variant="text"
                onPress={() => p.onStep("photos")}
              />
            )}
            <View style={s.moguRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.primary}>모구가 내 기록과 비교해 볼게요</Text>
                <Text style={s.caption}>
                  술 이름이 흐리면 다시 찍거나{"\n"}직접 수정할 수 있어요.
                </Text>
              </View>
              <View style={s.mogu}>
                <View style={s.moguScale}>
                  <Mogu />
                </View>
              </View>
            </View>
          </>
        ) : p.step === "photos" ? (
          <>
            <Text style={s.title}>여러 장이어도,{"\n"}한 번에 골라볼게요.</Text>
            <Text style={s.primary}>
              사진 {p.draft.photos.length} / 5장 · {ready.length}장 읽었어요
            </Text>
            <View style={s.grid}>
              {p.draft.photos.map((photo, n) => (
                <View style={s.photoCard} key={photo.id}>
                  <View>
                    <Image
                      source={{ uri: photo.uri }}
                      resizeMode="contain"
                      style={s.thumbnail}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${n + 1}번 메뉴판 삭제`}
                      hitSlop={6}
                      onPress={() => p.onRemove(photo.id)}
                      style={s.delete}
                    >
                      <Text style={s.primary}>×</Text>
                    </Pressable>
                  </View>
                  <Text style={s.label}>{n + 1}번 메뉴판</Text>
                  <Text style={s.caption}>
                    {photo.state === "reading"
                      ? "읽는 중…"
                      : photo.state === "waiting"
                        ? "읽기 대기"
                        : photo.state === "failed"
                          ? "다시 확인해주세요"
                          : `${photo.ocr?.lines.length ?? 0}줄 읽음`}
                  </Text>
                  {(photo.state === "failed" || photo.state === "waiting") && (
                    <Button
                      label="다시 읽기"
                      variant="text"
                      onPress={() => p.onRetry(photo.id)}
                    />
                  )}
                  <Button
                    label="다시 찍기"
                    variant="text"
                    onPress={() => p.onAdd(true, photo.id)}
                  />
                  {photo.state === "failed" && (
                    <Button
                      label="직접 입력"
                      variant="text"
                      onPress={() => {
                        const item = p.onManual(photo);
                        if (item) setEditing(item);
                      }}
                    />
                  )}
                </View>
              ))}
            </View>
            <View style={s.notice}>
              <Text style={s.primary}>흐릿한 사진만 다시 찍으면 돼요</Text>
              <Text style={s.caption}>
                나머지 사진과 읽은 메뉴는 그대로 유지해요.
              </Text>
            </View>
            {p.busy ? (
              <Button label="읽기 중단" variant="text" onPress={p.onCancel} />
            ) : (
              <Button
                label={`+ 사진 추가하기 · ${p.draft.photos.length} / 5장`}
                variant="secondary"
                disabled={p.draft.photos.length >= 5}
                onPress={() => p.onAdd(false)}
              />
            )}
            <Button
              label={`${ready.length}장의 메뉴 함께 확인하기`}
              disabled={!ready.length || p.busy}
              onPress={p.onParse}
            />
            <Text style={s.caption}>
              용량·가격이 다른 메뉴는 따로 남겨요. 인식 결과를 확인해 주세요.
            </Text>
          </>
        ) : p.step === "review" ? (
          <>
            <Text style={s.title}>읽은 메뉴를{"\n"}한 목록으로 모았어요.</Text>
            <Text style={s.primary}>
              사진 {p.draft.photos.length}장 · 메뉴 {p.draft.items.length}개
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filters}
            >
              <ChoiceChip
                compact
                label={`전체 ${p.draft.items.length}`}
                selected={filter === "all"}
                onPress={() => setFilter("all")}
              />
              {p.draft.photos.map((photo, n) => (
                <ChoiceChip
                  compact
                  key={photo.id}
                  label={`${n + 1}번`}
                  selected={filter === photo.id}
                  onPress={() => setFilter(photo.id)}
                />
              ))}
            </ScrollView>
            {p.draft.items
              .filter((i) => filter === "all" || i.photoId === filter)
              .map((item) => (
                <View style={s.menuCard} key={item.id}>
                  <View style={s.menuRow}>
                    <Pressable
                      style={s.rowName}
                      onPress={() => showOriginal(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name} 원본 위치 보기`}
                    >
                      <Text style={s.label}>{item.name}</Text>
                      <Text style={s.caption}>
                        {item.serving || "용량 미확인"} ·{" "}
                        {p.draft.photos.findIndex(
                          (f) => f.id === item.photoId,
                        ) + 1}
                        번 · {item.confirmed ? "확인함" : "확인 필요"}
                      </Text>
                    </Pressable>
                    <Text style={s.body}>
                      {item.price
                        ? `${item.price.toLocaleString()}원`
                        : "가격 미확인"}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      disabled={p.busy}
                      onPress={() => setEditing({ ...item })}
                    >
                      <Text style={s.primary}>수정</Text>
                    </Pressable>
                  </View>
                  {productCandidate(item.name) && (
                    <ChoiceChip
                      compact
                      label={`제품 확인 · ${productCandidate(item.name)!.name}`}
                      selected={
                        item.productId === productCandidate(item.name)!.id
                      }
                      disabled={p.busy}
                      onPress={() =>
                        p.onEdit({
                          ...item,
                          productId: item.productId
                            ? null
                            : productCandidate(item.name)!.id,
                        })
                      }
                    />
                  )}
                </View>
              ))}
            {!p.draft.items.length && (
              <Text style={s.body}>
                이름과 가격이 같은 줄에 있는 메뉴를 찾지 못했어요. 원본을 보고
                직접 추가해 주세요.
              </Text>
            )}
            {p.draft.photos
              .filter((f) => f.ocr)
              .map((photo, n) => (
                <Button
                  key={photo.id}
                  variant="text"
                  label={`${n + 1}번 원본에서 메뉴 직접 추가 ›`}
                  disabled={p.busy}
                  onPress={() => {
                    const item = p.onManual(photo);
                    if (item) setEditing(item);
                  }}
                />
              ))}
            <Button
              label={`${p.draft.items.length}개 메뉴에서 추천받기`}
              disabled={
                !p.draft.items.length ||
                p.draft.items.some((i) => !i.name.trim())
              }
              loading={p.busy}
              onPress={p.onRecommend}
            />
            <Text style={s.caption}>
              이름·가격·용량을 확인한 뒤 추천받기를 눌러주세요. 제품 후보는
              정확히 맞을 때만 선택해요. 모르면 미확인으로 남겨도 돼요.
            </Text>
          </>
        ) : p.step === "results" ? (
          <>
            <View style={s.moguRow}>
              <Text style={[s.title, { flex: 1 }]}>
                취향은 그대로,{"\n"}새로운 한 잔.
              </Text>
              <View style={s.mogu}>
                <View style={s.moguScale}>
                  <Mogu />
                </View>
              </View>
            </View>
            <Text style={s.caption}>
              메뉴판 {p.draft.photos.length}장 · 내 기록{" "}
              {p.result?.recordCount ?? 0}개로 고른 술
            </Text>
            {p.result?.recommendations.map((r) => {
              const item = p.draft.items.find((i) => i.id === r.itemId)!;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={r.itemId}
                  onPress={() => openReason(r)}
                  style={[s.recommend, r.status === "similar" && s.highlight]}
                >
                  <Text style={s.primary}>
                    {r.status === "similar"
                      ? "좋게 남긴 기록과 닮았어요"
                      : r.status === "known"
                        ? "같은 이름으로 좋게 남겼어요"
                        : r.status === "unverified"
                          ? "제품 정보 확인이 필요해요"
                          : "비교할 취향 근거가 아직 부족해요"}
                  </Text>
                  <View style={s.productRow}>
                    {r.productId && (
                      <SvgXml
                        xml={
                          drinkArt[
                            products.find((p) => p.id === r.productId)!.category
                          ]
                        }
                        width={64}
                        height={72}
                      />
                    )}
                    <Text style={[s.productName, { flex: 1 }]}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={s.caption}>
                    {item.serving || "용량 미확인"} ·{" "}
                    {item.price
                      ? `${item.price.toLocaleString()}원`
                      : "가격 미확인"}
                  </Text>
                  <Text style={s.body}>
                    {r.similar.length
                      ? `${r.similar.map((f) => f.label).join(" · ")}이 기록과 이어져요.`
                      : "확인되지 않은 맛은 추측하지 않았어요."}
                  </Text>
                  <Text style={s.primary}>내 기록과 어떤 점이 닮았나요? ›</Text>
                </Pressable>
              );
            })}
            <Text style={s.caption}>
              공식 제품 정보가 있는 일부 술만 비교해요. 취향 일치율은 매기지
              않아요.
            </Text>
            <Button
              label="메뉴판 추가하고 다시 추천받기"
              variant="text"
              onPress={() => p.onStep("photos")}
            />
          </>
        ) : p.step === "reason" && selectedItem && selectedRec ? (
          <>
            <Text style={s.title}>좋아했던 느낌을,{"\n"}새로운 술에서도.</Text>
            <View style={s.menuRow}>
              {selectedRec.productId && (
                <SvgXml
                  xml={
                    drinkArt[
                      products.find((v) => v.id === selectedRec.productId)!
                        .category
                    ]
                  }
                  width={64}
                  height={72}
                />
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{selectedItem.name}</Text>
                <Text style={s.caption}>
                  {selectedItem.serving || "용량 미확인"} ·{" "}
                  {selectedItem.price
                    ? `${selectedItem.price.toLocaleString()}원`
                    : "가격 미확인"}
                </Text>
              </View>
            </View>
            {selectedRec.similar.map((f) => (
              <View key={f.factId} style={s.section}>
                <Text style={s.sectionTitle}>닮은 점 · {f.label}</Text>
                <Text style={s.body}>
                  좋게 남긴 {f.recordIds.length}개 기록에도 이 느낌이 있었어요.
                </Text>
                {!!f.negativeIds.length && (
                  <Text style={s.caption}>
                    아쉬웠던 {f.negativeIds.length}개 기록에서도 느낀
                    특징이에요.
                  </Text>
                )}
                <View style={s.compareRow}>
                  <Text style={[s.primary, { flex: 1 }]}>내 기록</Text>
                  <Text style={[s.primary, { flex: 1 }]}>제품 설명</Text>
                </View>
                <View style={s.compareRow}>
                  <Text style={[s.body, { flex: 1 }]}>
                    {f.label}을 느꼈어요
                  </Text>
                  <Text style={[s.body, { flex: 1 }]}>{f.label}</Text>
                </View>
              </View>
            ))}
            {!!selectedRec.knownRecordIds.length && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>익숙한 이름</Text>
                <Text style={s.body}>
                  같은 이름으로 좋게 남긴 기록이 있어요. 정확히 같은 제품인지는
                  확인해 주세요.
                </Text>
                {selectedRec.knownRecordIds.map((id, n) => (
                  <Button
                    key={id}
                    label={`이전 기록 ${n + 1} 보기 ›`}
                    variant="text"
                    onPress={() => p.onEvidence(id)}
                  />
                ))}
              </View>
            )}
            <View style={s.section}>
              <Text style={s.sectionTitle}>새롭게 살펴볼 점</Text>
              {selectedRec.other.map((f) => (
                <Text key={f.label} style={s.primary}>
                  {f.dimension} · {f.label}
                </Text>
              ))}
              <Text style={s.body}>
                {products.find((v) => v.id === selectedRec.productId)
                  ?.description ?? "아직 출처가 확인된 제품 설명이 없어요."}
              </Text>
              <Text style={s.caption}>
                내 기록에 없는 특징을 ‘싫어하는 맛’으로 판단하지 않아요. 실제로
                다르게 느껴질 수 있어요.
              </Text>
            </View>
            <View style={s.section}>
              <Text style={s.sectionTitle}>아직 모르는 점</Text>
              <Text style={s.body}>
                보관·서빙 방식과 개인의 감각에 따라 달라져요. 제품의 모든 맛을
                확인한 것은 아니에요.
              </Text>
            </View>
            {selectedRec.productId && (
              <ProductSource productId={selectedRec.productId} />
            )}
            <Button
              label="비교에 쓰인 내 기록 보기"
              disabled={
                !selectedRec.similar.length &&
                !selectedRec.knownRecordIds.length
              }
              onPress={() => p.onStep("evidence")}
            />
            <Button
              label="메뉴판에서 위치 보기 ›"
              variant="secondary"
              onPress={() => {
                setOriginalReturn("reason");
                p.onStep("original");
              }}
            />
          </>
        ) : p.step === "evidence" && selectedRec ? (
          <>
            <Text style={s.title}>이 기록에서{"\n"}함께 느꼈어요.</Text>
            {[
              ...new Set([
                ...selectedRec.similar.flatMap((f) => f.recordIds),
                ...selectedRec.knownRecordIds,
              ]),
            ].map((id, n) => (
              <View key={id} style={s.menuRow}>
                <Text style={[s.label, { flex: 1 }]}>
                  {p.result?.evidenceRecords.find((r) => r.id === id)?.name ||
                    `기록 ${n + 1}`}
                  {"\n"}
                  {p.result?.evidenceRecords.find((r) => r.id === id)?.date}
                </Text>
                <Button
                  label="기록 보기 ›"
                  variant="text"
                  onPress={() => p.onEvidence(id)}
                />
              </View>
            ))}
            <Text style={s.caption}>
              해당 기록에서 선택한 느낌과 평가를 직접 확인해 주세요.
            </Text>
          </>
        ) : p.step === "original" && selectedPhoto ? (
          <>
            <Text style={s.title}>{selectedItem?.name}</Text>
            <View
              style={{
                width: "100%",
                aspectRatio: selectedPhoto.width / selectedPhoto.height,
              }}
            >
              <Image
                source={{ uri: selectedPhoto.uri }}
                style={s.original}
                resizeMode="contain"
              />
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                style={s.original}
              >
                {selectedPhoto.ocr?.lines
                  .filter((l) => selectedItem?.lineIds.includes(l.id))
                  .map((l) => (
                    <Polygon
                      key={l.id}
                      points={l.polygon.map((v) => `${v.x},${v.y}`).join(" ")}
                      fill="#783F4B22"
                      stroke={colors.primary}
                      strokeWidth={0.004}
                    />
                  ))}
              </Svg>
            </View>
            <Text style={s.caption}>
              {selectedItem?.lineIds.length
                ? "메뉴 이름과 가격을 원본에서 확인해 주세요."
                : "직접 추가한 메뉴예요. 원본 위치가 지정되지 않았어요."}
            </Text>
          </>
        ) : null}
        {p.busy && (
          <View style={s.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.caption}>메뉴를 살펴보고 있어요.</Text>
          </View>
        )}
        {!!p.error && (
          <Text style={s.error} accessibilityRole="alert">
            {p.error}
          </Text>
        )}
      </ScrollView>
      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <View style={s.overlay}>
          <Pressable
            style={s.scrim}
            accessibilityRole="button"
            accessibilityLabel="메뉴 수정 닫기"
            onPress={closeEditor}
          />
          <SafeAreaView edges={["bottom"]} style={s.sheet}>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.editor}
            >
              <Text style={s.sectionTitle}>읽은 메뉴 확인</Text>
              {editing && (
                <>
                  {p.draft.photos.find((p) => p.id === editing.photoId) && (
                    <Image
                      source={{
                        uri: p.draft.photos.find(
                          (p) => p.id === editing.photoId,
                        )!.uri,
                      }}
                      resizeMode="contain"
                      style={{
                        height: 120,
                        width: "100%",
                        backgroundColor: colors.background,
                        borderRadius: 12,
                      }}
                    />
                  )}
                  <Text style={s.label}>술 이름</Text>
                  <TextInput
                    accessibilityLabel="메뉴 술 이름"
                    value={editing.name}
                    onChangeText={(name) =>
                      setEditing({
                        ...editing,
                        name,
                        productId: null,
                        confirmed: false,
                      })
                    }
                    style={s.input}
                    maxLength={150}
                  />
                  <Text style={s.label}>가격 · 원 / 모르면 비워두기</Text>
                  <TextInput
                    accessibilityLabel="메뉴 가격"
                    value={editing.price?.toString() ?? ""}
                    keyboardType="number-pad"
                    onChangeText={(v) =>
                      setEditing({
                        ...editing,
                        price: v ? Number(v.replace(/[^0-9]/g, "")) : null,
                      })
                    }
                    style={s.input}
                    maxLength={9}
                  />
                  <Text style={s.label}>용량 · 잔 / 보틀</Text>
                  <TextInput
                    accessibilityLabel="메뉴 용량"
                    value={editing.serving ?? ""}
                    onChangeText={(serving) =>
                      setEditing({ ...editing, serving: serving || null })
                    }
                    style={s.input}
                    maxLength={60}
                  />
                  <Text style={s.label}>제품 확인</Text>
                  {productCandidate(editing.name) && (
                    <ChoiceChip
                      label={`이 제품이 맞아요 · ${productCandidate(editing.name)!.name}`}
                      selected={
                        editing.productId === productCandidate(editing.name)!.id
                      }
                      onPress={() =>
                        setEditing({
                          ...editing,
                          productId: productCandidate(editing.name)!.id,
                        })
                      }
                    />
                  )}
                  <ChoiceChip
                    label="제품 정보는 아직 모르겠어요"
                    selected={editing.productId === null}
                    onPress={() => setEditing({ ...editing, productId: null })}
                  />
                  {!!editError && <Text style={s.error}>{editError}</Text>}
                  <Button
                    label="확인 완료"
                    onPress={() => {
                      if (
                        !editing.name.trim() ||
                        (editing.price !== null &&
                          (!Number.isSafeInteger(editing.price) ||
                            editing.price < 1 ||
                            editing.price > 100000000))
                      ) {
                        setEditError("술 이름과 가격을 다시 확인해주세요.");
                        return;
                      }
                      p.onEdit({
                        ...editing,
                        name: editing.name.trim(),
                        confirmed: true,
                      });
                      closeEditor();
                    }}
                  />
                  <Button
                    label="이 메뉴 제외하기"
                    variant="text"
                    onPress={() => {
                      p.onDeleteItem(editing.id);
                      closeEditor();
                    }}
                  />
                  <Button label="취소" variant="text" onPress={closeEditor} />
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
function ProductSource({ productId }: { productId: string }) {
  const [error, setError] = useState(false);
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  return (
    <View style={s.section}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="제조사 제품 정보 열기"
        onPress={() => {
          void Linking.openURL(product.source.url).catch(() => setError(true));
        }}
      >
        <Text style={s.primary}>제품 정보 출처 ↗</Text>
      </Pressable>
      {error && (
        <Text style={s.caption}>
          링크를 열지 못했어요. 아래 주소를 복사해주세요.
        </Text>
      )}
      <Text selectable style={s.caption}>
        {product.source.title}
        {"\n"}
        {product.source.url}
        {"\n"}확인일 {product.source.checkedAt}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, gap: 16, paddingTop: 20, paddingBottom: 32 },
  title: { ...typography.question, color: colors.text, marginBottom: 4 },
  body: { ...typography.body, color: colors.muted },
  caption: { ...typography.caption, color: colors.muted },
  primary: {
    ...typography.caption,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  label: { ...typography.fieldLabel, color: colors.text },
  upload: {
    height: 224,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  moguRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  mogu: { width: 64, height: 64, overflow: "hidden" },
  moguScale: {
    position: "absolute",
    width: 170,
    height: 153,
    left: -53,
    top: -44,
    transform: [{ scale: 0.38 }],
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  photoCard: { width: "30%", gap: 4 },
  thumbnail: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  delete: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.selected,
    gap: 4,
  },
  filters: { gap: 8, paddingVertical: 4 },
  menuCard: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingBottom: 8,
    gap: 4,
  },
  menuRow: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowName: { flex: 1, gap: 4 },
  recommend: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.surface,
    gap: 12,
  },
  highlight: { backgroundColor: colors.selected },
  productRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  productName: { ...typography.title, color: colors.text },
  compareRow: {
    flexDirection: "row",
    gap: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.selected,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  sectionTitle: { ...typography.title, color: colors.text },
  original: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  loading: { flexDirection: "row", gap: 8, alignItems: "center" },
  error: { ...typography.body, color: colors.primary },
  overlay: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
  },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  editor: { padding: 24, gap: 12 },
  input: {
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    minHeight: 48,
  },
});
