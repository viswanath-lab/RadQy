// legend.js — show TAG / IQM / AUX / EXT counts and N + Color-by breakdown
(function () {
  const $ = (s, r) => (r || document).querySelector(s);

  let CURRENT_COLORBY = { header: null };

  function swatchClass(idx, isParticipants) {
    if (isParticipants) return "swatch-cat1";
    const paletteOrder = [2, 3, 4, 5, 6];
    const n = paletteOrder[idx % paletteOrder.length];
    return "swatch-cat" + n;
  }

  function renderColorByLegend(cb, opts) {
    const selectedOnly = opts && opts.selectedOnly;
    if (!cb) return "";

    const items = cb.cats.map((cat, i) => {
      const total = (cb.totals && cb.totals[cat]) || 0;
      const sel   = (cb.selected && cb.selected[cat]) || 0;
      const base  = swatchClass(i, cb.isParticipants);
      const selCls = base + "-sel";

      // In normal mode, if total == selected (>0), hide the total box and keep only the selected box.
      const hideTotal = selectedOnly ? true : (sel > 0 && total === sel);

      const totalHtml = hideTotal
        ? ""
        : `<span class="legend-swatch legend-swatch-h ${base}">${total}</span>`;
      const selHtml = sel > 0
        ? `<span class="legend-swatch legend-swatch-h ${selCls}">${sel}</span>`
        : "";

      // If we are only showing selected counts and there is no selected box, skip this cat entirely
      if (selectedOnly && !selHtml) return "";

      return `
        <span class="legend-colorby-item">
          ${totalHtml}
          ${selHtml}
          <span>${cat}</span>
        </span>
      `;
    }).join("");

    return `
      <span class="legend-separator"></span>
      <span class="legend-colorby">${items}</span>
    `;
  }

  function getMeta() {
    if (!window.DATA) window.DATA = {};
    if (!window.DATA.META) {
      window.DATA.META = {
        N: 0, nTAG: 0, nIQM: 0, nAUX: 0, nEXT: 0,
        tags: [], iqms: [], auxs: [], exts: [], N_selected: 0
      };
    }
    return window.DATA.META;
  }

  function sumValues(obj) {
    let s = 0;
    if (!obj) return 0;
    for (const k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      const v = obj[k];
      if (typeof v === "number" && Number.isFinite(v)) s += v;
    }
    return s;
  }

  function getColorByBreakdown(meta) {
    const data = window.DATA || {};
    const rows = Array.isArray(data.ROWS) ? data.ROWS : [];
    if (!rows.length) return null;

    const metaHeader = meta && meta.colorByLegend ? meta.colorByLegend.header : null;
    const header = CURRENT_COLORBY.header || metaHeader;

    if (!header || header === "P#") {
      const Ntotal = meta.N != null ? meta.N : rows.length;
      const Nsel   = meta.N_selected || 0;
      return {
        cats: ["Participants"],
        totals:   { Participants: Ntotal },
        selected: { Participants: Nsel },
        isParticipants: true
      };
    }

    const pre = meta && meta.colorByLegend;
    if (pre && pre.header === header && pre.cats && pre.cats.length) {
      const filteredCats = pre.cats.filter(cat => (pre.totals?.[cat] || 0) > 0);
      if (!filteredCats.length) return null;
      return {
        cats: filteredCats,
        totals: pre.totals || {},
        selected: pre.selected || {},
        isParticipants: false
      };
    }


    const norm =
      (typeof window.normalizeCategoryValue === "function")
        ? window.normalizeCategoryValue
        : (_h, v) => {
            if (v == null) return "NA";
            const t = String(v).trim();
            return t === "" ? "NA" : t;
          };

    const selectedIdxs = new Set();
    document
      .querySelectorAll("#tablehost tbody tr.row-selected")
      .forEach(tr => {
        const idx = Number(tr.dataset.rowIndex || -1);
        if (idx >= 0) selectedIdxs.add(idx);
      });

    const totals   = {};
    const selected = {};

    rows.forEach((row, idx) => {
      const key = String(norm(header, row[header]));
      totals[key] = (totals[key] || 0) + 1;
      if (selectedIdxs.has(idx)) {
        selected[key] = (selected[key] || 0) + 1;
      }
    });

    let cats = Object.keys(totals);
    const vs = window.VIEW_STATE || {};
    const ordered = Array.isArray(vs.colorByCats) ? vs.colorByCats : null;
    if (ordered && ordered.length) {
      const present = new Set(cats.map(String));
      cats = ordered
        .map(v => String(v))
        .filter(v => present.has(v));
    }

    // 🔥 NEW: remove classes with ZERO total count
    cats = cats.filter(cat => totals[cat] > 0);

    if (!cats.length) return null;

    return {
      cats,
      totals,
      selected,
      isParticipants: false
    };
  }

  function renderLegend(meta) {
    const host = $("#legendhost");
    if (!host || !meta) return;

    const vis = (window.RADQY && window.RADQY._vis) || {};
    const maskOnlyMode =
      !vis.table && !vis.chart && !vis.umap &&
      (vis.image || vis.fgmask || vis.bgmask);

    const nTAG = meta.nTAG != null ? meta.nTAG : (meta.tags  ? meta.tags.length  : 0);
    const nIQM = meta.nIQM != null ? meta.nIQM : (meta.iqms  ? meta.iqms.length  : 0);
    const nAUX = meta.nAUX != null ? meta.nAUX : (meta.auxs  ? meta.auxs.length  : 0);
    const nEXT = meta.nEXT != null ? meta.nEXT : (meta.exts  ? meta.exts.length  : 0);
    const N    = meta.N    != null ? meta.N    : ((window.DATA && window.DATA.ROWS) ? window.DATA.ROWS.length : 0);

    // When only mask panels are visible, hide total-per-class boxes but keep selected boxes
    const cb = getColorByBreakdown(meta);
    const selectedOnly = maskOnlyMode;
    let totalN  = N;
    let totalSel = meta.N_selected || 0;
    let hasSelection = totalSel > 0;

    let colorByHtml = renderColorByLegend(cb);

    let middleSection = "";
    if (maskOnlyMode) {
      middleSection = totalSel > 0
        ? `
          <span class="legend-total duo-total">
            <span class="legend-swatch legend-swatch-h swatch-selected"><strong>n<sub>s</sub></strong>=${totalSel}</span>
          </span>
        `
        : "";
    } else {
      middleSection = `
        <span class="legend-total duo-total">
          <span class="legend-swatch legend-swatch-h swatch-total"><strong>n<sub>t</sub></strong>=${totalN}</span>
          ${totalSel > 0 ? `<span class="legend-swatch legend-swatch-h swatch-selected"><strong>n<sub>s</sub></strong>=${totalSel}</span>` : ""}
        </span>
      `;
    }

    host.innerHTML = `
      <div class="legend-row">
        ${maskOnlyMode ? "" : `
          <div class="legend-item">
            <span class="legend-swatch legend-swatch-tall swatch-aux">${nAUX}</span>
            <span class="legend-label">AUXs</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch legend-swatch-tall swatch-ext">${nEXT}</span>
            <span class="legend-label">EXTs</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch legend-swatch-tall swatch-tag">${nTAG}</span>
            <span class="legend-label">TAGs</span>
          </div>
          <div class="legend-item">
            <span class="legend-swatch legend-swatch-tall swatch-iqm">${nIQM}</span>
            <span class="legend-label">IQMs</span>
          </div>
          <span class="legend-separator"></span>
        `}
        ${middleSection}
        ${renderColorByLegend(cb, { selectedOnly })}
      </div>
    `;
  }

  function initialRender() {
    renderLegend(getMeta());
  }

  document.addEventListener("radqy:data:ready", initialRender);

  document.addEventListener("radqy:legend:update", (e) => {
    const meta = getMeta();
    const detail = (e && e.detail && e.detail.meta) ? e.detail.meta : {};
    Object.assign(meta, detail);
    renderLegend(meta);
  });

  document.addEventListener("radqy:colorby:changed", (e) => {
    if (!e || !e.detail) return;
    CURRENT_COLORBY.header = e.detail.header != null ? e.detail.header : null;
    renderLegend(getMeta());
  });

  // Re-render when panel visibility changes (e.g., table/chart/umap toggled off/on)
  document.addEventListener("radqy:panel-visibility-changed", () => {
    renderLegend(getMeta());
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (window.DATA && window.DATA.META) initialRender();
  });
})();
