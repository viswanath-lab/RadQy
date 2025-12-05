// opt.js – custom selection parsing + top banner messages
(function () {
  const $ = (s, r) => (r || document).querySelector(s);

  function getTableData() {
    const D = window.DATA || {};
    const headers = Array.isArray(D.HEADERS) ? D.HEADERS : [];
    const rows = Array.isArray(D.ROWS) ? D.ROWS : [];
    return { headers, rows };
  }

  function buildHeaderMap(headers) {
    const map = {};
    (headers || []).forEach(h => {
      if (h == null) return;
      const key = String(h).toLowerCase();
      if (!map[key]) map[key] = h;
    });
    return map;
  }

  function getMessages() {
    const cfg = window.RADQY_CONFIG || {};
    const m = cfg.optMessages || {};
    return {
      empty:   m.empty   || "Selection is empty. Enter a valid condition.",
      invalid: m.invalid || "Selection expression is not valid. Please check the metric names and operators.",
      error:   m.error   || "Selection expression raised an error.",
      noRows:  m.noRows  || "No rows are available to filter.",
      noMatch: m.noMatch || "No participants satisfy the given condition."
    };
  }

  function playBuzz() {
    try {
      if (window.RADQY) {
        if (typeof RADQY.playReportBuzz === "function") {
          RADQY.playReportBuzz();
          return;
        }
        if (typeof RADQY.playBuzz === "function") {
          RADQY.playBuzz();
          return;
        }
      }

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!playBuzz._ctx) {
        playBuzz._ctx = new AudioCtx();
      }
      const ctx = playBuzz._ctx;

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 880;

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {}
  }

  // ------- banner state -------
  let lastMessage = "";

  function showMessage(text, shouldShake) {
    const banner  = document.getElementById("opt-open-banner");
    const span    = document.getElementById("opt-open-text");
    const blocker = document.getElementById("opt-blocker");
    if (!banner || !span || !blocker) return;

    if (!text) {
      span.textContent      = "";
      banner.style.display  = "none";
      blocker.style.display = "none";
      banner.classList.remove("shake");
      lastMessage = "";
      return;
    }

    lastMessage = text;
    span.textContent      = text;
    banner.style.display  = "flex";
    blocker.style.display = "block";

    if (shouldShake) {
      banner.classList.remove("shake");
      void banner.offsetWidth;
      banner.classList.add("shake");
      playBuzz();
    } else {
      banner.classList.remove("shake");
    }
  }

  function nudgeLocked() {
    if (!lastMessage) return;
    showMessage(lastMessage, true);
  }

  function clearOptInput() {
    const input = $("#customsel");
    if (input) input.value = "";
    showMessage("", false);
  }

  const RESERVED = new Set(["true", "false", "null", "NaN", "Infinity"]);

  function transformIdent(id) {
    const up = id.toUpperCase();
    if (up === "AND") return "&&";
    if (up === "OR")  return "||";
    if (up === "NA")  return '"NA"';
    if (RESERVED.has(id)) return id;
    return 'val("' + id + '")';
  }

  function transformExpression(expr) {
    let out = "";
    let ident = "";
    let inString = false;
    let quote = null;
    let prevNonSpace = "";

    for (let i = 0; i < expr.length; i++) {
      const c = expr[i];

      if (inString) {
        out += c;
        if (c === quote && expr[i - 1] !== "\\") {
          inString = false;
          quote = null;
        }
        continue;
      }

      if (c === "'" || c === '"') {
        if (ident) {
          out += transformIdent(ident);
          ident = "";
        }
        inString = true;
        quote = c;
        out += c;
        continue;
      }

      const isLetter   = /[A-Za-z_]/.test(c);
      const isWordChar = /\w/.test(c);

      if (isLetter || (ident && isWordChar)) {
        ident += c;
        continue;
      }

      if (ident) {
        out += transformIdent(ident);
        ident = "";
      }

      if (c === "=") {
        const next = expr[i + 1] || "";
        if (
          prevNonSpace === ">" ||
          prevNonSpace === "<" ||
          prevNonSpace === "!" ||
          prevNonSpace === "=" ||
          next === "="
        ) {
          out += c;
        } else {
          out += "==";
        }
      } else {
        out += c;
      }

      if (!/\s/.test(c)) {
        prevNonSpace = c;
      }
    }

    if (ident) {
      out += transformIdent(ident);
    }

    return out;
  }

  function buildEvaluator(exprRaw) {
    let e = String(exprRaw || "").trim();
    if (!e) return null;

    const rangeRe =
      /(\d+(?:\.\d+)?)\s*(<=|<)\s*([A-Za-z_]\w*)\s*(<=|<)\s*(\d+(?:\.\d+)?)/g;
    e = e.replace(rangeRe, function (_, n1, op1, v, op2, n2) {
      return "(" + n1 + op1 + v + " && " + v + op2 + n2 + ")";
    });

    e = transformExpression(e);
    return new Function("val", "return (" + e + ");");
  }

  function makeVal(row, headerMap) {
    return function (name) {
      if (!row) return NaN;
      const key  = String(name || "").toLowerCase();
      const real = headerMap[key];
      if (!real) return NaN;
      const v = row[real];
      if (v == null) return NaN;
      const s = String(v).trim();
      if (!s) return NaN;
      const n = Number(s);
      return Number.isFinite(n) ? n : v;
    };
  }

  // 🔥 UPDATED — to dispatch selection-changed event for image/fg/bg buttons
  function applySelectionFromInput() {
    const msgs  = getMessages();
    const input = $("#customsel");
    if (!input) return;

    const raw = input.value.trim();

    if (!raw) {
      showMessage(msgs.empty, true);
      document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
        detail: { count: 0 }
      }));
      return;
    }

    const { headers, rows } = getTableData();
    if (!rows.length) {
      showMessage(msgs.noRows, true);
      return;
    }

    const headerMap = buildHeaderMap(headers);

    let evalFn;
    try {
      evalFn = buildEvaluator(raw);
    } catch (e) {
      showMessage(msgs.invalid, true);
      return;
    }
    if (!evalFn) {
      showMessage(msgs.invalid, true);
      return;
    }

    const selectedIdxs = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const val = makeVal(row, headerMap);
      let ok = false;
      try {
        ok = !!evalFn(val);
      } catch (e) {
        showMessage(msgs.error, true);
        return;
      }
      if (ok) selectedIdxs.push(i);
    }

    if (window.RADQY && typeof RADQY.setSelectedRowIndices === "function") {
  RADQY.setSelectedRowIndices(selectedIdxs);

  document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
    detail: {
      count: selectedIdxs.length,
      selectedIndices: selectedIdxs
    }
  }));
}


    if (!selectedIdxs.length) {
      showMessage(msgs.noMatch, true);
    } else {
      showMessage("", false);
    }
  }

  function bindOpt() {
    const input     = $("#customsel");
    const btnApply  = $("#btnapplyopt");
    const okBtn     = $("#opt-open-ok");
    const blocker   = $("#opt-blocker");
    const btnReset  = $("#btnreset");
    const btnSelect = $("#btnselect");
    const btnDeselect = $("#btndeselect");
    const btnDelete = $("#btndelete");
    const tableHost = document.getElementById("tablehost");

    if (btnApply && input) {
      btnApply.addEventListener("click", ev => {
        ev.preventDefault();
        applySelectionFromInput();
      });

      input.addEventListener("keydown", ev => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          applySelectionFromInput();
        }
      });
    }

    if (okBtn) {
      okBtn.addEventListener("click", () => {
        showMessage("", false);
      });
    }

    if (blocker) {
      blocker.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        nudgeLocked();
      });
    }

    if (btnReset) btnReset.addEventListener("click", clearOptInput);
    if (btnSelect) btnSelect.addEventListener("click", clearOptInput);
    if (btnDeselect) btnDeselect.addEventListener("click", clearOptInput);
    if (btnDelete) btnDelete.addEventListener("click", clearOptInput);

    if (tableHost) {
      tableHost.addEventListener("click", ev => {
        const tr = ev.target.closest("tr");
        if (!tr) return;
        const body = tr.closest("tbody");
        if (!body) return;
        clearOptInput();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindOpt();
  });
})();
