'use strict';

var Engine = window.PickleballRotation;
var RoomData = window.PickleballRoomData;
var APP_VERSION = '3.11.1';
var VERSION_URL = './version.json';
var LOCAL_KEY = 'pickleballRotation_v3';
var LEGACY_KEY = 'pickleballRotation_v2';
var DISPLAY_PREFS_KEY = 'pickleballDisplayPreferences_v1';
var TIMEOUT_ALERTS_KEY = 'pickleballTimeoutAlerts_v1';
var ROOM_PARAM = 'room';
var EVENT_LIMIT = 100;
var LARGE_ROOM_EVENT_LIMIT = 20;
var LARGE_ROOM_THRESHOLD = 50;
var LARGE_ROOM_PAGE_SIZE = 30;
var LARGE_ROOM_CHIP_LIMIT = 40;
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
var pendingControllerSelection = null;
var roomRef = null;
var roomData = null;
var currentUser = null;
var controllerName = '';
var isOrganizer = false;
var roomUnsubscribe = null;
var eventsUnsubscribe = null;
var activityEvents = [];
var activityOpen = false;
var activityLoading = false;
var activityError = '';
var historyOpen = false;
var playerSearchQuery = '';
var standingsSearchQuery = '';
var playerVisibleLimit = LARGE_ROOM_PAGE_SIZE;
var standingsVisibleLimit = LARGE_ROOM_PAGE_SIZE;
var inFlightActionKeys = new Set();
var courtDisplayActive = false;
var displayPreferences = loadDisplayPreferences();
var swapState = null;
var sharedBusy = false;
var syncStatus = roomId ? 'syncing' : 'connected';
var appInitialised = false;
var toastTimer = null;
var deferredPrompt = null;
var organizerGrantId = null;
var appUpdateInProgress = false;
var appServiceWorkerRegistration = null;
var alertStatus = 'checking';
var initialRoomSnapshotSeen = false;
var lastTurnAlertKey = '';
var ROLE_HELP_VERSION = 'v9';

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
      'Choose your roster name, or add yourself, then select Beginner or Non-Beginner.',
      'Use the Available, On Court, Up Next, and Taking a Break labels to understand your current status.',
      'In an Up Next panel, check your court, partner, opponents, and the court’s skill designation.',
      'Tap Enable Alerts. Your free Up Next alert arrives as soon as the controller prepares your lineup while the app is open or running.',
      'After the alert, prepare near the named court so play can begin promptly.',
      'Game credit and the court timer begin only after the controller taps Start Game. A countdown shows when that court has a time limit.',
      'Use My Skill or Take a Break only when you are not on court or reserved Up Next.',
      'If you need to leave or take a break while Up Next, ask a controller to edit or remove your prepared assignment first.',
      'Use player and standings search in larger groups, and open Display Settings for larger text, high contrast, sound, or vibration preferences.',
      'Read the organizer’s announcement and Session Rules when they are provided.',
      'If a court reaches its time limit, it stays active until a controller records the real-world winner.',
      'Follow standings, court timers, Game History, and Session Summary & Export for live and completed results.'
    ]
  },
  viewer: {
    title: 'View Only · How to Use',
    copy: 'Use this access type to follow the session without changing it.',
    steps: [
      'Active matches and Up Next lineups are shown separately on each court.',
      'Read court names, skill designations, teams, elapsed timers or countdowns, and status badges.',
      'Players shown Up Next are reserved and cannot be placed in another lineup.',
      'After a winner is recorded, the prepared lineup moves into the main court view and waits for Start Game.',
      'Use search for a large roster, open Live Activity only when you need it, and use Court Display for a fullscreen court board.',
      'Use Display Settings for larger text, high contrast, sound, or vibration preferences, and read Session Rules or announcements when provided.',
      'Follow Player Standings, Game History, Live Activity, and Session Summary & Export.',
      'The page updates automatically. Game controls are intentionally unavailable in View Only mode.'
    ]
  },
  controller: {
    title: 'Controller · How to Use',
    copy: 'Use this access type to operate the shared rotation.',
    steps: [
      'Choose Controller Only, Existing Player, or New Player when joining. You keep full controller controls in every option.',
      'Use Prepare Courts & Up Next to fill idle courts first, then prepare one next lineup for each active court.',
      'Use Prepare Fair Next on one active court when its next lineup is empty.',
      'Use Build Next Manually to choose the exact four players and teams.',
      'Edit or remove a prepared lineup while the current match continues.',
      'Prepared players are reserved and cannot be assigned, replaced, removed, checked out, or placed on break elsewhere.',
      'Record the current winner and verify that its prepared lineup is promoted into the main court view.',
      'Tap Start Game only when the physical court is ready. Credits, waiting metrics, and the timer update at that point; matchup history updates when a winner is recorded.',
      'If a reserved player needs to leave or rest, edit or remove the Up Next lineup first.',
      'Set each court’s optional time limit under Court Names, Skill & Timer. The active match keeps the limit it had when Start Game was tapped.',
      'When a countdown reaches zero, use the existing Team A Won or Team B Won button after checking the real-world result; the app does not track scores.',
      'Use custom court names, skill designations, Replace, team swaps, Player Tools, alerts, Session Summary, and CSV export as needed.',
      'On Any courts, Skill Balanced treats two-and-two mixed games and all-one-level games as equally balanced. A mixed two-and-two game places one Beginner and one Non-Beginner player on each team.',
      'If the fairest four players have a one-and-three skill mix, the app uses the closest possible teams instead of leaving the court empty.',
      'Use QR & Links to explain and share Player Check-In, View Only, or Controller access.',
      'Use player and standings search, Court Display, display preferences, Session Rules, and announcements for larger sessions. Large Room Mode activates automatically at 50 players.',
      'Live Activity connects only while opened. Repeated actions are safely deduplicated, and Undo preserves unrelated later check-ins by restoring only changed fields.',
      'Organizer only: Undo, Reset All, Clear All Players, Reset Stats, and End Session.'
    ]
  }
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadDisplayPreferences() {
  var defaults = { highContrast: false, largeText: false, sound: false, vibration: true };
  try {
    var stored = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || '{}');
    Object.keys(defaults).forEach(function (key) { if (typeof stored[key] !== 'boolean') stored[key] = defaults[key]; });
    return stored;
  } catch (error) {
    return defaults;
  }
}

function saveDisplayPreferences() {
  localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify(displayPreferences));
  applyDisplayPreferences();
}

function applyDisplayPreferences() {
  document.body.classList.toggle('high-contrast', !!displayPreferences.highContrast);
  document.documentElement.classList.toggle('large-text', !!displayPreferences.largeText);
}

function isLargeRoom() {
  return S.players.length >= LARGE_ROOM_THRESHOLD;
}

function activityQueryLimit() {
  return isLargeRoom() ? LARGE_ROOM_EVENT_LIMIT : EVENT_LIMIT;
}

function actionHash(value) {
  var hash = 2166136261;
  for (var index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stableActionId(type, dedupeKey) {
  return 'a_' + actionHash([roomId, type, dedupeKey].join('|'));
}

function playTurnSound() {
  if (!displayPreferences.sound) return;
  try {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    var context = new AudioContextClass();
    var oscillator = context.createOscillator();
    var gain = context.createGain();
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.3);
    oscillator.onended = function () { context.close(); };
  } catch (error) {
    console.warn('Turn sound unavailable:', error);
  }
}

function timeoutAlertsStorageKey() {
  return TIMEOUT_ALERTS_KEY + '_' + (roomId || 'solo');
}

function timeoutAlertWasDelivered(deliveryKey) {
  try {
    var delivered = JSON.parse(localStorage.getItem(timeoutAlertsStorageKey()) || '[]');
    return Array.isArray(delivered) && delivered.indexOf(deliveryKey) !== -1;
  } catch (error) {
    return false;
  }
}

function markTimeoutAlertDelivered(deliveryKey) {
  try {
    var delivered = JSON.parse(localStorage.getItem(timeoutAlertsStorageKey()) || '[]');
    if (!Array.isArray(delivered)) delivered = [];
    if (delivered.indexOf(deliveryKey) === -1) delivered.push(deliveryKey);
    localStorage.setItem(timeoutAlertsStorageKey(), JSON.stringify(delivered.slice(-60)));
  } catch (error) {
    console.warn('Could not remember timer alert:', error);
  }
}

function alertControllerToTimeLimit(courtIndex, gameNum, courtName, deadlineAt) {
  if (!isFullController()) return;
  var deliveryKey = [courtIndex, gameNum, deadlineAt].join('_');
  if (timeoutAlertWasDelivered(deliveryKey)) return;
  markTimeoutAlertDelivered(deliveryKey);
  showToast('⏰ ' + courtName + ' reached its time limit. Tap the winning team.');
  playTurnSound();
  if (displayPreferences.vibration && navigator.vibrate) navigator.vibrate([220, 100, 220, 100, 320]);
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
    var assignments = [];
    if (court.status === 'playing') assignments.push({ lineup: court, status: 'playing', gameNum: court.gameNum });
    if (court.nextGame) assignments.push({ lineup: court.nextGame, status: 'next', gameNum: court.nextGame.gameNum });
    for (var assignmentIndex = 0; assignmentIndex < assignments.length; assignmentIndex += 1) {
      var assignment = assignments[assignmentIndex];
      var team = assignment.lineup.teamA.indexOf(playerId) !== -1 ? 'A' : assignment.lineup.teamB.indexOf(playerId) !== -1 ? 'B' : null;
      if (!team) continue;
      var ownTeam = team === 'A' ? assignment.lineup.teamA : assignment.lineup.teamB;
      var otherTeam = team === 'A' ? assignment.lineup.teamB : assignment.lineup.teamA;
      return {
        courtNum: court.courtNum,
        courtName: Engine.courtDisplayName(court),
        gameNum: assignment.gameNum,
        status: assignment.status,
        partner: Engine.playerName(state, ownTeam.find(function (id) { return id !== playerId; })),
        opponents: otherTeam.map(function (id) { return Engine.playerName(state, id); })
      };
    }
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
  alert.querySelector('.turn-alert-title').textContent = assignment.status === 'next'
    ? 'You’re up next on ' + assignment.courtName + '!'
    : 'You’re up on ' + assignment.courtName + '!';
  alert.querySelector('.turn-alert-copy').textContent = 'Partner: ' + assignment.partner + ' · vs ' + assignment.opponents.join(' & ');
  alert.classList.add('visible');
  playTurnSound();
  if (displayPreferences.vibration && navigator.vibrate) navigator.vibrate([180, 90, 180]);
}

function showSystemTurnNotification(assignment, deliveryKey) {
  if (!assignment || !localStorage.getItem(alertsStorageKey())) return;
  if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
  var title = assignment.status === 'next'
    ? 'You’re up next on ' + assignment.courtName + '!'
    : 'You’re up on ' + assignment.courtName + '!';
  var body = 'Partner: ' + assignment.partner + ' · vs ' + assignment.opponents.join(' & ');
  var registrationPromise = appServiceWorkerRegistration
    ? Promise.resolve(appServiceWorkerRegistration)
    : navigator.serviceWorker.ready;
  registrationPromise.then(function (registration) {
    appServiceWorkerRegistration = registration;
    var notificationOptions = {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: deliveryKey || 'pickleball-turn',
      renotify: false,
      data: { url: sharedRoomUrl(isFullController() ? 'controller' : 'player'), deliveryId: deliveryKey || '' }
    };
    if (displayPreferences.vibration) notificationOptions.vibrate = [180, 90, 180];
    return registration.showNotification(title, notificationOptions);
  }).catch(function (error) { console.warn('Could not show turn notification:', error); });
}

function detectNewPlayerAssignment(beforeState, nextState, revision) {
  if (!linkedPlayerId || !initialRoomSnapshotSeen || (accessMode !== 'player' && !isFullController())) return;
  var before = findPlayerAssignment(beforeState, linkedPlayerId);
  var after = findPlayerAssignment(nextState, linkedPlayerId);
  if (!after) return;
  if (before && before.courtNum === after.courtNum && before.gameNum === after.gameNum) return;
  var deliveryKey = [roomId, revision, after.courtNum, after.gameNum, linkedPlayerId].join('_');
  showTurnAlert(after, deliveryKey);
  showSystemTurnNotification(after, deliveryKey);
}

function disablePlayerAlerts() {
  localStorage.removeItem(alertsStorageKey());
  if ('Notification' in window && 'serviceWorker' in navigator) {
    alertStatus = Notification.permission === 'denied' ? 'blocked' : 'available';
  }
  renderSessionCard();
  return Promise.resolve();
}

function enablePlayerAlerts() {
  if (alertStatus === 'on') { showToast('Free alerts are on while this app remains open or running.'); return; }
  if (alertStatus === 'blocked') {
    showToast('Notifications are blocked. Allow them in your browser or phone settings.'); return;
  }
  if (alertStatus === 'unavailable') {
    showToast(/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'On iPhone, install and open this app from your Home Screen to use free alerts.' : 'Device alerts are unavailable here. Keep the page open for the in-app alert.');
    return;
  }
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    alertStatus = 'unavailable';
    renderSessionCard();
    return;
  }
  alertStatus = 'enabling';
  renderSessionCard();
  var permissionPromise = Notification.permission === 'default'
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission);
  permissionPromise.then(function (permission) {
    if (permission === 'granted') {
      localStorage.setItem(alertsStorageKey(), '1');
      alertStatus = 'on';
      showToast('Free alerts enabled. Keep the app open or running in the background.');
    } else {
      localStorage.removeItem(alertsStorageKey());
      alertStatus = permission === 'denied' ? 'blocked' : 'available';
      showToast('Alerts were not enabled. In-app alerts still work while this page is open.');
    }
    renderSessionCard();
  }).catch(function (error) {
    console.warn('Could not enable alerts:', error);
    alertStatus = Notification.permission === 'denied' ? 'blocked' : 'unavailable';
    renderSessionCard();
    showToast('Could not enable device alerts. In-app alerts still work while this page is open.');
  });
}

function refreshPlayerAlerts() {
  if (!linkedPlayerId || (accessMode !== 'player' && !isFullController())) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    alertStatus = 'unavailable'; renderSessionCard(); return;
  }
  alertStatus = Notification.permission === 'denied'
    ? 'blocked'
    : Notification.permission === 'granted' && localStorage.getItem(alertsStorageKey())
      ? 'on'
      : 'available';
  renderSessionCard();
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

function openDisplaySettings() {
  var modal = openModal({
    title: 'Display Settings',
    copy: 'These preferences are saved only on this device and do not add network activity.',
    body: '<div class="preference-list">'
      + preferenceOption('prefHighContrast', 'High contrast', 'Stronger colors and borders for easier reading.', displayPreferences.highContrast)
      + preferenceOption('prefLargeText', 'Large text', 'Increase text throughout the app.', displayPreferences.largeText)
      + preferenceOption('prefSound', 'Alert sound', 'Play a short sound for lineup and controller timer alerts.', displayPreferences.sound)
      + preferenceOption('prefVibration', 'Vibration', 'Vibrate for lineup and controller timer alerts, when supported.', displayPreferences.vibration)
      + '</div>'
  });
  [['prefHighContrast', 'highContrast'], ['prefLargeText', 'largeText'], ['prefSound', 'sound'], ['prefVibration', 'vibration']].forEach(function (entry) {
    var input = document.getElementById(entry[0]);
    input.onchange = function () {
      displayPreferences[entry[1]] = input.checked;
      saveDisplayPreferences();
      if (entry[1] === 'sound' && input.checked) playTurnSound();
    };
  });
  var display = document.createElement('button');
  display.className = 'btn btn-accent';
  display.textContent = '⛶ Court Display';
  display.onclick = function () { closeModal(); enterCourtDisplay(); };
  var close = document.createElement('button');
  close.className = 'btn btn-ghost'; close.textContent = 'Close'; close.onclick = closeModal;
  modal.actions.appendChild(display); modal.actions.appendChild(close);
}

function preferenceOption(id, title, copy, checked) {
  return '<label class="preference-option"><span>' + esc(title) + '<small>' + esc(copy) + '</small></span>'
    + '<input id="' + esc(id) + '" type="checkbox"' + (checked ? ' checked' : '') + '></label>';
}

function enterCourtDisplay() {
  courtDisplayActive = true;
  document.body.classList.add('court-display-mode');
  var title = document.getElementById('courtDisplayTitle');
  if (title) title.textContent = roomData && roomData.name ? roomData.name : 'Live Courts';
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(function () {});
  }
}

function exitCourtDisplay() {
  courtDisplayActive = false;
  document.body.classList.remove('court-display-mode');
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
}

function openSessionInfoEditor() {
  if (!isFullController()) return;
  var modal = openModal({
    title: 'Session Rules & Announcement',
    copy: 'Keep these brief. Everyone in the room will see them on their next live update.',
    body: '<label class="modal-label" for="sessionAnnouncementInput">Announcement</label>'
      + '<textarea class="modal-field modal-textarea" id="sessionAnnouncementInput" maxlength="240" placeholder="Example: Court 3 is temporarily closed.">' + esc(S.sessionAnnouncement || '') + '</textarea>'
      + '<label class="modal-label" for="sessionRulesInput" style="margin-top:12px">Session Rules</label>'
      + '<textarea class="modal-field modal-textarea" id="sessionRulesInput" maxlength="1500" placeholder="Example: Games to 11, win by 2. Call your own lines.">' + esc(S.sessionRules || '') + '</textarea>'
  });
  var cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost'; cancel.textContent = 'Cancel'; cancel.onclick = closeModal;
  var save = document.createElement('button');
  save.className = 'btn btn-primary'; save.textContent = 'Save Session Info';
  save.onclick = function () {
    var announcement = document.getElementById('sessionAnnouncementInput').value.trim().slice(0, 240);
    var rules = document.getElementById('sessionRulesInput').value.trim().slice(0, 1500);
    closeModal();
    runAction('session_info_changed', function (state) {
      if (state.sessionAnnouncement === announcement && state.sessionRules === rules) return { changed: false, reason: 'Session information is unchanged.' };
      state.sessionAnnouncement = announcement;
      state.sessionRules = rules;
      return { changed: true, message: 'Session information updated.', summary: 'Updated session rules and announcement' };
    }, { dedupeKey: 'session_info:' + (roomData ? roomData.revision : S.rotationRound) + ':' + actionHash(announcement + '|' + rules) });
  };
  modal.actions.appendChild(cancel); modal.actions.appendChild(save);
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

function controllerParticipationStorageKey() {
  return 'pickleballControllerParticipation_' + roomId;
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

function choosePlayerIdentity(options) {
  options = options || {};
  var allowControllerOnly = !!options.allowControllerOnly;
  var closable = options.closable !== false;
  var currentPlayerId = options.currentPlayerId || null;
  var settled = false;

  return new Promise(function (resolve) {
    function finish(selection) {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(selection);
    }

    function cancel() { finish(null); }

    function addCancelAction(modal) {
      if (!closable) return;
      var cancelButton = document.createElement('button');
      cancelButton.className = 'btn btn-ghost';
      cancelButton.textContent = 'Cancel';
      cancelButton.onclick = cancel;
      modal.actions.appendChild(cancelButton);
    }

    function showParticipationChoices() {
      var modal = openModal({
        title: options.title || 'How are you joining?',
        copy: options.copy || 'Choose whether you are controlling only or also joining the player rotation.',
        body: '<div class="participation-picker">'
          + '<button class="picker-option participation-option" type="button" data-participation="controller_only"><strong>🎛 Controller Only</strong><small>Control the rotation without joining as a player</small></button>'
          + '<button class="picker-option participation-option" type="button" data-participation="existing"><strong>✓ Existing Player</strong><small>Choose and check in a player already on the roster</small></button>'
          + '<button class="picker-option participation-option" type="button" data-participation="new"><strong>＋ New Player</strong><small>Add your player name and skill level to the roster</small></button>'
          + '</div>',
        closable: closable,
        onClose: cancel
      });
      modal.body.querySelector('[data-participation="controller_only"]').onclick = function () { finish({ kind: 'controller_only', playerId: null }); };
      modal.body.querySelector('[data-participation="existing"]').onclick = showPicker;
      modal.body.querySelector('[data-participation="new"]').onclick = showEnrollmentForm;
      addCancelAction(modal);
    }

    function showPicker() {
      var rosterOptions = S.players.map(function (player) {
        var claimed = player.checkedInUid && player.checkedInUid !== currentUser.uid;
        var current = player.id === currentPlayerId;
        var disabled = claimed || current;
        var detail = claimed ? ' · already checked in' : current ? ' · currently selected' : ' · ' + Engine.skillLevelLabel(player.skillRating);
        return '<button class="picker-option" type="button" data-player-id="' + esc(player.id) + '" ' + (disabled ? 'disabled' : '') + '>'
          + '<strong>' + esc(player.name) + '</strong>' + esc(detail) + '</button>';
      }).join('');
      var addMyself = allowControllerOnly ? '' : '<button class="picker-option self-enroll-option" id="selfEnrollBtn" type="button"><strong>＋ Add myself to this game</strong><small>Create your own player name and check in</small></button>';
      var roster = S.players.length
        ? addMyself + (addMyself ? '<div class="self-enroll-divider"><span>or choose a listed name</span></div>' : '') + '<div class="picker-list">' + rosterOptions + '</div>'
        : '<div class="empty-hint self-enroll-empty">No players are listed yet.</div>' + addMyself;
      var modal = openModal({
        title: allowControllerOnly ? 'Choose an existing player' : 'Who are you?',
        copy: allowControllerOnly ? 'Claim an available roster entry. Your controller name remains separate.' : 'Choose your name, or add yourself if you are not listed.',
        body: roster,
        closable: closable,
        onClose: cancel
      });
      modal.body.querySelectorAll('[data-player-id]').forEach(function (button) {
        button.onclick = function () {
          var player = Engine.playerById(S, button.dataset.playerId);
          if (player) showExistingPlayerForm(player);
        };
      });
      var selfEnroll = document.getElementById('selfEnrollBtn');
      if (selfEnroll) selfEnroll.onclick = showEnrollmentForm;
      if (allowControllerOnly || closable) {
        var back = document.createElement('button');
        back.className = 'btn btn-ghost';
        back.textContent = allowControllerOnly ? '← Back' : 'Cancel';
        back.onclick = allowControllerOnly ? showParticipationChoices : cancel;
        modal.actions.appendChild(back);
      }
    }

    function showExistingPlayerForm(player) {
      var selectedRating = player.skillLevelConfirmed ? player.skillRating : null;
      var modal = openModal({
        title: 'Check in as ' + player.name,
        copy: player.skillLevelConfirmed
          ? 'Confirm the player and skill level before joining the rotation.'
          : 'Choose one of the two current skill levels before joining the rotation.',
        body: '<div class="identity-summary"><span>Player name</span><strong>' + esc(player.name) + '</strong></div>'
          + skillRatingQuestion(selectedRating),
        closable: closable,
        onClose: cancel
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
      join.onclick = function () {
        if (selectedRating) finish({ kind: 'existing', playerId: player.id, player: player, skillRating: selectedRating });
      };
      modal.actions.appendChild(back);
      modal.actions.appendChild(join);
    }

    function showEnrollmentForm() {
      var selectedRating = null;
      var modal = openModal({
        title: allowControllerOnly ? 'Join as a new player' : 'Add yourself',
        copy: 'Enter the player name and skill level everyone will see in the rotation.',
        body: '<label class="modal-label" for="selfEnrollName">Your player name</label>'
          + '<input class="modal-field" id="selfEnrollName" maxlength="50" autocomplete="name" placeholder="Enter your name">'
          + skillRatingQuestion(selectedRating)
          + '<div class="modal-inline-error" id="selfEnrollError" role="alert"></div>',
        closable: closable,
        onClose: cancel
      });
      var join;
      bindSkillRatingQuestion(modal.body, function (rating) {
        selectedRating = rating;
        if (join) join.disabled = false;
      });
      var input = document.getElementById('selfEnrollName');
      input.value = options.prefillName || '';
      var error = document.getElementById('selfEnrollError');
      var back = document.createElement('button');
      back.className = 'btn btn-ghost';
      back.textContent = '← Back';
      back.onclick = allowControllerOnly ? showParticipationChoices : showPicker;
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
        finish({ kind: 'new', playerId: enrollment.id, player: enrollment, enrollment: enrollment, skillRating: selectedRating });
      }
      join.onclick = submit;
      input.oninput = function () { error.textContent = ''; };
      input.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); submit(); } };
      modal.actions.appendChild(back);
      modal.actions.appendChild(join);
      setTimeout(function () { input.focus(); input.select(); }, 30);
    }

    if (allowControllerOnly) showParticipationChoices();
    else showPicker();
  });
}

function ensurePlayerIdentity() {
  S = RoomData.stateFromRoom(roomData, Engine);
  pendingPlayerSkillRating = null;
  var savedPlayer = Engine.playerById(S, localStorage.getItem(playerStorageKey()));
  if (savedPlayer && savedPlayer.skillLevelConfirmed && savedPlayer.checkedIn && savedPlayer.checkedInUid === currentUser.uid && !savedPlayer.notAvailable) {
    linkedPlayerId = savedPlayer.id;
    controllerName = savedPlayer.name;
    return Promise.resolve(savedPlayer);
  }
  return choosePlayerIdentity({ allowControllerOnly: false, closable: false }).then(function (selection) {
    pendingPlayerEnrollment = selection.enrollment || null;
    pendingPlayerSkillRating = selection.skillRating;
    linkedPlayerId = selection.playerId;
    controllerName = selection.player.name;
    localStorage.setItem(playerStorageKey(), linkedPlayerId);
    return selection.player;
  });
}

function rememberControllerParticipation(kind, playerId) {
  localStorage.setItem(controllerParticipationStorageKey(), kind === 'controller_only' ? 'controller_only' : 'player');
  if (playerId) localStorage.setItem(playerStorageKey(), playerId);
  else localStorage.removeItem(playerStorageKey());
}

function ensureControllerParticipation() {
  if (!roomData || roomData.status !== 'active') return Promise.resolve(null);
  var memberRef = fbDb.collection('roomMembers').doc(roomId + '_' + currentUser.uid);
  return memberRef.get().catch(function () { return null; }).then(function (snapshot) {
    var membership = snapshot && snapshot.exists ? snapshot.data() : null;
    var candidateIds = [membership && membership.playerId, localStorage.getItem(playerStorageKey())];
    var ownedPlayer = S.players.find(function (player) { return player.checkedIn && player.checkedInUid === currentUser.uid; });
    if (ownedPlayer) candidateIds.unshift(ownedPlayer.id);
    var restored = null;
    candidateIds.some(function (candidateId) {
      var player = Engine.playerById(S, candidateId);
      if (player && player.checkedIn && player.checkedInUid === currentUser.uid) { restored = player; return true; }
      return false;
    });
    if (restored) {
      linkedPlayerId = restored.id;
      rememberControllerParticipation('player', restored.id);
      return restored;
    }
    if (localStorage.getItem(controllerParticipationStorageKey()) === 'controller_only') {
      linkedPlayerId = null;
      return null;
    }
    return choosePlayerIdentity({
      allowControllerOnly: true,
      closable: false,
      prefillName: controllerName
    }).then(function (selection) {
      pendingControllerSelection = selection;
      if (selection.kind === 'controller_only') rememberControllerParticipation('controller_only', null);
      return selection;
    });
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

function commitControllerParticipation(selection) {
  if (!isFullController() || !currentUser || !selection) return Promise.resolve(null);
  var previousPlayerId = linkedPlayerId;
  var targetPlayerId = selection.kind === 'controller_only' ? null : selection.playerId;
  if (!previousPlayerId && !targetPlayerId) {
    pendingControllerSelection = null;
    linkedPlayerId = null;
    rememberControllerParticipation('controller_only', null);
    renderSessionCard();
    return Promise.resolve({ changed: true, controllerOnly: true });
  }
  var previousPlayer = previousPlayerId ? Engine.playerById(S, previousPlayerId) : null;
  var eventType = !targetPlayerId
    ? 'controller_player_unlinked'
    : selection.kind === 'new'
      ? 'controller_player_enrolled'
      : previousPlayerId ? 'controller_player_switched' : 'controller_player_linked';

  return runAction(eventType, function (state) {
    var engineSelection = selection.kind === 'new'
      ? { kind: 'new', playerId: selection.enrollment.id, name: selection.enrollment.name, skillRating: selection.skillRating }
      : { kind: selection.kind, playerId: targetPlayerId, skillRating: selection.skillRating };
    var changed = Engine.changeOwnedPlayer(state, previousPlayerId, engineSelection, currentUser.uid, controllerName);
    if (!changed.changed) return changed;
    if (!targetPlayerId) {
      return {
        changed: true,
        player: changed.outgoing,
        message: 'You are now Controller Only.',
        summary: 'Stopped playing as ' + changed.outgoing.name + ' and remained a controller'
      };
    }
    return {
      changed: true,
      player: changed.incoming,
      message: 'Playing as ' + changed.incoming.name + ' while keeping controller access.',
      summary: previousPlayer
        ? 'Changed playing identity from ' + previousPlayer.name + ' to ' + changed.incoming.name
        : (selection.kind === 'new' ? 'Added and joined as ' : 'Joined the rotation as ') + changed.incoming.name
    };
  }, { undoable: false, membershipPlayerId: targetPlayerId }).then(function (result) {
    if (!result) return null;
    pendingControllerSelection = null;
    linkedPlayerId = targetPlayerId;
    rememberControllerParticipation(targetPlayerId ? 'player' : 'controller_only', targetPlayerId);
    if (targetPlayerId) refreshPlayerAlerts();
    else {
      localStorage.removeItem(alertsStorageKey());
      alertStatus = ('Notification' in window && Notification.permission === 'denied') ? 'blocked' : 'available';
    }
    renderSessionCard();
    return result;
  });
}

function openControllerParticipationPicker() {
  if (!isFullController() || !roomData || roomData.status !== 'active') return;
  if (linkedPlayerId && Engine.lockedIds(S).indexOf(linkedPlayerId) !== -1) {
    showToast('Leave the active or Up Next lineup before changing your player identity.');
    return;
  }
  choosePlayerIdentity({
    allowControllerOnly: true,
    closable: true,
    currentPlayerId: linkedPlayerId,
    prefillName: controllerName,
    title: linkedPlayerId ? 'Change controller participation' : 'Join the player rotation'
  }).then(function (selection) {
    if (selection) commitControllerParticipation(selection);
  });
}

function stopControllerPlaying() {
  var player = linkedPlayerId ? Engine.playerById(S, linkedPlayerId) : null;
  if (!player) return;
  if (Engine.lockedIds(S).indexOf(player.id) !== -1) {
    showToast('Leave the active or Up Next lineup before switching to Controller Only.');
    return;
  }
  if (!confirm('Stop playing as ' + player.name + ' and remain Controller Only?')) return;
  commitControllerParticipation({ kind: 'controller_only', playerId: null });
}

function openControllerPlayerTools() {
  if (!isFullController()) return;
  var player = linkedPlayerId ? Engine.playerById(S, linkedPlayerId) : null;
  if (!player) { openControllerParticipationPicker(); return; }
  var onCourt = Engine.activeIds(S).indexOf(player.id) !== -1;
  var upNext = Engine.nextIds(S).indexOf(player.id) !== -1;
  var assigned = onCourt || upNext;
  var status = onCourt ? 'On court' : upNext ? 'Up Next' : player.notAvailable ? 'Taking a break' : 'Ready to play';
  var disabled = sharedBusy || !navigator.onLine || !roomData || roomData.status !== 'active';
  var modal = openModal({
    title: 'Player Tools · ' + player.name,
    copy: 'Your controller identity remains ' + controllerName + '. These tools affect only your linked player.',
    body: '<div class="identity-summary"><span>Playing as</span><strong>' + esc(player.name) + '</strong></div>'
      + '<div class="player-tool-summary"><span>⭐ ' + esc(Engine.skillLevelLabel(player.skillRating)) + '</span><span>' + esc(status) + '</span></div>'
      + '<div class="player-tools-grid">'
      + '<button class="btn ' + (player.notAvailable ? 'btn-primary' : 'btn-accent') + '" id="controllerAvailabilityBtn" ' + (disabled || assigned ? 'disabled' : '') + '>' + (player.notAvailable ? '✓ I’m Ready' : '⏸ Take a Break') + '</button>'
      + '<button class="btn btn-ghost" id="controllerSkillBtn" ' + (disabled || assigned ? 'disabled' : '') + '>⭐ Edit My Skill</button>'
      + '<button class="btn btn-ghost alert-status-' + esc(alertStatus) + '" id="controllerAlertsBtn" ' + (alertStatus === 'enabling' ? 'disabled' : '') + '>' + esc(alertButtonCopy()) + '</button>'
      + '<button class="btn btn-ghost" id="controllerChangePlayerBtn" ' + (disabled || assigned ? 'disabled' : '') + '>⇄ Change Player</button>'
      + '<button class="btn btn-danger" id="controllerStopPlayingBtn" ' + (disabled || assigned ? 'disabled' : '') + '>Stop Playing</button>'
      + '</div>'
      + (assigned ? '<div class="field-help">' + (upNext ? 'Ask a controller to edit or remove your Up Next lineup before changing skill, taking a break, changing player, stopping, or leaving.' : 'Finish the active game before changing skill, taking a break, changing player, stopping, or leaving.') + '</div>' : '')
      + '<div class="free-alert-note">Free alerts require this app to remain open or running. A fully closed app cannot receive alerts.</div>'
  });
  document.getElementById('controllerAvailabilityBtn').onclick = function () { closeModal(); toggleMyAvailability(); };
  document.getElementById('controllerSkillBtn').onclick = function () { closeModal(); openSkillPicker(player.id); };
  document.getElementById('controllerAlertsBtn').onclick = function () { closeModal(); enablePlayerAlerts(); };
  document.getElementById('controllerChangePlayerBtn').onclick = function () { closeModal(); openControllerParticipationPicker(); };
  document.getElementById('controllerStopPlayingBtn').onclick = function () { closeModal(); stopControllerPlaying(); };
  var close = document.createElement('button');
  close.className = 'btn btn-ghost';
  close.textContent = 'Close';
  close.onclick = closeModal;
  modal.actions.appendChild(close);
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
    S = RoomData.stateFromRoom(roomData, Engine);
    isOrganizer = roomData.hostUid === currentUser.uid;
    if (isOrganizer) accessMode = 'controller';
    if (isOrganizer) {
      controllerName = currentUser.displayName || currentUser.email || roomData.hostName || 'Organizer';
      return ensureControllerParticipation();
    }
    if (accessMode === 'viewer') {
      controllerName = 'Viewer';
      return Promise.resolve();
    }
    if (accessMode === 'player') return ensurePlayerIdentity();
    return ensureControllerName(user).then(function () { return ensureControllerParticipation(); });
  }).then(function () {
    var initialPlayerId = pendingControllerSelection ? null : linkedPlayerId;
    return fbDb.collection('roomMembers').doc(roomId + '_' + currentUser.uid).set({
        roomId: roomId,
        uid: currentUser.uid,
        displayName: controllerName,
        role: membershipRole(),
        playerId: initialPlayerId,
        joinedAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiry()
      }, { merge: true });
  }).then(function () {
    if (accessMode === 'controller' && pendingControllerSelection) {
      var selection = pendingControllerSelection;
      if (selection.kind === 'controller_only') {
        pendingControllerSelection = null;
        return selection;
      }
      return commitControllerParticipation(selection).then(function (result) {
        if (!result) throw new Error('Your controller player could not be checked in. Refresh and try again.');
        return result;
      });
    }
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
    var nextState = RoomData.stateFromRoom(roomData, Engine);
    detectNewPlayerAssignment(previousState, nextState, roomData.revision);
    S = nextState;
    if (linkedPlayerId) {
      var linkedPlayer = Engine.playerById(S, linkedPlayerId);
      if (!linkedPlayer || !linkedPlayer.checkedIn || linkedPlayer.checkedInUid !== currentUser.uid) {
        linkedPlayerId = null;
        localStorage.removeItem(playerStorageKey());
        if (isFullController()) localStorage.setItem(controllerParticipationStorageKey(), 'controller_only');
      }
    }
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
  if (eventsUnsubscribe) { eventsUnsubscribe(); eventsUnsubscribe = null; }
  if (!roomId || !activityOpen) return;
  activityLoading = true;
  activityError = '';
  renderActivitySection();
  eventsUnsubscribe = fbDb.collection('roomEvents')
    .where('roomId', '==', roomId)
    .orderBy('createdAt', 'desc')
    .limit(activityQueryLimit())
    .onSnapshot(function (snapshot) {
      activityLoading = false;
      activityEvents = snapshot.docs.map(function (doc) {
        var data = doc.data(); data.id = doc.id; return data;
      });
      renderActivitySection();
    }, function (error) {
      console.warn('Activity feed unavailable:', error);
      activityLoading = false;
      activityError = 'Activity could not be loaded. Check your connection and try again.';
      activityEvents = [];
      renderActivitySection();
    });
}

function initUi() {
  var playerInput = document.getElementById('playerInput');
  playerInput.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); addPlayer(); } };
  var playerSearch = document.getElementById('playerSearch');
  playerSearch.oninput = function () {
    playerSearchQuery = playerSearch.value.trim().toLowerCase();
    playerVisibleLimit = LARGE_ROOM_PAGE_SIZE;
    renderPlayerList();
    syncControlState();
  };
  var standingsSearch = document.getElementById('standingsSearch');
  standingsSearch.oninput = function () {
    standingsSearchQuery = standingsSearch.value.trim().toLowerCase();
    standingsVisibleLimit = LARGE_ROOM_PAGE_SIZE;
    renderLeaderboard();
  };
  applyDisplayPreferences();
  updateOnlineStatus();
}

function showMorePlayers() {
  playerVisibleLimit += LARGE_ROOM_PAGE_SIZE;
  renderPlayerList();
  syncControlState();
}

function showMoreStandings() {
  standingsVisibleLimit += LARGE_ROOM_PAGE_SIZE;
  renderLeaderboard();
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

  var eventRef = fbDb.collection('roomEvents').doc();
  var actionId = options.dedupeKey ? stableActionId(type, options.dedupeKey) : eventRef.id;
  if (inFlightActionKeys.has(actionId)) return Promise.resolve({ changed: false, deduplicated: true });
  inFlightActionKeys.add(actionId);
  sharedBusy = true;
  syncStatus = 'syncing';
  renderSessionCard();
  syncControlState();
  var resultForMessage = null;
  var wasDeduplicated = false;

  return fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (snapshot) {
      if (!snapshot.exists) throw new Error('Shared game no longer exists.');
      var data = snapshot.data();
      if (data.status !== 'active') throw new Error('Shared game has ended.');
      if (options.hostOnly && data.hostUid !== currentUser.uid) throw new Error('Organizer permission required.');
      if (RoomData.recentActionIds(data).indexOf(actionId) !== -1) {
        wasDeduplicated = true;
        resultForMessage = { changed: false, deduplicated: true };
        return;
      }
      var beforeState = RoomData.stateFromRoom(data, Engine);
      var nextState = Engine.clone(beforeState);
      var result = reducer(nextState);
      if (!result || result.changed === false) throw new Error((result && result.reason) || 'Nothing changed.');
      resultForMessage = result;
      var nextRevision = (Number(data.revision) || 0) + 1;
      var stack = Array.isArray(data.undoStack) ? data.undoStack.slice() : [];
      var undoable = options.undoable !== false;
      if (undoable) stack = stack.concat(eventRef.id).slice(-UNDO_LIMIT);
      transaction.update(roomRef, {
        dataLayoutVersion: RoomData.LAYOUT_VERSION,
        state: nextState,
        revision: nextRevision,
        updatedAt: FieldValue.serverTimestamp(),
        lastEventId: eventRef.id,
        undoStack: stack,
        recentActionIds: RoomData.appendActionId(data, actionId)
      });
      if (Object.prototype.hasOwnProperty.call(options, 'membershipPlayerId')) {
        transaction.update(fbDb.collection('roomMembers').doc(roomId + '_' + currentUser.uid), {
          displayName: controllerName,
          role: membershipRole(),
          playerId: options.membershipPlayerId,
          expiresAt: eventExpiry()
        });
      }
      var eventData = {
        roomId: roomId,
        revision: nextRevision,
        type: type,
        summary: result.summary || result.message || type,
        actorUid: currentUser.uid,
        actorName: controllerName,
        actionId: actionId,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: eventExpiry()
      };
      if (undoable) eventData.undoPatch = RoomData.createUndoPatch(beforeState, nextState);
      transaction.set(eventRef, eventData);
    });
  }).then(function () {
    if (wasDeduplicated) showToast('That action was already applied.');
    else if (resultForMessage && resultForMessage.message) showToast(resultForMessage.message);
    clearMsg();
    return resultForMessage;
  }).catch(function (error) {
    showToast(error.message || 'Could not update the shared game.');
    return null;
  }).finally(function () {
    inFlightActionKeys.delete(actionId);
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
  if (Engine.lockedIds(S).indexOf(player.id) !== -1) { showToast(player.name + ' is on court or reserved Up Next.'); return; }
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
  }, { hostOnly: true, dedupeKey: 'clear_players:' + (roomData ? roomData.revision : S.rotationRound) });
}

function toggleNotAvailable(index) {
  var player = S.players[index];
  if (!player) return;
  runAction('availability_changed', function (state) {
    var target = Engine.playerById(state, player.id);
    if (!target) return { changed: false, reason: 'Player not found.' };
    if (Engine.lockedIds(state).indexOf(target.id) !== -1) return { changed: false, reason: target.name + ' is on court or reserved Up Next.' };
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
  if (count < S.courts && S.courtStates.slice(count).some(function (court) { return court.status === 'playing' || court.nextGame; })) {
    if (!confirm('Reducing courts will remove active or Up Next games on those courts. Continue?')) return;
  }
  runAction('courts_changed', function (state) {
    Engine.initCourtStates(state, count);
    return { changed: true, message: 'Now using ' + count + ' court' + (count === 1 ? '' : 's') + '.', summary: 'Changed court count to ' + count };
  });
}

function renameCourt(index) {
  var court = S.courtStates[index];
  if (!court) return;
  askText({
    title: 'Name ' + Engine.courtDisplayName(court),
    copy: 'Use a short name players can recognize, such as Main Court or Court A.',
    value: Engine.courtDisplayName(court),
    maxLength: 30,
    confirmLabel: 'Save Name'
  }).then(function (name) {
    if (!name || name === Engine.courtDisplayName(court)) return;
    runAction('court_renamed', function (state) {
      var target = state.courtStates[index];
      if (!target) return { changed: false, reason: 'Court not found.' };
      var previous = Engine.courtDisplayName(target);
      target.name = String(name).trim().slice(0, 30);
      return {
        changed: true,
        message: previous + ' renamed to ' + target.name + '.',
        summary: 'Renamed ' + previous + ' to ' + target.name
      };
    });
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
      message: Engine.courtDisplayName(target) + ' is now for ' + label + '.',
      summary: 'Designated ' + Engine.courtDisplayName(target) + ' for ' + label
    };
  });
}

function setCourtTimeLimit(index, value) {
  var court = S.courtStates[index];
  if (!court) return;
  if (value === 'custom') {
    askText({
      title: 'Set ' + Engine.courtDisplayName(court) + ' Time Limit',
      copy: 'Enter a whole number from 1 to 120 minutes. It will apply when the next game starts.',
      value: court.timeLimitMinutes || 15,
      maxLength: 3,
      confirmLabel: 'Set Limit'
    }).then(function (minutes) {
      if (minutes == null) { renderCourtSkillGroups(); return; }
      var parsed = Number(minutes);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
        showToast('Enter a whole number from 1 to 120 minutes.');
        renderCourtSkillGroups();
        return;
      }
      setCourtTimeLimit(index, parsed);
    });
    return;
  }
  var limit = value === 'off' || value == null || value === '' ? null : Engine.normalizeTimeLimit(value);
  if (court.timeLimitMinutes === limit) return;
  var previous = court.timeLimitMinutes == null ? 'off' : court.timeLimitMinutes;
  runAction('court_time_limit_changed', function (state) {
    var target = state.courtStates[index];
    if (!target) return { changed: false, reason: 'Court not found.' };
    target.timeLimitMinutes = limit;
    var setting = limit ? limit + ' minutes' : 'Off';
    return {
      changed: true,
      message: Engine.courtDisplayName(target) + ' time limit set to ' + setting + ' for future games.',
      summary: 'Set ' + Engine.courtDisplayName(target) + ' time limit to ' + setting
    };
  }, { dedupeKey: 'court:' + index + ':timer:' + previous + ':' + (limit == null ? 'off' : limit) + ':' + (roomData ? roomData.revision : S.rotationRound) });
}

function generateForCourt(index) {
  var expectedGame = S.courtStates[index] ? (Number(S.courtStates[index].gameNum) || 0) + 1 : 0;
  runAction('next_game_prepared', function (state) {
    var result = Engine.prepareNextGame(state, index);
    if (!result.changed) return result;
    var names = result.nextGame.teamA.concat(result.nextGame.teamB).map(function (id) { return Engine.playerName(state, id); });
    return {
      changed: true,
      message: Engine.courtDisplayName(result.court) + ' — Game ' + result.nextGame.gameNum + ' is prepared Up Next.',
      summary: 'Prepared Up Next on ' + Engine.courtDisplayName(result.court) + ': ' + names.join(', ')
    };
  }, { dedupeKey: 'court:' + index + ':prepare:' + expectedGame });
}

function fillAvailableCourts() {
  runAction('courts_and_next_prepared', function (state) {
    var filled = [];
    var skipped = [];
    Engine.courtPreparationOrder(state).forEach(function (index) {
      var result = Engine.prepareNextGame(state, index);
      if (result.changed) filled.push(Engine.courtDisplayName(result.court));
      else skipped.push(result.reason);
    });
    if (!filled.length) return { changed: false, reason: skipped[0] || 'Every court already has an active or Up Next lineup.' };
    return {
      changed: true,
      message: 'Prepared ' + filled.length + ' fair lineup' + (filled.length === 1 ? '' : 's') + '.',
      summary: 'Prepared courts and Up Next for ' + filled.join(', ')
    };
  }, { dedupeKey: 'bulk_prepare:' + (roomData ? roomData.revision : S.rotationRound) });
}

function startStagedGame(index) {
  var nextGameNum = S.courtStates[index] && S.courtStates[index].nextGame ? S.courtStates[index].nextGame.gameNum : 0;
  runAction('game_started', function (state) {
    var result = Engine.startNextGame(state, index);
    if (!result.changed) return result;
    var names = result.court.teamA.concat(result.court.teamB).map(function (id) { return Engine.playerName(state, id); });
    return {
      changed: true,
      message: Engine.courtDisplayName(result.court) + ' — Game ' + result.court.gameNum + ' started!',
      summary: 'Started ' + Engine.courtDisplayName(result.court) + ': ' + names.join(', ')
    };
  }, { dedupeKey: 'court:' + index + ':start:' + nextGameNum });
}

function cancelStagedGame(index) {
  var court = S.courtStates[index];
  if (!court || !court.nextGame) return;
  if (!confirm('Remove the Up Next lineup from ' + Engine.courtDisplayName(court) + '?')) return;
  runAction('next_game_removed', function (state) {
    var targetName = Engine.courtDisplayName(state.courtStates[index]);
    var result = Engine.clearNextGame(state, index);
    if (!result.changed) return result;
    return { changed: true, message: targetName + ' Up Next lineup removed.', summary: 'Removed Up Next lineup from ' + targetName };
  }, { dedupeKey: 'court:' + index + ':remove_next:' + court.nextGame.gameNum });
}

function openManualMatchBuilder(index) {
  var court = S.courtStates[index];
  if (!court) return;
  var eligibleIds = Engine.eligibleIdsForManualCourt(S, index);
  if (eligibleIds.length < 4) {
    showToast(Engine.courtDisplayName(court) + ' needs four available eligible players.');
    return;
  }
  var players = eligibleIds.map(function (id) { return Engine.playerById(S, id); }).filter(Boolean).sort(function (a, b) {
    return a.games - b.games || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
  var current = court.nextGame ? court.nextGame.teamA.concat(court.nextGame.teamB) : ['', '', '', ''];
  var optionHtml = '<option value="">Choose player…</option>' + players.map(function (player) {
    return '<option value="' + esc(player.id) + '">' + esc(player.name) + ' · ' + esc(Engine.skillLevelLabel(player.skillRating)) + ' · ' + player.games + 'G</option>';
  }).join('');
  function slot(team, label, slotIndex) {
    return '<label class="manual-slot"><span>' + label + '</span><select class="modal-field manual-player-select" aria-label="' + team + ' ' + label + '" data-slot="' + slotIndex + '">' + optionHtml + '</select></label>';
  }
  var modal = openModal({
    title: 'Build Next Match · ' + Engine.courtDisplayName(court),
    copy: 'Choose four different available players and teams. They are reserved immediately; game credits and the timer begin only when Start Game is tapped.',
    body: '<div class="manual-builder"><div class="manual-team"><strong>🟢 Team A</strong>' + slot('Team A', 'Player 1', 0) + slot('Team A', 'Player 2', 1)
      + '</div><div class="manual-vs">VS</div><div class="manual-team"><strong>🔵 Team B</strong>' + slot('Team B', 'Player 1', 2) + slot('Team B', 'Player 2', 3)
      + '</div></div><div class="manual-builder-note" id="manualBuilderNote">Choose four different players.</div>'
  });
  var selects = Array.prototype.slice.call(modal.body.querySelectorAll('.manual-player-select'));
  selects.forEach(function (select, slotIndex) { select.value = current[slotIndex] || ''; });
  var cancel = document.createElement('button');
  cancel.className = 'btn btn-ghost';
  cancel.textContent = 'Cancel';
  cancel.onclick = closeModal;
  var stage = document.createElement('button');
  stage.className = 'btn btn-primary';
  stage.textContent = court.nextGame ? 'Update Up Next' : 'Prepare Up Next';
  function selection() { return selects.map(function (select) { return select.value; }); }
  function validate() {
    var chosen = selection();
    var valid = chosen.every(Boolean) && new Set(chosen).size === 4;
    stage.disabled = !valid;
    document.getElementById('manualBuilderNote').textContent = valid
      ? 'Ready to prepare. No game credit is added yet.'
      : chosen.every(Boolean) ? 'Each player can be selected only once.' : 'Choose four different players.';
  }
  selects.forEach(function (select) { select.addEventListener('change', validate); });
  validate();
  stage.onclick = function () {
    var chosen = selection();
    if (stage.disabled) return;
    stage.disabled = true;
    runAction('manual_next_game_prepared', function (state) {
      var result = Engine.prepareManualNextGame(state, index, chosen.slice(0, 2), chosen.slice(2, 4));
      if (!result.changed) return result;
      var names = chosen.map(function (id) { return Engine.playerName(state, id); });
      return {
        changed: true,
        message: Engine.courtDisplayName(result.court) + ' manual Up Next lineup is ready.',
        summary: 'Prepared manual Up Next on ' + Engine.courtDisplayName(result.court) + ': ' + names.join(', ')
      };
    }, { dedupeKey: 'court:' + index + ':manual:' + (court.nextGame ? court.nextGame.gameNum : court.gameNum + 1) + ':' + chosen.join('|') }).then(function (result) {
      if (result && result.changed) closeModal();
      else stage.disabled = false;
    });
  };
  modal.actions.appendChild(cancel);
  modal.actions.appendChild(stage);
}

function recordWinner(index, winner) {
  var currentGameNum = S.courtStates[index] ? S.courtStates[index].gameNum : 0;
  runAction('winner_recorded', function (state) {
    var result = Engine.recordWinner(state, index, winner);
    if (!result.changed) return { changed: false, reason: 'This game is no longer active.' };
    var names = result.winners.map(function (id) { return Engine.playerName(state, id); });
    var timing = result.historyEntry && result.historyEntry.finishedAfterTimeLimit ? ' after the time limit' : '';
    return {
      changed: true,
      message: Engine.courtDisplayName(result.court) + ' — ' + names.join(' & ') + ' won' + timing + '! 🏆',
      summary: 'Recorded ' + names.join(' & ') + ' as winners on ' + Engine.courtDisplayName(result.court) + timing
    };
  }, { dedupeKey: 'court:' + index + ':winner:' + currentGameNum });
}

function resetAllCourts() {
  if (!confirm('Reset all courts and clear game history? Player statistics will be kept.')) return;
  runAction('courts_reset', function (state) {
    Engine.resetCourts(state);
    return { changed: true, message: 'All courts reset. Statistics preserved.', summary: 'Reset all courts and game history' };
  }, { hostOnly: true, dedupeKey: 'reset_courts:' + (roomData ? roomData.revision : S.rotationRound) });
}

function resetStats() {
  if (!confirm('Reset games, wins, matchup history, and game history?')) return;
  runAction('statistics_reset', function (state) {
    Engine.resetStatistics(state);
    return { changed: true, message: 'Player statistics reset.', summary: 'Reset all statistics and matchup history' };
  }, { hostOnly: true, dedupeKey: 'reset_stats:' + (roomData ? roomData.revision : S.rotationRound) });
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
  }, { dedupeKey: 'court:' + courtIndex + ':game:' + (S.courtStates[courtIndex] ? S.courtStates[courtIndex].gameNum : 0) + ':replace:' + expectedOutgoingId + ':' + replacementId });
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
  var isSelfEdit = linkedPlayerId === playerId && !!currentUser && (accessMode === 'player' || isFullController());
  if (!isFullController() && !isSelfEdit) return;
  var player = Engine.playerById(S, playerId);
  if (!player) return;
  if (Engine.lockedIds(S).indexOf(player.id) !== -1) {
    showToast(player.name + ' must leave the active or Up Next lineup before changing skill.');
    return;
  }
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
      if (Engine.lockedIds(state).indexOf(target.id) !== -1) return { changed: false, reason: target.name + ' is on court or reserved Up Next.' };
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
      dataLayoutVersion: RoomData.LAYOUT_VERSION,
      state: Engine.normalizeState(S),
      recentActionIds: [],
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
      actionId: initialEvent.id,
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
    player: 'Players can enroll or check in, manage their own availability and level, see active and Up Next teams, and receive a free alert as soon as their lineup is prepared while the app is running.',
    viewer: 'Viewers can follow active matches, reserved Up Next lineups, timers, standings, history, activity, and summaries, but cannot change the game.',
    controller: 'Controllers can prepare, manually edit, or remove one Up Next lineup per court while matches continue, then record the winner and start the promoted game when the court is ready.'
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
    copy: 'Choose what the link opens. Every role can see active and prepared Up Next games; only controller links can change lineups or game progress.',
    body: '<div class="access-tabs">'
      + '<button class="access-tab" type="button" data-access-mode="player">✓ Player Check-In</button>'
      + '<button class="access-tab" type="button" data-access-mode="viewer">👁 View Only</button>'
      + '<button class="access-tab" type="button" data-access-mode="controller">🎛 Controller</button></div>'
      + '<div class="qr-shell"><canvas id="accessQrCanvas" class="qr-canvas" aria-label="QR code"></canvas>'
      + '<div class="qr-link-label" id="accessLinkLabel"></div><div class="qr-url" id="accessLinkUrl"></div></div>'
      + '<div class="access-role-summary" id="accessRoleSummary"></div>'
      + '<div class="access-note">Player link guests can choose an existing roster name or add themselves. Up Next players are reserved until a controller edits, removes, or starts that lineup. Anyone with the controller link can control the game. These links are not password-protected roles.</div>'
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
    if (linkedPlayerId) disablePlayerAlerts().then(navigateHome);
    else navigateHome();
    return;
  }
  if (linkedPlayerId && currentUser) {
    var player = Engine.playerById(S, linkedPlayerId);
    if (player && player.checkedIn && player.checkedInUid === currentUser.uid) {
      if (isFullController()) {
        commitControllerParticipation({ kind: 'controller_only', playerId: null }).then(function (result) {
          if (!result) return;
          return disablePlayerAlerts().then(navigateHome);
        });
        return;
      }
      runAction('player_checked_out', function (state) {
        var result = Engine.checkOutPlayer(state, linkedPlayerId, currentUser.uid);
        if (!result.changed) return result;
        return { changed: true, summary: result.player.name + ' checked out' };
      }, { selfService: true, undoable: false }).then(function (result) {
        if (!result) return;
        localStorage.removeItem(playerStorageKey());
        return disablePlayerAlerts().then(navigateHome);
      });
      return;
    }
    localStorage.removeItem(playerStorageKey());
    disablePlayerAlerts().then(navigateHome);
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
  var expectedTargetId = roomData.undoStack[roomData.undoStack.length - 1];
  var undoEventRef = fbDb.collection('roomEvents').doc();
  sharedBusy = true; syncStatus = 'syncing'; renderSessionCard();
  fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (roomSnapshot) {
      var data = roomSnapshot.data();
      if (!data || data.hostUid !== currentUser.uid || data.status !== 'active') throw new Error('Organizer permission required.');
      var stack = (data.undoStack || []).slice();
      var targetId = stack[stack.length - 1];
      if (!targetId || targetId !== expectedTargetId) throw new Error('The undo history changed. Review the latest state and try again.');
      return transaction.get(fbDb.collection('roomEvents').doc(targetId)).then(function (eventSnapshot) {
        if (!eventSnapshot.exists) throw new Error('Undo data is no longer available.');
        var target = eventSnapshot.data();
        if (!target.beforeState && !Array.isArray(target.undoPatch)) throw new Error('Undo data is no longer available.');
        var currentState = RoomData.stateFromRoom(data, Engine);
        var restoredState = Array.isArray(target.undoPatch)
          ? Engine.normalizeState(RoomData.applyUndoPatch(currentState, target.undoPatch))
          : Engine.normalizeState(target.beforeState);
        stack.pop();
        var nextRevision = (Number(data.revision) || 0) + 1;
        transaction.update(roomRef, {
          dataLayoutVersion: RoomData.LAYOUT_VERSION,
          state: restoredState,
          revision: nextRevision,
          updatedAt: FieldValue.serverTimestamp(),
          lastEventId: undoEventRef.id,
          undoStack: stack,
          recentActionIds: RoomData.appendActionId(data, undoEventRef.id)
        });
        transaction.set(undoEventRef, {
          roomId: roomId,
          revision: nextRevision,
          type: 'undo',
          summary: 'Undid: ' + target.summary,
          actorUid: currentUser.uid,
          actorName: controllerName,
          actionId: undoEventRef.id,
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
  if (!confirm('End this shared session? It will become read-only.')) return;
  var expiresAt = Timestamp.fromMillis(Date.now() + THIRTY_DAYS);
  var endEventRef = fbDb.collection('roomEvents').doc();
  fbDb.runTransaction(function (transaction) {
    return transaction.get(roomRef).then(function (snapshot) {
      var data = snapshot.data();
      if (!data || data.hostUid !== currentUser.uid) throw new Error('Organizer permission required.');
      if (data.status !== 'active') throw new Error('This shared session has already ended.');
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
  }).then(function () { showToast('Session ended. It is now read-only.'); })
    .catch(function (error) { showToast(error.message || 'Could not end the session.'); });
}

function toggleHistory() { historyOpen = !historyOpen; renderHistorySection(); }
function toggleActivity() {
  activityOpen = !activityOpen;
  if (activityOpen) subscribeToEvents();
  else {
    if (eventsUnsubscribe) { eventsUnsubscribe(); eventsUnsubscribe = null; }
    activityLoading = false;
    renderActivitySection();
  }
}

function formatDuration(milliseconds) {
  var totalSeconds = Math.max(0, Math.floor((Number(milliseconds) || 0) / 1000));
  var hours = Math.floor(totalSeconds / 3600);
  var minutes = Math.floor((totalSeconds % 3600) / 60);
  var seconds = totalSeconds % 60;
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
    : String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function timeLimitLabel(minutes, prefix) {
  return (prefix || '') + (minutes ? minutes + ' min' : 'No limit');
}

function updateCourtTimers() {
  document.querySelectorAll('[data-court-timer]').forEach(function (element) {
    var startedAt = Number(element.dataset.startedAt);
    var deadlineAt = Number(element.dataset.deadlineAt);
    var limit = Number(element.dataset.timeLimit);
    var now = Date.now();
    var container = element.closest('.court-timer');
    if (!startedAt) {
      element.textContent = '—';
      return;
    }
    if (!deadlineAt || !limit) {
      element.textContent = formatDuration(now - startedAt) + ' elapsed';
      return;
    }
    var remaining = deadlineAt - now;
    container.classList.toggle('is-warning', remaining > 0 && remaining <= 60 * 1000);
    container.classList.toggle('is-overdue', remaining <= 0);
    if (remaining > 0) {
      element.textContent = formatDuration(Math.ceil(remaining / 1000) * 1000) + ' left · ' + limit + ' min max';
      return;
    }
    element.textContent = 'Time Limit Reached · +' + formatDuration(now - deadlineAt);
    alertControllerToTimeLimit(Number(element.dataset.courtIndex), Number(element.dataset.gameNum), element.dataset.courtName || 'Court', deadlineAt);
  });
}

function sessionDisplayName() {
  return roomData && roomData.name ? roomData.name : 'Personal Pickleball Game';
}

function sessionSummaryData() {
  var timedGames = S.history.filter(function (entry) { return entry.durationMs != null && Number.isFinite(Number(entry.durationMs)); });
  var limitGames = S.history.filter(function (entry) { return Engine.normalizeTimeLimit(entry.timeLimitMinutes); });
  var reachedLimitGames = limitGames.filter(function (entry) { return !!entry.finishedAfterTimeLimit; });
  var totalDuration = timedGames.reduce(function (sum, entry) { return sum + Number(entry.durationMs); }, 0);
  return {
    completedGames: S.history.length,
    timedGames: timedGames.length,
    averageDuration: timedGames.length ? totalDuration / timedGames.length : null,
    longestDuration: timedGames.length ? Math.max.apply(null, timedGames.map(function (entry) { return Number(entry.durationMs); })) : null,
    timeLimitedGames: limitGames.length,
    reachedLimitGames: reachedLimitGames.length,
    players: Engine.rankedPlayers(S),
    courts: S.courtStates.map(function (court) {
      return {
        name: Engine.courtDisplayName(court),
        games: S.history.filter(function (entry) { return Number(entry.courtNum) === Number(court.courtNum); }).length
      };
    })
  };
}

function openSessionSummary() {
  var summary = sessionSummaryData();
  var metric = function (label, value) {
    return '<div class="summary-metric"><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span></div>';
  };
  var courtRows = summary.courts.map(function (court) {
    return '<div class="summary-court-row"><span>' + esc(court.name) + '</span><strong>' + court.games + ' completed</strong></div>';
  }).join('');
  var standings = summary.players.map(function (player, index) {
    var winPercent = player.games ? Math.round(player.wins / player.games * 100) + '%' : '—';
    return '<tr><td>' + (index + 1) + '</td><td>' + esc(player.name) + '</td><td>' + player.games + '</td><td>' + player.wins + '</td><td>' + winPercent + '</td></tr>';
  }).join('') || '<tr><td colspan="5">No players yet.</td></tr>';
  var modal = openModal({
    title: 'Session Summary',
    copy: sessionDisplayName() + ' · Based on the recorded game history on this session.',
    body: '<div class="summary-metrics">' + metric('Players', S.players.length) + metric('Completed games', summary.completedGames)
      + metric('Average game', summary.averageDuration == null ? '—' : formatDuration(summary.averageDuration))
      + metric('Longest game', summary.longestDuration == null ? '—' : formatDuration(summary.longestDuration))
      + metric('Reached limit', summary.reachedLimitGames + ' of ' + summary.timeLimitedGames) + '</div>'
      + '<div class="summary-section"><h3>Courts</h3><div class="summary-courts">' + courtRows + '</div></div>'
      + '<div class="summary-section"><h3>Player standings</h3><div class="summary-table-wrap"><table class="summary-table"><thead><tr><th>#</th><th>Player</th><th>G</th><th>W</th><th>Win%</th></tr></thead><tbody>' + standings + '</tbody></table></div></div>'
  });
  var close = document.createElement('button');
  close.className = 'btn btn-ghost';
  close.textContent = 'Close';
  close.onclick = closeModal;
  var download = document.createElement('button');
  download.className = 'btn btn-primary';
  download.textContent = '⇩ Export CSV';
  download.onclick = exportSessionCsv;
  modal.actions.appendChild(close);
  modal.actions.appendChild(download);
}

function csvCell(value) {
  var text = String(value == null ? '' : value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportSessionCsv() {
  var headers = ['Record Type', 'Session', 'Player', 'Skill Level', 'Games', 'Wins', 'Win %', 'Court', 'Game', 'Started At', 'Ended At', 'Duration Seconds', 'Time Limit Minutes', 'Reached Time Limit', 'Team A', 'Team B', 'Winner'];
  var rows = [headers];
  Engine.rankedPlayers(S).forEach(function (player) {
    rows.push(['PLAYER', sessionDisplayName(), player.name, Engine.skillLevelLabel(player.skillRating), player.games, player.wins,
      player.games ? Math.round(player.wins / player.games * 100) : '', '', '', '', '', '', '', '', '', '', '', '']);
  });
  S.history.slice().reverse().forEach(function (entry) {
    var teamA = entry.teamANames || (entry.teamA || []).map(function (id) { return Engine.playerName(S, id); });
    var teamB = entry.teamBNames || (entry.teamB || []).map(function (id) { return Engine.playerName(S, id); });
    rows.push(['GAME', sessionDisplayName(), '', '', '', '', '', entry.courtName || ('Court ' + entry.courtNum), entry.gameNum,
      entry.startedAt ? new Date(entry.startedAt).toISOString() : '', new Date(entry.endedAt || entry.ts || Date.now()).toISOString(),
      entry.durationMs == null ? '' : Math.round(Number(entry.durationMs) / 1000), entry.timeLimitMinutes || '',
      entry.timeLimitMinutes ? (entry.finishedAfterTimeLimit ? 'Yes' : 'No') : '', teamA.join(' & '), teamB.join(' & '), entry.winner === 'A' ? 'Team A' : 'Team B']);
  });
  var csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var link = document.createElement('a');
  var safeName = sessionDisplayName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pickleball-session';
  link.href = URL.createObjectURL(blob);
  link.download = safeName + '-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  showToast('Session CSV downloaded.');
}

function renderSessionCard() {
  var card = document.getElementById('sessionCard');
  if (!roomId) {
    card.innerHTML = '<div class="session-top"><div><div class="session-title">Personal game</div>'
      + '<div class="session-sub">Saved only on this device · Works offline</div></div>'
      + '<span class="mode-badge">📱 Solo</span></div>'
      + (isLargeRoom() ? '<span class="large-room-badge">⚡ Large Room Mode · optimized lists</span>' : '')
      + '<div class="session-actions"><button class="btn btn-primary" onclick="createSharedRoom()">🔗 Share Current Game</button>'
      + '<button class="btn btn-ghost" onclick="openSessionInfoEditor()">📣 Session Info</button>'
      + '<button class="btn btn-ghost" onclick="openDisplaySettings()">⚙ Display</button></div>';
    return;
  }
  var statusText = { connected: '● Connected', syncing: '↻ Syncing', offline: '○ Offline', error: '! Error', ended: '✓ Ended' }[syncStatus] || syncStatus;
  var undoDisabled = !isOrganizer || !roomData || !roomData.undoStack || !roomData.undoStack.length || roomData.status !== 'active';
  var sessionDisabled = !navigator.onLine || sharedBusy || !roomData || roomData.status !== 'active';
  var roleText = isOrganizer ? 'Organizer' : accessMode === 'player' ? 'Player check-in' : accessMode === 'viewer' ? 'View only' : 'Controller';
  var player = linkedPlayerId ? Engine.playerById(S, linkedPlayerId) : null;
  var actions = '';
  if (isFullController()) {
    actions = '<button class="btn ' + (player ? 'btn-accent' : 'btn-ghost') + '" onclick="openControllerPlayerTools()" ' + (sessionDisabled ? 'disabled' : '') + '>'
      + (player ? '🎾 Player Tools · ' + esc(player.name) : '🎾 Join as Player') + '</button>'
      + '<button class="btn btn-primary" onclick="openAccessLinks()">▦ QR & Links</button>'
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
    + (isFullController() ? '<div class="room-player-identity">' + (player
      ? '🎾 Playing as <strong>' + esc(player.name) + '</strong> · ' + esc(Engine.skillLevelLabel(player.skillRating)) + (player.notAvailable ? ' · Taking a break' : '')
      : '🎛 Controller Only') + '</div>' : '')
    + (isLargeRoom() ? '<span class="large-room-badge">⚡ Large Room Mode · optimized live data</span>' : '')
    + '<div class="session-actions">' + actions
    + (isFullController() ? '<button class="btn btn-ghost" onclick="openSessionInfoEditor()">📣 Session Info</button>' : '')
    + '<button class="btn btn-ghost" onclick="openDisplaySettings()">⚙ Display</button>'
    + '<button class="btn btn-ghost" onclick="openRoleHelp()">❓ How to Use</button>'
    + '<button class="btn btn-ghost" onclick="leaveSharedRoom()">Leave</button>'
    + '</div>'
    + (accessMode === 'player' && !isOrganizer ? '<div class="free-alert-note">Free alerts work while this app is open or running in the background. A fully closed app cannot receive alerts.</div>' : '');
}

function renderSessionInfo() {
  var element = document.getElementById('sessionInfoSection');
  if (!element) return;
  var announcement = String(S.sessionAnnouncement || '');
  var rules = String(S.sessionRules || '');
  if (!announcement && !rules) {
    element.innerHTML = '';
    return;
  }
  var html = '<div class="card session-info-card">';
  if (announcement) html += '<div class="announcement-banner" role="status"><strong>📣</strong><span>' + esc(announcement) + '</span></div>';
  if (rules) html += '<details class="session-rules"><summary>📋 Session Rules</summary><div class="session-rules-copy">' + esc(rules) + '</div></details>';
  if (isFullController()) html += '<div class="session-info-actions"><button class="btn btn-ghost btn-sm" onclick="openSessionInfoEditor()">✎ Edit Session Info</button></div>';
  element.innerHTML = html + '</div>';
}

function renderPlayerList() {
  var element = document.getElementById('playerList');
  var searchWrap = document.getElementById('playerSearchWrap');
  var searchCount = document.getElementById('playerSearchCount');
  if (!S.players.length) {
    searchWrap.hidden = true;
    element.innerHTML = '<div class="empty-hint">No players added yet. Enter names above.</div>';
    return;
  }
  searchWrap.hidden = S.players.length < 8;
  var filtered = S.players.filter(function (player) { return !playerSearchQuery || player.name.toLowerCase().indexOf(playerSearchQuery) !== -1; });
  searchCount.textContent = filtered.length + '/' + S.players.length;
  if (!filtered.length) {
    element.innerHTML = '<div class="empty-hint">No players match “' + esc(playerSearchQuery) + '”.</div>';
    return;
  }
  var visible = isLargeRoom() ? filtered.slice(0, playerVisibleLimit) : filtered;
  var locked = new Set(Engine.lockedIds(S));
  var onCourt = new Set(Engine.activeIds(S));
  var upNext = new Set(Engine.nextIds(S));
  element.innerHTML = visible.map(function (player) {
    var index = S.players.indexOf(player);
    var isLocked = locked.has(player.id);
    var badges = (isLocked ? '<span class="locked-badge">' + (upNext.has(player.id) ? '⏭ Up Next' : onCourt.has(player.id) ? '🔒 On Court' : '🔒 Assigned') + '</span>' : player.notAvailable ? '<span class="na-tag">⏸ Taking a Break</span>' : '')
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
  }).join('') + (visible.length < filtered.length
    ? '<button class="btn btn-ghost list-more" onclick="showMorePlayers()">Show ' + Math.min(LARGE_ROOM_PAGE_SIZE, filtered.length - visible.length) + ' More Players</button>' : '');
}

function renderMatchmakingMode() {
  document.querySelectorAll('[data-matchmaking-mode]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.matchmakingMode === S.matchmakingMode);
  });
  var help = document.getElementById('matchmakingHelp');
  if (help) help.textContent = S.matchmakingMode === 'balanced'
    ? 'Keeps fair game counts first, prefers even skill compositions, then balances teams and expands matchup variety.'
    : 'Prioritizes fair game counts, then new partners and opponents before waiting-time tie-breakers.';
  var readOnly = document.getElementById('matchmakingReadOnly');
  if (readOnly) readOnly.textContent = S.matchmakingMode === 'balanced' ? '⭐ Skill Balanced' : '🤝 Social Fair';
}

function renderCourtSkillGroups() {
  var element = document.getElementById('courtSkillGroups');
  if (!element) return;
  var editable = isFullController();
  var presetLimits = [10, 15, 20, 30];
  element.innerHTML = '<div class="court-groups-heading"><span>Court Names, Skill & Timer</span><small>Timer changes apply when the next game starts</small></div>'
    + S.courtStates.map(function (court, index) {
      var label = Engine.skillGroupLabel(court.skillGroup);
      var timerLabel = timeLimitLabel(court.timeLimitMinutes);
      if (!editable) {
        return '<div class="court-group-row"><strong>' + esc(Engine.courtDisplayName(court)) + '</strong><span class="court-skill-badge group-' + esc(court.skillGroup) + '">' + esc(label) + '</span><span class="court-time-setting">⏱ ' + esc(timerLabel) + '</span></div>';
      }
      return '<div class="court-group-row is-editable"><button class="court-name-button" onclick="renameCourt(' + index + ')" aria-label="Rename ' + esc(Engine.courtDisplayName(court)) + '"><span>' + esc(Engine.courtDisplayName(court)) + '</span><small>✎ Rename</small></button><select class="court-group-select" aria-label="' + esc(Engine.courtDisplayName(court)) + ' skill designation" onchange="setCourtSkillGroup(' + index + ', this.value)">'
        + Engine.SKILL_GROUPS.map(function (group) { return '<option value="' + group + '"' + (court.skillGroup === group ? ' selected' : '') + '>' + esc(Engine.skillGroupLabel(group)) + '</option>'; }).join('')
        + '</select><select class="court-time-select" aria-label="' + esc(Engine.courtDisplayName(court)) + ' time limit" onchange="setCourtTimeLimit(' + index + ', this.value)">'
        + '<option value="off"' + (court.timeLimitMinutes == null ? ' selected' : '') + '>⏱ No limit</option>'
        + presetLimits.map(function (minutes) { return '<option value="' + minutes + '"' + (court.timeLimitMinutes === minutes ? ' selected' : '') + '>' + minutes + ' min</option>'; }).join('')
        + (court.timeLimitMinutes && presetLimits.indexOf(court.timeLimitMinutes) === -1 ? '<option value="' + court.timeLimitMinutes + '" selected>Custom: ' + court.timeLimitMinutes + ' min</option>' : '')
        + '<option value="custom">Custom…</option></select></div>';
    }).join('');
}

function syncCourtButtons() {
  document.querySelectorAll('.court-btn').forEach(function (button) {
    button.classList.toggle('active', Number(button.dataset.n) === S.courts);
  });
}

function updateStats() {
  document.getElementById('sTotal').textContent = S.players.length;
  document.getElementById('sOnCourt').textContent = Engine.activeIds(S).length;
  document.getElementById('sUpNext').textContent = Engine.nextIds(S).length;
  document.getElementById('sAvail').textContent = Engine.availableIds(S).length;
  document.getElementById('sActive').textContent = S.courtStates.filter(function (court) { return court.status === 'playing'; }).length;
}

function renderAvailableSection() {
  var element = document.getElementById('availableSection');
  if (!S.players.length) { element.innerHTML = ''; return; }
  var available = Engine.availableIds(S).map(function (id) { return Engine.playerById(S, id); });
  var onCourtCount = Engine.activeIds(S).length;
  var upNextCount = Engine.nextIds(S).length;
  var unavailable = S.players.filter(function (player) { return player.notAvailable; });
  var html = '<div class="avail-card"><div class="avail-header">✅ Available (' + available.length + ')';
  if (onCourtCount) html += '<span class="on-court-tag">🔒 On Court: ' + onCourtCount + '</span>';
  if (upNextCount) html += '<span class="on-court-tag up-next-count">⏭ Up Next: ' + upNextCount + '</span>';
  if (unavailable.length) html += '<span class="na-tag">⛔ Not Available: ' + unavailable.length + '</span>';
  html += '</div>';
  var visibleAvailable = isLargeRoom() ? available.slice(0, LARGE_ROOM_CHIP_LIMIT) : available;
  var visibleUnavailable = isLargeRoom() ? unavailable.slice(0, LARGE_ROOM_CHIP_LIMIT) : unavailable;
  html += available.length ? '<div class="avail-chips">' + visibleAvailable.map(function (player) { return '<div class="avail-chip">' + esc(player.name) + '</div>'; }).join('')
    + (visibleAvailable.length < available.length ? '<div class="avail-chip">+' + (available.length - visibleAvailable.length) + ' more</div>' : '') + '</div>'
    : '<div class="no-avail">No players available for rotation.</div>';
  if (unavailable.length) html += '<div class="na-chips"><div class="na-section-lbl" style="width:100%;margin-bottom:6px">⛔ Sitting Out</div>'
    + visibleUnavailable.map(function (player) { return '<div class="na-chip">' + esc(player.name) + '</div>'; }).join('')
    + (visibleUnavailable.length < unavailable.length ? '<div class="na-chip">+' + (unavailable.length - visibleUnavailable.length) + ' more</div>' : '') + '</div>';
  element.innerHTML = html + '</div>';
}

function statusBadgeHtml(status) {
  if (status === 'next') return '<span class="status-badge status-staged">⏭ Up Next</span>';
  if (status === 'playing') return '<span class="status-badge status-playing">● In Progress</span>';
  if (status === 'done') return '<span class="status-badge status-done">✓ Done</span>';
  return '<span class="status-badge status-empty">Empty</span>';
}

function teamsHtml(court, courtIndex, showWinner) {
  var pending = swapState && swapState.courtIndex === courtIndex;
  function row(id, team, playerIndex) {
    var player = Engine.playerById(S, id);
    var buttons = '';
    if (!showWinner && isFullController()) {
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

function nextTeamsHtml(nextGame) {
  function names(ids, team) {
    return '<div class="next-team"><div class="next-team-label">' + (team === 'A' ? '🟢 Team A' : '🔵 Team B') + '</div>'
      + ids.map(function (id) { return '<div class="next-player-name">' + esc(Engine.playerName(S, id)) + '</div>'; }).join('') + '</div>';
  }
  return '<div class="next-teams">' + names(nextGame.teamA, 'A') + '<div class="next-vs">VS</div>' + names(nextGame.teamB, 'B') + '</div>';
}

function renderNextGamePanel(court, index, compact) {
  var next = court.nextGame;
  if (!next) {
    if (!isFullController()) return '<div class="next-empty">Next game not prepared yet.</div>';
    return '<div class="next-empty"><span>Next game not prepared yet.</span><div class="court-action-grid">'
      + '<button class="btn btn-accent" onclick="generateForCourt(' + index + ')">⏭ Prepare Fair Next</button>'
      + '<button class="btn btn-ghost" onclick="openManualMatchBuilder(' + index + ')">✋ Build Next Manually</button></div></div>';
  }
  var actions = isFullController() ? '<div class="next-actions">'
    + (court.status === 'playing' ? '' : '<button class="btn btn-accent" onclick="startStagedGame(' + index + ')">▶ Start Game</button>')
    + '<button class="btn btn-ghost" onclick="openManualMatchBuilder(' + index + ')">✎ Edit Match</button>'
    + '<button class="btn btn-ghost" onclick="cancelStagedGame(' + index + ')">✕ Remove</button></div>' : '';
  return '<section class="next-game-panel' + (compact ? ' is-compact' : '') + '" aria-label="Up Next on ' + esc(Engine.courtDisplayName(court)) + '">'
    + '<div class="next-game-header"><div><strong>⏭ Up Next · Game ' + next.gameNum + '</strong><span>' + (next.source === 'manual' ? 'Manual lineup' : 'Fair lineup')
    + (court.status === 'playing' ? ' · Reserved now' : ' · Timer and credits start with Start Game') + '</span></div>'
    + '<div class="next-game-badges"><span class="court-skill-badge group-' + esc(next.skillGroup) + '">' + esc(Engine.skillGroupLabel(next.skillGroup)) + '</span>'
    + '<span class="court-time-setting">⏱ ' + esc(timeLimitLabel(court.timeLimitMinutes)) + '</span></div></div>'
    + nextTeamsHtml(next) + actions + '</section>';
}

function renderCourtCard(court, index) {
  var color = Math.min(court.courtNum, 6);
  var body;
  if (court.status === 'playing') {
    var hasLimit = !!(court.activeTimeLimitMinutes && court.deadlineAt);
    var initialRemaining = hasLimit ? Number(court.deadlineAt) - Date.now() : null;
    var initialTimerText = !court.startedAt ? '—' : hasLimit
      ? (initialRemaining > 0 ? formatDuration(Math.ceil(initialRemaining / 1000) * 1000) + ' left · ' + court.activeTimeLimitMinutes + ' min max' : 'Time Limit Reached · +' + formatDuration(-initialRemaining))
      : formatDuration(Date.now() - court.startedAt) + ' elapsed';
    body = '<div class="court-timer' + (hasLimit && initialRemaining <= 0 ? ' is-overdue' : hasLimit && initialRemaining <= 60000 ? ' is-warning' : '') + '" aria-label="' + (hasLimit ? 'Game time remaining' : 'Elapsed game time') + '">⏱ <span data-court-timer data-court-index="' + index + '" data-game-num="' + court.gameNum + '" data-court-name="' + esc(Engine.courtDisplayName(court)) + '" data-started-at="' + (court.startedAt || '') + '" data-deadline-at="' + (court.deadlineAt || '') + '" data-time-limit="' + (court.activeTimeLimitMinutes || '') + '">' + initialTimerText + '</span></div>'
      + teamsHtml(court, index, false)
      + (isFullController() ? '<div class="winner-section"><div class="winner-lbl">⚡ Who won?</div><div class="winner-row">'
        + '<button class="btn-team-a" onclick="recordWinner(' + index + ',\'A\')">🟢 Team A Won</button>'
        + '<button class="btn-team-b" onclick="recordWinner(' + index + ',\'B\')">🔵 Team B Won</button></div></div>' : '')
      + renderNextGamePanel(court, index, true);
  } else if (court.nextGame) {
    body = renderNextGamePanel(court, index, false);
  } else if (court.status === 'done') {
    body = teamsHtml(court, index, true) + renderNextGamePanel(court, index, true);
  } else {
    var eligible = Engine.eligibleIdsForCourt(S, index).length;
    var eligibility = court.skillGroup === 'any' ? 'No game assigned yet.' : eligible + ' of 4 ' + Engine.skillGroupLabel(court.skillGroup) + ' players eligible.';
    body = '<div class="court-empty-body">' + esc(eligibility) + '</div>' + renderNextGamePanel(court, index, true);
  }
  var visibleStatus = court.status === 'playing' ? 'playing' : court.nextGame ? 'next' : court.status;
  return '<div class="court-card court-card-' + color + (court.status === 'playing' ? ' is-playing' : court.nextGame ? ' is-staged' : court.status === 'done' ? ' is-done' : '') + '">'
    + '<div class="court-card-header"><div class="court-name"><span class="court-dot dot-' + color + '"></span>' + esc(Engine.courtDisplayName(court)) + '</div><div class="court-header-badges"><span class="court-skill-badge group-' + esc(court.skillGroup) + '">' + esc(Engine.skillGroupLabel(court.skillGroup)) + '</span>' + statusBadgeHtml(visibleStatus) + '</div></div>' + body + '</div>';
}

function renderCourtsSection() {
  var element = document.getElementById('courtsSection');
  if (!S.players.length) {
    element.innerHTML = '<div class="no-games"><div class="no-games-icon">🏓</div><p>Add players, then tap<br><strong>⏭ Prepare Courts &amp; Up Next</strong> to build the next games.</p></div>';
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
    html += '<div class="history-item"><div class="history-meta">' + esc(entry.courtName || ('Court ' + entry.courtNum)) + ' · Game ' + entry.gameNum
      + (entry.durationMs != null ? ' · ' + formatDuration(entry.durationMs) : '') + ' · '
      + (entry.timeLimitMinutes ? entry.timeLimitMinutes + ' min limit · ' + (entry.finishedAfterTimeLimit ? 'Limit reached · ' : 'Finished early · ') : '')
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
  var countLabel = activityEvents.length ? ' · ' + activityEvents.length + ' recent' : '';
  var html = '<div class="card"><div class="card-title history-toggle-row" onclick="toggleActivity()"><span class="card-title-left">📝 Live Activity' + countLabel + '</span><span>' + (activityOpen ? '▲ Hide' : '▼ Show') + '</span></div>';
  if (!activityOpen) {
    html += '<div class="activity-state">Open this section to connect to recent activity.</div>';
  } else if (activityLoading) {
    html += '<div class="activity-state">↻ Loading recent activity…</div>';
  } else if (activityError) {
    html += '<div class="activity-state">' + esc(activityError) + '<button class="btn btn-ghost btn-sm" onclick="subscribeToEvents()">Try Again</button></div>';
  } else if (!activityEvents.length) {
    html += '<div class="empty-hint">No activity recorded yet.</div>';
  } else {
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
  var searchWrap = document.getElementById('standingsSearchWrap');
  var searchCount = document.getElementById('standingsSearchCount');
  if (!S.players.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  searchWrap.hidden = S.players.length < 8;
  var sorted = Engine.rankedPlayers(S);
  var filtered = sorted.filter(function (player) { return !standingsSearchQuery || player.name.toLowerCase().indexOf(standingsSearchQuery) !== -1; });
  searchCount.textContent = filtered.length + '/' + sorted.length;
  if (!sorted.some(function (player) { return player.games > 0; })) {
    body.innerHTML = '<tr><td colspan="6"><div class="lb-no-games">No games completed yet. Prepare and start a game to begin tracking stats.</div></td></tr>'; return;
  }
  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="6"><div class="lb-no-games">No standings match “' + esc(standingsSearchQuery) + '”.</div></td></tr>'; return;
  }
  var visible = isLargeRoom() ? filtered.slice(0, standingsVisibleLimit) : filtered;
  body.innerHTML = visible.map(function (player) {
    var rank = sorted.indexOf(player) + 1, percent = player.games ? Math.round(player.wins / player.games * 100) : 0;
    var rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    var rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return '<tr><td class="lb-rank ' + rankClass + '">' + rankLabel + '</td><td class="lb-name">' + esc(player.name) + '</td>'
      + '<td class="lb-num">' + player.games + '</td><td class="lb-win">' + player.wins + '</td><td class="lb-pct">' + (player.games ? percent + '%' : '—') + '</td>'
      + '<td class="lb-bar-cell"><div class="lb-bar-wrap"><div class="lb-bar-win" style="width:' + percent + '%"></div></div></td></tr>';
  }).join('') + (visible.length < filtered.length
    ? '<tr><td colspan="6"><button class="btn btn-ghost list-more" onclick="showMoreStandings()">Show ' + Math.min(LARGE_ROOM_PAGE_SIZE, filtered.length - visible.length) + ' More Players</button></td></tr>' : '');
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
    root.querySelectorAll('button,input,select').forEach(function (control) {
      if (control.hasAttribute('data-local-control')) return;
      control.disabled = unavailable || roleReadOnly || control.hasAttribute('data-force-disabled');
    });
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
  document.body.classList.toggle('large-room-mode', isLargeRoom());
  renderSessionCard();
  renderSessionInfo();
  var courtDisplayTitle = document.getElementById('courtDisplayTitle');
  if (courtDisplayTitle) courtDisplayTitle.textContent = roomData && roomData.name ? roomData.name : 'Live Courts';
  syncCourtButtons();
  renderMatchmakingMode();
  renderCourtSkillGroups();
  updateStats();
  renderPlayerList();
  renderAvailableSection();
  renderCourtsSection();
  updateCourtTimers();
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
document.addEventListener('fullscreenchange', function () {
  if (courtDisplayActive && !document.fullscreenElement) {
    courtDisplayActive = false;
    document.body.classList.remove('court-display-mode');
  }
});

applyDisplayPreferences();
renderAppVersion();
setInterval(updateCourtTimers, 1000);
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
      if (appInitialised && roomId && linkedPlayerId && (accessMode === 'player' || isFullController())) refreshPlayerAlerts();
    }).catch(function (error) { console.warn('Service worker failed:', error); });
  });
}
