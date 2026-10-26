import assert from 'node:assert/strict';
import test from 'node:test';
import { createMoveTargetPager, emptyMoveTargets, type MoveTarget } from '../src/features/records/move-target-pager';

const rows = (prefix: string, count = 30): MoveTarget[] => Array.from({ length: count }, (_, i) => ({
  id: `${prefix}-${i}`, display_name: prefix, category: 'whisky', record_count: 1,
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('a late previous page cannot append or hide more results after A-B-A search', async () => {
  let state = emptyMoveTargets();
  const old = deferred<MoveTarget[]>();
  const calls: [string, number][] = [];
  const pager = createMoveTargetPager(async (query, from) => {
    calls.push([query, from]);
    return from ? old.promise : rows(query);
  }, value => { state = value; });
  await pager.reset('A');
  const previous = pager.next();
  await pager.reset('B');
  await pager.reset('A');
  old.resolve(rows('stale', 1));
  await previous;
  assert.equal(state.query, 'A');
  assert.deepEqual(state.items, rows('A'));
  assert.equal(state.hasMore, true);
  assert.equal(state.loading, false);
  assert.deepEqual(calls, [['A', 0], ['A', 30], ['B', 0], ['A', 0]]);
});

test('an old page rejection cannot replace the new search loading or error state', async () => {
  let state = emptyMoveTargets();
  const old = deferred<MoveTarget[]>(), current = deferred<MoveTarget[]>();
  const pager = createMoveTargetPager(async (query, from) => query === 'B' ? current.promise : from ? old.promise : rows('A'), value => { state = value; });
  await pager.reset('A');
  const previous = pager.next();
  const latest = pager.reset('B');
  old.reject(new Error('old offline response'));
  await previous;
  assert.equal(state.loading, true);
  assert.equal(state.error, false);
  assert.equal(state.query, 'B');
  current.resolve(rows('B', 1));
  await latest;
  assert.deepEqual(state.items, rows('B', 1));
  assert.equal(state.hasMore, false);
});

test('duplicate next events coalesce, overlapping rows deduplicate, offset follows raw page length', async () => {
  let state = emptyMoveTargets();
  const second = deferred<MoveTarget[]>();
  const offsets: number[] = [];
  const pager = createMoveTargetPager(async (_, from) => {
    offsets.push(from);
    return from === 0 ? rows('A') : from === 30 ? second.promise : [];
  }, value => { state = value; });
  await pager.reset('A');
  const page = pager.next();
  await pager.next();
  second.resolve([...rows('A', 1), ...rows('B', 29)]);
  await page;
  assert.equal(state.items.length, 59);
  await pager.next();
  assert.deepEqual(offsets, [0, 30, 60]);
  assert.equal(state.hasMore, false);
});

test('cancel suppresses failure; reset retries failed searches', async () => {
  const pending = deferred<MoveTarget[]>();
  let publishes = 0, fail = false, state = emptyMoveTargets();
  const pager = createMoveTargetPager(async query => {
    if (query === 'pending') return pending.promise;
    if (fail) throw new Error('offline');
    return rows(query, 1);
  }, value => { publishes++; state = value; });
  const first = pager.reset('pending');
  pager.cancel();
  const before = publishes;
  pending.reject(new Error('after unmount'));
  await first;
  assert.equal(publishes, before);
  fail = true;
  await pager.reset('retry');
  assert.equal(state.error, true);
  await pager.next();
  assert.equal(state.error, true);
  fail = false;
  await pager.reset('retry');
  assert.equal(state.error, false);
  assert.deepEqual(state.items, rows('retry', 1));
});

test('cancel suppresses a pending first-page success and blocks next before a new search starts', async () => {
  const pending = deferred<MoveTarget[]>();
  let calls = 0, publishes = 0;
  const pager = createMoveTargetPager(async () => { calls++; return pending.promise; }, () => { publishes++; });
  const request = pager.reset('A');
  pager.cancel();
  const before = publishes;
  await pager.next();
  pending.resolve(rows('A'));
  await request;
  assert.equal(publishes, before);
  assert.equal(calls, 1);
});
