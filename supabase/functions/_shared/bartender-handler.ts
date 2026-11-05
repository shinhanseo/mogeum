import {
  BARTENDER_VERSION,
  currentConversation,
  candidateProducts,
  emptyConversation,
  makeCards,
  modelInput,
  nextConversation,
  parseChatRequest,
  parseModelAnswer,
  type Conversation,
} from "./bartender-domain.ts";
import type { TasteSnapshot } from "./taste-domain.ts";
import type { Product } from "./product-catalog.ts";
import type { DrinkHistory } from "./next-drinks-domain.ts";
import type { ResearchQuery } from "./product-research.ts";
import { readMenuBody, MenuBodyTooLargeError } from "./menu-body.ts";
export type BartenderPorts = {
  authenticate: (token: string) => Promise<{ id: string } | null>;
  configured: () => boolean;
  begin: (
    owner: string,
    operation: string,
    hash: string,
    revision: number,
  ) => Promise<{ state: string; document?: Conversation; result?: unknown }>;
  finish: (
    owner: string,
    operation: string,
    hash: string,
    document: Conversation | null,
    result: unknown,
    input: number,
    output: number,
  ) => Promise<boolean>;
  context: (token: string) => Promise<{
    snapshot: TasteSnapshot;
    catalog: Product[];
    history: DrinkHistory[];
    saved: Set<string>;
  }>;
  converse: (
    input: unknown,
    signal: AbortSignal,
  ) => Promise<{ output: unknown; inputTokens: number; outputTokens: number }>;
  research: (
    query: ResearchQuery,
  ) => Promise<{ product: Product | null; state: string }>;
};
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { ...cors, "Cache-Control": "no-store" },
  });
export function bartenderHandler(ports: BartenderPorts) {
  return async (request: Request) => {
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return reply({ code: "METHOD_NOT_ALLOWED" }, 405);
    const token = request.headers
      .get("Authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply({ code: "UNAUTHENTICATED" }, 401);
    let owner: string | undefined,
      operation: string | undefined,
      hash: string | undefined,
      acquired = false;
    try {
      const user = await ports.authenticate(token);
      if (!user) return reply({ code: "UNAUTHENTICATED" }, 401);
      owner = user.id;
      let body;
      try {
        body = JSON.parse(await readMenuBody(request, 4096));
      } catch (error) {
        return reply(
          {
            code:
              error instanceof MenuBodyTooLargeError
                ? "TOO_LARGE"
                : "INVALID_REQUEST",
          },
          400,
        );
      }
      let input;
      try {
        input = parseChatRequest(body);
      } catch {
        return reply({ code: "INVALID_REQUEST" }, 400);
      }
      if (!ports.configured()) return reply({ code: "NOT_CONFIGURED" }, 503);
      operation = input.operationId;
      hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(
              JSON.stringify({ version: BARTENDER_VERSION, ...input }),
            ),
          ),
        ),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
      const job = await ports.begin(owner, operation, hash, input.revision);
      if (job.state === "cached") return reply(job.result);
      if (job.state !== "acquired")
        return reply(
          {
            code:
              job.state === "stale"
                ? "STALE_CONVERSATION"
                : job.state === "daily-limit"
                  ? "DAILY_LIMIT"
                  : job.state === "global-limit"
                    ? "SERVICE_LIMIT"
                    : job.state === "running"
                      ? "RUNNING"
                      : job.state === "failed"
                        ? "PREVIOUS_FAILED"
                        : "REQUEST_CONFLICT",
          },
          409,
        );
      acquired = true;
      let previous = job.document?.messages
        ? job.document
        : emptyConversation();
      const ctx = await ports.context(token);
      previous = currentConversation(previous, ctx.snapshot.hash);
      let researchState: string | null = null;
      let document: Conversation,
        inputTokens = 0,
        outputTokens = 0;
      if (input.action === "research") {
        if (!previous.research) throw Error("NO_RESEARCH_PENDING");
        const lookup = await ports.research(previous.research);
        const product = lookup.product;
        researchState = lookup.state;
        const cards = product
          ? makeCards(
              [product.id],
              { ...previous.conditions, category: product.category },
              ctx.snapshot,
              [product],
              "research",
            )
          : [];
        const text = cards.length
          ? "제조사 원문에서 확인한 제품 후보예요. 이름과 연산·빈티지가 맞는지 먼저 확인해 주세요."
          : [
                "daily-limit",
                "monthly-limit",
                "provider-backoff",
                "backoff",
                "busy",
                "running",
              ].includes(lookup.state)
            ? "제품 조사가 잠시 쉬고 있어요. 검색 한도나 진행 중인 조사가 있어 나중에 다시 확인해 주세요."
            : "이번에는 비교할 만큼 확실한 제품 정보를 찾지 못했어요. 제품명이나 연산·빈티지를 더 알려줄래요?";
        document = nextConversation(
          previous,
          `${previous.research.name} 정보 찾아보기`,
          {
            conditions: previous.conditions,
            research:
              product ||
              ![
                "daily-limit",
                "monthly-limit",
                "provider-backoff",
                "backoff",
                "busy",
                "running",
              ].includes(lookup.state)
                ? null
                : previous.research,
            productIds: [],
            text,
          },
          cards,
        );
      } else {
        const candidates = candidateProducts(
          ctx.snapshot,
          ctx.history,
          ctx.saved,
          ctx.catalog,
          input.text,
        );
        const result = await ports.converse(
          modelInput(previous, input.text, ctx.snapshot, candidates),
          AbortSignal.timeout(28000),
        );
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        const answer = parseModelAnswer(result.output, candidates);
        const cards = makeCards(
          answer.productIds,
          answer.conditions,
          ctx.snapshot,
          candidates,
        );
        if (answer.productIds.length && !cards.length)
          answer.text =
            "말해준 조건과 확인된 제품 정보가 잘 맞지 않아요. 원하는 느낌을 조금 바꿔볼까요?";
        document = nextConversation(previous, input.text, answer, cards);
      }
      document.snapshotHash = ctx.snapshot.hash;
      const result = {
        version: BARTENDER_VERSION,
        state: "ready",
        researchState,
        revision: input.revision + 1,
        document,
      };
      if (
        !(await ports.finish(
          owner,
          operation,
          hash,
          document,
          result,
          inputTokens,
          outputTokens,
        ))
      )
        throw Error("LEASE_EXPIRED");
      return reply(result);
    } catch {
      if (acquired && owner && operation && hash)
        await ports
          .finish(owner, operation, hash, null, null, 0, 0)
          .catch(() => false);
      return reply({ code: "BARTENDER_UNAVAILABLE" }, 503);
    }
  };
}
