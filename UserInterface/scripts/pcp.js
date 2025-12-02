/***********************
 * pcp.js (full file)
 * - No optional chaining
 * - Balanced parens
 * - Works with HTML-owned controls (Color by / Measure by / Sort by live elsewhere)
 ***********************/

/* ===== Utilities & small helpers ===== */

window.updateBarMetricVisibility = function(){
  var el = document.getElementById('bar-metric-wrap');
  if (!el) return;
  var visType = (window.CHART_STATE && window.CHART_STATE.visType) || '';
  el.style.display = (visType === 'bar_chart') ? '' : 'none';
};

function computeCategoricalHeaders() {
  var DATA = window.DATA || {};
  var headers = Array.isArray(DATA.HEADERS) ? DATA.HEADERS : [];
  var rows = Array.isArray(DATA.ROWS) ? DATA.ROWS : [];
  var out = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (!h) continue;
    var low = String(h).toLowerCase();
    if (low === 'p#' || /^participant\b/.test(low)) continue;
    var values = [];
    var numericCount = 0;
    var nonEmpty = 0;
    var uniq = {};
    for (var r = 0; r < rows.length; r++) {
      var v = rows[r][h];
      if (v === '' || v === null || v === undefined) continue;
      nonEmpty++;
      var num = parseFloat(v);
      if (!isNaN(num) && isFinite(num)) {
        numericCount++;
      }
      var key = String(v);
      if (!uniq[key]) {
        uniq[key] = true;
        values.push(key);
      }
    }
    if (values.length && values.length <= 12 && numericCount !== nonEmpty) {
      out.push({ header: h, values: values });
    }
  }
  return out;
}

window.getCategoricalHeaders = function () { return computeCategoricalHeaders(); };

function _dataSection(){
  var D = window.DATA || {};
  return { headers: D.HEADERS || [], rows: D.ROWS || [] };
}
function _headers(){
  var s = _dataSection();
  return Array.isArray(s.headers) ? s.headers : [];
}
function _hasHeaderOfType(type, h){
  // tags/iqms/exts/auxs not separated; rely on meta lists if present
  var meta = window.DATA && window.DATA.META;
  if (!meta) return false;
  var list = meta[type] || [];
  for (var i=0;i<list.length;i++){
    if (String(list[i]).toLowerCase() === String(h).toLowerCase()) return true;
  }
  return false;
}
function _classForHeader(h){
  if (!h) return null;
  if (_hasHeaderOfType('tags', h)) return 'pcp-axis-tag';
  if (_hasHeaderOfType('iqms', h)) return 'pcp-axis-iqms';
  if (_hasHeaderOfType('exts', h)) return 'pcp-axis-ext';
  if (_hasHeaderOfType('auxs', h)) return 'pcp-axis-aux';
  return null;
}
function _getComputed(varName, fallback){
  var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
  v = (v || '').trim();
  return v || fallback || null;
}

function styleColorBySelect(currentColOrToken){
  var css = getComputedStyle(document.documentElement);
  var bg = '#fff', border = '#ddd';
  if (currentColOrToken !== '__participant__'){
    if (_hasHeader('TAGS', currentColOrToken)){
      bg = (css.getPropertyValue('--color-tags')||'').trim();
      border = (css.getPropertyValue('--color-tags-border')||'').trim();
    } else if (_hasHeader('IQMS', currentColOrToken)){
      bg = (css.getPropertyValue('--color-iqms')||'').trim();
      border = (css.getPropertyValue('--color-iqms-border')||'').trim();
    } else if (_hasHeader('EXTS', currentColOrToken)){
      bg = (css.getPropertyValue('--color-ext')||'').trim();
      border = (css.getPropertyValue('--color-ext-border')||'').trim();
    }
  }
  var btn = document.getElementById('pcp-colorby-select');
  if (!btn) return;
  btn.style.setProperty('--axisby-bg', bg);
  btn.style.setProperty('--axisby-border', border);
  btn.style.background = bg;
  btn.style.borderColor = border;
}

function categoryColorScale() {
  var palette = [
    _getComputed('--cat2-base', '#5ac8fa'),
    _getComputed('--cat3-base', '#af52de'),
    _getComputed('--cat4-base', '#ffcc00'),
    _getComputed('--cat5-base', '#34c759'),
    _getComputed('--cat6-base', '#ff9500')
  ];
  return function(idx){ return palette[idx % palette.length]; };
}

function catColorFromIndex(idx){
  var css = getComputedStyle(document.documentElement);
  var colors = [
    null,
    css.getPropertyValue("--color-base-cat1") || "#c7d8ff",
    css.getPropertyValue("--color-base-cat2") || "#f6b7ce",
    css.getPropertyValue("--color-base-cat3") || "#90ffe0",
    css.getPropertyValue("--color-base-cat4") || "#ffddb3",
    css.getPropertyValue("--color-base-cat5") || "#e2caff",
    css.getPropertyValue("--color-base-cat6") || "#c2f2f0"
  ];
  return colors[idx] || colors[1] || "#ddd";
}
function catHoverColorFromIndex(idx){
  var css = getComputedStyle(document.documentElement);
  var colors = [
    null,
    css.getPropertyValue("--color-hover-cat1") || "#3b6ed9",
    css.getPropertyValue("--color-hover-cat2") || "#e85c92",
    css.getPropertyValue("--color-hover-cat3") || "#2f8a70",
    css.getPropertyValue("--color-hover-cat4") || "#e98a2b",
    css.getPropertyValue("--color-hover-cat5") || "#8e63e6",
    css.getPropertyValue("--color-hover-cat6") || "#2a6b6b"
  ];
  return colors[idx] || colors[1] || "#999";
}
function catSelectColorFromIndex(idx){
  var css = getComputedStyle(document.documentElement);
  var colors = [
    null,
    css.getPropertyValue("--color-select-cat1") || "#0b2a63",
    css.getPropertyValue("--color-select-cat2") || "#b71575",
    css.getPropertyValue("--color-select-cat3") || "#0f4538",
    css.getPropertyValue("--color-select-cat4") || "#8c3f00",
    css.getPropertyValue("--color-select-cat5") || "#3f197e",
    css.getPropertyValue("--color-select-cat6") || "#0f2f34"
  ];
  return colors[idx] || colors[1] || "#555";
}

function hoverTableRow(caseName, on) {
  if (!window.dt) return;
  var participantIdx = (window.CURRENT_HEADERS && window.CURRENT_HEADERS.findIndex)
    ? window.CURRENT_HEADERS.findIndex(function(h){ return /^Participant\b/i.test(String(h)); })
    : -1;

  var rowNodeToHover = null;
  window.dt.rows().every(function (rowIdx) {
    var rowData = this.data();
    if (!rowData) return;
    if (participantIdx >= 0) {
      if (String(rowData[participantIdx]) === String(caseName)) {
        rowNodeToHover = this.node();
      }
    } else {
      if (String(rowIdx) === String(caseName)) {
        rowNodeToHover = this.node();
      }
    }
  });
  if (!rowNodeToHover) return;
  if (on) {
    rowNodeToHover.classList.add('row-hover-sync');
  } else {
    window.dt.rows().every(function () {
      var n = this.node();
      if (n) n.classList.remove('row-hover-sync');
    });
  }
}

function prettyNumber(v) {
  if (v == null || isNaN(v)) return "";
  return (Math.round(v * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/* Zoom label helper (kept minimal & safe) */
(function(){
  var LABEL_X = 14;
  window.zl = function(groupEl, on, scale){
    scale = (scale == null) ? 1.45 : scale;
    var txt = d3.select(groupEl).select("text");
    if (txt.empty()) return;
    if (on){
      var dx = (1 - scale) * LABEL_X;
      txt.attr("transform", "translate("+dx+",0) scale("+scale+")").style("font-weight", "700");
    } else {
      txt.attr("transform", null).style("font-weight", null);
    }
  };
  window.zoomLabel = window.zl;
})();

/* Make passive listeners safely (no syntax surprises) */
(function () {
  var passiveEvents = ['touchstart', 'touchmove', 'wheel'];
  var origAdd = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, opts) {
    var o = opts;
    if (passiveEvents.indexOf(type) !== -1) {
      if (o === undefined || typeof o === 'boolean') {
        o = { passive: true, capture: !!o };
      } else if (o && typeof o === 'object' && o.passive === undefined) {
        o = Object.assign({}, o, { passive: true });
      }
    }
    return origAdd.call(this, type, listener, o);
  };
})();

/* ===== Options & controls wiring ===== */

function optionKindForHeader(h){
  if (h === '__participant__') return 'part';
  if (_hasHeaderOfType('tags', h))  return 'tag';
  if (_hasHeaderOfType('iqms', h))  return 'iqms';
  if (_hasHeaderOfType('exts', h))  return 'ext';
  return 'other';
}

function populateMetricOptions(){
  var btn  = document.getElementById('pcp-metric-select');
  var menu = btn ? btn.nextElementSibling : null;
  if (!btn || !menu) return;

  var ds = (window.radqyMergedDataset ? window.radqyMergedDataset() : []);
  var numeric = (window.radqyInferNumericColumns ? window.radqyInferNumericColumns(ds) : []);
  var cur = (window.CHART_STATE && window.CHART_STATE.currentMetric && numeric.indexOf(window.CHART_STATE.currentMetric) !== -1)
    ? window.CHART_STATE.currentMetric
    : (numeric[0] || null);

  if (!window.CHART_STATE) window.CHART_STATE = {};
  window.CHART_STATE.currentMetric = cur || null;
  btn.textContent = cur || '—';

  menu.innerHTML = '';
  numeric.forEach(function(m){
    var opt = document.createElement('div');
    opt.className = 'radqy-select__opt';
    opt.setAttribute('role','option');
    opt.setAttribute('data-value', m);
    opt.textContent = m;
    if (m === cur) opt.setAttribute('aria-selected','true');
    opt.addEventListener('click', function(){
      window.CHART_STATE.currentMetric = m;
      btn.textContent = m;
      if (menu.parentElement) menu.parentElement.classList.remove('is-open');
      if (typeof window.renderChartsView === 'function') window.renderChartsView();
    });
    menu.appendChild(opt);
  });
}

function ensureAxisByControl(){
  var btn = document.getElementById('pcp-colorby-select');
  var menu = btn ? btn.nextElementSibling : null;
  if (!btn || !menu) return;

  if (!btn.__wired){
    btn.addEventListener('click', function(){
      if (btn.parentElement) btn.parentElement.classList.toggle('is-open');
    });
    document.addEventListener('click', function(e){
      if (btn.parentElement && !btn.parentElement.contains(e.target)) {
        btn.parentElement.classList.remove('is-open');
      }
    }, {capture:true});
    btn.__wired = true;
  }
}

function populateAxisByOptions(){
  var btn  = document.getElementById('pcp-colorby-select');
  var menu = btn ? btn.nextElementSibling : null;
  if (!btn || !menu) return;

  var currentCol = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.column) || 'P#';
  var currentKind = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.kind) || 'participant';

  var items = [{ label:'P#', value:'__participant__', cls:'radqy-opt--part' }];
  var cats = (typeof window.getCategoricalHeaders === 'function') ? window.getCategoricalHeaders() : [];
  for (var i=0;i<cats.length;i++){
    var item = cats[i];
    var cls = 'radqy-opt--other';
    if (_hasHeader('TAGS', item.header)) cls = 'radqy-opt--tag';
    else if (_hasHeader('IQMS', item.header)) cls = 'radqy-opt--iqms';
    else if (_hasHeader('EXTS', item.header)) cls = 'radqy-opt--ext';
    items.push({ label:item.header, value:item.header, cls:cls });
  }

  btn.textContent = (currentKind === 'category') ? currentCol : 'P#';
  menu.innerHTML = '';

  var chartShell = document.getElementById('chart-shell');

  var _clickFactory = function(it){
    return function(){
      if (!window.CHART_STATE) window.CHART_STATE = {};
      if (it.value === '__participant__'){
        window.CHART_STATE.axisBy = { kind:'participant', column:'P#', categories:[] };
        if (chartShell) chartShell.classList.add('pcp-mode-participant');
      } else {
        var catsInfo = (typeof window.getCategoricalHeaders === 'function') ? window.getCategoricalHeaders() : [];
        var vals = [];
        for (var k=0;k<catsInfo.length;k++){
          if (catsInfo[k].header === it.value){
            vals = catsInfo[k].values || [];
            break;
          }
        }
        window.CHART_STATE.axisBy = { kind:'category', column:it.value, categories:vals };
        if (chartShell) chartShell.classList.remove('pcp-mode-participant');
      }
      btn.textContent = it.label;
      if (btn.parentElement) btn.parentElement.classList.remove('is-open');
      styleColorBySelect(it.value);
      if (typeof window.renderChartsView === 'function') window.renderChartsView();
    };
  };

  for (var j=0;j<items.length;j++){
    var it = items[j];
    var opt = document.createElement('div');
    opt.className = 'radqy-select__opt ' + it.cls;
    opt.setAttribute('role','option');
    opt.setAttribute('data-value', it.value);
    opt.textContent = it.label;

    var isSelected =
      (it.value === '__participant__' && currentKind !== 'category') ||
      (currentKind === 'category' && it.value === currentCol);
    if (isSelected) opt.setAttribute('aria-selected','true');

    opt.addEventListener('click', _clickFactory(it));
    menu.appendChild(opt);
  }

  if (chartShell){
    if (currentKind === 'participant') chartShell.classList.add('pcp-mode-participant');
    else chartShell.classList.remove('pcp-mode-participant');
  }
  styleColorBySelect(currentKind === 'participant' ? '__participant__' : currentCol);
}

function ensureChartToggleButton() {
  var group = document.getElementById("parts-group") || document.getElementById("hdr-left");
  if (!group) return;
  if (document.getElementById("toggle-chart-button")) return;
  var btn = document.createElement("button");
  btn.id = "toggle-chart-button";
  btn.className = "btn btn-outline-secondary btn-sm";
  btn.textContent = "Chart";
  group.appendChild(btn);
  btn.addEventListener("click", function () {
    var chartsView = document.getElementById("charts-view");
    if (chartsView) {
      chartsView.style.display = (chartsView.style.display === "none") ? "" : "none";
    }
  });
}

/* ===== Core dataset+state helpers ===== */

(function () {
  window.CHART_STATE = window.CHART_STATE || {
    visType: 'parallel_coordinate',
    currentMetric: null,
    paracMetrics: [],
    selectedCase: null,
    axisBy: { kind: 'participant', column: 'P#', categories: [] },
    initialized: false,
    dimOthersOnSelect: false
  };

  var CHART_MARGIN, PARAC_MARGIN;
  var CHART_SVG, PARAC_SVG;
  var foregroundLayer;
  var PARAC_W, PARAC_H;

  function $CHART() { return $('#chart-svg-container'); }
  function $PARAC() { return $('#parac-svg-container'); }

  function mergedDataset() {
    var D = _dataSection();
    var headers = Array.isArray(D.headers) ? D.headers : [];
    var rows = Array.isArray(D.rows) ? D.rows : [];
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        var h = headers[j];
        obj[h] = rows[i][h];
      }
      out.push(obj);
    }
    return out;
  }

  function getParticipantHeaderName() {
    var mainHeaders = _headers();
    for (var i = 0; i < mainHeaders.length; i++) {
      var h = mainHeaders[i];
      if (/^Participant\b/i.test(String(h))) return h;
    }
    return null;
  }

  function getCaseName(rowObj, idx) {
    var pHeader = getParticipantHeaderName();
    if (pHeader && rowObj[pHeader] != null && rowObj[pHeader] !== '') return String(rowObj[pHeader]);
    return String(idx);
  }

  function buildParticipantDomainFromLabels(labels) {
    if (!Array.isArray(labels)) return [];
    var out = [];
    var seen = new Set();
    labels.forEach(function(l){
      var s = String(l);
      if (seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out;
  }

  function inferNumericColumns(dataset) {
    if (!dataset.length) return [];
    var allHeaders = Array.isArray(window.CURRENT_HEADERS) ? window.CURRENT_HEADERS.slice() : Object.keys(dataset[0]);
    var hiddenRaw = (window.VIEW_STATE && window.VIEW_STATE.hiddenHeaders) ? window.VIEW_STATE.hiddenHeaders : new Set();
    var hidden = new Set(Array.from(hiddenRaw).map(function(h){ return String(h).toLowerCase(); }));

    var numericCols = [];
    for (var i=0;i<allHeaders.length;i++){
      var h = allHeaders[i];
      if (!h) continue;
      if (/^Participant\b/i.test(h)) continue;
      if (String(h).trim() === 'P#') continue;
      var hLow = String(h).toLowerCase();
      if (hidden.has(hLow)) continue;

      var sawAny = false, allNumeric = true;
      for (var r = 0; r < dataset.length; r++) {
        var raw = dataset[r][h];
        if (raw === '' || raw === null || raw === undefined) continue;
        var num = (typeof raw === 'number') ? raw : parseFloat(raw);
        if (!Number.isFinite(num)) { allNumeric = false; break; }
        sawAny = true;
      }
      if (sawAny && allNumeric) numericCols.push(h);
    }
    return numericCols;
  }

window.radqyMergedDataset = mergedDataset;
window.radqyInferNumericColumns = inferNumericColumns;

function broadcastDataUpdated(what){
  var ev = document.createEvent('CustomEvent');
  ev.initCustomEvent('radqy:data:updated', true, true, { what: what || '' });
  window.dispatchEvent(ev);
}

  function selectRowInTable(caseNameOrNull) {
    if (!window.dt) {
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.selectedRowKey = caseNameOrNull || null;
      broadcastDataUpdated("row-select");
      return;
    }
    var participantHeaderName = getParticipantHeaderName();
    var participantIdx = window.CURRENT_HEADERS
      ? window.CURRENT_HEADERS.findIndex(function(h){ return /^Participant\b/i.test(String(h)); })
      : -1;

    window.dt.$('tr.selected').removeClass('selected');
    window.dt.$('td.active-cell').removeClass('active-cell');

    if (caseNameOrNull == null) {
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.selectedRowKey = null;
      broadcastDataUpdated("row-select");
      return;
    }
    var rowIdxToSelect = null;
    if (participantIdx >= 0 && participantHeaderName) {
      window.dt.rows().every(function (rowIdx) {
        var rowData = this.data();
        if (String(rowData[participantIdx]) === String(caseNameOrNull)) {
          rowIdxToSelect = rowIdx;
        }
      });
    } else {
      var numIdx = parseInt(caseNameOrNull, 10);
      if (!isNaN(numIdx)) rowIdxToSelect = numIdx;
    }
    if (rowIdxToSelect == null) {
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.selectedRowKey = caseNameOrNull;
      broadcastDataUpdated("row-select");
      return;
    }
    var rowNode = window.dt.row(rowIdxToSelect).node();
    if (rowNode) {
      $(rowNode).addClass('selected');
      var firstTd = rowNode.querySelector('td');
      if (firstTd) firstTd.classList.add('active-cell');
      var scrollBody = document.querySelector('.dataTables_scrollBody');
      if (scrollBody) {
        var rowRect = rowNode.getBoundingClientRect();
        var bodyRect = scrollBody.getBoundingClientRect();
        var offsetY = rowRect.top - bodyRect.top;
        scrollBody.scrollTop += offsetY - bodyRect.height / 2;
      }
    }
    if (!window.VIEW_STATE) window.VIEW_STATE = {};
    window.VIEW_STATE.selectedRowKey = caseNameOrNull;
    broadcastDataUpdated("row-select");
  }

  function bringLineToFront(caseName){
    if (!caseName || !foregroundLayer) return;
    var sel = foregroundLayer.selectAll('path.foreground-path[data-case="'+String(caseName)+'"]');
    if (!sel.empty()){
      var n = sel.node();
      n.parentNode.appendChild(n);
    }
  }

  function findRowIndexByCaseName(caseName) {
    if (!window.DATA || !Array.isArray(window.DATA.ROWS)) return -1;
    var rows = window.DATA.ROWS;
    var headers = window.DATA.HEADERS || [];
    var pHeader = getParticipantHeaderName();
    if (pHeader && headers.indexOf(pHeader) !== -1) {
      for (var i = 0; i < rows.length; i++) {
        var v = rows[i][pHeader];
        if (String(v) === String(caseName)) return i;
      }
    }
    var idx = Number(caseName);
    if (Number.isFinite(idx) && idx >= 0 && idx < rows.length) return idx;
    return -1;
  }

  function bringLineToFrontDeferred(caseName, tries){
    tries = tries || 8;
    if (!caseName || tries <= 0) return;
    var exists = foregroundLayer && !foregroundLayer.selectAll('path.foreground-path[data-case="'+String(caseName)+'"]').empty();
    if (exists) {
      bringLineToFront(caseName);
    } else {
      requestAnimationFrame(function(){ bringLineToFrontDeferred(caseName, tries - 1); });
    }
  }

  function highlightCase(caseName, on, catValOrNull) {
    if (!PARAC_SVG) return;
    var useCategoryAxis = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.kind === 'category');
    PARAC_SVG.selectAll(".foreground path").classed("pcp-hover-target-line", false);
    PARAC_SVG.selectAll(useCategoryAxis ? ".pcp-cat-tick" : ".pcp-part-tick").classed("pcp-hover-target-tick", false);
    if (useCategoryAxis){
      PARAC_SVG.selectAll(".pcp-cat-tick").each(function(){ window.zl(this, false); });
    }
    if (on){
      PARAC_SVG.selectAll('.foreground path[data-case="'+caseName+'"]').classed("pcp-hover-target-line", true);
      if (useCategoryAxis && catValOrNull != null){
        var tick = PARAC_SVG.selectAll('.pcp-cat-tick[data-cat="'+catValOrNull+'"]');
        tick.classed("pcp-hover-target-tick", true);
        tick.each(function(){ window.zl(this, true, 1.6); });
      } else {
        PARAC_SVG.selectAll('.pcp-part-tick[data-case="'+caseName+'"]').classed("pcp-hover-target-tick", true);
      }
    }

    // show zoomed P# label on hover
    setTickLabelVisibility(caseName, on, currentSelectedIndexSet());
  }

  function emitHover(caseName, on, rowIndexOrIndices) {
    var detail = { caseName: caseName, on: !!on };
    if (Array.isArray(rowIndexOrIndices)) {
      detail.indices = rowIndexOrIndices.slice();
    } else if (Number.isFinite(rowIndexOrIndices)) {
      detail.rowIndex = rowIndexOrIndices;
    }
    try {
      document.dispatchEvent(new CustomEvent("radqy:hover:change", { detail: detail }));
    } catch (e) {}
    if (window.RADQY_EVENTS && typeof window.RADQY_EVENTS.emitHover === "function") {
      window.RADQY_EVENTS.emitHover(detail);
    }
  }

  window.hoverPCPLine = function(caseName, on){
    if (!window.PARAC_SVG_GLOBAL) return;
    var svg = window.PARAC_SVG_GLOBAL;
    var useCategoryAxis = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.kind === 'category');
    svg.selectAll(".foreground path").classed("pcp-hover-target-line", false);
    svg.selectAll(".pcp-part-tick").classed("pcp-hover-target-tick", false);
    if (useCategoryAxis){
      svg.selectAll(".pcp-cat-tick").each(function(){ window.zl(this, false); });
    }
    if (on){
      svg.selectAll('.foreground path[data-case="'+caseName+'"]').classed("pcp-hover-target-line", true);
      if (useCategoryAxis){
        var cat = svg.select('.foreground path[data-case="'+caseName+'"]').attr("data-cat");
        if (cat){
          var tk = svg.selectAll('.pcp-cat-tick[data-cat="'+cat+'"]');
          tk.each(function(){ window.zl(this, true, 1.6); });
        }
      } else {
        svg.selectAll('.pcp-part-tick[data-case="'+caseName+'"]').classed("pcp-hover-target-tick", true);
      }
    }
  };

  function selectCaseAndRefresh(caseName, rowIndex) {
    var idx = Number.isFinite(rowIndex) ? rowIndex : findRowIndexByCaseName(caseName);
    if (!Number.isFinite(idx) || idx < 0) return;

    // Additive, persistent selection across all panels
    var currentArr = (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function")
      ? window.RADQY.getSelectedRowIndices().slice()
      : (window.RADQY && Array.isArray(window.RADQY._selectedIndices) ? window.RADQY._selectedIndices.slice() : []);

    var curSet = new Set(currentArr);
    if (curSet.has(idx)) {
      curSet.delete(idx); // toggle off if already selected
    } else {
      curSet.add(idx);    // add if not selected
    }
    currentArr = Array.from(curSet);

    if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function") {
      window.RADQY.setSelectedRowIndices(currentArr);
    }

    bringLineToFront(caseName);
    // keep most recent selection on top when multiple are selected
    if (window.PARAC_SVG_GLOBAL) {
      bringLineToFrontDeferred(caseName, 4);
    }
  }
  window.selectCaseAndRefresh = selectCaseAndRefresh;
  window.selectRowInTable = selectRowInTable;

  /* ===== Rendering ===== */

  function drawParallelCoordinate(dataset) {
    // sync axisBy with Color-by selection if available
    if (window.VIEW_STATE && window.VIEW_STATE.colorBy && window.VIEW_STATE.colorBy !== "P#") {
      window.CHART_STATE.axisBy = {
        kind: 'category',
        column: window.VIEW_STATE.colorBy,
        categories: Array.isArray(window.VIEW_STATE.colorByCats) ? window.VIEW_STATE.colorByCats.slice() : []
      };
    } else {
      window.CHART_STATE.axisBy = { kind: 'participant', column: 'P#', categories: [] };
    }

    PARAC_W = $PARAC().width()  - PARAC_MARGIN.left - PARAC_MARGIN.right;
    PARAC_H = $PARAC().height() - PARAC_MARGIN.top  - PARAC_MARGIN.bottom;
    if (PARAC_SVG) {
      PARAC_SVG.selectAll(".dimension").remove();
      PARAC_SVG.selectAll(".foreground").remove();
      PARAC_SVG.selectAll(".background").remove();
    }
    d3.selectAll(".pcp-axis-title-bg").remove();
    d3.selectAll(".pcp-drag-handle").remove();
    d3.selectAll(".brush .resize rect").style("fill","none").style("stroke","none");

    var AX = (window.CHART_STATE && window.CHART_STATE.axisBy) || { kind: 'participant', column: 'P#', categories: [] };
    var useCategoryAxis = AX.kind === 'category';
    var catHeader  = AX.column;
    var catDomain  = useCategoryAxis ? (AX.categories || []) : [];
    var catColor   = categoryColorScale();

    var yScale = {};
    var participantDim = useCategoryAxis ? '__CAT__' : 'P#';

    function getPLabel(row, idx){
      var pVal = null;
      if (row && row["P#"] != null) pVal = row["P#"];
      else if (row && row["p#"] != null) pVal = row["p#"];
      if (pVal != null && String(pVal).trim() !== "") return String(pVal).trim();
      return "P" + (idx + 1);
    }

    // P labels derived from data (fallback to sequential)
    var pLabels = dataset.map(function(row, i){ return getPLabel(row, i); });

    var data = dataset.map(function (row, idx) {
      var o = { case_name: getCaseName(row, idx), pLabel: pLabels[idx], __rowIndex: idx };
      // color-by category from table state
      if (window.RADQY && typeof window.RADQY.getRowCategoryForIndex === "function") {
        o.__catIdx = window.RADQY.getRowCategoryForIndex(idx) || 1;
      } else {
        o.__catIdx = 1;
      }
      window.CHART_STATE.paracMetrics.forEach(function (m) { o[m] = Number(row[m]); });
      if (useCategoryAxis) {
        var raw = row[catHeader];
        o.__cat__ = (raw == null || String(raw).trim() === "" || String(raw).toUpperCase() === "NA") ? "NA" : String(raw).trim();
      }
      return o;
    });
    if (!data.length) return;

    var goodMetrics = window.CHART_STATE.paracMetrics.filter(function(metric){
      var vals = data.map(function(d){ return d[metric]; }).filter(Number.isFinite);
      return vals.length > 0;
    });
    // remove duplicate headers
    var seenDims = {};
    goodMetrics = goodMetrics.filter(function(m){ if (seenDims[m]) return false; seenDims[m]=true; return true; });

    goodMetrics.forEach(function (metric) {
      var finiteVals = data.map(function(d){ return d[metric]; }).filter(Number.isFinite);
      var extent = d3.extent(finiteVals);
      if (extent[0] != null && extent[1] != null) {
        yScale[metric] = d3.scale.linear().domain(extent).range([PARAC_H, 0]);
      }
    });

    if (useCategoryAxis) {
      var dom = catDomain.length ? catDomain.slice() : Array.from(new Set(data.map(function(d){ return d.__cat__; })));
      var yCatScale = d3.scale.ordinal()
        .domain(dom)
        .range(dom.map(function(d, i){
          var N = dom.length;
          if (N === 1) return PARAC_H;
          var t = i / (N - 1);
          return PARAC_H - t * PARAC_H;
        }));
      yScale[participantDim] = yCatScale;
    } else {
      var participantDomain = buildParticipantDomainFromLabels(pLabels);
      var yPartScale = d3.scale.ordinal()
        .domain(participantDomain)
        .range(participantDomain.map(function(d, i){
          var N = participantDomain.length;
          if (N === 1) return PARAC_H;
          var t = i / (N - 1);
          return PARAC_H - t * PARAC_H;
        }));
      yScale[participantDim] = yPartScale;
    }

    var dimensions = goodMetrics.filter(function(m){ return !!yScale[m]; });
    dimensions.push(participantDim);
    // ensure unique dimensions
    var uniqDims = [];
    var seenD = {};
    dimensions.forEach(function(d){
      if (seenD[d]) return;
      seenD[d] = true;
      uniqDims.push(d);
    });
    dimensions = uniqDims;

    var xScale = d3.scale.ordinal().rangePoints([0, PARAC_W], 1).domain(dimensions);
    var line = d3.svg.line().interpolate('linear');
    var dragging = {};

    function position(dimName) {
      var v = dragging[dimName];
      return v == null ? xScale(dimName) : v;
    }
    function path(d) {
      return line(dimensions.map(function (p) {
        if (p === participantDim) {
          return [ xScale(p), useCategoryAxis ? yScale[p](d.__cat__) : yScale[p](d.pLabel) ];
        } else {
          return [ xScale(p), yScale[p](d[p]) ];
        }
      }));
    }
    function transition(gSel) { return gSel.transition().duration(500); }

    var background = PARAC_SVG.append("g").attr("class", "background")
      .selectAll("path").data(data).enter().append("path")
      .attr("class", "background-path").attr("d", path);

    foregroundLayer = PARAC_SVG.append("g").attr("class", "foreground");

      var domainCats = useCategoryAxis ? (catDomain.length ? catDomain.slice() : Array.from(new Set(data.map(function(d){ return d.__cat__; })))) : [];

    var selIdxSet = (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function")
      ? new Set(window.RADQY.getSelectedRowIndices())
      : new Set();

    var foreground = foregroundLayer.selectAll("path")
      .data(data)
      .enter().append("path")
      .attr("class", function (d) {
        var base = "foreground-path";
        return base + (selIdxSet.has(d.__rowIndex) ? " pcp-selected-line" : "");
      })
      .attr("data-case", function(d){ return d.case_name; })
      .attr("data-row-index", function(d){ return d.__rowIndex; })
      .attr("data-cat-idx", function(d){ return d.__catIdx || 1; })
      .attr("data-cat",  function(d){ return useCategoryAxis ? d.__cat__ : ""; })
      .attr("d", path)
      .on("mouseover", function(d){
        bringLineToFront(d.case_name);
        highlightCase(d.case_name, true, useCategoryAxis ? d.__cat__ : null);
        hoverTableRow(d.case_name, true);
        emitHover(d.case_name, true, d.__rowIndex);
      })
      .on("mouseout", function(d){
        highlightCase(d.case_name, false, useCategoryAxis ? d.__cat__ : null);
        hoverTableRow(d.case_name, false);
        emitHover(d.case_name, false, d.__rowIndex);
      })
      .on("click", function(d){
        selectCaseAndRefresh(d.case_name, d.__rowIndex);
      });

    (function publishRowCategoryMapping(){
      var useCat = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.kind === 'category');
      if (!useCat) {
        if (window.setRowCategoryClasses) window.setRowCategoryClasses({}, []);
        return;
      }
      var dom = domainCats.slice();
      var idxOf = function(v){ return Math.max(0, dom.indexOf(v)); };
      var catMap = {};
      foreground.each(function(d){
        var k = String(d.case_name);
        var ci = idxOf(d.__cat__);
        catMap[k] = ci;
      });
      if (window.setRowCategoryClasses) window.setRowCategoryClasses(catMap, dom);
    })();

    window.bringPCPLineToFront = function(caseName) {
      if (!foregroundLayer) return;
      var sel = foregroundLayer.select('path[data-case="' + caseName + '"]');
      if (!sel.empty()) {
        foregroundLayer.node().appendChild(sel.node());
      }
    };

    var g = PARAC_SVG.selectAll(".dimension")
      .data(dimensions)
      .enter().append("g")
      .attr("class", "dimension")
      .attr("transform", function (dimName) { return "translate(" + xScale(dimName) + ")"; });

    var gDrag = g.filter(function(d){ return d !== participantDim; });
    gDrag.append("rect")
      .attr("class", "pcp-drag-handle")
      .attr("x", -20).attr("y", -40)
      .attr("width", 40).attr("height", PARAC_H + 80)
      .style("fill", "transparent")
      .style("stroke", "none")
      .style("cursor", "move");

    g.filter(function(d){ return d === participantDim; }).selectAll(".pcp-drag-handle").remove();

    g.filter(function(d){ return d === participantDim; })
      .append("rect")
      .attr("x", -20).attr("y", -40)
      .attr("width", 40).attr("height", PARAC_H + 80)
      .style("fill", "transparent")
      .style("cursor", "default");

    g.filter(function(d){ return d !== participantDim; })
      .call(
        d3.behavior.drag()
          .origin(function(d){ return { x: xScale(d) }; })
          .on("dragstart", function(d){
            dragging[d] = xScale(d);
            background.attr("visibility", "hidden");
          })
          .on("drag", function(d){
            dragging[d] = Math.min(PARAC_W, Math.max(0, d3.event.x));
            dimensions.sort(function(a, b){
              if (a === participantDim && b !== participantDim) return 1;
              if (b === participantDim && a !== participantDim) return -1;
              return position(a) - position(b);
            });
            xScale.domain(dimensions);
            foreground.attr("d", path);
            g.attr("transform", function(p){ return "translate(" + position(p) + ")"; });
          })
          .on("dragend", function(d){
            delete dragging[d];
            transition(d3.select(this)).attr("transform","translate(" + xScale(d) + ")");
            transition(foreground).attr("d", path);
            background.attr("d", path).transition().delay(500).duration(0).attr("visibility", null);
          })
      );

    g.each(function(dimName) {
      var dimGroup = d3.select(this);
      if (dimName === participantDim) {
        if (useCategoryAxis) {
          renderCategoryAxis(d3.select(this), data, yScale[participantDim], PARAC_H, catDomain, catColor);
        } else {
          renderParticipantAxis(d3.select(this), data, yScale[participantDim], PARAC_H);
        }
      } else {
        var sc = yScale[dimName];
        if (sc && typeof sc === "function" && sc.copy) {
          renderNumericAxis(d3.select(this), dimName, data, sc);
        }
      }
    });

    g.filter(function(d){ return d !== participantDim; })
      .append("g")
      .attr("class", "brush")
      .each(function (d) {
        var sc = yScale[d];
        if (!sc) return;
        var b = d3.svg.brush()
          .y(sc)
          .on("brushstart", brushstart)
          .on("brush", brush)
          .on("brushend", brushend);

        d3.select(this).call(b);

        var sel = d3.select(this);
        sel.selectAll("rect")
          .attr("x", -8)
          .attr("width", 16)
          .style("fill", "none")
          .style("stroke", "none");

        sel.selectAll(".resize").select("rect")
          .style("fill", "none")
          .style("stroke", "none");
      });

    function brushstart() {
      d3.event.sourceEvent.stopPropagation();
      window.CHART_STATE.selectedCase = null;
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.selectedRowKey = null;
      if (window.dt) {
        window.dt.$('tr.selected').removeClass('selected');
        window.dt.$('td.active-cell').removeClass('active-cell');
      }
    }

    function highlightBrushedRowsInTable(caseSet) {
      if (!window.dt) return;
      var participantIdx = window.CURRENT_HEADERS ? window.CURRENT_HEADERS.findIndex(function(h){ return /^Participant\b/i.test(String(h)); }) : -1;
      window.dt.rows().every(function(rowIdx){
        var rowNode = this.node();
        if (!rowNode) return;
        rowNode.classList.remove("brushed-row");
        if (!caseSet) return;
        var rowData = this.data();
        var caseName;
        if (participantIdx >= 0) {
          caseName = String(rowData[participantIdx]);
        } else {
          caseName = String(rowIdx);
        }
        if (caseSet.has(caseName)) {
          rowNode.classList.add("brushed-row");
        }
      });
    }

    function brush() {
    var actives = dimensions.filter(function (p) {
      return p !== participantDim && yScale[p] && yScale[p].brush && !yScale[p].brush.empty();
    });
      var extents = actives.map(function (p) {
        return yScale[p].brush.extent();
      });
      var passingCaseNames = new Set();
      foreground.style("display", function (d) {
        var pass = actives.every(function (p, i) {
          return extents[i][0] <= d[p] && d[p] <= extents[i][1];
        });
        if (pass) passingCaseNames.add(d.case_name);
        return pass ? null : "none";
      });
      if (window.dt) {
        window.dt.$('tr.selected').removeClass('selected');
        window.dt.$('td.active-cell').removeClass('active-cell');
        var participantHeaderName = getParticipantHeaderName();
        var participantIdx = window.CURRENT_HEADERS ? window.CURRENT_HEADERS.findIndex(function(h){ return /^Participant\b/i.test(String(h)); }) : -1;
        window.dt.rows().every(function (rowIdx) {
          var rowData = this.data();
          var rowKey;
          if (participantIdx >= 0) rowKey = String(rowData[participantIdx]);
          else rowKey = String(rowIdx);
          if (passingCaseNames.has(rowKey)) {
            var rowNode = this.node();
            $(rowNode).addClass('selected');
          }
        });
      }
    }

    function brushend() {
      var anyActive = dimensions.some(function (p) { return p !== participantDim && yScale[p] && yScale[p].brush && !yScale[p].brush.empty(); });
      var liveForeground = foregroundLayer.selectAll("path.foreground-path");
      if (!anyActive) {
        liveForeground.classed("pcp-brush-hit", false).classed("pcp-brush-miss", false);
        highlightBrushedRowsInTable(null);
      } else {
        brush();
      }
    }

    function renderNumericAxis(dimGroup, dimName, dataArr, scaleY) {
      var groupClass = null;
      if (_hasHeaderOfType('tags', dimName)) {
        dimGroup.classed("pcp-axis-tag", true);
        groupClass = "pcp-axis-tag";
      } else if (_hasHeaderOfType('iqms', dimName)) {
        dimGroup.classed("pcp-axis-iqms", true);
        groupClass = "pcp-axis-iqms";
      } else if (_hasHeaderOfType('exts', dimName)) {
        dimGroup.classed("pcp-axis-ext", true);
        groupClass = "pcp-axis-ext";
      } else if (_hasHeaderOfType('auxs', dimName)) {
        dimGroup.classed("pcp-axis-aux", true);
        groupClass = "pcp-axis-aux";
      }
      var finiteVals = dataArr.map(function (r) { return r[dimName]; }).filter(function (v) { return Number.isFinite(v); });
      var minVal = d3.min(finiteVals);
      var maxVal = d3.max(finiteVals);
      var midVal = (minVal + maxVal) / 2;
      var maxRounded = Math.round(maxVal);

      dimGroup.append("line")
        .attr("class", "pcp-axis-stem")
        .attr("x1", 0).attr("x2", 0)
        .attr("y1", scaleY(maxVal)).attr("y2", scaleY(minVal));

      var customTicks = [{ val: minVal }, { val: midVal }, { val: maxVal }];
      var axisG = dimGroup.append("g").attr("class", "axis");
      axisG.selectAll("line.pcp-tick-line")
        .data(customTicks)
        .enter().append("line")
        .attr("class", "pcp-tick-line")
        .attr("x1", -4).attr("x2",  4)
        .attr("y1", function(d){ return scaleY(d.val); })
        .attr("y2", function(d){ return scaleY(d.val); });

      dimGroup.append("text")
        .attr("class", "pcp-ext-label pcp-ext-label-max")
        .attr("text-anchor", "middle")
        .attr("x", 0).attr("y", scaleY(maxVal) - 4)
        .text(prettyNumber(maxRounded));

      var minLabelText = (Math.abs(minVal) < 1e-9) ? "0" : prettyNumber(minVal);
      dimGroup.append("text")
        .attr("class", "pcp-ext-label pcp-ext-label-min")
        .attr("text-anchor", "middle")
        .attr("x", 0).attr("y", scaleY(minVal) + 1)
        .text(minLabelText);

      var titleY = scaleY(maxVal) - 24;
      var titleSel = dimGroup.append("text")
        .attr("class", "pcp-axis-title")
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", titleY)
        .text(dimName);

      if (groupClass) {
        var tb = titleSel.node().getBBox();
        var padX = 4, padY = 2;
        dimGroup.selectAll(".pcp-axis-title-bg").remove();
        dimGroup.insert("rect", ".pcp-axis-title")
          .attr("class", "pcp-axis-title-bg " + groupClass + "-bg")
          .attr("x", tb.x - padX)
          .attr("y", tb.y - padY)
          .attr("rx", 3).attr("ry", 3)
          .attr("width", tb.width + padX * 2)
          .attr("height", tb.height + padY * 2);
      }
    }

  function renderParticipantAxis(dimGroup, dataArr, partScale) {
      var domain = partScale.domain ? partScale.domain() : [];
      var N = domain.length;
      var firstCase = domain[0];
      var lastCase  = domain[N - 1];
      var yPosByCase = {};
      domain.forEach(function(name){ yPosByCase[name] = partScale(name); });
      var yBottom = yPosByCase[firstCase];
      var yTop    = yPosByCase[lastCase];

      dimGroup.append("line")
        .attr("class", "pcp-part-axis-line")
        .attr("x1", 0).attr("x2", 0)
        .attr("y1", yTop).attr("y2", yBottom)
        .style("stroke-width", "4px");

      var tickData = [{ y: yBottom, name: firstCase }, { y: yTop, name: lastCase }];
      dimGroup.append("g")
        .attr("class", "axis")
        .selectAll("line.pcp-tick-line")
        .data(tickData)
        .enter().append("line")
        .attr("class", "pcp-tick-line")
        .attr("x1", -4).attr("x2", 4)
        .attr("y1", function(d){ return d.y; })
        .attr("y2", function(d){ return d.y; });

      var ticks = dimGroup.selectAll(".pcp-part-tick")
      .data(dataArr)
      .enter()
      .append("g")
      .attr("class", function(d){
          var selIdx = (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function")
            ? new Set(window.RADQY.getSelectedRowIndices())
            : new Set();
          return selIdx.has(d.__rowIndex) ? "pcp-part-tick pcp-selected-tick" : "pcp-part-tick";
        })
        .attr("data-case", function(d){ return d.case_name; })
        .attr("data-row-index", function(d){ return d.__rowIndex; })
        .attr("transform", function(d){ return "translate(0," + yPosByCase[d.pLabel] + ")"; })
        .style("cursor", "pointer")
        .on("mouseover", function(d){
          bringLineToFront(d.case_name);
          highlightCase(d.case_name, true);
          hoverTableRow(d.case_name, true);
          emitHover(d.case_name, true, d.__rowIndex);
        })
        .on("mouseout", function(d){
          highlightCase(d.case_name, false);
          hoverTableRow(d.case_name, false);
          emitHover(d.case_name, false, d.__rowIndex);
        })
        .on("click", function(d){
          selectCaseAndRefresh(d.case_name, d.__rowIndex);
        });

      ticks.append("line")
      .attr("class", "pcp-part-tick-line")
      .attr("x1", 0).attr("x2", 10)
      .attr("y1", 0).attr("y2", 0)
      .style("stroke-width", "1px");

      ticks.append("text")
        .attr("class", "pcp-part-p-label")
        .attr("x", 12)
        .attr("y", 4)
        .text(function(d){ return d.pLabel || ("P" + (d.__rowIndex + 1)); })
        .style("opacity", 0);

      ticks.filter(function(d,i){ return i === 0 || i === N-1; })
        .append("text")
        .attr("class", function(d,i){
          var base = "pcp-part-tick-label pcp-ext-label ";
          if (i === 0) return base + "pcp-ext-label-min pcp-end-label";
          return base + "pcp-ext-label-max pcp-end-label";
        })
        .attr("text-anchor", "middle")
        .attr("x", 2)
        .attr("y", function(d,i){ return (i === 0) ? 3 : -4; })
        .attr("dx", 0)
        .text(function(d){ return d.pLabel || ("P" + (d.__rowIndex + 1)); });

      dimGroup.append("text")
        .attr("class", "pcp-axis-title")
        .attr("text-anchor", "middle")
        .attr("x", 0)
        .attr("y", yTop - 24)
        .text("P#");
    }

    function rightRoomPxForAxis(dimGroup, startX) {
      startX = (startX == null) ? 14 : startX;
      var svg   = document.getElementById("parac-svg");
      var shell = document.getElementById("chart-shell") || document.body;
      if (!svg || !shell) return 140;
      var gNode = dimGroup.node();
      var ctm   = gNode.getCTM ? gNode.getCTM() : null;
      if (!ctm) return 140;
      var pt = svg.createSVGPoint();
      pt.x = startX; pt.y = 0;
      var screenPt = pt.matrixTransform(ctm);
      var sh = shell.getBoundingClientRect();
      return Math.max(60, Math.min(320, (sh.right - screenPt.x - 6)));
    }

    function renderCategoryAxis(dimGroup, dataArr, catScale, h, domain, colorFn) {
      var yByCat = {};
      domain.forEach(function(c){ yByCat[c] = catScale(c); });

      function normCat(v){
        if (typeof window.normalizeCategoryValue === "function") {
          return window.normalizeCategoryValue("", v);
        }
        if (v == null) return "NA";
        var t = String(v).trim();
        return t === "" ? "NA" : t;
      }

      function catIdxForValue(v){
        var map = window.VIEW_STATE && window.VIEW_STATE.colorByMap;
        var norm = normCat(v);
        if (map && typeof map.get === "function") {
          var m = map.get(norm);
          if (Number.isFinite(m)) return m;
        }
        var idx = domain.indexOf(v);
        return idx >= 0 ? ((idx % 5) + 2) : 1;
      }

      dimGroup.append("line")
        .attr("class", "pcp-part-axis-line")
        .attr("x1", 0).attr("x2", 0)
        .attr("y1", d3.min(domain, function(c){ return yByCat[c]; }))
        .attr("y2", d3.max(domain, function(c){ return yByCat[c]; }));

      var ticks = dimGroup.selectAll(".pcp-cat-tick")
        .data(domain)
        .enter().append("g")
        .attr("class", "pcp-cat-tick")
        .attr("data-cat", function(d){ return d; })
        .attr("transform", function(d){ return "translate(0," + yByCat[d] + ")"; })
        .style("cursor", "pointer");

      ticks.append("line")
        .attr("class", "pcp-part-tick-line")
        .attr("x1", 0).attr("x2", 5)
        .attr("y1", 0).attr("y2", 0)
        .style("stroke-width", "1px");

      // add category badges with background color
      ticks.append("rect")
        .attr("class", "pcp-cat-badge")
        .attr("x", 7)
        .attr("y", -8)
        .attr("rx", 3).attr("ry", 3)
        .attr("height", 14)
        .attr("width", function(d){
          var text = d || "";
          return Math.max(24, 4 + text.length * 5); // width based on text length
        })
        .attr("data-width", function(d){
          var text = d || "";
          return Math.max(24, 4 + text.length * 5);
        })
        .style("fill", function(d){
          var idx = catIdxForValue(d);
          return catColorFromIndex(idx);
        })
        .attr("data-color-idx", function(d){ return catIdxForValue(d); });
      latestCategoryTicks = ticks;
      updateCategoryBadgeSelection();

      // text on top of badge
      ticks.append("text")
        .attr("class", "pcp-part-tick-label pcp-end-label")
        .attr("text-anchor", "start")
        .attr("x", 10)
        .attr("y", 2)
        .text(function(d){ return d; });

      ticks.select("text").style("pointer-events", "none");

      // adjust widths to fit available space
      (function fitBadges(){
        var roomPx = rightRoomPxForAxis(dimGroup, 12);
        ticks.each(function(){
          var tick = d3.select(this);
          var badge = tick.select(".pcp-cat-badge");
          var textEl = tick.select("text");
          var desired = Number(badge.attr("data-width")) || 32;
          var maxW = Math.max(24, roomPx - 6);
          var finalW = Math.min(desired, maxW);
          badge.attr("width", finalW);
          // shrink text if necessary
          textEl
            .attr("textLength", null)
            .attr("lengthAdjust", null);
          var pad = 10;
          if (desired > finalW) {
            var textRoom = Math.max(8, finalW - pad);
            textEl
              .attr("textLength", textRoom)
              .attr("lengthAdjust", "spacingAndGlyphs");
          }
        });
      })();

      ticks.on("mouseover", function(cat){
          // badge hover color
          d3.select(this).select(".pcp-cat-badge").each(function(){
            var idx = Number(d3.select(this).attr("data-color-idx") || 1);
            d3.select(this).style("fill", catHoverColorFromIndex(idx));
          });
          // highlight matching lines
          var rows = window.DATA && Array.isArray(window.DATA.ROWS) ? window.DATA.ROWS : [];
          var idxs = [];
          for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var val = row ? row[window.VIEW_STATE && window.VIEW_STATE.colorBy] : null;
            if (normCat(val) === normCat(cat)) idxs.push(i);
          }
          var idxSetHover = new Set(idxs);
          PARAC_SVG.selectAll('.foreground path')
            .each(function(){
              var sel = d3.select(this);
              var idx = Number(sel.attr("data-row-index"));
              if (idxSetHover.has(idx)) {
                sel.classed("pcp-hover-target-line", true);
                var catIdx = Number(sel.attr("data-cat-idx") || 1);
                sel
                  .style("stroke", catHoverColorFromIndex(catIdx))
                  .style("stroke-width", "3px")
                  .style("opacity", 1);
                bringLineToFront(sel.attr("data-case"));
              } else {
                sel.classed("pcp-hover-target-line", false);
              }
            });
          d3.select(this).classed("pcp-hover-target-tick", true);
          window.zl(this, true, 1.6);

          if (typeof window.hoverTableRow === "function") {
            idxs.forEach(function(i){
              var name = caseNameForIndex(i);
              hoverTableRow(name, true);
            });
          }
          emitHover(cat, true, idxs);
        })
        .on("mouseout", function(){
          // reset badge color
          d3.select(this).select(".pcp-cat-badge").each(function(){
            var idx = Number(d3.select(this).attr("data-color-idx") || 1);
            d3.select(this).style("fill", catColorFromIndex(idx));
          });
          PARAC_SVG.selectAll('.foreground path')
            .classed("pcp-hover-target-line", false)
            .style("stroke", null)
            .style("stroke-width", null)
            .style("opacity", null);
          d3.select(this).classed("pcp-hover-target-tick", false);
          window.zl(this, false);
          if (typeof window.hoverTableRow === "function") {
            window.hoverTableRow(null, false);
          }
          emitHover(null, false, []);
          updateCategoryBadgeSelection();
        })
        .on("click", function(cat){
          // select all rows belonging to this category
          if (typeof window.RADQY === "object" && typeof window.RADQY.getSelectedRowIndices === "function") {
            var rows = window.DATA && Array.isArray(window.DATA.ROWS) ? window.DATA.ROWS : [];
            var idxs = [];
            for (var i = 0; i < rows.length; i++) {
              var row = rows[i];
              var val = row ? row[window.VIEW_STATE && window.VIEW_STATE.colorBy] : null;
              if (normCat(val) === normCat(cat)) idxs.push(i);
            }
            if (idxs.length && typeof window.RADQY.setSelectedRowIndices === "function") {
              var current = (typeof window.RADQY.getSelectedRowIndices === "function")
                ? window.RADQY.getSelectedRowIndices()
                : [];
              var curSet = new Set(current);
              var allIn = idxs.every(function(i){ return curSet.has(i); });
              var next = [];
              if (allIn) {
                // deselect this class
                current.forEach(function(i){ if (!idxs.includes(i)) next.push(i); });
                // reset badge color to base
                d3.select(this).select(".pcp-cat-badge").each(function(){
                  var idx = Number(d3.select(this).attr("data-color-idx") || 1);
                  d3.select(this).style("fill", catColorFromIndex(idx));
                });
              } else {
                // add this class
                next = Array.from(new Set(current.concat(idxs)));
                // set badge to selected color
                d3.select(this).select(".pcp-cat-badge").each(function(){
                  var idx = Number(d3.select(this).attr("data-color-idx") || 1);
                  d3.select(this).style("fill", catSelectColorFromIndex(idx));
                });
              }
              window.RADQY.setSelectedRowIndices(next);
            }
          }
        });

      (function fitToRightEdge(){
        var roomPx = rightRoomPxForAxis(dimGroup, 14);
        ticks.select("text").each(function(){
          var el = this;
          var t  = d3.select(el);
          t.attr("textLength", null).attr("lengthAdjust", null);
          var w = el.getComputedTextLength();
          if (w > roomPx) {
            t.attr("textLength", roomPx).attr("lengthAdjust", "spacingAndGlyphs");
          }
        });
      })();

      var axisCol  = (window.CHART_STATE && window.CHART_STATE.axisBy && window.CHART_STATE.axisBy.column) || "Category";
      var tY       = d3.min(domain, function(c){ return yByCat[c]; }) - 24;
      var tSel = dimGroup.append("text")
        .attr("class", "pcp-axis-title pcp-axis-title-participant")
        .attr("text-anchor", "middle")
        .attr("x", 0).attr("y", tY)
        .text(axisCol);

      var gClass = _classForHeader(axisCol);
      if (gClass) {
        var tb = tSel.node().getBBox();
        var padX = 4, padY = 2;
        dimGroup.insert("rect", ".pcp-axis-title")
          .attr("class", "pcp-axis-title-bg " + gClass + "-bg")
          .attr("x", tb.x - padX)
          .attr("y", tb.y - padY)
          .attr("rx", 3).attr("ry", 3)
          .attr("width",  tb.width  + padX * 2)
          .attr("height", tb.height + padY * 2);
      }
    }
  }

  function renderAll() {
    var dataset = (window.DATA && Array.isArray(window.DATA.ROWS))
      ? window.DATA.ROWS
      : mergedDataset();
    if (!dataset.length || !_headers().length) {
      // empty dataset: clear PCP contents but keep containers
      d3.select("#chart-svg-container").selectAll("*").remove();
      d3.select("#parac-svg-container").selectAll("*").remove();
      return;
    }

    if (!window.CURRENT_HEADERS || !window.CURRENT_HEADERS.length) {
      window.CURRENT_HEADERS = _headers();
    }

    CHART_MARGIN  = { top: 10, right: 60, bottom: 100, left: 0 };
    PARAC_MARGIN  = { top: 60, right: 40, bottom: 100, left: 10 };   // right margin

    if (!$CHART().height()) $CHART().css('height', '260px');
    if (!$PARAC().height()) $PARAC().css('height', '260px');

    var numericNow = inferNumericColumns(dataset);

    var defaultMetric = (window.CHART_STATE && window.CHART_STATE.measureBy && numericNow.indexOf(window.CHART_STATE.measureBy) !== -1)
      ? window.CHART_STATE.measureBy
      : (numericNow[0] || null);

    if (!window.CHART_STATE.initialized) {
      window.CHART_STATE.paracMetrics = numericNow.slice();
      window.CHART_STATE.currentMetric = defaultMetric;
      window.CHART_STATE.visType = 'parallel_coordinate';
      window.CHART_STATE.initialized = true;
    } else {
      window.CHART_STATE.paracMetrics = numericNow.slice();
      if (numericNow.indexOf(window.CHART_STATE.currentMetric) === -1) {
        window.CHART_STATE.currentMetric = defaultMetric;
      }
    }

    window.CHART_STATE.selectedCase = (window.VIEW_STATE && window.VIEW_STATE.selectedRowKey) ? window.VIEW_STATE.selectedRowKey : null;

    d3.select("#chart-svg-container").selectAll("*").remove();
    d3.select("#parac-svg-container").selectAll("*").remove();

    CHART_SVG = d3.select("#chart-svg-container")
      .append("svg").attr("id", "chart-svg")
      .attr("width",  $CHART().width())
      .attr("height", $CHART().height())
      .append("g")
      .attr("transform","translate(" + CHART_MARGIN.left + "," + CHART_MARGIN.top + ")");

    PARAC_SVG = d3.select("#parac-svg-container")
      .append("svg").attr("id", "parac-svg")
      .attr("width",  $PARAC().width())
      .attr("height", $PARAC().height())
      .append("g")
      .attr("transform","translate(" + PARAC_MARGIN.left + "," + PARAC_MARGIN.top + ")");

    window.PARAC_SVG_GLOBAL = PARAC_SVG;

    if (window.RadqyBarChart && typeof window.RadqyBarChart.render === 'function'){
      window.RadqyBarChart.render(
        CHART_SVG,
        $CHART().width(),
        $CHART().height(),
        CHART_MARGIN,
        dataset,
        window.CHART_STATE.currentMetric,
        window.CHART_STATE,
        function getPLabel(row, idx){ return "P" + (idx + 1); },
        function(name){ selectCaseAndRefresh(name); }
      );
      if (window.refreshBarSortOptions) window.refreshBarSortOptions();
    }

    drawParallelCoordinate(dataset);
    applyVisType();

    if (window.CHART_STATE.selectedCase) bringLineToFrontDeferred(window.CHART_STATE.selectedCase);
    // Ensure selected lines remain on top after render
    requestAnimationFrame(function(){
      applyPCPSelectionHighlight(currentSelectedIndexSet());
    });
  }

  function applyVisType() {
    var $btn  = $("#vis-switch-btn");
    var $pcp  = $('#parac-svg-container');
    var $bars = $('#chart-svg-container');
    if (window.CHART_STATE.visType === "bar_chart") {
      $bars.show(); $pcp.hide(); $btn.text("Switch to PCP");
    } else {
      $pcp.show(); $bars.hide(); $btn.text("Switch to BAR");
    }
    if (window.updateBarSortVisibility) window.updateBarSortVisibility();
    if (window.updateBarMetricVisibility) window.updateBarMetricVisibility();
  }

  $(document).on("click", "#vis-switch-btn", function () {
    window.CHART_STATE.visType = (window.CHART_STATE.visType === "bar_chart") ? "parallel_coordinate" : "bar_chart";
    applyVisType();
    // Re-render in the now-visible mode so layout uses the correct container size
    if (typeof window.renderChartsView === "function") {
      window.renderChartsView();
    }
  });

  document.addEventListener("click", function () {
    ensureChartToggleButton();
    ensureAxisByControl();
    populateAxisByOptions();
    populateMetricOptions();
  });

  // ---------- Selection highlight helper (index-based) ----------
  function currentSelectedIndexSet() {
    const idxs = (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function")
      ? window.RADQY.getSelectedRowIndices()
      : [];
    return new Set(
      (idxs || []).filter(v => Number.isFinite(v)).map(v => v)
    );
  }

  function caseNameForIndex(idx){
    var rows = (window.DATA && window.DATA.ROWS) || [];
    var headers = (window.DATA && window.DATA.HEADERS) || [];
    var pHeader = getParticipantHeaderName();
    var row = rows[idx];
    if (!row) return String(idx);
    if (pHeader && row[pHeader] != null && String(row[pHeader]).trim() !== "") return String(row[pHeader]);
    return "P" + (idx + 1);
  }

  function reorderPCPLines(orderArr){
    if (!foregroundLayer || !Array.isArray(orderArr)) return;
    orderArr.forEach(function(idx){
      var caseName = caseNameForIndex(idx);
      if (caseName) bringLineToFront(caseName);
    });
  }

  function setTickLabelVisibility(hoverCase, onHover, selSet) {
    selSet = selSet || currentSelectedIndexSet();
    if (!window.PARAC_SVG_GLOBAL) return;
    var svg = window.PARAC_SVG_GLOBAL;
    svg.selectAll(".pcp-part-p-label")
      .each(function(){
        var parent = d3.select(this.parentNode);
        var caseName = parent.attr("data-case");
        var rowIdx = Number(parent.attr("data-row-index"));
        var isSel = selSet.has(rowIdx);
        var isHover = hoverCase && String(caseName) === String(hoverCase) && onHover;
        var show = isSel || isHover;
        d3.select(this)
          .style("opacity", show ? 1 : 0)
          .classed("is-hover", !!isHover)
          .classed("is-selected", !!isSel);
      });
  }

  var latestCategoryTicks = null;

  function updateCategoryBadgeSelection() {
    if (!latestCategoryTicks) return;
    var colorBy = (window.VIEW_STATE && window.VIEW_STATE.colorBy) || null;
    var rows = (window.DATA && Array.isArray(window.DATA.ROWS)) ? window.DATA.ROWS : [];
    if (!rows || !rows.length) return;
    var normFn = (typeof window.normalizeCategoryValue === "function")
      ? window.normalizeCategoryValue
      : function(_h, v){ if (v == null) return "NA"; var t=String(v).trim(); return t===""?"NA":t; };
    var selSet = currentSelectedIndexSet();

    latestCategoryTicks.each(function(){
      var tick = d3.select(this);
      var cat = tick.attr("data-cat");
      var badge = tick.select(".pcp-cat-badge");
      if (badge.empty()) return;
      var idxAttr = badge.attr("data-color-idx");
      var idx = Number(idxAttr);
      if (!Number.isFinite(idx) || idx <= 0) idx = 1;
      var baseColor = catColorFromIndex(idx);
      var selColor  = catSelectColorFromIndex(idx);

      if (!colorBy || colorBy === "P#") {
        badge.style("fill", baseColor);
        tick.classed("selected", false);
        return;
      }

      var matching = [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var val = row ? row[colorBy] : null;
        if (normFn(colorBy, val) === normFn(colorBy, cat)) matching.push(i);
      }

      var allSelected = matching.length && matching.every(function(i){ return selSet.has(i); });
      badge.style("fill", allSelected ? selColor : baseColor);
      tick.classed("selected", !!allSelected);
    });
  }

  function applyPCPSelectionHighlight(idxSet) {
    const set = (idxSet && idxSet.size) ? idxSet : currentSelectedIndexSet();
    if (!window.PARAC_SVG_GLOBAL) return;
    const svg = window.PARAC_SVG_GLOBAL;

    svg.selectAll("path.foreground-path").classed("pcp-selected-line", function () {
      const idx = Number(d3.select(this).attr("data-row-index"));
      return set.has(idx);
    });

    svg.selectAll(".pcp-part-tick").classed("pcp-selected-tick", function () {
      const idx = Number(d3.select(this).attr("data-row-index"));
      return set.has(idx);
    });

    var last = window.RADQY_LAST_SELECTED;
    if (!Number.isFinite(last) || !set.has(last)) {
      last = set.size ? set.values().next().value : null;
    }
    if (Number.isFinite(last)) {
      bringLineToFrontDeferred(caseNameForIndex(last));
    }

    // maintain render order for all selected lines (latest on top)
    reorderPCPLines(Array.from(set));
    setTickLabelVisibility(null, false, set);
  }

  document.addEventListener('radqy:data:ready', function () {
    var upload = document.getElementById('upload-section');
    if (upload) upload.style.display = 'none';
    var tableView  = document.getElementById('table-view');
    var chartsView = document.getElementById('charts-view');
    if (tableView)  tableView.style.display  = '';
    if (chartsView) chartsView.style.display = '';

    var tBtn = document.getElementById('toggle-table-button');
    var cBtn = document.getElementById('toggle-chart-button');
    if (tBtn) tBtn.style.display = '';
    if (cBtn) cBtn.style.display = '';

    ensureAxisByControl();
    populateAxisByOptions();
    populateMetricOptions();
    renderAll();
  });

  function handleDataUpdated(e){
    // Recompute Color-by categories from current data so deleted classes disappear
    var header = (window.VIEW_STATE && window.VIEW_STATE.colorBy) ? window.VIEW_STATE.colorBy : null;
    if (header && header !== "P#" && window.DATA && Array.isArray(window.DATA.ROWS)) {
      var normFn = (typeof window.normalizeCategoryValue === "function")
        ? window.normalizeCategoryValue
        : function(_h, v){ if (v == null) return "NA"; var t=String(v).trim(); return t===""?"NA":t; };
      var seen = new Set();
      var cats = [];
      window.DATA.ROWS.forEach(function(r){
        var v = r ? r[header] : null;
        var n = normFn(header, v);
        if (!seen.has(n)) { seen.add(n); cats.push(n); }
      });
      if (!window.CHART_STATE) window.CHART_STATE = {};
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.CHART_STATE.axisBy = {
        kind: 'category',
        column: header,
        categories: cats.slice()
      };
      window.VIEW_STATE.colorByCats = cats.slice();
    }

    populateAxisByOptions();
    populateMetricOptions();
    renderAll();
    applyPCPSelectionHighlight(currentSelectedIndexSet());
    var detail = e && e.detail;
    if (detail && detail.what === "delete") {
      // ensure no stale selection references removed rows
      applyPCPSelectionHighlight(new Set());
      window.RADQY_LAST_SELECTED = null;
    }
  }

  window.addEventListener('radqy:data:updated', handleDataUpdated);
  document.addEventListener('radqy:data:updated', handleDataUpdated);

  document.addEventListener("radqy:view:columns", function(e){
    if (e && e.detail && Array.isArray(e.detail.hidden)) {
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.hiddenHeaders = new Set(e.detail.hidden.map(function(x){ return String(x); }));
    }
    renderAll();
  });

  // Re-render PCP when table order changes (e.g., sort) so row indices stay in sync
  document.addEventListener("radqy:table:sorted", function(){
    renderAll();
    applyPCPSelectionHighlight(currentSelectedIndexSet());
  });

  document.addEventListener("radqy:selection-changed", function(e){
    var indices = (e && e.detail && (e.detail.indices || e.detail.selectedIndices)) ? (e.detail.indices || e.detail.selectedIndices) : [];
    var idxSet = new Set((indices || []).filter(function(v){ return Number.isFinite(v); }).map(function(v){ return v; }));
    applyPCPSelectionHighlight(idxSet);
    updateCategoryBadgeSelection();

    // direct class update to avoid losing highlights on re-render timing
    if (window.PARAC_SVG_GLOBAL) {
      var svg = window.PARAC_SVG_GLOBAL;
      svg.selectAll("path.foreground-path").classed("pcp-selected-line", function () {
        var idx = Number(d3.select(this).attr("data-row-index"));
        return idxSet.has(idx);
      });
      svg.selectAll(".pcp-part-tick").classed("pcp-selected-tick", function () {
        var idx = Number(d3.select(this).attr("data-row-index"));
        return idxSet.has(idx);
      });
    }

    // ensure ordering follows selection sequence
    var orderArr = Array.isArray(indices) ? indices
      : (Array.isArray(e && e.detail && e.detail.selectedIndices) ? e.detail.selectedIndices
      : (window.RADQY && Array.isArray(window.RADQY._selectedIndices) ? window.RADQY._selectedIndices : []));
    reorderPCPLines(orderArr);
  });

  // Hover sync from other panels
  document.addEventListener("radqy:hover:change", function(e){
    var det = e && e.detail ? e.detail : {};
    var caseName = det.caseName != null ? String(det.caseName) : null;
    var on = !!det.on;
    if (!caseName) {
      highlightCase("", false);
      return;
    }
    highlightCase(caseName, on);
  });

  document.addEventListener("radqy:colorby:changed", function(e){
    var det = e && e.detail;
    if (!window.CHART_STATE) window.CHART_STATE = {};
    if (det && det.header) {
      window.CHART_STATE.axisBy = {
        kind: 'category',
        column: det.header,
        categories: Array.isArray(det.categories) ? det.categories.slice() : []
      };
    } else {
      window.CHART_STATE.axisBy = { kind:'participant', column:'P#', categories: [] };
    }
    renderAll();
    applyPCPSelectionHighlight(currentSelectedIndexSet());
  });

  window.renderChartsView = renderAll;
})();

/* Keep bar sort options fresh when aux sections load */
window.addEventListener('radqy:data:updated', function () {
  if (window.refreshBarSortOptions) window.refreshBarSortOptions();
});
window.addEventListener('radqy:auxs:loaded', function () {
  if (window.refreshBarSortOptions) window.refreshBarSortOptions();
});

/* Rerender on resize */
window.addEventListener('resize', function () {
  if (typeof window.renderChartsView === 'function') {
    window.renderChartsView();
  }
});
