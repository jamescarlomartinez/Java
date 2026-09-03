'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
const packageInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'firebase.json'), 'utf8'));
const hostingBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'prepare-hosting.js'), 'utf8');

function zIndexFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(?:var\\((--[^)]+)\\)|(\\d+))`, 'm'));
  assert.ok(match, `Expected ${selector} to declare a z-index`);
  if (match[2]) return Number(match[2]);
  const token = html.match(new RegExp(`${match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(\\d+)`));
  assert.ok(token, `Expected ${match[1]} to be a numeric layer token`);
  return Number(token[1]);
}

test('guest controller-name modal renders above the joining overlay', () => {
  assert.ok(
    zIndexFor('.modal-overlay') > zIndexFor('.auth-overlay'),
    'The controller-name modal must remain visible while the joining overlay is active'
  );
});

test('QR library loads before the application and rotation-style controls are present', () => {
  assert.ok(html.indexOf('./vendor/qrcode.js') < html.indexOf('./app.js'));
  assert.match(html, /data-matchmaking-mode="social"/);
  assert.match(html, /data-matchmaking-mode="balanced"/);
  assert.match(app, /new partners and opponents before waiting-time tie-breakers/);
});

test('standings render before history and live activity', () => {
  const standings = html.indexOf('id="statsCard"');
  const history = html.indexOf('id="historySection"');
  const activity = html.indexOf('id="activitySection"');

  assert.ok(standings >= 0 && history >= 0 && activity >= 0);
  assert.ok(standings < history, 'Player standings should appear above game history');
  assert.ok(history < activity, 'Live activity should remain the final game section');
});

test('replacement picker includes skill and fairness details', () => {
  assert.match(app, /replacement-skill/);
  assert.match(app, /Engine\.skillLevelLabel\(player\.skillRating\)/);
  assert.doesNotMatch(app, /skillRating\.toFixed/);
  assert.match(app, /waitLabel/);
  assert.match(app, /modalBody\.scrollTop\s*=\s*0/);
});

test('shared controls and player rows have adaptive layouts', () => {
  assert.match(html, /\.session-actions\s*\{[^}]*display:\s*grid/);
  assert.match(html, /@media \(max-width:\s*620px\)/);
  assert.match(html, /max-height:\s*calc\(100dvh - 16px\)/);
  assert.match(html, /\.skill-picker\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(html, /\.skill-level-option\s*\{[^}]*min-height:\s*62px/);
});

test('player QR check-in supports creating and claiming a new roster name', () => {
  assert.match(app, /id="selfEnrollBtn"/);
  assert.match(app, /Add & Check In/);
  assert.match(app, /player_self_enrolled/);
  assert.match(app, /Engine\.enrollPlayer/);
  assert.match(app, /What is your current skill level\?/);
  assert.match(app, /Engine\.SKILL_LEVELS/);
  assert.match(app, /skillLevelConfirmed/);
  assert.match(app, /join\.disabled\s*=\s*true/);
  assert.match(app, /if \(!selectedRating\) \{ error\.textContent = 'Choose your skill level\.'/);
  assert.match(app, /pendingPlayerSkillRating/);
  assert.match(app, /Engine\.setSelfSkillRating/);
  assert.match(app, /My Skill/);
});

test('footer exposes the current version and a forced update control', () => {
  const appVersion = app.match(/var APP_VERSION = '([^']+)'/);
  assert.ok(appVersion);
  assert.equal(appVersion[1], release.version);
  assert.equal(packageInfo.version, release.version);
  assert.match(html, /id="appVersion"/);
  assert.match(html, /id="updateAppBtn"/);
  assert.ok(html.indexOf('id="activitySection"') < html.indexOf('class="app-footer"'));
  assert.match(app, /function updateAppToLatest/);
  assert.match(app, /registration\.unregister\(\)/);
  assert.match(app, /caches\.delete/);
});

test('service worker bypasses stale caches for releases and app code', () => {
  assert.match(serviceWorker, /pickleball-v30-fixed-partners/);
  assert.match(serviceWorker, /version\.json/);
  assert.match(serviceWorker, /cache:\s*'reload'/);
  assert.match(serviceWorker, /cache:\s*'no-store'/);
  assert.match(serviceWorker, /clients\.matchAll/);
  assert.match(serviceWorker, /client\.navigate/);
  assert.match(app, /updateViaCache:\s*'none'/);
});

test('controllers choose and safely manage player participation', () => {
  assert.match(app, /Controller Only/);
  assert.match(app, /Existing Player/);
  assert.match(app, /New Player/);
  assert.match(app, /function ensureControllerParticipation/);
  assert.match(app, /function commitControllerParticipation/);
  assert.match(app, /Engine\.changeOwnedPlayer/);
  assert.match(app, /membershipPlayerId/);
  assert.match(app, /Playing as/);
  assert.match(app, /Player Tools/);
  assert.match(app, /Change Player/);
  assert.match(app, /Stop Playing/);
  assert.match(html, /\.participation-picker\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(html, /\.participation-option\s*\{[^}]*min-height:\s*72px/);
});

test('Firebase Hosting publishes only the explicit app bundle', () => {
  assert.equal(firebaseConfig.hosting.public, '.firebase-public');
  assert.equal(firebaseConfig.hosting.predeploy, 'node scripts/prepare-hosting.js');
  for (const requiredFile of ['index.html', 'app.js', 'rotation-engine.js', 'room-data.js', 'live-sync.js', 'sw.js', 'vendor/qrcode.js']) {
    assert.match(hostingBuild, new RegExp(requiredFile.replace('.', '\\.')));
  }
  assert.doesNotMatch(hostingBuild, /README\.md|package-lock|firestore\.rules|src\//);
});

test('legacy numeric activity does not expose obsolete numeric levels', () => {
  assert.match(app, /function activitySummary\(event\)/);
  assert.doesNotMatch(app, /Engine\.migrateLegacySkillRating/);
  assert.match(app, /previous skill level/);
});

test('two-level court designation controls and eligibility badges are present', () => {
  assert.match(html, /id="courtSkillGroups"/);
  assert.match(app, /function setCourtSkillGroup/);
  assert.match(app, /Engine\.courtPreparationOrder/);
  assert.match(app, /Engine\.eligibleIdsForCourt/);
  assert.match(app, /court-skill-badge/);
  assert.match(app, /Non-Beginner/);
  assert.doesNotMatch(app, /Intermediate & Above/);
  assert.doesNotMatch(app, /Expert \/ Pro/);
});

test('each shared role has context help and QR access summaries', () => {
  assert.match(app, /var ROLE_HELP/);
  assert.match(app, /Player Check-In · How to Use/);
  assert.match(app, /View Only · How to Use/);
  assert.match(app, /Controller · How to Use/);
  assert.match(app, /❓ How to Use/);
  assert.match(app, /pickleballHelpSeen_/);
  assert.match(app, /accessRoleSummary/);
  assert.match(app, /var ROLE_HELP_VERSION = 'v11'/);
  assert.match(app, /Prepare Courts & Up Next/);
  assert.match(app, /automatically prepares a fair next lineup/);
  assert.match(app, /ask a controller to edit or remove your prepared assignment/i);
  assert.match(app, /two-and-two mixed games and all-one-level games as equally balanced/i);
  assert.match(app, /one-and-three skill mix/i);
  assert.match(html, /\.help-steps/);
});

test('player alerts use explicit permission and free local system notifications', () => {
  assert.doesNotMatch(html, /firebase-messaging-compat\.js/);
  assert.match(html, /id="turnAlert"/);
  assert.match(app, /function enablePlayerAlerts/);
  assert.match(app, /Notification\.requestPermission\(\)/);
  assert.match(app, /registration\.showNotification/);
  assert.match(app, /assignment\.status === 'next'/);
  assert.match(app, /before\.courtNum === after\.courtNum && before\.gameNum === after\.gameNum/);
  assert.match(app, /localStorage\.setItem\(alertsStorageKey\(\), '1'\)/);
  assert.match(app, /fully closed app cannot receive/);
  assert.doesNotMatch(app, /pushSubscriptions|fbMessaging|FCM_VAPID_KEY/);
  assert.doesNotMatch(serviceWorker, /firebase-messaging|onBackgroundMessage/);
  assert.match(serviceWorker, /notificationclick/);
});

test('per-court Up Next, timers, manual builder, court names, and session export are exposed responsively', () => {
  assert.match(html, /Prepare Courts &amp; Up Next/);
  assert.match(app, /function startStagedGame/);
  assert.match(app, /Engine\.prepareNextGame/);
  assert.match(app, /function openManualMatchBuilder/);
  assert.match(app, /Engine\.prepareManualNextGame/);
  assert.match(app, /function renderNextGamePanel/);
  assert.match(app, /Next game not prepared yet/);
  assert.match(app, /Prepare Fair Next/);
  assert.match(app, /Build Next Manually/);
  assert.match(html, /id="sUpNext"/);
  assert.match(html, /\.next-game-panel/);
  assert.match(html, /\.next-actions[^}]*grid-template-columns/);
  assert.match(html, /\.manual-builder\s*\{[^}]*grid-template-columns/);
  assert.match(html, /@media \(max-width:\s*480px\)[\s\S]*\.manual-builder\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(app, /function renameCourt/);
  assert.match(app, /Engine\.courtDisplayName/);
  assert.match(app, /data-court-timer/);
  assert.match(app, /function updateCourtTimers/);
  assert.match(html, /Summary &amp; Export/);
  assert.match(app, /function openSessionSummary/);
  assert.match(app, /function exportSessionCsv/);
  assert.match(app, /text\/csv/);
});

test('per-court time limits reuse the timer and settings surfaces without score tracking', () => {
  assert.match(app, /function setCourtTimeLimit/);
  assert.match(app, /function alertControllerToTimeLimit/);
  assert.match(app, /Time Limit Reached/);
  assert.match(app, /data-deadline-at/);
  assert.match(app, /Reached Time Limit/);
  assert.match(app, /Court Names, Skill & Timer/);
  assert.match(html, /\.court-timer\.is-warning/);
  assert.match(html, /\.court-timer\.is-overdue/);
  assert.match(html, /\.court-time-select/);
  assert.match(html, /id="toast" role="status" aria-live="polite"/);
  assert.doesNotMatch(app, /scoreA|scoreB|Team A Score|Team B Score/);
});

test('live activity subscribes only while the section is open', () => {
  assert.match(app, /activityOpen = !!roomId && tab === 'activity'/);
  assert.match(app, /if \(activityOpen && !wasActivityOpen\) subscribeToEvents\(\)/);
  assert.match(app, /\.limit\(activityQueryLimit\(\)\)/);
  assert.match(app, /Subscribed while open/);
  assert.doesNotMatch(app, /subscribeToRoom\(\);\s*subscribeToEvents\(\);/);
});

test('shared actions use intent deduplication and compact backwards-compatible undo', () => {
  assert.match(app, /recentActionIds: RoomData\.appendActionId/);
  assert.match(app, /var actionId = eventRef\.id/);
  assert.match(app, /var inFlightKey = type \+ '\\|' /);
  assert.doesNotMatch(app, /function stableActionId/);
  assert.match(app, /eventData\.undoPatch = RoomData\.createUndoPatch/);
  assert.match(app, /RoomData\.restoreUndoState\(currentState, target, Engine\)/);
  assert.match(app, /target\.beforeState/);
  assert.doesNotMatch(app, /beforeState: beforeState/);
});

test('large-room mode limits rendered lists and exposes player and standings search', () => {
  assert.match(app, /var LARGE_ROOM_THRESHOLD = 50/);
  assert.match(app, /LARGE_ROOM_EVENT_LIMIT = 20/);
  assert.match(app, /filtered\.slice\(0, playerVisibleLimit\)/);
  assert.match(app, /filtered\.slice\(0, standingsVisibleLimit\)/);
  assert.match(html, /id="playerSearch"/);
  assert.match(html, /id="standingsSearch"/);
  assert.match(html, /body\.large-room-mode \.status-playing/);
});

test('display preferences, fullscreen courts, rules, and announcements are available without new network services', () => {
  assert.match(app, /pickleballDisplayPreferences_v1/);
  assert.match(app, /function openDisplaySettings/);
  assert.match(app, /function enterCourtDisplay/);
  assert.match(app, /function openSessionInfoEditor/);
  assert.match(app, /sessionAnnouncement/);
  assert.match(app, /sessionRules/);
  assert.match(html, /id="courtDisplayBar"/);
  assert.match(html, /body\.court-display-mode #courtsSection/);
  assert.match(html, /body\.high-contrast/);
  assert.match(html, /html\.large-text/);
});

test('the compatibility data layer loads before the application', () => {
  assert.ok(html.indexOf('./room-data.js') < html.indexOf('./app.js'));
  assert.match(serviceWorker, /room-data\.js/);
  assert.match(serviceWorker, /live-sync\.js/);
  assert.match(hostingBuild, /room-data\.js/);
  assert.match(hostingBuild, /live-sync\.js/);
});

test('task-focused tabs follow the ARIA tab pattern and default to Game', () => {
  for (const tab of ['game', 'players', 'results', 'activity', 'session']) {
    assert.match(html, new RegExp(`id="tab-${tab}"[^>]*role="tab"[^>]*aria-controls="panel-${tab}"`));
    assert.match(html, new RegExp(`id="panel-${tab}"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-${tab}"`));
  }
  assert.match(app, /function initAppTabs/);
  assert.match(app, /selectAppTab\('game'\)/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /event\.key === 'Home'/);
  assert.match(app, /event\.key === 'End'/);
  assert.match(html, /@media \(max-width:\s*620px\)[\s\S]*\.app-tabs\s*\{[^}]*position:\s*fixed/);
  assert.match(html, /env\(safe-area-inset-bottom\)/);
});

test('app-owned dialogs replace browser confirms and preserve accessible focus behavior', () => {
  assert.doesNotMatch(app, /\bconfirm\(/);
  assert.match(app, /function confirmAction/);
  assert.match(app, /function handleModalKeydown/);
  assert.match(app, /document\.querySelector\('\.container'\)\.inert = true/);
  assert.match(app, /returnFocus\.focus/);
  assert.match(app, /aria-busy/);
  assert.match(html, /id="appModal" role="dialog" aria-modal="true"/);
});

test('self-healing live sync requires server confirmation and exposes recovery UI', () => {
  assert.ok(html.indexOf('./live-sync.js') < html.indexOf('./app.js'));
  assert.match(app, /LiveSync\.createCoordinator/);
  assert.match(app, /source: 'server'/);
  assert.match(app, /roomSync\.awaitRevision/);
  assert.match(app, /visibilitychange/);
  assert.match(app, /pageshow/);
  assert.match(app, /Retry Now/);
  assert.match(html, /id="syncRecoveryBar"/);
  assert.match(html, /id="syncRetryBtn"/);
  assert.doesNotMatch(app, /online \? .*connected/);
});

test('design context and UX contract are release artifacts', () => {
  for (const file of ['DESIGN.md', 'UX-CONTRACT.md', 'premium-ui.json']) {
    assert.equal(fs.existsSync(path.join(__dirname, '..', file)), true, `${file} should exist`);
  }
  assert.doesNotMatch(html, /id="legacyApp"/);
  assert.match(html, /id="playerSearchClear"/);
  assert.match(html, /id="standingsSearchClear"/);
});

test('fixed partners reuse player tools, searchable modal, help, and shared action protections', () => {
  assert.match(html, /id="partnershipSection"/);
  assert.match(app, /function openPartnerPicker/);
  assert.match(app, /id="partnerSearchClear"/);
  assert.match(app, /Partner Requests/);
  assert.match(app, /My Partner/);
  assert.match(app, /Engine\.partnerAction/);
  assert.match(app, /Engine\.validatePartnerLineup/);
  assert.match(app, /Engine\.validatePartnerState/);
  assert.match(app, /if \(!roomSync\) initialRoomServerSnapshot = null/);
  assert.match(app, /function setModalPending/);
  assert.match(app, /incompatibleGameVersion/);
  for (const role of ['player', 'viewer', 'controller']) {
    const start = app.indexOf('  ' + role + ': {');
    const end = app.indexOf('\n  }', start);
    assert.match(app.slice(start, end), /[Pp]artner/);
  }
});
