// Seed UMAP state from config defaults (no duplication)
(function seedUmapState(){
  const d = (window.RADQY_CONFIG && window.RADQY_CONFIG.umapDefaults) || {};
  if (!window.UMAP_STATE) window.UMAP_STATE = {};
  window.UMAP_STATE.nComponents = window.UMAP_STATE.nComponents ?? (d.nComponents ?? 2);
  window.UMAP_STATE.nNeighbors  = window.UMAP_STATE.nNeighbors  ?? (d.nNeighbors  ?? 15);
  window.UMAP_STATE.distanceFn  = window.UMAP_STATE.distanceFn  ?? (d.distanceFn  ?? "Euclidean");
  window.UMAP_STATE.minDist     = window.UMAP_STATE.minDist     ?? (d.minDist     ?? 0.1);
  window.UMAP_STATE.spread      = window.UMAP_STATE.spread      ?? (d.spread      ?? 1);
  window.UMAP_STATE.seed        = window.UMAP_STATE.seed        ?? (d.seed        ?? null);
  window.UMAP_STATE.embedding   = window.UMAP_STATE.embedding   ?? null;
})();

(function(){
  const hostId = "umaphost";
  let plotReady = false;
  let selectionShape = null;
  let selectedPoints = [];
  let labelByCurrent = "";
  let labelByIndex = null;
  let labelDialog = null;
  let labelDialogResolver = null;
  let restyleLock = false;
  let cohortShapes = [];
  let lastNumericSignature = null;

  const MAIN_TRACE_IDX    = 0;
  const HOVER_TRACE_IDX   = 1;
  const SELECT_TRACE_IDX  = 2;
  const ALLOW_RENDER_REASONS = new Set(["init","hyperparam","data","metrics"]);
  const RECOMPUTE_DEBOUNCE_MS = 150;
  let pendingRecompute = null;

  function moveModebarToRail(){
    const rail = document.getElementById("umap-modebar-rail");
    const plot = document.getElementById(hostId);
    if (!rail || !plot) return;
    const modebar = plot.querySelector(".modebar-container");
    if (modebar && modebar.parentNode !== rail) {
      rail.innerHTML = "";
      rail.appendChild(modebar);
    }
  }

  function clearCohortShapes(){
    if (!cohortShapes.length) return;
    cohortShapes = [];
    Plotly.relayout(hostId, { shapes: currentShapes() });
  }

  function clickOutsideColorBy(ev){
    const target = ev.target;
    const isInColorBtn = document.getElementById("chartColor")?.contains(target);
    const isInColorMenu = document.getElementById("color-menu")?.contains(target);
    const isInModebar = document.getElementById("umap-modebar-rail")?.contains(target);
    if (isInColorBtn || isInColorMenu || isInModebar) return;
    clearCohortShapes();
  }

  function loadPlotly(cb){
    if (window.Plotly) return cb();
    const s = document.createElement("script");
    s.src = "libs/plotly/plotly.min.js";
    s.onload = cb;
    document.body.appendChild(s);
  }

  function loadUmap(cb){
    if (window.UMAP) return cb();
    const s = document.createElement("script");
    s.src = "libs/umap-js/umap-js.min.js";
    s.onload = cb;
    document.body.appendChild(s);
  }

  function numericColumns(rows){
    if (!rows || !rows.length) return [];
    if (typeof window.radqyInferNumericColumns === "function"){
      return window.radqyInferNumericColumns(rows);
    }
    const headers = Object.keys(rows[0] || {});
    return headers.filter(h=>{
      if (/^participant\b/i.test(String(h))) return false;
      if (String(h).trim() === "P#") return false;
      let sawNumeric = false;
      for (let i=0;i<rows.length;i++){
        const v = rows[i][h];
        if (v === "" || v == null) continue;
        const num = typeof v === "number" ? v : parseFloat(v);
        if (!Number.isFinite(num)) return false;
        sawNumeric = true;
      }
      return sawNumeric;
    });
  }

  function toNumeric(val){
    if (val === "" || val == null) return null;
    const num = typeof val === "number" ? val : parseFloat(val);
    return Number.isFinite(num) ? num : null;
  }

  function numericSignature(rows){
    const cols = numericColumns(rows);
    const stats = cols.map(c=>{
      let count = 0;
      let missing = 0;
      let sum = 0;
      let sumSq = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i=0;i<rows.length;i++){
        const num = toNumeric(rows[i][c]);
        if (num == null) { missing += 1; continue; }
        count += 1;
        sum += num;
        sumSq += num * num;
        if (num < min) min = num;
        if (num > max) max = num;
      }
      if (!count) { min = 0; max = 0; }
      const safeSum   = Number.isFinite(sum)   ? sum   : 0;
      const safeSumSq = Number.isFinite(sumSq) ? sumSq : 0;
      return [
        c,
        count,
        missing,
        safeSum.toPrecision(12),
        safeSumSq.toPrecision(12),
        min,
        max
      ].join(":");
    });
    return {
      cols,
      key: `${rows.length}|${cols.join(",")}|${stats.join("|")}`
    };
  }

  function hasNumericDataChanged(sig){
    if (!sig) return false;
    if (!lastNumericSignature) return true;
    return sig.key !== lastNumericSignature.key;
  }

  function buildMatrix(rows, cols){
    return rows.map(r => cols.map(c => {
      const num = toNumeric(r[c]);
      return num != null ? num : 0;
    }));
  }

  function palette(kind, idx){
    const css = getComputedStyle(document.documentElement);
    const arr = {
      base: [
        css.getPropertyValue("--color-base-cat1"),
        css.getPropertyValue("--color-base-cat2"),
        css.getPropertyValue("--color-base-cat3"),
        css.getPropertyValue("--color-base-cat4"),
        css.getPropertyValue("--color-base-cat5"),
        css.getPropertyValue("--color-base-cat6")
      ],
      hover: [
        css.getPropertyValue("--color-hover-cat1"),
        css.getPropertyValue("--color-hover-cat2"),
        css.getPropertyValue("--color-hover-cat3"),
        css.getPropertyValue("--color-hover-cat4"),
        css.getPropertyValue("--color-hover-cat5"),
        css.getPropertyValue("--color-hover-cat6")
      ],
      select: [
        css.getPropertyValue("--color-select-cat1"),
        css.getPropertyValue("--color-select-cat2"),
        css.getPropertyValue("--color-select-cat3"),
        css.getPropertyValue("--color-select-cat4"),
        css.getPropertyValue("--color-select-cat5"),
        css.getPropertyValue("--color-select-cat6")
      ]
    };
    const list = arr[kind] || arr.base;
    const c = (list[(idx-1) % list.length] || list[0] || "#3b6ed9").trim();
    return c;
  }

  function catIndex(rowIdx){
    if (window.RADQY && typeof window.RADQY.getRowCategoryDetail === "function"){
      const det = window.RADQY.getRowCategoryDetail(rowIdx);
      if (det && Number.isFinite(det.cat)) return det.cat;
    }
    return 1;
  }

  function selectionSet(){
    if (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function"){
      return new Set((window.RADQY.getSelectedRowIndices()||[]).filter(Number.isFinite));
    }
    return new Set();
  }
  function renderIfAllowed(nextState, reason){
    if (!ALLOW_RENDER_REASONS.has(reason)) return;
    window.renderUMAP(nextState, reason);
  }

  function scheduleRender(nextState, reason){
    if (!ALLOW_RENDER_REASONS.has(reason)) return;
    clearTimeout(pendingRecompute);
    pendingRecompute = setTimeout(()=>{
      renderIfAllowed(nextState, reason);
    }, RECOMPUTE_DEBOUNCE_MS);
  }

  function restyleMarkers(hoverIdx){
    if (!window.Plotly || !window.UMAP_STATE.embedding) return;
    if (restyleLock) return;
    restyleLock = true;
    const emb = window.UMAP_STATE.embedding;
    const sel = selectionSet();
    const selectedPoints = new Set(sel);
    if (hoverIdx >= 0) selectedPoints.add(hoverIdx);
    const colors = emb.map((p,i)=>{
      const cat = catIndex(i);
      if (i === hoverIdx) return palette("hover", cat);
      if (sel.has(i)) return palette("select", cat);
      return palette("base", cat);
    });
    const sizes = emb.map(()=> 10);
    const widths = emb.map(()=>0);
    const opacities = emb.map((p,i)=> i === hoverIdx ? 1 : 1);
    Plotly.restyle(hostId, {
      "marker.color":[colors],
      "marker.size":[sizes],
      "marker.opacity":[opacities],
      "marker.line.width":[widths],
      "selectedpoints":[Array.from(selectedPoints)]
    }, [MAIN_TRACE_IDX]).catch(()=>{}).finally(()=>{ restyleLock = false; });
    setHoverOverlay(hoverIdx);
    setSelectedOverlay();
  }

  function findRowIndexByCaseName(caseName){
    if (!caseName) return -1;
    const rows = (window.DATA && window.DATA.ROWS) || [];
    const headers = (window.DATA && window.DATA.HEADERS) || [];
    const pIdx = headers.findIndex(h => /^p#/i.test(String(h)));
    const partIdx = headers.findIndex(h => /^participant\b/i.test(String(h)));
    for (let i=0;i<rows.length;i++){
      const r = rows[i];
      if (!r) continue;
      if (pIdx>=0 && String(r[headers[pIdx]]) === caseName) return i;
      if (partIdx>=0 && String(r[headers[partIdx]]) === caseName) return i;
      if (caseName.toLowerCase() === (`p${i+1}`).toLowerCase()) return i;
    }
    return -1;
  }

  function setHoverOverlay(hoverIdx){
    if (!window.Plotly) return;
    const emb = window.UMAP_STATE && window.UMAP_STATE.embedding;
    if (!emb || !emb.length) return;
    if (!Number.isFinite(hoverIdx) || hoverIdx < 0 || !emb[hoverIdx]) {
      Plotly.restyle(hostId, {
        x: [[]],
        y: [[]],
        "marker.opacity":[0],
        "marker.size":[0],
        "marker.line.width":[0]
      }, [HOVER_TRACE_IDX]).catch(()=>{});
      return;
    }
    const pt = emb[hoverIdx];
    const cat = catIndex(hoverIdx);
    const color = palette("hover", cat);
    Plotly.restyle(hostId, {
      x: [[pt[0]]],
      y: [[pt[1]]],
      "marker.color":[[color]],
      "marker.size":[[10]],
      "marker.opacity":[[1]],
      "marker.line.color":[["transparent"]],
      "marker.line.width":[[0]]
    }, [HOVER_TRACE_IDX]).catch(()=>{});
  }

  function setSelectedOverlay(){
    if (!window.Plotly || !window.UMAP_STATE.embedding) return;
    const emb = window.UMAP_STATE.embedding;
    const sel = selectionSet();
    if (!sel.size) {
      Plotly.restyle(hostId, {
        x:[[]],
        y:[[]],
        "marker.opacity":[0],
        "marker.size":[0],
        "marker.line.width":[0]
      }, [SELECT_TRACE_IDX]).catch(()=>{});
      return;
    }
    const xs = [];
    const ys = [];
    const colors = [];
    sel.forEach(idx=>{
      if (!Number.isFinite(idx) || !emb[idx]) return;
      const pt = emb[idx];
      const cat = catIndex(idx);
      xs.push(pt[0]);
      ys.push(pt[1]);
      colors.push(palette("select", cat));
    });
    Plotly.restyle(hostId, {
      x:[xs],
      y:[ys],
      "marker.color":[colors],
      "marker.size":[Array(xs.length).fill(10)],
      "marker.opacity":[Array(xs.length).fill(1)],
      "marker.line.color":[Array(xs.length).fill("transparent")],
      "marker.line.width":[Array(xs.length).fill(0)]
    }, [SELECT_TRACE_IDX]).catch(()=>{});
  }

  function caseNameForRow(idx){
    const rows = (window.DATA && window.DATA.ROWS) || [];
    const headers = (window.DATA && window.DATA.HEADERS) || [];
    const row = rows[idx];
    if (!row) return `P${idx+1}`;
    const partIdx = headers.findIndex(h => /^participant\b/i.test(String(h)));
    if (partIdx >= 0 && row[headers[partIdx]] != null) {
      return String(row[headers[partIdx]]);
    }
    const pIdx = headers.findIndex(h => /^p#/i.test(String(h)));
    if (pIdx >= 0 && row[headers[pIdx]] != null) {
      return String(row[headers[pIdx]]);
    }
    return `P${idx+1}`;
  }

  function buildTrace(embedding, rows){
    const sel = selectionSet();
    const colors = embedding.map((p,i)=>{
      const cat = catIndex(i);
      return sel.has(i) ? palette("select", cat) : palette("base", cat);
    });
    return {
      x: embedding.map(p=>p[0]),
      y: embedding.map(p=>p[1]),
      mode: "markers",
      // Use non-WebGL scatter to avoid GL driver buffer warnings seen with scattergl
      type: "scatter",
      text: rows.map((r,idx)=> r && r["P#"] ? r["P#"] : `P${idx+1}`),
      hoverinfo: "text",
      marker: {
        size: embedding.map(()=> 10),
        color: colors,
        opacity: 1,
        line: {
          width: embedding.map(()=> 0),
          color: embedding.map(()=> "transparent")
        }
      },
      selected:   { marker: { opacity: 1 } },
      unselected: { marker: { opacity: 1 } }
    };
  }

  function buildHoverTrace(){
    return {
      x: [],
      y: [],
      mode: "markers",
      type: "scatter",
      cliponaxis:false,
      hoverinfo: "skip",
      showlegend: false,
      marker: {
        size: 0,
        color: "rgba(0,0,0,0)",
        opacity: 0,
        line: { width: 0, color: "transparent" }
      }
    };
  }

  function buildSelectedTrace(){
    return {
      x: [],
      y: [],
      mode: "markers",
      type: "scatter",
      cliponaxis:false,
      hoverinfo: "skip",
      showlegend: false,
      marker: {
        size: 0,
        color: "rgba(0,0,0,0)",
        opacity: 0,
        line: { width: 0, color: "transparent" }
      }
    };
  }

  function buildLassoPath(lassoPoints){
    if (!lassoPoints) return null;
    const xs = lassoPoints.x || [];
    const ys = lassoPoints.y || [];
    if (!xs.length || xs.length !== ys.length) return null;
    let path = `M ${xs[0]},${ys[0]}`;
    for (let i=1;i<xs.length;i++){
      path += ` L ${xs[i]},${ys[i]}`;
    }
    path += " Z";
    return path;
  }

  function setSelectionShape(ev){
    let shape = null;
    if (ev && ev.range && ev.range.x && ev.range.y){
      shape = {
        type: "rect",
        xref: "x",
        yref: "y",
        x0: ev.range.x[0],
        x1: ev.range.x[1],
        y0: ev.range.y[0],
        y1: ev.range.y[1],
        line: { color: "rgba(59,110,217,0.9)", width: 2 },
        fillcolor: "rgba(59,110,217,0.08)"
      };
    } else if (ev && ev.lassoPoints){
      const path = buildLassoPath(ev.lassoPoints);
      if (path){
        shape = {
          type: "path",
          path,
          xref: "x",
          yref: "y",
          line: { color: "rgba(59,110,217,0.9)", width: 2 },
          fillcolor: "rgba(59,110,217,0.08)"
        };
      }
    }
    selectionShape = shape;
  }

  function currentShapes(){
    const shapes = [];
    if (cohortShapes.length) shapes.push(...cohortShapes);
    if (selectionShape) shapes.push(selectionShape);
    return shapes;
  }

  function computeConvexHull(points){
    if (points.length <= 2) return points.slice();
    const pts = points.slice().sort((a,b)=> a.x === b.x ? a.y - b.y : a.x - b.x);
    const cross = (o,a,b)=> (a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
    const lower = [];
    for (const p of pts){
      while (lower.length >=2 && cross(lower[lower.length-2], lower[lower.length-1], p) <=0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i=pts.length-1;i>=0;i--){
      const p = pts[i];
      while (upper.length >=2 && cross(upper[upper.length-2], upper[upper.length-1], p) <=0) upper.pop();
      upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }

  function hullPath(points){
    if (!points.length) return null;
    const cx = points.reduce((s,p)=>s+p.x,0)/points.length;
    const cy = points.reduce((s,p)=>s+p.y,0)/points.length;
    const xs = points.map(p=>p.x);
    const ys = points.map(p=>p.y);
    const spanX = (Math.max(...xs) - Math.min(...xs)) || 1;
    const spanY = (Math.max(...ys) - Math.min(...ys)) || 1;
    const span = Math.max(spanX, spanY);
    const pad = 0.15; // breathing room
    // Use circumscribed ellipse (sqrt(2) factor) so all points in bbox are inside
    const rx = (spanX/2) * Math.SQRT2 * (1 + pad) + span * 0.1;
    const ry = (spanY/2) * Math.SQRT2 * (1 + pad) + span * 0.1;
    const steps = 72;
    let path = "";
    for (let i=0;i<=steps;i++){
      const t = (i/steps) * Math.PI * 2;
      const x = cx + rx * Math.cos(t);
      const y = cy + ry * Math.sin(t);
      if (i===0) path += `M ${x},${y}`;
      else path += ` L ${x},${y}`;
    }
    path += " Z";
    return path;
  }

  function kmeans(emb, k, maxIter=50){
    if (!emb || !emb.length || k < 2) return null;
    k = Math.min(k, emb.length);
    const points = emb.map(p=>({x:p[0], y:p[1]}));
    const centers = [];
    const used = new Set();
    while (centers.length < k){
      const idx = Math.floor(Math.random()*points.length);
      if (!used.has(idx)){
        used.add(idx);
        centers.push({ ...points[idx] });
      }
    }
    let labels = new Array(points.length).fill(0);
    for (let iter=0; iter<maxIter; iter++){
      // assign
      let changed = false;
      for (let i=0;i<points.length;i++){
        let best = 0;
        let bestd = Infinity;
        for (let c=0;c<centers.length;c++){
          const dx = points[i].x - centers[c].x;
          const dy = points[i].y - centers[c].y;
          const d = dx*dx + dy*dy;
          if (d < bestd){
            bestd = d; best = c;
          }
        }
        if (labels[i] !== best) {
          labels[i] = best;
          changed = true;
        }
      }
      // update
      const sums = centers.map(()=>({x:0,y:0,c:0}));
      for (let i=0;i<points.length;i++){
        const l = labels[i];
        sums[l].x += points[i].x;
        sums[l].y += points[i].y;
        sums[l].c += 1;
      }
      for (let c=0;c<centers.length;c++){
        if (sums[c].c){
          centers[c].x = sums[c].x / sums[c].c;
          centers[c].y = sums[c].y / sums[c].c;
        }
      }
      if (!changed) break;
    }
    return labels;
  }

  async function runCohortFinder(k, trainPct){
    const emb = window.UMAP_STATE && window.UMAP_STATE.embedding;
    if (!emb || !emb.length) {
      alert("Run UMAP first before Cohort Finder.");
      return;
    }
    const n = emb.length;
    if (!Number.isFinite(k) || k < 2 || k > n) {
      alert("Invalid k for Cohort Finder.");
      return;
    }
    const labelsIdx = kmeans(emb, k);
    if (!labelsIdx) return;
    const rows = (window.DATA && window.DATA.ROWS) || [];
    const clusterLabels = labelsIdx.map(i=> `Cluster ${i+1}`);
    const orderedCats = Array.from({length: k}, (_,i)=> `Cluster ${i+1}`);

    // Train/Test split per cluster
    const split = new Array(n).fill("Train");
    if (trainPct != null && Number.isFinite(trainPct)) {
      const p = Math.max(0, Math.min(100, trainPct)) / 100;
      const clusters = {};
      labelsIdx.forEach((c, idx)=>{
        if (!clusters[c]) clusters[c] = [];
        clusters[c].push(idx);
      });
      Object.values(clusters).forEach(list=>{
        const shuffled = list.slice().sort(()=> Math.random()-0.5);
        const trainCount = Math.max(0, Math.min(shuffled.length, Math.round(shuffled.length * p)));
        for (let i=trainCount;i<shuffled.length;i++){
          split[shuffled[i]] = "Test";
        }
      });
    }

    // Add AUX columns
    const cfName = window.RADQY && window.RADQY.addAuxColumnFromValues
      ? window.RADQY.addAuxColumnFromValues("CohortCluster", clusterLabels)
      : null;
    const splitName = (window.RADQY && window.RADQY.addAuxColumnFromValues)
      ? window.RADQY.addAuxColumnFromValues("CohortSplit", split)
      : null;

    // Build hulls after color mapping is set
    const normFn = (typeof window.normalizeCategoryValue === "function")
      ? window.normalizeCategoryValue
      : (_h, v) => (v == null ? "NA" : String(v));
    const catMap = new Map(
      orderedCats.map((v, i) => [normFn("CohortCluster", v), ((i % 5) + 2)])
    );

    cohortShapes = [];
    for (let c=0;c<k;c++){
      const pts = [];
      labelsIdx.forEach((lab, idx)=>{
        if (lab === c) pts.push({x: emb[idx][0], y: emb[idx][1]});
      });
      if (pts.length >= 3){
        const hull = computeConvexHull(pts);
        const path = hullPath(hull);
        if (path){
          const sampleIdx = labelsIdx.findIndex(l => l === c);
          const lbl = sampleIdx >= 0 ? clusterLabels[sampleIdx] : `Cluster ${c+1}`;
          const cat = catMap.get(normFn("CohortCluster", lbl)) || 1;
          const color = palette("base", cat);
          cohortShapes.push({
            type: "path",
            path,
            xref: "x",
            yref: "y",
            line: { color, width: 2 },
            fillcolor: "rgba(0,0,0,0)" // no fill, outline only
          });
        }
      }
    }
    Plotly.relayout(hostId, { shapes: currentShapes() });

    if (cfName && window.RADQY && window.RADQY.applyColorBy) {
      const vals = orderedCats.length
        ? orderedCats
        : Array.from(new Set(clusterLabels.filter(v=>v!=null && v!=="")));
      window.RADQY.applyColorBy(cfName, vals);
    }
    labelByCurrent = cfName || labelByCurrent;
    if (cfName) updateLabelByIndexFromName(cfName);
    buildLabelMenu();
  }

  function plotEmbedding(embedding, rows){
    if (!embedding) return;
    loadPlotly(()=>{
      const externalSel = Array.from(selectionSet());
      if (externalSel.length) selectedPoints = externalSel;
      Plotly.purge(hostId);
      plotReady = false;
      const trace = buildTrace(embedding, rows);
      trace.selectedpoints = [selectedPoints];
      const hoverTrace = buildHoverTrace();
      const selectedTrace = buildSelectedTrace();
      const layout = {
        margin:{l:10,r:10,t:10,b:10},
        showlegend:false,
        hovermode:"closest",
        xaxis:{showgrid:false, zeroline:false, showticklabels:false},
        yaxis:{showgrid:false, zeroline:false, showticklabels:false},
        dragmode:"lasso",
        shapes: currentShapes()
      };
      const cfg = {
        responsive:true,
        scrollZoom:true,
        displaylogo:false,
        modeBarButtonsToAdd:[],
        modeBarButtonsToRemove:[],
        displayModeBar:true,
        modeBarPosition:"topright"
      };
      Plotly.react(hostId, [trace, hoverTrace, selectedTrace], layout, cfg).then(() => {
        moveModebarToRail();
        const plot = document.getElementById(hostId);
        if (!plotReady) {
          // Lasso/box selection: live selection coloring while drawing
          plot.on("plotly_selecting", ev=>{
            const pts = (ev && ev.points) || [];
            const incoming = Array.from(new Set(pts.map(p=>p.pointIndex).filter(Number.isFinite)));
            const mergedSet = new Set(Array.from(selectionSet()));
            incoming.forEach(i => mergedSet.add(i));
            const idxs = Array.from(mergedSet);
            selectedPoints = idxs;
            if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function"){
              window.RADQY.setSelectedRowIndices(idxs);
            }
            restyleMarkers(-1);
          });
          plot.on("plotly_selected", ev=>{
            const pts = (ev && ev.points) || [];
            const incoming = Array.from(new Set(pts.map(p=>p.pointIndex).filter(Number.isFinite)));
          const mergedSet = new Set(Array.from(selectionSet()));
          incoming.forEach(i => mergedSet.add(i));
          const idxs = Array.from(mergedSet);
          if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function"){
            window.RADQY.setSelectedRowIndices(idxs);
          }
          selectedPoints = idxs;
          setSelectionShape(ev);
          Plotly.restyle(hostId, { selectedpoints: [selectedPoints] }, [MAIN_TRACE_IDX]);
          Plotly.relayout(hostId, { shapes: currentShapes() });
          setSelectedOverlay();
          restyleMarkers(-1);
          try{
            document.dispatchEvent(new CustomEvent("radqy:hover:change",{detail:{caseName:null,on:false,rowIndex:null}}));
          }catch(e){}
          if (typeof window.hoverTableRow === "function") {
            window.hoverTableRow(null, false);
            }
          });
          plot.on("plotly_deselect", ()=>{
            if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function"){
              window.RADQY.setSelectedRowIndices([]);
            }
            selectedPoints = [];
            selectionShape = null;
            Plotly.restyle(hostId, { selectedpoints: [[]] }, [MAIN_TRACE_IDX]);
            Plotly.relayout(hostId, { shapes: currentShapes() });
            setSelectedOverlay();
            restyleMarkers(-1);
            try{
              document.dispatchEvent(new CustomEvent("radqy:hover:change",{detail:{caseName:null,on:false,rowIndex:null}}));
            }catch(e){}
            if (typeof window.hoverTableRow === "function") {
              window.hoverTableRow(null, false);
            }
          });
          plot.on("plotly_click", ev=>{
            const pt = ev && ev.points && ev.points[0];
            if (!pt) return;
            const idx = pt.pointIndex;
            const set = selectionSet();
            if (set.has(idx)) set.delete(idx); else set.add(idx);
            if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function"){
              window.RADQY.setSelectedRowIndices(Array.from(set));
            }
          });
          plot.on("plotly_hover", ev=>{
            const pt = ev && ev.points && ev.points[0];
            if (!pt) return;
            const idx = pt.pointIndex;
            restyleMarkers(idx);
            const txt = caseNameForRow(idx);
            try{
              document.dispatchEvent(new CustomEvent("radqy:hover:change",{detail:{caseName:txt,on:true,rowIndex:idx}}));
            }catch(e){}
            if (typeof window.hoverTableRow === "function") {
              window.hoverTableRow(txt, true);
            }
          });
          plot.on("plotly_unhover", ev=>{
            restyleMarkers(-1);
            const pt = ev && ev.points && ev.points[0];
            const txt = pt ? caseNameForRow(pt.pointIndex) : null;
            try{
              document.dispatchEvent(new CustomEvent("radqy:hover:change",{detail:{caseName:txt,on:false,rowIndex: pt?pt.pointIndex:null}}));
            }catch(e){}
            if (typeof window.hoverTableRow === "function") {
              window.hoverTableRow(null, false);
            }
          });
          // Home (auto-range) should clear selection + cohort outlines without recomputing embedding
          plot.on("plotly_relayout", ev=>{
            const isHome =
              ev &&
              (ev["xaxis.autorange"] === true || ev["yaxis.autorange"] === true || ev["scene.autorange"] === true);
            if (!isHome) return;
            // Keep selection/overlays, just reapply styling so selected points stay visible after autoscale
            setSelectedOverlay();
            restyleMarkers(-1);
          });
          plotReady = true;
        }
        setSelectedOverlay();
        restyleMarkers(-1);
      });
    });
  }

  // ---------- Label-by dropdown (save selection as AUX) ----------
  function ensureLabelMenu(){
    const btn = document.getElementById("umapLabelBtn");
    const host = document.getElementById("umap-label-menu");
    if (!btn || !host) return null;

    // Match menu width and position to the button so it lines up like Color by
    const w = btn.offsetWidth;
    if (w && Number.isFinite(w)) {
      host.style.minWidth = `${w}px`;
      host.style.width = `${w}px`;
    }
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

  function auxColumns(){
    const headers = (window.DATA && window.DATA.HEADERS) || [];
    const metaAux = ((window.DATA && window.DATA.META && window.DATA.META.auxs) || []).map(String);
    const auxLow = new Set(metaAux.map(h => h.toLowerCase()));
    if (!auxLow.size) return [];
    return headers.filter(h=>{
      const low = String(h).toLowerCase();
      if (low === "p#" || low === "pid" || low === "comment") return false;
      return auxLow.has(low);
    });
  }

  function getSelectionIdxs(){
    return Array.from(selectionSet());
  }

  function saveSelectionAsAux(labelsOverride){
    const sel = getSelectionIdxs();
    if (!sel.length) {
      alert("Select at least one participant (lasso/box) first.");
      return null;
    }
    const labels = labelsOverride || { selected: "Selected", unselected: "Unselected" };
    if (window.RADQY && typeof window.RADQY.addSelectionAuxColumn === "function") {
      const col = window.RADQY.addSelectionAuxColumn(null, sel, labels);
      if (col && window.RADQY.applyColorBy) {
        const rows = (window.DATA && window.DATA.ROWS) || [];
        const vals = Array.from(new Set(rows.map(r => r && r[col]).filter(v => v != null && v !== "")));
        window.RADQY.applyColorBy(col, vals.length ? vals : [labels.selected, labels.unselected]);
      }
      return col;
    }
    return null;
  }

  function addEmptyAuxAndSelect(){
    if (window.RADQY && typeof window.RADQY.addEmptyAuxColumn === "function") {
      return window.RADQY.addEmptyAuxColumn();
    }
    return null;
  }

  function headersNow(){
    return (window.DATA && window.DATA.HEADERS) || [];
  }

  function updateLabelByIndexFromName(name){
    const headers = headersNow();
    const idx = headers.indexOf(name);
    labelByIndex = idx >= 0 ? idx : null;
  }

  function refreshLabelByFromIndex(){
    if (labelByIndex == null) return;
    const headers = headersNow();
    if (headers[labelByIndex]) {
      labelByCurrent = headers[labelByIndex];
    } else if (labelByCurrent && !headers.includes(labelByCurrent)) {
      labelByCurrent = "";
      labelByIndex = null;
    }
  }

  function headersNow(){
    return (window.DATA && window.DATA.HEADERS) || [];
  }

  function updateLabelByIndexFromName(name){
    const headers = headersNow();
    const idx = headers.indexOf(name);
    labelByIndex = idx >= 0 ? idx : null;
  }

  function refreshLabelByFromIndex(){
    if (labelByIndex == null) return;
    const headers = headersNow();
    if (headers[labelByIndex]) {
      labelByCurrent = headers[labelByIndex];
    } else if (labelByCurrent && !headers.includes(labelByCurrent)) {
      labelByCurrent = "";
      labelByIndex = null;
    }
  }

  function ensureLabelDialog(){
    if (labelDialog) return labelDialog;
    const overlay = document.createElement("div");
    overlay.id = "label-dialog-overlay";
    overlay.style.display = "none";
    const box = document.createElement("div");
    box.id = "label-dialog";
    const title = document.createElement("div");
    title.className = "label-dialog-title";
    title.textContent = "Save selection labels";
    const form = document.createElement("div");
    form.className = "label-dialog-form";
    const selLabel = document.createElement("label");
    selLabel.textContent = "Selected label";
    const selInput = document.createElement("input");
    selInput.type = "text";
    selInput.id = "label-dialog-selected";
    selInput.name = "label-selected";
    selInput.setAttribute("aria-label", "Selected label");
    selLabel.setAttribute("for", selInput.id);
    const unselLabel = document.createElement("label");
    unselLabel.textContent = "Unselected label";
    const unselInput = document.createElement("input");
    unselInput.type = "text";
    unselInput.id = "label-dialog-unselected";
    unselInput.name = "label-unselected";
    unselInput.setAttribute("aria-label", "Unselected label");
    unselLabel.setAttribute("for", unselInput.id);
    const actions = document.createElement("div");
    actions.className = "label-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btnsm";
    cancelBtn.textContent = "Cancel";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btnsm btnon";
    okBtn.textContent = "OK";
    form.appendChild(selLabel);
    form.appendChild(selInput);
    form.appendChild(unselLabel);
    form.appendChild(unselInput);
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    box.appendChild(title);
    box.appendChild(form);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    cancelBtn.addEventListener("click", ()=>{
      overlay.style.display = "none";
      if (labelDialogResolver) labelDialogResolver(null);
    });
    okBtn.addEventListener("click", ()=>{
      overlay.style.display = "none";
      const vals = {
        selected: selInput.value.trim() || "Selected",
        unselected: unselInput.value.trim() || "Unselected"
      };
      if (labelDialogResolver) labelDialogResolver(vals);
    });

    [selInput, unselInput].forEach(inp=>{
      inp.addEventListener("keydown", (e)=>{
        if (e.key === "Enter") {
          e.preventDefault();
          okBtn.click();
        }
      });
    });

    labelDialog = { overlay, selInput, unselInput };
    return labelDialog;
  }

  function openLabelDialog(defaults){
    const dlg = ensureLabelDialog();
    if (!dlg) return Promise.resolve(null);
    const def = defaults || { selected: "Selected", unselected: "Unselected" };
    dlg.selInput.value = def.selected;
    dlg.unselInput.value = def.unselected;
    dlg.overlay.style.display = "flex";
    dlg.selInput.focus();
    return new Promise(resolve => {
      labelDialogResolver = resolve;
    });
  }

  // ---------- Cohort Finder dialog ----------
  function ensureCohortDialog(){
    let overlay = document.getElementById("cohort-dialog-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "cohort-dialog-overlay";
    overlay.className = "label-dialog-overlay";
    const box = document.createElement("div");
    box.id = "cohort-dialog";
    box.className = "label-dialog";
    const title = document.createElement("div");
    title.className = "label-dialog-title";
    title.textContent = "Cohort Finder";

    const form = document.createElement("div");
    form.className = "label-dialog-form";

    const kLabel = document.createElement("label");
    kLabel.textContent = "Number of clusters (k) – min 2";
    const kInput = document.createElement("input");
    kInput.type = "number";
    kInput.min = "2";
    kInput.value = "3";
    kInput.placeholder = "Minimum 2";
    kInput.id = "cohort-k";
    kInput.name = "cohort-k";
    kInput.setAttribute("aria-label", "Number of clusters");
    kLabel.setAttribute("for", kInput.id);

    const splitLabel = document.createElement("label");
    splitLabel.textContent = "Train split (%)";
    const splitInput = document.createElement("input");
    splitInput.type = "number";
    splitInput.min = "0";
    splitInput.max = "100";
    splitInput.value = "80";
    splitInput.id = "cohort-train";
    splitInput.name = "cohort-train";
    splitInput.setAttribute("aria-label", "Train split percent");
    splitLabel.setAttribute("for", splitInput.id);

    const actions = document.createElement("div");
    actions.className = "label-dialog-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btnsm";
    cancelBtn.textContent = "Cancel";
    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = "btn btnsm btnon";
    okBtn.textContent = "Run";

    [kInput, splitInput].forEach(inp=>{
      inp.addEventListener("keydown", (e)=>{
        if (e.key === "Enter") {
          e.preventDefault();
          okBtn.click();
        }
      });
    });

    form.appendChild(kLabel);
    form.appendChild(kInput);
    form.appendChild(splitLabel);
    form.appendChild(splitInput);
    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    box.appendChild(title);
    box.appendChild(form);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    cancelBtn.addEventListener("click", ()=>{
      overlay.style.display = "none";
      if (labelDialogResolver) labelDialogResolver(null);
    });
    okBtn.addEventListener("click", ()=>{
      overlay.style.display = "none";
      const k = Number(kInput.value);
      const trainPct = Number(splitInput.value);
      if (labelDialogResolver) labelDialogResolver({k, trainPct});
    });

    return overlay;
  }

  function openCohortDialog(){
    const overlay = ensureCohortDialog();
    if (!overlay) return Promise.resolve(null);
    overlay.style.display = "flex";
    const kInput = overlay.querySelector("#cohort-k");
    const splitInput = overlay.querySelector("#cohort-train");
    if (kInput) kInput.focus();
    return new Promise(resolve => {
      labelDialogResolver = resolve;
    });
  }

  function buildLabelMenu(){
    const btn = document.getElementById("umapLabelBtn");
    const host = ensureLabelMenu();
    if (!btn || !host) return;
    host.innerHTML = "";

    const aux = auxColumns();
    refreshLabelByFromIndex();
    refreshLabelByFromIndex();

    // Reset button text if current selection is gone
    if (labelByCurrent && !aux.includes(labelByCurrent)) {
      labelByCurrent = "";
      labelByIndex = null;
    }
    btn.textContent = labelByCurrent || "";
    btn.setAttribute("aria-label", labelByCurrent ? `Label by ${labelByCurrent}` : "Save selection as AUX");

    const newItem = document.createElement("button");
    newItem.type = "button";
    newItem.className = "menu-item";
    newItem.textContent = "+ New";
    newItem.addEventListener("click", async ()=>{
      host.classList.remove("is-open");
      const labels = await openLabelDialog({ selected: "Selected", unselected: "Unselected" });
      if (!labels) return;
      const col = saveSelectionAsAux(labels);
      if (col) {
        updateLabelByIndexFromName(col);
        labelByCurrent = col;
        btn.textContent = col;
        btn.setAttribute("aria-label", `Label by ${col}`);
        buildLabelMenu();
      }
    });
    host.appendChild(newItem);

    if (aux.length){
      aux.forEach(col=>{
        const item = document.createElement("button");
        item.type = "button";
        item.className = "menu-item";
        item.textContent = col;
        item.addEventListener("click", async ()=>{
          host.classList.remove("is-open");
          const sel = getSelectionIdxs();
          if (!sel.length) {
            alert("Select at least one participant (lasso/box) first.");
            return;
          }
          const defaults = { selected: "Selected", unselected: "Unselected" };
          const override = await openLabelDialog(defaults);
          if (!override) return;
          if (window.RADQY && typeof window.RADQY.appendSelectionLabelToColumn === "function") {
            window.RADQY.appendSelectionLabelToColumn(col, sel, override.selected);
          }
          if (window.RADQY && typeof window.RADQY.applyColorBy === "function") {
            const rows = (window.DATA && window.DATA.ROWS) || [];
            const vals = Array.from(new Set(rows.map(r => r && r[col]).filter(v => v != null && v !== "")));
            window.RADQY.applyColorBy(col, vals);
          }
          updateLabelByIndexFromName(col);
          labelByCurrent = col;
          btn.textContent = col;
          btn.setAttribute("aria-label", `Label by ${col}`);
        });
        host.appendChild(item);
      });
    }
  }

  function bindLabelMenu(){
    const btn = document.getElementById("umapLabelBtn");
    const host = ensureLabelMenu();
    if (!btn || !host) return;

    const closeMenu = ()=>{
      host.classList.remove("is-open");
      btn.blur();
    };

    btn.addEventListener("click", ev=>{
      ev.stopPropagation();
      ensureLabelMenu(); // refresh width/position if layout changed
      document.dispatchEvent(new CustomEvent("radqy:menu:closeall", { detail: { source: "umap-label" } }));
      host.classList.toggle("is-open");
    });
    host.addEventListener("click", ev=> ev.stopPropagation());
    document.addEventListener("click", closeMenu, true);
    document.addEventListener("radqy:menu:closeall", closeMenu);
  }

  function toggleLabelByVisibility(){
    const wrap = document.querySelector(".umap-labelby");
    if (!wrap) return;
    const hasSel = selectionSet().size > 0;
    wrap.style.display = hasSel ? "flex" : "none";
  }

  function clearUmapPlot(message){
    const host = document.getElementById(hostId);
    if (!host) return;
    plotReady = false;
    if (window.Plotly) {
      try { Plotly.purge(hostId); } catch(e){}
    }
    const rail = document.getElementById("umap-modebar-rail");
    if (rail) rail.innerHTML = "";
    if (message) {
      host.innerHTML = `<div class="umap-placeholder">${message}</div>`;
    }
  }

  function computeEmbedding(state, signature){
    const rows = (window.DATA && window.DATA.ROWS) || [];
    const sig = signature || numericSignature(rows);
    const cols = sig.cols;
    if (!rows.length || cols.length < 2) {
      window.UMAP_STATE.embedding = null;
      lastNumericSignature = sig;
      clearUmapPlot(rows.length ? "UMAP needs at least two numeric metrics." : "No participants available for UMAP.");
      return null;
    }
    const matrix = buildMatrix(rows, cols);
    let embedding = null;
    loadUmap(()=>{
      const distName = (state.distanceFn || "euclidean").toLowerCase();
      if (state.seed != null && typeof Math.seedrandom === "function") {
        Math.seedrandom(state.seed);
      }
      const umap = new UMAP({
        nComponents: state.nComponents || 2,
        nNeighbors: Math.max(2, Math.min(matrix.length-1, state.nNeighbors || 15)),
        minDist: state.minDist || 0.1,
        spread: state.spread || 1,
        distanceFn: UMAP[distName] || UMAP.euclidean
      });
      embedding = umap.fit(matrix);
      window.UMAP_STATE.embedding = embedding;
      lastNumericSignature = sig;
      window.UMAP_STATE._dataSignature = sig;
      plotEmbedding(embedding, rows);
    });
    return embedding;
  }

  window.renderUMAP = function(nextState, reason){
    if (nextState) window.UMAP_STATE = Object.assign({}, window.UMAP_STATE, nextState);
    const rows = (window.DATA && window.DATA.ROWS) || [];
    const signature = numericSignature(rows);
    const wantsRecompute = !!(nextState && nextState.recompute);
    const dataChanged = wantsRecompute && hasNumericDataChanged(signature);
    const needsEmbedding =
      reason === "hyperparam" ||
      dataChanged ||
      (!window.UMAP_STATE.embedding && signature.cols.length >= 2);

    if (needsEmbedding) {
      computeEmbedding(window.UMAP_STATE, signature);
      return;
    }

    if (!window.UMAP_STATE.embedding) {
      clearUmapPlot(rows.length ? "UMAP needs at least two numeric metrics." : "No participants available for UMAP.");
      return;
    }

    if (!wantsRecompute) {
      plotEmbedding(window.UMAP_STATE.embedding, rows);
    }
  };

  function initControls(){
    const d = (window.RADQY_CONFIG && window.RADQY_CONFIG.umapDefaults) || {};
    const elC  = document.getElementById("umap_components");
    const elN  = document.getElementById("umap_neighbors");
    const elMD = document.getElementById("umap_mindist");
    const elS  = document.getElementById("umap_spread");
    const metricBtn  = document.getElementById("umapMetricBtn");
    const metricMenu = document.getElementById("umapMetricMenu");
    const metricOptions = (d.distanceOptions && d.distanceOptions.length)
      ? d.distanceOptions.slice()
      : ["Euclidean","Manhattan","Cosine","Hamming"];
    let metricCurrent = window.UMAP_STATE.distanceFn || d.distanceFn || metricOptions[0];
    function buildMetricMenu(){
      if (!metricMenu || !metricBtn) return;
      metricMenu.innerHTML = "";
      metricBtn.textContent = metricCurrent;
      metricOptions.forEach(opt=>{
        const item = document.createElement("button");
        item.type = "button";
        item.className = "menu-item" + (opt === metricCurrent ? " is-active" : "");
        const label = document.createElement("span");
        label.textContent = opt;
        item.appendChild(label);
        item.addEventListener("click", ()=>{
          metricCurrent = opt;
          metricBtn.textContent = opt;
          metricMenu.classList.remove("is-open");
          renderIfAllowed({
            distanceFn: metricCurrent,
            nComponents: Number(elC?.value ?? 2),
            nNeighbors:  Number(elN?.value ?? 15),
            minDist:     Number(elMD?.value ?? 0.1),
            spread:      Number(elS?.value ?? 1),
            recompute:   true
          }, "hyperparam");
        });
        metricMenu.appendChild(item);
      });
    }
    if (metricBtn && metricMenu){
      metricBtn.addEventListener("click", ev=>{
        ev.stopPropagation();
        metricMenu.classList.toggle("is-open");
      });
      document.addEventListener("click", ()=> metricMenu.classList.remove("is-open"));
      buildMetricMenu();
    }
    if (elC)  elC.value  = d.nComponents ?? 2;
    if (elN)  elN.value  = d.nNeighbors  ?? 15;
    if (elMD) elMD.value = d.minDist     ?? 0.1;
    if (elS)  elS.value  = d.spread      ?? 1;
    const sync = () => {
      renderIfAllowed({
        nComponents: Number(elC.value),
        nNeighbors:  Number(elN.value),
        distanceFn:  metricCurrent,
        minDist:     Number(elMD.value),
        spread:      Number(elS.value),
        recompute:   true
      }, "hyperparam");
    };
    [elC, elN, elMD, elS].forEach(el => el && el.addEventListener("change", sync));
    sync();
  }

  document.addEventListener("DOMContentLoaded", initControls);
  document.addEventListener("radqy:data:ready", ()=> renderIfAllowed({recompute:true},"init"));
  document.addEventListener("radqy:data:updated", (e)=>{
    const det = e && e.detail ? e.detail : {};
    const what = det.what || "";
    const isMetricChange = what === "add_column" || what === "update_column";
    const isParticipantChange = what === "delete" || what === "add_row";
    const selectionOnly = what === "row-select";
    if (selectionOnly) return;
    if (det && det.skipUMAP && !isMetricChange) return;
    const shouldRecompute = det.forceUMAP || isMetricChange || isParticipantChange || !what;
    if (shouldRecompute) {
      renderIfAllowed({recompute:true},"data");
    }
  });
  document.addEventListener("radqy:view:columns", ()=>{
    scheduleRender({recompute:true},"metrics");
  });
  document.addEventListener("radqy:table:updated", ()=>{
    scheduleRender({recompute:true},"metrics");
  });
  document.addEventListener("radqy:colorby:changed", ()=> restyleMarkers(-1));
  document.addEventListener("radqy:selection-changed", ()=>{
    selectedPoints = Array.from(selectionSet());
    setSelectedOverlay();
    restyleMarkers(-1);
    toggleLabelByVisibility();
    moveModebarToRail();
  });
  document.addEventListener("DOMContentLoaded", ()=>{
    buildLabelMenu();
    bindLabelMenu();
    toggleLabelByVisibility();
    document.addEventListener("click", clickOutsideColorBy, true);
    const cfBtn = document.getElementById("btnCohortFinder");
    if (cfBtn) {
      cfBtn.addEventListener("click", async ()=>{
        const dlg = await openCohortDialog();
        if (!dlg) return;
        await runCohortFinder(dlg.k, dlg.trainPct);
      });
    }
    moveModebarToRail();
  });
  document.addEventListener("radqy:data:updated", ()=>{
    buildLabelMenu();
    toggleLabelByVisibility();
    moveModebarToRail();
  });
  document.addEventListener("radqy:table:updated", ()=>{
    buildLabelMenu();
    toggleLabelByVisibility();
    moveModebarToRail();
  });

  // Hover sync inbound: highlight corresponding point
  document.addEventListener("radqy:hover:change", function(e){
    const det = e && e.detail ? e.detail : {};
    const caseName = det.caseName != null ? String(det.caseName) : null;
    const on = !!det.on;
    if (!window.Plotly || !window.UMAP_STATE.embedding) return;
    const idx = on ? findRowIndexByCaseName(caseName) : -1;
    restyleMarkers(idx);
    if (typeof window.hoverTableRow === "function") {
      window.hoverTableRow(caseName, on);
    }
  });
})();
