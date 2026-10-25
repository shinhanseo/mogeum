import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';

type JsonObject = { [key: string]: postgres.JSONValue };
type Params = (string | number | boolean | null | JsonObject | postgres.JSONValue[])[];
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
      async query<T extends Row>(text: string, parameters: Params = []) { return { rows: [...await sql.unsafe(text, parameters.map(value => typeof value === 'object' && value !== null ? sql.json(value) : value))] as unknown as T[] }; },
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
  const saved = async (n: number, payload: JsonObject, entry: string | null = null): Promise<Saved> => {
    const { rows } = await db.query<{ result: Saved }>('select public.create_tasting_record($1::uuid,$2::jsonb,$3::uuid) as result', [operation(n), payload, entry]);
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
      assert.equal(rows.length, 13);
      assert.ok(rows.every(row => row.relrowsecurity === true));
      assert.equal((await db.query("select public from storage.buckets where id='record-photos'")).rows[0].public, false);
    });
    await t.test('wishlist revisions and immutable receipts preserve ownership without becoming tasting records', async()=>{
      await as(a);
      const write=(op:number,saved:boolean,revision:number,product='glenlivet-12')=>db.query<{result: {revision:number;saved:boolean;replayed:boolean}}>('select public.set_drink_wishlist($1,$2,$3,$4) result',[operation(op),product,saved,revision]);
      const first=(await write(190,true,0)).rows[0].result;assert.equal(first.revision,1);assert.equal(first.saved,true);
      assert.equal((await write(190,true,0)).rows[0].result.replayed,true);
      await assert.rejects(write(190,false,0),/OPERATION_PAYLOAD_CHANGED/);
      assert.equal((await write(191,false,1)).rows[0].result.revision,2);
      assert.equal((await write(190,true,0)).rows[0].result.saved,true);
      assert.equal((await db.query('select saved from public.drink_wishlist')).rows[0].saved,false);
      await assert.rejects(write(192,true,1),/STALE_WISHLIST/);
      await code("insert into public.drink_wishlist(user_id,product_id,saved,revision) values ($1,'glenlivet-12',true,1)",[b],'42501');
      await code('select * from private.wishlist_operations',[],'42501');
      await assert.rejects(write(193,true,0,'invented-drink'),{code:'23514'});
      await as(b);assert.equal((await db.query('select * from public.drink_wishlist')).rows.length,0);
      assert.equal((await db.query('select count(*)::integer n from public.tasting_records')).rows[0].n,0);
    });
    await t.test('menu drafts enforce owner, five pages, optimistic revision and retry', async()=>{
      await as(a);const id=operation(180);
      const write=(revision:number,photos:postgres.JSONValue[]=[],items:postgres.JSONValue[]=[])=>db.query('select public.save_menu_session($1,$2,$3::jsonb,$4::jsonb) revision',[id,revision,photos,items]);
      assert.equal((await write(0)).rows[0].revision,1);
      assert.equal((await write(0)).rows[0].revision,1);
      assert.equal((await write(1,[{id:'page'}])).rows[0].revision,2);
      await assert.rejects(write(0));await assert.rejects(write(2,Array.from({length:6},()=>({}))));
      await as(b);assert.equal((await db.query('select * from public.menu_sessions where id=$1',[id])).rows.length,0);
      await assert.rejects(write(0));await assert.rejects(db.query('update public.menu_sessions set revision=10 where id=$1',[id]),{code:'42501'});
      await as(null);await assert.rejects(write(0),{code:'42501'});
      await as(a);
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
    await t.test('note save validates catalog, keeps the same experience and replays a lost response safely', async () => {
      const record=await saved(40,{enteredName:'Synthetic tasting whisky',category:'whisky'});
      const answers=[{questionId:'nose',status:'answered',descriptorCodes:['fruit'],intensity:null,freeText:null}];
      const saveNote=(op:string, expected:number, input:unknown,note='과일 향이 떠올랐어요.')=>db.query<{result:Saved}>("select public.save_tasting_note($1::uuid,$2::uuid,$3,'light',2,$4::jsonb,$5,false) result",[record.recordId,op,expected,input as JsonObject,note]);
      const before=(await db.query('select count(*) n from public.tasting_records')).rows[0].n;
      const first=(await saveNote(operation(41),record.revision,answers)).rows[0].result;
      assert.equal(first.recordId,record.recordId);assert.equal(first.replayed,false);
      const retry=(await saveNote(operation(41),record.revision,answers)).rows[0].result;
      assert.equal(retry.replayed,true);assert.equal(retry.revision,first.revision);
      assert.equal((await db.query('select count(*) n from public.tasting_records')).rows[0].n,before);
      const repeat=await saved(45,{enteredName:'Synthetic tasting whisky',category:'whisky',revisit:'okay'},record.cellarEntryId);
      assert.notEqual(repeat.recordId,record.recordId);
      assert.equal(repeat.cellarEntryId,record.cellarEntryId);
      assert.equal((await db.query('select * from public.record_answers where record_id=$1',[repeat.recordId])).rows.length,0);
      assert.equal((await db.query('select * from public.record_notes where record_id=$1',[repeat.recordId])).rows.length,0);
      assert.equal((await saved(45,{enteredName:'Synthetic tasting whisky',category:'whisky',revisit:'okay'},record.cellarEntryId)).recordId,repeat.recordId);

      await assert.rejects(saveNote(operation(41),record.revision,answers,'Changed payload'),{code:'23505'});
      await assert.rejects(saveNote(operation(42),record.revision,answers),{code:'40001'});
      const bad=[{...answers[0],descriptorCodes:['invented_aroma']}];
      await assert.rejects(saveNote(operation(43),first.revision,bad),{code:'23514'});
      const unknown=[{...answers[0],status:'unknown'}];
      await assert.rejects(saveNote(operation(43),first.revision,unknown),{code:'23514'});
      assert.equal((await db.query('select confirmed_note from public.record_notes where record_id=$1',[record.recordId])).rows[0].confirmed_note,'과일 향이 떠올랐어요.');
      await code("update public.record_notes set confirmed_note='bypass' where record_id=$1",[record.recordId],'42501');
      await code("delete from public.record_answers where record_id=$1",[record.recordId],'42501');
      await as(b);
      await assert.rejects(saveNote(operation(44),first.revision,answers),{code:'42501'});
      await as(a);
    });
    await t.test('user B cannot read A rows, photos, or the security-invoker overview', async () => {
      await as(b);
      for (const table of ['cellar_entries','tasting_records','record_photos','record_notes','record_answers','record_drafts','user_settings','profiles','photo_deletion_jobs','deleted_record_operations','cellar_overview']) {
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
      await code("insert into public.record_notes(record_id,mode,catalog_version) values ($1,'deep',1)", [first.recordId], '42501');
      await code("insert into public.record_answers(record_id,mode,catalog_version,question_id) values ($1,'light',1,'aroma')", [first.recordId], '42501');
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
      // Managed Supabase blocks direct SQL deletion; real deletion is covered by Storage HTTP tests.
      if (!databaseUrl) assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(b, 12)])).rows.length, 1);
      await as(a);
      if (!databaseUrl) assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(a, 1)])).rows.length, 0);
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
    await t.test('cellar photos skip missing representatives and fallback photos without losing the preference', async () => {
      await as(a);
      await uploadMetadata(a,500); await uploadMetadata(a,501);
      const older=await saved(500,{enteredName:'Photo availability fixture',consumedAt:'2026-01-01T12:00:00Z',photo:photo(a,500)});
      await saved(501,{consumedAt:'2026-01-02T12:00:00Z',photo:photo(a,501)},older.cellarEntryId);
      const representative=String((await db.query('select id from public.record_photos where record_id=$1',[older.recordId])).rows[0].id);
      await db.query('update public.cellar_entries set representative_photo_id=$1 where id=$2',[representative,older.cellarEntryId]);
      const overview=async()=> (await db.query('select photo_path,record_count from public.cellar_overview where id=$1',[older.cellarEntryId])).rows[0];
      assert.equal((await overview()).photo_path,path(a,500));
      await db.query("update public.record_photos set upload_status='missing' where id=$1",[representative]);
      assert.equal((await overview()).photo_path,path(a,501));
      assert.equal((await db.query('select representative_photo_id from public.cellar_entries where id=$1',[older.cellarEntryId])).rows[0].representative_photo_id,representative);
      await db.query("update public.record_photos set upload_status='missing' where storage_path=$1",[path(a,501)]);
      assert.equal((await overview()).photo_path,null);
      assert.equal(Number((await overview()).record_count),2);
      await db.query("update public.record_photos set upload_status='ready' where id=$1",[representative]);
      assert.equal((await overview()).photo_path,path(a,500));
      await db.query('update public.cellar_entries set representative_photo_id=null where id=$1',[older.cellarEntryId]);
      assert.equal((await overview()).photo_path,path(a,500));
      await as(b);
      assert.equal((await db.query('select id from public.cellar_overview where id=$1',[older.cellarEntryId])).rows.length,0);
      await as(a);
    });
    await t.test('deleting a representative photo clears its reference and queues binary cleanup', async () => {
      const photoId = String((await db.query('select id from public.record_photos where record_id=$1', [first.recordId])).rows[0].id);
      await db.query('update public.cellar_entries set representative_photo_id=$1 where id=$2', [photoId, second.cellarEntryId]);
      await db.query('delete from public.record_photos where id=$1', [photoId]);
      assert.equal((await db.query('select representative_photo_id from public.cellar_entries where id=$1', [second.cellarEntryId])).rows[0].representative_photo_id, null);
      assert.equal((await db.query('select status from public.photo_deletion_jobs where storage_path=$1', [path(a, 1)])).rows[0].status, 'pending');
      if (!databaseUrl) assert.equal((await db.query('delete from storage.objects where name=$1 returning id', [path(a, 1)])).rows.length, 1);
    });
    await t.test('basic edits sync a single entry label and deletion queues a private photo without touching other dates', async () => {
      await uploadMetadata(a,70);
      const record=await saved(70,{enteredName:'Before edit',category:'whisky',photo:photo(a,70)});
      const row=(await db.query<{result:{revision:number}}>('select to_jsonb(public.edit_tasting_record($1,$2,$3::jsonb)) result',[record.recordId,record.revision,{enteredName:'After edit',rating:3}])).rows[0].result;
      assert.equal((await db.query('select display_name from public.cellar_entries where id=$1',[record.cellarEntryId])).rows[0].display_name,'After edit');
      await assert.rejects(db.query('select public.edit_tasting_record($1,$2,$3::jsonb)',[record.recordId,record.revision,{rating:2}]),{code:'40001'});
      const another=await saved(71,{enteredName:'Another date',category:'whisky'},record.cellarEntryId);
      const updated=(await db.query<{result:{revision:number}}>('select to_jsonb(public.edit_tasting_record($1,$2,$3::jsonb)) result',[record.recordId,row.revision,{enteredName:'This date only'}])).rows[0].result;
      assert.equal((await db.query('select display_name from public.cellar_entries where id=$1',[record.cellarEntryId])).rows[0].display_name,'After edit');
      await as(b);
      await assert.rejects(db.query('select public.edit_tasting_record($1,$2,$3::jsonb)',[record.recordId,updated.revision,{rating:1}]),{code:'42501'});
      assert.equal((await db.query('delete from public.tasting_records where id=$1 returning id',[record.recordId])).rows.length,0);
      await as(a);
      assert.equal((await db.query('delete from public.tasting_records where id=$1 and revision=$2 returning id',[record.recordId,row.revision])).rows.length,0);
      assert.equal((await db.query('delete from public.tasting_records where id=$1 and revision=$2 returning id',[record.recordId,updated.revision])).rows.length,1);
      assert.equal((await db.query('select id from public.tasting_records where id=$1',[another.recordId])).rows.length,1);
      await assert.rejects(saved(70,{enteredName:'Before edit',category:'whisky',photo:photo(a,70)}),{code:'P0002'});
      const job=(await db.query('select id from public.photo_deletion_jobs where storage_path=$1',[path(a,70)])).rows[0];
      assert.equal((await db.query('select public.complete_photo_deletion($1) result',[Number(job.id)])).rows[0].result,false);
      await as(b);await assert.rejects(db.query('select public.complete_photo_deletion($1)',[Number(job.id)]),{code:'42501'});await as(a);
      if(!databaseUrl){await db.query('delete from storage.objects where name=$1',[path(a,70)]);assert.equal((await db.query('select public.complete_photo_deletion($1) result',[Number(job.id)])).rows[0].result,true);}
    });
    await t.test('photo replacement and explicit regrouping are atomic, owner-scoped and replay safely', async () => {
      await as(a); await uploadMetadata(a,90); await uploadMetadata(a,91);
      const source=await saved(90,{enteredName:'Source',category:'whisky',rating:4,photo:photo(a,90)});
      const other=await saved(92,{enteredName:'Target',category:'whisky'});
      const rev=async()=>Number((await db.query('select revision from public.tasting_records where id=$1',[source.recordId])).rows[0].revision);
      const change=async(n:number,revision:number,input:JsonObject)=> (await db.query<{result:Saved}>('select public.change_record_attachment($1,$2,$3,$4::jsonb) result',[source.recordId,operation(n),revision,input])).rows[0].result;
      const before=(await db.query('select entered_name,category,consumed_at,rating from public.tasting_records where id=$1',[source.recordId])).rows[0];
      const initial=await rev(); const replacement={kind:'photo',...photo(a,91)};
      const replaced=await change(91,initial,replacement);
      assert.ok(replaced.revision>initial);
      assert.equal((await change(91,initial,replacement)).replayed,true);
      assert.equal((await db.query('select storage_path from public.record_photos where record_id=$1',[source.recordId])).rows[0].storage_path,path(a,91));
      assert.equal((await db.query('select storage_path from public.photo_deletion_jobs where storage_path=$1',[path(a,90)])).rows.length,1);
      assert.equal((await db.query('select p.storage_path from public.cellar_entries e join public.record_photos p on p.id=e.representative_photo_id where e.id=$1',[source.cellarEntryId])).rows[0].storage_path,path(a,91));
      await assert.rejects(change(91,initial,{kind:'split',name:null}),{code:'23505'});
      await assert.rejects(change(93,initial,{kind:'move',entryId:other.cellarEntryId}),{code:'40001'});
      await assert.rejects(change(93,await rev(),{kind:'photo',...photo(a,99)}));
      assert.equal((await db.query('select storage_path from public.record_photos where record_id=$1',[source.recordId])).rows[0].storage_path,path(a,91));
      await as(b); await assert.rejects(change(93,replaced.revision,{kind:'split',name:null}),{code:'P0002'}); await as(a);
      await assert.rejects(change(93,await rev(),{kind:'move',entryId:foreign.cellarEntryId}),{code:'42501'});
      const moved=await change(93,await rev(),{kind:'move',entryId:other.cellarEntryId});
      assert.equal(moved.cellarEntryId,other.cellarEntryId);
      assert.equal((await db.query('select id from public.cellar_overview where id=$1',[source.cellarEntryId])).rows.length,0);
      assert.equal(Number((await db.query('select record_count from public.cellar_overview where id=$1',[other.cellarEntryId])).rows[0].record_count),2);
      const revision=await rev();const split=await change(94,revision,{kind:'split',name:'Separated'});
      assert.equal((await change(94,revision,{kind:'split',name:'Separated'})).cellarEntryId,split.cellarEntryId);
      assert.notEqual(split.cellarEntryId,other.cellarEntryId);
      assert.deepEqual((await db.query('select entered_name,category,consumed_at,rating from public.tasting_records where id=$1',[source.recordId])).rows[0],before);
      assert.equal((await db.query('select storage_path from public.record_photos where record_id=$1',[source.recordId])).rows[0].storage_path,path(a,91));
      await assert.rejects(db.query('select * from private.record_attachment_receipts'),{code:'42501'});
    });
    await t.test('taste context is owner-scoped; only server leases can publish and stale results disappear',async()=>{
      await as(a);const source=await saved(110,{enteredName:'Summary source',category:'whisky',revisit:'again'});
      const context=async()=> (await db.query<{result:{snapshot:{hash:string;records:{id:string}[]};cached:unknown;stale:boolean}}>('select public.taste_summary_context() result')).rows[0].result;
      const before=await context();assert.ok(before.snapshot.records.some(r=>r.id===source.recordId));
      await as(b);assert.ok(!(await context()).snapshot.records.some(r=>r.id===source.recordId));await as(a);
      await assert.rejects(db.query('select public.begin_taste_summary($1,$2,$3)',[a,before.snapshot.hash,operation(111)]),{code:'42501'});
      await db.exec('reset role');await db.exec('set role service_role');
      const begin=async(lease:number,hash:string)=> (await db.query('select public.begin_taste_summary($1,$2,$3) result',[a,hash,operation(lease)])).rows[0].result;
      assert.equal(await begin(111,before.snapshot.hash),'acquired');assert.equal(await begin(112,before.snapshot.hash),'running');
      const result={version:'taste-v1',selection:{highlightIds:['fixture-fact']},model:'fixture',generatedAt:'2026-10-23'};
      assert.equal((await db.query('select public.finish_taste_summary($1,$2,$3,$4::jsonb) result',[a,before.snapshot.hash,operation(112),result])).rows[0].result,false);
      assert.equal((await db.query('select public.finish_taste_summary($1,$2,$3,$4::jsonb) result',[a,before.snapshot.hash,operation(111),result])).rows[0].result,true);
      await as(a);assert.deepEqual((await context()).cached,result);
      await db.query("select public.update_tasting_record($1,$2,'{\"rating\":2}')",[source.recordId,source.revision]);
      const stale=await context();assert.notEqual(stale.snapshot.hash,before.snapshot.hash);assert.equal(stale.cached,null);assert.equal(stale.stale,true);
      await db.exec('reset role');await db.exec('set role service_role');assert.equal(await begin(113,stale.snapshot.hash),'limited');assert.equal(await begin(113,before.snapshot.hash),'stale');
      await as(a);await assert.rejects(db.query('select * from private.taste_summary_jobs'),{code:'42501'});
      await as(null);await assert.rejects(db.query('select public.taste_summary_context()'),{code:'42501'});await as(a);
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
    await t.test('legacy answer fixtures preserve unknown, skipped, none and an answered zero separately', async () => {
      await db.exec('reset role');
      await db.query("insert into public.record_notes(record_id,mode,catalog_version) values ($1,'deep',1)", [second.recordId]);
      for (const [mode, status, question, intensity] of [
        ['light','unknown','aroma',null], ['deep','none','peat',null], ['deep','skipped','color',null], ['deep','answered','alcohol',0],
      ]) await db.query('insert into public.record_answers(record_id,mode,catalog_version,question_id,status,intensity) values ($1,$2,1,$3,$4,$5)', [second.recordId, String(mode), String(question), String(status), intensity as number | null]);
      const answers = (await db.query('select status,intensity from public.record_answers where record_id=$1', [second.recordId])).rows;
      assert.equal(answers.length, 4); assert.ok(answers.some(row => row.status === 'answered' && row.intensity === 0));
      await code("insert into public.record_answers(record_id,mode,catalog_version,question_id,status,intensity) values ($1,'deep',1,'invalid','unknown',0)", [second.recordId], '23514');
      assert.equal(Number((await db.query('select input_revision from public.record_notes where record_id=$1', [second.recordId])).rows[0].input_revision), 5);
      await as(a);
      await code("update public.record_notes set generated_draft='forged AI' where record_id=$1", [second.recordId], '42501');
    });
    await t.test('drafts and last-used mode are owner-scoped and do not change an existing note mode', async () => {
      await db.query("insert into public.user_settings(last_note_mode) values ('light') on conflict(user_id) do update set last_note_mode='light'");
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
          const result = await tx.unsafe('select public.create_tasting_record($1,$2::jsonb) as result', [operation(100), tx.json({ enteredName: 'Concurrent synthetic record' })]);
          return result[0].result as Saved;
        });
        const results = await Promise.all([run(), run()]);
        assert.equal(new Set(results.map(result => result.recordId)).size, 1);
        assert.equal(results.filter(result => result.replayed).length, 1);
        await as(a);
        assert.equal((await db.query('select * from public.tasting_records where operation_id=$1', [operation(100)])).rows.length, 1);
      } finally { await sql.end(); }
    });
    await t.test('deletion receipts do not block account deletion cascades',async()=>{
      const owner='10000000-0000-4000-8000-000000000003';
      await db.exec('reset role');await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'cascade@example.test']);
      await as(owner);const record=await saved(80,{enteredName:'Cascade fixture'});
      await db.exec('reset role');await db.query('delete from auth.users where id=$1',[owner]);
      assert.equal((await db.query('select id from public.tasting_records where id=$1',[record.recordId])).rows.length,0);
      assert.equal((await db.query('select * from public.deleted_record_operations where user_id=$1',[owner])).rows.length,0);
      await as(a);
    });
    await t.test('account deletion freezes writes, isolates receipts, requires binary cleanup, and recovers a lost final response', async () => {
      const owner='10000000-0000-4000-8000-000000000504',hash='a'.repeat(64),lease=operation(504);
      await db.exec('reset role');await db.query('insert into auth.users(id,email) values($1,$2)',[owner,'account-delete@example.test']);
      await as(owner);if(!databaseUrl)await uploadMetadata(owner,504);const record=await saved(504,{enteredName:'Delete only this synthetic account',...(!databaseUrl?{photo:photo(owner,504)}:{})});
      await code('select public.begin_account_deletion($1,$2,$3)',[owner,hash,lease],'42501');
      await code('select * from private.account_deletions',[],'42501');
      const service=async()=>{await as(null);await db.exec('reset role;set role service_role');};
      await service();assert.equal((await db.query('select public.begin_account_deletion($1,$2,$3) result',[owner,hash,lease])).rows[0].result,true);
      assert.equal((await db.query('select public.begin_account_deletion($1,$2,$3) result',[owner,hash,operation(505)])).rows[0].result,false);
      await as(owner);assert.equal((await db.query('select public.account_deletion_status() result')).rows[0].result,'pending');
      await code("select public.create_tasting_record($1,$2::jsonb)",[operation(505),{enteredName:'late write'}],'42501');
      await code('insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)',['record-photos',path(owner,505),owner],'42501');
      await as(b);assert.equal((await db.query('select public.account_deletion_status() result')).rows[0].result,null);
      await service();
      if(!databaseUrl){
        assert.equal(((await db.query('select public.account_deletion_files($1,$2) result',[owner,lease])).rows[0].result as string[])[0],path(owner,504));
        await assert.rejects(db.query('select public.purge_account_data($1,$2)',[owner,lease]),/PHOTOS_REMAIN/);
        await db.exec('reset role');await db.query('delete from storage.objects where bucket_id=$1 and name=$2',['record-photos',path(owner,504)]);
      }else assert.deepEqual((await db.query('select public.account_deletion_files($1,$2) result',[owner,lease])).rows[0].result,[]);
      await service();await db.query('select public.purge_account_data($1,$2)',[owner,lease]);
      await db.exec('reset role');await db.query('delete from auth.users where id=$1',[owner]);
      await service();assert.equal((await db.query('select public.completed_account_deletion($1) result',[hash])).rows[0].result,true);
      assert.equal((await db.query('select public.completed_account_deletion($1) result',['b'.repeat(64)])).rows[0].result,false);
      await db.exec('reset role');assert.equal((await db.query('select id from public.tasting_records where id=$1',[record.recordId])).rows.length,0);
      assert.equal((await db.query('select id from public.photo_deletion_jobs where user_id=$1',[owner])).rows.length,0);
      await as(a);
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
