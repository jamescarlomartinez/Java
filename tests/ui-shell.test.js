'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

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
  assert.match(app, /player\.skillRating\.toFixed\(1\)/);
  assert.match(app, /waitLabel/);
  assert.match(app, /modalBody\.scrollTop\s*=\s*0/);
});

test('shared controls and player rows have adaptive layouts', () => {
  assert.match(html, /\.session-actions\s*\{[^}]*display:\s*grid/);
  assert.match(html, /@media \(max-width:\s*620px\)/);
  assert.match(html, /max-height:\s*calc\(100dvh - 16px\)/);
});

test('player QR check-in supports creating and claiming a new roster name', () => {
  assert.match(app, /id="selfEnrollBtn"/);
  assert.match(app, /Add & Check In/);
  assert.match(app, /player_self_enrolled/);
  assert.match(app, /Engine\.enrollPlayer/);
});
