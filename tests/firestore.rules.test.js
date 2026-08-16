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
    state: { schemaVersion: 3, players: [] },
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

test('an approved organizer can atomically create a room, membership, and initial event', { skip: !emulatorAvailable }, async () => {
  const db = env.authenticatedContext('host-create', {
    email: 'host@example.com', firebase: { sign_in_provider: 'google.com' }
  }).firestore();
  const batch = writeBatch(db);
  const createdRoom = room({ hostUid: 'host-create', lastEventId: 'created-event' });
  batch.set(doc(db, 'rooms/created-room'), createdRoom);
  batch.set(doc(db, 'roomMembers/created-room_host-create'), {
    roomId: 'created-room', uid: 'host-create', displayName: 'Host',
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
    state: { schemaVersion: 3, players: [{ id: 'p1', name: 'Amy' }] },
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
    state: { schemaVersion: 3, players: [] }, revision: 2, lastEventId: 'late-event',
    undoStack: [], updatedAt: serverTimestamp()
  }));
});

test('expired room summaries remain readable but read-only until TTL deletion', { skip: !emulatorAvailable }, async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'rooms/room-expired'), room({
      status: 'ended', revision: 3, endedAt: Timestamp.fromMillis(Date.now() - 86400000),
      expiresAt: Timestamp.fromMillis(Date.now() - 1000), lastEventId: 'expired-event'
    }));
  });
  const db = env.authenticatedContext('guest-1').firestore();
  await assertSucceeds(getDoc(doc(db, 'rooms/room-expired')));
  await assertFails(updateDoc(doc(db, 'rooms/room-expired'), {
    state: { schemaVersion: 3, players: [] }, revision: 4,
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

test('test harness is intentionally skipped without the Firestore emulator', { skip: emulatorAvailable }, () => {
  assert.equal(emulatorAvailable, false);
});
