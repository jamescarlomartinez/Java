'use strict';
// Emulator-only fixture. Never runs against a live Firebase project.
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { doc, setDoc, Timestamp } = require('firebase/firestore');
const fs = require('node:fs');
const E = require('../rotation-engine.js');
(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') throw new Error('Local Firestore emulator required.');
  const env = await initializeTestEnvironment({ projectId: 'demo-pickleball-partners', firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') } });
  const state = E.createState(1);
  for (let i = 0; i < 8; i++) {
    E.enrollPlayer(state, 'Player ' + i, 'fixture-' + i, 'Fixture', 'p' + i, i % 2 + 1);
    state.players[i].checkedIn = false; state.players[i].checkedInUid = null; state.players[i].checkedInName = null;
  }
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/partner-browser'), {
      schemaVersion: 1, name: 'Partner Browser Test', hostUid: 'fixture-host', hostName: 'Fixture Host', hostEmail: 'fixture@example.invalid',
      organizerGrantId: 'fixture', status: 'active', revision: 0, state, undoStack: [], lastEventId: 'fixture',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(), endedAt: null, expiresAt: null
    });
  });
  await env.cleanup();
  console.log('Seeded emulator-only partner-browser room.');
})().catch(error => { console.error(error); process.exitCode = 1; });
