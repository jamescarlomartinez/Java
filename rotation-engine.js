(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PickleballRotation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHEMA_VERSION = 11;
  var SKILL_LEVELS = [
    { value: 1, key: 'beginner', label: 'Beginner', description: 'Learning rules and building consistency.' },
    { value: 2, key: 'intermediate_plus', label: 'Non-Beginner', description: 'Consistent rallies, positioning, and strategy through advanced play.' }
  ];
  var SKILL_GROUPS = ['any', 'beginner', 'intermediate_plus'];

  function skillLevelByValue(value) {
    var numericValue = Number(value);
    return SKILL_LEVELS.find(function (level) { return level.value === numericValue; }) || null;
  }

  function skillLevelLabel(value) {
    var level = skillLevelByValue(value);
    return level ? level.label : 'Choose level';
  }

  function normalizeSkillLevel(value) {
    var numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 2 ? numericValue : null;
  }

  function normalizeSkillGroup(value) {
    return SKILL_GROUPS.indexOf(value) !== -1 ? value : 'any';
  }

  function skillGroupLabel(value) {
    value = normalizeSkillGroup(value);
    if (value === 'beginner') return 'Beginner';
    if (value === 'intermediate_plus') return 'Non-Beginner';
    return 'Any level';
  }

  function playerSkillWeight(player) {
    return player && player.skillLevelConfirmed && normalizeSkillLevel(player.skillRating)
      ? player.skillRating : 1.5;
  }

  function playerMatchesSkillGroup(player, skillGroup) {
    skillGroup = normalizeSkillGroup(skillGroup);
    if (skillGroup === 'any') return true;
    if (!player || !player.skillLevelConfirmed) return false;
    return skillGroup === 'beginner' ? player.skillRating === 1 : player.skillRating === 2;
  }

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
      name: 'Court ' + courtNum,
      status: 'empty',
      gameNum: 0,
      teamA: [],
      teamB: [],
      winner: null,
      assignmentRound: 0,
      previousLastAssigned: {},
      skillGroup: 'any',
      timeLimitMinutes: null,
      activeTimeLimitMinutes: null,
      deadlineAt: null,
      stagedAt: null,
      startedAt: null,
      stagedSource: null,
      nextGame: null
    };
  }

  function normalizeTimeLimit(value) {
    if (value == null || value === '' || value === false) return null;
    var minutes = Number(value);
    if (!Number.isFinite(minutes)) return null;
    return Math.max(1, Math.min(120, Math.round(minutes)));
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
      sessionAnnouncement: '',
      sessionRules: '',
      teammateCounts: {},
      opponentCounts: {},
      partnerships: [],
      partnerRequests: [],
      partnershipRevision: 0
    };
    initCourtStates(state, count);
    return state;
  }

  function initCourtStates(state, count, sourceSchemaVersion) {
    sourceSchemaVersion = sourceSchemaVersion == null ? SCHEMA_VERSION : Number(sourceSchemaVersion);
    count = Math.max(1, Math.min(6, Number(count) || 2));
    state.courts = count;
    if (!Array.isArray(state.courtStates)) state.courtStates = [];
    while (state.courtStates.length < count) state.courtStates.push(emptyCourt(state.courtStates.length + 1));
    state.courtStates = state.courtStates.slice(0, count);
    state.courtStates.forEach(function (court, index) {
      court.courtNum = index + 1;
      court.name = String(court.name || ('Court ' + (index + 1))).trim().slice(0, 30) || ('Court ' + (index + 1));
      if (!Array.isArray(court.teamA)) court.teamA = [];
      if (!Array.isArray(court.teamB)) court.teamB = [];
      if (!court.previousLastAssigned) court.previousLastAssigned = {};
      if (!court.status) court.status = 'empty';
      court.skillGroup = normalizeSkillGroup(court.skillGroup);
      court.timeLimitMinutes = sourceSchemaVersion >= 10 ? normalizeTimeLimit(court.timeLimitMinutes) : null;
      court.activeTimeLimitMinutes = sourceSchemaVersion >= 10 ? normalizeTimeLimit(court.activeTimeLimitMinutes) : null;
      court.deadlineAt = sourceSchemaVersion >= 10 && court.deadlineAt != null && Number.isFinite(Number(court.deadlineAt))
        ? Number(court.deadlineAt) : null;
      if (court.status !== 'playing') {
        court.activeTimeLimitMinutes = null;
        court.deadlineAt = null;
      }
      court.stagedAt = court.stagedAt != null && Number.isFinite(Number(court.stagedAt)) ? Number(court.stagedAt) : null;
      court.startedAt = court.startedAt != null && Number.isFinite(Number(court.startedAt)) ? Number(court.startedAt) : null;
      court.stagedSource = court.stagedSource === 'manual' ? 'manual' : court.stagedSource === 'auto' ? 'auto' : null;
      if (court.nextGame && typeof court.nextGame === 'object') {
        court.nextGame = {
          gameNum: Math.max(1, Number(court.nextGame.gameNum) || ((Number(court.gameNum) || 0) + 1)),
          teamA: Array.isArray(court.nextGame.teamA) ? court.nextGame.teamA.slice() : [],
          teamB: Array.isArray(court.nextGame.teamB) ? court.nextGame.teamB.slice() : [],
          preparedAt: court.nextGame.preparedAt != null && Number.isFinite(Number(court.nextGame.preparedAt)) ? Number(court.nextGame.preparedAt) : null,
          source: court.nextGame.source === 'manual' ? 'manual' : 'auto',
          skillGroup: normalizeSkillGroup(court.nextGame.skillGroup)
        };
      } else {
        court.nextGame = null;
      }
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
        skillRating: null,
        skillLevelConfirmed: false,
        checkedIn: false,
        checkedInUid: null,
        checkedInName: null,
        lastAssignedRound: -1
      };
    });
    state.courtStates = (legacy.courtStates || []).slice(0, state.courts).map(function (court, index) {
      return {
        courtNum: index + 1,
        name: 'Court ' + (index + 1),
        status: court.status || 'empty',
        gameNum: Number(court.gameNum) || 0,
        teamA: (court.teamA || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        teamB: (court.teamB || []).map(function (name) { return idByName[name]; }).filter(Boolean),
        winner: court.winner || null,
        assignmentRound: 0,
        previousLastAssigned: {},
        skillGroup: 'any',
        timeLimitMinutes: null,
        activeTimeLimitMinutes: null,
        deadlineAt: null,
        stagedAt: null,
        startedAt: null,
        stagedSource: null,
        nextGame: null
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
    if (value && Number(value.schemaVersion) > SCHEMA_VERSION) throw new Error('Update App to use this newer game format.');
    var state = clone(value || {});
    var sourceSchemaVersion = Math.max(0, Number(state.schemaVersion) || 0);
    state.schemaVersion = SCHEMA_VERSION;
    state.players = Array.isArray(state.players) ? state.players.map(function (player) {
      if (typeof player === 'string') {
        return {
          id: makeId('p'), name: player, games: 0, wins: 0, notAvailable: false,
          skillRating: null, skillLevelConfirmed: false,
          checkedIn: false, checkedInUid: null, checkedInName: null, lastAssignedRound: -1
        };
      }
      var checkedIn = !!player.checkedIn && typeof player.checkedInUid === 'string' && player.checkedInUid.length > 0;
      var currentSkillLevel = sourceSchemaVersion >= 6 ? normalizeSkillLevel(player.skillRating) : null;
      return {
        id: player.id || makeId('p'),
        name: String(player.name || 'Player'),
        games: Math.max(0, Number(player.games) || 0),
        wins: Math.max(0, Number(player.wins) || 0),
        notAvailable: !!player.notAvailable,
        skillRating: currentSkillLevel,
        skillLevelConfirmed: !!currentSkillLevel && !!player.skillLevelConfirmed,
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
    state.sessionAnnouncement = String(state.sessionAnnouncement || '').trim().slice(0, 240);
    state.sessionRules = String(state.sessionRules || '').trim().slice(0, 1500);
    state.teammateCounts = state.teammateCounts && typeof state.teammateCounts === 'object' ? state.teammateCounts : {};
    state.opponentCounts = state.opponentCounts && typeof state.opponentCounts === 'object' ? state.opponentCounts : {};
    initCourtStates(state, state.courts, sourceSchemaVersion);
    var rosterIds = new Set(state.players.map(function (player) { return player.id; }));
    state.courtStates.forEach(function (court) {
      var lineup = court.teamA.concat(court.teamB);
      var hasCompleteCurrentLineup = court.teamA.length === 2
        && court.teamB.length === 2
        && lineup.every(function (id) { return rosterIds.has(id); })
        && new Set(lineup).size === 4;
      if (sourceSchemaVersion < 8 && court.status === 'staged' && hasCompleteCurrentLineup) {
        court.nextGame = {
          gameNum: (Number(court.gameNum) || 0) + 1,
          teamA: court.teamA.slice(),
          teamB: court.teamB.slice(),
          preparedAt: court.stagedAt,
          source: court.stagedSource === 'manual' ? 'manual' : 'auto',
          skillGroup: normalizeSkillGroup(court.skillGroup)
        };
        court.status = 'empty';
        court.teamA = [];
        court.teamB = [];
        court.winner = null;
        court.assignmentRound = 0;
        court.previousLastAssigned = {};
        court.stagedAt = null;
        court.startedAt = null;
        court.stagedSource = null;
        return;
      }
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
      court.stagedAt = null;
      court.startedAt = null;
      court.stagedSource = null;
    });
    var reserved = new Set();
    state.courtStates.forEach(function (court) {
      if (court.status === 'playing') court.teamA.concat(court.teamB).forEach(function (id) { reserved.add(id); });
    });
    state.courtStates.forEach(function (court) {
      var next = court.nextGame;
      if (!next) return;
      var nextLineup = next.teamA.concat(next.teamB);
      var isComplete = next.teamA.length === 2 && next.teamB.length === 2
        && nextLineup.every(function (id) { return rosterIds.has(id) && !reserved.has(id); })
        && new Set(nextLineup).size === 4;
      if (!isComplete) {
        court.nextGame = null;
        return;
      }
      nextLineup.forEach(function (id) { reserved.add(id); });
    });
    normalizePartnerships(state);
    return state;
  }

  function normalizePartnerships(state) {
    var used = new Set();
    ['partnerships', 'partnerRequests'].forEach(function (field) {
      state[field] = (Array.isArray(state[field]) ? state[field] : []).filter(function (pair) {
        if (!pair || !Array.isArray(pair.playerIds) || pair.playerIds.length !== 2) return false;
        var ids = pair.playerIds;
        if (ids[0] === ids[1] || ids.some(function (id) { return used.has(id) || !playerById(state, id); })) return false;
        ids.forEach(function (id) { used.add(id); });
        return true;
      });
    });
    state.partnershipRevision = Math.max(0, Number(state.partnershipRevision) || 0);
  }

  function partnerRecord(state, id, pending) {
    return (state[pending ? 'partnerRequests' : 'partnerships'] || []).find(function (pair) {
      return pair.playerIds.indexOf(id) !== -1;
    }) || null;
  }

  function partnerId(state, id) {
    var pair = partnerRecord(state, id);
    return pair ? pair.playerIds.find(function (other) { return other !== id; }) : null;
  }

  function partnerAction(state, action, a, b, actor, now) {
    actor = actor || {};
    var player = playerById(state, a);
    if (!player || (!actor.isController && (!actor.uid || actor.playerId !== a || player.checkedInUid !== actor.uid))) {
      return { changed: false, reason: 'You can only manage your own partnership.' };
    }
    normalizePartnerships(state);
    var pending = partnerRecord(state, a, true);
    var pair = partnerRecord(state, a);
    if (action === 'cancel' || action === 'decline' || action === 'end') {
      if (action === 'decline' && !actor.isController) return { changed: false, reason: 'Controller approval required.' };
      var record = action === 'end' ? pair : pending;
      if (!record || (b && record.id !== b)) return { changed: false, reason: 'This partnership or request has already changed.' };
      if (action === 'end' && record.playerIds.some(function (id) { return lockedIds(state).indexOf(id) !== -1; })) {
        return { changed: false, reason: 'Both partners must be off court and not Up Next before ending the partnership.' };
      }
      var field = action === 'end' ? 'partnerships' : 'partnerRequests';
      state[field] = state[field].filter(function (item) { return item.id !== record.id; });
      state.partnershipRevision += 1;
      return { changed: true, pair: record };
    }
    if (['request', 'approve', 'create'].indexOf(action) === -1) return { changed: false, reason: 'Unknown partnership action.' };
    if (action !== 'request' && !actor.isController) return { changed: false, reason: 'Controller approval required.' };
    if (action === 'approve') {
      if (!pending || pending.id !== b) return { changed: false, reason: 'This request has already changed.' };
      b = pending.playerIds.find(function (id) { return id !== a; });
    }
    if (a === b || !playerById(state, b)) return { changed: false, reason: 'Choose a different roster player.' };
    if (pair || partnerRecord(state, b) || (action !== 'approve' && (pending || partnerRecord(state, b, true)))) {
      return { changed: false, reason: 'A player already has a partner or pending request. End or cancel it first.' };
    }
    if (action !== 'request' && [a, b].some(function (id) { return lockedIds(state).indexOf(id) !== -1; })) {
      return { changed: false, reason: 'Both players must be off court and not Up Next before approval.' };
    }
    var entry = { id: makeId('pair'), playerIds: [a, b], createdAt: Number(now) || Date.now() };
    if (action === 'request') state.partnerRequests.push(entry);
    else {
      state.partnerships.push(entry);
      if (pending) state.partnerRequests = state.partnerRequests.filter(function (item) { return item.id !== pending.id; });
    }
    state.partnershipRevision += 1;
    return { changed: true, pair: entry };
  }

  function validatePartnerLineup(state, teamA, teamB) {
    var teams = [teamA, teamB];
    for (var i = 0; i < teams.length; i += 1) {
      for (var j = 0; j < teams[i].length; j += 1) {
        var id = teams[i][j], partner = partnerId(state, id);
        if (partner && teams[i].indexOf(partner) === -1) return {
          valid: false, reason: playerName(state, id) + ' must play on the same team as ' + playerName(state, partner) + '.'
        };
      }
    }
    return { valid: true };
  }

  function validatePartnerState(state) {
    for (var i = 0; i < state.courtStates.length; i += 1) {
      var court = state.courtStates[i];
      var lineups = court.status === 'playing' ? [court] : [];
      if (court.nextGame) lineups.push(court.nextGame);
      for (var j = 0; j < lineups.length; j += 1) {
        var check = validatePartnerLineup(state, lineups[j].teamA, lineups[j].teamB);
        if (!check.valid) return check;
      }
    }
    return { valid: true };
  }

  function keepCompletePairs(state, ids) {
    var pool = new Set(ids);
    return ids.filter(function (id) { var partner = partnerId(state, id); return !partner || pool.has(partner); });
  }

  function activeIds(state) {
    var result = [];
    state.courtStates.forEach(function (court) {
      if (court.status === 'playing') result = result.concat(court.teamA, court.teamB);
    });
    return result;
  }

  function nextIds(state) {
    var result = [];
    state.courtStates.forEach(function (court) {
      if (court.nextGame) result = result.concat(court.nextGame.teamA, court.nextGame.teamB);
    });
    return result;
  }

  function lockedIds(state) {
    return activeIds(state).concat(nextIds(state));
  }

  function availableIds(state) {
    var locked = new Set(lockedIds(state));
    return keepCompletePairs(state, state.players.filter(function (player) {
      return !locked.has(player.id) && !player.notAvailable;
    }).map(function (player) { return player.id; }));
  }

  function eligibleIdsForCourt(state, courtIndex) {
    var court = state.courtStates[courtIndex];
    if (!court) return [];
    return keepCompletePairs(state, availableIds(state).filter(function (id) {
      return playerMatchesSkillGroup(playerById(state, id), court.skillGroup);
    }));
  }

  function preparationBreakdown(state, courtIndex, skillGroup) {
    var court = state.courtStates[courtIndex];
    skillGroup = normalizeSkillGroup(skillGroup == null && court ? court.skillGroup : skillGroup);
    var active = new Set(activeIds(state));
    var next = new Set(nextIds(state));
    var counts = {
      total: state.players.length,
      available: 0,
      onCourt: 0,
      upNext: 0,
      takingBreak: 0,
      unconfirmed: 0,
      skillMismatch: 0,
      partnerUnavailable: 0,
      partnerReserved: 0,
      partnerSkillMismatch: 0
    };
    state.players.forEach(function (player) {
      if (player.notAvailable) counts.takingBreak += 1;
      else if (active.has(player.id)) counts.onCourt += 1;
      else if (next.has(player.id)) counts.upNext += 1;
      else if (skillGroup !== 'any' && !player.skillLevelConfirmed) counts.unconfirmed += 1;
      else if (!playerMatchesSkillGroup(player, skillGroup)) counts.skillMismatch += 1;
      else {
        var partner = playerById(state, partnerId(state, player.id));
        if (partner && partner.notAvailable) counts.partnerUnavailable += 1;
        else if (partner && (active.has(partner.id) || next.has(partner.id))) counts.partnerReserved += 1;
        else if (partner && !playerMatchesSkillGroup(partner, skillGroup)) counts.partnerSkillMismatch += 1;
        else counts.available += 1;
      }
    });
    return counts;
  }

  function courtFillOrder(state) {
    return state.courtStates.map(function (_, index) { return index; }).sort(function (a, b) {
      var aAny = normalizeSkillGroup(state.courtStates[a].skillGroup) === 'any';
      var bAny = normalizeSkillGroup(state.courtStates[b].skillGroup) === 'any';
      return Number(aAny) - Number(bAny) || a - b;
    });
  }

  function courtPreparationOrder(state) {
    function rank(index) {
      var court = state.courtStates[index];
      return [court.status === 'playing' ? 1 : 0, normalizeSkillGroup(court.skillGroup) === 'any' ? 1 : 0, index];
    }
    return state.courtStates.map(function (_, index) { return index; }).filter(function (index) {
      return !state.courtStates[index].nextGame;
    }).sort(function (a, b) {
      return compareTuple(rank(a), rank(b));
    });
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

  function enrollPlayer(state, name, uid, displayName, playerId, skillRating) {
    name = String(name || '').trim().slice(0, 50);
    if (!name) return { changed: false, reason: 'Enter your player name.' };
    if (!uid) return { changed: false, reason: 'A signed-in device is required to enroll.' };
    if (state.players.some(function (player) { return player.name.toLowerCase() === name.toLowerCase(); })) {
      return { changed: false, reason: 'That name is already in the player list.' };
    }
    var ownedPlayer = state.players.find(function (player) { return player.checkedInUid === uid; });
    if (ownedPlayer) return { changed: false, reason: 'This device is already checked in as ' + ownedPlayer.name + '.' };
    var selectedSkillLevel = normalizeSkillLevel(skillRating);
    if (!selectedSkillLevel) return { changed: false, reason: 'Choose a skill level before joining.' };
    var player = {
      id: playerId || makeId('p'),
      name: name,
      games: 0,
      wins: 0,
      notAvailable: false,
      skillRating: selectedSkillLevel,
      skillLevelConfirmed: true,
      checkedIn: true,
      checkedInUid: uid,
      checkedInName: String(displayName || name).slice(0, 60),
      lastAssignedRound: -1
    };
    state.players.push(player);
    return { changed: true, player: player };
  }

  function checkInPlayer(state, playerId, uid, displayName, skillRating) {
    var player = playerById(state, playerId);
    if (!player) return { changed: false, reason: 'That player is no longer in the session.' };
    if (player.checkedInUid && player.checkedInUid !== uid) {
      return { changed: false, reason: player.name + ' is already checked in on another device.' };
    }
    var hasSkillRating = skillRating !== undefined && skillRating !== null;
    var nextSkillRating = hasSkillRating ? normalizeSkillLevel(skillRating) : player.skillRating;
    if (hasSkillRating && !nextSkillRating) return { changed: false, reason: 'Choose a valid skill level.' };
    if (!player.skillLevelConfirmed && !hasSkillRating) return { changed: false, reason: 'Confirm your skill level before checking in.' };
    var changed = !player.checkedIn || player.checkedInUid !== uid || player.notAvailable
      || player.skillRating !== nextSkillRating || !player.skillLevelConfirmed;
    player.checkedIn = true;
    player.checkedInUid = uid;
    player.checkedInName = String(displayName || player.name).slice(0, 60);
    player.notAvailable = false;
    player.skillRating = nextSkillRating;
    if (hasSkillRating) player.skillLevelConfirmed = true;
    return { changed: changed, player: player };
  }

  function setSelfSkillRating(state, playerId, uid, skillRating) {
    var player = playerById(state, playerId);
    if (!player || !player.checkedIn || player.checkedInUid !== uid) {
      return { changed: false, reason: 'This device is not checked in as that player.' };
    }
    if (lockedIds(state).indexOf(player.id) !== -1) {
      return { changed: false, reason: player.name + ' is on court or reserved Up Next.' };
    }
    var numericRating = normalizeSkillLevel(skillRating);
    if (!numericRating) return { changed: false, reason: 'Choose a valid skill level.' };
    if (player.skillRating === numericRating && player.skillLevelConfirmed) {
      return { changed: false, reason: 'Skill level is already ' + skillLevelLabel(numericRating) + '.' };
    }
    player.skillRating = numericRating;
    player.skillLevelConfirmed = true;
    return { changed: true, player: player };
  }

  function setSelfAvailability(state, playerId, uid, notAvailable) {
    var player = playerById(state, playerId);
    if (!player || !player.checkedIn || player.checkedInUid !== uid) {
      return { changed: false, reason: 'This device is not checked in as that player.' };
    }
    if (lockedIds(state).indexOf(player.id) !== -1) {
      return { changed: false, reason: player.name + ' is on court or reserved Up Next.' };
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
      return { changed: false, reason: player.name + ' must be removed from the active or Up Next lineup before leaving.' };
    }
    player.checkedIn = false;
    player.checkedInUid = null;
    player.checkedInName = null;
    player.notAvailable = true;
    return { changed: true, player: player };
  }

  function changeOwnedPlayer(state, currentPlayerId, selection, uid, displayName) {
    selection = selection || { kind: 'controller_only', playerId: null };
    var targetPlayerId = selection.kind === 'controller_only' ? null : selection.playerId;
    var outgoing = currentPlayerId ? playerById(state, currentPlayerId) : null;
    if (currentPlayerId && (!outgoing || !outgoing.checkedIn || outgoing.checkedInUid !== uid)) {
      return { changed: false, reason: 'Your current player identity is no longer available.' };
    }
    if (outgoing && currentPlayerId !== targetPlayerId && lockedIds(state).indexOf(currentPlayerId) !== -1) {
      return { changed: false, reason: outgoing.name + ' must be removed from the active or Up Next lineup before changing player.' };
    }
    var unexpectedOwnedPlayer = state.players.find(function (player) {
      return player.checkedIn && player.checkedInUid === uid && player.id !== currentPlayerId;
    });
    if (unexpectedOwnedPlayer) {
      return { changed: false, reason: 'This device is already checked in as ' + unexpectedOwnedPlayer.name + '.' };
    }

    if (selection.kind === 'new') {
      var newName = String(selection.name || '').trim().slice(0, 50);
      if (!newName) return { changed: false, reason: 'Enter your player name.' };
      if (!normalizeSkillLevel(selection.skillRating)) return { changed: false, reason: 'Choose a skill level before joining.' };
      if (state.players.some(function (player) { return player.name.toLowerCase() === newName.toLowerCase(); })) {
        return { changed: false, reason: 'That name is already in the player list.' };
      }
      if (playerById(state, selection.playerId)) return { changed: false, reason: 'Could not create a unique player entry.' };
    } else if (targetPlayerId) {
      var target = playerById(state, targetPlayerId);
      if (!target) return { changed: false, reason: 'That player is no longer in the session.' };
      if (target.checkedInUid && target.checkedInUid !== uid) {
        return { changed: false, reason: target.name + ' is already checked in on another device.' };
      }
      if (!normalizeSkillLevel(selection.skillRating)) return { changed: false, reason: 'Choose a valid skill level.' };
    }

    if (outgoing && currentPlayerId !== targetPlayerId) {
      var checkedOut = checkOutPlayer(state, currentPlayerId, uid);
      if (!checkedOut.changed) return checkedOut;
    }
    if (!targetPlayerId) {
      if (!outgoing) return { changed: false, reason: 'You are already set as Controller Only.' };
      return { changed: true, outgoing: outgoing, incoming: null };
    }

    var joined = selection.kind === 'new'
      ? enrollPlayer(state, selection.name, uid, displayName, selection.playerId, selection.skillRating)
      : checkInPlayer(state, targetPlayerId, uid, displayName, selection.skillRating);
    if (!joined.changed) return joined;
    return { changed: true, outgoing: outgoing, incoming: joined.player, player: joined.player };
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

  function skillCompositionPenalty(state, group) {
    if (state.matchmakingMode !== 'balanced') return 0;
    var players = group.map(function (id) { return playerById(state, id); }).filter(Boolean);
    if (players.length !== 4 || players.some(function (player) { return !player.skillLevelConfirmed || !normalizeSkillLevel(player.skillRating); })) return 0;
    var beginnerCount = players.filter(function (player) { return player.skillRating === 1; }).length;
    return beginnerCount === 0 || beginnerCount === 2 || beginnerCount === 4 ? 0 : 1;
  }

  function chooseAssignment(state, ids, randomFn) {
    randomFn = randomFn || Math.random;
    if (ids.length < 4) return null;
    var players = keepCompletePairs(state, ids).map(function (id) { return playerById(state, id); }).filter(Boolean);
    players.sort(function (a, b) {
      return a.games - b.games || a.lastAssignedRound - b.lastAssignedRound || a.name.localeCompare(b.name);
    });
    var pool = [], selectedIds = new Set();
    // Add complete scheduling units; a low-count player's partner may be beyond the cutoff.
    players.forEach(function (player) {
      if (selectedIds.has(player.id) || pool.length >= 12) return;
      var partner = playerById(state, partnerId(state, player.id));
      if (pool.length + (partner ? 2 : 1) > 12) return;
      pool.push(player); selectedIds.add(player.id);
      if (partner) { pool.push(partner); selectedIds.add(partner.id); }
    });
    var allPlayers = state.players.filter(function (player) { return !player.notAvailable; });
    var candidates = combinations(pool.map(function (player) { return player.id; }), 4);
    var best = null;

    candidates.forEach(function (group) {
      partitions(group).forEach(function (partition) {
        if (!validatePartnerLineup(state, partition[0], partition[1]).valid) return;
        var selected = new Set(group);
        var projected = allPlayers.map(function (player) { return player.games + (selected.has(player.id) ? 1 : 0); });
        var spread = projected.length ? Math.max.apply(Math, projected) - Math.min.apply(Math, projected) : 0;
        var compositionPenalty = skillCompositionPenalty(state, group);
        var pickedGames = group.reduce(function (sum, id) { return sum + playerById(state, id).games; }, 0);
        var backToBack = group.filter(function (id) {
          return playerById(state, id).lastAssignedRound === state.rotationRound;
        }).length;
        var waitTotal = group.reduce(function (sum, id) {
          var last = playerById(state, id).lastAssignedRound;
          return sum + (last < 0 ? state.rotationRound + 2 : state.rotationRound - last);
        }, 0);
        var teamASkill = partition[0].reduce(function (sum, id) { return sum + playerSkillWeight(playerById(state, id)); }, 0);
        var teamBSkill = partition[1].reduce(function (sum, id) { return sum + playerSkillWeight(playerById(state, id)); }, 0);
        var skillGap = state.matchmakingMode === 'balanced' ? Math.abs(teamASkill - teamBSkill) : 0;
        var teammatePairCounts = [
          partnerId(state, partition[0][0]) === partition[0][1] ? 0 : state.teammateCounts[pairKey(partition[0][0], partition[0][1])] || 0,
          partnerId(state, partition[1][0]) === partition[1][1] ? 0 : state.teammateCounts[pairKey(partition[1][0], partition[1][1])] || 0
        ];
        var teammateRepeatedPairs = teammatePairCounts.filter(function (count) { return count > 0; }).length;
        var teammateMax = Math.max.apply(null, teammatePairCounts);
        var teammateRepeats = teammatePairCounts.reduce(function (sum, count) { return sum + count; }, 0);
        var opponentPairCounts = [];
        partition[0].forEach(function (a) {
          partition[1].forEach(function (b) { opponentPairCounts.push(state.opponentCounts[pairKey(a, b)] || 0); });
        });
        var opponentRepeatedPairs = opponentPairCounts.filter(function (count) { return count > 0; }).length;
        var opponentMax = Math.max.apply(null, opponentPairCounts);
        var opponentRepeats = opponentPairCounts.reduce(function (sum, count) { return sum + count; }, 0);
        var score = [
          spread,
          compositionPenalty,
          pickedGames,
          skillGap,
          teammateRepeatedPairs,
          teammateMax,
          teammateRepeats,
          opponentRepeatedPairs,
          opponentMax,
          opponentRepeats,
          backToBack,
          -waitTotal,
          randomFn()
        ];
        if (!best || compareTuple(score, best.score) < 0) best = { teamA: partition[0], teamB: partition[1], score: score };
      });
    });
    return best;
  }

  function courtDisplayName(court) {
    return court && String(court.name || '').trim() || ('Court ' + (court ? court.courtNum : ''));
  }

  function eligibleIdsForManualCourt(state, courtIndex) {
    var court = state.courtStates[courtIndex];
    if (!court) return [];
    var currentLineup = court.nextGame ? court.nextGame.teamA.concat(court.nextGame.teamB) : [];
    var locked = new Set(lockedIds(state));
    currentLineup.forEach(function (id) { locked.delete(id); });
    var skillGroup = court.nextGame ? court.nextGame.skillGroup : court.skillGroup;
    return keepCompletePairs(state, state.players.filter(function (player) {
      return !locked.has(player.id) && !player.notAvailable && playerMatchesSkillGroup(player, skillGroup);
    }).map(function (player) { return player.id; }));
  }

  function setNextLineup(court, teamA, teamB, source, now, skillGroup) {
    court.nextGame = {
      gameNum: (Number(court.gameNum) || 0) + 1,
      teamA: teamA.slice(),
      teamB: teamB.slice(),
      preparedAt: Number(now) || Date.now(),
      source: source === 'manual' ? 'manual' : 'auto',
      skillGroup: normalizeSkillGroup(skillGroup)
    };
  }

  function deterministicFallbackAssignment(state, ids) {
    if ((state.partnerships || []).length) {
      var paired = chooseAssignment(state, ids, function () { return 0; });
      if (paired) paired.fallback = true;
      return paired;
    }
    var selected = ids.map(function (id) { return playerById(state, id); }).filter(Boolean).sort(function (a, b) {
      return a.games - b.games
        || a.lastAssignedRound - b.lastAssignedRound
        || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }).slice(0, 4).map(function (player) { return player.id; });
    if (selected.length < 4) return null;
    var best = null;
    partitions(selected).forEach(function (partition) {
      var teamASkill = partition[0].reduce(function (sum, id) { return sum + playerSkillWeight(playerById(state, id)); }, 0);
      var teamBSkill = partition[1].reduce(function (sum, id) { return sum + playerSkillWeight(playerById(state, id)); }, 0);
      var teammateRepeats = (state.teammateCounts[pairKey(partition[0][0], partition[0][1])] || 0)
        + (state.teammateCounts[pairKey(partition[1][0], partition[1][1])] || 0);
      var opponentRepeats = 0;
      partition[0].forEach(function (a) {
        partition[1].forEach(function (b) { opponentRepeats += state.opponentCounts[pairKey(a, b)] || 0; });
      });
      var score = [state.matchmakingMode === 'balanced' ? Math.abs(teamASkill - teamBSkill) : 0, teammateRepeats, opponentRepeats];
      if (!best || compareTuple(score, best.score) < 0) {
        best = { teamA: partition[0], teamB: partition[1], score: score, fallback: true };
      }
    });
    return best;
  }

  function prepareNextGame(state, courtIndex, randomFn, now) {
    var court = state.courtStates[courtIndex];
    if (!court) return { changed: false, reasonCode: 'court_not_found', reason: 'Court not found.' };
    if (court.nextGame) return {
      changed: false,
      reasonCode: 'already_prepared',
      reason: courtDisplayName(court) + ' already has an Up Next lineup.'
    };
    var skillGroup = court.skillGroup;
    var breakdown = preparationBreakdown(state, courtIndex, skillGroup);
    var available = eligibleIdsForCourt(state, courtIndex);
    if (available.length < 4) {
      return {
        changed: false,
        reasonCode: 'insufficient_eligible',
        requiredCount: 4,
        eligibleCount: available.length,
        breakdown: breakdown,
        reason: courtDisplayName(court) + ' needs 4 available ' + skillGroupLabel(skillGroup)
          + ' players; only ' + available.length + ' eligible.'
          + (breakdown.partnerUnavailable ? ' ' + breakdown.partnerUnavailable + ' waiting for an unavailable partner.' : '')
          + (breakdown.partnerReserved ? ' ' + breakdown.partnerReserved + ' waiting for a reserved partner.' : '')
          + (breakdown.partnerSkillMismatch ? ' ' + breakdown.partnerSkillMismatch + ' have a partner ineligible for this court.' : '')
      };
    }
    var assignment = chooseAssignment(state, available, randomFn);
    if (!assignment) assignment = deterministicFallbackAssignment(state, available);
    if (!assignment) return {
      changed: false,
      reasonCode: 'assignment_failed',
      requiredCount: 4,
      eligibleCount: available.length,
      breakdown: breakdown,
      reason: 'Could not build a fair game from the eligible players.'
    };
    setNextLineup(court, assignment.teamA, assignment.teamB, 'auto', now, skillGroup);
    return { changed: true, court: court, nextGame: court.nextGame, usedFallback: !!assignment.fallback };
  }

  function prepareManualNextGame(state, courtIndex, teamA, teamB, now) {
    var court = state.courtStates[courtIndex];
    if (!court) return { changed: false, reason: 'Court not found.' };
    teamA = Array.isArray(teamA) ? teamA : [];
    teamB = Array.isArray(teamB) ? teamB : [];
    var lineup = teamA.concat(teamB);
    if (teamA.length !== 2 || teamB.length !== 2 || new Set(lineup).size !== 4) {
      return { changed: false, reason: 'Choose four different players.' };
    }
    var pairCheck = validatePartnerLineup(state, teamA, teamB);
    if (!pairCheck.valid) return { changed: false, reason: pairCheck.reason };
    var eligible = new Set(eligibleIdsForManualCourt(state, courtIndex));
    if (!lineup.every(function (id) { return eligible.has(id); })) {
      return { changed: false, reason: 'Every player must be available and eligible for this court.' };
    }
    var skillGroup = court.nextGame ? court.nextGame.skillGroup : court.skillGroup;
    setNextLineup(court, teamA, teamB, 'manual', now, skillGroup);
    return { changed: true, court: court, nextGame: court.nextGame };
  }

  function startNextGame(state, courtIndex, now) {
    var court = state.courtStates[courtIndex];
    if (!court || !court.nextGame) return { changed: false, reason: 'Prepare a complete Up Next lineup first.' };
    if (court.status === 'playing') return { changed: false, reason: 'Record the current winner before starting the next game.' };
    var next = court.nextGame;
    var pairCheck = validatePartnerLineup(state, next.teamA, next.teamB);
    if (!pairCheck.valid) return { changed: false, reason: pairCheck.reason };
    var eligible = new Set(eligibleIdsForManualCourt(state, courtIndex));
    if (!next.teamA.concat(next.teamB).every(function (id) { return eligible.has(id); })) {
      return { changed: false, reason: 'A prepared player or partner is no longer eligible. Edit the lineup first.' };
    }
    state.rotationRound += 1;
    court.status = 'playing';
    court.gameNum = next.gameNum;
    court.teamA = next.teamA.slice();
    court.teamB = next.teamB.slice();
    court.winner = null;
    court.assignmentRound = state.rotationRound;
    court.previousLastAssigned = {};
    court.startedAt = Number(now) || Date.now();
    court.activeTimeLimitMinutes = normalizeTimeLimit(court.timeLimitMinutes);
    court.deadlineAt = court.activeTimeLimitMinutes
      ? court.startedAt + court.activeTimeLimitMinutes * 60 * 1000 : null;
    court.stagedAt = null;
    court.stagedSource = null;
    court.nextGame = null;
    court.teamA.concat(court.teamB).forEach(function (id) {
      var player = playerById(state, id);
      court.previousLastAssigned[id] = player.lastAssignedRound;
      player.games += 1;
      player.lastAssignedRound = state.rotationRound;
    });
    return { changed: true, court: court };
  }

  function clearNextGame(state, courtIndex) {
    var court = state.courtStates[courtIndex];
    if (!court || !court.nextGame) return { changed: false, reason: 'There is no Up Next lineup to remove.' };
    court.nextGame = null;
    return { changed: true, court: court };
  }

  function stageGame(state, courtIndex, randomFn, now) {
    return prepareNextGame(state, courtIndex, randomFn, now);
  }

  function stageManualGame(state, courtIndex, teamA, teamB, now) {
    return prepareManualNextGame(state, courtIndex, teamA, teamB, now);
  }

  function startStagedGame(state, courtIndex, now) {
    return startNextGame(state, courtIndex, now);
  }

  function clearStagedGame(state, courtIndex) {
    return clearNextGame(state, courtIndex);
  }

  function assignGame(state, courtIndex, randomFn, now) {
    var prepared = prepareNextGame(state, courtIndex, randomFn, now);
    if (!prepared.changed) return prepared;
    return startNextGame(state, courtIndex, now);
  }

  function incrementPair(map, a, b) {
    var key = pairKey(a, b);
    map[key] = (map[key] || 0) + 1;
  }

  function promotePreparedCourt(court) {
    if (!court || !court.nextGame) return;
    court.status = 'empty';
    court.teamA = [];
    court.teamB = [];
    court.winner = null;
    court.assignmentRound = 0;
    court.previousLastAssigned = {};
    court.startedAt = null;
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
    var endedAt = Number(now) || Date.now();
    var historyEntry = {
      courtNum: court.courtNum,
      courtName: courtDisplayName(court),
      gameNum: court.gameNum,
      teamA: court.teamA.slice(),
      teamB: court.teamB.slice(),
      teamANames: court.teamA.map(function (id) { return playerName(state, id); }),
      teamBNames: court.teamB.map(function (id) { return playerName(state, id); }),
      winner: winner,
      startedAt: court.startedAt,
      endedAt: endedAt,
      durationMs: court.startedAt ? Math.max(0, endedAt - court.startedAt) : null,
      timeLimitMinutes: normalizeTimeLimit(court.activeTimeLimitMinutes),
      finishedAfterTimeLimit: !!(court.deadlineAt && endedAt >= court.deadlineAt),
      ts: endedAt
    };
    state.history.unshift(historyEntry);
    court.activeTimeLimitMinutes = null;
    court.deadlineAt = null;
    state.history = state.history.slice(0, 100);
    if (court.nextGame) promotePreparedCourt(court);
    return { changed: true, winners: winners.slice(), court: court, historyEntry: historyEntry };
  }

  function recordWinnerAndPrepareNext(state, courtIndex, winner, randomFn, now) {
    var court = state.courtStates[courtIndex];
    var hadPreparedGame = !!(court && court.nextGame);
    var completed = recordWinner(state, courtIndex, winner, now);
    if (!completed.changed) return completed;
    if (hadPreparedGame) {
      completed.promotedPreparedGame = true;
      completed.nextGame = completed.court.nextGame;
      return completed;
    }
    var preparation = prepareNextGame(state, courtIndex, randomFn, now);
    completed.autoPreparation = preparation;
    if (preparation.changed) {
      promotePreparedCourt(completed.court);
      completed.autoPreparedNext = true;
      completed.nextGame = completed.court.nextGame;
    }
    return completed;
  }

  function replacePlayer(state, courtIndex, team, playerIndex, replacementId) {
    var court = state.courtStates[courtIndex];
    if (!court || court.status !== 'playing') return { changed: false, reason: 'Game is not active.' };
    if (eligibleIdsForCourt(state, courtIndex).indexOf(replacementId) === -1) {
      return { changed: false, reason: 'Replacement is no longer available or does not match this court.' };
    }
    var target = team === 'A' ? court.teamA : court.teamB;
    var outgoingId = target[playerIndex];
    var outgoing = playerById(state, outgoingId);
    var incoming = playerById(state, replacementId);
    if (!outgoing || !incoming) return { changed: false, reason: 'Player could not be found.' };
    if (partnerId(state, outgoingId) || partnerId(state, replacementId)) {
      return { changed: false, reason: 'A single-player replacement cannot split a fixed partnership.' };
    }
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

  function fairReplacement(state, courtIndex) {
    var ids = eligibleIdsForCourt(state, courtIndex).filter(function (id) { return !partnerId(state, id); });
    ids.sort(function (a, b) {
      var pa = playerById(state, a), pb = playerById(state, b);
      return pa.games - pb.games || pa.lastAssignedRound - pb.lastAssignedRound || pa.name.localeCompare(pb.name);
    });
    return ids[0] || null;
  }

  function resetCourts(state) {
    var skillGroups = state.courtStates.map(function (court) { return normalizeSkillGroup(court.skillGroup); });
    var courtNames = state.courtStates.map(function (court) { return courtDisplayName(court); });
    var timeLimits = state.courtStates.map(function (court) { return normalizeTimeLimit(court.timeLimitMinutes); });
    state.history = [];
    state.teammateCounts = {};
    state.opponentCounts = {};
    state.courtStates = [];
    initCourtStates(state, state.courts);
    state.courtStates.forEach(function (court, index) {
      court.skillGroup = skillGroups[index] || 'any';
      court.name = courtNames[index] || ('Court ' + (index + 1));
      court.timeLimitMinutes = timeLimits[index];
    });
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
    SKILL_LEVELS: SKILL_LEVELS,
    SKILL_GROUPS: SKILL_GROUPS,
    clone: clone,
    makeId: makeId,
    createState: createState,
    normalizeState: normalizeState,
    migrateLegacy: migrateLegacy,
    initCourtStates: initCourtStates,
    playerById: playerById,
    playerName: playerName,
    partnerId: partnerId,
    partnerRecord: partnerRecord,
    partnerAction: partnerAction,
    normalizePartnerships: normalizePartnerships,
    validatePartnerLineup: validatePartnerLineup,
    validatePartnerState: validatePartnerState,
    deterministicFallbackAssignment: deterministicFallbackAssignment,
    skillLevelByValue: skillLevelByValue,
    skillLevelLabel: skillLevelLabel,
    normalizeSkillLevel: normalizeSkillLevel,
    normalizeSkillGroup: normalizeSkillGroup,
    normalizeTimeLimit: normalizeTimeLimit,
    skillGroupLabel: skillGroupLabel,
    courtDisplayName: courtDisplayName,
    playerSkillWeight: playerSkillWeight,
    playerMatchesSkillGroup: playerMatchesSkillGroup,
    activeIds: activeIds,
    nextIds: nextIds,
    lockedIds: lockedIds,
    availableIds: availableIds,
    eligibleIdsForCourt: eligibleIdsForCourt,
    preparationBreakdown: preparationBreakdown,
    eligibleIdsForManualCourt: eligibleIdsForManualCourt,
    courtFillOrder: courtFillOrder,
    courtPreparationOrder: courtPreparationOrder,
    compareStandings: compareStandings,
    rankedPlayers: rankedPlayers,
    enrollPlayer: enrollPlayer,
    checkInPlayer: checkInPlayer,
    setSelfSkillRating: setSelfSkillRating,
    setSelfAvailability: setSelfAvailability,
    checkOutPlayer: checkOutPlayer,
    changeOwnedPlayer: changeOwnedPlayer,
    pairKey: pairKey,
    chooseAssignment: chooseAssignment,
    prepareNextGame: prepareNextGame,
    prepareManualNextGame: prepareManualNextGame,
    startNextGame: startNextGame,
    clearNextGame: clearNextGame,
    stageGame: stageGame,
    stageManualGame: stageManualGame,
    startStagedGame: startStagedGame,
    clearStagedGame: clearStagedGame,
    assignGame: assignGame,
    recordWinner: recordWinner,
    recordWinnerAndPrepareNext: recordWinnerAndPrepareNext,
    replacePlayer: replacePlayer,
    fairReplacement: fairReplacement,
    resetCourts: resetCourts,
    resetStatistics: resetStatistics
  };
});
