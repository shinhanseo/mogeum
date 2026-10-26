import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { betaMetricsSql, metricsDatabase, metricsInput, metricsReport } from '../src/lib/beta-metrics';

const a = '10000000-0000-4000-8000-000000000001';
const b = '10000000-0000-4000-8000-000000000002';
const foreign = '10000000-0000-4000-8000-000000000003';
const edge = '10000000-0000-4000-8000-000000000004';
const missing = '10000000-0000-4000-8000-000000000005';
const id = (prefix: number, n: number) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const start = '2026-10-01T00:00:00Z', end = '2026-10-02T00:00:00Z';

test('metrics only accepts explicit UTC periods, bounded UUID cohorts and registered database targets', () => {
  assert.deepEqual(metricsInput(start, end, [a, a.toUpperCase()]).cohort, [a]);
  for (const period of [['2026-02-31T00:00:00Z', end], [end, start], ['2026-10-01', end], ['2026-10-01T09:00:00+09:00', end]]) assert.throws(() => metricsInput(period[0], period[1], [a]));
  for (const cohort of [[], ['email@example.test'], [null], Array(1001).fill(a), {}]) assert.throws(() => metricsInput(start, end, cohort));
  assert.equal(metricsDatabase('local', 'postgres://postgres@127.0.0.1:54322/postgres').remote, false);
  assert.equal(metricsDatabase('development', 'postgres://postgres@db.vsckzjfgzdpzkzuumldf.supabase.co/postgres').remote, true);
  for (const [target, url] of [
    ['local', 'postgres://postgres@127.0.0.1:5432/postgres'],
    ['local', 'postgres://postgres@db.vsckzjfgzdpzkzuumldf.supabase.co/postgres'],
    ['development', 'postgres://postgres@db.other.supabase.co/postgres'],
    ['development', 'postgres://postgres@db.vsckzjfgzdpzkzuumldf.supabase.co.evil.test/postgres'],
    ['development', 'postgres://postgres@db.vsckzjfgzdpzkzuumldf.supabase.co/postgres?sslmode=disable'],
    ['production', 'postgres://postgres@127.0.0.1:54322/postgres'],
  ]) assert.throws(() => metricsDatabase(target, url));
});

test('read-only aggregate respects cohort, retained records, confirmation revisions and half-open periods without source rows', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(await readFile(new URL('./fixtures/supabase-platform.sql', import.meta.url), 'utf8'));
    const dir = new URL('../supabase/migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, dir), 'utf8'));
    // Managed Auth has this platform column; add it only to this isolated platform fixture.
    await db.exec('alter table auth.users add column created_at timestamptz');
    for (const [owner, created] of [[a, '2026-09-01T00:00:00Z'], [b, start], [foreign, start], [edge, end]]) {
      await db.query('insert into auth.users(id,email,created_at) values ($1,$2,$3)', [owner, 'PRIVATE_EMAIL_CANARY@example.test', created]);
      await db.query('insert into public.cellar_entries(id,user_id,display_name) values ($1,$2,$3)', [owner, owner, 'PRIVATE_NAME_CANARY']);
    }
    const records = [[a, start], [a, '2026-10-01T12:00:00Z'], [b, '2026-10-01T23:59:59.999Z'], [b, end], [b, '2026-09-30T23:59:59.999Z'], [foreign, start]];
    for (const [n, [owner, created]] of records.entries()) await db.query('insert into public.tasting_records(id,user_id,cellar_entry_id,operation_id,created_at,consumed_at) values($1,$2,$2,$3,$4,$5)', [id(2, n), owner, id(3, n), created, '2000-01-01T00:00:00Z']);
    for (const [n, input, confirmed] of [[0, 1, 1], [1, 2, 1]]) await db.query("insert into public.record_notes(record_id,user_id,mode,catalog_version,input_revision,confirmed_input_revision,confirmed_note) values($1,$2,'light',2,$3,$4,$5)", [id(2, n), a, input, confirmed, 'PRIVATE_NOTE_CANARY']);
    await db.query("insert into public.record_notes(record_id,user_id,mode,catalog_version,confirmed_input_revision,confirmed_note) values($1,$2,'light',2,1,$3)", [id(2, 2), b, ' \n\t ']);
    for (const [owner, status, generated] of [[a, 'ready', start], [b, 'failed', start], [edge, 'ready', end], [foreign, 'ready', start]]) await db.query('insert into private.taste_summary_jobs(user_id,input_hash,status,generated_at,result) values($1,$2,$3,$4,$5::jsonb)', [owner, 'hash', status, generated, '{"private":"SUMMARY_CANARY"}']);
    for (const [n, owner, updated] of [[0, a, start], [1, b, end], [2, foreign, start]]) await db.query('insert into public.menu_sessions(id,user_id,updated_at,items) values($1,$2,$3,$4::jsonb)', [id(4, Number(n)), owner, updated, '[{"private":"MENU_CANARY"}]']);
    const input = metricsInput(start, end, [a, b, edge, missing]);
    await db.exec('begin read only');
    const result = await db.query<Record<string, unknown>>(betaMetricsSql, [input.start, input.end, input.cohort]);
    const report = metricsReport(input, { ...result.rows[0], ignoredSource: 'PRIVATE_EXTRA_CANARY' });
    assert.deepEqual(report.counts, {
      existing_cohort_accounts: 3, accounts_created_in_period: 1,
      retained_records_created_in_period: 3, users_with_retained_records_created_in_period: 2,
      period_records_with_current_confirmed_note: 1, users_with_retained_ready_summary_generated_in_period: 1,
      retained_menu_sessions_last_saved_in_period: 1,
    });
    assert.equal(report.requestedCohortSize, 4);
    assert.ok(Object.values(report.unmeasured).every(value => value === null));
    const output = JSON.stringify(report);
    for (const value of ['CANARY', a, b, foreign, edge, missing, 'email', 'storage_path']) assert.ok(!output.includes(value));
    await assert.rejects(db.exec("insert into auth.users(id) values (gen_random_uuid())"), { code: '25006' });
    await db.exec('rollback');
    assert.equal((await db.query<{ count: number }>('select count(*)::int count from public.tasting_records')).rows[0].count, 6);
  } finally { await db.close(); }
});

test('malformed or unsafe aggregate values never become successful metrics', () => {
  const input = metricsInput(start, end, [a]);
  assert.throws(() => metricsReport(input, {}));
  assert.throws(() => metricsReport(input, { existing_cohort_accounts: '-1' }));
  assert.throws(() => metricsReport(input, { existing_cohort_accounts: '9007199254740992' }));
});

test('the real CLI redacts parse errors, paths and connection credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'PRIVATE_PATH_CANARY-'));
  try {
    const file = join(dir, 'cohort.json');
    await writeFile(file, '{"private":"PRIVATE_COHORT_CANARY",');
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/beta-metrics.ts', 'local', start, end, file], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 15000,
      env: { ...process.env, MOGEUM_METRICS_DATABASE_URL: 'postgres://private-user:PRIVATE_PASSWORD_CANARY@127.0.0.1:54322/postgres' },
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.deepEqual(JSON.parse(result.stderr), { error: 'METRICS_QUERY_FAILED' });
    assert.ok(!result.stderr.includes('CANARY'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
