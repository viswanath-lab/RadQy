// log.js — lightweight interaction log for RadQy
(function () {
  window.RADQY = window.RADQY || {};

  const history = [];
  let nextId = 1;

  function snapshotPanels() {
    try {
      const v = window.RADQY && RADQY._vis ? RADQY._vis : null;
      return v ? { ...v } : null;
    } catch {
      return null;
    }
  }

  function snapshotMeta() {
    const m = (window.DATA && window.DATA.META) || {};
    return {
      scantype: m.scantype || null,
      dataset: m.dataset || null,
      N: m.N || null
    };
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function pushEntry(entry) {
    history.push(entry);

    // >>> This is the part that prints to the console <<<
//    console.log(
//      "[RadQy LOG]",
//      entry.t,
//      entry.action,
//      entry.payload,
//      entry.context
//    );

    // broadcast for anyone who wants live updates
    document.dispatchEvent(new CustomEvent("radqy:log", { detail: entry }));
  }

  RADQY.log = function (action, payload) {
    const entry = {
      id: nextId++,
      t: nowISO(),
      action: String(action || "unknown"),
      payload: payload || {},
      context: {
        meta: snapshotMeta(),
        panels: snapshotPanels()
      }
    };
    pushEntry(entry);
  };

  RADQY.getLog = function () {
    return history.slice();
  };

  RADQY.clearLog = function () {
    history.length = 0;
    nextId = 1;
  };
})();
