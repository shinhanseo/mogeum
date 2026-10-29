import type { DiscoveryGeneration } from "./contract";

/** Dates come from the committed server receipt, never a locally invented cooldown. */
export function generationCopy(generation?: DiscoveryGeneration): {title: string; body: string} | null {
  if (!generation) return null;
  const next = generation.nextGenerationAt
    ? new Intl.DateTimeFormat("ko-KR", {month: "long", day: "numeric", hour: "numeric", minute: "2-digit"}).format(new Date(generation.nextGenerationAt))
    : null;
  switch (generation.state) {
    case "generated":
    case "cached":
      return {title: "이번 주의 다음 한 잔", body: `내 기록과 제품 정보를 비교해 Gemini가 골랐어요.${next ? ` 다음 추천은 ${next}부터 살펴볼 수 있어요.` : ""}`};
    case "invalidated":
      return {title: "이번 주 추천을 잠시 숨겼어요", body: `기록이나 추천 기준이 바뀌어 이전 결과를 그대로 보여드리지 않아요.${next ? ` ${next}부터 새로 골라드려요.` : ""}`};
    case "running":
      return {title: "다음 한 잔을 고르고 있어요", body: "이미 시작한 추천을 준비하고 있어요. 잠시 후 다시 확인해주세요."};
    case "backoff":
      return {title: "잠깐 쉬었다 다시 찾아볼게요", body: "추천을 마치지 못했어요. 잠시 후 다시 확인해주세요. 이번 주 추천은 아직 사용하지 않았어요."};
    case "daily-limit":
      return {title: "오늘은 추천을 잠시 쉬어요", body: "추천을 여러 번 시도했어요. 내일 다시 확인해주세요. 기록은 계속 남길 수 있어요."};
    case "insufficient":
      return null;
  }
}
