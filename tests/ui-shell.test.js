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
  assert.match(serviceWorker, /pickleball-v19-named-skill-levels/);
  assert.match(serviceWorker, /version\.json/);
  assert.match(serviceWorker, /cache:\s*'reload'/);
  assert.match(serviceWorker, /cache:\s*'no-store'/);
  assert.match(serviceWorker, /clients\.matchAll/);
  assert.match(serviceWorker, /client\.navigate/);
  assert.match(app, /updateViaCache:\s*'none'/);
});

test('legacy numeric activity is displayed with named skill levels', () => {
  assert.match(app, /function activitySummary\(event\)/);
  assert.match(app, /Engine\.migrateLegacySkillRating/);
  assert.match(app, /Engine\.skillLevelLabel/);
});
