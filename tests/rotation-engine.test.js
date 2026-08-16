'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../rotation-engine.js');

function stateWithPlayers(names, courts = 2) {
  const state = Engine.createState(courts);
  state.players = names.map((name, index) => ({
    id: `p${index}`,
    name,
    games: 0,
    wins: 0,
    notAvailable: false,
    lastAssignedRound: -1
  }));
  return state;
}

test('migrates pickleballRotation_v2 names, stats, availability, courts, and history', () => {
  const migrated = Engine.migrateLegacy({
    players: ['Amy', 'Ben', 'Cara', 'Dan'],
    courts: 1,
    playCounts: { Amy: 3, Ben: 2 },
    winCounts: { Amy: 2 },
    notAvailable: { Dan: true },
    courtStates: [{ courtNum: 1, status: 'playing', gameNum: 4, teamA: ['Amy', 'Ben'], teamB: ['Cara', 'Dan'] }],
    history: [{ courtNum: 1, gameNum: 3, teamA: ['Amy', 'Cara'], teamB: ['Ben', 'Dan'], winner: 'A', ts: 42 }]
  });

  assert.equal(migrated.schemaVersion, 3);
  assert.equal(new Set(migrated.players.map(player => player.id)).size, 4);
  assert.equal(migrated.players.find(player => player.name === 'Amy').games, 3);
  assert.equal(migrated.players.find(player => player.name === 'Amy').wins, 2);
  assert.equal(migrated.players.find(player => player.name === 'Dan').notAvailable, true);
  assert.deepEqual(migrated.courtStates[0].teamA.map(id => Engine.playerName(migrated, id)), ['Amy', 'Ben']);
  assert.deepEqual(migrated.history[0].teamANames, ['Amy', 'Cara']);
});

test('clears a legacy active court when its players are absent from the current roster', () => {
  const currentNames = Array.from({ length: 16 }, (_, index) => String(index + 1));
  const migrated = Engine.migrateLegacy({
    players: currentNames,
    courts: 2,
    courtStates: [
      { courtNum: 1, status: 'playing', gameNum: 1, teamA: ['5', '3'], teamB: ['2', '8'] },
      { courtNum: 2, status: 'playing', gameNum: 1, teamA: ['wewe', 'allan'], teamB: ['deb', 'rhaya'] }
    ]
  });

  assert.equal(migrated.courtStates[0].status, 'playing');
  assert.deepEqual(migrated.courtStates[0].teamA.map(id => Engine.playerName(migrated, id)), ['5', '3']);
  assert.equal(migrated.courtStates[1].status, 'empty');
  assert.deepEqual(migrated.courtStates[1].teamA, []);
  assert.deepEqual(migrated.courtStates[1].teamB, []);
  assert.deepEqual(Engine.lockedIds(migrated).map(id => Engine.playerName(migrated, id)).sort(), ['2', '3', '5', '8']);
});

test('normalization removes stale ids and incomplete lineups from current state', () => {
  const state = stateWithPlayers(['1', '2', '3', '4'], 2);
  state.courtStates[0] = {
    courtNum: 1,
    status: 'playing',
    gameNum: 2,
    teamA: ['p0', 'removed-player'],
    teamB: ['p2', 'p3'],
    winner: null,
    assignmentRound: 2,
    previousLastAssigned: { p0: -1, 'removed-player': 1 }
  };

  const normalized = Engine.normalizeState(state);
  assert.equal(normalized.courtStates[0].status, 'empty');
  assert.deepEqual(normalized.courtStates[0].teamA, []);
  assert.deepEqual(normalized.courtStates[0].teamB, []);
  assert.equal(normalized.courtStates[0].gameNum, 2);
  assert.deepEqual(Engine.lockedIds(normalized), []);
});

test('prioritizes projected game-count fairness', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E'], 1);
  state.players[0].games = 4;
  const result = Engine.assignGame(state, 0, () => 0.5);
  const selected = result.court.teamA.concat(result.court.teamB);
  assert.equal(result.changed, true);
  assert.equal(selected.includes('p0'), false);
});

test('uses longest waiting order after game counts are equal', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E'], 1);
  state.rotationRound = 8;
  state.players.forEach((player, index) => { player.lastAssignedRound = index; });
  state.players[4].lastAssignedRound = 8;
  const result = Engine.assignGame(state, 0, () => 0.25);
  const selected = result.court.teamA.concat(result.court.teamB);
  assert.equal(selected.includes('p4'), false);
});

test('avoids repeated teammates before repeated opponents', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  state.teammateCounts[Engine.pairKey('p0', 'p1')] = 5;
  state.teammateCounts[Engine.pairKey('p2', 'p3')] = 5;
  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teammateKeys = [Engine.pairKey(...assignment.teamA), Engine.pairKey(...assignment.teamB)];
  assert.equal(teammateKeys.includes(Engine.pairKey('p0', 'p1')), false);
  assert.equal(teammateKeys.includes(Engine.pairKey('p2', 'p3')), false);
});

test('still fills a playable court when every pairing is a repeat', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  for (let a = 0; a < 4; a += 1) {
    for (let b = a + 1; b < 4; b += 1) state.teammateCounts[Engine.pairKey(`p${a}`, `p${b}`)] = 3;
  }
  assert.equal(Engine.assignGame(state, 0, () => 0.5).changed, true);
});

test('fills multiple courts sequentially without duplicate active players', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 2);
  assert.equal(Engine.assignGame(state, 0, () => 0.5).changed, true);
  assert.equal(Engine.assignGame(state, 1, () => 0.5).changed, true);
  const active = Engine.lockedIds(state);
  assert.equal(active.length, 8);
  assert.equal(new Set(active).size, 8);
});

test('excludes unavailable and already-active players', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 2);
  state.players[8].notAvailable = true;
  Engine.assignGame(state, 0, () => 0.5);
  const firstCourt = new Set(Engine.lockedIds(state));
  const second = Engine.assignGame(state, 1, () => 0.5);
  assert.equal(second.changed, true);
  second.court.teamA.concat(second.court.teamB).forEach(id => assert.equal(firstCourt.has(id), false));
  assert.equal(Engine.lockedIds(state).includes('p8'), false);
});

test('replacement transfers game credit and restores outgoing wait position', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E'], 1);
  state.players[0].lastAssignedRound = 2;
  state.rotationRound = 4;
  Engine.assignGame(state, 0, () => 0.5);
  const outgoingId = state.courtStates[0].teamA[0];
  const replacementId = Engine.availableIds(state)[0];
  const outgoing = Engine.playerById(state, outgoingId);
  const incoming = Engine.playerById(state, replacementId);
  const outgoingGames = outgoing.games;
  const incomingGames = incoming.games;
  const previousWait = state.courtStates[0].previousLastAssigned[outgoingId];

  const result = Engine.replacePlayer(state, 0, 'A', 0, replacementId);
  assert.equal(result.changed, true);
  assert.equal(outgoing.games, outgoingGames - 1);
  assert.equal(incoming.games, incomingGames + 1);
  assert.equal(outgoing.lastAssignedRound, previousWait);
  assert.equal(state.courtStates[0].teamA[0], replacementId);
});

test('winner recording finalizes history from the post-replacement lineup', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E'], 1);
  Engine.assignGame(state, 0, () => 0.5);
  const replacementId = Engine.availableIds(state)[0];
  const outgoingId = state.courtStates[0].teamA[0];
  Engine.replacePlayer(state, 0, 'A', 0, replacementId);
  const finalTeamA = state.courtStates[0].teamA.slice();
  const before = Engine.clone(state);

  const result = Engine.recordWinner(state, 0, 'A', 1234);
  assert.equal(result.changed, true);
  assert.deepEqual(state.history[0].teamA, finalTeamA);
  assert.equal(state.history[0].teamA.includes(outgoingId), false);
  finalTeamA.forEach(id => assert.equal(Engine.playerById(state, id).wins, 1));
  assert.equal(state.teammateCounts[Engine.pairKey(...finalTeamA)], 1);

  const restored = Engine.normalizeState(before);
  assert.equal(restored.courtStates[0].status, 'playing');
  assert.equal(restored.history.length, 0);
});

test('court reset preserves player statistics and can be restored from an undo snapshot', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  Engine.assignGame(state, 0, () => 0.5);
  Engine.recordWinner(state, 0, 'A', 100);
  const beforeReset = Engine.clone(state);

  Engine.resetCourts(state);
  assert.equal(state.history.length, 0);
  assert.equal(state.courtStates[0].status, 'empty');
  assert.equal(state.players.reduce((sum, player) => sum + player.games, 0), 4);
  assert.equal(state.players.reduce((sum, player) => sum + player.wins, 0), 2);

  const undone = Engine.normalizeState(beforeReset);
  assert.equal(undone.history.length, 1);
  assert.equal(undone.courtStates[0].status, 'done');
});

test('statistics reset clears credits, wins, wait metrics, and repeat history', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  Engine.assignGame(state, 0, () => 0.5);
  Engine.recordWinner(state, 0, 'B', 100);
  Engine.resetStatistics(state);
  state.players.forEach(player => {
    assert.equal(player.games, 0);
    assert.equal(player.wins, 0);
    assert.equal(player.lastAssignedRound, -1);
  });
  assert.equal(state.rotationRound, 0);
  assert.deepEqual(state.teammateCounts, {});
  assert.deepEqual(state.opponentCounts, {});
  assert.equal(state.history.length, 0);
});
