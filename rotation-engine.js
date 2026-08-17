(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PickleballRotation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 4;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function makeId(prefix) {
    prefix = prefix || 'p';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var bytes = new Uint8Array(10);
      crypto.getRandomValues(bytes);
      return prefix + '_' + Array.prototype.map.call(bytes, function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    }
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function emptyCourt(courtNum) {
    return {
      courtNum: courtNum,
      status: 'empty',
      gameNum: 0,
      teamA: [],
      teamB: [],
      winner: null,
      assignmentRound: 0,
      previousLastAssigned: {}
    };
  }

  function createState(courts) {
    var count = Math.max(1, Math.min(6, Number(courts) || 2));
    var state = {
      schemaVersion: SCHEMA_VERSION,
      players: [],
      courts: count,
      courtStates: [],
      history: [],
      rotationRound: 0,
      matchmakingMode: 'social',
      teammateCounts: {},
      opponentCounts: {}
    };
    initCourtStates(state, count);
    return state;
  }

  function initCourtStates(state, count) {
    count = Math.max(1, Math.min(6, Number(count) || 2));
    state.courts = count;
    if (!Array.isArray(state.courtStates)) state.courtStates = [];
    while (state.courtStates.length < count) state.courtStates.push(emptyCourt(state.courtStates.length + 1));
    state.courtStates = state.courtStates.slice(0, count);
    state.courtStates.forEach(function (court, index) {
      court.courtNum = index + 1;
      if (!Array.isArray(court.teamA)) court.teamA = [];
      if (!Array.isArray(court.teamB)) court.teamB = [];
      if (!court.previousLastAssigned) court.previousLastAssigned = {};
      if (!court.status) court.status = 'empty';
    });
  }

  function playerById(state, id) {
    return state.players.find(function (player) { return player.id === id; }) || null;
  }

  function playerName(state, id) {
    var player = playerById(state, id);
    return player ? player.name : 'Unknown player';
  }

  function migrateLegacy(legacy) {
    if (!legacy || typeof legacy !== 'object') return createState(2);
    if (Array.isArray(legacy.players) && legacy.players.some(function (player) { return player && typeof player === 'object'; })) {
      return normalizeState(legacy);
    }

    var state = createState(legacy.courts || 2);
    var names = Array.isArray(legacy.players) ? legacy.players : [];
    var idByName = {};
    state.players = names.map(function (name) {
      var id = makeId('p');
      idByName[name] = id;
      return {
        id: id,
        name: String(name),
        games: Number(legacy.playCounts && legacy.playCounts[name]) || 0,
        wins: Number(legacy.winCounts && legacy.winCounts[name]) || 0,
        notAvailable: !!(legacy.notAvailable && legacy.notAvailable[name]),
        skillRating: 3,
        checkedIn: false,
        checkedInUid: null,
        checkedInName: null,
        lastAssignedRound: -1
      };
    });
    state.courtStates = (legacy.courtStates || []).slice(0, state.courts).map(function (court, index) {
      return {
        courtNum: index + 1,
        status: court.status || 'empty',
        gameNum: Number(court.gameNum) || 0,
        teamA: (court.teamA || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        teamB: (court.teamB || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        winner: court.winner || null,
        assignmentRound: 0,
        previousLastAssigned: {}
      };
    });
    state.history = (legacy.history || []).slice(0, 100).map(function (entry) {
      return {
        courtNum: entry.courtNum,
        gameNum: entry.gameNum,
        teamA: (entry.teamA || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        teamB: (entry.teamB || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        teamANames: (entry.teamA || []).slice(),
        teamBNames: (entry.teamB || []).slice(),
        winner: entry.winner,
        ts: entry.ts || Date.now()
      };
    });
    initCourtStates(state, state.courts);
    return normalizeState(state);
  }

  function normalizeState(value) {
    var state = clone(value || {});
    state.schemaVersion = SCHEMA_VERSION;
    state.players = Array.isArray(state.players) ? state.players.map(function (player) {
      if (typeof player === 'string') {
        return {
          id: makeId('p'), name: player, games: 0, wins: 0, notAvailable: false,
          skillRating: 3, checkedIn: false, checkedInUid: null, checkedInName: null, lastAssignedRound: -1
        };
      }
      var checkedIn = !!player.checkedIn && typeof player.checkedInUid === 'string' && player.checkedInUid.length > 0;
      return {
        id: player.id || makeId('p'),
        name: String(player.name || 'Player'),
        games: Math.max(0, Number(player.games) || 0),
        wins: Math.max(0, Number(player.wins) || 0),
        notAvailable: !!player.notAvailable,
        skillRating: Math.max(1, Math.min(5, Math.round((Number(player.skillRating) || 3) * 2) / 2)),
        checkedIn: checkedIn,
        checkedInUid: checkedIn ? player.checkedInUid : null,
        checkedInName: checkedIn ? String(player.checkedInName || player.name || 'Player').slice(0, 60) : null,
        lastAssignedRound: Number.isFinite(Number(player.lastAssignedRound)) ? Number(player.lastAssignedRound) : -1
      };
    }) : [];
    state.courts = Math.max(1, Math.min(6, Number(state.courts) || 2));
    state.history = Array.isArray(state.history) ? state.history.slice(0, 100) : [];
    state.rotationRound = Math.max(0, Number(state.rotationRound) || 0);
    state.matchmakingMode = state.matchmakingMode === 'balanced' ? 'balanced' : 'social';
    state.teammateCounts = state.teammateCounts && typeof state.teammateCounts === 'object' ? state.teammateCounts : {};
    state.opponentCounts = state.opponentCounts && typeof state.opponentCounts === 'object' ? state.opponentCounts : {};
    initCourtStates(state, state.courts);
    var rosterIds = new Set(state.players.map(function (player) { return player.id; }));
    state.courtStates.forEach(function (court) {
      var lineup = court.teamA.concat(court.teamB);
      var hasCompleteCurrentLineup = court.teamA.length === 2
        && court.teamB.length === 2
        && lineup.every(function (id) { return rosterIds.has(id); })
        && new Set(lineup).size === 4;
      if ((court.status === 'playing' || court.status === 'done') && hasCompleteCurrentLineup) {
        var lineupIds = new Set(lineup);
        court.previousLastAssigned = Object.fromEntries(Object.entries(court.previousLastAssigned).filter(function (entry) {
          return lineupIds.has(entry[0]);
        }));
        return;
      }
      court.status = 'empty';
      court.teamA = [];
      court.teamB = [];
      court.winner = null;
      court.assignmentRound = 0;
      court.previousLastAssigned = {};
    });
    return state;
  }

  function lockedIds(state) {
    var result = [];
    state.courtStates.forEach(function (court) {
      if (court.status === 'playing') result = result.concat(court.teamA, court.teamB);
    });
    return result;
  }

  function availableIds(state) {
    var locked = new Set(lockedIds(state));
    return state.players.filter(function (player) {
      return !locked.has(player.id) && !player.notAvailable;
    }).map(function (player) { return player.id; });
  }

  function compareStandings(a, b) {
    var aGames = Math.max(0, Number(a.games) || 0);
    var bGames = Math.max(0, Number(b.games) || 0);
    var aWins = Math.max(0, Number(a.wins) || 0);
    var bWins = Math.max(0, Number(b.wins) || 0);
    if (!!aGames !== !!bGames) return aGames ? -1 : 1;
    if (aGames && bGames) {
      var percentageDiff = bWins * aGames - aWins * bGames;
      if (percentageDiff !== 0) return percentageDiff;
    }
    return bWins - aWins
      || bGames - aGames
      || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' });
  }

  function rankedPlayers(state) {
    return state.players.slice().sort(compareStandings);
  }

  function checkInPlayer(state, playerId, uid, displayName) {
    var player = playerById(state, playerId);
    if (!player) return { changed: false, reason: 'That player is no longer in the session.' };
    if (player.checkedInUid && player.checkedInUid !== uid) {
      return { changed: false, reason: player.name + ' is already checked in on another device.' };
    }
    var changed = !player.checkedIn || player.checkedInUid !== uid || player.notAvailable;
    player.checkedIn = true;
    player.checkedInUid = uid;
    player.checkedInName = String(displayName || player.name).slice(0, 60);
    player.notAvailable = false;
    return { changed: changed, player: player };
  }

  function setSelfAvailability(state, playerId, uid, notAvailable) {
    var player = playerById(state, playerId);
    if (!player || !player.checkedIn || player.checkedInUid !== uid) {
      return { changed: false, reason: 'This device is not checked in as that player.' };
    }
    if (lockedIds(state).indexOf(player.id) !== -1) {
      return { changed: false, reason: player.name + ' is currently on court.' };
    }
    notAvailable = !!notAvailable;
    if (player.notAvailable === notAvailable) return { changed: false, reason: 'Availability is already up to date.' };
    player.notAvailable = notAvailable;
    return { changed: true, player: player };
  }

  function checkOutPlayer(state, playerId, uid) {
    var player = playerById(state, playerId);
    if (!player || !player.checkedIn || player.checkedInUid !== uid) {
      return { changed: false, reason: 'This device is not checked in as that player.' };
    }
    if (lockedIds(state).indexOf(player.id) !== -1) {
      return { changed: false, reason: player.name + ' must finish the active game before leaving.' };
    }
    player.checkedIn = false;
    player.checkedInUid = null;
    player.checkedInName = null;
    player.notAvailable = true;
    return { changed: true, player: player };
  }

  function pairKey(a, b) {
    return a < b ? a + '|' + b : b + '|' + a;
  }

  function combinations(items, size) {
    var result = [];
    function walk(start, picked) {
      if (picked.length === size) { result.push(picked.slice()); return; }
      for (var i = start; i <= items.length - (size - picked.length); i++) {
        picked.push(items[i]);
        walk(i + 1, picked);
        picked.pop();
      }
    }
    walk(0, []);
    return result;
  }

  function partitions(group) {
    return [
      [[group[0], group[1]], [group[2], group[3]]],
      [[group[0], group[2]], [group[1], group[3]]],
      [[group[0], group[3]], [group[1], group[2]]]
    ];
  }

  function compareTuple(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var av = a[i] || 0;
      var bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  function chooseAssignment(state, ids, randomFn) {
    randomFn = randomFn || Math.random;
    if (ids.length < 4) return null;
    var players = ids.map(function (id) { return playerById(state, id); }).filter(Boolean);
    players.sort(function (a, b) {
      return a.games - b.games || a.lastAssignedRound - b.lastAssignedRound || a.name.localeCompare(b.name);
    });
    var pool = players.slice(0, Math.min(12, players.length));
    var allPlayers = state.players.filter(function (player) { return !player.notAvailable; });
    var candidates = combinations(pool.map(function (player) { return player.id; }), 4);
    var best = null;

    candidates.forEach(function (group) {
      partitions(group).forEach(function (partition) {
        var selected = new Set(group);
        var projected = allPlayers.map(function (player) { return player.games + (selected.has(player.id) ? 1 : 0); });
        var spread = projected.length ? Math.max.apply(Math, projected) - Math.min.apply(Math, projected) : 0;
        var pickedGames = group.reduce(function (sum, id) { return sum + playerById(state, id).games; }, 0);
        var backToBack = group.filter(function (id) {
          return playerById(state, id).lastAssignedRound === state.rotationRound;
        }).length;
        var waitTotal = group.reduce(function (sum, id) {
          var last = playerById(state, id).lastAssignedRound;
          return sum + (last < 0 ? state.rotationRound + 2 : state.rotationRound - last);
        }, 0);
        var teamASkill = partition[0].reduce(function (sum, id) { return sum + playerById(state, id).skillRating; }, 0);
        var teamBSkill = partition[1].reduce(function (sum, id) { return sum + playerById(state, id).skillRating; }, 0);
        var skillGap = state.matchmakingMode === 'balanced' ? Math.abs(teamASkill - teamBSkill) : 0;
        var teammateRepeats = (state.teammateCounts[pairKey(partition[0][0], partition[0][1])] || 0)
          + (state.teammateCounts[pairKey(partition[1][0], partition[1][1])] || 0);
        var opponentRepeats = 0;
        partition[0].forEach(function (a) {
          partition[1].forEach(function (b) { opponentRepeats += state.opponentCounts[pairKey(a, b)] || 0; });
        });
        var score = [spread, pickedGames, backToBack, -waitTotal, skillGap, teammateRepeats, opponentRepeats, randomFn()];
        if (!best || compareTuple(score, best.score) < 0) best = { teamA: partition[0], teamB: partition[1], score: score };
      });
    });
    return best;
  }

  function assignGame(state, courtIndex, randomFn) {
    var court = state.courtStates[courtIndex];
    if (!court || court.status === 'playing') return { changed: false, reason: 'Court is already in play.' };
    var available = availableIds(state);
    if (available.length < 4) return { changed: false, reason: 'Need 4 available players; only ' + available.length + ' available.' };
    var assignment = chooseAssignment(state, available, randomFn);
    if (!assignment) return { changed: false, reason: 'Could not build a fair game.' };
    state.rotationRound += 1;
    court.teamA = assignment.teamA.slice();
    court.teamB = assignment.teamB.slice();
    court.status = 'playing';
    court.gameNum = (court.gameNum || 0) + 1;
    court.winner = null;
    court.assignmentRound = state.rotationRound;
    court.previousLastAssigned = {};
    court.teamA.concat(court.teamB).forEach(function (id) {
      var player = playerById(state, id);
      court.previousLastAssigned[id] = player.lastAssignedRound;
      player.games += 1;
      player.lastAssignedRound = state.rotationRound;
    });
    return { changed: true, court: court };
  }

  function incrementPair(map, a, b) {
    var key = pairKey(a, b);
    map[key] = (map[key] || 0) + 1;
  }

  function recordWinner(state, courtIndex, winner, now) {
    var court = state.courtStates[courtIndex];
    if (!court || court.status !== 'playing' || (winner !== 'A' && winner !== 'B')) return { changed: false };
    court.winner = winner;
    court.status = 'done';
    var winners = winner === 'A' ? court.teamA : court.teamB;
    winners.forEach(function (id) { var player = playerById(state, id); if (player) player.wins += 1; });
    incrementPair(state.teammateCounts, court.teamA[0], court.teamA[1]);
    incrementPair(state.teammateCounts, court.teamB[0], court.teamB[1]);
    court.teamA.forEach(function (a) { court.teamB.forEach(function (b) { incrementPair(state.opponentCounts, a, b); }); });
    state.history.unshift({
      courtNum: court.courtNum,
      gameNum: court.gameNum,
      teamA: court.teamA.slice(),
      teamB: court.teamB.slice(),
      teamANames: court.teamA.map(function (id) { return playerName(state, id); }),
      teamBNames: court.teamB.map(function (id) { return playerName(state, id); }),
      winner: winner,
      ts: now || Date.now()
    });
    state.history = state.history.slice(0, 100);
    return { changed: true, winners: winners.slice(), court: court };
  }

  function replacePlayer(state, courtIndex, team, playerIndex, replacementId) {
    var court = state.courtStates[courtIndex];
    if (!court || court.status !== 'playing') return { changed: false, reason: 'Game is not active.' };
    if (availableIds(state).indexOf(replacementId) === -1) return { changed: false, reason: 'Replacement is no longer available.' };
    var target = team === 'A' ? court.teamA : court.teamB;
    var outgoingId = target[playerIndex];
    var outgoing = playerById(state, outgoingId);
    var incoming = playerById(state, replacementId);
    if (!outgoing || !incoming) return { changed: false, reason: 'Player could not be found.' };
    target[playerIndex] = replacementId;
    outgoing.games = Math.max(0, outgoing.games - 1);
    outgoing.lastAssignedRound = Object.prototype.hasOwnProperty.call(court.previousLastAssigned, outgoingId)
      ? court.previousLastAssigned[outgoingId] : outgoing.lastAssignedRound;
    court.previousLastAssigned[replacementId] = incoming.lastAssignedRound;
    incoming.games += 1;
    incoming.lastAssignedRound = court.assignmentRound || state.rotationRound;
    delete court.previousLastAssigned[outgoingId];
    return { changed: true, outgoing: outgoing, incoming: incoming };
  }

  function fairReplacement(state) {
    var ids = availableIds(state);
    ids.sort(function (a, b) {
      var pa = playerById(state, a), pb = playerById(state, b);
      return pa.games - pb.games || pa.lastAssignedRound - pb.lastAssignedRound || pa.name.localeCompare(pb.name);
    });
    return ids[0] || null;
  }

  function resetCourts(state) {
    state.history = [];
    state.teammateCounts = {};
    state.opponentCounts = {};
    state.courtStates = [];
    initCourtStates(state, state.courts);
    return state;
  }

  function resetStatistics(state) {
    state.players.forEach(function (player) {
      player.games = 0;
      player.wins = 0;
      player.lastAssignedRound = -1;
    });
    state.history = [];
    state.rotationRound = 0;
    state.teammateCounts = {};
    state.opponentCounts = {};
    return state;
  }

  return {
    SCHEMA_VERSION: SCHEMA_VERSION,
    clone: clone,
    makeId: makeId,
    createState: createState,
    normalizeState: normalizeState,
    migrateLegacy: migrateLegacy,
    initCourtStates: initCourtStates,
    playerById: playerById,
    playerName: playerName,
    lockedIds: lockedIds,
    availableIds: availableIds,
    compareStandings: compareStandings,
    rankedPlayers: rankedPlayers,
    checkInPlayer: checkInPlayer,
    setSelfAvailability: setSelfAvailability,
    checkOutPlayer: checkOutPlayer,
    pairKey: pairKey,
    chooseAssignment: chooseAssignment,
    assignGame: assignGame,
    recordWinner: recordWinner,
    replacePlayer: replacePlayer,
    fairReplacement: fairReplacement,
    resetCourts: resetCourts,
    resetStatistics: resetStatistics
  };
});
