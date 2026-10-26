import { validateItems } from "../supabase/functions/_shared/menu-domain";
import {
  requireCatalogVersion,
  validateMenuResult,
} from "../src/features/menu/result-contract";
/** Explicitly approved Mogeum development project only. Create/tag/clean synthetic accounts; never enumerate or touch human accounts. */
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { newTastingDraft, setAnswer } from "../src/features/tasting/draft";
import { composeNote } from "../src/features/tasting/answers";
import { tastingRepository } from "../src/features/tasting/repository";
import { parseDiscoveryResult } from "../src/features/discovery/contract";
const approved = "https://vsckzjfgzdpzkzuumldf.supabase.co";
const credentials = join(
  homedir(),
  ".config/mogeum/credentials/supabase-development.json",
);
const journal = join(
  homedir(),
  ".config/mogeum/credentials/managed-verification-journal.json",
);
let step = "configuration";
const ensure = (value: unknown) => {
  if (!value) throw Error(`VERIFICATION_FAILED_${step}`);
};
async function main() {
  if (process.env.MOGEUM_VERIFY_MANAGED_DEV !== "1")
    throw Error("EXPLICIT_DEV_OPT_IN_REQUIRED");
  process.loadEnvFile(".env");
  const config = JSON.parse(await readFile(credentials, "utf8"));
  ensure(
    config.url === approved &&
      process.env.EXPO_PUBLIC_SUPABASE_URL === approved &&
      typeof config.serviceKey === "string" &&
      config.serviceKey.length >= 40,
  );
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  ensure(publicKey);
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const unfinished = await readFile(journal, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  ensure(unfinished === null);
  const admin = createClient(approved, config.serviceKey, options);
  const run = randomUUID(),
    created: { owner: string; token?: string }[] = [];
  const report: Record<string, unknown> = {
    checkedAt: new Date().toISOString(),
    projectRef: "vsckzjfgzdpzkzuumldf",
    syntheticOnly: true,
    humanAccountChanged: false,
  };
  const call = (name: string, token?: string, body: unknown = {}) =>
    fetch(`${approved}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: publicKey,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(55000),
    });
  async function make() {
    step = "synthetic-auth-create";
    const email = `mogeum-managed-${randomUUID()}@example.test`,
      password = randomUUID() + "Aa1!";
    const result = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        mogeum_test_fixture: "managed-account-v1",
        mogeum_test_run: run,
      },
    });
    ensure(!result.error && result.data.user);
    const saved = {
      owner: result.data.user!.id,
      token: undefined as string | undefined,
    };
    created.push(saved);
    await writeFile(
      journal,
      JSON.stringify({ run, owners: created.map((r) => r.owner) }),
      { mode: 0o600 },
    );
    const client = createClient(approved, publicKey, options);
    const login = await client.auth.signInWithPassword({ email, password });
    ensure(!login.error && login.data.session);
    saved.token = login.data.session!.access_token;
    return { ...saved, token: saved.token!, client };
  }
  let failed = false;
  try {
    const a = await make(),
      b = await make();
    step = "protected-delete-boundary";
    const unauthorized = await call("delete-account", undefined, {
      confirm: true,
    });
    ensure(unauthorized.status === 401);
    report.deleteBuild = unauthorized.headers.get("x-mogeum-build");
    ensure(
      (
        await call("delete-account", a.token, {
          confirm: true,
          userId: b.owner,
        })
      ).status === 400,
    );
    step = "empty-discovery";
    const initial = await call("next-drinks", a.token);
    ensure(initial.status === 200);
    const empty = await initial.json();
    ensure(parseDiscoveryResult(empty).recommendations.length === 0);
    ensure(
      Array.isArray(empty.recommendations) &&
        empty.recommendations.length === 0,
    );
    report.discoveryBuild = initial.headers.get("x-mogeum-build");
    report.rawEmptyRecommendationCount = Array.isArray(empty.recommendations)
      ? empty.recommendations.length
      : null;
    step = "synthetic-photo-upload";
    const operation = randomUUID(),
      path = `${a.owner}/records/${operation}/photo.png`;
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=",
      "base64",
    );
    ensure(
      !(
        await a.client.storage
          .from("record-photos")
          .upload(path, png, { contentType: "image/png" })
      ).error,
    );
    for (let i = 0; i < 3; i++) {
      step = "synthetic-record-and-note";
      const record = await a.client.rpc("create_tasting_record", {
        p_operation_id: i === 0 ? operation : randomUUID(),
        p_record: {
          enteredName: `합성 검증 위스키 ${i + 1}`,
          category: "whisky",
          revisit: "again",
          ...(i === 0
            ? { photo: { storagePath: path, width: 1, height: 1 } }
            : {}),
        },
      });
      ensure(!record.error && record.data?.recordId);
      let draft = newTastingDraft(
        a.owner,
        record.data.recordId,
        "whisky",
        "light",
      );
      draft = setAnswer(draft, "nose", {
        status: "answered",
        descriptors: ["fruit"],
        intensity: null,
        freeText: "",
      });
      await tastingRepository(a.client).save(
        draft,
        randomUUID(),
        record.data.revision,
        composeNote(draft),
        false,
      );
    }
    if (process.env.MOGEUM_SKIP_AI !== "1") {
      step = "managed-ai-summary";
      const summary = await call("taste-summary", a.token);
      const summaryBody = await summary.json();
      report.summary = {
        status: summary.status,
        state: typeof summaryBody.state === "string" ? summaryBody.state : null,
        code: typeof summaryBody.code === "string" ? summaryBody.code : null,
      };
      if (summary.status === 200 && summaryBody.state === "ready") {
        const context = await a.client.rpc("taste_summary_context");
        ensure(
          !context.error &&
            context.data?.cached?.selection?.highlightIds?.length > 0,
        );
        report.summaryModel = context.data.cached.model;
        report.summaryHighlights = context.data.cached.selection.highlightIds;
        report.summaryCacheSaved = true;
        const cached = await call("taste-summary", a.token);
        const cachedBody = await cached.json();
        ensure(
          cached.status === 200 &&
            cachedBody.state === "ready" &&
            cachedBody.cached === true,
        );
        report.summaryCacheReplayed = true;
      } else {
        failed = true;
        report.failedStep = step;
      }
    } else report.summary = { state: "not_requested" };
    step = "managed-evidence-discovery";
    const recommendations = await call("next-drinks", a.token);
    ensure(recommendations.status === 200);
    const personal = parseDiscoveryResult(await recommendations.json());
    ensure(
      personal.recommendations.length > 0 &&
        personal.recommendations.every(
          (r) => r.score > 0 && r.similar.length > 0,
        ),
    );
    report.positiveRecommendations = personal.recommendations.length;
    step = "managed-native-ocr-fixture-menu";
    // Replay already captured native OCR evidence; this does not claim a new camera/OCR run.
    const capture = JSON.parse(
      await readFile(
        "docs/verification/ocr-benchmark/ios-normalized-v2.json",
        "utf8",
      ),
    );
    const photos = ["light", "two-columns"].map((id) => {
      const raw = capture.cases.find(
        (c: { id: string }) => c.id === id,
      )?.rawNative;
      ensure(raw && Array.isArray(raw.lines));
      const photoId = randomUUID();
      return {
        ...raw,
        id: photoId,
        imageRevision: 1,
        lines: raw.lines.map((line: object, index: number) => ({
          ...line,
          id: `${photoId}:1:${index}`,
        })),
      };
    });
    const parse = await call("menu-recommend", a.token, {
      action: "parse",
      photos,
    });
    ensure(parse.status === 200);
    const parsed = await parse.json();
    requireCatalogVersion(parsed);
    ensure(parsed.parser === "geometry-v4");
    const items = validateItems(parsed.items, photos);
    ensure(
      photos.every((photo) => items.some((item) => item.photoId === photo.id)),
    );
    const chosen = items.find((item) => /글렌|glen/i.test(item.name));
    ensure(chosen);
    const confirmed = {
      ...chosen!,
      name: "글렌리벳 12년",
      productId: "glenlivet-12",
      confirmed: true,
    };
    const reviewed = validateItems(
        items.map((item) => (item.id === chosen!.id ? confirmed : item)),
        photos,
      ),
      sessionId = randomUUID();
    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await a.client.rpc("save_menu_session", {
        p_id: sessionId,
        p_revision: 0,
        p_photos: photos,
        p_items: reviewed,
      });
      ensure(!saved.error && saved.data === 1);
    }
    const hidden = await b.client
      .from("menu_sessions")
      .select("id")
      .eq("id", sessionId);
    ensure(!hidden.error && hidden.data?.length === 0);
    const recommendation = await call("menu-recommend", a.token, {
      action: "recommend",
      photos,
      items: [confirmed],
    });
    ensure(recommendation.status === 200);
    const compared = validateMenuResult(await recommendation.json(), [
      confirmed,
    ]);
    ensure(compared.recommendations.length > 0);
    report.menu = {
      build: parse.headers.get("x-mogeum-build"),
      source: "previously-captured-ios-native-ocr",
      photoCount: photos.length,
      parsedItems: items.length,
      parser: parsed.parser,
      sessionSaved: true,
      idempotentReplay: true,
      otherAccountReadDenied: true,
      recommendations: compared.recommendations.length,
    };
    step = "managed-galaxy-ambiguous-prices";
    const galaxy = JSON.parse(
      await readFile(
        "docs/verification/ocr-benchmark/android-galaxy-20261026.json",
        "utf8",
      ),
    );
    const rawGalaxy = galaxy.cases.find(
      (c: { id: string }) => c.id === "ambiguous-price",
    )?.rawNative;
    ensure(rawGalaxy);
    const ambiguousId = randomUUID();
    const ambiguousPhotos = [
      {
        ...rawGalaxy,
        id: ambiguousId,
        imageRevision: 1,
        lines: rawGalaxy.lines.map((line: object, index: number) => ({
          ...line,
          id: `${ambiguousId}:1:${index}`,
        })),
      },
    ];
    const ambiguous = await call("menu-recommend", a.token, {
      action: "parse",
      photos: ambiguousPhotos,
    });
    ensure(ambiguous.status === 200);
    const ambiguousBody = await ambiguous.json();
    requireCatalogVersion(ambiguousBody);
    const uncertain = validateItems(ambiguousBody.items, ambiguousPhotos);
    ensure(
      uncertain.length > 0 &&
        uncertain.every((item) => item.price === null && !item.confirmed),
    );
    report.ambiguousMenu = {
      source: "previously-captured-galaxy-native-ocr",
      candidates: uncertain.length,
      pricedCandidates: 0,
      reviewRequired: ambiguousBody.reviewRequired === true,
    };
    step = "managed-account-delete";
    const deleted = await call("delete-account", a.token, { confirm: true });
    ensure(
      deleted.status === 200 && (await deleted.json()).state === "complete",
    );
    ensure((await admin.auth.admin.getUserById(a.owner)).error);
    ensure((await admin.storage.from("record-photos").download(path)).error);
    const remaining = await admin
      .from("tasting_records")
      .select("id")
      .eq("user_id", a.owner);
    ensure(!remaining.error && remaining.data?.length === 0);
    const notes = await admin
      .from("record_notes")
      .select("record_id")
      .eq("user_id", a.owner);
    ensure(!notes.error && notes.data?.length === 0);
    step = "managed-other-account-preserved";
    ensure(!(await admin.auth.admin.getUserById(b.owner)).error);
    const foreign = await b.client.rpc("account_deletion_status");
    ensure(!foreign.error && foreign.data === null);
    step = "managed-completed-retry";
    const replay = await call("delete-account", a.token, { confirm: true });
    ensure(replay.status === 200 && (await replay.json()).state === "complete");
    report.accountDeletion = {
      physicalPhotoRemoved: true,
      recordsRemoved: true,
      notesRemoved: true,
      authRemoved: true,
      otherAccountPreserved: true,
      lostResponseReplay: true,
    };
  } catch {
    failed = true;
    report.failedStep = step;
  } finally {
    const pendingCleanup: string[] = [];
    for (const fixture of created) {
      try {
        step = "tagged-synthetic-cleanup";
        const user = await admin.auth.admin.getUserById(fixture.owner);
        if (!user.data.user) continue;
        ensure(
          user.data.user.user_metadata.mogeum_test_fixture ===
            "managed-account-v1" &&
            user.data.user.user_metadata.mogeum_test_run === run,
        );
        const lease = randomUUID(),
          hash = createHash("sha256").update(randomUUID()).digest("hex");
        const begin = await admin.rpc("begin_account_deletion", {
          p_owner: fixture.owner,
          p_token_hash: hash,
          p_lease: lease,
        });
        ensure(!begin.error && begin.data === true);
        const files = await admin.rpc("account_deletion_files", {
          p_owner: fixture.owner,
          p_lease: lease,
        });
        ensure(!files.error && Array.isArray(files.data));
        if (files.data.length)
          ensure(
            !(await admin.storage.from("record-photos").remove(files.data))
              .error,
          );
        ensure(
          !(
            await admin.rpc("purge_account_data", {
              p_owner: fixture.owner,
              p_lease: lease,
            })
          ).error,
        );
        ensure(!(await admin.auth.admin.deleteUser(fixture.owner)).error);
        ensure(
          !(
            await admin.rpc("finish_account_deletion", {
              p_owner: fixture.owner,
              p_lease: lease,
            })
          ).error,
        );
      } catch {
        pendingCleanup.push(fixture.owner);
      }
    }
    report.syntheticCleanupComplete = pendingCleanup.length === 0;
    if (!pendingCleanup.length) await unlink(journal).catch(() => {});
    const output =
      process.argv[2] ??
      join(tmpdir(), "mogeum-managed-account-verification.json");
    await mkdir(join(output, ".."), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
    console.log(JSON.stringify(report));
    if (failed || pendingCleanup.length) process.exitCode = 1;
  }
}
main().catch(() => {
  console.error(
    `Managed verification stopped at ${step}; credentials and response bodies were not logged.`,
  );
  process.exitCode = 1;
});
