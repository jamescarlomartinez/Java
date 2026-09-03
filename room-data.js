(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PickleballRoomData = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LAYOUT_VERSION = 1;
  var RECENT_ACTION_LIMIT = 40;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stateFromRoom(room, engine) {
    var source = room && room.state ? room.state : null;
    return engine.normalizeState(source);
  }

  function recentActionIds(room) {
    return room && Array.isArray(room.recentActionIds)
      ? room.recentActionIds.filter(function (value) { return typeof value === 'string'; }).slice(-RECENT_ACTION_LIMIT)
      : [];
  }

  function appendActionId(room, actionId) {
    var ids = recentActionIds(room);
    if (ids.indexOf(actionId) === -1) ids.push(actionId);
    return ids.slice(-RECENT_ACTION_LIMIT);
  }

  function valuesEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a == null || b == null) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function isObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function createUndoPatch(before, after) {
    var operations = [];

    function visit(previous, next, path) {
      if (valuesEqual(previous, next)) return;

      if (Array.isArray(previous) && Array.isArray(next) && previous.length === next.length) {
        for (var arrayIndex = 0; arrayIndex < previous.length; arrayIndex += 1) {
          visit(previous[arrayIndex], next[arrayIndex], path.concat(arrayIndex));
        }
        return;
      }

      if (isObject(previous) && isObject(next)) {
        var keys = new Set(Object.keys(previous).concat(Object.keys(next)));
        keys.forEach(function (key) {
          if (!Object.prototype.hasOwnProperty.call(previous, key)) {
            operations.push({ path: path.concat(key), remove: true });
            return;
          }
          if (!Object.prototype.hasOwnProperty.call(next, key)) {
            operations.push({ path: path.concat(key), value: clone(previous[key]) });
            return;
          }
          visit(previous[key], next[key], path.concat(key));
        });
        return;
      }

      operations.push({ path: path, value: clone(previous) });
    }

    visit(before, after, []);
    return operations;
  }

  function applyUndoPatch(current, operations) {
    var restored = clone(current);
    if (!Array.isArray(operations)) return restored;

    operations.forEach(function (operation) {
      if (!operation || !Array.isArray(operation.path) || !operation.path.length) {
        if (operation && Object.prototype.hasOwnProperty.call(operation, 'value')) restored = clone(operation.value);
        return;
      }
      var target = restored;
      for (var index = 0; index < operation.path.length - 1; index += 1) {
        var token = operation.path[index];
        if (target[token] == null || typeof target[token] !== 'object') {
          target[token] = typeof operation.path[index + 1] === 'number' ? [] : {};
        }
        target = target[token];
      }
      var lastToken = operation.path[operation.path.length - 1];
      if (operation.remove) {
        if (Array.isArray(target) && typeof lastToken === 'number') target.splice(lastToken, 1);
        else delete target[lastToken];
      } else {
        target[lastToken] = clone(operation.value);
      }
    });
    return restored;
  }

  function restoreUndoState(currentState, target, engine) {
    if ((target.partnershipRevision || 0) !== (currentState.partnershipRevision || 0)) {
      throw new Error('Partnerships changed after this action. Undo cannot override a later partnership decision.');
    }
    var restored = Array.isArray(target.undoPatch)
      ? engine.normalizeState(applyUndoPatch(currentState, target.undoPatch))
      : engine.normalizeState(target.beforeState);
    var check = engine.validatePartnerState(restored);
    if (!check.valid) throw new Error('Undo would split a fixed partnership. ' + check.reason);
    if ((restored.partnershipRevision || 0) !== (currentState.partnershipRevision || 0)) {
      restored.partnershipRevision = (currentState.partnershipRevision || 0) + 1;
    }
    return restored;
  }

  function roomCreateFields(state) {
    return {
      dataLayoutVersion: LAYOUT_VERSION,
      state: state,
      recentActionIds: []
    };
  }

  return {
    LAYOUT_VERSION: LAYOUT_VERSION,
    RECENT_ACTION_LIMIT: RECENT_ACTION_LIMIT,
    clone: clone,
    stateFromRoom: stateFromRoom,
    recentActionIds: recentActionIds,
    appendActionId: appendActionId,
    createUndoPatch: createUndoPatch,
    applyUndoPatch: applyUndoPatch,
    restoreUndoState: restoreUndoState,
    roomCreateFields: roomCreateFields
  };
});
