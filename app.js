'use strict';

var Engine = window.PickleballRotation;
var APP_VERSION = '3.4.0';
var VERSION_URL = './version.json';
var LOCAL_KEY = 'pickleballRotation_v3';
var LEGACY_KEY = 'pickleballRotation_v2';
var ROOM_PARAM = 'room';
var EVENT_LIMIT = 100;
var UNDO_LIMIT = 10;
var THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

var S = Engine.createState(2);
var queryParams = new URLSearchParams(window.location.search);
if (queryParams.has('_appUpdate')) {
  queryParams.delete('_appUpdate');
  window.history.replaceState(null, '', window.location.pathname + (queryParams.toString() ? '?' + queryParams.toString() : '') + window.location.hash);
}
var roomId = queryParams.get(ROOM_PARAM);
var requestedMode = queryParams.get('mode');
var accessMode = roomId ? (requestedMode === 'player' ? 'player' : requestedMode === 'view' ? 'viewer' : 'controller') : 'solo';
var linkedPlayerId = null;
var pendingPlayerEnrollment = null;
var pendingPlayerSkillRating = null;
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
var appUpdateInProgress = false;
var appServiceWorkerRegistration = null;
var fbMessaging = null;
var messagingSupported = false;
var alertStatus = 'checking';
var initialRoomSnapshotSeen = false;
var lastTurnAlertKey = '';
var FCM_VAPID_KEY = '';
var ROLE_HELP_VERSION = 'v1';

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

var ROLE_HELP = {
  player: {
    title: 'Player Check-In · How to Use',
    copy: 'Use this access type to manage only your own player entry.',
    steps: [
      'Choose your roster name, or add yourself, then select Beginner or Intermediate & Above.',
      'Tap Enable Alerts if you want a phone notification when you are assigned to a court.',
      'Use Take a Break when sitting out and I’m Ready when you want to return.',
      'Use My Skill to update your level; it affects future assignments only.',
      'Court badges show who each court is for. Standings and live games update automatically.',
      'Tap Leave to check out. You cannot check out while you are in an active game.'
    ]
  },
  viewer: {
    title: 'View Only · How to Use',
    copy: 'Use this access type to follow the session without changing it.',
    steps: [
      'Follow each live court and its Beginner, Intermediate & Above, or Any level badge.',
      'Check Player Standings for games, wins, and win percentage.',
      'Open Game History for completed games and Live Activity for recent controller actions.',
      'The page updates automatically. Game controls are intentionally unavailable in View Only mode.'
    ]
  },
  controller: {
    title: 'Controller · How to Use',
    copy: 'Use this access type to operate the shared rotation.',
    steps: [
      'Add players and edit their skill levels in the Players section.',
      'Under Court Settings, designate each court as Any, Beginner, or Intermediate & Above.',
      'Fill available courts or generate one court, then record the winning team.',
      'Use Replace for a waiting eligible player and ⇄ to swap teams on the same court.',
      'Use QR & Links to share Player Check-In, View Only, or Controller access.',
      'Organizer only: Undo, Reset, Clear All, Reset Stats, and End Session.'
    ]
  }
};

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
  var modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = options.body || '';
  modalBody.scrollTop = 0;
  document.getElementById('modalActions').innerHTML = '';
  var close = document.getElementById('modalCloseBtn');
  close.style.display = options.closable === false ? 'none' : '';
  close.onclick = options.onClose || closeModal;
  overlay.onclick = function (event) {
    if (event.target === overlay && options.closable !== false) closeModal();
  };
  overlay.classList.add('visible');
  return {
    body: modalBody,
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

function alertsStorageKey() {
  return 'pickleballAlerts_' + roomId;
}

function alertButtonCopy() {
  if (alertStatus === 'on') return '🔔 Alerts On';
  if (alertStatus === 'blocked') return '🔕 Blocked';
  if (alertStatus === 'unavailable') return '🔕 Unavailable';
  if (alertStatus === 'enabling') return '↻ Enabling Alerts';
  return '🔔 Enable Alerts';
}

function findPlayerAssignment(state, playerId) {
  if (!state || !playerId) return null;
  for (var courtIndex = 0; courtIndex < state.courtStates.length; courtIndex += 1) {
    var court = state.courtStates[courtIndex];
    if (court.status !== 'playing') continue;
    var team = court.teamA.indexOf(playerId) !== -1 ? 'A' : court.teamB.indexOf(playerId) !== -1 ? 'B' : null;
    if (!team) continue;
    var ownTeam = team === 'A' ? court.teamA : court.teamB;
    var otherTeam = team === 'A' ? court.teamB : court.teamA;
    return {
      courtNum: court.courtNum,
      gameNum: court.gameNum,
      partner: Engine.playerName(state, ownTeam.find(function (id) { return id !== playerId; })),
      opponents: otherTeam.map(function (id) { return Engine.playerName(state, id); })
    };
  }
  return null;
}

function dismissTurnAlert() {
  var alert = document.getElementById('turnAlert');
  if (alert) alert.classList.remove('visible');
}

function showTurnAlert(assignment, deliveryKey) {
  if (!assignment || (deliveryKey && lastTurnAlertKey === deliveryKey)) return;
  if (deliveryKey) lastTurnAlertKey = deliveryKey;
  var alert = document.getElementById('turnAlert');
  if (!alert) return;
  alert.querySelector('.turn-alert-title').textContent = 'You’re up on Court ' + assignment.courtNum + '!';
  alert.querySelector('.turn-alert-copy').textContent = 'Partner: ' + assignment.partner + ' · vs ' + assignment.opponents.join(' & ');
  alert.classList.add('visible');
  if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
}

function detectNewPlayerAssignment(beforeState, nextState, revision) {
  if (accessMode !== 'player' || !linkedPlayerId || !initialRoomSnapshotSeen) return;
  var before = findPlayerAssignment(beforeState, linkedPlayerId);
  var after = findPlayerAssignment(nextState, linkedPlayerId);
  if (!after) return;
  if (before && before.courtNum === after.courtNum && before.gameNum === after.gameNum) return;
  showTurnAlert(after, [roomId, revision, after.courtNum, after.gameNum, linkedPlayerId].join('_'));
}

function pushSubscriptionRef() {
  return currentUser && roomId ? fbDb.collection('pushSubscriptions').doc(roomId + '_' + currentUser.uid) : null;
}

function removePushSubscription() {
  var ref = pushSubscriptionRef();
  localStorage.removeItem(alertsStorageKey());
  alertStatus = messagingSupported && Notification.permission !== 'denied' ? 'available' : alertStatus;
  renderSessionCard();
  return ref ? ref.delete().catch(function () {}) : Promise.resolve();
}

function savePushSubscription(token) {
  var ref = pushSubscriptionRef();
  if (!ref || !linkedPlayerId) return Promise.reject(new Error('Player check-in is not ready.'));
  return ref.get().then(function (snapshot) {
    var data = {
      roomId: roomId,
      uid: currentUser.uid,
      playerId: linkedPlayerId,
      token: token,
      enabled: true,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: eventExpiry()
    };
    if (!snapshot.exists) data.createdAt = FieldValue.serverTimestamp();
    return ref.set(data, { merge: true });
  });
}

function requestMessagingToken(requestPermission) {
  if (!roomId || accessMode !== 'player' || !linkedPlayerId || !window.firebase.messaging) return Promise.resolve(null);
  return Promise.resolve(firebase.messaging.isSupported()).then(function (supported) {
    messagingSupported = !!supported;
    if (!supported || !('Notification' in window) || !('serviceWorker' in navigator)) {
      alertStatus = 'unavailable';
      return null;
    }
    if (Notification.permission === 'denied') {
      alertStatus = 'blocked';
      return null;
    }
    if (requestPermission && Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  }).then(function (permission) {
    if (!messagingSupported || permission !== 'granted') {
      if (permission === 'denied') alertStatus = 'blocked';
      else if (messagingSupported) alertStatus = 'available';
      return null;
    }
    return navigator.serviceWorker.ready.then(function (registration) {
      appServiceWorkerRegistration = registration;
      if (!fbMessaging) {
        fbMessaging = firebase.messaging();
        fbMessaging.onMessage(function (payload) {
          var data = payload.data || {};
          showTurnAlert({
            courtNum: data.courtNum,
            gameNum: data.gameNum,
            partner: data.partner || 'See live game',
            opponents: data.opponents ? data.opponents.split('|') : []
          }, data.deliveryId || data.tag || 'foreground-' + Date.now());
        });
      }
      var options = { serviceWorkerRegistration: registration };
      if (FCM_VAPID_KEY) options.vapidKey = FCM_VAPID_KEY;
      return fbMessaging.getToken(options);
    });
  }).then(function (token) {
    if (!token) return null;
    return savePushSubscription(token).then(function () {
      localStorage.setItem(alertsStorageKey(), '1');
      alertStatus = 'on';
      renderSessionCard();
      return token;
    });
  });
}

function enablePlayerAlerts() {
  if (alertStatus === 'on') { showToast('Phone alerts are enabled for this game.'); return; }
  if (alertStatus === 'blocked') {
    showToast('Notifications are blocked. Allow them in your browser or phone settings.'); return;
  }
  if (alertStatus === 'unavailable') {
    showToast(/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'On iPhone, install this app on your Home Screen, then enable alerts there.' : 'Push alerts are unavailable on this browser. Keep the page open for in-app alerts.');
    return;
  }
  alertStatus = 'enabling';
  renderSessionCard();
  requestMessagingToken(true).then(function (token) {
    if (token) showToast('Alerts enabled. We’ll notify you when you’re up.');
    else if (alertStatus === 'available') showToast('Alerts were not enabled. In-app alerts still work while this page is open.');
  }).catch(function (error) {
    console.warn('Could not enable alerts:', error);
    alertStatus = Notification.permission === 'denied' ? 'blocked' : 'unavailable';
    renderSessionCard();
    showToast('Could not enable phone alerts. In-app alerts still work while this page is open.');
  });
}

function refreshPlayerAlerts() {
  if (accessMode !== 'player') return;
  if (localStorage.getItem(alertsStorageKey())) {
    requestMessagingToken(false).catch(function (error) { console.warn('Could not refresh alerts:', error); });
    return;
  }
  if (!window.firebase.messaging || !('Notification' in window) || !('serviceWorker' in navigator)) {
    alertStatus = 'unavailable'; renderSessionCard(); return;
  }
  Promise.resolve(firebase.messaging.isSupported()).then(function (supported) {
    messagingSupported = !!supported;
    alertStatus = !supported ? 'unavailable' : Notification.permission === 'denied' ? 'blocked' : 'available';
    renderSessionCard();
  });
}

function currentHelpRole() {
  return accessMode === 'player' && !isOrganizer ? 'player' : accessMode === 'viewer' && !isOrganizer ? 'viewer' : 'controller';
}

function openRoleHelp(role, automatic) {
  role = role || currentHelpRole();
  var guide = ROLE_HELP[role] || ROLE_HELP.controller;
  localStorage.setItem('pickleballHelpSeen_' + ROLE_HELP_VERSION + '_' + role, '1');
  var modal = openModal({
    title: guide.title,
    copy: guide.copy,
    body: '<ol class="help-steps">' + guide.steps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>'
  });
  var done = document.createElement('button');
  done.className = 'btn btn-primary';
  done.textContent = automatic ? 'Got It' : 'Close Guide';
  done.onclick = closeModal;
  modal.actions.appendChild(done);
}

function maybeShowRoleHelp() {
  if (!roomId) return;
  var role = currentHelpRole();
  var key = 'pickleballHelpSeen_' + ROLE_HELP_VERSION + '_' + role;
  if (!localStorage.getItem(key)) setTimeout(function () { openRoleHelp(role, true); }, 350);
}

function renderAppVersion() {
  var version = document.getElementById('appVersion');
  if (version) version.textContent = 'v' + APP_VERSION;
}

function checkLatestVersion() {
  var button = document.getElementById('updateAppBtn');
  var status = document.getElementById('appUpdateStatus');
  if (!button || !status) return Promise.resolve(null);
  return fetch(VERSION_URL + '?check=' + Date.now(), { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Version check failed.');
    return response.json();
  }).then(function (release) {
    var latest = String(release.version || '');
    if (!latest) throw new Error('Version information is unavailable.');
    if (latest !== APP_VERSION) {
      button.textContent = '↻ Update to v' + latest;
      button.classList.add('update-available');
      status.textContent = 'New version available';
    } else {
      button.textContent = '↻ Update App';
      button.classList.remove('update-available');
      status.textContent = 'Latest version';
    }
    return latest;
  }).catch(function () {
    if (status) status.textContent = navigator.onLine ? 'Update check unavailable' : 'Check when online';
    return null;
  });
}

function updateAppToLatest() {
  if (appUpdateInProgress) return;
  if (!navigator.onLine) { showToast('Connect to the internet before updating.'); return; }
  appUpdateInProgress = true;
  var button = document.getElementById('updateAppBtn');
  var status = document.getElementById('appUpdateStatus');
  button.disabled = true;
  button.textContent = 'Updating…';
  status.textContent = 'Removing old app files…';

  fetch(VERSION_URL + '?update=' + Date.now(), { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('The latest release could not be reached.');
    return response.json();
  }).then(function () {
    var registrations = 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistrations() : Promise.resolve([]);
    var cacheKeys = 'caches' in window ? caches.keys() : Promise.resolve([]);
    return Promise.all([registrations, cacheKeys]);
  }).then(function (results) {
    var registrations = results[0];
    var cacheKeys = results[1];
    return Promise.all(
      registrations.filter(function (registration) {
        return registration.scope.indexOf(window.location.origin) === 0 && window.location.href.indexOf(registration.scope) === 0;
      }).map(function (registration) {
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return registration.unregister();
      }).concat(cacheKeys.filter(function (key) {
        return key.indexOf('pickleball-') === 0;
      }).map(function (key) { return caches.delete(key); }))
    );
  }).then(function () {
    sessionStorage.setItem('pickleballUpdateRequested', '1');
    var nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('_appUpdate', Date.now());
    window.location.replace(nextUrl.toString());
  }).catch(function (error) {
    appUpdateInProgress = false;
    button.disabled = false;
    button.textContent = '↻ Try Update Again';
    status.textContent = 'Update failed';
    showToast(error.message || 'Could not update the app.');
  });
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
    if (current) {
      var normalized = Engine.normalizeState(JSON.parse(current));
      localStorage.setItem(LOCAL_KEY, JSON.stringify(normalized));
      return normalized;
    }
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

function playerStorageKey() {
  return 'pickleballPlayer_' + roomId;
}

function isFullController() {
  return !roomId || isOrganizer || accessMode === 'controller';
}

function membershipRole() {
  if (isOrganizer) return 'organizer';
  return accessMode;
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

function skillRatingQuestion(selectedRating) {
  return '<fieldset class="skill-question"><legend>What is your current skill level?</legend>'
    + '<div class="field-help">Choose the description that best matches your current play. Skill Balanced mode uses this for closer teams.</div>'
    + '<div class="skill-picker" role="radiogroup" aria-label="Skill level">' + Engine.SKILL_LEVELS.map(function (level) {
      var selected = level.value === selectedRating;
      return '<button class="picker-option skill-level-option' + (selected ? ' is-selected' : '') + '" data-skill-choice="' + level.value + '" type="button" role="radio" aria-checked="' + (selected ? 'true' : 'false') + '">'
        + '<span class="skill-level-name">⭐ ' + esc(level.label) + '</span><span class="skill-level-description">' + esc(level.description) + '</span></button>';
    }).join('') + '</div></fieldset>';
}

function bindSkillRatingQuestion(container, onChange) {
  container.querySelectorAll('[data-skill-choice]').forEach(function (button) {
    button.onclick = function () {
      container.querySelectorAll('[data-skill-choice]').forEach(function (option) {
        option.classList.toggle('is-selected', option === button);
        option.setAttribute('aria-checked', option === button ? 'true' : 'false');
      });
      onChange(Number(button.dataset.skillChoice));
    };
  });
}

function ensurePlayerIdentity() {
  S = Engine.normalizeState(roomData.state);
  pendingPlayerSkillRating = null;
  var saved = localStorage.getItem(playerStorageKey());
  var savedPlayer = Engine.playerById(S, saved);
  var canReuseSavedPlayer = savedPlayer && (!savedPlayer.checkedInUid || savedPlayer.checkedInUid === currentUser.uid);
  if (savedPlayer && savedPlayer.skillLevelConfirmed && savedPlayer.checkedIn && savedPlayer.checkedInUid === currentUser.uid && !savedPlayer.notAvailable) {
    linkedPlayerId = savedPlayer.id;
    controllerName = savedPlayer.name;
    return Promise.resolve(savedPlayer);
  }
  return new Promise(function (resolve) {
    function showPicker() {
      var options = S.players.map(function (player) {
        var claimed = player.checkedInUid && player.checkedInUid !== currentUser.uid;
        return '<button class="picker-option" type="button" data-player-id="' + esc(player.id) + '" ' + (claimed ? 'disabled' : '') + '>'
          + '<strong>' + esc(player.name) + '</strong>' + (claimed ? ' · already checked in' : '') + '</button>';
      }).join('');
      var addMyself = '<button class="picker-option self-enroll-option" id="selfEnrollBtn" type="button"><strong>＋ Add myself to this game</strong><small>Create your own player name and check in</small></button>';
      var roster = S.players.length
        ? addMyself + '<div class="self-enroll-divider"><span>or choose a listed name</span></div><div class="picker-list">' + options + '</div>'
        : '<div class="empty-hint self-enroll-empty">No players are listed yet. Add yourself to start the roster.</div>' + addMyself;
      var modal = openModal({
        title: 'Who are you?',
        copy: 'Choose your name, or add yourself if you are not listed.',
        body: roster,
        closable: false
      });
      modal.body.querySelectorAll('[data-player-id]').forEach(function (button) {
        button.onclick = function () {
          var player = Engine.playerById(S, button.dataset.playerId);
          if (player) showExistingPlayerForm(player);
        };
      });
      document.getElementById('selfEnrollBtn').onclick = showEnrollmentForm;
    }

    function finishIdentity(player, skillRating, enrollment) {
      pendingPlayerEnrollment = enrollment || null;
      pendingPlayerSkillRating = skillRating;
      linkedPlayerId = player.id;
      controllerName = player.name;
      localStorage.setItem(playerStorageKey(), linkedPlayerId);
      closeModal();
      resolve(player);
    }

    function showExistingPlayerForm(player) {
      var selectedRating = player.skillLevelConfirmed ? player.skillRating : null;
      var modal = openModal({
        title: 'Check in as ' + player.name,
        copy: player.skillLevelConfirmed
          ? 'Confirm your name and skill level before joining the rotation.'
          : 'Choose one of the two current skill levels before joining the rotation.',
        body: '<div class="identity-summary"><span>Player name</span><strong>' + esc(player.name) + '</strong></div>'
          + skillRatingQuestion(selectedRating),
        closable: false
      });
      var join;
      bindSkillRatingQuestion(modal.body, function (rating) { selectedRating = rating; if (join) join.disabled = false; });
      var back = document.createElement('button');
      back.className = 'btn btn-ghost';
      back.textContent = '← Back';
      back.onclick = showPicker;
      join = document.createElement('button');
      join.className = 'btn btn-primary';
      join.textContent = player.skillLevelConfirmed ? 'Check In' : 'Confirm & Check In';
      join.disabled = !selectedRating;
      join.onclick = function () { if (selectedRating) finishIdentity(player, selectedRating, null); };
      modal.actions.appendChild(back);
      modal.actions.appendChild(join);
    }

    function showEnrollmentForm() {
      var selectedRating = null;
      var modal = openModal({
        title: 'Add yourself',
        copy: 'Enter the name and skill level everyone will see in the rotation.',
        body: '<label class="modal-label" for="selfEnrollName">Your player name</label>'
          + '<input class="modal-field" id="selfEnrollName" maxlength="50" autocomplete="name" placeholder="Enter your name">'
          + skillRatingQuestion(selectedRating)
          + '<div class="modal-inline-error" id="selfEnrollError" role="alert"></div>',
        closable: false
      });
      var join;
      bindSkillRatingQuestion(modal.body, function (rating) {
        selectedRating = rating;
        if (join) join.disabled = false;
      });
      var input = document.getElementById('selfEnrollName');
      var error = document.getElementById('selfEnrollError');
      var back = document.createElement('button');
      back.className = 'btn btn-ghost';
      back.textContent = '← Back';
      back.onclick = showPicker;
      join = document.createElement('button');
      join.className = 'btn btn-primary';
      join.textContent = 'Add & Check In';
      join.disabled = true;
      function submit() {
        var name = input.value.trim();
        var duplicate = S.players.find(function (player) { return player.name.toLowerCase() === name.toLowerCase(); });
        if (!name) { error.textContent = 'Enter your player name.'; input.focus(); return; }
        if (!selectedRating) { error.textContent = 'Choose your skill level.'; return; }
        if (duplicate) {
          error.textContent = duplicate.checkedInUid
            ? 'That name is already checked in. Use a distinct player name.'
            : 'That name is already listed. Go back and choose it.';
          input.focus();
          return;
        }
        var enrollment = { id: Engine.makeId('p'), name: name, skillRating: selectedRating };
        finishIdentity(enrollment, selectedRating, enrollment);
      }
      join.onclick = submit;
      input.oninput = function () { error.textContent = ''; };
      input.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); submit(); } };
      modal.actions.appendChild(back);
      modal.actions.appendChild(join);
      setTimeout(function () { input.focus(); }, 30);
    }

    if (canReuseSavedPlayer) showExistingPlayerForm(savedPlayer);
    else showPicker();
  });
}

function enrollLinkedPlayer() {
  var enrollment = pendingPlayerEnrollment;
  if (!enrollment) return Promise.resolve(null);
  return runAction('player_self_enrolled', function (state) {
    var result = Engine.enrollPlayer(state, enrollment.name, currentUser.uid, controllerName, enrollment.id, enrollment.skillRating);
    if (!result.changed) return result;
    return {
      changed: true,
      player: result.player,
      message: 'You are checked in as ' + result.player.name + '.',
      summary: result.player.name + ' added themselves as ' + Engine.skillLevelLabel(result.player.skillRating) + ' and checked in'
    };
  }, { selfService: true, undoable: false }).then(function (result) {
    if (result && result.changed) {
      pendingPlayerEnrollment = null;
      pendingPlayerSkillRating = null;
    }
    return result;
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
  roomRef.get().then(function (snapshot) {
    if (!snapshot.exists) throw new Error('This shared game does not exist or has expired.');
    roomData = snapshot.data();
    S = Engine.normalizeState(roomData.state);
    isOrganizer = roomData.hostUid === currentUser.uid;
    if (isOrganizer) accessMode = 'controller';
    if (isOrganizer) {
      controllerName = currentUser.displayName || currentUser.email || roomData.hostName || 'Organizer';
      return Promise.resolve();
    }
    if (accessMode === 'viewer') {
      controllerName = 'Viewer';
      return Promise.resolve();
    }
    return accessMode === 'player' ? ensurePlayerIdentity() : ensureControllerName(user);
  }).then(function () {
    return fbDb.collection('roomMembers').doc(roomId + '_' + currentUser.uid).set({
        roomId: roomId,
        uid: currentUser.uid,
        displayName: controllerName,
        role: membershipRole(),
        playerId: linkedPlayerId,
        joinedAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiry()
      }, { merge: true });
  }).then(function () {
    if (accessMode !== 'player') return null;
    if (pendingPlayerEnrollment) {
      return enrollLinkedPlayer().then(function (result) {
        if (!result) throw new Error('Your player name could not be added. Refresh the link and try again.');
        return result;
      });
    }
    var player = Engine.playerById(S, linkedPlayerId);
    if (player && player.skillLevelConfirmed && pendingPlayerSkillRating == null
      && player.checkedIn && player.checkedInUid === currentUser.uid && !player.notAvailable) return player;
    return checkInLinkedPlayer(true).then(function (result) {
      if (!result) throw new Error('That player could not be checked in. Refresh the link and choose again.');
      return result;
    });
  }).then(function () {
      hideAuth();
      document.getElementById('signOutWrap').style.display = 'block';
      initUi();
      subscribeToRoom();
      subscribeToEvents();
      maybeShowRoleHelp();
      refreshPlayerAlerts();
  }).catch(function (error) {
    appInitialised = false;
    setAuthMessage('Could not join game', error.message || 'The shared room is unavailable.', false);
    showAuthError(error.message || 'The shared room is unavailable.');
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
    var previousState = S;
    roomData = snapshot.data();
    var nextState = Engine.normalizeState(roomData.state);
    detectNewPlayerAssignment(previousState, nextState, roomData.revision);
    S = nextState;
    initialRoomSnapshotSeen = true;
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
  if (accessMode === 'viewer' && !isOrganizer) { showToast('This is a view-only link.'); return Promise.resolve(null); }
  if (accessMode === 'player' && !isOrganizer && !options.selfService) { showToast('Player check-in can only change your own availability and skill level.'); return Promise.resolve(null); }
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
  if (S.players.some(function (player) { return player.name.toLowerCase() === name.toLowerCase(); })) {
    showToast('"' + name + '" is already in the list.');
    return;
  }
  var selectedRating = null;
  var modal = openModal({
    title: 'Skill level · ' + name,
    copy: 'Choose a skill level before adding this player.',
    body: skillRatingQuestion(null)
  });
  var cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'Cancel';
  cancel.onclick = closeModal;
  var add = document.createElement('button');
  add.className = 'btn btn-primary';
  add.textContent = 'Add Player';
  add.disabled = true;
  bindSkillRatingQuestion(modal.body, function (rating) {
    selectedRating = rating;
    add.disabled = false;
  });
  add.onclick = function () {
    if (!selectedRating) return;
    closeModal();
    runAction('player_added', function (state) {
      if (state.players.some(function (player) { return player.name.toLowerCase() === name.toLowerCase(); })) {
        return { changed: false, reason: '"' + name + '" is already in the list.' };
      }
      state.players.push({
        id: Engine.makeId('p'), name: name, games: 0, wins: 0, notAvailable: false,
        skillRating: selectedRating, skillLevelConfirmed: true,
        checkedIn: false, checkedInUid: null, checkedInName: null, lastAssignedRound: -1
      });
      var levelName = Engine.skillLevelLabel(selectedRating);
      return { changed: true, message: name + ' added as ' + levelName + '.', summary: 'Added ' + name + ' as ' + levelName };
    }).then(function (result) { if (result && result.changed) { input.value = ''; input.focus(); } });
  };
  modal.actions.appendChild(cancel);
  modal.actions.appendChild(add);
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

function setCourtSkillGroup(index, group) {
  group = Engine.normalizeSkillGroup(group);
  var court = S.courtStates[index];
  if (!court || court.skillGroup === group) return;
  runAction('court_skill_group_changed', function (state) {
    var target = state.courtStates[index];
    if (!target) return { changed: false, reason: 'Court not found.' };
    target.skillGroup = group;
    var label = Engine.skillGroupLabel(group);
    return {
      changed: true,
      message: 'Court ' + target.courtNum + ' is now for ' + label + '.',
      summary: 'Designated Court ' + target.courtNum + ' for ' + label
    };
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
    var skipped = [];
    Engine.courtFillOrder(state).forEach(function (index) {
      var court = state.courtStates[index];
      if (court.status !== 'playing') {
        var result = Engine.assignGame(state, index);
        if (result.changed) filled.push(result.court.courtNum);
        else skipped.push(result.reason);
      }
    });
    if (!filled.length) return { changed: false, reason: skipped[0] || 'All courts are active.' };
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
  var ids = Engine.eligibleIdsForCourt(S, courtIndex);
  if (!ids.length) { showToast('No available ' + Engine.skillGroupLabel(court.skillGroup) + ' players can replace ' + outgoingName + '.'); return; }
  ids.sort(function (a, b) {
    var pa = Engine.playerById(S, a), pb = Engine.playerById(S, b);
    return pa.games - pb.games || pa.lastAssignedRound - pb.lastAssignedRound || pa.name.localeCompare(pb.name);
  });
  var modal = openModal({
    title: 'Replace ' + outgoingName,
    copy: 'Choose a waiting player. Skill level, games played, and waiting time are shown for each option. ' + outgoingName + ' will return to the available pool.',
    body: '<div class="picker-list" id="replacementList"></div>'
  });
  var list = modal.body.querySelector('#replacementList');
  var automatic = document.createElement('button');
  automatic.className = 'picker-option replacement-option auto-replacement';
  automatic.innerHTML = '<span class="replacement-main"><strong>✨ Auto-pick fairest</strong><span class="replacement-skill">Recommended</span></span>'
    + '<span class="replacement-detail">Lowest games played, then longest wait and best matchup</span>';
  automatic.onclick = function () { closeModal(); replaceCurrentPlayer(courtIndex, team, playerIndex, Engine.fairReplacement(S, courtIndex), outgoingId); };
  list.appendChild(automatic);
  ids.forEach(function (id) {
    var player = Engine.playerById(S, id);
    var waitRounds = player.lastAssignedRound < 0 ? null : Math.max(0, S.rotationRound - player.lastAssignedRound);
    var waitLabel = waitRounds == null ? 'Not played yet' : waitRounds + ' round' + (waitRounds === 1 ? '' : 's') + ' waiting';
    var button = document.createElement('button');
    button.className = 'picker-option replacement-option';
    button.innerHTML = '<span class="replacement-main"><strong>' + esc(player.name) + '</strong>'
      + '<span class="replacement-skill">⭐ ' + esc(Engine.skillLevelLabel(player.skillRating)) + (player.skillLevelConfirmed ? '' : ' · Confirm') + '</span></span>'
      + '<span class="replacement-detail">' + player.games + ' game' + (player.games === 1 ? '' : 's') + ' · ' + esc(waitLabel) + '</span>';
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
  var replacementId = Engine.fairReplacement(S, courtIndex);
  if (!replacementId) { showToast('No available replacement player.'); return; }
  replaceCurrentPlayer(courtIndex, team, playerIndex, replacementId);
}

function checkInLinkedPlayer(silent) {
  if (!linkedPlayerId || !currentUser) return Promise.resolve(null);
  return runAction('player_checked_in', function (state) {
    var result = Engine.checkInPlayer(state, linkedPlayerId, currentUser.uid, controllerName, pendingPlayerSkillRating);
    if (!result.changed) return result;
    return {
      changed: true,
      message: silent ? '' : result.player.name + ' is checked in.',
      summary: result.player.name + ' checked in as ' + Engine.skillLevelLabel(result.player.skillRating)
    };
  }, { selfService: true, undoable: false }).then(function (result) {
    if (result && result.changed) pendingPlayerSkillRating = null;
    return result;
  });
}

function toggleMyAvailability() {
  var player = Engine.playerById(S, linkedPlayerId);
  if (!player) { showToast('Your roster entry is no longer available.'); return; }
  var nextUnavailable = !player.notAvailable;
  runAction('player_self_availability', function (state) {
    var result = Engine.setSelfAvailability(state, linkedPlayerId, currentUser.uid, nextUnavailable);
    if (!result.changed) return result;
    return {
      changed: true,
      message: result.player.name + (nextUnavailable ? ' is taking a break.' : ' is ready to play.'),
      summary: result.player.name + (nextUnavailable ? ' took a break' : ' returned to the rotation')
    };
  }, { selfService: true, undoable: false });
}

function openSkillPicker(playerId) {
  var isSelfEdit = accessMode === 'player' && !isOrganizer && linkedPlayerId === playerId && !!currentUser;
  if (!isFullController() && !isSelfEdit) return;
  var player = Engine.playerById(S, playerId);
  if (!player) return;
  var selectedRating = player.skillRating;
  var modal = openModal({
    title: 'Skill level · ' + player.name,
    copy: player.skillLevelConfirmed
      ? 'Update this anytime. The new level is used the next time Skill Balanced mode generates a game.'
      : 'Confirm the provisional level or choose a better match. Current games will not be rearranged.',
    body: skillRatingQuestion(player.skillRating)
  });
  var cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'Cancel';
  cancel.onclick = closeModal;
  var save = document.createElement('button');
  save.className = 'btn btn-primary';
  save.textContent = player.skillLevelConfirmed ? 'Save Level' : 'Confirm Level';
  save.disabled = player.skillLevelConfirmed;
  bindSkillRatingQuestion(modal.body, function (nextRating) {
    selectedRating = nextRating;
    save.disabled = false;
  });
  save.onclick = function () {
    closeModal();
    runAction(isSelfEdit ? 'player_self_skill_changed' : 'player_skill_changed', function (state) {
      if (isSelfEdit) {
        var selfResult = Engine.setSelfSkillRating(state, playerId, currentUser.uid, selectedRating);
        if (!selfResult.changed) return selfResult;
        var selfLevelName = Engine.skillLevelLabel(selfResult.player.skillRating);
        return {
          changed: true,
          message: 'Your skill level is now ' + selfLevelName + '.',
          summary: selfResult.player.name + ' updated their skill level to ' + selfLevelName
        };
      }
      var target = Engine.playerById(state, playerId);
      if (!target) return { changed: false, reason: 'Player not found.' };
      if (target.skillRating === selectedRating && target.skillLevelConfirmed) {
        return { changed: false, reason: 'Skill level is already ' + Engine.skillLevelLabel(selectedRating) + '.' };
      }
      target.skillRating = selectedRating;
      target.skillLevelConfirmed = true;
      var levelName = Engine.skillLevelLabel(selectedRating);
      return { changed: true, message: target.name + ' is now ' + levelName + '.', summary: 'Set ' + target.name + ' to ' + levelName };
    }, isSelfEdit ? { selfService: true, undoable: false } : {});
  };
  modal.actions.appendChild(cancel);
  modal.actions.appendChild(save);
}

function setMatchmakingMode(mode) {
  mode = mode === 'balanced' ? 'balanced' : 'social';
  if (S.matchmakingMode === mode) return;
  runAction('matchmaking_mode_changed', function (state) {
    state.matchmakingMode = mode;
    return {
      changed: true,
      message: mode === 'balanced' ? 'Skill Balanced rotation enabled.' : 'Social Fair rotation enabled.',
      summary: 'Changed rotation style to ' + (mode === 'balanced' ? 'Skill Balanced' : 'Social Fair')
    };
  });
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
      role: 'organizer',
      playerId: null,
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

function sharedRoomUrl(mode) {
  var url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set(ROOM_PARAM, roomId);
  if (mode === 'player') url.searchParams.set('mode', 'player');
  if (mode === 'viewer') url.searchParams.set('mode', 'view');
  return url.toString();
}

function accessLabel(mode) {
  if (mode === 'player') return 'Player check-in';
  if (mode === 'viewer') return 'View-only';
  return 'Controller';
}

function copyShareLink(mode) {
  var url = sharedRoomUrl(mode);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { showToast(accessLabel(mode) + ' link copied.'); });
  } else {
    var textarea = document.createElement('textarea');
    textarea.value = url; document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    showToast(accessLabel(mode) + ' link copied.');
  }
}

function shareRoomLink(mode) {
  var shareText = mode === 'player' ? 'Check in for our pickleball rotation.' : mode === 'viewer' ? 'Follow our live pickleball rotation.' : 'Join and control our live pickleball rotation.';
  var payload = { title: roomData ? roomData.name : 'Pickleball Game Rotation', text: shareText, url: sharedRoomUrl(mode) };
  if (navigator.share) navigator.share(payload).catch(function (error) { if (error.name !== 'AbortError') copyShareLink(mode); });
  else copyShareLink(mode);
}

function renderAccessQr(mode) {
  var url = sharedRoomUrl(mode);
  document.querySelectorAll('[data-access-mode]').forEach(function (button) {
    button.classList.toggle('is-selected', button.dataset.accessMode === mode);
  });
  document.getElementById('accessLinkLabel').textContent = accessLabel(mode) + ' link';
  document.getElementById('accessLinkUrl').textContent = url;
  var summaries = {
    player: 'Players can add or choose their own name, select a level, check in, take a break, edit their level, and enable turn alerts.',
    viewer: 'Viewers can follow courts, standings, history, and activity, but cannot change the game.',
    controller: 'Controllers can manage players, court designations, rotations, winners, replacements, and team swaps.'
  };
  document.getElementById('accessRoleSummary').textContent = summaries[mode];
  document.getElementById('accessCopyBtn').onclick = function () { copyShareLink(mode); };
  document.getElementById('accessShareBtn').onclick = function () { shareRoomLink(mode); };
  var canvas = document.getElementById('accessQrCanvas');
  if (!canvas || !window.QRCode) return;
  window.QRCode.toCanvas(canvas, url, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#092419', light: '#ffffff' }
  }).catch(function () { showToast('Could not draw the QR code. The link is still available.'); });
}

function openAccessLinks() {
  if (!roomId || !isFullController()) return;
  var modal = openModal({
    title: 'QR codes & access links',
    copy: 'Choose what the link opens. Controller links keep full game controls; player and view-only links show simplified screens.',
    body: '<div class="access-tabs">'
      + '<button class="access-tab" type="button" data-access-mode="player">✓ Player Check-In</button>'
      + '<button class="access-tab" type="button" data-access-mode="viewer">👁 View Only</button>'
      + '<button class="access-tab" type="button" data-access-mode="controller">🎛 Controller</button></div>'
      + '<div class="qr-shell"><canvas id="accessQrCanvas" class="qr-canvas" aria-label="QR code"></canvas>'
      + '<div class="qr-link-label" id="accessLinkLabel"></div><div class="qr-url" id="accessLinkUrl"></div></div>'
      + '<div class="access-role-summary" id="accessRoleSummary"></div>'
      + '<div class="access-note">Player link guests can choose an existing roster name or add themselves. Anyone with the controller link can control the game. These links are not password-protected roles.</div>'
  });
  modal.body.querySelectorAll('[data-access-mode]').forEach(function (button) {
    button.onclick = function () { renderAccessQr(button.dataset.accessMode); };
  });
  var copyButton = document.createElement('button');
  copyButton.id = 'accessCopyBtn'; copyButton.className = 'btn btn-ghost'; copyButton.textContent = '⧉ Copy Link';
  var shareButton = document.createElement('button');
  shareButton.id = 'accessShareBtn'; shareButton.className = 'btn btn-primary'; shareButton.textContent = '↗ Share';
  modal.actions.appendChild(copyButton); modal.actions.appendChild(shareButton);
  renderAccessQr('player');
}

function leaveSharedRoom() {
  if (roomData && roomData.status !== 'active') {
    if (accessMode === 'player') removePushSubscription().then(navigateHome);
    else navigateHome();
    return;
  }
  if (accessMode === 'player' && linkedPlayerId && currentUser) {
    var player = Engine.playerById(S, linkedPlayerId);
    if (player && player.checkedIn && player.checkedInUid === currentUser.uid) {
      runAction('player_checked_out', function (state) {
        var result = Engine.checkOutPlayer(state, linkedPlayerId, currentUser.uid);
        if (!result.changed) return result;
        return { changed: true, summary: result.player.name + ' checked out' };
      }, { selfService: true, undoable: false }).then(function (result) {
        if (!result) return;
        localStorage.removeItem(playerStorageKey());
        return removePushSubscription().then(navigateHome);
      });
      return;
    }
    removePushSubscription().then(navigateHome);
    return;
  }
  navigateHome();
}

function navigateHome() {
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
  var sessionDisabled = !navigator.onLine || sharedBusy || !roomData || roomData.status !== 'active';
  var roleText = isOrganizer ? 'Organizer' : accessMode === 'player' ? 'Player check-in' : accessMode === 'viewer' ? 'View only' : 'Controller';
  var player = linkedPlayerId ? Engine.playerById(S, linkedPlayerId) : null;
  var actions = '';
  if (isFullController()) {
    actions = '<button class="btn btn-primary" onclick="openAccessLinks()">▦ QR & Links</button>'
      + '<button class="btn btn-ghost" onclick="shareRoomLink(\'controller\')">↗ Share Controller</button>'
      + (isOrganizer ? '<button class="btn btn-ghost" onclick="undoLastAction()" ' + (undoDisabled ? 'disabled' : '') + '>↶ Undo</button>' : '')
      + (isOrganizer && roomData && roomData.status === 'active' ? '<button class="btn btn-danger" onclick="endSharedRoom()">End Session</button>' : '');
  } else if (accessMode === 'player') {
    actions = '<button class="btn ' + (player && player.notAvailable ? 'btn-primary' : 'btn-accent') + '" onclick="toggleMyAvailability()" '
      + (sessionDisabled ? 'disabled' : '') + '>' + (player && player.notAvailable ? '✓ I’m Ready' : '⏸ Take a Break') + '</button>'
      + (player ? '<button class="btn btn-ghost" onclick="openSkillPicker(\'' + esc(player.id) + '\')" '
        + (sessionDisabled ? 'disabled' : '') + '>⭐ My Skill: ' + esc(Engine.skillLevelLabel(player.skillRating))
        + (player.skillLevelConfirmed ? '' : ' · Confirm') + '</button>' : '')
      + '<button class="btn btn-ghost alert-status-' + esc(alertStatus) + '" onclick="enablePlayerAlerts()" '
        + (alertStatus === 'enabling' ? 'disabled' : '') + '>' + esc(alertButtonCopy()) + '</button>';
  }
  card.innerHTML = '<div class="session-top"><div><div class="session-title">' + esc(roomData ? roomData.name : 'Live game') + '</div>'
    + '<div class="session-sub">Live shared rotation · ' + esc(roleText) + '</div></div>'
    + '<span class="sync-badge ' + esc(syncStatus) + '">' + esc(statusText) + '</span></div>'
    + '<div class="room-identity">' + (accessMode === 'player' ? 'Checked in as ' : accessMode === 'viewer' ? 'Watching as ' : 'Controlling as ') + '<strong>' + esc(controllerName || 'Guest') + '</strong></div>'
    + '<div class="session-actions">' + actions
    + '<button class="btn btn-ghost" onclick="openRoleHelp()">❓ How to Use</button>'
    + '<button class="btn btn-ghost" onclick="leaveSharedRoom()">Leave</button>'
    + '</div>';
}

function renderPlayerList() {
  var element = document.getElementById('playerList');
  if (!S.players.length) { element.innerHTML = '<div class="empty-hint">No players added yet. Enter names above.</div>'; return; }
  var locked = new Set(Engine.lockedIds(S));
  element.innerHTML = S.players.map(function (player, index) {
    var isLocked = locked.has(player.id);
    var badges = (isLocked ? '<span class="locked-badge">🔒 On Court</span>' : player.notAvailable ? '<span class="na-tag">⛔ Not Available</span>' : '')
      + (player.checkedIn ? '<span class="checkin-badge">✓ Checked In</span>' : '')
      + (player.id === linkedPlayerId ? '<span class="you-badge">You</span>' : '')
      + (!isLocked && !player.notAvailable && player.wins ? '<span class="wins-badge">🏆 ' + player.wins + 'W</span>' : '')
      + (!isLocked && !player.notAvailable && player.games ? '<span class="games-badge">' + player.games + 'G</span>' : '');
    var levelName = Engine.skillLevelLabel(player.skillRating);
    var skill = isFullController()
      ? '<button class="skill-badge" onclick="openSkillPicker(\'' + esc(player.id) + '\')" title="Edit skill level">⭐ ' + esc(levelName) + '</button>'
      : '<span class="skill-badge is-static">⭐ ' + esc(levelName) + '</span>';
    if (!player.skillLevelConfirmed) skill += '<span class="confirm-badge">Confirm</span>';
    var availability = !isFullController() || isLocked ? '' : '<button class="btn-na' + (player.notAvailable ? ' is-na' : '') + '" onclick="toggleNotAvailable(' + index + ')">' + (player.notAvailable ? '✅ Back In' : '⛔ NA') + '</button>';
    var remove = isFullController() ? '<button class="btn btn-ghost btn-sm" ' + (isLocked ? 'disabled data-force-disabled' : 'onclick="removePlayer(' + index + ')"') + '>✕</button>' : '';
    return '<div class="player-item' + (isLocked ? ' locked' : '') + (player.notAvailable ? ' not-avail' : '') + '">'
      + '<span class="player-name">' + (index + 1) + '. ' + esc(player.name) + '</span>'
      + '<span class="player-meta">' + badges + skill + availability + '</span>' + remove + '</div>';
  }).join('');
}

function renderMatchmakingMode() {
  document.querySelectorAll('[data-matchmaking-mode]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.matchmakingMode === S.matchmakingMode);
  });
  var help = document.getElementById('matchmakingHelp');
  if (help) help.textContent = S.matchmakingMode === 'balanced'
    ? 'Balances team skill levels after game-count and waiting fairness.'
    : 'Prioritizes fair play counts, waiting time, and fresh partners.';
  var readOnly = document.getElementById('matchmakingReadOnly');
  if (readOnly) readOnly.textContent = S.matchmakingMode === 'balanced' ? '⭐ Skill Balanced' : '🤝 Social Fair';
}

function renderCourtSkillGroups() {
  var element = document.getElementById('courtSkillGroups');
  if (!element) return;
  var editable = isFullController();
  element.innerHTML = '<div class="court-groups-heading"><span>Court Skill Designation</span><small>Used for the next generated game</small></div>'
    + S.courtStates.map(function (court, index) {
      var label = Engine.skillGroupLabel(court.skillGroup);
      if (!editable) {
        return '<div class="court-group-row"><strong>Court ' + court.courtNum + '</strong><span class="court-skill-badge group-' + esc(court.skillGroup) + '">' + esc(label) + '</span></div>';
      }
      return '<label class="court-group-row"><strong>Court ' + court.courtNum + '</strong><select class="court-group-select" aria-label="Court ' + court.courtNum + ' skill designation" onchange="setCourtSkillGroup(' + index + ', this.value)">'
        + Engine.SKILL_GROUPS.map(function (group) { return '<option value="' + group + '"' + (court.skillGroup === group ? ' selected' : '') + '>' + esc(Engine.skillGroupLabel(group)) + '</option>'; }).join('')
        + '</select></label>';
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
    var eligible = Engine.eligibleIdsForCourt(S, index).length;
    var eligibility = court.skillGroup === 'any' ? 'No game assigned yet.' : eligible + ' of 4 ' + Engine.skillGroupLabel(court.skillGroup) + ' players eligible.';
    body = '<div class="court-empty-body">' + esc(eligibility) + '</div><button class="btn btn-primary btn-block" onclick="generateForCourt(' + index + ')">▶ Generate Next Game</button>';
  }
  return '<div class="court-card court-card-' + color + (court.status === 'playing' ? ' is-playing' : court.status === 'done' ? ' is-done' : '') + '">'
    + '<div class="court-card-header"><div class="court-name"><span class="court-dot dot-' + color + '"></span>Court ' + court.courtNum + '</div><div class="court-header-badges"><span class="court-skill-badge group-' + esc(court.skillGroup) + '">' + esc(Engine.skillGroupLabel(court.skillGroup)) + '</span>' + statusBadgeHtml(court.status) + '</div></div>' + body + '</div>';
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

function activitySummary(event) {
  var summary = String(event.summary || event.type || 'Activity');
  if (event.type === 'player_checked_in') {
    return summary.replace(/ checked in with a \d(?:\.\d)? skill rating$/, ' checked in with a previous skill level');
  }
  if (event.type === 'player_self_skill_changed') {
    return summary.replace(/ updated their skill rating to \d(?:\.\d)?$/, ' updated their previous skill level');
  }
  if (event.type === 'player_skill_changed') {
    return summary.replace(/^Rated (.+) at \d(?:\.\d)?$/, 'Updated $1’s previous skill level');
  }
  return summary;
}

function renderActivitySection() {
  var element = document.getElementById('activitySection');
  if (!roomId) { element.innerHTML = ''; return; }
  var html = '<div class="card"><div class="card-title history-toggle-row" onclick="toggleActivity()"><span class="card-title-left">📝 Live Activity (' + activityEvents.length + ')</span><span>' + (activityOpen ? '▲ Hide' : '▼ Show') + '</span></div>';
  if (activityOpen) {
    if (!activityEvents.length) html += '<div class="empty-hint">No activity recorded yet.</div>';
    activityEvents.forEach(function (event) {
      var date = event.createdAt && event.createdAt.toDate ? event.createdAt.toDate() : null;
      html += '<div class="activity-item"><div><div class="activity-summary">' + esc(activitySummary(event)) + '</div><div class="activity-meta">' + esc(event.actorName || 'Controller') + '</div></div>'
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
  var sorted = Engine.rankedPlayers(S);
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
  var unavailable = !!roomId && (!navigator.onLine || sharedBusy || !roomData || roomData.status !== 'active');
  var roleReadOnly = !!roomId && !isFullController();
  ['playerCard', 'courtSettingsCard', 'actionControls', 'courtsSection'].forEach(function (id) {
    var root = document.getElementById(id);
    if (!root) return;
    root.querySelectorAll('button,input,select').forEach(function (control) { control.disabled = unavailable || roleReadOnly || control.hasAttribute('data-force-disabled'); });
  });
  var inputRow = document.querySelector('#playerCard .input-row');
  if (inputRow) inputRow.hidden = roleReadOnly;
  var actions = document.getElementById('actionControls');
  if (actions) actions.hidden = roleReadOnly;
  var courtSelector = document.getElementById('courtSelector');
  var courtReadOnly = document.getElementById('courtReadOnly');
  if (courtSelector) courtSelector.hidden = roleReadOnly;
  if (courtReadOnly) {
    courtReadOnly.hidden = !roleReadOnly;
    courtReadOnly.textContent = S.courts + ' court' + (S.courts === 1 ? '' : 's');
  }
  var modeOptions = document.querySelector('.matchmaking-options');
  var modeReadOnly = document.getElementById('matchmakingReadOnly');
  if (modeOptions) modeOptions.hidden = roleReadOnly;
  if (modeReadOnly) modeReadOnly.hidden = !roleReadOnly;
}

function renderAll() {
  renderSessionCard();
  syncCourtButtons();
  renderMatchmakingMode();
  renderCourtSkillGroups();
  updateStats();
  renderPlayerList();
  renderAvailableSection();
  renderCourtsSection();
  renderLeaderboard();
  renderHistorySection();
  renderActivitySection();
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

renderAppVersion();
var updateAppButton = document.getElementById('updateAppBtn');
if (updateAppButton) {
  updateAppButton.addEventListener('click', updateAppToLatest);
  checkLatestVersion();
}
if (sessionStorage.getItem('pickleballUpdateRequested')) {
  sessionStorage.removeItem('pickleballUpdateRequested');
  setTimeout(function () { showToast('App updated to v' + APP_VERSION + '.'); }, 700);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (registration) {
      appServiceWorkerRegistration = registration;
      registration.update().catch(function () {});
      if (appInitialised && roomId && accessMode === 'player') refreshPlayerAlerts();
    }).catch(function (error) { console.warn('Service worker failed:', error); });
  });
}
