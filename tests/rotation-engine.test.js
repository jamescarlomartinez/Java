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
    skillRating: 1,
    skillLevelConfirmed: true,
    checkedIn: false,
    checkedInUid: null,
    checkedInName: null,
    lastAssignedRound: -1
  }));
  return state;
}

function completeRotationCycles(state, cycles, random = () => 0.5) {
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    Engine.courtFillOrder(state).forEach(index => {
      if (state.courtStates[index].status !== 'playing') Engine.assignGame(state, index, random);
    });
    state.courtStates.forEach((court, index) => {
      if (court.status === 'playing') Engine.recordWinner(state, index, 'A', cycle + 1);
    });
  }
}

function relationshipSets(state, source) {
  const relationships = new Map(state.players.map(player => [player.id, new Set()]));
  Object.keys(source).forEach(pair => {
    const [a, b] = pair.split('|');
    relationships.get(a).add(b);
    relationships.get(b).add(a);
  });
  return relationships;
}

function gameSpread(state) {
  const games = state.players.filter(player => !player.notAvailable).map(player => player.games);
  return Math.max(...games) - Math.min(...games);
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

  assert.equal(migrated.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(new Set(migrated.players.map(player => player.id)).size, 4);
  assert.equal(migrated.players.find(player => player.name === 'Amy').games, 3);
  assert.equal(migrated.players.find(player => player.name === 'Amy').wins, 2);
  assert.equal(migrated.players.find(player => player.name === 'Dan').notAvailable, true);
  assert.deepEqual(migrated.courtStates[0].teamA.map(id => Engine.playerName(migrated, id)), ['Amy', 'Ben']);
  assert.deepEqual(migrated.history[0].teamANames, ['Amy', 'Cara']);
  assert.equal(migrated.players[0].skillRating, null);
  assert.equal(migrated.players[0].skillLevelConfirmed, false);
});

test('normalizes older room players with social matchmaking and check-in defaults', () => {
  const normalized = Engine.normalizeState({
    schemaVersion: 3,
    courts: 1,
    players: [{ id: 'p1', name: 'Amy', games: 1, wins: 1, notAvailable: false, lastAssignedRound: 2 }],
    courtStates: [],
    history: []
  });

  assert.equal(normalized.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(normalized.matchmakingMode, 'social');
  assert.equal(normalized.players[0].skillRating, null);
  assert.equal(normalized.players[0].skillLevelConfirmed, false);
  assert.equal(normalized.players[0].checkedIn, false);
  assert.equal(normalized.players[0].checkedInUid, null);
});

test('schema-6 migration forces every existing numeric level to be selected again', () => {
  const oldRatings = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const normalized = Engine.normalizeState({
    schemaVersion: 4,
    courts: 1,
    players: oldRatings.map((skillRating, index) => ({
      id: `legacy-${index}`, name: `Legacy ${index}`, games: 0, wins: 0,
      notAvailable: false, skillRating, lastAssignedRound: -1
    })),
    courtStates: [],
    history: []
  });

  assert.deepEqual(normalized.players.map(player => player.skillRating), oldRatings.map(() => null));
  assert.ok(normalized.players.every(player => player.skillLevelConfirmed === false));
});

test('new schema exposes only the two ordered skill levels and court groups', () => {
  assert.deepEqual(Engine.SKILL_LEVELS.map(level => level.value), [1, 2]);
  assert.deepEqual(Engine.SKILL_LEVELS.map(level => level.label), ['Beginner', 'Non-Beginner']);
  assert.deepEqual(Engine.SKILL_GROUPS, ['any', 'beginner', 'intermediate_plus']);
  assert.ok(Engine.SKILL_LEVELS.every(level => level.description.length > 20));
});

test('schema-8 migration preserves schema-6 skill levels and adds safe court defaults', () => {
  const normalized = Engine.normalizeState({
    schemaVersion: 6,
    courts: 1,
    players: [{
      id: 'p1', name: 'Amy', games: 2, wins: 1, notAvailable: false,
      skillRating: 2, skillLevelConfirmed: true, lastAssignedRound: 1
    }],
    courtStates: [{ courtNum: 1, status: 'empty', teamA: [], teamB: [], skillGroup: 'any' }],
    history: []
  });

  assert.equal(normalized.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(normalized.players[0].skillRating, 2);
  assert.equal(normalized.players[0].skillLevelConfirmed, true);
  assert.equal(normalized.courtStates[0].name, 'Court 1');
  assert.equal(normalized.courtStates[0].startedAt, null);
});

test('preparing reserves players without game credit and start begins credits and timer', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
  state.courtStates[0].name = 'Main Court';

  const prepared = Engine.prepareNextGame(state, 0, () => 0.5, 1000);
  assert.equal(prepared.changed, true);
  assert.equal(prepared.court.status, 'empty');
  assert.equal(prepared.court.nextGame.preparedAt, 1000);
  assert.equal(prepared.court.startedAt, null);
  assert.equal(state.players.reduce((sum, player) => sum + player.games, 0), 0);
  assert.equal(Engine.lockedIds(state).length, 4);
  assert.equal(Engine.availableIds(state).length, 4);

  const started = Engine.startNextGame(state, 0, 5000);
  assert.equal(started.changed, true);
  assert.equal(started.court.status, 'playing');
  assert.equal(started.court.gameNum, 1);
  assert.equal(started.court.startedAt, 5000);
  assert.equal(state.players.reduce((sum, player) => sum + player.games, 0), 4);

  Engine.recordWinner(state, 0, 'A', 65000);
  assert.equal(state.history[0].courtName, 'Main Court');
  assert.equal(state.history[0].durationMs, 60000);
});

test('manual next builder preserves exact teams and rejects duplicate or ineligible players', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E'], 1);
  const exact = Engine.prepareManualNextGame(state, 0, ['p3', 'p1'], ['p4', 'p0'], 2000);
  assert.equal(exact.changed, true);
  assert.deepEqual(state.courtStates[0].nextGame.teamA, ['p3', 'p1']);
  assert.deepEqual(state.courtStates[0].nextGame.teamB, ['p4', 'p0']);
  assert.equal(state.courtStates[0].nextGame.source, 'manual');
  assert.equal(state.players.reduce((sum, player) => sum + player.games, 0), 0);

  const duplicate = Engine.prepareManualNextGame(state, 0, ['p3', 'p3'], ['p4', 'p0'], 3000);
  assert.equal(duplicate.changed, false);
  assert.match(duplicate.reason, /four different/i);

  const cleared = Engine.clearNextGame(state, 0);
  assert.equal(cleared.changed, true);
  assert.equal(state.courtStates[0].status, 'empty');
  assert.equal(Engine.availableIds(state).length, 5);
});

test('schema-7 staged courts migrate into an independent next lineup', () => {
  const old = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  old.schemaVersion = 7;
  Object.assign(old.courtStates[0], {
    status: 'staged', gameNum: 3, teamA: ['p0', 'p1'], teamB: ['p2', 'p3'],
    stagedAt: 1234, stagedSource: 'manual', skillGroup: 'beginner'
  });

  const migrated = Engine.normalizeState(old);
  assert.equal(migrated.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(migrated.courtStates[0].status, 'empty');
  assert.deepEqual(migrated.courtStates[0].teamA, []);
  assert.deepEqual(migrated.courtStates[0].nextGame, {
    gameNum: 4,
    teamA: ['p0', 'p1'],
    teamB: ['p2', 'p3'],
    preparedAt: 1234,
    source: 'manual',
    skillGroup: 'beginner'
  });
  assert.deepEqual(Engine.nextIds(migrated), ['p0', 'p1', 'p2', 'p3']);
});

test('an active court keeps an independent reserved next lineup', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
  Engine.assignGame(state, 0, () => 0.5, 1000);
  const active = Engine.activeIds(state).slice();
  const creditsBeforePreparing = state.players.reduce((sum, player) => sum + player.games, 0);

  const prepared = Engine.prepareNextGame(state, 0, () => 0.5, 2000);
  assert.equal(prepared.changed, true);
  assert.equal(state.courtStates[0].status, 'playing');
  assert.deepEqual(Engine.activeIds(state), active);
  assert.equal(new Set(Engine.lockedIds(state)).size, 8);
  assert.equal(state.players.reduce((sum, player) => sum + player.games, 0), creditsBeforePreparing);
  assert.equal(Engine.availableIds(state).length, 0);
});

test('recording a winner promotes Up Next without starting credits or timer', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
  Engine.assignGame(state, 0, () => 0.5, 1000);
  Engine.prepareNextGame(state, 0, () => 0.5, 2000);
  const preparedIds = Engine.nextIds(state).slice();
  const creditsBeforeWinner = Object.fromEntries(state.players.map(player => [player.id, player.games]));

  const completed = Engine.recordWinner(state, 0, 'A', 61000);
  assert.equal(completed.changed, true);
  assert.equal(state.history.length, 1);
  assert.equal(state.courtStates[0].status, 'empty');
  assert.ok(state.courtStates[0].nextGame);
  assert.equal(state.courtStates[0].startedAt, null);
  preparedIds.forEach(id => assert.equal(Engine.playerById(state, id).games, creditsBeforeWinner[id]));

  const started = Engine.startNextGame(state, 0, 70000);
  assert.equal(started.changed, true);
  assert.equal(started.court.gameNum, 2);
  assert.equal(started.court.startedAt, 70000);
  assert.equal(started.court.nextGame, null);
  preparedIds.forEach(id => assert.equal(Engine.playerById(state, id).games, creditsBeforeWinner[id] + 1));
});

test('manual editing releases the previous reservation and prevents cross-court duplicates', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], 2);
  assert.equal(Engine.prepareManualNextGame(state, 0, ['p0', 'p1'], ['p2', 'p3'], 1000).changed, true);
  assert.equal(Engine.prepareManualNextGame(state, 1, ['p0', 'p4'], ['p5', 'p6'], 1100).changed, false);
  assert.equal(Engine.prepareManualNextGame(state, 0, ['p4', 'p5'], ['p6', 'p7'], 1200).changed, true);
  assert.ok(Engine.availableIds(state).includes('p0'));
  assert.equal(new Set(Engine.lockedIds(state)).size, 4);
});

test('bulk preparation order is idle-first and strict-first within each pass', () => {
  const state = stateWithPlayers(Array.from({ length: 16 }, (_, index) => String(index + 1)), 4);
  state.courtStates[0].status = 'playing';
  state.courtStates[0].teamA = ['p0', 'p1'];
  state.courtStates[0].teamB = ['p2', 'p3'];
  state.courtStates[0].skillGroup = 'any';
  state.courtStates[1].skillGroup = 'any';
  state.courtStates[2].skillGroup = 'beginner';
  state.courtStates[3].status = 'playing';
  state.courtStates[3].teamA = ['p4', 'p5'];
  state.courtStates[3].teamB = ['p6', 'p7'];
  state.courtStates[3].skillGroup = 'beginner';

  assert.deepEqual(Engine.courtPreparationOrder(state), [2, 1, 3, 0]);
});

test('prepared skill designation is a snapshot and reset releases all reservations', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  Engine.checkInPlayer(state, 'p0', 'uid', 'A', 1);
  state.courtStates[0].skillGroup = 'beginner';
  Engine.prepareNextGame(state, 0, () => 0.5, 1000);
  state.courtStates[0].skillGroup = 'intermediate_plus';
  assert.equal(state.courtStates[0].nextGame.skillGroup, 'beginner');
  assert.equal(Engine.setSelfSkillRating(state, 'p0', 'uid', 2).changed, false);
  Engine.resetCourts(state);
  assert.equal(state.courtStates[0].nextGame, null);
  assert.deepEqual(Engine.lockedIds(state), []);
  assert.equal(state.courtStates[0].skillGroup, 'intermediate_plus');
});

test('a migrated player must confirm their provisional level at check-in', () => {
  const state = stateWithPlayers(['Amy'], 1);
  state.players[0].skillLevelConfirmed = false;

  const unconfirmed = Engine.checkInPlayer(state, 'p0', 'uid-amy', 'Amy phone');
  assert.equal(unconfirmed.changed, false);
  assert.match(unconfirmed.reason, /confirm your skill level/i);

  const confirmed = Engine.checkInPlayer(state, 'p0', 'uid-amy', 'Amy phone', 2);
  assert.equal(confirmed.changed, true);
  assert.equal(confirmed.player.skillLevelConfirmed, true);
  assert.equal(Engine.skillLevelLabel(confirmed.player.skillRating), 'Non-Beginner');
});

test('player self check-in owns one roster entry and controls only its availability and skill', () => {
  const state = stateWithPlayers(['Amy', 'Ben', 'Cara', 'Dan'], 1);
  const checkedIn = Engine.checkInPlayer(state, 'p0', 'uid-amy', 'Amy phone', 1);
  assert.equal(checkedIn.changed, true);
  assert.equal(state.players[0].checkedInUid, 'uid-amy');
  assert.equal(state.players[0].notAvailable, false);
  assert.equal(state.players[0].skillRating, 1);

  const claimedElsewhere = Engine.checkInPlayer(state, 'p0', 'uid-other', 'Other phone');
  assert.equal(claimedElsewhere.changed, false);
  assert.match(claimedElsewhere.reason, /already checked in/i);

  assert.equal(Engine.setSelfAvailability(state, 'p0', 'uid-other', true).changed, false);
  assert.equal(Engine.setSelfAvailability(state, 'p0', 'uid-amy', true).changed, true);
  assert.equal(state.players[0].notAvailable, true);
  assert.equal(Engine.setSelfSkillRating(state, 'p0', 'uid-other', 2).changed, false);
  assert.equal(Engine.setSelfSkillRating(state, 'p0', 'uid-amy', 2).changed, true);
  assert.equal(state.players[0].skillRating, 2);
  assert.equal(state.players[0].skillLevelConfirmed, true);
  assert.equal(Engine.setSelfSkillRating(state, 'p0', 'uid-amy', 3).changed, false);
  assert.equal(Engine.checkOutPlayer(state, 'p0', 'uid-amy').changed, true);
  assert.equal(state.players[0].checkedIn, false);
  assert.equal(state.players[0].notAvailable, true);
});

test('a QR guest can add and claim their own unique player name', () => {
  const state = stateWithPlayers(['Amy'], 1);
  assert.equal(Engine.enrollPlayer(state, 'Ben', 'uid-ben', 'Ben phone', 'self-ben').changed, false);
  const enrolled = Engine.enrollPlayer(state, '  Ben  ', 'uid-ben', 'Ben phone', 'self-ben', 2);

  assert.equal(enrolled.changed, true);
  assert.equal(enrolled.player.id, 'self-ben');
  assert.equal(enrolled.player.name, 'Ben');
  assert.equal(enrolled.player.checkedIn, true);
  assert.equal(enrolled.player.checkedInUid, 'uid-ben');
  assert.equal(enrolled.player.skillRating, 2);
  assert.equal(enrolled.player.skillLevelConfirmed, true);
  assert.equal(enrolled.player.notAvailable, false);
  assert.equal(state.players.length, 2);

  assert.equal(Engine.enrollPlayer(state, 'ben', 'uid-other', 'Other phone').changed, false);
  assert.equal(Engine.enrollPlayer(state, 'Cara', 'uid-ben', 'Ben phone').changed, false);
});

test('a controller can atomically switch from one owned existing player to another', () => {
  const state = stateWithPlayers(['Amy', 'Ben'], 1);
  Engine.checkInPlayer(state, 'p0', 'controller-uid', 'James', 1);
  state.players[0].games = 4;
  state.players[0].wins = 2;

  const changed = Engine.changeOwnedPlayer(state, 'p0', {
    kind: 'existing', playerId: 'p1', skillRating: 2
  }, 'controller-uid', 'James');

  assert.equal(changed.changed, true);
  assert.equal(changed.outgoing.name, 'Amy');
  assert.equal(changed.incoming.name, 'Ben');
  assert.equal(state.players[0].checkedIn, false);
  assert.equal(state.players[0].notAvailable, true);
  assert.equal(state.players[0].games, 4);
  assert.equal(state.players[0].wins, 2);
  assert.equal(state.players[1].checkedInUid, 'controller-uid');
  assert.equal(state.players[1].checkedInName, 'James');
  assert.equal(state.players[1].skillRating, 2);
});

test('failed controller switching preserves the original player identity', () => {
  const state = stateWithPlayers(['Amy', 'Ben'], 1);
  Engine.checkInPlayer(state, 'p0', 'controller-uid', 'James', 1);
  Engine.checkInPlayer(state, 'p1', 'other-uid', 'Other controller', 2);
  const before = Engine.clone(state);

  const claimed = Engine.changeOwnedPlayer(state, 'p0', {
    kind: 'existing', playerId: 'p1', skillRating: 2
  }, 'controller-uid', 'James');

  assert.equal(claimed.changed, false);
  assert.match(claimed.reason, /another device/i);
  assert.deepEqual(state, before);
});

test('controller switching is blocked on court and new players start with zero statistics', () => {
  const state = stateWithPlayers(['Amy', 'Ben', 'Cara', 'Dan'], 1);
  Engine.checkInPlayer(state, 'p0', 'controller-uid', 'James', 1);
  state.courtStates[0].status = 'playing';
  state.courtStates[0].teamA = ['p0', 'p1'];
  state.courtStates[0].teamB = ['p2', 'p3'];

  const blocked = Engine.changeOwnedPlayer(state, 'p0', {
    kind: 'new', playerId: 'p-new', name: 'James Player', skillRating: 2
  }, 'controller-uid', 'James');
  assert.equal(blocked.changed, false);
  assert.match(blocked.reason, /active or Up Next lineup/i);
  assert.equal(state.players.length, 4);
  assert.equal(state.players[0].checkedInUid, 'controller-uid');

  state.courtStates[0].status = 'empty';
  state.courtStates[0].teamA = [];
  state.courtStates[0].teamB = [];
  const enrolled = Engine.changeOwnedPlayer(state, 'p0', {
    kind: 'new', playerId: 'p-new', name: 'James Player', skillRating: 2
  }, 'controller-uid', 'James');
  assert.equal(enrolled.changed, true);
  assert.equal(enrolled.incoming.games, 0);
  assert.equal(enrolled.incoming.wins, 0);
  assert.equal(enrolled.incoming.checkedInUid, 'controller-uid');
});

test('controller only unlinks the owned player without changing statistics', () => {
  const state = stateWithPlayers(['Amy'], 1);
  Engine.checkInPlayer(state, 'p0', 'controller-uid', 'James', 1);
  state.players[0].games = 3;
  state.players[0].wins = 1;

  const unlinked = Engine.changeOwnedPlayer(state, 'p0', {
    kind: 'controller_only', playerId: null
  }, 'controller-uid', 'James');

  assert.equal(unlinked.changed, true);
  assert.equal(state.players[0].checkedIn, false);
  assert.equal(state.players[0].notAvailable, true);
  assert.equal(state.players[0].games, 3);
  assert.equal(state.players[0].wins, 1);
});

test('a checked-in player cannot take a break or leave while assigned to a court', () => {
  const state = stateWithPlayers(['Amy', 'Ben', 'Cara', 'Dan'], 1);
  Engine.checkInPlayer(state, 'p0', 'uid-amy', 'Amy');
  Engine.assignGame(state, 0, () => 0.5);

  assert.equal(Engine.setSelfAvailability(state, 'p0', 'uid-amy', true).changed, false);
  assert.match(Engine.checkOutPlayer(state, 'p0', 'uid-amy').reason, /active or Up Next lineup/i);
});

test('balanced mode minimizes team skill gap after fairness criteria', () => {
  const state = stateWithPlayers(['Upper 1', 'Upper 2', 'Beginner 1', 'Beginner 2'], 1);
  state.matchmakingMode = 'balanced';
  [2, 2, 1, 1].forEach((rating, index) => { state.players[index].skillRating = rating; });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teamTotal = team => team.reduce((sum, id) => sum + Engine.playerSkillWeight(Engine.playerById(state, id)), 0);
  assert.equal(teamTotal(assignment.teamA), 3);
  assert.equal(teamTotal(assignment.teamB), 3);
  const teamRatings = team => team.map(id => Engine.playerById(state, id).skillRating).sort();
  assert.deepEqual(teamRatings(assignment.teamA), [1, 2]);
  assert.deepEqual(teamRatings(assignment.teamB), [1, 2]);
});

test('balanced mode accepts all-Beginner and all-Intermediate matches', () => {
  [1, 2].forEach(rating => {
    const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
    state.matchmakingMode = 'balanced';
    state.players.forEach(player => { player.skillRating = rating; });
    const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
    assert.ok(assignment.teamA.concat(assignment.teamB).every(id => Engine.playerById(state, id).skillRating === rating));
  });
});

test('balanced mode prefers an even skill composition when projected fairness is equal', () => {
  const state = stateWithPlayers(['Beginner 1', 'Beginner 2', 'Beginner 3', 'Upper 1', 'Upper 2'], 1);
  state.matchmakingMode = 'balanced';
  [1, 1, 1, 2, 2].forEach((rating, index) => { state.players[index].skillRating = rating; });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const ratings = assignment.teamA.concat(assignment.teamB).map(id => Engine.playerById(state, id).skillRating).sort();
  assert.deepEqual(ratings, [1, 1, 2, 2]);
});

test('balanced mode allows an odd skill mix as the closest fallback', () => {
  const state = stateWithPlayers(['Beginner', 'Upper 1', 'Upper 2', 'Upper 3'], 1);
  state.matchmakingMode = 'balanced';
  [1, 2, 2, 2].forEach((rating, index) => { state.players[index].skillRating = rating; });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teamTotal = team => team.reduce((sum, id) => sum + Engine.playerSkillWeight(Engine.playerById(state, id)), 0);
  assert.equal(Math.abs(teamTotal(assignment.teamA) - teamTotal(assignment.teamB)), 1);
  assert.equal(new Set(assignment.teamA.concat(assignment.teamB)).size, 4);
});

test('balanced mode does not sacrifice a mixed team split for unused same-level partners', () => {
  const state = stateWithPlayers(['Beginner 1', 'Beginner 2', 'Upper 1', 'Upper 2'], 1);
  state.matchmakingMode = 'balanced';
  [1, 1, 2, 2].forEach((rating, index) => { state.players[index].skillRating = rating; });
  [['p0', 'p2'], ['p0', 'p3'], ['p1', 'p2'], ['p1', 'p3']].forEach(pair => {
    state.teammateCounts[Engine.pairKey(...pair)] = 5;
  });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teamRatings = team => team.map(id => Engine.playerById(state, id).skillRating).sort();
  assert.deepEqual(teamRatings(assignment.teamA), [1, 2]);
  assert.deepEqual(teamRatings(assignment.teamB), [1, 2]);
});

test('Social Fair remains free to prefer unused same-level partners', () => {
  const state = stateWithPlayers(['Beginner 1', 'Beginner 2', 'Upper 1', 'Upper 2'], 1);
  [1, 1, 2, 2].forEach((rating, index) => { state.players[index].skillRating = rating; });
  [['p0', 'p2'], ['p0', 'p3'], ['p1', 'p2'], ['p1', 'p3']].forEach(pair => {
    state.teammateCounts[Engine.pairKey(...pair)] = 5;
  });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teamRatings = team => team.map(id => Engine.playerById(state, id).skillRating);
  assert.ok(teamRatings(assignment.teamA).every(rating => rating === teamRatings(assignment.teamA)[0]));
  assert.ok(teamRatings(assignment.teamB).every(rating => rating === teamRatings(assignment.teamB)[0]));
});

test('balanced multi-court preparation uses preferred compositions on every Any court', () => {
  const state = stateWithPlayers(Array.from({ length: 8 }, (_, index) => String(index + 1)), 2);
  state.matchmakingMode = 'balanced';
  state.players.forEach((player, index) => { player.skillRating = index < 4 ? 1 : 2; });

  Engine.prepareNextGame(state, 0, () => 0.5);
  Engine.prepareNextGame(state, 1, () => 0.5);
  state.courtStates.forEach(court => {
    const lineup = court.nextGame.teamA.concat(court.nextGame.teamB);
    const beginnerCount = lineup.filter(id => Engine.playerById(state, id).skillRating === 1).length;
    assert.ok([0, 2, 4].includes(beginnerCount));
    const total = team => team.reduce((sum, id) => sum + Engine.playerSkillWeight(Engine.playerById(state, id)), 0);
    assert.equal(total(court.nextGame.teamA), total(court.nextGame.teamB));
  });
});

test('an uneven mixed-skill pool keeps every player in a fair one-court rotation', () => {
  const state = stateWithPlayers(Array.from({ length: 8 }, (_, index) => String(index + 1)), 1);
  state.matchmakingMode = 'balanced';
  state.players.forEach((player, index) => { player.skillRating = index < 3 ? 1 : 2; });

  completeRotationCycles(state, 20);

  assert.ok(gameSpread(state) <= 1);
  assert.ok(state.players.every(player => player.games > 0));
  assert.ok(state.players.every(player => relationshipSets(state, state.opponentCounts).get(player.id).size > 0));
});

test('balanced mode treats an unconfirmed player as a neutral weight on Any courts', () => {
  const state = stateWithPlayers(['Beginner', 'Upper', 'Provisional 1', 'Provisional 2'], 1);
  state.matchmakingMode = 'balanced';
  state.players[0].skillRating = 1;
  state.players[1].skillRating = 2;
  state.players[2].skillRating = null;
  state.players[2].skillLevelConfirmed = false;
  state.players[3].skillRating = null;
  state.players[3].skillLevelConfirmed = false;

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teamTotal = team => team.reduce((sum, id) => sum + Engine.playerSkillWeight(Engine.playerById(state, id)), 0);
  assert.equal(teamTotal(assignment.teamA), 3);
  assert.equal(teamTotal(assignment.teamB), 3);
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

test('eight players complete every teammate and opponent pairing without fixed groups', () => {
  const state = stateWithPlayers(Array.from({ length: 8 }, (_, index) => String(index + 1)), 1);
  completeRotationCycles(state, 14);

  const teammates = relationshipSets(state, state.teammateCounts);
  const opponents = relationshipSets(state, state.opponentCounts);
  state.players.forEach(player => {
    assert.equal(teammates.get(player.id).size, 7);
    assert.equal(opponents.get(player.id).size, 7);
  });
  assert.equal(gameSpread(state), 0);
});

test('multi-court rotations progressively complete twelve and sixteen player coverage', () => {
  const twelve = stateWithPlayers(Array.from({ length: 12 }, (_, index) => String(index + 1)), 2);
  completeRotationCycles(twelve, 18);
  relationshipSets(twelve, twelve.teammateCounts).forEach(partners => assert.equal(partners.size, 11));
  relationshipSets(twelve, twelve.opponentCounts).forEach(opponents => assert.equal(opponents.size, 11));
  assert.ok(gameSpread(twelve) <= 1);

  const sixteen = stateWithPlayers(Array.from({ length: 16 }, (_, index) => String(index + 1)), 2);
  completeRotationCycles(sixteen, 40);
  relationshipSets(sixteen, sixteen.teammateCounts).forEach(partners => assert.equal(partners.size, 15));
  relationshipSets(sixteen, sixteen.opponentCounts).forEach(opponents => assert.equal(opponents.size, 15));
  assert.ok(gameSpread(sixteen) <= 1);
});

test('new teammates take priority over fresh opponents when game counts are equally fair', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  state.teammateCounts[Engine.pairKey('p0', 'p1')] = 1;
  state.teammateCounts[Engine.pairKey('p2', 'p3')] = 1;
  state.teammateCounts[Engine.pairKey('p0', 'p3')] = 1;
  state.teammateCounts[Engine.pairKey('p1', 'p2')] = 1;
  [
    ['p0', 'p1'], ['p0', 'p3'], ['p2', 'p1'], ['p2', 'p3']
  ].forEach(pair => { state.opponentCounts[Engine.pairKey(...pair)] = 5; });

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teammatePairs = [Engine.pairKey(...assignment.teamA), Engine.pairKey(...assignment.teamB)];
  assert.deepEqual(new Set(teammatePairs), new Set([
    Engine.pairKey('p0', 'p2'), Engine.pairKey('p1', 'p3')
  ]));
});

test('fresh opponents break ties after teammate coverage is equal', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  for (let a = 0; a < 4; a += 1) {
    for (let b = a + 1; b < 4; b += 1) state.teammateCounts[Engine.pairKey(`p${a}`, `p${b}`)] = 1;
  }
  state.opponentCounts[Engine.pairKey('p0', 'p3')] = 5;
  state.opponentCounts[Engine.pairKey('p1', 'p2')] = 5;

  const assignment = Engine.chooseAssignment(state, Engine.availableIds(state), () => 0.5);
  const teammatePairs = [Engine.pairKey(...assignment.teamA), Engine.pairKey(...assignment.teamB)];
  assert.deepEqual(new Set(teammatePairs), new Set([
    Engine.pairKey('p0', 'p3'), Engine.pairKey('p1', 'p2')
  ]));
});

test('coverage may use back-to-back players after game counts have been equalized', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
  Engine.assignGame(state, 0, () => 0.5);
  Engine.recordWinner(state, 0, 'A');
  Engine.assignGame(state, 0, () => 0.5);
  const previousPlayers = new Set(state.courtStates[0].teamA.concat(state.courtStates[0].teamB));
  Engine.recordWinner(state, 0, 'A');

  Engine.assignGame(state, 0, () => 0.5);
  const selected = state.courtStates[0].teamA.concat(state.courtStates[0].teamB);
  assert.ok(selected.some(id => previousPlayers.has(id)));
  assert.ok(selected.some(id => !previousPlayers.has(id)));
  assert.ok(gameSpread(state) <= 1);
});

test('skill-balanced rotation preserves team balance while expanding matchup coverage', () => {
  const state = stateWithPlayers(Array.from({ length: 8 }, (_, index) => String(index + 1)), 1);
  state.matchmakingMode = 'balanced';
  state.players.forEach((player, index) => { player.skillRating = index < 4 ? 1 : 2; });
  let largestSkillGap = 0;

  for (let game = 0; game < 24; game += 1) {
    Engine.assignGame(state, 0, () => 0.5);
    const court = state.courtStates[0];
    const total = team => team.reduce((sum, id) => sum + Engine.playerSkillWeight(Engine.playerById(state, id)), 0);
    largestSkillGap = Math.max(largestSkillGap, Math.abs(total(court.teamA) - total(court.teamB)));
    Engine.recordWinner(state, 0, 'A');
  }

  assert.equal(largestSkillGap, 0);
  assert.ok(gameSpread(state) <= 1);
  relationshipSets(state, state.teammateCounts).forEach(partners => assert.equal(partners.size, 7));
  relationshipSets(state, state.opponentCounts).forEach(opponents => assert.equal(opponents.size, 7));
});

test('a late arrival is integrated without resetting existing matchup history', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], 1);
  completeRotationCycles(state, 4);
  const previousCounts = Engine.clone(state.teammateCounts);
  state.players.push({
    id: 'late', name: 'Late Player', games: 0, wins: 0, notAvailable: false,
    skillRating: 1, skillLevelConfirmed: true, checkedIn: false,
    checkedInUid: null, checkedInName: null, lastAssignedRound: -1
  });

  completeRotationCycles(state, 8);
  Object.keys(previousCounts).forEach(pair => assert.ok(state.teammateCounts[pair] >= previousCounts[pair]));
  assert.ok(relationshipSets(state, state.teammateCounts).get('late').size >= 4);
  assert.ok(gameSpread(state) <= 1);
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

test('strict courts accept only confirmed players with the matching level', () => {
  const state = stateWithPlayers(['B1', 'B2', 'B3', 'B4', 'I1', 'I2', 'I3', 'I4'], 2);
  state.players.slice(0, 4).forEach(player => { player.skillRating = 1; });
  state.players.slice(4).forEach(player => { player.skillRating = 2; });
  state.courtStates[0].skillGroup = 'beginner';
  state.courtStates[1].skillGroup = 'intermediate_plus';

  assert.deepEqual(Engine.eligibleIdsForCourt(state, 0), ['p0', 'p1', 'p2', 'p3']);
  assert.deepEqual(Engine.eligibleIdsForCourt(state, 1), ['p4', 'p5', 'p6', 'p7']);
  assert.equal(Engine.assignGame(state, 0, () => 0.5).changed, true);
  assert.equal(Engine.assignGame(state, 1, () => 0.5).changed, true);
});

test('strict courts remain empty with fewer than four eligible players', () => {
  const state = stateWithPlayers(['B1', 'B2', 'B3', 'Upper'], 1);
  state.players[3].skillRating = 2;
  state.courtStates[0].skillGroup = 'beginner';
  const result = Engine.assignGame(state, 0, () => 0.5);
  assert.equal(result.changed, false);
  assert.match(result.reason, /only 3 eligible/i);
});

test('designated courts fill before Any courts so matching players are reserved', () => {
  const state = stateWithPlayers(['B1', 'B2', 'B3', 'B4', 'I1', 'I2', 'I3', 'I4'], 2);
  state.players.slice(4).forEach(player => { player.skillRating = 2; });
  state.courtStates[0].skillGroup = 'any';
  state.courtStates[1].skillGroup = 'beginner';
  assert.deepEqual(Engine.courtFillOrder(state), [1, 0]);
  Engine.courtFillOrder(state).forEach(index => Engine.assignGame(state, index, () => 0.5));
  assert.ok(state.courtStates[1].teamA.concat(state.courtStates[1].teamB).every(id => Engine.playerById(state, id).skillRating === 1));
  assert.equal(new Set(Engine.lockedIds(state)).size, 8);
});

test('unconfirmed players can play on Any courts but not skill-designated courts', () => {
  const state = stateWithPlayers(['P1', 'P2', 'P3', 'P4'], 2);
  state.players.forEach(player => { player.skillRating = null; player.skillLevelConfirmed = false; });
  state.courtStates[0].skillGroup = 'any';
  state.courtStates[1].skillGroup = 'beginner';
  assert.equal(Engine.eligibleIdsForCourt(state, 0).length, 4);
  assert.equal(Engine.eligibleIdsForCourt(state, 1).length, 0);
});

test('replacement candidates respect the active court designation', () => {
  const state = stateWithPlayers(['B1', 'B2', 'B3', 'B4', 'B5', 'Upper'], 1);
  state.players[5].skillRating = 2;
  state.courtStates[0].skillGroup = 'beginner';
  Engine.assignGame(state, 0, () => 0.5);
  const waitingBeginner = Engine.availableIds(state).find(id => Engine.playerById(state, id).skillRating === 1);
  const waitingUpper = Engine.availableIds(state).find(id => Engine.playerById(state, id).skillRating === 2);
  assert.equal(Engine.replacePlayer(state, 0, 'A', 0, waitingUpper).changed, false);
  assert.equal(Engine.replacePlayer(state, 0, 'A', 0, waitingBeginner).changed, true);
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
  const finalTeamB = state.courtStates[0].teamB.slice();
  const before = Engine.clone(state);

  const result = Engine.recordWinner(state, 0, 'A', 1234);
  assert.equal(result.changed, true);
  assert.deepEqual(state.history[0].teamA, finalTeamA);
  assert.equal(state.history[0].teamA.includes(outgoingId), false);
  finalTeamA.forEach(id => assert.equal(Engine.playerById(state, id).wins, 1));
  assert.equal(state.teammateCounts[Engine.pairKey(...finalTeamA)], 1);
  finalTeamA.forEach(a => finalTeamB.forEach(b => {
    assert.equal(state.opponentCounts[Engine.pairKey(a, b)], 1);
  }));
  assert.equal(Object.keys(state.teammateCounts).some(pair => pair.split('|').includes(outgoingId)), false);
  assert.equal(Object.keys(state.opponentCounts).some(pair => pair.split('|').includes(outgoingId)), false);

  const restored = Engine.normalizeState(before);
  assert.equal(restored.courtStates[0].status, 'playing');
  assert.equal(restored.history.length, 0);
});

test('court reset preserves player statistics and can be restored from an undo snapshot', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  state.courtStates[0].skillGroup = 'beginner';
  state.courtStates[0].name = 'Championship Court';
  Engine.assignGame(state, 0, () => 0.5);
  Engine.recordWinner(state, 0, 'A', 100);
  const beforeReset = Engine.clone(state);

  Engine.resetCourts(state);
  assert.equal(state.history.length, 0);
  assert.equal(state.courtStates[0].status, 'empty');
  assert.equal(state.courtStates[0].skillGroup, 'beginner');
  assert.equal(state.courtStates[0].name, 'Championship Court');
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

test('standings rank win percentage before total wins', () => {
  const state = stateWithPlayers(['11', '12', '10', '6', '13', '1', '3', '4', '5', '7', '9', '8', '14', '2']);
  const records = {
    11: [3, 3], 12: [3, 2], 10: [2, 2], 6: [2, 2], 13: [3, 1],
    1: [2, 1], 3: [2, 1], 4: [2, 1], 5: [2, 1], 7: [2, 1], 9: [2, 1],
    8: [3, 0], 14: [2, 0], 2: [2, 0]
  };
  state.players.forEach(player => {
    [player.games, player.wins] = records[player.name];
  });

  assert.deepEqual(
    Engine.rankedPlayers(state).map(player => player.name),
    ['11', '6', '10', '12', '1', '3', '4', '5', '7', '9', '13', '8', '2', '14']
  );
});

test('standings use wins, games, and numeric player name as tie-breakers', () => {
  const state = stateWithPlayers(['6', '12', '14', '10', '11', '13', '1', '3', '4', '5', '7', '8', '9', '2']);
  const records = {
    6: [4, 4], 12: [5, 3], 14: [5, 3], 10: [4, 3], 11: [4, 3], 13: [5, 2],
    1: [4, 2], 3: [4, 2], 4: [4, 2], 5: [4, 2], 7: [4, 2],
    8: [5, 1], 9: [4, 1], 2: [4, 0]
  };
  state.players.forEach(player => {
    [player.games, player.wins] = records[player.name];
  });

  assert.deepEqual(
    Engine.rankedPlayers(state).map(player => player.name),
    ['6', '10', '11', '12', '14', '1', '3', '4', '5', '7', '13', '9', '8', '2']
  );
});

test('schema-9 migration adds bounded session information without changing games', () => {
  const old = stateWithPlayers(['A', 'B'], 2);
  old.schemaVersion = 8;
  old.sessionAnnouncement = '  Courts close at 9 PM.  ';
  old.sessionRules = 'Games to 11.';
  old.players[0].games = 2;
  old.players[0].wins = 1;
  old.players[1].games = 1;
  const normalized = Engine.normalizeState(old);
  assert.equal(normalized.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(normalized.sessionAnnouncement, 'Courts close at 9 PM.');
  assert.equal(normalized.sessionRules, 'Games to 11.');
  assert.equal(normalized.players[0].games, old.players[0].games);
});

test('schema-10 migration leaves existing active games unlimited and preserves their lineup', () => {
  const old = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  old.schemaVersion = 9;
  Object.assign(old.courtStates[0], {
    status: 'playing', gameNum: 4, teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], startedAt: 5000,
    timeLimitMinutes: 15, activeTimeLimitMinutes: 15, deadlineAt: 905000
  });
  const normalized = Engine.normalizeState(old);
  assert.equal(normalized.schemaVersion, 10);
  assert.equal(normalized.courtStates[0].status, 'playing');
  assert.deepEqual(normalized.courtStates[0].teamA, ['p0', 'p1']);
  assert.equal(normalized.courtStates[0].startedAt, 5000);
  assert.equal(normalized.courtStates[0].timeLimitMinutes, null);
  assert.equal(normalized.courtStates[0].activeTimeLimitMinutes, null);
  assert.equal(normalized.courtStates[0].deadlineAt, null);
});

test('time limits are normalized, snapshotted on start, and recorded with timeout status', () => {
  assert.equal(Engine.normalizeTimeLimit(null), null);
  assert.equal(Engine.normalizeTimeLimit(0), 1);
  assert.equal(Engine.normalizeTimeLimit(15.4), 15);
  assert.equal(Engine.normalizeTimeLimit(999), 120);

  const early = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  early.courtStates[0].timeLimitMinutes = 15;
  Engine.assignGame(early, 0, () => 0.5, 1000);
  assert.equal(early.courtStates[0].activeTimeLimitMinutes, 15);
  assert.equal(early.courtStates[0].deadlineAt, 901000);
  early.courtStates[0].timeLimitMinutes = 20;
  assert.equal(early.courtStates[0].activeTimeLimitMinutes, 15);
  const earlyResult = Engine.recordWinner(early, 0, 'A', 600000);
  assert.equal(earlyResult.historyEntry.timeLimitMinutes, 15);
  assert.equal(earlyResult.historyEntry.finishedAfterTimeLimit, false);

  const overdue = stateWithPlayers(['A', 'B', 'C', 'D'], 1);
  overdue.courtStates[0].timeLimitMinutes = 10;
  Engine.assignGame(overdue, 0, () => 0.5, 2000);
  const overdueResult = Engine.recordWinner(overdue, 0, 'B', 602000);
  assert.equal(overdueResult.historyEntry.timeLimitMinutes, 10);
  assert.equal(overdueResult.historyEntry.finishedAfterTimeLimit, true);
});

test('court reset preserves future timer settings while clearing active timer snapshots', () => {
  const state = stateWithPlayers(['A', 'B', 'C', 'D'], 2);
  state.courtStates[0].timeLimitMinutes = 15;
  state.courtStates[1].timeLimitMinutes = 30;
  Engine.assignGame(state, 0, () => 0.5, 1000);
  Engine.resetCourts(state);
  assert.deepEqual(state.courtStates.map(court => court.timeLimitMinutes), [15, 30]);
  assert.ok(state.courtStates.every(court => court.activeTimeLimitMinutes == null && court.deadlineAt == null));
});

test('session information is bounded for safe shared-room storage', () => {
  const state = Engine.createState(1);
  state.sessionAnnouncement = 'a'.repeat(300);
  state.sessionRules = 'r'.repeat(1800);
  const normalized = Engine.normalizeState(state);
  assert.equal(normalized.sessionAnnouncement.length, 240);
  assert.equal(normalized.sessionRules.length, 1500);
});
