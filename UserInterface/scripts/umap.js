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
  let suppressWarn = false;

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
    const sample = rows[0] || {};
    return Object.keys(sample).filter(k => Number.isFinite(parseFloat(sample[k])));
  }

  function buildMatrix(rows, cols){
    return rows.map(r => cols.map(c => {
      const v = r[c];
      const num = (typeof v === "number") ? v : parseFloat(v);
      return Number.isFinite(num) ? num : 0;
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

  function restyleMarkers(hoverIdx){
    if (!window.Plotly || !window.UMAP_STATE.embedding) return;
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
    const sizes = emb.map((p,i)=>{
      if (i === hoverIdx) return 14;
      if (sel.has(i)) return 12;
      return 10;
    });
    const widths = emb.map(()=>0);
    Plotly.restyle(hostId, {
      "marker.color":[colors],
      "marker.size":[sizes],
      "marker.line.width":[widths],
      "marker.opacity":[1],
      "selectedpoints":[Array.from(selectedPoints)],
      "selected.marker.opacity":[1],
      "unselected.marker.opacity":[1]
    });
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
    const sizes = embedding.map((_,i)=> sel.has(i) ? 12 : 10);
    return {
      x: embedding.map(p=>p[0]),
      y: embedding.map(p=>p[1]),
      mode: "markers",
      type: "scattergl",
      text: rows.map((r,idx)=> r && r["P#"] ? r["P#"] : `P${idx+1}`),
      hoverinfo: "text",
      marker: {
        size: sizes,
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
    Plotly.relayout(hostId, { shapes: shape ? [shape] : [] });
  }

  function plotEmbedding(embedding, rows){
    if (!embedding) return;
    loadPlotly(()=>{
      if (!suppressWarn){
        suppressWarn = true;
        const origWarn = console.warn;
        console.warn = function(msg, ...rest){
          if (typeof msg === "string" && msg.includes("unrecognized GUI edit: selections")) return;
          return origWarn.apply(console, [msg, ...rest]);
        };
      }
      const trace = buildTrace(embedding, rows);
      const layout = {
        margin:{l:10,r:10,t:10,b:10},
        showlegend:false,
        hovermode:"closest",
        xaxis:{showgrid:false, zeroline:false, showticklabels:false},
        yaxis:{showgrid:false, zeroline:false, showticklabels:false},
        dragmode:"lasso",
        shapes: selectionShape ? [selectionShape] : []
      };
      const cfg = {
        responsive:true,
        scrollZoom:true,
        displaylogo:false,
        modeBarButtonsToAdd:[],
        modeBarButtonsToRemove:[],
        displayModeBar:true
      };
      Plotly.react(hostId, [trace], layout, cfg).then(() => {
        const plot = document.getElementById(hostId);
        if (!plotReady) {
          // Lasso/box selection: keep hover feedback while drawing
          plot.on("plotly_selecting", ev=>{
            const pts = (ev && ev.points) || [];
            const last = pts[pts.length - 1];
            const idx = last ? last.pointIndex : -1;
            restyleMarkers(idx);
            const name = idx >= 0 ? caseNameForRow(idx) : null;
            try{
              document.dispatchEvent(new CustomEvent("radqy:hover:change",{detail:{caseName:name,on:idx>=0,rowIndex:idx}}));
            }catch(e){}
            if (typeof window.hoverTableRow === "function") {
              window.hoverTableRow(name, idx>=0);
            }
          });
          plot.on("plotly_selected", ev=>{
            const pts = (ev && ev.points) || [];
            const idxs = Array.from(new Set(pts.map(p=>p.pointIndex).filter(Number.isFinite)));
            if (window.RADQY && typeof window.RADQY.setSelectedRowIndices === "function"){
              window.RADQY.setSelectedRowIndices(idxs);
            }
            setSelectionShape(ev);
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
          plotReady = true;
        }
        restyleMarkers(-1);
      });
    });
  }

  function computeEmbedding(state){
    const rows = (window.DATA && window.DATA.ROWS) || [];
    if (!rows.length) return null;
    const cols = numericColumns(rows);
    if (cols.length < 2) return null;
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
      plotEmbedding(embedding, rows);
    });
    return embedding;
  }

  window.renderUMAP = function(nextState){
    if (nextState) window.UMAP_STATE = Object.assign({}, window.UMAP_STATE, nextState);
    if (nextState && nextState.recompute) {
      computeEmbedding(window.UMAP_STATE);
      return;
    }
    if (window.UMAP_STATE.embedding) {
      plotEmbedding(window.UMAP_STATE.embedding, (window.DATA && window.DATA.ROWS) || []);
    } else {
      computeEmbedding(window.UMAP_STATE);
    }
  };

  function initControls(){
    const d = (window.RADQY_CONFIG && window.RADQY_CONFIG.umapDefaults) || {};
    const elC  = document.getElementById("umap_components");
    const elN  = document.getElementById("umap_neighbors");
    const elM  = document.getElementById("umap_metric");
    const elMD = document.getElementById("umap_mindist");
    const elS  = document.getElementById("umap_spread");
    if (elM && d.distanceOptions){
      elM.innerHTML = d.distanceOptions.map(v => `<option value="${v}">${v}</option>`).join("");
    }
    if (elC)  elC.value  = d.nComponents ?? 2;
    if (elN)  elN.value  = d.nNeighbors  ?? 15;
    if (elM)  elM.value  = d.distanceFn  ?? "Euclidean";
    if (elMD) elMD.value = d.minDist     ?? 0.1;
    if (elS)  elS.value  = d.spread      ?? 1;
    const sync = () => {
      window.renderUMAP({
        nComponents: Number(elC.value),
        nNeighbors:  Number(elN.value),
        distanceFn:  elM.value,
        minDist:     Number(elMD.value),
        spread:      Number(elS.value),
        recompute:   true
      });
    };
    [elC, elN, elM, elMD, elS].forEach(el => el && el.addEventListener("change", sync));
    sync();
  }

  document.addEventListener("DOMContentLoaded", initControls);
  document.addEventListener("radqy:data:ready", ()=> window.renderUMAP({recompute:true}));
  document.addEventListener("radqy:data:updated", (e)=>{
    const det = e && e.detail ? e.detail : {};
    if (det && det.skipUMAP) return;
    window.renderUMAP({recompute:true});
  });
  document.addEventListener("radqy:view:columns", ()=> window.renderUMAP({recompute:true}));
  document.addEventListener("radqy:colorby:changed", ()=> window.renderUMAP());
  document.addEventListener("radqy:selection-changed", ()=> restyleMarkers(-1));

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
