import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shelfRows } from '../src/features/cellar/model';

test('초기 0/1/2개에서 빈 슬롯을 유지하고 왼쪽부터 채운다', () => {
  assert.deepEqual(shelfRows([]), [[null, null, null], [null, null, null]]);
  assert.deepEqual(shelfRows(['a']), [['a', null, null], [null, null, null]]);
  assert.deepEqual(shelfRows(['a', 'b']), [['a', 'b', null], [null, null, null]]);
});
test('다음 선반으로 넘길 때 중복하거나 원본을 변경하지 않는다', () => {
  const input = Object.freeze(Array.from({ length: 1000 }, (_, index) => index));
  const rows = shelfRows(input);
  assert.equal(rows.length, 334);
  assert.deepEqual(rows[333], [999, null, null]);
  assert.deepEqual(rows.flat().filter(value => value !== null), input);
});
