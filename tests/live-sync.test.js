'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const LiveSync = require('../live-sync');

function snapshot(revision, options = {}) {
  const data = { revision, status: options.status || 'active', value: options.value || revision };
  return {
    exists: true,
    data: () => data,
    metadata: { fromCache: !!options.fromCache, hasPendingWrites: !!options.hasPendingWrites }
  };
}

function harness(options = {}) {
  let nextSnapshot;
  let listenerError;
  let online = options.online !== false;
  let clock = 1000;
  const states = [];
  const applied = [];
  const timers = [];
  const coordinator = LiveSync.createCoordinator({
    now: () => clock,
    isOnline: () => online,
    setTimeout: (callback, delay) => {
      const timer = { callback, delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: timer => { if (timer) timer.cancelled = true; },
    subscribe: (next, error) => {
      nextSnapshot = next;
      listenerError = error;
      return () => {};
    },
    fetchServer: options.fetchServer || (() => Promise.resolve(snapshot(0))),
    onSnapshot: parsed => applied.push(parsed.data.value),
    onStatus: state => states.push({ ...state })
  });
  return {
    coordinator,
    states,
    applied,
    timers,
    emit: value => nextSnapshot(value),
    fail: error => listenerError(error),
    setOnline: value => { online = value; },
    tick: value => { clock += value; }
  };
}

test('cached snapshots stay visible but cannot claim Live status', () => {
  const h = harness();
  h.coordinator.start();
  h.emit(snapshot(2, { fromCache: true, value: 'cached' }));
  assert.deepEqual(h.applied, ['cached']);
  assert.equal(h.coordinator.getState().status, 'reconnecting');
  assert.equal(h.coordinator.getState().canMutate, false);
  h.emit(snapshot(2, { value: 'server' }));
  assert.equal(h.coordinator.getState().status, 'live');
  assert.equal(h.coordinator.getState().canMutate, true);
});

test('room snapshots apply monotonically and same revision only updates metadata', () => {
  const h = harness();
  h.coordinator.start();
  h.emit(snapshot(4, { value: 'newest' }));
  h.emit(snapshot(3, { value: 'stale' }));
  h.emit(snapshot(4, { value: 'same' }));
  assert.deepEqual(h.applied, ['newest']);
  assert.equal(h.coordinator.getState().highestRevision, 4);
});

test('mutations remain Syncing until the committed revision is observed', () => {
  const h = harness();
  h.coordinator.start();
  h.emit(snapshot(5));
  assert.equal(h.coordinator.beginMutation(), true);
  h.coordinator.awaitRevision(6);
  assert.equal(h.coordinator.getState().status, 'syncing');
  assert.equal(h.coordinator.getState().canMutate, false);
  h.emit(snapshot(5));
  assert.equal(h.coordinator.getState().status, 'syncing');
  h.emit(snapshot(6));
  assert.equal(h.coordinator.getState().status, 'live');
});

test('a rejected precondition restores Live without a network read', () => {
  const h = harness();
  h.coordinator.start();
  h.emit(snapshot(5));
  h.coordinator.beginMutation();
  assert.equal(h.coordinator.getState().status, 'syncing');
  h.coordinator.cancelMutation();
  assert.equal(h.coordinator.getState().status, 'live');
  assert.equal(h.coordinator.getState().canMutate, true);
});

test('a missed committed snapshot performs one authoritative server read after five seconds', async () => {
  let reads = 0;
  const h = harness({ fetchServer: () => { reads += 1; return Promise.resolve(snapshot(8)); } });
  h.coordinator.start();
  h.emit(snapshot(7));
  h.coordinator.beginMutation();
  h.coordinator.awaitRevision(8);
  const acknowledgement = h.timers.find(timer => timer.delay === LiveSync.ACK_TIMEOUT && !timer.cancelled);
  assert.ok(acknowledgement);
  acknowledgement.callback();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 1);
  assert.equal(h.coordinator.getState().highestRevision, 8);
  assert.equal(h.coordinator.getState().status, 'live');
});

test('listener errors use bounded backoff and resume can recover immediately', async () => {
  let reads = 0;
  const h = harness({ fetchServer: () => { reads += 1; return Promise.resolve(snapshot(3)); } });
  h.coordinator.start();
  h.fail(new Error('listener stopped'));
  assert.equal(h.coordinator.getState().status, 'reconnecting');
  assert.equal(h.timers.find(timer => !timer.cancelled).delay, LiveSync.RETRY_DELAYS[0]);
  await h.coordinator.resume();
  assert.equal(reads, 1);
  assert.equal(h.coordinator.getState().status, 'live');
});

test('offline pauses retries and online recovery never infers Live without a server read', async () => {
  const h = harness({ online: false, fetchServer: () => Promise.resolve(snapshot(2)) });
  h.coordinator.start();
  assert.equal(h.coordinator.getState().status, 'offline');
  h.setOnline(true);
  h.coordinator.setOnline(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.coordinator.getState().status, 'live');
});
