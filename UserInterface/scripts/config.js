// Global config
window.RADQY_CONFIG = {
  // Report banner text
  reportConfirmTitle: "Open AI Report",
  reportConfirmText: "QC review looks complete. Would you like to open the AI Report?",

  // Landing/splash
  viewResultsText: "View Results",
  uploadHintText: "Upload the <code>results.tsv</code> file located in your RadQy output directory",
  outputDir: ".\\UserInterface\\Data\\outdir",

  // OPT / Custom Selection
  customSelectionExample: "PSNR > 2 OR 3<=snr1<80 AND CPP<=15 or mfr=='NA'",
  optMessages: {
    empty:
      "Selection is empty. Enter a condition such as PSNR > 2 OR 3<=snr1<80 AND CPP<=15.",
    invalid:
      "Selection expression is not valid. Please check the metric names and operators.",
    error:
      "Selection expression raised an error while evaluating. Please check the syntax.",
    noRows:
      "No participants are available to filter yet.",
    noMatch:
      "No participants satisfy the given condition."
  },

  // Chart defaults
  chartDefaults: { sortBy: "RNG", measureBy: "RNG", colorBy: "P#" },
  

  // UMAP defaults
  umapDefaults: {
    nComponents: 2,
    nNeighbors: 15,
    distanceFn: "Euclidean",
    minDist: 0.1,
    spread: 1,
    seed: 42, // fixed seed for reproducible UMAP layouts
    distanceOptions: [
      "Euclidean","Manhattan","Chebyshev","Minkowski","Canberra","BrayCurtis",
      "Cosine","Correlation","Hamming","Jaccard","Dice","Kulsinski",
      "RogersTanimoto","RussellRao","SokalSneath","SokalMichener","Yule"
    ]
  }
};

// Boot-time seeding for splash, custom selection, and chart defaults
document.addEventListener("DOMContentLoaded", () => {
  const cfg = window.RADQY_CONFIG || {};

  // Splash text
  const btn = document.getElementById("upload-button");
  if (btn && cfg.viewResultsText) btn.textContent = cfg.viewResultsText;

  const hint = document.getElementById("upload-hint");
  if (hint) {
    const dir = cfg.outputDir || "";
    const txt = cfg.uploadHintText || "";
    hint.innerHTML = `${txt} <span class="path">(${dir})</span>`;
  }

  // Example: set custom selection placeholder
  const opt = document.getElementById("customsel");
  if (opt && cfg.customSelectionExample) {
    opt.placeholder = "Custom Selection e.g. " + cfg.customSelectionExample;
  }

  // Chart default button labels (when present)
  const cdef = cfg.chartDefaults || {};
  const bSort    = document.getElementById("chartSort");
  const bMeasure = document.getElementById("chartMeasure");
  const bColor   = document.getElementById("chartColor");
  if (bSort    && cdef.sortBy)    bSort.textContent    = cdef.sortBy;
  if (bMeasure && cdef.measureBy) bMeasure.textContent = cdef.measureBy;
  if (bColor   && cdef.colorBy)   bColor.textContent   = cdef.colorBy;

  if (window.CHART_STATE) {
    if (cdef.sortBy)    window.CHART_STATE.sortBy    = cdef.sortBy;
    if (cdef.measureBy) {
      window.CHART_STATE.measureBy     = cdef.measureBy;
      window.CHART_STATE.currentMetric = cdef.measureBy;
    }
    if (cdef.colorBy)   window.CHART_STATE.colorBy   = cdef.colorBy;
  }
});
