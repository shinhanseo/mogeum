import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { observeSession, type SessionState } from '../src/features/auth/session';

function harness() {
  let callback: (event: string, session: Session | null) => void = () => {};
  let resolve!: (result: { data: { session: Session | null }; error: null }) => void;
  let unsubscribed = false;
  const pending = new Promise<{ data: { session: Session | null }; error: null }>(r => { resolve = r; });
  const client = { auth: {
    onAuthStateChange(fn: typeof callback) { callback = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
    getSession() { return pending; },
  } } as unknown as SupabaseClient;
  const states: SessionState[] = [];
  const stop = observeSession(client, value => states.push(value));
  return { states, stop, resolve, event: (session: Session | null) => callback('SIGNED_OUT', session), unsubscribed: () => unsubscribed };
}
const session = { user: { id: 'synthetic' } } as Session;
const flush = () => new Promise(resolve => setImmediate(resolve));

test('late session restoration cannot resurrect an account after sign-out', async () => {
  const h = harness();
  h.event(null); h.resolve({ data: { session }, error: null }); await flush();
  assert.deepEqual(h.states, [{ status: 'loading' }, { status: 'signed-out' }]); h.stop();
});
test('unmounted subscriber ignores in-flight restoration and unsubscribes', async () => {
  const h = harness(); h.stop(); h.resolve({ data: { session }, error: null }); await flush();
  assert.deepEqual(h.states, [{ status: 'loading' }]); assert.equal(h.unsubscribed(), true);
});
test('initial saved session is restored when no newer event exists', async () => {
  const h = harness(); h.resolve({ data: { session }, error: null }); await flush();
  assert.equal(h.states.at(-1)?.status, 'signed-in'); h.stop();
});
