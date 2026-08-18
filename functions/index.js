'use strict';

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { newlyAssignedPlayers, buildMessage } = require('./notifications');

initializeApp();

const REGION = 'asia-southeast1';
const APP_ORIGIN = 'https://pickleball-rotation.web.app';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function expireRoomSubscriptions(roomId, expiresAt) {
  const db = getFirestore();
  const snapshot = await db.collection('pushSubscriptions').where('roomId', '==', roomId).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((document) => batch.update(document.ref, {
    enabled: false,
    updatedAt: FieldValue.serverTimestamp(),
    expiresAt
  }));
  await batch.commit();
}

async function deliverAssignment(roomId, revision, state, assignment) {
  const db = getFirestore();
  const player = (state.players || []).find((entry) => entry.id === assignment.playerId);
  if (!player || !player.checkedIn || !player.checkedInUid) return;

  const subscriptionRef = db.collection('pushSubscriptions').doc(`${roomId}_${player.checkedInUid}`);
  const subscriptionSnapshot = await subscriptionRef.get();
  if (!subscriptionSnapshot.exists) return;
  const subscription = subscriptionSnapshot.data();
  if (!subscription.enabled || subscription.playerId !== assignment.playerId || !subscription.token) return;

  const built = buildMessage({
    roomId,
    revision,
    state,
    assignment,
    token: subscription.token,
    origin: APP_ORIGIN
  });
  const deliveryRef = db.collection('pushDeliveries').doc(built.deliveryId);
  const claimed = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(deliveryRef);
    if (existing.exists) return false;
    transaction.create(deliveryRef, {
      roomId,
      revision,
      courtNum: assignment.courtNum,
      gameNum: assignment.gameNum,
      playerId: assignment.playerId,
      uid: player.checkedInUid,
      status: 'sending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + THIRTY_DAYS_MS)
    });
    return true;
  });
  if (!claimed) return;

  try {
    const messageId = await getMessaging().send(built.message);
    await deliveryRef.update({ status: 'sent', messageId, sentAt: FieldValue.serverTimestamp() });
  } catch (error) {
    await deliveryRef.delete().catch(() => {});
    throw error;
  }
}

exports.notifyNewCourtAssignments = onDocumentUpdated({
  document: 'rooms/{roomId}',
  region: REGION,
  retry: true,
  maxInstances: 10
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const roomId = event.params.roomId;

  if (before.status === 'active' && after.status === 'ended') {
    await expireRoomSubscriptions(roomId, after.expiresAt || Timestamp.fromMillis(Date.now() + THIRTY_DAYS_MS));
    return;
  }
  if (after.status !== 'active' || before.revision === after.revision) return;

  const eventSnapshot = await getFirestore().collection('roomEvents').doc(after.lastEventId).get();
  if (!eventSnapshot.exists) return;
  const eventData = eventSnapshot.data();
  if (eventData.roomId !== roomId || eventData.revision !== after.revision) return;

  const assignments = newlyAssignedPlayers(before.state, after.state, eventData.type);
  await Promise.all(assignments.map((assignment) => deliverAssignment(roomId, after.revision, after.state, assignment)));
});
