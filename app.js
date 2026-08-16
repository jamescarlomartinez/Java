'use strict';

var Engine = window.PickleballRotation;
var LOCAL_KEY = 'pickleballRotation_v3';
var LEGACY_KEY = 'pickleballRotation_v2';
var ROOM_PARAM = 'room';
var EVENT_LIMIT = 100;
var UNDO_LIMIT = 10;
var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

var S = Engine.createState(2);
var roomId = new URLSearchParams(window.location.search).get(ROOM_PARAM);
var roomRef = null;
var roomData = null;
var currentUser = null;
var controllerName = '';
var isOrganizer = false;
var roomUnsubscribe = null;
var eventsUnsubscribe = null;
var activityEvents = [];
var activityOpen = false;
var historyOpen = false;
var swapState = null;
var sharedBusy = false;
var syncStatus = roomId ? 'syncing' : 'connected';
var appInitialised = false;
var toastTimer = null;
var deferredPrompt = null;
var organizerGrantId = null;

var firebaseConfig = {
  apiKey: 'AIzaSyCTZbXBiBXQ84laGdunFtRPkyA5uCWfVvc',
  authDomain: 'pickleball-rotation.firebaseapp.com',
  projectId: 'pickleball-rotation',
  storageBucket: 'pickleball-rotation.firebasestorage.app',
  messagingSenderId: '103026729080',
  appId: '1:103026729080:web:e4087895e44f190efa0d8d'
};

firebase.initializeApp(firebaseConfig);
var fbAuth = firebase.auth();
var fbDb = firebase.firestore();
var FieldValue = firebase.firestore.FieldValue;
var Timestamp = firebase.firestore.Timestamp;

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setAuthMessage(title, copy, showGoogleButton) {
  var overlay = document.getElementById('authOverlay');
  overlay.classList.remove('hidden');
  overlay.querySelector('.auth-title').textContent = title;
  overlay.querySelector('.auth-sub').textContent = copy;
  document.getElementById('signInBtn').style.display = showGoogleButton ? '' : 'none';
}

function showAuthError(message) {
  var error = document.getElementById('authError');
  error.textContent = message;
  error.classList.add('show');
}

function hideAuth() {
  document.getElementById('authOverlay').classList.add('hidden');
  document.getElementById('authError').classList.remove('show');
}

function openModal(options) {
  options = options || {};
  var overlay = document.getElementById('appModal');
  document.getElementById('modalTitle').textContent = options.title || '';
  document.getElementById('modalCopy').textContent = options.copy || '';
  document.getElementById('modalBody').innerHTML = options.body || '';
  document.getElementById('modalActions').innerHTML = '';
  var close = document.getElementById('modalCloseBtn');
  close.style.display = options.closable === false ? 'none' : '';
  close.onclick = options.onClose || closeModal;
  overlay.onclick = function (event) {
    if (event.target === overlay && options.closable !== false) closeModal();
  };
  overlay.classList.add('visible');
  return {
    body: document.getElementById('modalBody'),
    actions: document.getElementById('modalActions')
  };
}

function closeModal() {
  document.getElementById('appModal').classList.remove('visible');
}

function askText(options) {
  return new Promise(function (resolve) {
    var modal = openModal({
      title: options.title,
      copy: options.copy,
      body: '<input class="modal-field" id="modalTextInput" maxlength="' + (options.maxLength || 50) + '" autocomplete="off">',
      closable: options.closable !== false,
      onClose: function () { closeModal(); resolve(null); }
    });
    var input = document.getElementById('modalTextInput');
    input.value = options.value || '';
    var cancel = document.createElement('button');
    cancel.className = 'btn btn-ghost';
    cancel.textContent = 'Cancel';
    cancel.style.display = options.closable === false ? 'none' : '';
    cancel.onclick = function () { closeModal(); resolve(null); };
    var confirmButton = document.createElement('button');
    confirmButton.className = 'btn btn-primary';
    confirmButton.textContent = options.confirmLabel || 'Continue';
    function submit() {
      var value = input.value.trim();
      if (!value) { input.focus(); return; }
      closeModal();
      resolve(value);
    }
    confirmButton.onclick = submit;
    input.onkeydown = function (event) { if (event.key === 'Enter') submit(); };
    modal.actions.appendChild(cancel);
    modal.actions.appendChild(confirmButton);
    setTimeout(function () { input.focus(); input.select(); }, 30);
  });
}

function showToast(message) {
  var toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
}

function showMsg(text, type) {
  var element = document.getElementById('msgBox');
  element.className = 'msg-box ' + (type || 'info');
  element.textContent = text;
}

function clearMsg() {
  var element = document.getElementById('msgBox');
  element.className = 'msg-box';
  element.textContent = '';
}

function loadLocalState() {
  try {
    var current = localStorage.getItem(LOCAL_KEY);
    if (current) return Engine.normalizeState(JSON.parse(current));
    var legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      var migrated = Engine.migrateLegacy(JSON.parse(legacy));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.warn('Could not load local game:', error);
  }
  return Engine.createState(2);
}

function saveLocalState() {
  if (roomId) return;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(S)); } catch (error) { console.warn('Could not save local game:', error); }
}

function defaultSessionName() {
  var date = new Date();
  return 'Open Play — ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function controllerStorageKey() {
  return 'pickleballController_' + roomId;
}

function ensureControllerName(user) {
  var saved = localStorage.getItem(controllerStorageKey());
  var suggestion = saved || (user && user.displayName) || '';
  if (suggestion) {
    controllerName = suggestion.slice(0, 30);
    return Promise.resolve(controllerName);
  }
  return askText({
    title: 'Join live game',
    copy: 'Enter the name other controllers will see in the activity log.',
    value: '',
    maxLength: 30,
    confirmLabel: 'Join Game',
    closable: false
  }).then(function (name) {
    controllerName = (name || 'Guest').slice(0, 30);
    localStorage.setItem(controllerStorageKey(), controllerName);
    return controllerName;
  });
}

function initSolo() {
  roomId = null;
  S = loadLocalState();
  appInitialised = true;
  hideAuth();
  document.getElementById('signOutWrap').style.display = 'block';
  initUi();
  renderAll();
}

function initSharedRoom(user) {
  if (appInitialised) return;
  appInitialised = true;
  setAuthMessage('Joining live game', 'Connecting to the shared rotation…', false);
  currentUser = user;
  roomRef = fbDb.collection('rooms').doc(roomId);
  ensureControllerName(user).then(function () {
    roomRef.get().then(function (snapshot) {
      if (!snapshot.exists) throw new Error('This shared game does not exist or has expired.');
      roomData = snapshot.data();
      isOrganizer = roomData.hostUid === currentUser.uid;
      return fbDb.collection('roomMembers').doc(roomId + '_' + currentUser.uid).set({
        roomId: roomId,
        uid: currentUser.uid,
        displayName: controllerName,
        joinedAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiry()
      }, { merge: true });
    }).then(function () {
      hideAuth();
      document.getElementById('signOutWrap').style.display = 'block';
      initUi();
      subscribeToRoom();
      subscribeToEvents();
    }).catch(function (error) {
      appInitialised = false;
      setAuthMessage('Could not join game', error.message || 'The shared room is unavailable.', false);
      showAuthError(error.message || 'The shared room is unavailable.');
    });
  });
}

function subscribeToRoom() {
  if (roomUnsubscribe) roomUnsubscribe();
  roomUnsubscribe = roomRef.onSnapshot({ includeMetadataChanges: true }, function (snapshot) {
    if (!snapshot.exists) {
      syncStatus = 'error';
      showMsg('This shared game has expired or was removed.', 'error');
      renderSessionCard();
      return;
    }
    roomData = snapshot.data();
    S = Engine.normalizeState(roomData.state);
    isOrganizer = roomData.hostUid === currentUser.uid;
    if (roomData.status === 'ended') syncStatus = 'ended';
    else if (!navigator.onLine || snapshot.metadata.fromCache) syncStatus = 'offline';
    else if (snapshot.metadata.hasPendingWrites || sharedBusy) syncStatus = 'syncing';
    else syncStatus = 'connected';
    renderAll();
  }, function (error) {
    syncStatus = 'error';
    showMsg('Live sync error: ' + error.message, 'error');
    renderSessionCard();
  });
}

function subscribeToEvents() {
  if (eventsUnsubscribe) eventsUnsubscribe();
  eventsUnsubscribe = fbDb.collection('roomEvents')
    .where('roomId', '==', roomId)
    .orderBy('createdAt', 'desc')
    .limit(EVENT_LIMIT)
    .onSnapshot(function (snapshot) {
      activityEvents = snapshot.docs.map(function (doc) {
        var data = doc.data(); data.id = doc.id; return data;
      });
      renderActivitySection();
    }, function (error) {
      console.warn('Activity feed unavailable:', error);
      activityEvents = [];
      renderActivitySection();
    });
}

function initUi() {
  var playerInput = document.getElementById('playerInput');
  playerInput.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); addPlayer(); } };
  updateOnlineStatus();
}

function eventExpiry() {
  return Timestamp.fromMillis(Date.now() + THIRTY_DAYS + 24 * 60 * 60 * 1000);
}

function runAction(type, reducer, options) {
  options = options || {};
  if (!roomId) {
    var localResult = reducer(S);
    if (!localResult || localResult.changed === false) {
      if (localResult && localResult.reason) showToast(localResult.reason);
      return Promise.resolve(localResult);
    }
    saveLocalState();
    renderAll();
    if (localResult.message) showToast(localResult.message);
    return Promise.resolve(localResult);
  }
  if (!navigator.onLine) { showToast('Reconnect to control the shared game.'); return Promise.resolve(null); }
  if (!roomData || roomData.status !== 'active') { showToast('This shared session is read-only.'); return Promise.resolve(null); }
  if (options.hostOnly && !isOrganizer) { showToast('Only the organizer can do that.'); return Promise.resolve(null); }

  sharedBusy = true;
  syncStatus = 'syncing';
  renderSessionCard();
  syncControlState();
  var eventRef = fbDb.collection('roomEvents').doc();
  var resultForMessage = null;

  return fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (snapshot) {
      if (!snapshot.exists) throw new Error('Shared game no longer exists.');
      var data = snapshot.data();
      if (data.status !== 'active') throw new Error('Shared game has ended.');
      if (options.hostOnly && data.hostUid !== currentUser.uid) throw new Error('Organizer permission required.');
      var beforeState = Engine.normalizeState(data.state);
      var nextState = Engine.clone(beforeState);
      var result = reducer(nextState);
      if (!result || result.changed === false) throw new Error((result && result.reason) || 'Nothing changed.');
      resultForMessage = result;
      var nextRevision = (Number(data.revision) || 0) + 1;
      var stack = Array.isArray(data.undoStack) ? data.undoStack.slice() : [];
      if (options.undoable !== false) stack = stack.concat(eventRef.id).slice(-UNDO_LIMIT);
      transaction.update(roomRef, {
        state: nextState,
        revision: nextRevision,
        updatedAt: FieldValue.serverTimestamp(),
        lastEventId: eventRef.id,
        undoStack: stack
      });
      transaction.set(eventRef, {
        roomId: roomId,
        revision: nextRevision,
        type: type,
        summary: result.summary || result.message || type,
        actorUid: currentUser.uid,
        actorName: controllerName,
        beforeState: beforeState,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiry()
      });
    });
  }).then(function () {
    if (resultForMessage && resultForMessage.message) showToast(resultForMessage.message);
    clearMsg();
    return resultForMessage;
  }).catch(function (error) {
    showToast(error.message || 'Could not update the shared game.');
    return null;
  }).finally(function () {
    sharedBusy = false;
    syncStatus = navigator.onLine ? 'connected' : 'offline';
    renderSessionCard();
    syncControlState();
  });
}

function addPlayer() {
  var input = document.getElementById('playerInput');
  var name = input.value.trim();
  if (!name) { showToast('Please enter a player name.'); return; }
  runAction('player_added', function (state) {
    if (state.players.some(function (player) { return player.name.toLowerCase() === name.toLowerCase(); })) {
      return { changed: false, reason: '"' + name + '" is already in the list.' };
    }
    state.players.push({ id: Engine.makeId('p'), name: name, games: 0, wins: 0, notAvailable: false, lastAssignedRound: -1 });
    return { changed: true, message: name + ' added.', summary: 'Added player ' + name };
  }).then(function (result) { if (result && result.changed) { input.value = ''; input.focus(); } });
}

function removePlayer(index) {
  var player = S.players[index];
  if (!player) return;
  if (Engine.lockedIds(S).indexOf(player.id) !== -1) { showToast(player.name + ' is in an active game.'); return; }
  if (!confirm('Remove "' + player.name + '" from the list?')) return;
  runAction('player_removed', function (state) {
    var target = state.players.find(function (item) { return item.id === player.id; });
    if (!target || Engine.lockedIds(state).indexOf(target.id) !== -1) return { changed: false, reason: 'Player is no longer removable.' };
    state.players = state.players.filter(function (item) { return item.id !== target.id; });
    return { changed: true, message: target.name + ' removed.', summary: 'Removed player ' + target.name };
  });
}

function clearAllPlayers() {
  if (!S.players.length) { showToast('No players to clear.'); return; }
  if (!confirm('Clear every player, court, statistic, and game record?')) return;
  runAction('players_cleared', function (state) {
    var courts = state.courts;
    var fresh = Engine.createState(courts);
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.assign(state, fresh);
    return { changed: true, message: 'All players and game data cleared.', summary: 'Cleared all players and game data' };
  }, { hostOnly: true });
}

function toggleNotAvailable(index) {
  var player = S.players[index];
  if (!player) return;
  runAction('availability_changed', function (state) {
    var target = Engine.playerById(state, player.id);
    if (!target) return { changed: false, reason: 'Player not found.' };
    if (Engine.lockedIds(state).indexOf(target.id) !== -1) return { changed: false, reason: target.name + ' is on court.' };
    target.notAvailable = !target.notAvailable;
    return {
      changed: true,
      message: target.name + (target.notAvailable ? ' is sitting out.' : ' is available.'),
      summary: (target.notAvailable ? 'Marked ' : 'Returned ') + target.name + (target.notAvailable ? ' unavailable' : ' to rotation')
    };
  });
}

function setCourts(count) {
  count = Number(count);
  if (count === S.courts) return;
  if (count < S.courts && S.courtStates.slice(count).some(function (court) { return court.status === 'playing'; })) {
    if (!confirm('Reducing courts will end games on removed courts. Continue?')) return;
  }
  runAction('courts_changed', function (state) {
    Engine.initCourtStates(state, count);
    return { changed: true, message: 'Now using ' + count + ' court' + (count === 1 ? '' : 's') + '.', summary: 'Changed court count to ' + count };
  });
}

function generateForCourt(index) {
  runAction('game_started', function (state) {
    var result = Engine.assignGame(state, index);
    if (!result.changed) return result;
    var names = result.court.teamA.concat(result.court.teamB).map(function (id) { return Engine.playerName(state, id); });
    return {
      changed: true,
      message: 'Court ' + result.court.courtNum + ' — Game ' + result.court.gameNum + ' started!',
      summary: 'Started Court ' + result.court.courtNum + ': ' + names.join(', ')
    };
  });
}

function fillAvailableCourts() {
  runAction('courts_filled', function (state) {
    var filled = [];
    state.courtStates.forEach(function (court, index) {
      if (court.status !== 'playing') {
        var result = Engine.assignGame(state, index);
        if (result.changed) filled.push(result.court.courtNum);
      }
    });
    if (!filled.length) return { changed: false, reason: 'All courts are active or fewer than 4 players are available.' };
    return {
      changed: true,
      message: 'Started ' + filled.length + ' fair game' + (filled.length === 1 ? '' : 's') + '!',
      summary: 'Filled courts ' + filled.join(', ')
    };
  });
}

function recordWinner(index, winner) {
  runAction('winner_recorded', function (state) {
    var result = Engine.recordWinner(state, index, winner);
    if (!result.changed) return { changed: false, reason: 'This game is no longer active.' };
    var names = result.winners.map(function (id) { return Engine.playerName(state, id); });
    return {
      changed: true,
      message: 'Court ' + result.court.courtNum + ' — ' + names.join(' & ') + ' won! 🏆',
      summary: 'Recorded ' + names.join(' & ') + ' as winners on Court ' + result.court.courtNum
    };
  });
}

function resetAllCourts() {
  if (!confirm('Reset all courts and clear game history? Player statistics will be kept.')) return;
  runAction('courts_reset', function (state) {
    Engine.resetCourts(state);
    return { changed: true, message: 'All courts reset. Statistics preserved.', summary: 'Reset all courts and game history' };
  }, { hostOnly: true });
}

function resetStats() {
  if (!confirm('Reset games, wins, matchup history, and game history?')) return;
  runAction('statistics_reset', function (state) {
    Engine.resetStatistics(state);
    return { changed: true, message: 'Player statistics reset.', summary: 'Reset all statistics and matchup history' };
  }, { hostOnly: true });
}

function startSwap(courtIndex, team, playerIndex) {
  if (swapState && swapState.courtIndex === courtIndex && swapState.team === team && swapState.playerIndex === playerIndex) swapState = null;
  else swapState = { courtIndex: courtIndex, team: team, playerIndex: playerIndex };
  renderCourtsSection();
  syncControlState();
}

function executeSwap(courtIndex, targetTeam, targetIndex) {
  if (!swapState || swapState.courtIndex !== courtIndex) return;
  var source = Object.assign({}, swapState);
  swapState = null;
  runAction('players_swapped', function (state) {
    var court = state.courtStates[courtIndex];
    if (!court || court.status !== 'playing') return { changed: false, reason: 'Game is no longer active.' };
    var sourceTeam = source.team === 'A' ? court.teamA : court.teamB;
    var destinationTeam = targetTeam === 'A' ? court.teamA : court.teamB;
    var sourceId = sourceTeam[source.playerIndex];
    var targetId = destinationTeam[targetIndex];
    sourceTeam[source.playerIndex] = targetId;
    destinationTeam[targetIndex] = sourceId;
    var sourceName = Engine.playerName(state, sourceId);
    var targetName = Engine.playerName(state, targetId);
    return { changed: true, message: sourceName + ' ⇄ ' + targetName + ' swapped teams.', summary: 'Swapped ' + sourceName + ' and ' + targetName };
  });
}

function openReplacementPicker(courtIndex, team, playerIndex) {
  var court = S.courtStates[courtIndex];
  if (!court || court.status !== 'playing') return;
  var outgoingId = (team === 'A' ? court.teamA : court.teamB)[playerIndex];
  var outgoingName = Engine.playerName(S, outgoingId);
  var ids = Engine.availableIds(S);
  if (!ids.length) { showToast('No available players can replace ' + outgoingName + '.'); return; }
  ids.sort(function (a, b) {
    var pa = Engine.playerById(S, a), pb = Engine.playerById(S, b);
    return pa.games - pb.games || pa.lastAssignedRound - pb.lastAssignedRound || pa.name.localeCompare(pb.name);
  });
  var modal = openModal({
    title: 'Replace ' + outgoingName,
    copy: 'Choose a waiting player. ' + outgoingName + ' will return to the available pool.',
    body: '<div class="picker-list" id="replacementList"></div>'
  });
  var list = modal.body.querySelector('#replacementList');
  var automatic = document.createElement('button');
  automatic.className = 'picker-option';
  automatic.innerHTML = '<strong>✨ Auto-pick fairest</strong><br><small>Lowest games played, then longest wait</small>';
  automatic.onclick = function () { closeModal(); replaceCurrentPlayer(courtIndex, team, playerIndex, Engine.fairReplacement(S), outgoingId); };
  list.appendChild(automatic);
  ids.forEach(function (id) {
    var player = Engine.playerById(S, id);
    var button = document.createElement('button');
    button.className = 'picker-option';
    button.textContent = player.name + ' · ' + player.games + ' game' + (player.games === 1 ? '' : 's');
    button.onclick = function () { closeModal(); replaceCurrentPlayer(courtIndex, team, playerIndex, id, outgoingId); };
    list.appendChild(button);
  });
}

function replaceCurrentPlayer(courtIndex, team, playerIndex, replacementId, expectedOutgoingId) {
  if (!replacementId) return;
  runAction('player_replaced', function (state) {
    var currentCourt = state.courtStates[courtIndex];
    var currentTeam = currentCourt && (team === 'A' ? currentCourt.teamA : currentCourt.teamB);
    if (!currentTeam || (expectedOutgoingId && currentTeam[playerIndex] !== expectedOutgoingId)) {
      return { changed: false, reason: 'That court changed. Open Replace again to use the latest lineup.' };
    }
    var result = Engine.replacePlayer(state, courtIndex, team, playerIndex, replacementId);
    if (!result.changed) return result;
    return {
      changed: true,
      message: result.outgoing.name + ' → ' + result.incoming.name + ' on court.',
      summary: 'Replaced ' + result.outgoing.name + ' with ' + result.incoming.name
    };
  });
}

function skipPlayer(courtIndex, team, playerIndex) {
  var replacementId = Engine.fairReplacement(S);
  if (!replacementId) { showToast('No available replacement player.'); return; }
  replaceCurrentPlayer(courtIndex, team, playerIndex, replacementId);
}

function createSharedRoom() {
  if (roomId || !currentUser || currentUser.isAnonymous) return;
  askText({
    title: 'Share current game',
    copy: 'Your current players, courts, active games, and statistics will become a live room.',
    value: defaultSessionName(),
    maxLength: 60,
    confirmLabel: 'Create Live Room'
  }).then(function (name) {
    if (!name) return;
    var newRoomRef = fbDb.collection('rooms').doc();
    var initialEvent = fbDb.collection('roomEvents').doc();
    var batch = fbDb.batch();
    batch.set(newRoomRef, {
      schemaVersion: 1,
      name: name,
      hostUid: currentUser.uid,
      hostName: currentUser.displayName || currentUser.email || 'Organizer',
      hostEmail: currentUser.email,
      organizerGrantId: organizerGrantId,
      status: 'active',
      revision: 0,
      state: Engine.normalizeState(S),
      undoStack: [],
      lastEventId: initialEvent.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      endedAt: null,
      expiresAt: null
    });
    batch.set(initialEvent, {
      roomId: newRoomRef.id,
      revision: 0,
      type: 'room_created',
      summary: 'Created the live room from the organizer’s current game',
      actorUid: currentUser.uid,
      actorName: currentUser.displayName || currentUser.email || 'Organizer',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: eventExpiry()
    });
    batch.set(fbDb.collection('roomMembers').doc(newRoomRef.id + '_' + currentUser.uid), {
      roomId: newRoomRef.id,
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || 'Organizer',
      joinedAt: FieldValue.serverTimestamp(),
      expiresAt: eventExpiry()
    });
    syncStatus = 'syncing';
    renderSessionCard();
    batch.commit().then(function () {
      window.location.href = window.location.pathname + '?' + ROOM_PARAM + '=' + encodeURIComponent(newRoomRef.id);
    }).catch(function (error) {
      syncStatus = 'error';
      renderSessionCard();
      showToast('Could not create shared room: ' + error.message);
    });
  });
}

function sharedRoomUrl() {
  return window.location.origin + window.location.pathname + '?' + ROOM_PARAM + '=' + encodeURIComponent(roomId);
}

function copyShareLink() {
  var url = sharedRoomUrl();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { showToast('Live game link copied.'); });
  } else {
    var textarea = document.createElement('textarea');
    textarea.value = url; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    showToast('Live game link copied.');
  }
}

function shareRoomLink() {
  var payload = { title: roomData ? roomData.name : 'Pickleball Game Rotation', text: 'Join and control our live pickleball rotation.', url: sharedRoomUrl() };
  if (navigator.share) navigator.share(payload).catch(function (error) { if (error.name !== 'AbortError') copyShareLink(); });
  else copyShareLink();
}

function leaveSharedRoom() {
  if (roomUnsubscribe) roomUnsubscribe();
  if (eventsUnsubscribe) eventsUnsubscribe();
  window.location.href = window.location.pathname;
}

function undoLastAction() {
  if (!roomId || !isOrganizer || !roomData || !roomData.undoStack || !roomData.undoStack.length) {
    showToast('There is no action to undo.'); return;
  }
  if (!navigator.onLine) { showToast('Reconnect before undoing.'); return; }
  var undoEventRef = fbDb.collection('roomEvents').doc();
  sharedBusy = true; syncStatus = 'syncing'; renderSessionCard();
  fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (roomSnapshot) {
      var data = roomSnapshot.data();
      if (!data || data.hostUid !== currentUser.uid || data.status !== 'active') throw new Error('Organizer permission required.');
      var stack = (data.undoStack || []).slice();
      var targetId = stack[stack.length - 1];
      return transaction.get(fbDb.collection('roomEvents').doc(targetId)).then(function (eventSnapshot) {
        if (!eventSnapshot.exists || !eventSnapshot.data().beforeState) throw new Error('Undo data is no longer available.');
        var target = eventSnapshot.data();
        stack.pop();
        var nextRevision = (Number(data.revision) || 0) + 1;
        transaction.update(roomRef, {
          state: Engine.normalizeState(target.beforeState),
          revision: nextRevision,
          updatedAt: FieldValue.serverTimestamp(),
          lastEventId: undoEventRef.id,
          undoStack: stack
        });
        transaction.set(undoEventRef, {
          roomId: roomId,
          revision: nextRevision,
          type: 'undo',
          summary: 'Undid: ' + target.summary,
          actorUid: currentUser.uid,
          actorName: controllerName,
          createdAt: FieldValue.serverTimestamp(),
          expiresAt: eventExpiry()
        });
      });
    });
  }).then(function () { showToast('Last action undone.'); })
    .catch(function (error) { showToast(error.message || 'Undo failed.'); })
    .finally(function () { sharedBusy = false; syncStatus = navigator.onLine ? 'connected' : 'offline'; renderSessionCard(); syncControlState(); });
}

function endSharedRoom() {
  if (!isOrganizer || !roomData || roomData.status !== 'active') return;
  if (!confirm('End this shared session? It will become read-only and be archived for 30 days.')) return;
  var expiresAt = Timestamp.fromMillis(Date.now() + THIRTY_DAYS);
  var endEventRef = fbDb.collection('roomEvents').doc();
  fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (snapshot) {
      var data = snapshot.data();
      if (!data || data.hostUid !== currentUser.uid) throw new Error('Organizer permission required.');
      var nextRevision = (Number(data.revision) || 0) + 1;
      transaction.update(roomRef, {
        status: 'ended',
        endedAt: FieldValue.serverTimestamp(),
        expiresAt: expiresAt,
        revision: nextRevision,
        updatedAt: FieldValue.serverTimestamp(),
        lastEventId: endEventRef.id
      });
      transaction.set(endEventRef, {
        roomId: roomId,
        revision: nextRevision,
        type: 'room_ended',
        summary: 'Ended the shared session',
        actorUid: currentUser.uid,
        actorName: controllerName,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: expiresAt
      });
    });
  }).then(function () {
    return fbDb.collection('roomEvents').where('roomId', '==', roomId).limit(EVENT_LIMIT).get();
  }).then(function (snapshot) {
    var batch = fbDb.batch();
    snapshot.docs.forEach(function (doc) { batch.update(doc.ref, { expiresAt: expiresAt }); });
    return snapshot.empty ? null : batch.commit();
  }).then(function () { showToast('Session ended and archived for 30 days.'); })
    .catch(function (error) { showToast(error.message || 'Could not end the session.'); });
}

function toggleHistory() { historyOpen = !historyOpen; renderHistorySection(); }
function toggleActivity() { activityOpen = !activityOpen; renderActivitySection(); }

function renderSessionCard() {
  var card = document.getElementById('sessionCard');
  if (!roomId) {
    card.innerHTML = '<div class="session-top"><div><div class="session-title">Personal game</div>'
      + '<div class="session-sub">Saved only on this device · Works offline</div></div>'
      + '<span class="mode-badge">📱 Solo</span></div>'
      + '<div class="session-actions"><button class="btn btn-primary" onclick="createSharedRoom()">🔗 Share Current Game</button></div>';
    return;
  }
  var statusText = { connected: '● Connected', syncing: '↻ Syncing', offline: '○ Offline', error: '! Error', ended: '✓ Ended' }[syncStatus] || syncStatus;
  var undoDisabled = !isOrganizer || !roomData || !roomData.undoStack || !roomData.undoStack.length || roomData.status !== 'active';
  card.innerHTML = '<div class="session-top"><div><div class="session-title">' + esc(roomData ? roomData.name : 'Live game') + '</div>'
    + '<div class="session-sub">Live shared rotation · ' + (isOrganizer ? 'You are the organizer' : 'Link controller') + '</div></div>'
    + '<span class="sync-badge ' + esc(syncStatus) + '">' + esc(statusText) + '</span></div>'
    + '<div class="room-identity">Controlling as <strong>' + esc(controllerName || 'Guest') + '</strong></div>'
    + '<div class="session-actions">'
    + '<button class="btn btn-primary" onclick="shareRoomLink()">↗ Share</button>'
    + '<button class="btn btn-ghost" onclick="copyShareLink()">⧉ Copy Link</button>'
    + (isOrganizer ? '<button class="btn btn-ghost" onclick="undoLastAction()" ' + (undoDisabled ? 'disabled' : '') + '>↶ Undo</button>' : '')
    + (isOrganizer && roomData && roomData.status === 'active' ? '<button class="btn btn-danger" onclick="endSharedRoom()">End Session</button>' : '')
    + '<button class="btn btn-ghost" onclick="leaveSharedRoom()">Leave</button>'
    + '</div>';
}

function renderPlayerList() {
  var element = document.getElementById('playerList');
  if (!S.players.length) { element.innerHTML = '<div class="empty-hint">No players added yet. Enter names above.</div>'; return; }
  var locked = new Set(Engine.lockedIds(S));
  element.innerHTML = S.players.map(function (player, index) {
    var isLocked = locked.has(player.id);
    var badges = isLocked ? '<span class="locked-badge">🔒 On Court</span>'
      : player.notAvailable ? '<span class="na-tag">⛔ Not Available</span>'
        : (player.wins ? '<span class="wins-badge">🏆 ' + player.wins + 'W</span>' : '')
          + (player.games ? '<span class="games-badge">' + player.games + 'G</span>' : '');
    var availability = isLocked ? '' : '<button class="btn-na' + (player.notAvailable ? ' is-na' : '') + '" onclick="toggleNotAvailable(' + index + ')">' + (player.notAvailable ? '✅ Back In' : '⛔ NA') + '</button>';
    var remove = '<button class="btn btn-ghost btn-sm" ' + (isLocked ? 'disabled data-force-disabled' : 'onclick="removePlayer(' + index + ')"') + '>✕</button>';
    return '<div class="player-item' + (isLocked ? ' locked' : '') + (player.notAvailable ? ' not-avail' : '') + '">'
      + '<span class="player-name">' + (index + 1) + '. ' + esc(player.name) + '</span>'
      + '<span style="display:flex;gap:5px;flex-shrink:0;align-items:center">' + badges + availability + '</span>' + remove + '</div>';
  }).join('');
}

function syncCourtButtons() {
  document.querySelectorAll('.court-btn').forEach(function (button) {
    button.classList.toggle('active', Number(button.dataset.n) === S.courts);
  });
}

function updateStats() {
  document.getElementById('sTotal').textContent = S.players.length;
  document.getElementById('sOnCourt').textContent = Engine.lockedIds(S).length;
  document.getElementById('sAvail').textContent = Engine.availableIds(S).length;
  document.getElementById('sActive').textContent = S.courtStates.filter(function (court) { return court.status === 'playing'; }).length;
}

function renderAvailableSection() {
  var element = document.getElementById('availableSection');
  if (!S.players.length) { element.innerHTML = ''; return; }
  var available = Engine.availableIds(S).map(function (id) { return Engine.playerById(S, id); });
  var lockedCount = Engine.lockedIds(S).length;
  var unavailable = S.players.filter(function (player) { return player.notAvailable; });
  var html = '<div class="avail-card"><div class="avail-header">✅ Available (' + available.length + ')';
  if (lockedCount) html += '<span class="on-court-tag">🔒 On Court: ' + lockedCount + '</span>';
  if (unavailable.length) html += '<span class="na-tag">⛔ Not Available: ' + unavailable.length + '</span>';
  html += '</div>';
  html += available.length ? '<div class="avail-chips">' + available.map(function (player) { return '<div class="avail-chip">' + esc(player.name) + '</div>'; }).join('') + '</div>'
    : '<div class="no-avail">No players available for rotation.</div>';
  if (unavailable.length) html += '<div class="na-chips"><div class="na-section-lbl" style="width:100%;margin-bottom:6px">⛔ Sitting Out</div>'
    + unavailable.map(function (player) { return '<div class="na-chip">' + esc(player.name) + '</div>'; }).join('') + '</div>';
  element.innerHTML = html + '</div>';
}

function statusBadgeHtml(status) {
  if (status === 'playing') return '<span class="status-badge status-playing">● In Progress</span>';
  if (status === 'done') return '<span class="status-badge status-done">✓ Done</span>';
  return '<span class="status-badge status-empty">Empty</span>';
}

function teamsHtml(court, courtIndex, showWinner) {
  var pending = swapState && swapState.courtIndex === courtIndex;
  function row(id, team, playerIndex) {
    var player = Engine.playerById(S, id);
    var buttons = '';
    if (!showWinner) {
      if (pending) {
        if (swapState.team === team && swapState.playerIndex === playerIndex) buttons = '<button class="swap-btn is-active" onclick="startSwap(' + courtIndex + ',\'' + team + '\',' + playerIndex + ')">✕ Cancel</button>';
        else if (swapState.team !== team) buttons = '<button class="swap-target-btn" onclick="executeSwap(' + courtIndex + ',\'' + team + '\',' + playerIndex + ')">⇄ Swap here</button>';
      } else {
        buttons = '<button class="skip-btn" onclick="openReplacementPicker(' + courtIndex + ',\'' + team + '\',' + playerIndex + ')">↩ Replace</button>'
          + '<button class="swap-btn" onclick="startSwap(' + courtIndex + ',\'' + team + '\',' + playerIndex + ')">⇄</button>';
      }
    }
    var selected = pending && swapState.team === team && swapState.playerIndex === playerIndex;
    return '<div class="team-player' + (selected ? ' swap-selecting' : '') + '"><div class="tp-namerow"><span class="tp-icon">' + (team === 'A' ? '🟢' : '🔵') + '</span>'
      + '<span class="tp-name">' + esc(player ? player.name : 'Unknown') + '</span></div>'
      + (buttons ? '<div class="tp-actions">' + buttons + '</div>' : '') + '</div>';
  }
  var aWon = showWinner && court.winner === 'A', bWon = showWinner && court.winner === 'B';
  return '<div class="teams-row"><div class="team-box' + (aWon ? ' team-winner' : '') + '"><div class="team-lbl' + (aWon ? ' won' : '') + '">Team A' + (aWon ? ' 🏆' : '') + '</div>'
    + row(court.teamA[0], 'A', 0) + row(court.teamA[1], 'A', 1) + '</div><div class="vs-col">VS</div>'
    + '<div class="team-box' + (bWon ? ' team-winner' : '') + '"><div class="team-lbl' + (bWon ? ' won' : '') + '">Team B' + (bWon ? ' 🏆' : '') + '</div>'
    + row(court.teamB[0], 'B', 0) + row(court.teamB[1], 'B', 1) + '</div></div>';
}

function renderCourtCard(court, index) {
  var color = Math.min(court.courtNum, 6);
  var body;
  if (court.status === 'playing') {
    body = teamsHtml(court, index, false) + '<div class="winner-section"><div class="winner-lbl">⚡ Who won?</div><div class="winner-row">'
      + '<button class="btn-team-a" onclick="recordWinner(' + index + ',\'A\')">🟢 Team A Won</button>'
      + '<button class="btn-team-b" onclick="recordWinner(' + index + ',\'B\')">🔵 Team B Won</button></div></div>';
  } else if (court.status === 'done') {
    body = teamsHtml(court, index, true) + '<button class="btn btn-accent btn-block" style="margin-top:12px" onclick="generateForCourt(' + index + ')">▶ Generate Next Game</button>';
  } else {
    body = '<div class="court-empty-body">No game assigned yet.</div><button class="btn btn-primary btn-block" onclick="generateForCourt(' + index + ')">▶ Generate Next Game</button>';
  }
  return '<div class="court-card court-card-' + color + (court.status === 'playing' ? ' is-playing' : court.status === 'done' ? ' is-done' : '') + '">'
    + '<div class="court-card-header"><div class="court-name"><span class="court-dot dot-' + color + '"></span>Court ' + court.courtNum + '</div>' + statusBadgeHtml(court.status) + '</div>' + body + '</div>';
}

function renderCourtsSection() {
  var element = document.getElementById('courtsSection');
  if (!S.players.length) {
    element.innerHTML = '<div class="no-games"><div class="no-games-icon">🏓</div><p>Add players, then tap<br><strong>⚡ Fill Available Courts</strong> to start!</p></div>';
    return;
  }
  element.innerHTML = S.courtStates.map(renderCourtCard).join('');
}

function renderHistorySection() {
  var element = document.getElementById('historySection');
  if (!S.history.length) { element.innerHTML = ''; return; }
  var html = '<div class="card"><div class="card-title history-toggle-row" onclick="toggleHistory()"><span class="card-title-left">🏆 Game History (' + S.history.length + ')</span><span>' + (historyOpen ? '▲ Hide' : '▼ Show') + '</span></div>';
  if (historyOpen) S.history.slice(0, 30).forEach(function (entry) {
    var date = new Date(entry.ts || Date.now());
    var teamA = entry.teamANames || (entry.teamA || []).map(function (id) { return Engine.playerName(S, id); });
    var teamB = entry.teamBNames || (entry.teamB || []).map(function (id) { return Engine.playerName(S, id); });
    html += '<div class="history-item"><div class="history-meta">Court ' + entry.courtNum + ' · Game ' + entry.gameNum + ' · '
      + date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>'
      + '<div class="history-result"><span class="' + (entry.winner === 'A' ? 'h-winner' : 'h-loser') + '">🟢 ' + esc(teamA.join(' & ')) + '</span><span class="h-vs">vs</span>'
      + '<span class="' + (entry.winner === 'B' ? 'h-winner' : 'h-loser') + '">🔵 ' + esc(teamB.join(' & ')) + '</span></div></div>';
  });
  element.innerHTML = html + '</div>';
}

function renderActivitySection() {
  var element = document.getElementById('activitySection');
  if (!roomId) { element.innerHTML = ''; return; }
  var html = '<div class="card"><div class="card-title history-toggle-row" onclick="toggleActivity()"><span class="card-title-left">📝 Controller Activity (' + activityEvents.length + ')</span><span>' + (activityOpen ? '▲ Hide' : '▼ Show') + '</span></div>';
  if (activityOpen) {
    if (!activityEvents.length) html += '<div class="empty-hint">No activity recorded yet.</div>';
    activityEvents.forEach(function (event) {
      var date = event.createdAt && event.createdAt.toDate ? event.createdAt.toDate() : null;
      html += '<div class="activity-item"><div><div class="activity-summary">' + esc(event.summary || event.type) + '</div><div class="activity-meta">' + esc(event.actorName || 'Controller') + '</div></div>'
        + '<div class="activity-time">' + (date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Syncing') + '</div></div>';
    });
  }
  element.innerHTML = html + '</div>';
}

function renderLeaderboard() {
  var card = document.getElementById('statsCard');
  var body = document.getElementById('statsBody');
  if (!S.players.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  var sorted = S.players.slice().sort(function (a, b) { return b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name); });
  if (!sorted.some(function (player) { return player.games > 0; })) {
    body.innerHTML = '<tr><td colspan="6"><div class="lb-no-games">No games played yet. Generate games to start tracking stats.</div></td></tr>'; return;
  }
  body.innerHTML = sorted.map(function (player, index) {
    var rank = index + 1, percent = player.games ? Math.round(player.wins / player.games * 100) : 0;
    var rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    var rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return '<tr><td class="lb-rank ' + rankClass + '">' + rankLabel + '</td><td class="lb-name">' + esc(player.name) + '</td>'
      + '<td class="lb-num">' + player.games + '</td><td class="lb-win">' + player.wins + '</td><td class="lb-pct">' + (player.games ? percent + '%' : '—') + '</td>'
      + '<td class="lb-bar-cell"><div class="lb-bar-wrap"><div class="lb-bar-win" style="width:' + percent + '%"></div></div></td></tr>';
  }).join('');
}

function syncHostControls() {
  document.querySelectorAll('[data-host-only]').forEach(function (element) {
    element.hidden = !!roomId && !isOrganizer;
  });
}

function syncControlState() {
  var disabled = !!roomId && (!navigator.onLine || sharedBusy || !roomData || roomData.status !== 'active');
  ['playerCard', 'courtSettingsCard', 'actionControls', 'courtsSection'].forEach(function (id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.querySelectorAll('button,input').forEach(function (control) { control.disabled = disabled || control.hasAttribute('data-force-disabled'); });
  });
}

function renderAll() {
  renderSessionCard();
  syncCourtButtons();
  updateStats();
  renderPlayerList();
  renderAvailableSection();
  renderCourtsSection();
  renderHistorySection();
  renderActivitySection();
  renderLeaderboard();
  syncHostControls();
  syncControlState();
}

function updateOnlineStatus() {
  var online = navigator.onLine;
  document.getElementById('offlineBar').classList.toggle('visible', !online);
  document.getElementById('offlineBar').textContent = roomId
    ? '📶 You’re offline — shared controls are paused until reconnection'
    : '📶 You’re offline — this personal game is still saved locally';
  if (roomId && roomData && roomData.status !== 'ended') syncStatus = online ? (sharedBusy ? 'syncing' : 'connected') : 'offline';
  renderSessionCard();
  syncControlState();
}

document.getElementById('signInBtn').addEventListener('click', function () {
  var provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch(function (error) { showAuthError('Sign-in failed: ' + error.message); });
});

document.getElementById('signOutBtn').addEventListener('click', function () {
  if (roomId) leaveSharedRoom();
  else fbAuth.signOut();
});

fbAuth.onAuthStateChanged(function (user) {
  currentUser = user;
  if (roomId) {
    if (!user) {
      setAuthMessage('Joining live game', 'Creating a temporary controller session…', false);
      fbAuth.signInAnonymously().catch(function (error) {
        setAuthMessage('Could not join game', 'Anonymous joining must be enabled for this Firebase project.', false);
        showAuthError(error.message);
      });
      return;
    }
    initSharedRoom(user);
    return;
  }
  if (!user) {
    appInitialised = false;
    document.getElementById('signOutWrap').style.display = 'none';
    setAuthMessage('Pickleball Game Rotation', 'Sign in with your approved Gmail account to organize a game.', true);
    return;
  }
  if (user.isAnonymous) {
    fbAuth.signOut();
    return;
  }
  setAuthMessage('Checking access', 'Confirming your organizer account…', false);
  fbDb.collection('allowedEmails').where('email', '==', user.email).get().then(function (snapshot) {
    if (snapshot.empty) throw new Error('Your account (' + user.email + ') is not authorised. Contact the app owner.');
    organizerGrantId = snapshot.docs[0].id;
    if (!appInitialised) initSolo();
  }).catch(function (error) {
    showAuthError(error.message || 'Could not verify access.');
    fbAuth.signOut();
  });
});

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault(); deferredPrompt = event;
  document.getElementById('installBanner').classList.add('visible');
});
document.getElementById('installBtn').addEventListener('click', function () {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function () { deferredPrompt = null; document.getElementById('installBanner').classList.remove('visible'); });
});
window.addEventListener('appinstalled', function () { document.getElementById('installBanner').classList.remove('visible'); showToast('App installed!'); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function (error) { console.warn('Service worker failed:', error); }); });
}
