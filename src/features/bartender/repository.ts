import type { SupabaseClient } from "@supabase/supabase-js";
import { menuClient } from "../menu/repository";
import {
  parseChatState,
  currentConversation,
  type ChatRequest,
} from "../../../supabase/functions/_shared/bartender-domain";
export async function loadConversation(client: SupabaseClient, owner: string) {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped
    .rpc("bartender_context")
    .abortSignal(AbortSignal.timeout(20000));
  if (error) throw Error("CONVERSATION_LOAD_FAILED");
  const result = parseChatState(data);
  if (result.document.snapshotHash) {
    const context = await scoped
      .rpc("taste_summary_context")
      .abortSignal(AbortSignal.timeout(20000));
    if (context.error || !context.data?.snapshot?.hash)
      throw Error("CONVERSATION_LOAD_FAILED");
    result.document = currentConversation(
      result.document,
      context.data.snapshot.hash,
    );
  }
  return result;
}
export async function sendChat(
  client: SupabaseClient,
  owner: string,
  request: ChatRequest,
) {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped.functions.invoke("bartender", {
    body: request,
    timeout: 85000,
  });
  if (error) {
    let code = "BARTENDER_UNAVAILABLE";
    try {
      const response = (error as { context?: Response }).context;
      const body = response ? await response.json() : null;
      if (typeof body?.code === "string") code = body.code;
    } catch {
      /* No provider exception text in the UI. */
    }
    throw Error(code);
  }
  if (
    data?.version !== "bartender-v1" ||
    data?.state !== "ready" ||
    data.revision !== request.revision + 1
  )
    throw Error("INVALID_CHAT_RESPONSE");
  const result = parseChatState(data);
  if (result.document.snapshotHash) {
    const context = await scoped
      .rpc("taste_summary_context")
      .abortSignal(AbortSignal.timeout(20000));
    if (context.error || !context.data?.snapshot?.hash)
      throw Error("CONVERSATION_LOAD_FAILED");
    result.document = currentConversation(
      result.document,
      context.data.snapshot.hash,
    );
  }
  return result;
}
export function chatError(code: string) {
  const messages: Record<string, string> = {
    DAILY_LIMIT:
      "오늘 바텐더와 나눌 수 있는 대화를 모두 사용했어요. 내일 다시 이야기해요.",
    SERVICE_LIMIT: "오늘 준비한 상담이 모두 찼어요. 내일 다시 찾아주세요.",
    NOT_CONFIGURED: "바텐더를 준비 중이에요. 잠시 뒤 다시 찾아주세요.",
    STALE_CONVERSATION:
      "다른 곳에서 대화가 이어졌어요. 최신 대화를 다시 불러올게요.",
    RUNNING: "이전 답변을 준비 중이에요. 잠시 뒤 다시 확인해주세요.",
    PREVIOUS_FAILED:
      "이전 요청은 완료되지 않았어요. 다시 보내려면 새 요청으로 보내주세요.",
  };
  return (
    messages[code] ??
    "답변을 가져오지 못했어요. 입력은 남겨뒀으니 다시 시도해주세요."
  );
}

export async function clearConversation(client: SupabaseClient, owner: string) {
  const scoped = await menuClient(client, owner);
  const { data, error } = await scoped
    .rpc("clear_bartender_conversation")
    .abortSignal(AbortSignal.timeout(20000));
  if (error || data !== true) throw Error("CONVERSATION_CLEAR_FAILED");
}
