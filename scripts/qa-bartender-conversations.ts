/** Live conversational regression on a disposable development account. */
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { parseChatState } from "../supabase/functions/_shared/bartender-domain";
const scenarios = [
  {
    name: "맥주 조건과 안주",
    turns: [
      "시원한 맥주가 땡겨",
      "맥주 추천해줘",
      "흑맥주 도수 높은 걸로. 8퍼 이상이면 좋겠어",
      "그거랑 먹을 안주는?",
      "너가 추천하는 걸로 먹을게",
      "튀긴 건 싫어. 다른 안주",
      "고마워 이제 그냥 얘기하자. 오늘 친구 만났어",
    ],
  },
  {
    name: "잡담에서 추천으로",
    turns: [
      "안녕 너 이름 뭐야?",
      "오늘 회사에서 너무 피곤했어",
      "그냥 내 얘기 들어주면 좋겠어",
      "주말에는 여행 가고 싶어",
      "그건 됐고 와인 추천해줄래? 달지 않은 걸로",
      "아니 와인 말고 맥주로 바꿀게",
      "내가 단 거 싫다고 했잖아",
    ],
  },
  {
    name: "위임과 예산",
    turns: [
      "아무거나 추천해줘",
      "위스키로",
      "너가 알아서 하나만 골라줘",
      "그거 3만원 안에 살 수 있어?",
      "그럼 그거 말고 다른 걸로",
      "술은 됐고 저녁 메뉴 골라줘",
      "너가 정해줘",
    ],
  },
  {
    name: "추가 맥락",
    turns: [
      "오늘 술은 안 마실 거야. 저녁 메뉴 하나 골라줘",
      "너가 정해줘",
      "피자 말고 면 요리로",
      "그럼 술 얘기로 돌아가서 전통주 추천해줘",
      "아니 향이 강한 건 싫어",
      "나는 오늘 운전해야 돼",
      "고마워 그냥 다음에 마실게",
    ],
  },
];
async function main() {
  if (process.env.MOGEUM_VERIFY_MANAGED_DEV !== "1")
    throw Error("OPT_IN_REQUIRED");
  process.loadEnvFile(".env");
  const url = "https://vsckzjfgzdpzkzuumldf.supabase.co",
    config = JSON.parse(
      await readFile(
        `${homedir()}/.config/mogeum/credentials/supabase-development.json`,
        "utf8",
      ),
    );
  if (config.url !== url || process.env.EXPO_PUBLIC_SUPABASE_URL !== url)
    throw Error("PROJECT_MISMATCH");
  const journal = `${homedir()}/.config/mogeum/credentials/bartender-conversation-qa.json`;
  try {
    await readFile(journal);
    throw Error("CLEANUP_REQUIRED");
  } catch (e) {
    if ((e as { code?: string }).code !== "ENOENT") throw e;
  }
  const opts = { auth: { persistSession: false, autoRefreshToken: false } },
    admin = createClient(url, config.serviceKey, opts),
    client = createClient(
      url,
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      opts,
    );
  let owner: string | undefined;
  const results: unknown[] = [];
  try {
    const email = `bartender-qa-${randomUUID()}@example.test`,
      password = randomUUID() + "Aa1!";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { mogeum_test_fixture: "conversation-qa" },
    });
    if (created.error || !created.data.user) throw Error("CREATE_FAILED");
    owner = created.data.user.id;
    await writeFile(journal, JSON.stringify({ owner }), { mode: 0o600 });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw Error("LOGIN_FAILED");
    for (const scenario of process.env.MOGEUM_QA_FOCUS
      ? scenarios.filter((s) => s.name === process.env.MOGEUM_QA_FOCUS)
      : scenarios) {
      const cleared = await client.rpc("clear_bartender_conversation");
      if (cleared.error || !cleared.data) throw Error("CLEAR_FAILED");
      const loaded = await client.rpc("bartender_context");
      let revision = parseChatState(loaded.data).revision;
      for (const text of scenario.turns) {
        const started = Date.now();
        const response = await fetch(`${url}/functions/v1/bartender`, {
          method: "POST",
          headers: {
            apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            Authorization: `Bearer ${login.data.session!.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operationId: randomUUID(),
            revision,
            action: "say",
            text,
          }),
          signal: AbortSignal.timeout(85000),
        });
        const data = await response.json();
        if (!response.ok) {
          results.push({
            scenario: scenario.name,
            user: text,
            error: data.code,
          });
          break;
        }
        const state = parseChatState(data);
        revision = state.revision;
        const last = state.document.messages.at(-1)!;
        const row = {
          scenario: scenario.name,
          user: text,
          reply: last.text,
          topic: state.document.topic,
          conditions: state.document.conditions,
          products:
            last.cards?.map((c) => ({
              name: c.product.name,
              edition: c.product.edition,
            })) ?? [],
          ms: Date.now() - started,
        };
        results.push(row);
        console.log(JSON.stringify(row));
      }
    }
  } finally {
    if (owner) {
      const user = await admin.auth.admin.getUserById(owner);
      if (
        user.data.user?.user_metadata.mogeum_test_fixture !== "conversation-qa"
      )
        throw Error("CLEANUP_GUARD");
      if ((await admin.auth.admin.deleteUser(owner)).error)
        throw Error("CLEANUP_FAILED");
      await unlink(journal);
    }
    await mkdir("artifacts/verification/bartender", { recursive: true });
    await writeFile(
      `artifacts/verification/bartender/conversations-${process.env.MOGEUM_QA_RUN ?? "latest"}.json`,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          syntheticOnly: true,
          accountDeleted: !!owner,
          results,
        },
        null,
        2,
      ),
    );
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "QA_FAILED");
  process.exitCode = 1;
});
