
// colorby.js — detect categorical columns and build Color by dropdown
(function () {
  const $ = (s, r) => (r || document).querySelector(s);

  // track which headers are hidden via Metrics (lowercased names)
  let HIDDEN_HEADERS = new Set();

  // ========= helpers =========
  function norm(v) {
    if (v == null) return "NA";
    const t = String(v).trim();
    if (t === "") return "NA";
    const n = Number(t);
    if (Number.isFinite(n)) return t;
    return t;
  }

  function normalizeCategoryValue(header, raw) {
    return norm(raw);
  }
  window.normalizeCategoryValue = normalizeCategoryValue;

  function getValueStats(rows, header) {
    const counts = {};
    rows.forEach(r => {
      const key = normalizeCategoryValue(header, r && r[header]);
      counts[key] = (counts[key] || 0) + 1;
    });
    return { distinct: Object.keys(counts), counts };
  }

  function isCategoricalByRule(stats) {
    if (!stats.distinct.length) return false;
    if (stats.distinct.length > 5) return false;
    return stats.distinct.some(k => (stats.counts[k] || 0) > 1);
  }

  function orderCats(distinct, counts) {
    const hasNA = distinct.includes("NA");
    const withoutNA = distinct.filter(v => v !== "NA");
    const numList = [];
    const strList = [];

    withoutNA.forEach(v => {
      const num = Number(v);
      if (Number.isFinite(num)) numList.push({ v, num });
      else strList.push(v);
    });

    if (numList.length && strList.length === 0) {
      numList.sort((a, b) => a.num - b.num);
      const out = numList.map(x => x.v);
      if (hasNA) out.push("NA");
      return out;
    }

    strList.sort((a, b) => (counts[b] || 0) - (counts[a] || 0) || String(a).localeCompare(String(b)));
    numList.sort((a, b) => a.num - b.num);

    const out = numList.map(x => x.v).concat(strList);
    if (hasNA) out.push("NA");
    return out;
  }

  function getHeaderType(header, idx) {
    const meta = (window.DATA && window.DATA.META) || {};
    const low = String(header || "").toLowerCase();

    if (idx === 1) return "aux"; // PID always AUX

    const auxs = (meta.auxs || []).map(x => String(x).toLowerCase());
    const exts = (meta.exts || []).map(x => String(x).toLowerCase());
    const tags = (meta.tags || []).map(x => String(x).toLowerCase());
    const iqms = (meta.iqms || []).map(x => String(x).toLowerCase());

    if (auxs.includes(low)) return "aux";
    if (exts.includes(low)) return "ext";
    if (tags.includes(low)) return "tag";
    if (iqms.includes(low)) return "iqm";
    return null;
  }

  // ========= Always read HEADERS LIVE from DOM =========
  function findCategoricalColumns(rows) {
    const headers = Array.from(
      document.querySelectorAll("#tablehost thead th")
    ).map(th => th.textContent.trim());

    return headers
      .map((h, idx) => ({ h, idx }))
      .filter(({ h }) => {
        const low = h.toLowerCase();
        return low !== "p#" && !HIDDEN_HEADERS.has(low);
      })
      .map(({ h, idx }) => {
        const stats = getValueStats(rows, h);
        if (!isCategoricalByRule(stats)) return null;
        return {
          header: h,
          type: getHeaderType(h, idx),
          stats,
          orderedValues: orderCats(stats.distinct, stats.counts)
        };
      })
      .filter(Boolean);
  }

  // ========= Color by dropdown =========
  function ensureColorMenuHost() {
    const btn = $("#chartColor");
    if (!btn) return null;

    let host = document.getElementById("color-menu");
    if (!host) {
      host = document.createElement("div");
      host.id = "color-menu";
      host.className = "menu-drop";
      btn.parentNode.style.position = "relative";
      btn.parentNode.appendChild(host);
    }
    // Match menu width to the button
    const w = btn.offsetWidth;
    if (w && Number.isFinite(w)) {
      host.style.minWidth = `${w}px`;
      host.style.width = `${w}px`;
    }
    // Align the dropdown to the left edge of the button (not the label)
    const left = btn.offsetLeft;
    if (Number.isFinite(left)) {
      host.style.left = `${left}px`;
    }
    const top = btn.offsetTop + btn.offsetHeight;
    if (Number.isFinite(top)) {
      host.style.top = `${top}px`;
    }
    return host;
  }

  function setParticipantsColorBy() {
    const btn = $("#chartColor");

    if (btn) btn.textContent = "P#";
    // Use central applier so everything stays in sync
    if (window.RADQY && typeof window.RADQY.applyColorBy === "function") {
      window.RADQY.applyColorBy(null, ["Participants"]);
    }
  }

  function buildColorByMenu() {
    const data = window.DATA || {};
    const rows =
      (window.TABLE_STATE && Array.isArray(window.TABLE_STATE.rows))
        ? window.TABLE_STATE.rows
        : (Array.isArray(data.ROWS) ? data.ROWS : []);
    const btn = $("#chartColor");
    const host = ensureColorMenuHost();
    if (!btn || !host) return;

    // 🔹 Always read latest headers from DOM
    const headers = Array.from(
      document.querySelectorAll("#tablehost thead th")
    ).map(th => th.textContent.trim());

    host.innerHTML = "";

    // 🔹 Set live button label correctly
    if (window.VIEW_STATE?.colorBy && headers.includes(window.VIEW_STATE.colorBy)) {
      btn.textContent = window.VIEW_STATE.colorBy;
    } else {
      btn.textContent = "P#";
    }

    // ---- Add Participants (P#) option ----
    const pItem = document.createElement("button");
    pItem.type = "button";
    pItem.className = "menu-item item-participants";
    pItem.textContent = "P#";
    pItem.addEventListener("click", () => {
      host.classList.remove("is-open");
      setParticipantsColorBy();
    });
    host.appendChild(pItem);

    // ---- Detect categorical columns (LIVE) ----
    const cats = findCategoricalColumns(rows);
    cats.forEach(col => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "menu-item" + (col.type ? " item-" + col.type : "");
      item.textContent = col.header;

      item.addEventListener("click", () => {
        host.classList.remove("is-open");
        btn.textContent = col.header;

        // Delegate to central Color-by applier so all modules stay in sync
        if (window.RADQY && typeof window.RADQY.applyColorBy === "function") {
          window.RADQY.applyColorBy(col.header, col.orderedValues);
        }
      });

      host.appendChild(item);
    });
  }

  // ========= Button behavior =========
  function bindColorByButton() {
    const btn = $("#chartColor");
    const host = ensureColorMenuHost();
    if (!btn || !host) return;

    btn.addEventListener("click", ev => {
      ev.stopPropagation();
      ensureColorMenuHost(); // refresh width/position in case the button size changed
      document.getElementById("add-menu")?.classList.remove("is-open");
      document.getElementById("sb-metrics-menu")?.classList.remove("is-open");
      host.classList.toggle("is-open");
    });

    host.addEventListener("click", ev => ev.stopPropagation());
    document.addEventListener("click", () => host.classList.remove("is-open"));
  }

  // ========= Events =========
  document.addEventListener("radqy:data:ready", buildColorByMenu);
  document.addEventListener("radqy:table:updated", buildColorByMenu);
  document.addEventListener("radqy:columns:renamed", buildColorByMenu);

  document.addEventListener("radqy:view:columns", (e) => {
    HIDDEN_HEADERS = new Set((e?.detail?.hidden || []).map(x => x.toLowerCase()));
    if (window.VIEW_STATE.colorBy &&
        HIDDEN_HEADERS.has(window.VIEW_STATE.colorBy.toLowerCase())) {
      setParticipantsColorBy();
    }
    buildColorByMenu();
  });

  document.addEventListener("DOMContentLoaded", () => {
    bindColorByButton();
    if (window.DATA?.ROWS) buildColorByMenu();
  });
})();
