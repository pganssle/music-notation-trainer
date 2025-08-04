QUnit.module('Note Logic');

QUnit.test('getNoteRange', function(assert) {
  const range1 = getNoteRange('C4', 'E4');
  assert.deepEqual(range1, ['C4', 'C#4', 'D4', 'D#4', 'E4'], 'Simple range');

  const range2 = getNoteRange('A3', 'C4');
  assert.deepEqual(range2, ['A3', 'A#3', 'B3', 'C4'], 'Range over octave');
});

QUnit.test('getScoreForTime', function(assert) {
  assert.equal(getScoreForTime(10), 1, 'Under 30s');
  assert.equal(getScoreForTime(35), 0.9, '30-45s');
  assert.equal(getScoreForTime(50), 0.8, '45-60s');
  assert.equal(getScoreForTime(70), 0.7, '60-90s');
  assert.equal(getScoreForTime(100), 0.5, 'Over 90s');
});
