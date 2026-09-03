'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  runTransaction,
  onSnapshot,
  serverTimestamp,
  Timestamp
} = require('firebase/firestore');

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let env;

function room(overrides = {}) {
  return Object.assign({
    schemaVersion: 1,
    name: 'Sunday Open Play',
    hostUid: 'host-1',
    hostName: 'Host',
    hostEmail: 'host@example.com',
    organizerGrantId: 'grant-1',
    status: 'active',
    revision: 0,
    state: { schemaVersion: 6, players: [] },
    undoStack: [],
    lastEventId: 'event-0',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    endedAt: null,
    expiresAt: null
  }, overrides);
}

test.before(async () => {
  if (!emulatorAvailable) return;
  env = await initializeTestEnvironment({
    projectId: 'pickleball-rules-test',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'allowedEmails/grant-1'), { email: 'host@example.com' });
    await setDoc(doc(db, 'rooms/room-secret'), room());
    await setDoc(doc(db, 'roomMembers/room-secret_host-1'), {
      roomId: 'room-secret', uid: 'host-1', displayName: 'Host', joinedAt: Timestamp.now(), expiresAt: Timestamp.now()
    });
    await setDoc(doc(db, 'roomMembers/room-secret_guest-1'), {
      roomId: 'room-secret', uid: 'guest-1', displayName: 'Guest', joinedAt: Timestamp.now(), expiresAt: Timestamp.now()
    });
    await setDoc(doc(db, 'roomEvents/event-0'), {
      roomId: 'room-secret', revision: 0, type: 'room_created', summary: 'Created room',
      actorUid: 'host-1', actorName: 'Host', createdAt: Timestamp.now(), expiresAt: Timestamp.now()
    });
    await setDoc(doc(db, 'rooms/room-other'), room({ name: 'Other room', lastEventId: 'event-other' }));
    await setDoc(doc(db, 'roomEvents/event-other'), {
      roomId: 'room-other', revision: 0, type: 'room_created', summary: 'Created other room',
      actorUid: 'host-1', actorName: 'Host', createdAt: Timestamp.now(), expiresAt: Timestamp.now()
    });
  });
});

test.after(async () => { if (env) await env.cleanup(); });

test('authenticated link holders can get a known room but cannot list rooms', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('guest-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms/room-secret')));
  await assertFails(getDocs(collection(db, 'rooms')));
});

test('an anonymous link holder can register membership for a known room', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('joiner-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms/room-secret')));
  await assertSucceeds(setDoc(doc(db, 'roomMembers/room-secret_joiner-1'), {
    roomId: 'room-secret', uid: 'joiner-1', displayName: 'New Guest',
    joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  }));
});

test('anonymous players and viewers can register their requested room role', { skip: !emulatorAvailable }, async () => {
  for (const entry of [
    { uid: 'player-joiner', role: 'player', playerId: 'p1' },
    { uid: 'viewer-joiner', role: 'viewer', playerId: null }
  ]) {
    const db = env.authenticatedContext(entry.uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertSucceeds(setDoc(doc(db, `roomMembers/room-secret_${entry.uid}`), {
      roomId: 'room-secret', uid: entry.uid, displayName: entry.uid,
      role: entry.role, playerId: entry.playerId,
      joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    }));
  }
});

test('controllers and organizers can keep their role while linking a player ID', { skip: !emulatorAvailable }, async () => {
  const controllerDb = env.authenticatedContext('controller-player', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(setDoc(doc(controllerDb, 'roomMembers/room-secret_controller-player'), {
    roomId: 'room-secret', uid: 'controller-player', displayName: 'Controller James',
    role: 'controller', playerId: 'p-controller',
    joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  }));

  const hostDb = env.authenticatedContext('host-1', { email: 'host@example.com' }).firestore();
  await assertSucceeds(updateDoc(doc(hostDb, 'roomMembers/room-secret_host-1'), {
    role: 'organizer', playerId: 'p-host', expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  }));

  const strangerDb = env.authenticatedContext('stranger-controller').firestore();
  await assertFails(updateDoc(doc(strangerDb, 'roomMembers/room-secret_controller-player'), {
    playerId: 'p-stolen'
  }));
});

test('controller player state, membership, and event update atomically', { skip: !emulatorAvailable }, async () => {
  const uid = 'atomic-controller-player';
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/room-controller-player'), room({
      name: 'Controller player room',
      state: {
        schemaVersion: 6,
        players: [{
          id: 'p-existing', name: 'James Player', games: 2, wins: 1, notAvailable: true,
          skillRating: 2, skillLevelConfirmed: true, checkedIn: false, checkedInUid: null,
          checkedInName: null, lastAssignedRound: -1
        }]
      },
      lastEventId: 'controller-player-seed'
    }));
    await setDoc(doc(db, `roomMembers/room-controller-player_${uid}`), {
      roomId: 'room-controller-player', uid, displayName: 'Controller James', role: 'controller', playerId: null,
      joinedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  });

  const db = env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const roomRef = doc(db, 'rooms/room-controller-player');
  const memberRef = doc(db, `roomMembers/room-controller-player_${uid}`);
  const eventRef = doc(db, 'roomEvents/controller-player-linked');
  await assertSucceeds(runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    const data = snapshot.data();
    const beforeState = data.state;
    const nextState = JSON.parse(JSON.stringify(beforeState));
    Object.assign(nextState.players[0], {
      notAvailable: false, checkedIn: true, checkedInUid: uid, checkedInName: 'Controller James'
    });
    const nextRevision = data.revision + 1;
    transaction.update(roomRef, {
      state: nextState, revision: nextRevision, lastEventId: eventRef.id,
      undoStack: data.undoStack || [], updatedAt: serverTimestamp()
    });
    transaction.update(memberRef, {
      displayName: 'Controller James', role: 'controller', playerId: 'p-existing',
      expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
    transaction.set(eventRef, {
      roomId: 'room-controller-player', revision: nextRevision, type: 'controller_player_linked',
      summary: 'Joined the rotation as James Player', actorUid: uid, actorName: 'Controller James',
      beforeState, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  }));

  const membership = (await getDoc(memberRef)).data();
  const updatedRoom = (await getDoc(roomRef)).data();
  assert.equal(membership.role, 'controller');
  assert.equal(membership.playerId, 'p-existing');
  assert.equal(updatedRoom.state.players[0].checkedInUid, uid);
  assert.equal(updatedRoom.state.players[0].games, 2);
  assert.equal(updatedRoom.state.players[0].wins, 1);
});

test('a player-link guest can atomically add and claim their own roster entry', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/room-self-enroll'), room({
      name: 'Self enrollment room',
      state: { schemaVersion: 6, players: [] },
      lastEventId: 'self-seed'
    }));
  });
  const uid = 'self-enroller';
  const playerId = 'p-self';
  const db = env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertSucceeds(setDoc(doc(db, `roomMembers/room-self-enroll_${uid}`), {
    roomId: 'room-self-enroll', uid, displayName: 'Jordan', role: 'player', playerId,
    joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  }));

  const roomRef = doc(db, 'rooms/room-self-enroll');
  const eventRef = doc(db, 'roomEvents/self-enrolled-event');
  await assertSucceeds(runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    const data = snapshot.data();
    const beforeState = data.state;
    const nextState = JSON.parse(JSON.stringify(beforeState));
    nextState.players.push({
      id: playerId, name: 'Jordan', games: 0, wins: 0, notAvailable: false,
      skillRating: 2, skillLevelConfirmed: true, checkedIn: true, checkedInUid: uid, checkedInName: 'Jordan', lastAssignedRound: -1
    });
    const nextRevision = data.revision + 1;
    transaction.update(roomRef, {
      state: nextState, revision: nextRevision, lastEventId: eventRef.id,
      undoStack: data.undoStack || [], updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      roomId: 'room-self-enroll', revision: nextRevision, type: 'player_self_enrolled',
      summary: 'Jordan added themselves and checked in', actorUid: uid, actorName: 'Jordan',
      beforeState, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  }));

  const updated = (await getDoc(roomRef)).data();
  assert.equal(updated.state.players[0].name, 'Jordan');
  assert.equal(updated.state.players[0].checkedInUid, uid);
});

test('a guest cannot claim the organizer membership role', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('organizer-spoof', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  await assertFails(setDoc(doc(db, 'roomMembers/room-secret_organizer-spoof'), {
    roomId: 'room-secret', uid: 'organizer-spoof', displayName: 'Fake Host',
    role: 'organizer', playerId: null,
    joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  }));
});

test('an approved organizer can atomically create a room, membership, and initial event', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('host-create', {
    email: 'host@example.com', firebase: { sign_in_provider: 'google.com' }
  }).firestore();
  const batch = writeBatch(db);
  const createdRoom = room({ hostUid: 'host-create', lastEventId: 'created-event' });
  batch.set(doc(db, 'rooms/created-room'), createdRoom);
  batch.set(doc(db, 'roomMembers/created-room_host-create'), {
    roomId: 'created-room', uid: 'host-create', displayName: 'Host',
    role: 'organizer', playerId: null,
    joinedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  });
  batch.set(doc(db, 'roomEvents/created-event'), {
    roomId: 'created-room', revision: 0, type: 'room_created', summary: 'Created room',
    actorUid: 'host-create', actorName: 'Host', createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
  });
  await assertSucceeds(batch.commit());
});

test('only members can query events for a known room', { skip: !emulatorAvailable }, async () => {
  const guestDb = env.authenticatedContext('guest-1').firestore();
  await assertSucceeds(getDocs(query(collection(guestDb, 'roomEvents'), where('roomId', '==', 'room-secret'))));
  const strangerDb = env.authenticatedContext('stranger').firestore();
  await assertFails(getDocs(query(collection(strangerDb, 'roomEvents'), where('roomId', '==', 'room-secret'))));
  await assertFails(getDocs(collection(guestDb, 'roomEvents')));
});

test('anonymous controllers can update normal room state but cannot end it', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('guest-1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const ref = doc(db, 'rooms/room-secret');
  await assertSucceeds(updateDoc(ref, {
    state: { schemaVersion: 6, players: [{ id: 'p1', name: 'Amy' }] },
    revision: 1,
    lastEventId: 'event-1',
    undoStack: ['event-1'],
    updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(ref, {
    status: 'ended', revision: 2, endedAt: serverTimestamp(), expiresAt: Timestamp.now(), updatedAt: serverTimestamp()
  }));
});

test('organizer can end a room and guests cannot change lifecycle fields', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/room-lifecycle'), room({ lastEventId: 'event-life' }));
  });
  const hostDb = env.authenticatedContext('host-1', { email: 'host@example.com' }).firestore();
  await assertSucceeds(updateDoc(doc(hostDb, 'rooms/room-lifecycle'), {
    status: 'ended', revision: 1, endedAt: serverTimestamp(), expiresAt: Timestamp.now(), updatedAt: serverTimestamp()
  }));
  const guestDb = env.authenticatedContext('guest-1').firestore();
  await assertFails(updateDoc(doc(guestDb, 'rooms/room-lifecycle'), {
    state: { schemaVersion: 6, players: [] }, revision: 2, lastEventId: 'late-event',
    undoStack: [], updatedAt: serverTimestamp()
  }));
});

test('ended room summaries remain readable but read-only without automatic TTL deletion', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/room-expired'), room({
      status: 'ended', revision: 3, endedAt: Timestamp.fromMillis(Date.now() - 86400000),
      expiresAt: Timestamp.fromMillis(Date.now() - 1000), lastEventId: 'expired-event'
    }));
  });
  const db = env.authenticatedContext('guest-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms/room-expired')));
  await assertFails(updateDoc(doc(db, 'rooms/room-expired'), {
    state: { schemaVersion: 6, players: [] }, revision: 4,
    lastEventId: 'too-late', undoStack: [], updatedAt: serverTimestamp()
  }));
});

test('event actor UID must match the authenticated controller', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('guest-1').firestore();
  await assertFails(setDoc(doc(db, 'roomEvents/spoofed'), {
    roomId: 'room-secret', revision: 1, type: 'player_added', summary: 'Spoof',
    actorUid: 'host-1', actorName: 'Host', createdAt: serverTimestamp(), expiresAt: Timestamp.now()
  }));
});

test('simultaneous controller transactions retry without losing either update', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/room-concurrent'), room({ name: 'Concurrent room', lastEventId: 'seed' }));
    for (const uid of ['guest-a', 'guest-b']) {
      await setDoc(doc(db, `roomMembers/room-concurrent_${uid}`), {
        roomId: 'room-concurrent', uid, displayName: uid,
        joinedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
      });
    }
  });

  async function addPlayer(uid, playerId) {
    const db = env.authenticatedContext(uid).firestore();
    const roomRef = doc(db, 'rooms/room-concurrent');
    const eventRef = doc(db, 'roomEvents', `event-${uid}`);
    return runTransaction(db, async transaction => {
      const snapshot = await transaction.get(roomRef);
      const data = snapshot.data();
      const beforeState = data.state;
      const nextState = JSON.parse(JSON.stringify(beforeState));
      nextState.players = (nextState.players || []).concat({ id: playerId, name: playerId });
      const nextRevision = data.revision + 1;
      transaction.update(roomRef, {
        state: nextState,
        revision: nextRevision,
        lastEventId: eventRef.id,
        undoStack: (data.undoStack || []).concat(eventRef.id).slice(-10),
        updatedAt: serverTimestamp()
      });
      transaction.set(eventRef, {
        roomId: 'room-concurrent', revision: nextRevision, type: 'player_added',
        summary: `Added ${playerId}`, actorUid: uid, actorName: uid,
        beforeState, createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
      });
    });
  }

  await Promise.all([addPlayer('guest-a', 'p-a'), addPlayer('guest-b', 'p-b')]);
  const finalDb = env.authenticatedContext('guest-a').firestore();
  const finalRoom = (await getDoc(doc(finalDb, 'rooms/room-concurrent'))).data();
  assert.equal(finalRoom.revision, 2);
  assert.deepEqual(finalRoom.state.players.map(player => player.id).sort(), ['p-a', 'p-b']);
});

test('layout metadata, action IDs, and compact undo patches are accepted', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/room-layout'), room({
      hostUid: 'host-1', name: 'Layout room', lastEventId: 'seed-layout',
      dataLayoutVersion: 1, recentActionIds: []
    }));
    await setDoc(doc(db, 'roomMembers/room-layout_guest-layout'), {
      roomId: 'room-layout', uid: 'guest-layout', displayName: 'Guest Layout', role: 'controller', playerId: null,
      joinedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  });
  const db = env.authenticatedContext('guest-layout').firestore();
  const roomRef = doc(db, 'rooms/room-layout');
  const eventRef = doc(db, 'roomEvents/layout-action');
  await assertSucceeds(runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    const data = snapshot.data();
    transaction.update(roomRef, {
      dataLayoutVersion: 1,
      recentActionIds: ['action-layout'],
      state: { schemaVersion: 9, players: [{ id: 'p1', name: 'Amy' }] },
      revision: 1,
      lastEventId: eventRef.id,
      undoStack: [eventRef.id],
      updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      roomId: 'room-layout', revision: 1, type: 'player_added', summary: 'Added Amy',
      actorUid: 'guest-layout', actorName: 'Guest Layout', actionId: 'action-layout',
      undoPatch: [{ path: ['players'], value: data.state.players }],
      createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  }));
});

test('controller and viewer listeners receive committed room revisions without refresh', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/room-live-listener'), room({ name: 'Listener room', lastEventId: 'seed-live' }));
    await setDoc(doc(db, 'roomMembers/room-live-listener_controller-live'), {
      roomId: 'room-live-listener', uid: 'controller-live', displayName: 'Controller Live', role: 'controller', playerId: null,
      joinedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
    await setDoc(doc(db, 'roomMembers/room-live-listener_viewer-live'), {
      roomId: 'room-live-listener', uid: 'viewer-live', displayName: 'Viewer Live', role: 'viewer', playerId: null,
      joinedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  });

  const controllerDb = env.authenticatedContext('controller-live').firestore();
  const viewerDb = env.authenticatedContext('viewer-live').firestore();
  const viewerRoomRef = doc(viewerDb, 'rooms/room-live-listener');
  let unsubscribe;
  const observedRevision = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Viewer did not receive revision 1.')), 5000);
    unsubscribe = onSnapshot(viewerRoomRef, snapshot => {
      if (snapshot.exists() && snapshot.data().revision >= 1) {
        clearTimeout(timer);
        resolve(snapshot.data());
      }
    }, reject);
  });

  const controllerRoomRef = doc(controllerDb, 'rooms/room-live-listener');
  const eventRef = doc(controllerDb, 'roomEvents/live-listener-event');
  await runTransaction(controllerDb, async transaction => {
    const snapshot = await transaction.get(controllerRoomRef);
    const data = snapshot.data();
    const state = JSON.parse(JSON.stringify(data.state));
    state.players = [{ id: 'p-live', name: 'Live Player' }];
    transaction.update(controllerRoomRef, {
      state,
      revision: 1,
      lastEventId: eventRef.id,
      undoStack: [eventRef.id],
      recentActionIds: ['intent-live'],
      updatedAt: serverTimestamp()
    });
    transaction.set(eventRef, {
      roomId: 'room-live-listener', revision: 1, type: 'player_added', summary: 'Added Live Player',
      actorUid: 'controller-live', actorName: 'Controller Live', actionId: 'intent-live',
      beforeState: data.state, createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
    });
  });

  const viewerState = await observedRevision;
  if (unsubscribe) unsubscribe();
  assert.equal(viewerState.revision, 1);
  assert.equal(viewerState.state.players[0].name, 'Live Player');
});

test('test harness is intentionally skipped without the Firestore emulator', { skip: emulatorAvailable }, () => {
  assert.equal(emulatorAvailable, false);
});

test('schema 11 rooms reject older writers including organizer downgrades', { skip: !emulatorAvailable }, async () => {
  const E = require('../rotation-engine.js');
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/room-schema11'), room({ state: E.createState(1) }));
  });
  for (const uid of ['host-1', 'guest-1']) {
    const ref = doc(env.authenticatedContext(uid).firestore(), 'rooms/room-schema11');
    await assertFails(updateDoc(ref, { state: { schemaVersion: 10, players: [] } }));
    await assertFails(updateDoc(ref, { state: { players: [] } }));
    await assertSucceeds(updateDoc(ref, { state: E.createState(1) }));
  }
});

test('concurrent partner approvals remain atomic and live listeners receive the final pairing', { skip: !emulatorAvailable }, async () => {
  const E = require('../rotation-engine.js');
  const state = E.createState(1);
  for (let i = 0; i < 4; i++) E.enrollPlayer(state, 'Player ' + i, 'uid' + i, 'Player ' + i, 'p' + i, 1);
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'rooms/room-partners'), room({ state }));
    for (const uid of ['partner-controller-a', 'partner-controller-b']) {
      await setDoc(doc(db, 'roomMembers/room-partners_' + uid), {
        roomId: 'room-partners', uid, displayName: uid, role: 'controller', playerId: null,
        joinedAt: Timestamp.now(), expiresAt: Timestamp.now()
      });
    }
  });
  const viewer = env.authenticatedContext('partner-viewer').firestore();
  let unsubscribe;
  const observed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { if (unsubscribe) unsubscribe(); reject(new Error('Pairing did not synchronize.')); }, 8000);
    unsubscribe = onSnapshot(doc(viewer, 'rooms/room-partners'), snapshot => {
      if (snapshot.exists() && snapshot.data().revision === 1) { clearTimeout(timeout); resolve(snapshot.data()); }
    }, reject);
  });
  async function approve(uid, target) {
    const db = env.authenticatedContext(uid).firestore();
    const ref = doc(db, 'rooms/room-partners');
    const eventRef = doc(collection(db, 'roomEvents'));
    return runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const data = snapshot.data();
      const next = E.normalizeState(data.state);
      const result = E.partnerAction(next, 'create', 'p0', target, { isController: true, uid });
      if (!result.changed) return false;
      transaction.update(ref, { state: next, revision: data.revision + 1, lastEventId: eventRef.id, updatedAt: serverTimestamp() });
      transaction.set(eventRef, {
        roomId: 'room-partners', revision: data.revision + 1, type: 'partner_create', summary: 'Set partners',
        actorUid: uid, actorName: uid, partnershipRevision: next.partnershipRevision,
        createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 86400000)
      });
      return true;
    });
  }
  const results = await Promise.all([approve('partner-controller-a', 'p1'), approve('partner-controller-b', 'p2')]);
  assert.equal(results.filter(Boolean).length, 1);
  const received = await observed; unsubscribe();
  assert.equal(received.state.partnerships.length, 1);
  const final = (await getDoc(doc(viewer, 'rooms/room-partners'))).data();
  assert.equal(final.revision, 1);
  assert.deepEqual(final.state.partnerships, received.state.partnerships);
});
