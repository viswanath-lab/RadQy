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

  function inferNumericColumns(dataset) {
    if (!dataset.length) return [];
    var allHeaders = Array.isArray(window.CURRENT_HEADERS) ? window.CURRENT_HEADERS.slice() : Object.keys(dataset[0]);
    var hidden = (window.VIEW_STATE && window.VIEW_STATE.hiddenHeaders) ? window.VIEW_STATE.hiddenHeaders : new Set();

    var numericCols = [];
    for (var i=0;i<allHeaders.length;i++){
      var h = allHeaders[i];
      if (!h) continue;
      if (/^Participant\b/i.test(h)) continue;
      if (String(h).trim() === 'P#') continue;
      if (hidden && typeof hidden.has === 'function' && hidden.has(h)) continue;

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
    if (!caseName) return;
    var sel = d3.select('#parac-svg').selectAll('path.foreground-path[data-case="'+String(caseName)+'"]');
    if (!sel.empty()){
      var n = sel.node();
      n.parentNode.appendChild(n);
    }
  }

  function bringLineToFrontDeferred(caseName, tries){
    tries = tries || 8;
    if (!caseName || tries <= 0) return;
    var exists = !d3.select('#parac-svg').selectAll('path.foreground-path[data-case="'+String(caseName)+'"]').empty();
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

  function selectCaseAndRefresh(caseName) {
    if (window.CHART_STATE.selectedCase === caseName) {
      window.CHART_STATE.selectedCase = null;
      selectRowInTable(null);
      if (foregroundLayer) {
        foregroundLayer.selectAll("path.foreground-path").classed("pcp-selected-line", false);
      }
    } else {
      window.CHART_STATE.selectedCase = caseName;
      selectRowInTable(caseName);
      if (foregroundLayer) {
        foregroundLayer.selectAll("path.foreground-path").classed("pcp-selected-line", false);
        foregroundLayer.select('path[data-case="' + caseName + '"]').classed("pcp-selected-line", true).style("opacity", null).style("stroke-width", null);
        bringLineToFrontDeferred(caseName);
      }
    }
    renderAll();
    if (window.RadqyBarChart && typeof window.RadqyBarChart.selectFromTable === "function") {
      window.RadqyBarChart.selectFromTable(caseName, !!caseName);
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

    var data = dataset.map(function (row, idx) {
      var o = { case_name: getCaseName(row, idx), pLabel: "P" + (idx + 1) };
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
      var participantDomain = data.map(function(d){ return d.case_name; });
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
          return [ xScale(p), useCategoryAxis ? yScale[p](d.__cat__) : yScale[p](d.case_name) ];
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

    var foreground = foregroundLayer.selectAll("path")
      .data(data)
      .enter().append("path")
      .attr("class", function (d) {
        var base = "foreground-path";
        if (!useCategoryAxis) return base + (window.CHART_STATE.selectedCase === d.case_name ? " pcp-selected-line" : "");
        var idx = Math.max(0, domainCats.indexOf(d.__cat__));
        return base + " cat-" + idx + (window.CHART_STATE.selectedCase === d.case_name ? " pcp-selected-line" : "");
      })
      .attr("data-case", function(d){ return d.case_name; })
      .attr("data-cat",  function(d){ return useCategoryAxis ? d.__cat__ : ""; })
      .attr("d", path)
      .on("mouseover", function(d){
        bringLineToFront(d.case_name);
        highlightCase(d.case_name, true, useCategoryAxis ? d.__cat__ : null);
        hoverTableRow(d.case_name, true);
      })
      .on("mouseout", function(d){
        highlightCase(d.case_name, false, useCategoryAxis ? d.__cat__ : null);
        hoverTableRow(d.case_name, false);
      })
      .on("click", function(d){
        selectCaseAndRefresh(d.case_name);
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

    if (window.CHART_STATE.selectedCase) {
      bringLineToFrontDeferred(window.CHART_STATE.selectedCase);
      foregroundLayer.selectAll("path.foreground-path").classed("pcp-selected-line", function() {
        return d3.select(this).attr("data-case") === window.CHART_STATE.selectedCase;
      });
      if (window.CHART_STATE.dimOthersOnSelect) {
        foregroundLayer.selectAll("path.foreground-path").filter(function() {
          return d3.select(this).attr("data-case") !== window.CHART_STATE.selectedCase;
        }).style("opacity", 0.08).style("stroke-width", "1px");
      } else {
        foregroundLayer.selectAll("path.foreground-path").style("opacity", null).style("stroke-width", null);
      }
    }

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
      var N = dataArr.length;
      var firstCase = dataArr[0];
      var lastCase  = dataArr[N - 1];
      var yPosByCase = {};
      dataArr.forEach(function(d){ yPosByCase[d.case_name] = partScale(d.case_name); });
      var yBottom = yPosByCase[firstCase.case_name];
      var yTop    = yPosByCase[lastCase.case_name];

      dimGroup.append("line")
        .attr("class", "pcp-part-axis-line")
        .attr("x1", 0).attr("x2", 0)
        .attr("y1", yTop).attr("y2", yBottom)
        .style("stroke-width", "4px");

      var tickData = [{ y: yBottom }, { y: yTop }];
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
          return (window.CHART_STATE.selectedCase === d.case_name) ? "pcp-part-tick pcp-selected-tick" : "pcp-part-tick";
        })
        .attr("data-case", function(d){ return d.case_name; })
        .attr("transform", function(d){ return "translate(0," + yPosByCase[d.case_name] + ")"; })
        .style("cursor", "pointer")
        .on("mouseover", function(d){
          bringLineToFront(d.case_name);
          highlightCase(d.case_name, true);
          hoverTableRow(d.case_name, true);
        })
        .on("mouseout", function(d){
          highlightCase(d.case_name, false);
          hoverTableRow(d.case_name, false);
        })
        .on("click", function(d){
          selectCaseAndRefresh(d.case_name);
        });

      ticks.append("line")
        .attr("class", "pcp-part-tick-line")
        .attr("x1", 0).attr("x2", 10)
        .attr("y1", 0).attr("y2", 0)
        .style("stroke-width", "1px");

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
        .text(function(d,i){ return "P" + (i+1); });

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
        .attr("x1", 0).attr("x2", 10)
        .attr("y1", 0).attr("y2", 0)
        .style("stroke-width", "2px");

      ticks.append("text")
        .attr("class", "pcp-part-tick-label pcp-end-label")
        .attr("text-anchor", "start")
        .attr("x", 14)
        .attr("y", 3)
        .text(function(d){ return d; });

      ticks.select("text").style("pointer-events", "none");

      ticks.on("mouseover", function(cat){
          PARAC_SVG.selectAll('.foreground path[data-cat="'+cat+'"]').classed("pcp-hover-target-line", true);
          d3.select(this).classed("pcp-hover-target-tick", true);
          window.zl(this, true, 1.6);
        })
        .on("mouseout", function(){
          PARAC_SVG.selectAll('.foreground path').classed("pcp-hover-target-line", false);
          d3.select(this).classed("pcp-hover-target-tick", false);
          window.zl(this, false);
        })
        .on("click", function(cat){
          foregroundLayer.selectAll("path.foreground-path")
            .style("display", function(d){ return d.__cat__ === cat ? null : "none"; });
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
    var dataset = mergedDataset();
    if (!dataset.length || !_headers().length) return;

    if (!window.CURRENT_HEADERS || !window.CURRENT_HEADERS.length) {
      window.CURRENT_HEADERS = _headers();
    }

    CHART_MARGIN  = { top: 10, right: 60, bottom: 100, left: 0 };
    PARAC_MARGIN  = { top: 60, right: 10, bottom: 100, left: 10 };

    if (!$CHART().height()) $CHART().css('height', '260px');
    if (!$PARAC().height()) $PARAC().css('height', '260px');

    var numericNow = inferNumericColumns(dataset);

    if (!window.CHART_STATE.initialized) {
      window.CHART_STATE.paracMetrics = numericNow.slice();
      window.CHART_STATE.currentMetric = numericNow[0] || null;
      window.CHART_STATE.visType = 'parallel_coordinate';
      window.CHART_STATE.initialized = true;
    } else {
      window.CHART_STATE.paracMetrics = numericNow.slice();
      if (numericNow.indexOf(window.CHART_STATE.currentMetric) === -1) {
        window.CHART_STATE.currentMetric = numericNow[0] || null;
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
  });

  document.addEventListener("click", function () {
    ensureChartToggleButton();
    ensureAxisByControl();
    populateAxisByOptions();
    populateMetricOptions();
  });

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

  window.addEventListener('radqy:data:updated', function () {
    populateAxisByOptions();
    populateMetricOptions();
    renderAll();
  });

  document.addEventListener("radqy:view:columns", function(e){
    if (e && e.detail && Array.isArray(e.detail.hidden)) {
      if (!window.VIEW_STATE) window.VIEW_STATE = {};
      window.VIEW_STATE.hiddenHeaders = new Set(e.detail.hidden.map(function(x){ return String(x); }));
    }
    renderAll();
  });

  document.addEventListener("radqy:selection-changed", function(e){
    var indices = (e && e.detail && Array.isArray(e.detail.indices)) ? e.detail.indices : [];
    if (indices.length && window.DATA && Array.isArray(window.DATA.ROWS)) {
      var headers = window.DATA.HEADERS || [];
      var pIdx = headers.findIndex(function(h){ return String(h).toLowerCase() === 'p#'; });
      var caseName = indices[0];
      if (pIdx >= 0) {
        var row = window.DATA.ROWS[indices[0]];
        if (row && row[headers[pIdx]] != null) caseName = row[headers[pIdx]];
      }
      window.CHART_STATE.selectedCase = caseName;
    } else {
      window.CHART_STATE.selectedCase = null;
    }
    renderAll();
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
