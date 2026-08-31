(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PickleballLiveSync = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];
  var ACK_TIMEOUT = 5000;

  function defaultParseSnapshot(snapshot) {
    var data = snapshot && typeof snapshot.data === 'function' ? snapshot.data() : snapshot && snapshot.data;
    return {
      exists: !!snapshot && (typeof snapshot.exists === 'boolean' ? snapshot.exists : !!data),
      data: data || null,
      revision: data ? Math.max(0, Number(data.revision) || 0) : -1,
      fromCache: !!(snapshot && snapshot.metadata && snapshot.metadata.fromCache),
      hasPendingWrites: !!(snapshot && snapshot.metadata && snapshot.metadata.hasPendingWrites)
    };
  }

  function createCoordinator(options) {
    options = options || {};
    var now = options.now || Date.now;
    var schedule = options.setTimeout || setTimeout;
    var cancel = options.clearTimeout || clearTimeout;
    var parseSnapshot = options.parseSnapshot || defaultParseSnapshot;
    var stopped = false;
    var unsubscribe = null;
    var retryTimer = null;
    var acknowledgementTimer = null;
    var retryAttempt = 0;
    var subscriptionGeneration = 0;
    var recoveryPromise = null;
    var status = 'connecting';
    var highestRevision = -1;
    var awaitedRevision = null;
    var lastServerAt = null;
    var lastError = null;

    function isOnline() {
      return typeof options.isOnline === 'function' ? !!options.isOnline() : true;
    }

    function snapshotState() {
      return {
        status: status,
        highestRevision: highestRevision,
        awaitedRevision: awaitedRevision,
        lastServerAt: lastServerAt,
        lastError: lastError,
        canMutate: status === 'live'
      };
    }

    function emit(nextStatus, error) {
      if (nextStatus) status = nextStatus;
      if (error !== undefined) lastError = error || null;
      if (typeof options.onStatus === 'function') options.onStatus(snapshotState());
    }

    function clearRetry() {
      if (retryTimer) cancel(retryTimer);
      retryTimer = null;
    }

    function clearAcknowledgement() {
      if (acknowledgementTimer) cancel(acknowledgementTimer);
      acknowledgementTimer = null;
    }

    function resetBackoff() {
      retryAttempt = 0;
      clearRetry();
    }

    function markOffline() {
      clearRetry();
      emit('offline');
    }

    function applySnapshot(snapshot, source) {
      if (stopped) return { applied: false, stopped: true };
      var parsed = parseSnapshot(snapshot);
      if (!parsed.exists) {
        if (typeof options.onSnapshot === 'function') options.onSnapshot(parsed, source || 'listener');
        emit('error', new Error('Shared game no longer exists.'));
        return { applied: true, missing: true };
      }
      var serverConfirmed = !parsed.fromCache || source === 'server';
      var revisionAdvanced = parsed.revision > highestRevision;
      var revisionCurrent = parsed.revision === highestRevision;
      if (parsed.revision < highestRevision) {
        return { applied: false, stale: true, revision: parsed.revision };
      }
      if (revisionAdvanced || highestRevision < 0) {
        highestRevision = parsed.revision;
        if (typeof options.onSnapshot === 'function') options.onSnapshot(parsed, source || 'listener');
      } else if (revisionCurrent && typeof options.onMetadata === 'function') {
        options.onMetadata(parsed, source || 'listener');
      }
      if (!serverConfirmed) {
        if (!isOnline()) markOffline();
        else emit(awaitedRevision != null ? 'syncing' : 'reconnecting');
        return { applied: revisionAdvanced, cached: true, revision: parsed.revision };
      }
      lastServerAt = now();
      lastError = null;
      resetBackoff();
      if (parsed.data && parsed.data.status === 'ended') {
        awaitedRevision = null;
        clearAcknowledgement();
        emit('ended');
      } else if (awaitedRevision != null && highestRevision < awaitedRevision) {
        emit('syncing');
      } else {
        awaitedRevision = null;
        clearAcknowledgement();
        emit(parsed.hasPendingWrites ? 'syncing' : 'live');
      }
      return { applied: revisionAdvanced, serverConfirmed: true, revision: parsed.revision };
    }

    function scheduleRetry(error) {
      if (stopped || !isOnline()) {
        markOffline();
        return;
      }
      clearRetry();
      var delay = RETRY_DELAYS[Math.min(retryAttempt, RETRY_DELAYS.length - 1)];
      retryAttempt += 1;
      emit('reconnecting', error || lastError);
      retryTimer = schedule(function () {
        retryTimer = null;
        reconnect(true);
      }, delay);
    }

    function listenerError(error, generation) {
      if (stopped || generation !== subscriptionGeneration) return;
      lastError = error || new Error('Live updates stopped.');
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      scheduleRetry(lastError);
    }

    function subscribeNow() {
      if (stopped || !isOnline() || typeof options.subscribe !== 'function') return;
      if (unsubscribe) unsubscribe();
      var generation = ++subscriptionGeneration;
      try {
        unsubscribe = options.subscribe(function (snapshot) {
          if (!stopped && generation === subscriptionGeneration) applySnapshot(snapshot, 'listener');
        }, function (error) {
          listenerError(error, generation);
        }) || null;
      } catch (error) {
        listenerError(error, generation);
      }
    }

    function reconnect(resubscribe) {
      if (stopped) return Promise.resolve(false);
      if (!isOnline()) {
        markOffline();
        return Promise.resolve(false);
      }
      if (recoveryPromise) return recoveryPromise;
      clearRetry();
      emit(awaitedRevision != null ? 'syncing' : 'reconnecting');
      if (resubscribe || !unsubscribe) subscribeNow();
      if (typeof options.fetchServer !== 'function') return Promise.resolve(false);
      recoveryPromise = Promise.resolve().then(function () {
        return options.fetchServer();
      }).then(function (snapshot) {
        applySnapshot(snapshot, 'server');
        return true;
      }).catch(function (error) {
        lastError = error;
        scheduleRetry(error);
        return false;
      }).finally(function () {
        recoveryPromise = null;
      });
      return recoveryPromise;
    }

    function awaitRevision(revision) {
      revision = Math.max(0, Number(revision) || 0);
      awaitedRevision = awaitedRevision == null ? revision : Math.max(awaitedRevision, revision);
      if (highestRevision >= awaitedRevision && lastServerAt != null) {
        awaitedRevision = null;
        emit('live');
        return;
      }
      clearAcknowledgement();
      emit('syncing');
      acknowledgementTimer = schedule(function () {
        acknowledgementTimer = null;
        reconnect(false);
      }, ACK_TIMEOUT);
    }

    function start() {
      stopped = false;
      emit(isOnline() ? 'connecting' : 'offline');
      if (isOnline()) subscribeNow();
    }

    function setOnline(online) {
      if (stopped) return;
      if (!online) {
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        markOffline();
        return;
      }
      reconnect(true);
    }

    function beginMutation() {
      if (status !== 'live') return false;
      emit('syncing');
      return true;
    }

    function cancelMutation() {
      awaitedRevision = null;
      clearAcknowledgement();
      if (!isOnline()) markOffline();
      else if (lastServerAt != null) emit('live');
      else reconnect(false);
    }

    function resume() {
      return reconnect(!unsubscribe);
    }

    function retryNow() {
      retryAttempt = 0;
      return reconnect(true);
    }

    function stop() {
      stopped = true;
      clearRetry();
      clearAcknowledgement();
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      subscriptionGeneration += 1;
    }

    return {
      start: start,
      stop: stop,
      resume: resume,
      retryNow: retryNow,
      reconnect: reconnect,
      setOnline: setOnline,
      beginMutation: beginMutation,
      cancelMutation: cancelMutation,
      awaitRevision: awaitRevision,
      applySnapshot: applySnapshot,
      getState: snapshotState
    };
  }

  return {
    RETRY_DELAYS: RETRY_DELAYS,
    ACK_TIMEOUT: ACK_TIMEOUT,
    createCoordinator: createCoordinator,
    defaultParseSnapshot: defaultParseSnapshot
  };
});
