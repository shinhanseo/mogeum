import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeAroma, changeAroma, emptyAroma } from '../src/features/tasting/aroma';

const catalog = { fruit: ['apple', 'citrus'], wood: ['oak', 'nuts'] };
test('removing a family excludes its detail from generation but selecting again restores the draft', () => {
  let draft = changeAroma(emptyAroma(), { type: 'family', code: 'fruit' }, catalog);
  draft = changeAroma(draft, { type: 'detail', family: 'fruit', code: 'apple' }, catalog);
  draft = changeAroma(draft, { type: 'family', code: 'fruit' }, catalog);
  assert.deepEqual(activeAroma(draft, catalog).details, {});
  assert.equal(activeAroma(draft, catalog).status, 'unanswered');
  draft = changeAroma(draft, { type: 'family', code: 'fruit' }, catalog);
  assert.deepEqual(activeAroma(draft, catalog).details, { fruit: ['apple'] });
});
test('family-only observations never invent details and multiple groups use catalog order', () => {
  let draft = changeAroma(emptyAroma(), { type: 'family', code: 'wood' }, catalog);
  draft = changeAroma(draft, { type: 'family', code: 'fruit' }, catalog);
  assert.deepEqual(activeAroma(draft, catalog).families, ['fruit', 'wood']);
  assert.deepEqual(activeAroma(draft, catalog).details, { fruit: [], wood: [] });
});
test('unknown identity excludes actual observations but retains independent clarity', () => {
  let draft = changeAroma(emptyAroma(), { type: 'text', value: 'my own aroma' }, catalog);
  draft = changeAroma(draft, { type: 'clarity', value: 'clear' }, catalog);
  draft = changeAroma(draft, { type: 'unknown' }, catalog);
  assert.deepEqual(activeAroma(draft, catalog), { status: 'unknown', families: [], details: {}, freeText: '', clarity: 'clear' });
  draft = changeAroma(draft, { type: 'text', value: '  new observation  ' }, catalog);
  assert.equal(activeAroma(draft, catalog).status, 'answered');
  assert.equal(activeAroma(draft, catalog).freeText, 'new observation');
});
test('foreign or inactive descriptors cannot enter an answer', () => {
  assert.throws(() => changeAroma(emptyAroma(), { type: 'family', code: 'other' }, catalog));
  assert.throws(() => changeAroma(emptyAroma(), { type: 'detail', family: 'fruit', code: 'apple' }, catalog));
  const draft = changeAroma(emptyAroma(), { type: 'family', code: 'fruit' }, catalog);
  assert.throws(() => changeAroma(draft, { type: 'detail', family: 'fruit', code: 'oak' }, catalog));
});
