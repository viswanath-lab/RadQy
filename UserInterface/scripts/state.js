// state.js — central app state (small + future-friendly)

window.RADQY = window.RADQY || {};

RADQY.visibility = {
  table:  true,
  chart:  true,
  umap:   true,
  image:  false,
  fgmask: false,
  bgmask: false,
  report: false
};

// Chart/UI state seeds
window.CHART_STATE = window.CHART_STATE || {
  visType: 'parallel_coordinate',
  sortBy:  null,
  measureBy: null,
  colorBy: null
};

window.VIEW_STATE = window.VIEW_STATE || {
  selectedRowKey: null,
  hiddenHeaders: new Set()
};

// 🔥 Always store currently selected participant IDs
window.selectedParticipant = null;
window.RADQY._selectedIndices = [];

// ------------------------------------------------------
// 🔥 Centralized selection handling — GLOBAL SOURCE OF TRUTH
// ------------------------------------------------------
window.RADQY.setSelectedRowIndices = function (idxs) {
  idxs = Array.isArray(idxs) ? idxs : [];
  window.RADQY._selectedIndices = idxs;

  // 🔥 Fire the universal selection change event
  document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
    detail: { count: idxs.length, indices: idxs }
  }));

  // optional: also refresh table row selection highlight
  if (window.RADQY._vis?.table && typeof window.RADQY.refreshTableSelection === "function") {
    RADQY.refreshTableSelection();
  }

  // Legacy event bus for listeners still on RADQY_EVENTS (indices only)
  if (window.RADQY_EVENTS && typeof window.RADQY_EVENTS.emitSelection === "function") {
    window.RADQY_EVENTS.emitSelection({ indices: idxs.slice() });
  }
};

// Optional helper to fetch selected IDs
window.RADQY.getSelectedRowIndices = function () {
  return window.RADQY._selectedIndices || [];
};

// expose PID parts helper
window.RADQY.getPidParts = function (idx) {
  if (!window.DATA || !Array.isArray(window.DATA.PID_PARTS)) return null;
  return window.DATA.PID_PARTS[idx] || null;
};

// ------------------------------------------------------
// Auto-show/hide image panel when selection changes
// plus build global selection details
// ------------------------------------------------------
function buildSelectionDetail(indices) {
  const DATA = window.DATA || {};
  const headers = Array.isArray(DATA.HEADERS) ? DATA.HEADERS : [];
  const rows    = Array.isArray(DATA.ROWS)    ? DATA.ROWS    : [];

  const lowerMap = {};
  headers.forEach((h, i) => {
    if (h == null) return;
    lowerMap[String(h).toLowerCase()] = i;
  });

  function idxOf(name) {
    const k = String(name || "").toLowerCase();
    return lowerMap[k] !== undefined ? lowerMap[k] : -1;
  }

  const pIdx   = idxOf("p#");
  const rowIdx = idxOf("row");
  const colIdx = idxOf("col");

  // try to match Participant (topfolder--subfolder--patient ID)
  let pidIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || "").toLowerCase();
    if (h.startsWith("participant (topfolder--subfolder--patient id")) {
      pidIndex = i;
      break;
    }
  }

  // color by state
  const view = window.VIEW_STATE || {};
  const colorByHeader =
    view.colorBy && headers.includes(view.colorBy) ? view.colorBy : null;

  const participants = [];

  indices.forEach(idx => {
    const r = rows[idx];
    if (!r) return;

    const pHeader   = pIdx   >= 0 ? headers[pIdx]   : null;
    const rowHeader = rowIdx >= 0 ? headers[rowIdx] : null;
    const colHeader = colIdx >= 0 ? headers[colIdx] : null;
    const pidHeader = pidIndex >= 0 ? headers[pidIndex] : null;

    const pVal   = pHeader   ? r[pHeader]   : null;
    const pidVal = pidHeader ? r[pidHeader] : null;

    let rowSize = rowHeader ? Number(r[rowHeader]) : NaN;
    let colSize = colHeader ? Number(r[colHeader]) : NaN;

    if (!Number.isFinite(rowSize) || !Number.isFinite(colSize)) {
      const sz = Array.isArray(DATA.IMAGE_SIZE) ? DATA.IMAGE_SIZE[idx] : null;
      if (sz) {
        if (!Number.isFinite(rowSize)) rowSize = sz.row;
        if (!Number.isFinite(colSize)) colSize = sz.col;
      }
    }

    let colorByValue = null;
    if (colorByHeader) {
      colorByValue = r[colorByHeader] != null ? r[colorByHeader] : null;
    } else {
      colorByValue = pVal != null ? pVal : "Participants";
    }

    let catIndex = 1;
    if (window.RADQY && typeof RADQY.getRowCategoryForIndex === "function") {
      catIndex = RADQY.getRowCategoryForIndex(idx) || 1;
    }

    participants.push({
      rowIndex: idx,
      pNumber: pVal,                  // value in P# column
      pid: pidVal,                    // Participant (topfolder--subfolder--patient ID)
      rowSize: Number.isFinite(rowSize) ? rowSize : null,
      colSize: Number.isFinite(colSize) ? colSize : null,
      colorIndex: catIndex,           // 1..6, maps to your CAT colors
      colorByHeader: colorByHeader || "P#",
      colorByValue: colorByValue
    });
  });

  const primary = participants.length ? participants[0] : null;

  const detail = {
    indices,
    participants,
    primary,
    colorByHeader: (window.VIEW_STATE && window.VIEW_STATE.colorBy) || "P#"
  };

  // cache globally if needed
  window.RADQY_SELECTION = detail;

  return detail;
}

document.addEventListener("radqy:selection-changed", (e) => {
  const count = e.detail?.count || 0;

  let indices = [];
  if (Array.isArray(e.detail?.indices)) {
    indices = e.detail.indices;
  } else if (Array.isArray(e.detail?.selectedIndices)) {
    indices = e.detail.selectedIndices;
  }

  // keep global selection indices in sync for other listeners
  window.RADQY._selectedIndices = indices.slice();

  const hasSelection = count > 0;

  // Auto-toggle Image panel only (FG/BG masks only if available)
  const maskVis = window.RADQY_MASK_VIS || { img: true, fg: true, bg: true };
  const meta = window.DATA?.META || {};

  // If a new selection arrives and all three toggles are off, auto-enable available channels
  const allOff =
    (maskVis.img === false) &&
    (!(meta.save_fg || meta.save_fgbg) || maskVis.fg === false) &&
    (!(meta.save_bg || meta.save_fgbg) || maskVis.bg === false);
  if (hasSelection && allOff) {
    maskVis.img = true;
    if (meta.save_fg || meta.save_fgbg) maskVis.fg = true;
    if (meta.save_bg || meta.save_fgbg) maskVis.bg = true;
  }
  const anyMaskOn =
    (maskVis.img !== false) ||
    ((meta.save_fg || meta.save_fgbg) && maskVis.fg !== false) ||
    ((meta.save_bg || meta.save_fgbg) && maskVis.bg !== false);

  RADQY.visibility.image = hasSelection && anyMaskOn;
  RADQY.visibility.fgmask = hasSelection && (meta.save_fg || meta.save_fgbg) && maskVis.fg !== false;
  RADQY.visibility.bgmask = hasSelection && (meta.save_bg || meta.save_fgbg) && maskVis.bg !== false;

  // Sync mask visibility toggles with selection: if no selection, turn all off; otherwise respect current toggles
  window.RADQY_MASK_VIS = window.RADQY_MASK_VIS || { img: true, fg: true, bg: true };
  if (!hasSelection) {
    window.RADQY_MASK_VIS.img = false;
    if (meta.save_fg || meta.save_fgbg) window.RADQY_MASK_VIS.fg = false;
    if (meta.save_bg || meta.save_fgbg) window.RADQY_MASK_VIS.bg = false;
  }

  // Mirror into persistent visibility map
  RADQY._vis = RADQY._vis || {};
  RADQY._vis.image = RADQY.visibility.image;
  RADQY._vis.fgmask = RADQY.visibility.fgmask;
  RADQY._vis.bgmask = RADQY.visibility.bgmask;
  if (typeof RADQY._write === "function") {
    RADQY._write(RADQY._vis);
  }

  document.dispatchEvent(new CustomEvent("radqy:panel-visibility-changed", {
    detail: { visibility: RADQY.visibility }
  }));

  // Apply actual panel visibility when available
  if (typeof RADQY.applyVisibility === "function") {
    RADQY.applyVisibility();
  }

  // 🔥 NEW: build rich selection payload for all listeners
  const detail = buildSelectionDetail(indices);

  document.dispatchEvent(new CustomEvent("radqy:selection:detail", {
    detail
  }));

  // 🔥 Maintain backward compatible participant event
  if (detail.primary) {
    document.dispatchEvent(new CustomEvent("radqy:participant:selected", {
      detail: {
        participantId: detail.primary.pNumber || detail.primary.pid || null,
        primary: detail.primary,
        all: detail.participants
      }
    }));
  } else {
    document.dispatchEvent(new CustomEvent("radqy:participant:selected", {
      detail: {
        participantId: null,
        primary: null,
        all: []
      }
    }));
  }
});


// ------------------------------------------------------
// When mask toggles change, hide panels if all are off
// ------------------------------------------------------
document.addEventListener("radqy:masks-changed", (e) => {
  const detail = e.detail || window.RADQY_MASK_VIS || {};
  const imgOn = detail.img !== false;
  const fgOn  = detail.fg !== false;
  const bgOn  = detail.bg !== false;

  const hasSelectionMask = (window.RADQY._selectedIndices || []).length > 0;
  const metaMask = window.DATA?.META || {};

  const anyMaskOn =
    imgOn ||
    ((metaMask.save_fg || metaMask.save_fgbg) && fgOn) ||
    ((metaMask.save_bg || metaMask.save_fgbg) && bgOn);

  RADQY.visibility.image  = hasSelectionMask && anyMaskOn;
  RADQY.visibility.fgmask = hasSelectionMask && (metaMask.save_fg || metaMask.save_fgbg) && fgOn;
  RADQY.visibility.bgmask = hasSelectionMask && (metaMask.save_bg || metaMask.save_fgbg) && bgOn;

  RADQY._vis = RADQY._vis || {};
  RADQY._vis.image  = RADQY.visibility.image;
  RADQY._vis.fgmask = RADQY.visibility.fgmask;
  RADQY._vis.bgmask = RADQY.visibility.bgmask;
  if (typeof RADQY._write === "function") RADQY._write(RADQY._vis);

  if (typeof RADQY.applyVisibility === "function") {
    RADQY.applyVisibility();
  }
});

// ------------------------------------------------------
// Still keep your existing participant tracking if needed
// ------------------------------------------------------
document.addEventListener("radqy:participant:selected", (e) => {
  window.selectedParticipant = e.detail.participantId;
});
