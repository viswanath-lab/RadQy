// ===============================
// Boot-time UI seeds (placeholder + chart defaults)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.RADQY_CONFIG || {};

  const opt = document.getElementById("customsel");
  if (opt && cfg.customSelectionExample) {
    opt.placeholder = "Custom Selection e.g. " + cfg.customSelectionExample;
  }

  const cdef = cfg.chartDefaults || {};
  const bSort    = document.getElementById("chartSort");
  const bMeasure = document.getElementById("chartMeasure");
  const bColor   = document.getElementById("chartColor");

  if (bSort && cdef.sortBy)       bSort.textContent    = cdef.sortBy;
  if (bMeasure && cdef.measureBy) bMeasure.textContent = cdef.measureBy;
  if (bColor && cdef.colorBy)     bColor.textContent   = cdef.colorBy;

  if (window.CHART_STATE) {
    if (cdef.sortBy)    window.CHART_STATE.sortBy    = cdef.sortBy;
    if (cdef.measureBy) {
      window.CHART_STATE.measureBy     = cdef.measureBy;
      window.CHART_STATE.currentMetric = cdef.measureBy;
    }
    if (cdef.colorBy)   window.CHART_STATE.colorBy   = cdef.colorBy;
  }
});

// Recompute visibility for image/fg/bg based on selection + toggles
function RADQY_recomputeImagePanels() {
  const meta = window.DATA?.META || {};
  const maskVis = window.RADQY_MASK_VIS || { img: true, fg: true, bg: true };
  const hasSelection =
    Array.isArray(window.RADQY?._selectedIndices) &&
    window.RADQY._selectedIndices.length > 0;

  const anyMaskOn =
    (maskVis.img !== false) ||
    ((meta.save_fg || meta.save_fgbg) && maskVis.fg !== false) ||
    ((meta.save_bg || meta.save_fgbg) && maskVis.bg !== false);

  RADQY._vis = RADQY._vis || {};
  RADQY._vis.image  = hasSelection && anyMaskOn;
  RADQY._vis.fgmask = hasSelection && (meta.save_fg || meta.save_fgbg) && maskVis.fg !== false;
  RADQY._vis.bgmask = hasSelection && (meta.save_bg || meta.save_fgbg) && maskVis.bg !== false;
}

// Keep image/fg/bg panels in sync on selection and mask toggle changes
document.addEventListener("radqy:selection-changed", (e) => {
  const indices = Array.isArray(e?.detail?.indices) ? e.detail.indices : [];
  RADQY_recomputeImagePanels();
  RADQY.applyVisibility();
  // notify image/others with selection detail (used by image panel)
  document.dispatchEvent(new CustomEvent("radqy:selection:detail", {
    detail: { indices }
  }));
});

document.addEventListener("radqy:masks-changed", () => {
  RADQY_recomputeImagePanels();
  RADQY.applyVisibility();
});

// ===============================
// RADQY visibility manager
// ===============================
window.RADQY = window.RADQY || {};

RADQY.MAIN   = ["table", "chart", "umap", "image", "fgmask", "bgmask"];
RADQY.PANELS = RADQY.MAIN.concat("report");

RADQY._STORAGE_KEY = "radqy_panel_visibility";
RADQY._DEFAULT_VIS = {
  table:  true,
  chart:  true,
  umap:   true,
  image:  false,
  fgmask: false,
  bgmask: false,
  report: false
};

RADQY.getPanelEl = function (name) {
  return document.getElementById("panel" + name);
};
RADQY.getBtnEl = function (name) {
  return document.getElementById("btn" + name);
};

RADQY._read = function () {
  try {
    const raw = localStorage.getItem(RADQY._STORAGE_KEY);
    const obj = raw ? JSON.parse(raw) : Object.assign({}, RADQY._DEFAULT_VIS);
    RADQY.PANELS.forEach(function (k) {
      if (!(k in obj)) obj[k] = !!RADQY._DEFAULT_VIS[k];
    });
    return obj;
  } catch (e) {
    return Object.assign({}, RADQY._DEFAULT_VIS);
  }
};

RADQY._write = function (map) {
  try {
    localStorage.setItem(RADQY._STORAGE_KEY, JSON.stringify(map));
  } catch (e) {}
};

RADQY._vis = RADQY._read();

// any non-report panel on?
RADQY.isAnyNonReportOn = function () {
  return RADQY.MAIN.some(n => !!RADQY._vis[n] && n !== "report");
};

// update OPT + LEGEND row
RADQY.updateAuxPanels = function () {
  const optEl    = document.getElementById("panelopt");
  const legendEl = document.getElementById("panellegend");
  const rowWrap  = document.querySelector(".panelrow-two");

  if (optEl) {
    const anyOfMain = RADQY._vis.table || RADQY._vis.chart || RADQY._vis.umap;
    optEl.hidden = !anyOfMain;
  }

  if (legendEl) {
    const anyLegendOn =
      RADQY._vis.table ||
      RADQY._vis.chart ||
      RADQY._vis.umap  ||
      RADQY._vis.image ||
      RADQY._vis.fgmask||
      RADQY._vis.bgmask;

    legendEl.hidden = !anyLegendOn;
  }

  if (rowWrap) {
    rowWrap.style.display =
      (optEl?.hidden && legendEl?.hidden) ? "none" : "";
  }
};

// ===============================
// Report confirmation banner + lock
// ===============================
window.RADQY_REPORT_LOCK = false;

function showReportConfirmationBanner() {
  const banner = document.getElementById("report-open-banner");
  if (!banner) return;

  const cfg = window.RADQY_CONFIG || {};
  const textEl = document.getElementById("report-open-text");
  if (textEl) {
    textEl.textContent =
      cfg.reportConfirmText ||
      "QC review looks complete. Would you like to open the AI Report?";
  }

  banner.style.display = "flex";

  const yesBtn = document.getElementById("report-open-yes");
  const noBtn  = document.getElementById("report-open-no");

  if (yesBtn) {
    yesBtn.onclick = function () {
      window.RADQY_REPORT_LOCK = false;
      banner.style.display = "none";
      RADQY._vis.report = true;
      RADQY._write(RADQY._vis);
      RADQY.applyVisibility();
    };
  }

  if (noBtn) {
    noBtn.onclick = function () {
      window.RADQY_REPORT_LOCK = false;
      banner.style.display = "none";
      RADQY._vis.report = false;
      RADQY._write(RADQY._vis);
      RADQY.applyVisibility();
    };
  }
}

// ===============================
// Apply visibility + split layout
// ===============================
RADQY.applyVisibility = function () {
  RADQY.MAIN.forEach(function (name) {
    const el  = RADQY.getPanelEl(name);
    const btn = RADQY.getBtnEl(name);
    if (el)  el.hidden = !RADQY._vis[name];
    if (btn) btn.classList.toggle("btnon", !!RADQY._vis[name]);
  });

  const repEl  = RADQY.getPanelEl("report");
  const repBtn = RADQY.getBtnEl("report");
  if (repEl)  repEl.hidden = !RADQY._vis.report;
  if (repBtn) repBtn.classList.toggle("btnon", !!RADQY._vis.report);

  const split = RADQY._vis.report && RADQY.isAnyNonReportOn();
  document.body.classList.toggle("layout-report-split", split);

  RADQY.updateAuxPanels();

  // Notify listeners (e.g., legend) of current visibility
  document.dispatchEvent(new CustomEvent("radqy:panel-visibility-changed", {
    detail: { visibility: { ...RADQY._vis } }
  }));

  // If chart panel just became visible, ensure it rerenders at full size
  if (RADQY._vis.chart && typeof window.renderChartsView === "function") {
    window.renderChartsView();
  }
};

// ===============================
// Public toggles
// ===============================
RADQY.togglePanel = function (name, force) {
  if (RADQY.MAIN.indexOf(name) === -1) return;
  if (window.RADQY_REPORT_LOCK) return;

  RADQY._vis[name] = (typeof force === "boolean") ? force : !RADQY._vis[name];
  RADQY._write(RADQY._vis);
  RADQY.applyVisibility();
};

RADQY.toggleReport = function () {
  const willOpen = !RADQY._vis.report;
  if (willOpen) {
    window.RADQY_REPORT_LOCK = true;
    showReportConfirmationBanner();
  } else {
    window.RADQY_REPORT_LOCK = false;
    RADQY._vis.report = false;
    RADQY._write(RADQY._vis);
    RADQY.applyVisibility();
  }
};

// ===============================
// Listen to central selection-change event
// ===============================
document.addEventListener("radqy:selection-changed", (e) => {
  const hasSelection = e.detail?.count > 0;
  const meta = window.DATA?.META || {};
  const maskVis = window.RADQY_MASK_VIS || { img: true, fg: true, bg: true };
  const anyMaskOn =
    (maskVis.img !== false) ||
    ((meta.save_fg || meta.save_fgbg) && maskVis.fg !== false) ||
    ((meta.save_bg || meta.save_fgbg) && maskVis.bg !== false);

  // Auto-toggle panels based on selection + mask toggles
  RADQY._vis.image  = hasSelection && anyMaskOn;
  RADQY._vis.fgmask = hasSelection && (meta.save_fg || meta.save_fgbg) && maskVis.fg !== false;
  RADQY._vis.bgmask = hasSelection && (meta.save_bg || meta.save_fgbg) && maskVis.bg !== false;

  RADQY._write(RADQY._vis);
  RADQY.applyVisibility();
});

// ===============================
// Build split layout for report
// ===============================
document.addEventListener("DOMContentLoaded", function () {
  const grid = document.querySelector(".grid");
  if (!grid) return;
  if (grid.querySelector(".col-left")) return;

  const report = document.getElementById("panelreport");
  if (!report) return;

  const left = document.createElement("div");
  left.className = "col-left";

  const children = Array.from(grid.children);
  children.forEach(function (el) {
    if (el === report) return;
    left.appendChild(el);
  });

  grid.insertBefore(left, report);
});

// ===============================
// Splash / data-ready boot logic
// ===============================
(function () {
  function aliasIdsForDataJS() {
    const splash = document.getElementById("splash");
    if (splash && !document.getElementById("upload-section")) {
      splash.id = "upload-section";
    }

    const meta = document.getElementById("infometa");
    if (meta && !document.getElementById("meta-info")) {
      meta.id = "meta-info";
    }
  }

  function boot() {
    aliasIdsForDataJS();

    document.addEventListener("radqy:data:ready", function () {
      RADQY._vis = Object.assign({}, RADQY._DEFAULT_VIS);
      RADQY._write(RADQY._vis);
      RADQY.applyVisibility();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

// ===============================
// Global click guard for report lock
// ===============================
document.addEventListener("click", function (e) {
  if (!window.RADQY_REPORT_LOCK) return;
  if (e.target.closest("#report-open-banner")) return;
  if (e.target.closest("#btnreset")) return;

  e.stopPropagation();
  e.preventDefault();

  const banner = document.getElementById("report-open-banner");
  if (!banner) return;

  banner.classList.add("shake");
  setTimeout(() => banner.classList.remove("shake"), 300);
}, true);
