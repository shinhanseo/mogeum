import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
const databaseUrl = process.env.MOGEUM_TEST_DATABASE_URL;
test(
  "real PostgreSQL provider capture receipts and deletion lease recovery isolate fresh disposable owners",
  { skip: !databaseUrl ? "Requires isolated loopback PostgreSQL" : false },
  async () => {
    const url = new URL(databaseUrl!);
    assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname));
    const sql = postgres(databaseUrl!, { max: 1, onnotice: () => {} }),
      owner = randomUUID(),
      other = randomUUID(),
      generation = randomUUID(),
      lease = randomUUID(),
      freshLease = randomUUID(),
      hash = "c".repeat(64),
      cipher = "v1." + "fixture".repeat(15);
    const email = `provider-db-${owner}@example.test`,
      subject = "synthetic-" + owner;
    try {
      await sql`insert into auth.users(id,email) values(${owner},${email})`;
      await sql`insert into auth.identities(user_id,provider,provider_id,identity_data) values(${owner},'apple',${subject},${sql.json({ sub: subject })})`;
      await sql.unsafe("set role service_role");
      await sql`select public.store_provider_credential_capture(${owner},'apple',${subject},${cipher},${generation},${hash})`;
      assert.equal(
        (
          await sql`select public.provider_credential_captured(${owner},'apple',${subject},${hash}) result`
        )[0].result,
        true,
      );
      assert.equal(
        (
          await sql`select public.provider_credential_captured(${other},'apple',${subject},${hash}) result`
        )[0].result,
        false,
      );
      await sql`select public.begin_account_deletion(${owner},${"d".repeat(64)},${lease})`;
      await assert.rejects(
        sql`select public.store_provider_credential_capture(${owner},'apple',${subject},${cipher},${generation},${hash})`,
        { code: "42501" },
      );
      await sql`select public.rotate_deletion_provider_credential(${owner},'apple',${generation},${lease},${cipher + "rotated"})`;
      await sql`select public.release_account_deletion(${owner},${lease})`;
      await assert.rejects(
        sql`select public.rotate_deletion_provider_credential(${owner},'apple',${generation},${lease},${cipher})`,
        { code: "42501" },
      );
      await sql`select public.store_provider_credential_capture(${owner},'apple',${subject},${cipher},${generation},${hash})`;
      await sql`select public.begin_account_deletion(${owner},${"d".repeat(64)},${freshLease})`;
      await sql.unsafe("reset role");
      await sql`update private.account_deletions set leased_at=now()-interval '61 seconds' where user_id=${owner}`;
      await sql.unsafe("set role service_role");
      await assert.rejects(
        sql`select public.mark_provider_revoked(${owner},'apple',${generation},${freshLease})`,
        { code: "42501" },
      );
      await sql`select public.begin_account_deletion(${owner},${"d".repeat(64)},${lease})`;
      await sql`select public.mark_provider_revoked(${owner},'apple',${generation},${lease})`;
      assert.equal(
        (
          await sql`select public.provider_credential_captured(${owner},'apple',${subject},${hash}) result`
        )[0].result,
        false,
      );
      await sql.unsafe("reset role;set role authenticated");
      await assert.rejects(
        sql`select public.provider_credential_captured(${owner},'apple',${subject},${hash})`,
        { code: "42501" },
      );
      await assert.rejects(
        sql`select public.rotate_deletion_provider_credential(${owner},'apple',${generation},${lease},${cipher})`,
        { code: "42501" },
      );
    } finally {
      await sql.unsafe("reset role");
      // Only the freshly generated test identity can authorize cleanup; never touch global fixtures/users.
      await sql`delete from auth.users where id=${owner} and email=${email}`;
      assert.equal(
        (
          await sql`select 1 from private.provider_credentials where user_id=${owner}`
        ).length,
        0,
      );
      await sql.end();
    }
  },
);
