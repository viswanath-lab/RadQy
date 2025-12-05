(function () {
  const listeners = { selection: [], hover: [], colorby: [] };

  function emit(type, payload) {
    (listeners[type] || []).forEach(fn => {
      try { fn(payload || {}); } catch (e) { console.error("RADQY_EVENTS " + type + " listener error", e); }
    });
    // also dispatch a DOM event for legacy listeners
    try {
      document.dispatchEvent(new CustomEvent("radqy:" + type + ":change", { detail: payload || {} }));
    } catch (e) {
      // ignore
    }
  }

  window.RADQY_EVENTS = {
    onSelection(fn) { if (typeof fn === "function") listeners.selection.push(fn); },
    onHover(fn)     { if (typeof fn === "function") listeners.hover.push(fn); },
    onColorBy(fn)   { if (typeof fn === "function") listeners.colorby.push(fn); },
    emitSelection(payload) { emit("selection", payload); },
    emitHover(payload)     { emit("hover", payload); },
    emitColorBy(payload)   { emit("colorby", payload); }
  };
})();
