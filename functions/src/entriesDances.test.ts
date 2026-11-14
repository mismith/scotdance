import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { entriesDances } from './entriesDances';

test('legacy dances retain name and step deduplication', () => {
  assert.deepEqual(entriesDances([
    { name: ' Highland Fling ', steps: '4' },
    { name: 'Highland fling', steps: '4' },
    { name: 'Highland Fling', steps: '6' },
  ]), [
    { name: 'Highland Fling', steps: '4', _order: 0 },
    { name: 'Highland Fling', steps: '6', _order: 1 },
  ]);
});

test('ordinary and trophy occurrences of the same dance stay separate', () => {
  const dances = entriesDances([
    { occurrenceId: 'beginner-fling', canonicalDanceId: 'fling', name: 'Highland Fling', steps: '4' },
    { occurrenceId: 'trophy-fling', canonicalDanceId: 'fling', name: 'Highland Fling', steps: '4' },
  ]);
  assert.equal(dances.length, 2);
  assert.equal(dances[1].entriesOccurrenceId, 'trophy-fling');
  assert.equal(dances[1].entriesCanonicalDanceId, 'fling');
  assert.equal(dances[1]._order, 1);
});

test('structured payloads reject duplicate, malformed and mixed occurrence identities', () => {
  const dance = { occurrenceId: 'fling', name: 'Fling' };
  assert.throws(() => entriesDances([dance, dance]), /more than once/);
  assert.throws(() => entriesDances([dance, { name: 'Sword' }]), /occurrence ID/);
  assert.throws(() => entriesDances([{ ...dance, occurrenceId: '../private' }]), /occurrence ID/);
  assert.throws(() => entriesDances([{ ...dance, canonicalDanceId: {} }]), /occurrence ID/);
  assert.throws(() => entriesDances([{ ...dance, steps: Number.NaN }]), /valid steps/);
  assert.throws(() => entriesDances([]), /between one/);
  assert.throws(() => entriesDances(Array.from({ length: 201 }, () => dance)), /between one/);
});
