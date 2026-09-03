'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../rotation-engine.js');
const D = require('../room-data.js');
const host = { uid: 'controller', isController: true };
function roster(count = 8, courts = 1) {
  const s = E.createState(courts);
  for (let i = 0; i < count; i++) E.enrollPlayer(s, 'Player ' + i, 'uid' + i, 'Person ' + i, 'p' + i, i % 2 + 1);
  return s;
}
function self(id) { return { uid: 'uid' + id, playerId: 'p' + id }; }
function pair(s, a = 'p0', b = 'p1') {
  const result = E.partnerAction(s, 'create', a, b, host, 1);
  assert.equal(result.changed, true, result.reason);
  return result.pair;
}
function assertTogether(s, lineup) {
  assert.equal(E.validatePartnerLineup(s, lineup.teamA, lineup.teamB).valid, true);
}

test('schema 11 migration adds no pairs and preserves active, prepared, history and counters', () => {
  const s = roster(12);
  E.assignGame(s, 0, () => .2, 100);
  E.prepareNextGame(s, 0, () => .2, 150);
  s.schemaVersion = 10;
  delete s.partnerships; delete s.partnerRequests; delete s.partnershipRevision;
  const migrated = E.normalizeState(s);
  assert.equal(migrated.schemaVersion, 11);
  assert.deepEqual(migrated.partnerships, []);
  assert.deepEqual(migrated.partnerRequests, []);
  assert.deepEqual(migrated.players, s.players);
  assert.deepEqual(migrated.courtStates, s.courtStates);
  assert.deepEqual(migrated.history, s.history);
  assert.throws(() => E.normalizeState({ schemaVersion: 12 }), /Update App/);
});

test('only linked owner can request and only a controller can approve', () => {
  const s = roster();
  assert.equal(E.partnerAction(s, 'request', 'p0', 'p1', self(2)).changed, false);
  const request = E.partnerAction(s, 'request', 'p0', 'p1', self(0));
  assert.equal(request.changed, true);
  assert.equal(s.partnerships.length, 0);
  assert.equal(E.availableIds(s).length, 8);
  assert.equal(E.partnerAction(s, 'approve', 'p0', request.pair.id, self(0)).changed, false);
  assert.equal(E.partnerAction(s, 'approve', 'p0', request.pair.id, host).changed, true);
  assert.equal(s.partnerRequests.length, 0);
  assert.equal(E.partnerId(s, 'p1'), 'p0');
});

test('self, overlapping, and chained pairings fail without changing state', () => {
  const s = roster();
  assert.equal(E.partnerAction(s, 'request', 'p0', 'p0', self(0)).changed, false);
  const request = E.partnerAction(s, 'request', 'p0', 'p1', self(0));
  const before = E.clone(s);
  assert.equal(E.partnerAction(s, 'create', 'p1', 'p2', host).changed, false);
  assert.equal(E.partnerAction(s, 'request', 'p2', 'p0', self(2)).changed, false);
  assert.deepEqual(s, before);
  E.partnerAction(s, 'approve', 'p0', request.pair.id, host);
  assert.equal(E.partnerAction(s, 'create', 'p1', 'p2', host).changed, false);
});

test('either involved player can cancel; stale approval never approves a later request', () => {
  const s = roster();
  const old = E.partnerAction(s, 'request', 'p0', 'p1', self(0));
  assert.equal(E.partnerAction(s, 'cancel', 'p1', old.pair.id, self(1)).changed, true);
  const next = E.partnerAction(s, 'request', 'p0', 'p1', self(0));
  assert.notEqual(next.pair.id, old.pair.id);
  assert.equal(E.partnerAction(s, 'approve', 'p0', old.pair.id, host).changed, false);
  assert.equal(E.partnerAction(s, 'decline', 'p0', next.pair.id, host).changed, true);
});

test('approval and ending are blocked while either player is active or Up Next', () => {
  const s = roster();
  E.prepareManualNextGame(s, 0, ['p0', 'p1'], ['p2', 'p3']);
  const request = E.partnerAction(s, 'request', 'p0', 'p1', self(0));
  assert.equal(E.partnerAction(s, 'approve', 'p0', request.pair.id, host).changed, false);
  E.clearNextGame(s, 0);
  assert.equal(E.partnerAction(s, 'approve', 'p0', request.pair.id, host).changed, true);
  E.prepareManualNextGame(s, 0, ['p0', 'p1'], ['p2', 'p3']);
  assert.equal(E.partnerAction(s, 'end', 'p0', request.pair.id, self(0)).changed, false);
  E.startNextGame(s, 0);
  assert.equal(E.partnerAction(s, 'end', 'p1', null, self(1)).changed, false);
  E.recordWinner(s, 0, 'A');
  assert.equal(E.partnerAction(s, 'end', 'p1', E.partnerRecord(s, 'p1').id, self(1)).changed, true);
});

test('automatic assignments honor pair+singles and pair+pair even against skill balance', () => {
  for (const allPaired of [false, true]) {
    const s = roster(4); s.matchmakingMode = 'balanced';
    pair(s, 'p0', 'p2');
    if (allPaired) pair(s, 'p1', 'p3');
    const next = E.prepareNextGame(s, 0, () => .5, 100);
    assert.equal(next.changed, true);
    assertTogether(s, next.nextGame);
    assert.equal(s.players.reduce((sum, p) => sum + p.games, 0), 0);
    E.startNextGame(s, 0, 200);
    assert.equal(s.courtStates[0].startedAt, 200);
    assertTogether(s, s.courtStates[0]);
  }
});

test('paired sessions rotate over multiple courts without duplicates or missing singles', () => {
  const s = roster(16, 2); pair(s); pair(s, 'p2', 'p3'); pair(s, 'p4', 'p5');
  for (let i = 0; i < 12; i++) {
    for (let c = 0; c < 2; c++) {
      assert.equal(E.assignGame(s, c, () => .3).changed, true);
      assertTogether(s, s.courtStates[c]);
    }
    assert.equal(new Set(E.activeIds(s)).size, 8);
    for (let c = 0; c < 2; c++) E.recordWinner(s, c, 'A');
  }
  assert.ok(s.players.every(p => p.games > 0));
  assert.ok(Math.max(...s.players.map(p => p.games)) - Math.min(...s.players.map(p => p.games)) <= 1);
  assert.equal(s.players[0].games, s.players[1].games);
});

test('unavailable or checked-out partners wait together and recover on return', () => {
  const s = roster(); pair(s);
  E.setSelfAvailability(s, 'p1', 'uid1', true);
  assert.ok(!E.availableIds(s).includes('p0'));
  assert.equal(E.preparationBreakdown(s, 0).partnerUnavailable, 1);
  E.setSelfAvailability(s, 'p1', 'uid1', false);
  assert.ok(E.availableIds(s).includes('p0'));
  E.checkOutPlayer(s, 'p1', 'uid1');
  assert.ok(!E.availableIds(s).includes('p0'));
  E.checkInPlayer(s, 'p1', 'uid1', 'Person 1', 2);
  assert.ok(E.availableIds(s).includes('p0'));
  assert.equal(E.partnerId(s, 'p0'), 'p1');
});

test('strict courts exclude mixed pairs and give partner-specific shortage reasons', () => {
  const s = roster(6); pair(s);
  s.courtStates[0].skillGroup = 'beginner';
  assert.ok(!E.eligibleIdsForCourt(s, 0).includes('p0'));
  const result = E.prepareNextGame(s, 0);
  assert.equal(result.changed, false);
  assert.equal(result.breakdown.partnerSkillMismatch, 1);
  assert.match(result.reason, /partner ineligible/);
  s.courtStates[0].skillGroup = 'any';
  assert.equal(E.prepareNextGame(s, 0).changed, true);
});

test('candidate cutoff includes high-count partners and deterministic fallback is legal', () => {
  const s = roster(30);
  for (let i = 0; i < 15; i++) pair(s, 'p' + i, 'p' + (i + 15));
  for (let i = 15; i < 30; i++) s.players[i].games = 10;
  for (const assign of [E.chooseAssignment(s, E.availableIds(s), () => .5), E.deterministicFallbackAssignment(s, E.availableIds(s))]) {
    assert.ok(assign);
    assertTogether(s, assign);
  }
  assert.equal(E.chooseAssignment(s, ['p0', 'p1', 'p2', 'p3']), null);
});

test('large locked teammate history never penalizes mandatory teammates', () => {
  const s = roster(4); pair(s);
  const before = E.chooseAssignment(s, E.availableIds(s), () => 0);
  s.teammateCounts[E.pairKey('p0', 'p1')] = 1000;
  const after = E.chooseAssignment(s, E.availableIds(s), () => 0);
  assert.deepEqual(after.score, before.score);
});

test('manual games, replacement and start reject split pairs without changing counters', () => {
  const s = roster(8); pair(s);
  assert.equal(E.prepareManualNextGame(s, 0, ['p0', 'p2'], ['p1', 'p3']).changed, false);
  E.prepareManualNextGame(s, 0, ['p0', 'p1'], ['p2', 'p3']);
  E.startNextGame(s, 0);
  const before = E.clone(s);
  assert.equal(E.replacePlayer(s, 0, 'A', 0, 'p4').changed, false);
  assert.deepEqual(s, before);
  assert.equal(E.replacePlayer(s, 0, 'B', 0, 'p4').changed, true);
  E.recordWinner(s, 0, 'B');
  assert.equal(s.opponentCounts[E.pairKey('p0', 'p4')], 1);
  assert.equal(s.opponentCounts[E.pairKey('p0', 'p2')], undefined);
  E.prepareManualNextGame(s, 0, ['p0', 'p1'], ['p2', 'p3']);
  s.courtStates[0].nextGame.teamA[1] = 'p5';
  const games = s.players.map(p => p.games);
  assert.equal(E.startNextGame(s, 0).changed, false);
  assert.deepEqual(s.players.map(p => p.games), games);
});

test('a fixed pair cannot be drawn into a single-player replacement', () => {
  const s = roster(); pair(s);
  E.prepareManualNextGame(s, 0, ['p2', 'p3'], ['p4', 'p5']); E.startNextGame(s, 0);
  assert.equal(E.replacePlayer(s, 0, 'A', 0, 'p0').changed, false);
  assert.ok(['p6', 'p7'].includes(E.fairReplacement(s, 0)));
});

test('winner auto-preparation, remove and recreate retain partner invariants', () => {
  const s = roster(); pair(s);
  E.assignGame(s, 0, () => .5);
  E.recordWinnerAndPrepareNext(s, 0, 'A', () => .5);
  assert.ok(s.courtStates[0].nextGame); assertTogether(s, s.courtStates[0].nextGame);
  const games = s.players.map(p => p.games);
  E.clearNextGame(s, 0); assert.equal(E.prepareNextGame(s, 0).changed, true);
  assertTogether(s, s.courtStates[0].nextGame);
  assert.deepEqual(s.players.map(p => p.games), games);
});

test('normalization, resets and removal preserve or clear relationships correctly', () => {
  const s = roster(); pair(s);
  E.partnerAction(s, 'request', 'p2', 'p3', self(2));
  E.resetCourts(s); E.resetStatistics(s);
  assert.equal(s.partnerships.length, 1); assert.equal(s.partnerRequests.length, 1);
  assert.deepEqual(E.normalizeState(s).partnerships, s.partnerships);
  s.players = s.players.filter(p => p.id !== 'p0' && p.id !== 'p3'); E.normalizePartnerships(s);
  assert.equal(s.partnerships.length, 0); assert.equal(s.partnerRequests.length, 0);
  assert.deepEqual(E.createState().partnerships, []);
});

test('pair creation preserves unequal statistics and compact undo can restore it', () => {
  const s = roster(); s.players[0].games = 5; s.players[0].wins = 3;
  const before = E.clone(s); pair(s);
  assert.equal(s.players[0].games, 5); assert.equal(s.players[0].wins, 3);
  const patch = D.createUndoPatch(before, s);
  assert.deepEqual(E.normalizeState(D.applyUndoPatch(s, patch)), before);
});

test('undo validates pair invariants and never crosses a later opt-out', () => {
  const s = roster(); const before = E.clone(s); pair(s);
  const creation = { partnershipRevision: s.partnershipRevision, undoPatch: D.createUndoPatch(before, s) };
  const restored = D.restoreUndoState(s, creation, E);
  assert.equal(restored.partnerships.length, 0);
  assert.ok(restored.partnershipRevision > s.partnershipRevision);
  E.partnerAction(s, 'end', 'p0', E.partnerRecord(s, 'p0').id, self(0));
  assert.throws(() => D.restoreUndoState(s, creation, E), /later partnership/);
});

test('prepared pairs are reserved together and manual edits release them together', () => {
  const s = roster(12, 2); pair(s);
  E.prepareManualNextGame(s, 0, ['p0', 'p1'], ['p2', 'p3']);
  assert.ok(!E.eligibleIdsForCourt(s, 1).includes('p0'));
  assert.ok(!E.eligibleIdsForCourt(s, 1).includes('p1'));
  assert.equal(E.prepareManualNextGame(s, 0, ['p4', 'p5'], ['p2', 'p3']).changed, true);
  assert.ok(E.availableIds(s).includes('p0')); assert.ok(E.availableIds(s).includes('p1'));
});

test('fixed teammates keep fair turns and progressively face every other player', () => {
  const s = roster(); pair(s);
  for (let i = 0; i < 100; i++) {
    assert.equal(E.assignGame(s, 0, () => .5).changed, true);
    assertTogether(s, s.courtStates[0]);
    E.recordWinner(s, 0, 'A');
    const games = s.players.map(p => p.games);
    assert.ok(Math.max(...games) - Math.min(...games) <= 1);
  }
  for (let i = 2; i < 8; i++) assert.ok(s.opponentCounts[E.pairKey('p0', 'p' + i)] > 0);
});
