import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';

type Params = (string | number | null)[];
type Row = Record<string, unknown>;
interface Db { query<T extends Row = Row>(sql: string, params?: Params): Promise<{ rows: T[] }>; exec(sql: string): Promise<unknown>; close(): Promise<void>; }
const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const operation = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const path = (owner: string, n: number) => `${owner}/records/${operation(n)}/photo.jpg`;
const databaseUrl = process.env.MOGEUM_TEST_DATABASE_URL;

async function connect(): Promise<Db> {
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Database tests only allow loopback test databases');
    const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    return {
      async query<T extends Row>(text: string, parameters: Params = []) { return { rows: [...await sql.unsafe(text, parameters)] as unknown as T[] }; },
      exec: text => sql.unsafe(text), close: () => sql.end(),
    };
  }
  const db = await PGlite.create();
  await db.exec(await readFile(new URL('./fixtures/supabase-platform.sql', import.meta.url), 'utf8'));
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
  }
  return db;
}

test(`record database invariants (${databaseUrl ? 'Supabase PostgreSQL' : 'PGlite; managed schemas are test fixtures'})`, async t => {
  const db = await connect();
  type Saved = { recordId: string; cellarEntryId: string; revision: number; replayed: boolean };
  const as = async (owner: string | null) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [owner ?? '']);
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(owner ? { sub: owner, role: 'authenticated' } : { role: 'anon' })]);
    await db.exec(owner ? 'set role authenticated' : 'set role anon');
  };
  const saved = async (n: number, payload: object, entry: string | null = null): Promise<Saved> => {
    const { rows } = await db.query<{ result: Saved }>('select public.create_tasting_record($1::uuid,$2::jsonb,$3::uuid) as result', [operation(n), JSON.stringify(payload), entry]);
    return rows[0].result;
  };
  const code = (sql: string, values: Params, expected: string) => assert.rejects(db.query(sql, values), { code: expected });
  const photo = (owner: string, n: number) => ({ storagePath: path(owner, n), width: 900, height: 1200 });
  const uploadMetadata = (owner: string, n: number) => db.query('insert into storage.objects(bucket_id,name,owner_id) values ($1,$2,$3)', ['record-photos', path(owner, n), owner]);
  let first: Saved; let second: Saved; let foreign: Saved; let firstPhotoId: string;
  try {
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [a, 'mogeum-a@example.test', b, 'mogeum-b@example.test']);

    await t.test('private tables enable RLS and bucket is private', async () => {
      const { rows } = await db.query("select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'");
      assert.equal(rows.length, 10);
      assert.ok(rows.every(row => row.relrowsecurity === true));
      assert.equal((await db.query("select public from storage.buckets where id='record-photos'")).rows[0].public, false);
    });
    await t.test('anonymous clients cannot read rows, create records, or upload photos', async () => {
      await as(null);
      await code('select * from public.tasting_records', [], '42501');
      await assert.rejects(saved(1, { enteredName: 'anonymous' }), { code: '42501' });
      await assert.rejects(uploadMetadata(a, 1), { code: '42501' });
    });
    await t.test('a photo alone saves atomically without a product, name, preference or note', async () => {
      await as(a); await uploadMetadata(a, 1);
      first = await saved(1, { photo: photo(a, 1) });
      firstPhotoId = String((await db.query('select id from public.record_photos where record_id=$1', [first.recordId])).rows[0].id);
      const row = (await db.query('select * from public.tasting_records where id=$1', [first.recordId])).rows[0];
      assert.equal(row.entered_name, null); assert.equal(row.revisit, null); assert.equal((await db.query('select * from public.record_notes')).rows.length, 0);
      const entry = (await db.query('select * from public.cellar_overview')).rows[0];
      assert.equal(entry.drink_id, null); assert.equal(String(entry.record_count), '1'); assert.equal(entry.photo_path, path(a, 1));
    });
    await t.test('retry returns the original record and creates no extra cellar entry', async () => {
      const retry = await saved(1, { photo: photo(a, 1) });
      assert.equal(retry.recordId, first.recordId); assert.equal(retry.replayed, true);
      assert.equal((await db.query('select * from public.cellar_entries')).rows.length, 1);
      await assert.rejects(saved(1, { enteredName: 'different input' }), { code: '23505' });
    });
    await t.test('same names stay separate until the user explicitly links an experience', async () => {
      second = await saved(2, { enteredName: 'Synthetic whisky', category: 'whisky', revisit: 'again' });
      const distinct = await saved(3, { enteredName: 'Synthetic whisky', category: 'whisky' });
      assert.notEqual(second.cellarEntryId, distinct.cellarEntryId);
      await saved(4, { enteredName: 'Synthetic whisky', category: 'whisky', revisit: 'not_for_me' }, second.cellarEntryId);
      await saved(5, { enteredName: 'Synthetic whisky', category: 'whisky', revisit: 'okay' }, second.cellarEntryId);
      const experiences = await db.query('select revisit from public.tasting_records where cellar_entry_id=$1', [second.cellarEntryId]);
      assert.deepEqual(new Set(experiences.rows.map(row => row.revisit)), new Set(['again','not_for_me','okay']));
      assert.equal(String((await db.query('select record_count from public.cellar_overview where id=$1', [second.cellarEntryId])).rows[0].record_count), '3');
    });
    await t.test('user B cannot read A rows, photos, or the security-invoker overview', async () => {
      await as(b);
      for (const table of ['cellar_entries','tasting_records','record_photos','record_notes','record_answers','record_drafts','user_settings','profiles','photo_deletion_jobs','cellar_overview']) {
        assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
      }
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
      foreign = await saved(10, { enteredName: 'B record' });
      assert.equal((await db.query('select * from public.cellar_overview')).rows.length, 1);
    });
    await t.test('foreign parent IDs cannot be attached through RPC or child foreign keys', async () => {
      await assert.rejects(saved(11, { enteredName: 'forged link' }, first.cellarEntryId), { code: '42501' });
      await code('insert into public.tasting_records(user_id,cellar_entry_id,operation_id) values ($1,$2,$3)', [b, first.cellarEntryId, operation(11)], '23503');
      await uploadMetadata(b, 12);
      await code('insert into public.record_photos(record_id,storage_path,width,height) values ($1,$2,100,100)', [first.recordId, path(b, 12)], '23503');
      await code("insert into public.record_notes(record_id,mode,catalog_version) values ($1,'deep',1)", [first.recordId], '23503');
      await code("insert into public.record_answers(record_id,mode,catalog_version,question_id) values ($1,'light',1,'aroma')", [first.recordId], '23503');
      await code('insert into public.record_drafts(record_id) values ($1)', [first.recordId], '23503');
    });
    await t.test('forged owner IDs and writes to another user are rejected or affect zero rows', async () => {
      await code('insert into public.cellar_entries(user_id) values ($1)', [a], '42501');
      await code('update public.tasting_records set user_id=$1 where id=$2', [a, foreign.recordId], '23514');
      assert.equal((await db.query('update public.tasting_records set rating=5 where id=$1 returning id', [first.recordId])).rows.length, 0);
      assert.equal((await db.query('delete from public.tasting_records where id=$1 returning id', [first.recordId])).rows.length, 0);
      await assert.rejects(saved(13, { enteredName: 'name', userId: a }), { code: '22023' });
    });
    await t.test('photo policies reject foreign prefixes, overwrites, and deleting a referenced file', async () => {
      await code('update public.cellar_entries set representative_photo_id=$1 where id=$2', [firstPhotoId, foreign.cellarEntryId], '23514');
      await assert.rejects(uploadMetadata(a, 99), { code: '42501' });
      assert.equal((await db.query("update storage.objects set name='renamed' where name=$1 returning id", [path(b, 12)])).rows.length, 0);
      assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(b, 12)])).rows.length, 1);
      await as(a);
      assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(a, 1)])).rows.length, 0);
      await code('update public.cellar_entries set representative_photo_id=(select id from public.record_photos limit 1) where id=$1', [second.cellarEntryId], '23514');
    });
    await t.test('representative photos are cleared atomically when a record moves; empty groups disappear', async () => {
      const record = (await db.query('select revision from public.tasting_records where id=$1', [first.recordId])).rows[0];
      await db.query('select public.move_tasting_record($1,$2,$3)', [first.recordId, second.cellarEntryId, Number(record.revision)]);
      assert.equal((await db.query('select representative_photo_id from public.cellar_entries where id=$1', [first.cellarEntryId])).rows[0].representative_photo_id, null);
      assert.equal((await db.query('select * from public.cellar_overview where id=$1', [first.cellarEntryId])).rows.length, 0);
      const current = Number((await db.query('select revision from public.tasting_records where id=$1', [first.recordId])).rows[0].revision);
      await code('select public.move_tasting_record($1,$2,$3)', [first.recordId, foreign.cellarEntryId, current], '42501');
      assert.equal((await db.query('select cellar_entry_id from public.tasting_records where id=$1', [first.recordId])).rows[0].cellar_entry_id, second.cellarEntryId);
    });
    await t.test('deleting a representative photo clears its reference and queues binary cleanup', async () => {
      const photoId = String((await db.query('select id from public.record_photos where record_id=$1', [first.recordId])).rows[0].id);
      await db.query('update public.cellar_entries set representative_photo_id=$1 where id=$2', [photoId, second.cellarEntryId]);
      await db.query('delete from public.record_photos where id=$1', [photoId]);
      assert.equal((await db.query('select representative_photo_id from public.cellar_entries where id=$1', [second.cellarEntryId])).rows[0].representative_photo_id, null);
      assert.equal((await db.query('select status from public.photo_deletion_jobs where storage_path=$1', [path(a, 1)])).rows[0].status, 'pending');
      assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(a, 1)])).rows.length, 1);
    });
    await t.test('optimistic edits reject stale revisions and keep the saved experience', async () => {
      const oldRevision = Number((await db.query('select revision from public.tasting_records where id=$1', [second.recordId])).rows[0].revision);
      await db.query("select public.update_tasting_record($1,$2,'{\"rating\":4}')", [second.recordId, oldRevision]);
      await code("select public.update_tasting_record($1,$2,'{\"rating\":1}')", [second.recordId, oldRevision], '40001');
      const row = (await db.query('select rating from public.tasting_records where id=$1', [second.recordId])).rows[0];
      assert.equal(row.rating, 4);
    });
    await t.test('invalid ratings/vintages and missing uploaded files roll back the new group too', async () => {
      const initial = (await db.query('select * from public.cellar_entries')).rows.length;
      for (const [i, payload, expected] of [
        [20, { enteredName:'wine',category:'wine',vintageStatus:'year' }, '23514'],
        [21, { enteredName:'wine',category:'wine',vintageYear:2020 }, '23514'],
        [22, { enteredName:'unknown',vintageStatus:'year',vintageYear:2020 }, '23514'],
        [23, { enteredName:'whisky',category:'whisky',vintageStatus:'year',vintageYear:2020 }, '23514'],
        [24, { enteredName:'bad rating',rating:0 }, '23514'],
        [25, { photo:photo(a,25) }, '23514'],
        [26, {}, '22023'],
      ] as const) await assert.rejects(saved(i, payload), { code: expected });
      assert.equal((await db.query('select * from public.cellar_entries')).rows.length, initial);
      await saved(27, { enteredName:'Synthetic wine',category:'wine',vintageStatus:'year',vintageYear:2020 });
      await saved(28, { enteredName:'Synthetic NV',category:'wine',vintageStatus:'nv' });
    });
    await t.test('light/deep answers preserve unknown, skipped, none and an answered zero separately', async () => {
      await db.query("insert into public.record_notes(record_id,mode,catalog_version) values ($1,'deep',1)", [second.recordId]);
      for (const [mode, status, question, intensity] of [
        ['light','unknown','aroma',null], ['deep','none','peat',null], ['deep','skipped','color',null], ['deep','answered','alcohol',0],
      ]) await db.query('insert into public.record_answers(record_id,mode,catalog_version,question_id,status,intensity) values ($1,$2,1,$3,$4,$5)', [second.recordId, String(mode), String(question), String(status), intensity as number | null]);
      const answers = (await db.query('select status,intensity from public.record_answers where record_id=$1', [second.recordId])).rows;
      assert.equal(answers.length, 4); assert.ok(answers.some(row => row.status === 'answered' && row.intensity === 0));
      await code("insert into public.record_answers(record_id,mode,catalog_version,question_id,status,intensity) values ($1,'deep',1,'invalid','unknown',0)", [second.recordId], '23514');
      assert.equal(Number((await db.query('select input_revision from public.record_notes where record_id=$1', [second.recordId])).rows[0].input_revision), 5);
      await code("update public.record_notes set generated_draft='forged AI' where record_id=$1", [second.recordId], '42501');
    });
    await t.test('drafts and last-used mode are owner-scoped and do not change an existing note mode', async () => {
      await db.query("insert into public.user_settings(last_note_mode) values ('light')");
      await db.query("insert into public.record_drafts(record_id,mode,payload) values ($1,'deep','{\"stage\":\"aroma\"}')", [second.recordId]);
      assert.equal((await db.query('select mode from public.record_notes where record_id=$1', [second.recordId])).rows[0].mode, 'deep');
      await as(b);
      for (const table of ['record_drafts','record_notes','record_answers']) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0, table);
      assert.equal((await db.query('select * from public.user_settings')).rows.length, 0);
      await code('insert into public.user_settings(user_id) values ($1)', [a], '42501');
    });
    await t.test('concurrent requests with one operation ID create one record/group', { skip: !databaseUrl ? 'Needs independent PostgreSQL sessions; PGlite is single-session' : false }, async () => {
      const sql = postgres(databaseUrl!, { max: 2, onnotice: () => {} });
      try {
        const run = () => sql.begin(async tx => {
          await tx.unsafe('set local role authenticated');
          await tx.unsafe("select set_config('request.jwt.claim.sub',$1,true)", [a]);
          const result = await tx.unsafe('select public.create_tasting_record($1,$2::jsonb) as result', [operation(100), JSON.stringify({ enteredName: 'Concurrent synthetic record' })]);
          return result[0].result as Saved;
        });
        const results = await Promise.all([run(), run()]);
        assert.equal(new Set(results.map(result => result.recordId)).size, 1);
        assert.equal(results.filter(result => result.replayed).length, 1);
        await as(a);
        assert.equal((await db.query('select * from public.tasting_records where operation_id=$1', [operation(100)])).rows.length, 1);
      } finally { await sql.end(); }
    });
    await t.test('unverified common products are not client-readable or writable', async () => {
      await db.exec('reset role');
      await db.query("insert into public.drinks(canonical_name,category,verification_status) values ('Unverified','wine','unverified'),('Verified','beer','verified')");
      await as(a);
      assert.equal((await db.query('select * from public.drinks')).rows.length, 1);
      await code("insert into public.drinks(canonical_name,category) values ('client','wine')", [], '42501');
      await code("update public.drinks set canonical_name='overwrite' returning id", [], '42501');
    });
  } finally { await db.exec('reset role'); await db.close(); }
});
