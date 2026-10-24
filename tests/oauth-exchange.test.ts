import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exchangeOAuthCode } from '../src/features/auth/exchange';
test('browser and router exchange the same one-use OAuth code only once',async()=>{
  let calls=0;const client={auth:{exchangeCodeForSession:async()=>{calls++;return {error:null};}}} as unknown as SupabaseClient;
  await Promise.all([exchangeOAuthCode(client,'synthetic-code'),exchangeOAuthCode(client,'synthetic-code')]);
  assert.equal(calls,1);
});
test('an unsuccessful one-use code stays failed and does not leak provider details',async()=>{
  let calls=0;const client={auth:{exchangeCodeForSession:async()=>{calls++;return {error:{message:'private-provider-detail'}};}}} as unknown as SupabaseClient;
  await assert.rejects(exchangeOAuthCode(client,'bad-code'),error=>error instanceof Error && !error.message.includes('private-provider-detail'));
  await assert.rejects(exchangeOAuthCode(client,'bad-code'));assert.equal(calls,1);
});
