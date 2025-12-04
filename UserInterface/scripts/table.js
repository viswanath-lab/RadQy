// table.js — render results.tsv into the Table panel with AUX / EXT add menu
(function () {
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function emitHover(caseName, on, rowIndex) {
    const detail = { caseName, on: !!on };
    if (Number.isFinite(rowIndex)) detail.rowIndex = rowIndex;

    try {
      document.dispatchEvent(new CustomEvent("radqy:hover:change", { detail }));
    } catch (e) {}

    if (window.RADQY_EVENTS && typeof window.RADQY_EVENTS.emitHover === "function") {
      window.RADQY_EVENTS.emitHover(detail);
    }
  }

  // allow external sort requests (e.g., from BAR sort dropdown)
  document.addEventListener("radqy:sort:change", function(e){
    var det = e && e.detail ? e.detail : {};
    var col = det.col;
    var asc = (det.ascending === undefined) ? true : !!det.ascending;
    if (!col) return;
    var idx = TABLE_STATE.headers ? TABLE_STATE.headers.indexOf(col) : -1;
    if (idx < 0) return;
    TABLE_SORT.colIndex = idx;
    TABLE_SORT.ascending = asc;
    sortRowsByColumn(idx);
  });

  function getCaseNameForRow(rowIdx) {
    const headers = TABLE_STATE.headers || [];
    const rows = TABLE_STATE.rows || [];
    const row = rows[rowIdx];
    if (!row) return String(rowIdx);

    const participantHeader = headers.find(h => /^Participant\b/i.test(String(h || "")));
    if (participantHeader && row[participantHeader] != null) {
      return String(row[participantHeader]);
    }
    return String(rowIdx);
  }

  let TABLE_STATE = {
    headers: [],
    rows: [],
    selectedIds: new Set(),
    rowCats: [],
    tableBody: null
  };

  // Apply Color-by selection globally (table rows, legend, images)
  window.RADQY = window.RADQY || {};
  window.RADQY.applyColorBy = function(header, categories){
    header = header || null;
    categories = Array.isArray(categories) ? categories : [];

    // default back to participants when header is cleared
    if (!header || !categories.length) {
      categories = ["Participants"];
    }

    if (!window.VIEW_STATE) window.VIEW_STATE = {};
    window.VIEW_STATE.colorBy = header;
    window.VIEW_STATE.colorByCats = categories.slice();

    // Apply new categories immediately using the provided ordered list,
    // then rebuild the table (preserving selection) so data-cat stays correct.
    setRowCatsFrom(header, categories);
    renderTable(true); // preserve current selection and reapply cat styling

    const map = window.VIEW_STATE.colorByMap || null;
    const mapEntries = map ? Array.from(map.entries()) : null;

    // notify other modules (pcp/bar/legend/image) once
    document.dispatchEvent(new CustomEvent("radqy:colorby:changed", {
      detail: { header, categories, catMap: mapEntries }
    }));

    // Legacy bus
    if (window.RADQY_EVENTS && typeof window.RADQY_EVENTS.emitColorBy === "function") {
      window.RADQY_EVENTS.emitColorBy({ header, categories, catMap: mapEntries });
    }
  };

  let TABLE_SORT = {
    colIndex: null,
    ascending: true
  };

  let EXT_INPUT = null;

  function getHiddenHeadersSet() {
    if (!window.VIEW_STATE) {
      window.VIEW_STATE = { selectedRowKey: null, hiddenHeaders: new Set() };
    }
    if (!window.VIEW_STATE.hiddenHeaders) {
      window.VIEW_STATE.hiddenHeaders = new Set();
    }
    return window.VIEW_STATE.hiddenHeaders;
  }

  function logSafe(action, payload) {
    if (window.RADQY && typeof RADQY.log === "function") {
      RADQY.log(action, payload || {});
    }
  }

  function isNumeric(val) {
    if (val === null || val === undefined) return false;
    const s = String(val).trim();
    if (!s) return false;
    return !isNaN(Number(s));
  }

  // Decide which header belongs to TAG / IQM / AUX / EXT
  function getHeaderCategory(h, idx) {
    const name = String(h || "").trim();
    const low  = name.toLowerCase();

    if (low === "p#") return null; // first column – no color

    const meta = (window.DATA && window.DATA.META) || {};
    const tags = new Set((meta.tags || []).map(x => String(x).toLowerCase()));
    const iqms = new Set((meta.iqms || []).map(x => String(x).toLowerCase()));
    const exts = new Set((meta.exts || []).map(x => String(x).toLowerCase()));
    const auxs = new Set((meta.auxs || []).map(x => String(x).toLowerCase()));

    // second column is the main AUX (PID)
    if (idx === 1) return "col-aux";
    if (auxs.has(low)) return "col-aux";
    if (tags.has(low)) return "col-tag";
    if (iqms.has(low)) return "col-iqm";
    if (exts.has(low)) return "col-ext";

    return null;
  }

  // Per-class info for current Color-by (used by legend)
  function computeColorByLegend(headers, rows) {
    if (!window.VIEW_STATE || !window.VIEW_STATE.colorBy || !window.VIEW_STATE.colorByCats) {
      return null;
    }

    const header = window.VIEW_STATE.colorBy;
    const cats   = window.VIEW_STATE.colorByCats;

    const colIdx = headers.indexOf(header);
    if (colIdx === -1) return null;

    const norm =
      (typeof window.normalizeCategoryValue === "function")
        ? window.normalizeCategoryValue
        : (_h, v) => {
            if (v == null) return "NA";
            const t = String(v).trim();
            return t === "" ? "NA" : t;
          };

    const totals   = {};
    const selected = {};
    const selIds   = TABLE_STATE.selectedIds || new Set();

    rows.forEach((row, idx) => {
      const raw = row[header];
      const key = norm(header, raw);
      totals[key] = (totals[key] || 0) + 1;
      if (selIds.has(idx)) {
        selected[key] = (selected[key] || 0) + 1;
      }
    });

    return { header, cats, totals, selected };
  }

  // Count TAG / IQM / AUX / EXT columns + N participants, send to legend
  function updateMetaCounts(headers, rows) {
    const meta = (window.DATA && window.DATA.META) || null;
    if (!meta) return;

    const hidden = getHiddenHeadersSet();
    const nParticipants = rows.length;

    let nTag = 0;
    let nAux = 0;
    let nExt = 0;
    let nIqm = 0;

    headers.forEach((h, idx) => {
      const key = String(h || "").toLowerCase();
      if (hidden.has(key)) return;  // skip hidden metrics

      const cat = getHeaderCategory(h, idx);
      if (cat === "col-aux") nAux++;
      else if (cat === "col-tag") nTag++;
      else if (cat === "col-ext") nExt++;
      else if (cat === "col-iqm") nIqm++;
    });

    meta.N    = nParticipants;
    meta.nTAG = nTag;
    meta.nAUX = nAux;
    meta.nEXT = nExt;
    meta.nIQM = nIqm;

    meta.N_selected = TABLE_STATE.selectedIds
      ? TABLE_STATE.selectedIds.size
      : 0;

    // per-class info for current Color by
    meta.colorByLegend = computeColorByLegend(headers, rows);

    document.dispatchEvent(
      new CustomEvent("radqy:legend:update", {
        detail: {
          meta: {
            N:          meta.N,
            nTAG:       meta.nTAG,
            nIQM:       meta.nIQM,
            nAUX:       meta.nAUX,
            nEXT:       meta.nEXT,
            N_selected: meta.N_selected,
            colorByLegend: meta.colorByLegend
          }
        }
      })
    );
  }

  // Global color-by snapshot for other modules
  function updateColorState(header, orderedCats, map) {
    window.RADQY_COLOR = {
      header: header || null,
      categories: Array.isArray(orderedCats) ? orderedCats.slice() : [],
      map: map ? new Map(map) : null,
      defaultCat: 1
    };
  }

  function normalizeCatValue(v) {
    if (v == null) return "NA";
    const t = String(v).trim();
    return t === "" ? "NA" : t;
  }

  // Recompute rowCats from current Color-by selection (VIEW_STATE)
  function recomputeRowCatsFromColorBy() {
    const rows = TABLE_STATE.rows || [];
    const colorBy = window.VIEW_STATE?.colorBy;
    let ordered = window.VIEW_STATE?.colorByCats;

    // Fallback to META colorByLegend if menu state is missing
    if ((!ordered || !ordered.length) && window.DATA?.META?.colorByLegend) {
      const cbl = window.DATA.META.colorByLegend;
      if (cbl.header === colorBy && Array.isArray(cbl.cats) && cbl.cats.length) {
        ordered = cbl.cats.slice();
      }
    }

    // Last resort: derive up to 5 most common distinct values
    if ((!ordered || !ordered.length) && colorBy) {
      const counts = {};
      rows.forEach(r => {
        const key = normalizeCatValue(r ? r[colorBy] : null);
        counts[key] = (counts[key] || 0) + 1;
      });
      ordered = Object.keys(counts)
        .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
        .slice(0, 5);
    }

    if (!colorBy || !Array.isArray(ordered) || !ordered.length) {
      setColorByMap(null, null);
      TABLE_STATE.rowCats = new Array(rows.length).fill(1);
      return;
    }
    const catMap = new Map(
      ordered.map((v, i) => [normalizeCatValue(v), ((i % 5) + 2)]) // cat2..cat6 palette, cat1 reserved
    );
    setColorByMap(colorBy, ordered);
    TABLE_STATE.rowCats = rows.map(r => {
      const key = normalizeCatValue(r ? r[colorBy] : null);
      return catMap.get(key) || 1;
    });
  }

  // persist Color-by mapping so other panels (image, legends) can mirror colors
  function setColorByMap(header, orderedCats) {
    if (!window.VIEW_STATE) window.VIEW_STATE = {};
    let map = null;

    if (header && Array.isArray(orderedCats) && orderedCats.length) {
      map = new Map(
        orderedCats.map((v, i) => [normalizeCatValue(v), ((i % 5) + 2)])
      );
      window.VIEW_STATE.colorByMap = map;
    } else {
      window.VIEW_STATE.colorByMap = null;
    }

    const catsForState =
      header && Array.isArray(orderedCats) && orderedCats.length
        ? orderedCats
        : ["Participants"];

    updateColorState(header, catsForState, map);
  }

  // Directly set rowCats from a Color-by header + ordered categories
  function setRowCatsFrom(header, orderedCats) {
    const rows = TABLE_STATE.rows || [];
    const cats = new Array(rows.length).fill(1);
    if (header && Array.isArray(orderedCats) && orderedCats.length) {
      const catMap = new Map(
        orderedCats.map((v, i) => [normalizeCatValue(v), ((i % 5) + 2)]) // cat2..cat6 palette
      );
      rows.forEach((r, i) => {
        const key = normalizeCatValue(r ? r[header] : null);
        cats[i] = catMap.get(key) || 1;
      });
      setColorByMap(header, orderedCats);
    } else {
      setColorByMap(null, null);
    }
    TABLE_STATE.rowCats = cats;
    applyRowCatsToDom();
  }

  // Apply TABLE_STATE.rowCats to DOM rows (data-cat for styling)
  function applyRowCatsToDom() {
    const tbody = $("#tablehost tbody");
    if (!tbody || !TABLE_STATE.rowCats) return;
    $$("tr", tbody).forEach(tr => {
      const idx = Number(tr.dataset.rowIndex || -1);
      const cat = TABLE_STATE.rowCats[idx] || 1;
      tr.dataset.cat = String(cat);
    });
  }

  // --------- helpers to sync back into global DATA ---------
  function syncBackToDATA() {
    if (!window.DATA) window.DATA = {};
    window.DATA.HEADERS = TABLE_STATE.headers;
    window.DATA.ROWS    = TABLE_STATE.rows;

    window.DATA.META = window.DATA.META || {
      N: 0, nTAG: 0, nIQM: 0, nAUX: 0, nEXT: 0,
      tags: [], iqms: [], auxs: [], exts: []
    };
  }

  // ---------- AUX editing helpers ----------

  function ensureMetaLists() {
    if (!window.DATA) window.DATA = {};
    if (!window.DATA.META) {
      window.DATA.META = {
        N: 0,
        nTAG: 0,
        nIQM: 0,
        nAUX: 0,
        nEXT: 0,
        tags: [],
        iqms: [],
        auxs: [],
        exts: []
      };
    } else {
      const m = window.DATA.META;
      m.tags = m.tags || [];
      m.iqms = m.iqms || [];
      m.auxs = m.auxs || [];
      m.exts = m.exts || [];
    }
    return window.DATA.META;
  }

  function handleAuxHeaderEdit(colIdx, thEl) {
  const oldName = TABLE_STATE.headers[colIdx];
  let newName = thEl.textContent.trim();

  if (!newName) {
    thEl.textContent = oldName;
    return;
  }
  if (newName === oldName) return;

  if (TABLE_STATE.headers.includes(newName)) {
    alert("A column with this name already exists.");
    thEl.textContent = oldName;
    return;
  }

  TABLE_STATE.headers[colIdx] = newName;

  TABLE_STATE.rows.forEach(row => {
    row[newName] =
      row[oldName] === "" || row[oldName] === undefined
        ? "NA"
        : row[oldName];
    delete row[oldName];
  });

  const meta = ensureMetaLists();
  meta.auxs = meta.auxs.map(x =>
    String(x).toLowerCase() === String(oldName).toLowerCase()
      ? newName.toLowerCase()
      : x
  );

  const hs = getHiddenHeadersSet();
  if (hs.has(oldName.toLowerCase())) {
    hs.delete(oldName.toLowerCase());
    hs.add(newName.toLowerCase());
  }

  syncBackToDATA();

  document.dispatchEvent(
    new CustomEvent("radqy:table:updated", {
      detail: { headers: TABLE_STATE.headers, rows: TABLE_STATE.rows }
    })
  );

  updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);

  // 🔥 NEW: Immediately refresh Metrics dropdown with new header name
  buildMetricsMenu(TABLE_STATE.headers);

  logSafe("table_aux_header_rename", { from: oldName, to: newName });
}



  function handleAuxCellEdit(rowIdx, colIdx, tdEl) {
  const headers = TABLE_STATE.headers;
  const h = headers[colIdx];
  const row = TABLE_STATE.rows[rowIdx];
  if (!row) return;

  // normalize empty values to "NA"
  let val = tdEl.textContent.trim();
  if (val === "" || val === null || val === undefined) {
    val = "NA";
  }

  // save back to DATA
  row[h] = val;
  syncBackToDATA();

  // 🔥 Immediately refresh legend + colorby classes
  updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);

  document.dispatchEvent(new CustomEvent("radqy:table:updated", {
    detail: { headers: TABLE_STATE.headers, rows: TABLE_STATE.rows }
  }));
}



  // ---------- sorting (keep selection) ----------

  function sortRowsByColumn(colIdx) {
    const headers = TABLE_STATE.headers || [];
    const rows    = TABLE_STATE.rows || [];
    const rowCats = TABLE_STATE.rowCats || [];
    const rawRows = (window.DATA && window.DATA.RAW_ROWS) || null;
    const images  = (window.DATA && window.DATA.IMAGES) || null;
    const imgSize = (window.DATA && window.DATA.IMAGE_SIZE) || null;

    const header = headers[colIdx];
    if (!header) return;

    const idxs = rows.map((_, i) => i);

    idxs.sort((i, j) => {
      const a = rows[i][header];
      const b = rows[j][header];

      const aNum = isNumeric(a);
      const bNum = isNumeric(b);

      let cmp = 0;
      if (aNum && bNum) {
        const na = Number(a);
        const nb = Number(b);
        if (na < nb) cmp = -1;
        else if (na > nb) cmp = 1;
        else cmp = 0;
      } else {
        const sa = a == null ? "" : String(a);
        const sb = b == null ? "" : String(b);
        cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
      }

      if (!TABLE_SORT.ascending) cmp = -cmp;
      return cmp;
    });

    const newRows = [];
    const newCats = [];
    const newRawRows = [];
    const newImages  = [];
    const newImgSize = [];
    idxs.forEach(i => {
      newRows.push(rows[i]);
      newCats.push(rowCats[i] != null ? rowCats[i] : 1);
      if (rawRows) newRawRows.push(rawRows[i]);
      if (images)  newImages.push(images[i]);
      if (imgSize) newImgSize.push(imgSize[i]);
    });

    // remap selected indices: old index → new index
    const oldSelected = TABLE_STATE.selectedIds || new Set();
    const newSelected = new Set();
    idxs.forEach((oldIdx, newIdx) => {
      if (oldSelected.has(oldIdx)) {
        newSelected.add(newIdx);
      }
    });

    TABLE_STATE.rows       = newRows;
    TABLE_STATE.rowCats    = newCats;
    TABLE_STATE.selectedIds = newSelected;

    // Keep global DATA in the same order as the table for image + mask lookup
    if (window.DATA) {
      window.DATA.ROWS = newRows;
      if (newRawRows.length) window.DATA.RAW_ROWS = newRawRows;
      if (newImages.length)  window.DATA.IMAGES   = newImages;
      if (newImgSize.length) window.DATA.IMAGE_SIZE = newImgSize;
    }

    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);

    renderTable(true); // preserve selection

    // Notify other modules (image panel, etc.) that the table order changed
    document.dispatchEvent(new CustomEvent("radqy:table:sorted", {
      detail: {
        order: idxs.slice(),          // old index → new position
        ascending: TABLE_SORT.ascending,
        col: header
      }
    }));
  }

  function handleHeaderSort(colIdx) {
    if (TABLE_SORT.colIndex === colIdx) {
      TABLE_SORT.ascending = !TABLE_SORT.ascending;
    } else {
      TABLE_SORT.colIndex = colIdx;
      TABLE_SORT.ascending = true;
    }
    sortRowsByColumn(colIdx);
  }

  // ---------- table building ----------

  function buildTableElement(headers, rows) {
    const table = document.createElement("table");
    table.className = "radqy-table";

    // compute category per header once
    const headerCats = headers.map((h, idx) => getHeaderCategory(h, idx));

    // header
    const thead = document.createElement("thead");
    const hr   = document.createElement("tr");
    headers.forEach((h, idx) => {
      const th = document.createElement("th");
      th.textContent = h;
      const catClass = headerCats[idx];
      if (catClass) th.classList.add(catClass);

      th.dataset.colIndex = String(idx);

      let isEditableAux = false;

      if (catClass === "col-aux" && idx !== 1) {
        isEditableAux = true;
        th.classList.add("editable-aux-header");
        th.contentEditable = "true";

        th.addEventListener("click", ev => {
          ev.stopPropagation();
        });

        th.addEventListener("keydown", ev => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            th.blur();
          }
        });

        th.addEventListener("blur", () => {
          handleAuxHeaderEdit(idx, th);
        });
      }

      th.addEventListener("click", () => {
        if (isEditableAux) return;
        handleHeaderSort(idx);
      });

      hr.appendChild(th);
    });

    thead.appendChild(hr);
    table.appendChild(thead);

    // body
    const tbody = document.createElement("tbody");
    TABLE_STATE.tableBody = tbody;

    rows.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");
      tr.dataset.rowIndex = String(rowIdx);

      const cat = (TABLE_STATE.rowCats && TABLE_STATE.rowCats[rowIdx]) || 1;
      tr.dataset.cat = String(cat);

      headers.forEach((h, colIdx) => {
        const td = document.createElement("td");
        const v  = row[h] != null ? row[h] : "";
        td.textContent = v;
        if (isNumeric(v)) td.classList.add("num");

        const catClass = headerCats[colIdx];
        if (catClass) td.classList.add(catClass);
        // Only AUX columns after PID (colIdx !== 1) are editable
        if (catClass === "col-aux" && colIdx !== 1) {
          td.classList.add("editable-aux-cell");
          td.contentEditable = "true";

          td.addEventListener("click", ev => {
            ev.stopPropagation();
          });

          td.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              td.blur();
            }
          });

          td.addEventListener("input", () => {
            handleAuxCellEdit(rowIdx, colIdx, td);
        });

        }

        tr.appendChild(td);
      });

      tr.addEventListener("click", () => {
        toggleRowSelection(rowIdx);
      });

      tr.addEventListener("mouseenter", () => {
        const caseName = getCaseNameForRow(rowIdx);
        emitHover(caseName, true, rowIdx);
      });

      tr.addEventListener("mouseleave", () => {
        const caseName = getCaseNameForRow(rowIdx);
        emitHover(caseName, false, rowIdx);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    return table;
  }

  function findScrollable(el) {
    let node = el;
    while (node) {
      const style = window.getComputedStyle(node);
      const oy = style.getPropertyValue("overflow-y");
      if (oy === "auto" || oy === "scroll") return node;
      node = node.parentElement;
    }
    return null;
  }

  function scrollRowIntoView(rowIdx) {
    if (!Number.isFinite(rowIdx)) return;
    const tbody = $("#tablehost tbody");
    if (!tbody) return;

    const tr = tbody.querySelector('tr[data-row-index="' + rowIdx + '"]');
    if (!tr) return;

    const container = findScrollable(tr) || tbody;
    const trRect = tr.getBoundingClientRect();
    const cRect  = container.getBoundingClientRect();

    const above = trRect.top < cRect.top;
    const below = trRect.bottom > cRect.bottom;

    if (above || below) {
      tr.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  // preserveSelection = true → keep TABLE_STATE.selectedIds as is
  function renderTable(preserveSelection) {
    preserveSelection = !!preserveSelection;

    const host = $("#tablehost");
    if (!host) return;
    host.innerHTML = "";
    TABLE_STATE.tableBody = null;

    const { headers, rows } = TABLE_STATE;

    // ensure rowCats align with current Color-by before building DOM
    recomputeRowCatsFromColorBy();

    if (!headers.length) {
      const msg = document.createElement("div");
      msg.textContent = "No headers available";
      msg.style.fontSize = "13px";
      msg.style.color = "#6b7280";
      host.appendChild(msg);
      return;
    }

    // Build table always, even when rows === 0
    const table = buildTableElement(headers, rows);
    host.appendChild(table);

    // If empty, show placeholder row
    if (!rows.length) {
      const tbody = table.querySelector("tbody");
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = headers.length;
      td.textContent = "No rows available";
      td.style.textAlign = "center";
      td.style.color = "#6b7280";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    // Re-apply visibility from VIEW_STATE.hiddenHeaders
    applyHiddenColumnsFromState();

    // Rebuild metrics dropdown so it matches current headers + visibility
    if (typeof buildMetricsMenu === "function") {
      buildMetricsMenu(headers);
    }

    if (!preserveSelection) {
      TABLE_STATE.selectedIds.clear();
    }
    updateSelectionStyles();
    updateMetaCounts(headers, rows);
    syncBackToDATA();

    logSafe("table_render", {
      n_rows: rows.length,
      n_cols: headers.length
    });

    // notify Color-by (and others) that the table structure changed
    document.dispatchEvent(
      new CustomEvent("radqy:table:updated", {
        detail: { headers, rows }
      })
    );

    // After render, if there is a selection, ensure the last selected row is visible
    if (TABLE_STATE.selectedIds.size) {
      const last = Array.from(TABLE_STATE.selectedIds).pop();
      window.RADQY_LAST_SELECTED = last;
      scrollRowIntoView(last);
    }
  }

  // ---------- selection handling ----------

  function updateSelectionStyles() {
    const tbody = $("#tablehost tbody");
    if (!tbody) return;

    $$("tr", tbody).forEach(tr => {
      const idx = Number(tr.dataset.rowIndex || -1);
      if (TABLE_STATE.selectedIds.has(idx)) {
        tr.classList.add("row-selected");
      } else {
        tr.classList.remove("row-selected");
      }
    });

    // refresh legend after any selection change
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);
  }

  function toggleRowSelection(idx) {
      if (TABLE_STATE.selectedIds.has(idx)) {
        TABLE_STATE.selectedIds.delete(idx);
      } else {
        TABLE_STATE.selectedIds.add(idx);
      }

      updateSelectionStyles();
      document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
  detail: {
    count: Array.from(TABLE_STATE.selectedIds).length,
    selectedIndices: Array.from(TABLE_STATE.selectedIds)
  }
}));


      logSafe("table_row_toggle", {
        row_index: idx,
        selected: TABLE_STATE.selectedIds.has(idx)
      });

      // Auto-scroll selected row into view
      scrollRowIntoView(idx);

      // 🔥 NEW: Notify header.js that selection changed
      document.dispatchEvent(new CustomEvent("radqy:selectionChanged", {
        detail: { selectedIds: Array.from(TABLE_STATE.selectedIds) }
      }));
    }


  function selectAll() {
    TABLE_STATE.selectedIds = new Set(
      TABLE_STATE.rows.map((_, i) => i)
    );
    updateSelectionStyles();
    logSafe("table_select_all", { count: TABLE_STATE.rows.length });
    document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
  detail: {
    count: Array.from(TABLE_STATE.selectedIds).length,
    selectedIndices: Array.from(TABLE_STATE.selectedIds)
  }
}));


  }

  function deselectAll() {
  TABLE_STATE.selectedIds.clear();
  updateSelectionStyles();
  logSafe("table_deselect_all", {});

  // 🔥 Tell system there is no selection
  document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
    detail: { count: 0 }
  }));
}


  // ---------- export / copy / save ----------

  function rowsForExport() {
    const { headers, rows, selectedIds } = TABLE_STATE;
    if (!headers.length) return "";

    const hidden = getHiddenHeadersSet();

    // visible headers / their indices
    const visibleIdxs = [];
    const visibleHeaders = [];
    headers.forEach((h, idx) => {
      const key = String(h || "").toLowerCase();
      if (!hidden.has(key)) {
        visibleIdxs.push(idx);
        visibleHeaders.push(h);
      }
    });

    if (!visibleHeaders.length) return "";

    const idxs = selectedIds.size
      ? Array.from(selectedIds).sort((a, b) => a - b)
      : rows.map((_, i) => i);

    const lines = [];
    lines.push(visibleHeaders.join("\t"));

    idxs.forEach(i => {
      const r = rows[i];
      const cols = visibleIdxs.map(colIdx => {
        const h = headers[colIdx];
        return r[h] != null ? String(r[h]) : "";
      });
      lines.push(cols.join("\t"));
    });

    return lines.join("\n");
  }

  function fallbackCopy(txt) {
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    logSafe("table_copy_fallback", {
      n_rows: TABLE_STATE.selectedIds.size || TABLE_STATE.rows.length
    });
  }

  function copyToClipboard() {
    const txt = rowsForExport();
    if (!txt) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => {
        logSafe("table_copy", {
          n_rows: TABLE_STATE.selectedIds.size || TABLE_STATE.rows.length
        });
      }).catch(() => {
        fallbackCopy(txt);
      });
    } else {
      fallbackCopy(txt);
    }
  }

  function saveTSV() {
    const { headers, rows, selectedIds } = TABLE_STATE;
    if (!headers.length) return;

    const hidden = getHiddenHeadersSet();

    // figure out visible headers and their indices (respect Metrics menu)
    const visibleIdxs = [];
    const visibleHeaders = [];
    headers.forEach((h, idx) => {
      const key = String(h || "").toLowerCase();
      if (!hidden.has(key)) {
        visibleIdxs.push(idx);
        visibleHeaders.push(h);
      }
    });

    if (!visibleHeaders.length) return;

    const idxs = selectedIds.size
      ? Array.from(selectedIds).sort((a, b) => a - b)
      : rows.map((_, i) => i);

    if (!idxs.length) return;

    // Use XLSX if available; otherwise fall back to TSV download
    if (typeof XLSX === "undefined" || !XLSX || !XLSX.utils) {
      // Fallback: TSV, but still only visible columns
      const lines = [];
      lines.push(visibleHeaders.join("\t"));
      idxs.forEach(i => {
        const r = rows[i];
        const cols = visibleIdxs.map(colIdx => {
          const h = headers[colIdx];
          return r[h] != null ? String(r[h]) : "";
        });
        lines.push(cols.join("\t"));
      });
      const txt = lines.join("\n");
      if (!txt) return;

      const blob = new Blob([txt], { type: "text/tab-separated-values;charset=utf-8" });
      const url  = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "radqy_table.tsv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logSafe("table_save_tsv_fallback", {
        n_rows: selectedIds.size || rows.length
      });
      return;
    }

    // Build data array: first row = visible headers, then visible cols of selected rows
    const data = [];
    data.push(visibleHeaders.slice()); // header row

    idxs.forEach(i => {
      const r = rows[i];
      const rowArr = visibleIdxs.map(colIdx => {
        const h = headers[colIdx];
        const v = r[h] != null ? String(r[h]) : "";
        return v;
      });
      data.push(rowArr);
    });

    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Auto fit column widths based on maximum cell length in each visible column
    const colWidths = visibleHeaders.map((h, colIdx) => {
      let maxLen = String(h || "").length;
      for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
        const cellVal = data[rowIdx][colIdx];
        if (cellVal != null) {
          const len = String(cellVal).length;
          if (len > maxLen) maxLen = len;
        }
      }
      return { wch: maxLen + 2 }; // small padding
    });
    ws["!cols"] = colWidths;

    // Create workbook and append sheet named QC
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "QC");

    const filename = "RadQy_QC.xlsx";
    XLSX.writeFile(wb, filename);

    logSafe("table_save_xlsx", {
      n_rows: selectedIds.size || rows.length,
      filename
    });
  }

  // ---------- delete (keep rowCats in sync) ----------

  function deleteSelected() {
      if (!TABLE_STATE.selectedIds.size) return;

      const rawRows   = (window.DATA && window.DATA.RAW_ROWS) || null;
      const imagesArr = (window.DATA && window.DATA.IMAGES) || null;
      const imgSize   = (window.DATA && window.DATA.IMAGE_SIZE) || null;

      const keepRows = [];
      const keepCats = [];
      const keepRaw  = [];
      const keepImgs = [];
      const keepSizes= [];

      TABLE_STATE.rows.forEach((row, idx) => {
        if (!TABLE_STATE.selectedIds.has(idx)) {
          keepRows.push(row);
          keepCats.push(TABLE_STATE.rowCats[idx] || 1);
          if (rawRows) keepRaw.push(rawRows[idx]);
          if (imagesArr) keepImgs.push(imagesArr[idx]);
          if (imgSize) keepSizes.push(imgSize[idx]);
        }
      });

      const removed = TABLE_STATE.rows.length - keepRows.length;

      TABLE_STATE.rows    = keepRows;
      TABLE_STATE.rowCats = keepCats;
      TABLE_STATE.selectedIds.clear();
      window.RADQY_LAST_SELECTED = null;
      if (window.RADQY) {
        window.RADQY._selectedIndices = [];
      }

      // sync back to DATA (keep HEADERS intact)
      if (window.DATA) {
        window.DATA.ROWS = keepRows;
        if (rawRows)   window.DATA.RAW_ROWS   = keepRaw;
        if (imagesArr) window.DATA.IMAGES     = keepImgs;
        if (imgSize)   window.DATA.IMAGE_SIZE = keepSizes;
      }

      syncBackToDATA();
      renderTable(false);
      // Ensure legend/meta stay in sync with removed rows
      updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);

      // 🔥 Reset selection everywhere after delete
      if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function") {
        window.RADQY.setSelectedRowIndices([]);
      }
      document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
        detail: { count: 0, indices: [] }
      }));

      // Clear image panel immediately and hide it
      const imgHost = document.getElementById("imagehost") || document.getElementById("image-panel");
      if (imgHost) {
        imgHost.innerHTML = '<p style="color:#888; padding:10px;">No participant selected.</p>';
      }

      // Turn off image/fg/bg toggles and hide panel
      window.RADQY_MASK_VIS = { img: false, fg: false, bg: false };
      if (window.RADQY) {
        RADQY.visibility.image = false;
        RADQY.visibility.fgmask = false;
        RADQY.visibility.bgmask = false;
        RADQY._vis = RADQY._vis || {};
        RADQY._vis.image = false;
        RADQY._vis.fgmask = false;
        RADQY._vis.bgmask = false;
        if (typeof RADQY._write === "function") {
          RADQY._write(RADQY._vis);
        }
        if (typeof RADQY.applyVisibility === "function") {
          RADQY.applyVisibility();
        }
      }
      document.dispatchEvent(new CustomEvent("radqy:masks-changed", {
        detail: { ...window.RADQY_MASK_VIS }
      }));

      // Notify other modules (PCP/Bar/Image) that the dataset changed (e.g., delete)
      document.dispatchEvent(new CustomEvent("radqy:data:updated", {
        detail: { what: "delete" }
      }));

      logSafe("table_delete", { removed });
    }


  // ---------- ADD: AUX COLUMN & EXTERNAL EXT DATA ----------

  // Add AUX column called "Column", inserted after PID column
  function addAuxColumn() {
    if (!TABLE_STATE.headers.length) return;

    const headers = TABLE_STATE.headers;
    const rows    = TABLE_STATE.rows;
    const meta    = ensureMetaLists();

    const insertIdx = 2; // after PID column

    let base = "Column";
    let name = base;
    let k = 2;
    while (headers.includes(name)) {
      name = base + " " + k;
      k += 1;
    }

    headers.splice(insertIdx, 0, name);

    rows.forEach(r => {
      if (!(name in r)) r[name] = "";
    });

    const low = name.toLowerCase();
    if (!meta.auxs.includes(low)) meta.auxs.push(low);

    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "add_column", name, skipUMAP: true }
    }));
  }

  // Expose a helper to add an AUX column populated from the current selection
  window.RADQY.addSelectionAuxColumn = function (name, selectedIdxs, labels) {
    if (!TABLE_STATE.headers.length) return null;
    if (!Array.isArray(selectedIdxs) || !selectedIdxs.length) return null;

    const headers = TABLE_STATE.headers;
    const rows    = TABLE_STATE.rows;
    const meta    = ensureMetaLists();
    const selected = new Set(selectedIdxs);

    const insertIdx = 2; // after PID column
    const base = (name && String(name).trim()) || "Selection";
    let colName = base;
    let k = 2;
    while (headers.includes(colName)) {
      colName = base + " " + k;
      k += 1;
    }

    headers.splice(insertIdx, 0, colName);

    const selLabel = (labels && labels.selected) || "Selected";
    const unselLabel = (labels && labels.unselected) || "Unselected";
    rows.forEach((r, idx) => {
      r[colName] = selected.has(idx) ? selLabel : unselLabel;
    });

    const low = colName.toLowerCase();
    if (!meta.auxs.includes(low)) meta.auxs.push(low);

    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(headers, rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "add_column", name: colName, skipUMAP: true }
    }));

    return colName;
  };

  // Expose a helper to add an empty AUX column (no prompt)
  window.RADQY.addEmptyAuxColumn = function () {
    if (!TABLE_STATE.headers.length) return null;

    const headers = TABLE_STATE.headers;
    const rows    = TABLE_STATE.rows;
    const meta    = ensureMetaLists();

    const insertIdx = 2; // after PID column

    let base = "Column";
    let name = base;
    let k = 2;
    while (headers.includes(name)) {
      name = base + " " + k;
      k += 1;
    }

    headers.splice(insertIdx, 0, name);

    rows.forEach(r => {
      if (!(name in r)) r[name] = "";
    });

    const low = name.toLowerCase();
    if (!meta.auxs.includes(low)) meta.auxs.push(low);

    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "add_column", name, skipUMAP: true }
    }));

    return name;
  };

  // Overwrite an existing AUX column with the current selection
  window.RADQY.writeSelectionAuxColumn = function (colName, selectedIdxs, labels) {
    if (!TABLE_STATE.headers.length) return null;
    if (!colName) return null;

    const headers = TABLE_STATE.headers;
    if (!headers.includes(colName)) return null;

    const rows = TABLE_STATE.rows;
    const meta = ensureMetaLists();
    const selected = new Set(Array.isArray(selectedIdxs) ? selectedIdxs : []);

    const selLabel = (labels && labels.selected) || "Selected";
    const unselLabel = (labels && labels.unselected) || "Unselected";
    rows.forEach((r, idx) => {
      r[colName] = selected.has(idx) ? selLabel : unselLabel;
    });

    const low = colName.toLowerCase();
    if (!meta.auxs.includes(low)) meta.auxs.push(low);

    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(headers, rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "update_column", name: colName, skipUMAP: true }
    }));

    return colName;
  };

  // Append a new label to only the currently selected rows of an AUX column (keep existing labels)
  window.RADQY.appendSelectionLabelToColumn = function (colName, selectedIdxs, newLabel) {
    if (!TABLE_STATE.headers.length) return null;
    if (!colName) return null;
    if (!Array.isArray(selectedIdxs) || !selectedIdxs.length) return colName;
    const headers = TABLE_STATE.headers;
    if (!headers.includes(colName)) return null;

    const rows = TABLE_STATE.rows;
    const meta = ensureMetaLists();
    const selected = new Set(selectedIdxs);
    const labelVal = (newLabel && String(newLabel).trim()) || "Selected";

    rows.forEach((r, idx) => {
      if (selected.has(idx)) {
        r[colName] = labelVal;
      }
    });

    const low = colName.toLowerCase();
    if (!meta.auxs.includes(low)) meta.auxs.push(low);

    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(headers, rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "update_column", name: colName, skipUMAP: true }
    }));

    return colName;
  };

  function parseDelimited(text, delim) {
    const lines = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(l => l.trim().length > 0);

    if (!lines.length) return { headers: [], rows: [] };

    const headers = lines[0].split(delim).map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delim);
      if (!cols.length) continue;
      const obj = {};
      headers.forEach((h, j) => {
        obj[h] = cols[j] != null ? cols[j] : "";
      });
      rows.push(obj);
    }
    return { headers, rows };
  }

  function createExtFileInput() {
    if (EXT_INPUT) return EXT_INPUT;

    const existing = document.getElementById("extfile-input");
    const input = existing || document.createElement("input");

    if (!existing) {
      input.type = "file";
      input.accept = ".csv,.tsv,.txt,.xlsx,.xls";
      input.style.display = "none";
      document.body.appendChild(input);
    }

    input.addEventListener("change", evt => {
      const file = evt.target.files && evt.target.files[0];
      if (!file) return;
      handleExternalFile(file);
      input.value = "";
    });

    EXT_INPUT = input;
    return input;
  }

  function handleExternalFile(file) {
    const nameLower = (file.name || "").toLowerCase();
    const isExcel = nameLower.endsWith(".xlsx") || nameLower.endsWith(".xls");
    const isTSV   = nameLower.endsWith(".tsv") || nameLower.endsWith(".txt");
    const isCSV   = nameLower.endsWith(".csv");

    if (!isExcel && !isTSV && !isCSV) {
      alert("Unsupported file type. Please use .tsv, .csv, .txt, .xlsx, or .xls.");
      return;
    }

    const reader = new FileReader();

    if (isExcel) {
      if (!window.XLSX) {
        alert("To load .xlsx/.xls, include the XLSX library in the page or export the file as .tsv.");
        logSafe("ext_load_xlsx_missing_lib", { filename: file.name });
        return;
      }

      reader.onload = e => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows2D = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

          if (!rows2D || !rows2D.length) {
            alert("External Excel file appears to be empty.");
            return;
          }

          const headers = (rows2D[0] || []).map(h => String(h || "").trim());
          const rows = [];
          for (let i = 1; i < rows2D.length; i++) {
            const arr = rows2D[i];
            if (!arr || arr.length === 0) continue;
            const obj = {};
            headers.forEach((h, j) => {
              obj[h] = arr[j] != null ? String(arr[j]) : "";
            });
            rows.push(obj);
          }

          mergeExternalColumns(headers, rows);
          logSafe("ext_load_ok_excel", { filename: file.name });
        } catch (err) {
          console.error("Failed to parse Excel external file", err);
          alert("Could not parse external Excel file. Please check the format.");
          logSafe("ext_load_error_excel", { filename: file.name });
        }
      };

      reader.readAsArrayBuffer(file);
      return;
    }

    const delim = isTSV ? "\t" : ",";
    reader.onload = () => {
      try {
        const txt = String(reader.result || "");
        const parsed = parseDelimited(txt, delim);
        mergeExternalColumns(parsed.headers, parsed.rows);
        logSafe("ext_load_ok_text", { filename: file.name });
      } catch (err) {
        console.error("Failed to parse external file", err);
        alert("Could not parse external file. Please check the format.");
        logSafe("ext_load_error_text", { filename: file.name });
      }
    };
    reader.onerror = () => {
      alert("Failed to read external file.");
    };
    reader.readAsText(file);
  }

  // merge: add third column onward of external file as EXT columns
  function mergeExternalColumns(extHeaders, extRows) {
    if (!TABLE_STATE.headers.length || !extHeaders.length || !extRows.length) return;

    const headers = TABLE_STATE.headers;
    const rows = TABLE_STATE.rows;
    const meta = ensureMetaLists();

    // 1) Determine where AUX ends — EXT columns go right after AUX
    const auxList = meta.auxs.map(x => x.toLowerCase());
    let insertAt = headers.length;

    for (let i = 2; i < headers.length; i++) {
      const lh = headers[i].toLowerCase();
      if (!auxList.includes(lh)) {   // First non-AUX column
        insertAt = i;
        break;
      }
    }

    // 2) Add external headers (from 2nd column onward)
    const newExtNames = [];
    for (let idx = 1; idx < extHeaders.length; idx++) {
      const h = extHeaders[idx];
      if (h && !headers.includes(h)) {
        headers.splice(insertAt, 0, h);
        newExtNames.push(h);
        insertAt++;
      }
    }

    // 3) Fill in values row by row (no PID matching, just direct mapping)
    rows.forEach((r, rowIndex) => {
      const extRow = extRows[rowIndex] || {};
      newExtNames.forEach(h => {
        r[h] = extRow[h] !== undefined ? String(extRow[h]) : "";
      });
    });

    // 4) Register EXT columns in metadata
    newExtNames.forEach(h => {
      const low = h.toLowerCase();
      if (!meta.exts.includes(low)) meta.exts.push(low);
    });

    // 5) Final refresh + sync
    renderTable(false);
    syncBackToDATA();
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);
    document.dispatchEvent(new CustomEvent("radqy:data:updated", {
      detail: { what: "add_column", names: newExtNames.slice() }
    }));
  }

  // ===== COLUMN VISIBILITY used by metrics menu =====

  function toggleColumnVisibility(idx, show) {
    document.querySelectorAll(".radqy-table tr").forEach(row => {
      if (row.children[idx]) {
        row.children[idx].style.display = show ? "" : "none";
      }
    });

    const headers = TABLE_STATE.headers || [];
    const name = headers[idx];
    if (name != null) {
      const hs  = getHiddenHeadersSet();
      const key = String(name).toLowerCase();
      if (!show) hs.add(key);
      else       hs.delete(key);

      // broadcast column visibility for other parts (PCP, BAR, Image) if needed
      document.dispatchEvent(
        new CustomEvent("radqy:view:columns", {
          detail: {
            hidden: Array.from(hs)  // lowercased header names
          }
        })
      );
    }

    // after hiding/showing columns, update legend counts
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);

    // ===== NEW: Toggle Image / FG / BG header buttons based on selection =====
    const anySelected = TABLE_STATE.selectedIds.size > 0;

    ["btnimage", "btnfgmask", "btnbgmask"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;   // skip if button doesn't exist
      btn.classList.toggle("active", anySelected);
      btn.disabled = !anySelected;
    });

  }

  function applyHiddenColumnsFromState() {
    const headers = TABLE_STATE.headers || [];
    if (!headers.length) return;

    const hidden = getHiddenHeadersSet();
    if (!hidden || !hidden.size) return;

    const rows = document.querySelectorAll(".radqy-table tr");
    rows.forEach(row => {
      headers.forEach((h, idx) => {
        const key = String(h || "").toLowerCase();
        if (hidden.has(key) && row.children[idx]) {
          row.children[idx].style.display = "none";
        }
      });
    });
  }

  // ===== METRICS DROPDOWN (AUXs, EXTs, TAGs, IQMs) =====
  function buildMetricsMenu(headers) {
    const menu = document.getElementById("sb-metrics-menu");
    if (!menu) return;
    menu.innerHTML = "";

    // --- fixed header + scrollable body containers ---
    const head = document.createElement("div");
    head.className = "metrics-head";

    const body = document.createElement("div");
    body.className = "metrics-scroll";

    const meta = window.DATA?.META || {};
    const nameToIdx = new Map(headers.map((h, i) => [String(h || "").toLowerCase(), i]));
    const hidden = getHiddenHeadersSet();

    let auxList = (meta.auxs || []).slice();
    const extList = meta.exts || [];
    const tagList = meta.tags || [];
    const iqmList = meta.iqms || [];

    // ensure PID (2nd column) is treated as AUX from the start
    if (headers.length > 1) {
      const pidHeader = headers[1];
      const pidLow = String(pidHeader).toLowerCase();
      const auxLows = auxList.map(x => String(x).toLowerCase());
      if (!auxLows.includes(pidLow)) {
        auxList.unshift(pidHeader);
      }
    }

    const groups = [
      { key: "aux", label: "AUXs", css: "aux", list: auxList },
      { key: "ext", label: "EXTs", css: "ext", list: extList },
      { key: "tag", label: "TAGs", css: "tag", list: tagList },
      { key: "iqm", label: "IQMs", css: "iqm", list: iqmList }
    ];

    function isVisibleColName(name) {
      const key = String(name || "").toLowerCase();
      return !hidden.has(key);
    }

    // ---- TOP SUMMARY ROWS (group toggles) ----
    groups.forEach(grp => {
      if (!grp.list || !grp.list.length) return;

      let allVisible = true;
      grp.list.forEach(col => {
        const idx = nameToIdx.get(String(col || "").toLowerCase());
        if (idx === undefined) return;
        if (!isVisibleColName(col)) {
          allVisible = false;
        }
      });

      const row = document.createElement("div");
      row.className = `metric-summary summary-${grp.css}`;

      const colorBox = document.createElement("span");
      colorBox.className = `metric-color-box box-${grp.css}`;

      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "metric-summary-check";
      chk.checked = allVisible;
      chk.dataset.group = grp.key;

      chk.addEventListener("change", () => {
        const visible = chk.checked;

        grp.list.forEach(col => {
          const idx = nameToIdx.get(String(col || "").toLowerCase());
          if (idx === undefined) return;
          toggleColumnVisibility(idx, visible);

          body.querySelectorAll(
            `input.metric-check[data-col-index="${idx}"]`
          ).forEach(cb => {
            cb.checked = visible;
          });
        });
      });

      const label = document.createElement("span");
      label.className = "metric-summary-label";
      label.textContent = grp.label;

      row.appendChild(colorBox);
      row.appendChild(chk);
      row.appendChild(label);
      head.appendChild(row);
    });

    if (groups.some(g => g.list && g.list.length)) {
      const hr = document.createElement("hr");
      hr.className = "metric-separator";
      head.appendChild(hr);
    }

    // ---- INDIVIDUAL METRICS (scrollable) ----
    groups.forEach(grp => {
      if (!grp.list || !grp.list.length) return;

      grp.list.forEach(col => {
        const idx = nameToIdx.get(String(col || "").toLowerCase());
        if (idx === undefined) return;

        const visible = isVisibleColName(col);

        const item = document.createElement("div");
        item.className = `metric-item item-${grp.css}`;

        const colorBox = document.createElement("span");
        colorBox.className = `metric-color-box box-${grp.css}`;

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.className = "metric-check";
        chk.checked = visible;
        chk.dataset.colIndex = String(idx);
        chk.dataset.group = grp.key;

        chk.addEventListener("change", () => {
          const vis = chk.checked;
          toggleColumnVisibility(idx, vis);

          // update group checkbox state
          const groupKey = chk.dataset.group;
          const groupItems = body.querySelectorAll(
            `input.metric-check[data-group="${groupKey}"]`
          );
          let allOn = true;
          groupItems.forEach(cb => {
            if (!cb.checked) allOn = false;
          });
          const groupBox = head.querySelector(
            `input.metric-summary-check[data-group="${groupKey}"]`
          );
          if (groupBox) groupBox.checked = allOn;
        });

        const label = document.createElement("span");
        label.className = "metric-label";
        if (grp.key === "aux" && idx === 1) {
          label.textContent = "PID";
        } else {
          label.textContent = headers[idx];
        }

        item.appendChild(colorBox);
        item.appendChild(chk);
        item.appendChild(label);
        body.appendChild(item);
      });
    });

    // attach header + scrollable body to menu
    menu.appendChild(head);
    menu.appendChild(body);
  }

  // ---------- toolbar binding ----------
  // ---------- toolbar binding ----------
function bindToolbar() {
  const btnCopy     = $("#btncopy");
  const btnSave     = $("#btnsave");
  const btnSelect   = $("#btnselect");
  const btnDeselect = $("#btndeselect");
  const btnDelete   = $("#btndelete");
  const btnAdd      = $("#btnadd");
  const btnMetrics  = $("#btnmetrics");
  const addMenu     = $("#add-menu");
  const metricsMenu = $("#sb-metrics-menu"); // static, exists in HTML

  if (btnCopy)     btnCopy.addEventListener("click", copyToClipboard);
  if (btnSave)     btnSave.addEventListener("click", saveTSV);
  if (btnSelect)   btnSelect.addEventListener("click", selectAll);
  if (btnDeselect) btnDeselect.addEventListener("click", deselectAll);
  if (btnDelete)   btnDelete.addEventListener("click", deleteSelected);

  function closeAllMenus() {
    const addM     = document.getElementById("add-menu");
    const metricsM = document.getElementById("sb-metrics-menu");
    const colorM   = document.getElementById("color-menu");

    if (addM)     addM.classList.remove("is-open");
    if (metricsM) metricsM.classList.remove("is-open");
    if (colorM)   colorM.classList.remove("is-open");
  }

  // ADD menu
  if (btnAdd && addMenu) {
    btnAdd.addEventListener("click", ev => {
      ev.stopPropagation();
      // close Metrics + Color by using fresh lookups
      const metricsM = document.getElementById("sb-metrics-menu");
      const colorM   = document.getElementById("color-menu");
      if (metricsM) metricsM.classList.remove("is-open");
      if (colorM)   colorM.classList.remove("is-open");

      addMenu.classList.toggle("is-open");
    });

    addMenu.querySelectorAll(".menu-item").forEach(item => {
      item.addEventListener("click", ev => {
        ev.stopPropagation();
        addMenu.classList.remove("is-open");
        const action = item.dataset.action;
        if (action === "aux") {
          addAuxColumn();
          logSafe("table_add_aux_column", {});
        } else if (action === "ext") {
          const inp = createExtFileInput();
          inp.click();
          logSafe("table_add_ext_click", {});
        }
      });
    });
  }

  // METRICS menu
  if (btnMetrics && metricsMenu) {
    metricsMenu.addEventListener("click", ev => {
      ev.stopPropagation();
    });

    btnMetrics.addEventListener("click", ev => {
      ev.stopPropagation();
      // close Add + Color by using fresh lookups
      const addM   = document.getElementById("add-menu");
      const colorM = document.getElementById("color-menu");
      if (addM)   addM.classList.remove("is-open");
      if (colorM) colorM.classList.remove("is-open");

      metricsMenu.classList.toggle("is-open");
    });
  }

  // Global click closes all menus
  document.addEventListener("click", () => {
    closeAllMenus();
  });
}


  // ---------- DATA wiring ----------

  function loadFromDATA(dataObj) {
    const D = dataObj || window.DATA || {};
    const headers = Array.isArray(D.HEADERS) ? D.HEADERS.slice() : [];
    const rows    = Array.isArray(D.ROWS)    ? D.ROWS.slice()    : [];

    TABLE_STATE.headers = headers;
    TABLE_STATE.rows    = rows;
    TABLE_STATE.selectedIds.clear();

    // default: all rows belong to CAT1 (participant view by P#)
    TABLE_STATE.rowCats = new Array(rows.length).fill(1);
    updateColorState(null, ["Participants"], null);

    renderTable(false);
  }

  // exposed hook so PCP / BAR can recolor rows later
  window.RADQY = window.RADQY || {};
    RADQY.setRowCategories = function (cats) {
    if (!Array.isArray(cats)) return;
    TABLE_STATE.rowCats = cats.slice();

    if (!TABLE_STATE.tableBody) return;

    TABLE_STATE.tableBody.querySelectorAll("tr").forEach(tr => {
      const idx = Number(tr.dataset.rowIndex || -1);
      const cat = TABLE_STATE.rowCats[idx] || 1;
      tr.dataset.cat = String(cat);
    });
  };

  RADQY.getSelectedRowIndices = function () {
    return Array.from(TABLE_STATE.selectedIds || []);
  };

  RADQY.setSelectedRowIndices = function (idxs) {
    if (!Array.isArray(idxs)) idxs = [];
    const cleaned = idxs
      .map(v => Number(v))
      .filter(n => Number.isFinite(n));

    TABLE_STATE.selectedIds = new Set(cleaned);
    window.RADQY._selectedIndices = cleaned.slice();
    window.RADQY_LAST_SELECTED = cleaned.length ? cleaned[cleaned.length - 1] : null;

    updateSelectionStyles();
    if (cleaned.length) {
      scrollRowIntoView(cleaned[cleaned.length - 1]);
    }

    document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
      detail: {
        count: cleaned.length,
        indices: cleaned.slice(),
        selectedIndices: cleaned.slice()
      }
    }));
  };

  // 🔥 NEW: expose current color category index for a table row
  RADQY.getRowCategoryForIndex = function (idx) {
    if (!TABLE_STATE.rowCats || idx == null) return 1;
    return TABLE_STATE.rowCats[idx] || 1;
  };

  // Provide the active Color-by value + category for a given row
  RADQY.getRowCategoryDetail = function (idx) {
    const headers = TABLE_STATE.headers || [];
    const rows = TABLE_STATE.rows || [];
    const row = rows[idx];
    const colorBy = window.VIEW_STATE?.colorBy || null;

    if (!row || !colorBy) {
      return { cat: TABLE_STATE.rowCats?.[idx] || 1, header: null, value: null };
    }

    const norm =
      (typeof window.normalizeCategoryValue === "function")
        ? window.normalizeCategoryValue
        : (_h, v) => normalizeCatValue(v);

    const value = norm(colorBy, row[colorBy]);
    const map = window.VIEW_STATE?.colorByMap || null;
    const cat = map?.get(value) || TABLE_STATE.rowCats?.[idx] || 1;

    return { cat, header: colorBy, value };
  };

  RADQY.getColorState = function () {
    const cs = window.RADQY_COLOR || {};
    return {
      header: cs.header || null,
      categories: Array.isArray(cs.categories) ? cs.categories.slice() : [],
      mapEntries: cs.map ? Array.from(cs.map.entries()) : []
    };
  };

  // Exported hook so other modules can refresh legend counts (e.g., after color-by change)
  window.recountLegend = function () {
    updateMetaCounts(TABLE_STATE.headers, TABLE_STATE.rows);
  };

  // Sync table row classes to category axis (used by PCP / BAR color-by)
  window.setRowCategoryClasses = function(catMap, domain){
    // Ignore external overrides from PCP/BAR to keep table Color-by authoritative
    return;
  };




  // ---------- events ----------

  document.addEventListener("radqy:data:ready", (e) => {
    loadFromDATA(e && e.detail && e.detail.data);
  });

  document.addEventListener("DOMContentLoaded", () => {
    bindToolbar();
    if (window.DATA && window.DATA.HEADERS && window.DATA.ROWS) {
      loadFromDATA(window.DATA);
    }
  });

  // Keep table selection in sync with external selection sources (PCP, BAR, images, etc.)
  document.addEventListener("radqy:selection-changed", (e) => {
    const det = e && e.detail ? e.detail : {};
    let idxs = null;
    if (Array.isArray(det.indices)) idxs = det.indices;
    else if (Array.isArray(det.selectedIndices)) idxs = det.selectedIndices;
    else if (det.count === 0) idxs = [];

    if (!idxs) return;

    const incoming = new Set(
      idxs
        .map(v => Number(v))
        .filter(n => Number.isFinite(n))
    );

    let changed = incoming.size !== TABLE_STATE.selectedIds.size;
    if (!changed) {
      for (const v of incoming) {
        if (!TABLE_STATE.selectedIds.has(v)) {
          changed = true;
          break;
        }
      }
    }

    if (!changed) return;

    TABLE_STATE.selectedIds = incoming;
    updateSelectionStyles();

    if (incoming.size) {
      const last = Array.from(incoming).pop();
      window.RADQY_LAST_SELECTED = last;
      scrollRowIntoView(last);
    }
  });

  // Hover sync from other panels
  document.addEventListener("radqy:hover:change", (e) => {
    const det = e && e.detail ? e.detail : {};
    const caseName = det.caseName != null ? String(det.caseName) : null;
    const on = !!det.on;
    const indicesArr = Array.isArray(det.indices) ? det.indices : null;

    const tbody = $("#tablehost tbody");
    if (!tbody) return;

    // clear all on hover-off without a case/indices
    if (!on || (!caseName && !indicesArr)) {
      $$("tr.row-hover-sync", tbody).forEach(tr => tr.classList.remove("row-hover-sync"));
      return;
    }

    if (indicesArr && indicesArr.length) {
      const idxSet = new Set(
        indicesArr
          .map(v => Number(v))
          .filter(n => Number.isFinite(n))
      );
      $$("tr", tbody).forEach(tr => {
        const idx = Number(tr.dataset.rowIndex || -1);
        if (idxSet.has(idx)) {
          tr.classList.add("row-hover-sync");
        } else {
          tr.classList.remove("row-hover-sync");
        }
      });
      return;
    }

    let matched = false;
    $$("tr", tbody).forEach(tr => {
      const idx = Number(tr.dataset.rowIndex || -1);
      const candidate = getCaseNameForRow(idx);
      if (String(candidate) === caseName) {
        tr.classList.add("row-hover-sync");
        matched = true;
      } else {
        tr.classList.remove("row-hover-sync");
      }
    });

    if (!matched) {
      $$("tr", tbody).forEach(tr => tr.classList.remove("row-hover-sync"));
    }
  });

  // Recolor table rows when Color-by changes
  document.addEventListener("radqy:colorby:changed", (e) => {
    // Keep table row cats in sync when Color-by changes externally
    recomputeRowCatsFromColorBy();
    applyRowCatsToDom();
  });

  // When legend updates with colorBy info, keep table row cats in sync
  document.addEventListener("radqy:legend:update", (e) => {
    // If legend recomputed from Color-by, ensure table DOM cats stay current
    recomputeRowCatsFromColorBy();
    applyRowCatsToDom();
  });
})();
