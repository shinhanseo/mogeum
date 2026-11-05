/** Approved dev project, disposable synthetic users only; never print keys, sessions or provider errors. */
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { parseChatState } from "../supabase/functions/_shared/bartender-domain";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
import { tastingRepository } from "../src/features/tasting/repository";
async function main() {
  if (process.env.MOGEUM_VERIFY_MANAGED_DEV !== "1")
    throw Error("EXPLICIT_DEV_OPT_IN_REQUIRED");
  process.loadEnvFile(".env");
  const url = "https://vsckzjfgzdpzkzuumldf.supabase.co";
  const config = JSON.parse(
    await readFile(
      `${homedir()}/.config/mogeum/credentials/supabase-development.json`,
      "utf8",
    ),
  );
  if (config.url !== url || process.env.EXPO_PUBLIC_SUPABASE_URL !== url)
    throw Error("DEV_PROJECT_MISMATCH");
  const journal = `${homedir()}/.config/mogeum/credentials/bartender-verification-journal.json`;
  if (
    await readFile(journal, "utf8").catch((e) => {
      if (e.code === "ENOENT") return null;
      throw e;
    })
  )
    throw Error("CLEANUP_REQUIRED");
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const admin = createClient(url, config.serviceKey, options),
    client = createClient(url, key, options);
  const owners: string[] = [];
  const report: Record<string, unknown> = {
    checkedAt: new Date().toISOString(),
    syntheticOnly: true,
    humanAccountChanged: false,
  };
  const ensure = (ok: unknown, message: string) => {
    if (!ok) throw Error(message);
  };
  try {
    const email = `bartender-${randomUUID()}@example.test`,
      password = randomUUID() + "Aa1!";
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { mogeum_test_fixture: "bartender-verification" },
    });
    ensure(!created.error && created.data.user, "CREATE_FAILED");
    owners.push(created.data.user!.id);
    await writeFile(journal, JSON.stringify({ owners }), { mode: 0o600 });
    const login = await client.auth.signInWithPassword({ email, password });
    ensure(!login.error && login.data.session, "LOGIN_FAILED");
    const post = async (
      body: unknown,
      token = login.data.session!.access_token,
    ) => {
      const response = await fetch(`${url}/functions/v1/bartender`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(85000),
      });
      const value = await response.json();
      return { status: response.status, value };
    };
    const initial = await client.rpc("bartender_context");
    ensure(
      !initial.error && parseChatState(initial.data).revision === 0,
      "INITIAL_FAILED",
    );
    ensure(
      (
        await post(
          {
            operationId: randomUUID(),
            revision: 0,
            action: "say",
            text: "hello",
          },
          key,
        )
      ).status === 401,
      "PUBLIC_KEY_IS_NOT_IDENTITY",
    );
    const body = {
      operationId: randomUUID(),
      revision: 0,
      action: "say",
      text: "오늘은 과일 향이 나는 위스키를 골라줘. 지금 확인할 수 있는 제품으로 추천해줘.",
    };
    const fresh = await post(body);
    ensure(
      fresh.status === 200,
      `FIRST_TURN_${fresh.status}_${fresh.value.code ?? "ERROR"}`,
    );
    const first = parseChatState(fresh.value);
    const freshCards = first.document.messages.at(-1)?.cards ?? [];
    ensure(
      freshCards.length > 0 &&
        freshCards.every((c) => c.basis === "today" && c.evidence.length === 0),
      "EMPTY_EVIDENCE_INVENTED",
    );
    const replay = await post(body);
    ensure(
      replay.status === 200 && isDeepStrictEqual(replay.value, fresh.value),
      "REPLAY_CHANGED",
    );
    report.fresh = { cards: freshCards.length, basis: "today", replayed: true };
    const createdRecord = await client.rpc("create_tasting_record", {
      p_operation_id: randomUUID(),
      p_record: {
        enteredName: "합성 위스키 기록",
        category: "whisky",
        revisit: "again",
      },
    });
    ensure(!createdRecord.error, "RECORD_FAILED");
    let draft = newTastingDraft(
      owners[0],
      createdRecord.data.recordId,
      "whisky",
      "light",
    );
    draft = setAnswer(draft, "nose", {
      status: "answered",
      descriptors: ["fruit"],
      intensity: null,
      freeText: "",
    });
    await tastingRepository(client).save(
      draft,
      randomUUID(),
      createdRecord.data.revision,
      composeNote(draft),
      false,
    );
    const follow = await post({
      operationId: randomUUID(),
      revision: 1,
      action: "say",
      text: "방금 남긴 내 기록도 참고해서 과일 향이 비슷한 위스키를 추천해줘.",
    });
    ensure(follow.status === 200, `FOLLOWUP_${follow.status}`);
    const second = parseChatState(follow.value);
    const personal = second.document.messages.at(-1)?.cards ?? [];
    ensure(
      personal.some(
        (c) =>
          c.basis === "records" &&
          c.evidence.some((e) =>
            e.recordIds.includes(createdRecord.data.recordId),
          ),
      ),
      "PERSONAL_EVIDENCE_MISSING",
    );
    report.personal = { cards: personal.length, recordLinked: true };
    const stale = await post({
      operationId: randomUUID(),
      revision: 0,
      action: "say",
      text: "hello",
    });
    ensure(stale.value.code === "STALE_CONVERSATION", "STALE_ACCEPTED");
    report.staleBlocked = true;
    const loaded = await client.rpc("bartender_context");
    ensure(
      !loaded.error && isDeepStrictEqual(parseChatState(loaded.data), second),
      "RESTORE_FAILED",
    );
    report.restored = true;
    const foreign = await admin.auth.admin.createUser({
      email: `bartender-foreign-${randomUUID()}@example.test`,
      password,
      email_confirm: true,
      user_metadata: { mogeum_test_fixture: "bartender-verification" },
    });
    ensure(!foreign.error && foreign.data.user, "FOREIGN_CREATE_FAILED");
    owners.push(foreign.data.user!.id);
    await writeFile(journal, JSON.stringify({ owners }), { mode: 0o600 });
    const other = createClient(url, key, options);
    await other.auth.signInWithPassword({
      email: foreign.data.user!.email!,
      password,
    });
    const isolated = await other.rpc("bartender_context");
    ensure(
      !isolated.error &&
        parseChatState(isolated.data).document.messages.length === 0,
      "FOREIGN_LEAK",
    );
    report.ownerIsolation = true;
    if (process.env.MOGEUM_VERIFY_CHAT_RESEARCH === "1") {
      const named = await post({
        operationId: randomUUID(),
        revision: second.revision,
        action: "say",
        text: "부나하벤 18년 제품이 궁금해. 목록에 없으면 이 제품만 조사할 수 있게 해줘. 다른 술은 추천하지 마.",
      });
      ensure(named.status === 200, "RESEARCH_INTENT_FAILED");
      const proposal = parseChatState(named.value);
      ensure(
        proposal.document.research?.category === "whisky" &&
          proposal.document.research.name.includes("18"),
        "RESEARCH_CONFIRMATION_MISSING",
      );
      const search = await post({
        operationId: randomUUID(),
        revision: proposal.revision,
        action: "research",
        text: "",
      });
      ensure(search.status === 200, "RESEARCH_FAILED");
      const researched = parseChatState(search.value),
        cards = researched.document.messages.at(-1)?.cards ?? [];
      const verified = cards.some(
        (c) => c.basis === "research" && c.product.source.kind === "producer",
      );
      ensure(
        verified ||
          (cards.length === 0 &&
            [
              "unresolved",
              "daily-limit",
              "monthly-limit",
              "provider-backoff",
              "backoff",
              "busy",
              "running",
              "unavailable",
            ].includes(search.value.researchState)),
        "UNSAFE_RESEARCH_RESULT",
      );
      report.research = {
        explicitConfirmation: true,
        sourceVerified: verified,
        state: search.value.researchState,
        query: proposal.document.research,
        unsupportedFactsHidden: !verified,
      };
    }
    if (process.env.MOGEUM_VERIFY_CHAT_SMALLTALK === "1") {
      const talk = await post({
        operationId: randomUUID(),
        revision: second.revision,
        action: "say",
        text: "추천은 잠깐 쉬고 그냥 너랑 이야기하고 싶어. 오늘 오랜만에 친구를 만나서 즐거웠어.",
      });
      ensure(talk.status === 200, "SMALLTALK_FAILED");
      const conversation = parseChatState(talk.value),
        last = conversation.document.messages.at(-1);
      ensure(
        last?.role === "assistant" &&
          last.text.length > 0 &&
          !last.cards?.length &&
          !conversation.document.research,
        "SMALLTALK_FORCED_RECOMMENDATION",
      );
      ensure(
        isDeepStrictEqual(
          conversation.document.conditions,
          second.document.conditions,
        ),
        "SMALLTALK_CHANGED_DRINK_CONDITIONS",
      );
      report.smalltalk = {
        noForcedRecommendations: true,
        conditionsPreserved: true,
        reply: last.text,
      };
    }
    const cleared = await client.rpc("clear_bartender_conversation");
    ensure(!cleared.error && cleared.data === true, "CLEAR_FAILED");
    const empty = await client.rpc("bartender_context");
    ensure(
      !empty.error && parseChatState(empty.data).document.messages.length === 0,
      "CLEAR_INCOMPLETE",
    );
    report.cleared = true;
  } finally {
    for (const owner of owners) {
      const user = await admin.auth.admin.getUserById(owner);
      if (
        user.data.user?.user_metadata.mogeum_test_fixture !==
        "bartender-verification"
      )
        throw Error("CLEANUP_TAG_MISMATCH");
      if ((await admin.auth.admin.deleteUser(owner)).error)
        throw Error("CLEANUP_FAILED_JOURNAL_RETAINED");
    }
    if (owners.length) await unlink(journal);
    report.syntheticAccountsDeleted = true;
    await mkdir("artifacts/verification", { recursive: true });
    await writeFile(
      "artifacts/verification/managed-bartender.json",
      JSON.stringify(report, null, 2) + "\n",
    );
  }
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "BARTENDER_VERIFICATION_FAILED",
  );
  process.exitCode = 1;
});
