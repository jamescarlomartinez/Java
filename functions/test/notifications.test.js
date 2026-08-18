'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  newlyAssignedPlayers,
  deliveryId,
  buildMessage
} = require('../notifications');

function state(courts) {
  return {
    players: [
      { id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Ben' },
      { id: 'p3', name: 'Cam' }, { id: 'p4', name: 'Dee' },
      { id: 'p5', name: 'Eli' }
    ],
    courtStates: courts
  };
}

const emptyCourt = { courtNum: 1, gameNum: 0, status: 'empty', teamA: [], teamB: [] };
const playing = { courtNum: 1, gameNum: 1, status: 'playing', teamA: ['p1', 'p2'], teamB: ['p3', 'p4'] };

test('game start identifies every newly assigned player', () => {
  const result = newlyAssignedPlayers(state([emptyCourt]), state([playing]), 'game_started');
  assert.deepEqual(result.map((item) => item.playerId), ['p1', 'p2', 'p3', 'p4']);
});

test('replacement identifies only the incoming player', () => {
  const after = { ...playing, teamB: ['p3', 'p5'] };
  const result = newlyAssignedPlayers(state([playing]), state([after]), 'player_replaced');
  assert.deepEqual(result.map((item) => item.playerId), ['p5']);
});

test('swap, undo, end, and unchanged assignments are ignored', () => {
  const swapped = { ...playing, teamA: ['p1', 'p3'], teamB: ['p2', 'p4'] };
  for (const type of ['players_swapped', 'undo', 'room_ended']) {
    assert.deepEqual(newlyAssignedPlayers(state([playing]), state([swapped]), type), []);
  }
  assert.deepEqual(newlyAssignedPlayers(state([playing]), state([playing]), 'courts_filled'), []);
});

test('delivery IDs are deterministic and message contains partner and opponents', () => {
  const assignment = { playerId: 'p1', courtIndex: 0, courtNum: 1, gameNum: 1, team: 'A' };
  assert.equal(deliveryId('room', 7, assignment), deliveryId('room', 7, assignment));
  const built = buildMessage({ roomId: 'room', revision: 7, state: state([playing]), assignment, token: 'token', origin: 'https://example.test' });
  assert.equal(built.message.data.title, 'You’re up on Court 1!');
  assert.equal(built.message.data.body, 'Partner: Ben · vs Cam & Dee');
  assert.equal(built.message.data.url, 'https://example.test/?room=room&mode=player');
  assert.equal(built.message.data.deliveryId, built.deliveryId);
});
