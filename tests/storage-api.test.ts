import { submitPending, type PendingRecord } from '../src/features/records/pending';
import { createClient } from '@supabase/supabase-js';
import { createRecordRepository } from '../src/features/records/repository';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { test } from 'node:test';

// This test needs the disposable CLI stack. It never accepts a cloud API URL or service key.
test('real Auth JWT → private photo → record RPC → scoped read → binary deletion', {
  skip: process.env.MOGEUM_TEST_SUPABASE_HTTP !== '1' ? 'Needs local Supabase HTTP services (CI)' : false,
  timeout: 60000,
}, async () => {
  const status = JSON.parse(execFileSync(resolve('node_modules/.bin/supabase'), ['status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })) as { API_URL?: string; ANON_KEY?: string };
  assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Only the disposable loopback CLI stack is allowed');
  assert.equal(typeof status.ANON_KEY, 'string');
  const apiKey = status.ANON_KEY!;
  const base = status.API_URL!;
  const request = (path: string, token?: string, init: RequestInit = {}) => fetch(base + path, {
    ...init, signal: AbortSignal.timeout(10000),
    headers: { apikey: apiKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const json = async <T>(response: Response, step: string): Promise<T> => {
    assert.ok(response.ok, `${step}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  };
  const signup = async () => {
    const result = await json<{ access_token: string; user: { id: string } }>(await request('/auth/v1/signup', undefined, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `mogeum-${randomUUID()}@example.test`, password: randomUUID() + 'Aa1!' }),
    }), 'Synthetic signup');
    assert.equal(typeof result.access_token, 'string', 'Local email confirmation must be disabled');
    assert.equal(typeof result.user.id, 'string');
    return { token: result.access_token, id: result.user.id };
  };
  const a = await signup(); const b = await signup();
  const operationId = randomUUID(); const storagePath = `${a.id}/records/${operationId}/${randomUUID()}.png`;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=', 'base64');
  await json(await request(`/storage/v1/object/record-photos/${storagePath}`, a.token, {
    method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' }, body: png,
  }), 'Photo upload');
  assert.ok(!(await request(`/storage/v1/object/authenticated/record-photos/${storagePath}`, b.token)).ok, 'B cannot download A photo');
  assert.ok(!(await request(`/storage/v1/object/public/record-photos/${storagePath}`)).ok, 'Private bucket has no public binary URL');
  assert.ok(!(await request(`/storage/v1/object/record-photos/${storagePath}`, b.token, {
    method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: png,
  })).ok, 'B cannot overwrite A photo');
  const payload = { p_operation_id: operationId, p_record: { photo: { storagePath, width: 1, height: 1 } } };
  const create = () => request('/rest/v1/rpc/create_tasting_record', a.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  type Saved = { recordId: string; cellarEntryId: string; replayed: boolean };
  const sdk = createClient(base, apiKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${a.token}` } } });
  const repository = createRecordRepository(sdk);
  let persisted: PendingRecord | null = null;
  const pending: PendingRecord = { version:1, ownerId:a.id, operationId, input:payload.p_record };
  const saved = await submitPending(pending, {
    ownerId:()=>a.id, read:async()=>persisted, write:async value=>{persisted=value;},
    upload:async()=>{}, save:(id,input)=>repository.save(id,input),
  });
  assert.equal((persisted as PendingRecord | null)?.saved?.recordId,saved.recordId);
  const retry = await json<Saved>(await create(), 'Record retry');
  assert.equal(retry.recordId, saved.recordId); assert.equal(retry.replayed, true);
  assert.ok((await repository.listCellar()).some(row => row.id === saved.cellarEntryId));
  assert.ok((await fetch(await repository.photoUrl(storagePath))).ok);
  const ownRows = await json<{ id: string; record_count: number; photo_path: string }[]>(await request(`/rest/v1/cellar_overview?id=eq.${saved.cellarEntryId}`, a.token), 'Own cellar read');
  assert.equal(ownRows.length, 1); assert.equal(Number(ownRows[0].record_count), 1); assert.equal(ownRows[0].photo_path, storagePath);
  const foreignRows = await json<unknown[]>(await request(`/rest/v1/tasting_records?id=eq.${saved.recordId}`, b.token), 'Foreign record read');
  assert.equal(foreignRows.length, 0);
  const signed = await json<{ signedURL: string }>(await request(`/storage/v1/object/sign/record-photos/${storagePath}`, a.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }),
  }), 'Signed photo URL');
  assert.ok(signed.signedURL.startsWith('/object/sign/record-photos/'));
  assert.ok((await request('/storage/v1' + signed.signedURL)).ok, 'Short-lived signed URL serves the binary');
  assert.ok(!(await request(`/storage/v1/object/sign/record-photos/${storagePath}`, b.token, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 60 }),
  })).ok, 'B cannot mint an A signed URL');
  // Some Storage versions return an empty list instead of an error for RLS-filtered deletes.
  await request('/storage/v1/object/record-photos', a.token, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [storagePath] }),
  });
  assert.ok((await request(`/storage/v1/object/authenticated/record-photos/${storagePath}`, a.token)).ok, 'A referenced photo survives a premature file-delete request');
  const deletion = await request(`/rest/v1/tasting_records?id=eq.${saved.recordId}`, a.token, { method: 'DELETE' });
  assert.ok(deletion.ok, `Record delete: HTTP ${deletion.status}`);
  await json(await request('/storage/v1/object/record-photos', a.token, {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [storagePath] }),
  }), 'Unreferenced binary cleanup');
  assert.ok(!(await request(`/storage/v1/object/authenticated/record-photos/${storagePath}`, a.token)).ok, 'Deleted binary is no longer downloadable');
});
