import assert from 'node:assert/strict';
import test from 'node:test';
import { withModelReadiness } from '../src/features/cutout/model-readiness';
const pending = () => new Error('ML Kit subject segmentation failed: Waiting for the subject segmentation optional module to be downloaded. Please wait.');
test('Android first-use readiness retries serially and returns the actual native result', async () => {
  let calls = 0, active = 0;
  const waits: number[] = [];
  const output = { uri: 'file:///native-result.png' };
  const actual = await withModelReadiness(async () => {
    assert.equal(active++, 0);
    await Promise.resolve(); active--;
    if (++calls < 3) throw pending();
    return output;
  }, true, async ms => { waits.push(ms); });
  assert.equal(actual, output); assert.equal(calls, 3); assert.deepEqual(waits, [3000, 3000]);
});
test('model waiting has a finite budget and unrelated failures or iOS are never retried', async () => {
  let calls = 0, waits = 0;
  await assert.rejects(withModelReadiness(async () => { calls++; throw pending(); }, true, async () => { waits++; }), /optional module/);
  assert.equal(calls, 5); assert.equal(waits, 4);
  for (const [android, error] of [[false, pending()], [true, new Error('INVALID_IMAGE')], [true, new Error('CUTOUT_UNAVAILABLE')]] as const) {
    calls = 0;
    await assert.rejects(withModelReadiness(async () => { calls++; throw error; }, android, async () => { throw new Error('unexpected wait'); }), candidate => candidate === error);
    assert.equal(calls, 1);
  }
});
