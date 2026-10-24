import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeObservations, newTastingDraft, setAnswer, switchMode } from '../src/features/tasting/draft';

test('none, zero, unknown and skipped remain different; unanswered and skipped are not generation evidence', () => {
  let draft = newTastingDraft('owner', 'same-record', 'wine', 'deep');
  draft = setAnswer(draft, 'sweetness', { status: 'answered', intensity: 0, descriptors: [], freeText: '' });
  draft = setAnswer(draft, 'carbonation', { status: 'none', intensity: null, descriptors: [], freeText: '' });
  draft = setAnswer(draft, 'tannin', { status: 'unknown', intensity: null, descriptors: [], freeText: '' });
  draft = setAnswer(draft, 'finish', { status: 'skipped', intensity: null, descriptors: [], freeText: '' });
  const result = activeObservations(draft);
  assert.equal(result.answers.sweetness.intensity, 0);
  assert.equal(result.answers.carbonation.status, 'none');
  assert.equal(result.answers.tannin.status, 'unknown');
  assert.equal(result.answers.finish, undefined);
  assert.equal(result.recordId, 'same-record');
});
test('mode changes preserve drafts while excluding inactive observations', () => {
  let draft = newTastingDraft('owner', 'record', 'whisky', 'light');
  draft = setAnswer(draft, 'nose', { status: 'answered', intensity: null, descriptors: ['fruit'], freeText: '' });
  draft = switchMode(draft, 'deep');
  assert.deepEqual(activeObservations(draft).answers, {});
  draft = setAnswer(draft, 'nose', { status: 'answered', intensity: null, descriptors: ['citrus'], freeText: '' });
  const restored = switchMode(draft, 'light');
  assert.deepEqual(activeObservations(restored).answers.nose.descriptors, ['fruit']);
  assert.deepEqual(restored.modes.deep.answers.nose.descriptors, ['citrus']);
  assert.equal(restored.recordId, 'record');
});
test('invalid intensities and observations attached to unknown are rejected', () => {
  const draft = newTastingDraft('owner', 'record', 'beer', 'deep');
  for (const intensity of [-1, 6, 0.5, NaN]) assert.throws(() => setAnswer(draft, 'sweetness', { status: 'answered', intensity, descriptors: [], freeText: '' }));
  assert.throws(() => setAnswer(draft, 'nose', { status: 'unknown', intensity: null, descriptors: ['fruit'], freeText: '' }));
});
