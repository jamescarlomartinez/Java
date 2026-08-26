'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../rotation-engine.js');
const RoomData = require('../room-data.js');

function player(id, overrides = {}) {
  return Object.assign({
    id,
    name: id,
    games: 0,
    wins: 0,
    notAvailable: false,
    skillRating: 1,
    skillLevelConfirmed: true,
    checkedIn: false,
    checkedInUid: null,
    checkedInName: null,
    lastAssignedRound: -1
  }, overrides);
}

test('legacy room documents remain readable without layout metadata', () => {
  const legacyState = Engine.createState(2);
  legacyState.players.push(player('A'));
  const normalized = RoomData.stateFromRoom({ state: legacyState }, Engine);
  assert.equal(normalized.schemaVersion, Engine.SCHEMA_VERSION);
  assert.equal(normalized.players[0].name, 'A');
  assert.equal(normalized.sessionAnnouncement, '');
  assert.equal(normalized.sessionRules, '');
});

test('compact undo patch restores changed fields and preserves unrelated later changes', () => {
  const before = Engine.createState(1);
  before.players = [player('A'), player('B')];
  const after = Engine.clone(before);
  after.players[0].games = 1;
  after.rotationRound = 1;

  const patch = RoomData.createUndoPatch(before, after);
  const current = Engine.clone(after);
  current.players[1].checkedIn = true;
  current.players[1].checkedInUid = 'later-user';
  const restored = RoomData.applyUndoPatch(current, patch);

  assert.equal(restored.players[0].games, 0);
  assert.equal(restored.rotationRound, 0);
  assert.equal(restored.players[1].checkedIn, true);
  assert.equal(restored.players[1].checkedInUid, 'later-user');
});

test('undo patch handles added fields and changed array lengths', () => {
  const before = { players: [player('A')], note: '' };
  const after = { players: [player('A'), player('B')], note: 'changed', temporary: true };
  const restored = RoomData.applyUndoPatch(after, RoomData.createUndoPatch(before, after));
  assert.deepEqual(restored, before);
});

test('single-player counter updates are much smaller than complete room snapshots', () => {
  const before = Engine.createState(6);
  before.players = Array.from({ length: 100 }, (_, index) => player(`Player ${index + 1}`));
  const after = Engine.clone(before);
  after.players[49].games = 1;
  after.players[49].lastAssignedRound = 2;
  const patch = RoomData.createUndoPatch(before, after);
  assert.ok(JSON.stringify(patch).length < JSON.stringify(before).length / 10);
});

test('recent action IDs deduplicate and remain bounded', () => {
  let room = { recentActionIds: [] };
  for (let index = 0; index < 50; index += 1) {
    room.recentActionIds = RoomData.appendActionId(room, `action-${index}`);
  }
  room.recentActionIds = RoomData.appendActionId(room, 'action-49');
  assert.equal(room.recentActionIds.length, RoomData.RECENT_ACTION_LIMIT);
  assert.equal(room.recentActionIds.filter(id => id === 'action-49').length, 1);
  assert.equal(room.recentActionIds[0], 'action-10');
});
