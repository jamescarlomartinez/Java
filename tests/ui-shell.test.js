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
  const match = html.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 'm'));
  assert.ok(match, `Expected ${selector} to declare a numeric z-index`);
  return Number(match[1]);
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
  assert.match(serviceWorker, /pickleball-v26-balanced-skill-rotation/);
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
  for (const requiredFile of ['index.html', 'app.js', 'rotation-engine.js', 'room-data.js', 'sw.js', 'vendor/qrcode.js']) {
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
  assert.match(app, /Intermediate & Above/);
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
  assert.match(app, /var ROLE_HELP_VERSION = 'v7'/);
  assert.match(app, /Prepare Courts & Up Next/);
  assert.match(app, /prepared lineup moves into the main court view/);
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
  assert.match(html, /Summary & Export/);
  assert.match(app, /function openSessionSummary/);
  assert.match(app, /function exportSessionCsv/);
  assert.match(app, /text\/csv/);
});

test('live activity subscribes only while the section is open', () => {
  assert.match(app, /function toggleActivity\(\)[\s\S]*if \(activityOpen\) subscribeToEvents\(\)/);
  assert.match(app, /\.limit\(activityQueryLimit\(\)\)/);
  assert.match(app, /Open this section to connect to recent activity/);
  assert.doesNotMatch(app, /subscribeToRoom\(\);\s*subscribeToEvents\(\);/);
});

test('shared actions use intent deduplication and compact backwards-compatible undo', () => {
  assert.match(app, /recentActionIds: RoomData\.appendActionId/);
  assert.match(app, /stableActionId\(type, options\.dedupeKey\)/);
  assert.match(app, /eventData\.undoPatch = RoomData\.createUndoPatch/);
  assert.match(app, /RoomData\.applyUndoPatch\(currentState, target\.undoPatch\)/);
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
  assert.match(hostingBuild, /room-data\.js/);
});
