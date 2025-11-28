window.UMAP_STATE = window.UMAP_STATE || {};

function initUmapControls(){
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
    window.UMAP_STATE = {
      nComponents: Number(elC.value),
      nNeighbors:  Number(elN.value),
      distanceFn:  elM.value,
      minDist:     Number(elMD.value),
      spread:      Number(elS.value)
    };
    if (typeof window.renderUMAP === "function") window.renderUMAP(window.UMAP_STATE);
  };

  [elC, elN, elM, elMD, elS].forEach(el => el && el.addEventListener("change", sync));
  sync();
}

document.addEventListener("DOMContentLoaded", initUmapControls);
