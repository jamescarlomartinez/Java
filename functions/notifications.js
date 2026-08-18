'use strict';

const NOTIFY_EVENT_TYPES = new Set(['game_started', 'courts_filled', 'player_replaced']);

function playerMap(state) {
  return new Map(((state && state.players) || []).map((player) => [player.id, player]));
}

function assignments(state) {
  const result = new Map();
  ((state && state.courtStates) || []).forEach((court, courtIndex) => {
    if (court.status !== 'playing') return;
    ['A', 'B'].forEach((team) => {
      const teamIds = team === 'A' ? court.teamA : court.teamB;
      (teamIds || []).forEach((playerId) => {
        result.set(playerId, {
          playerId,
          courtIndex,
          courtNum: court.courtNum,
          gameNum: court.gameNum,
          team
        });
      });
    });
  });
  return result;
}

function newlyAssignedPlayers(beforeState, afterState, eventType) {
  if (!NOTIFY_EVENT_TYPES.has(eventType)) return [];
  const before = assignments(beforeState);
  return Array.from(assignments(afterState).values()).filter((assignment) => {
    const prior = before.get(assignment.playerId);
    return !prior || prior.courtNum !== assignment.courtNum || prior.gameNum !== assignment.gameNum;
  });
}

function notificationDetails(state, assignment) {
  const players = playerMap(state);
  const court = state.courtStates[assignment.courtIndex];
  const ownTeam = assignment.team === 'A' ? court.teamA : court.teamB;
  const otherTeam = assignment.team === 'A' ? court.teamB : court.teamA;
  const name = (id) => (players.get(id) && players.get(id).name) || 'Player';
  return {
    partner: name(ownTeam.find((id) => id !== assignment.playerId)),
    opponents: otherTeam.map(name)
  };
}

function deliveryId(roomId, revision, assignment) {
  return [roomId, revision, assignment.courtNum, assignment.gameNum, assignment.playerId]
    .join('_').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 500);
}

function buildMessage(options) {
  const details = notificationDetails(options.state, options.assignment);
  const id = deliveryId(options.roomId, options.revision, options.assignment);
  const title = `You’re up on Court ${options.assignment.courtNum}!`;
  const body = `Partner: ${details.partner} · vs ${details.opponents.join(' & ')}`;
  const url = `${options.origin}/?room=${encodeURIComponent(options.roomId)}&mode=player`;
  return {
    deliveryId: id,
    token: options.token,
    message: {
      token: options.token,
      data: {
        title,
        body,
        url,
        tag: id,
        deliveryId: id,
        roomId: String(options.roomId),
        playerId: String(options.assignment.playerId),
        courtNum: String(options.assignment.courtNum),
        gameNum: String(options.assignment.gameNum),
        partner: details.partner,
        opponents: details.opponents.join('|')
      },
      webpush: {
        headers: { Urgency: 'high', TTL: '1800' },
        fcmOptions: { link: url }
      }
    }
  };
}

module.exports = {
  NOTIFY_EVENT_TYPES,
  assignments,
  newlyAssignedPlayers,
  notificationDetails,
  deliveryId,
  buildMessage
};
