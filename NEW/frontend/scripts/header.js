// header.js
(function () {

  function on(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  function logSafe(action, detail) {
    if (window.RADQY && typeof RADQY.log === "function") {
      RADQY.log(action, detail || {});
    }
  }

  // Global mask visibility state
  if (!window.RADQY_MASK_VIS) {
    window.RADQY_MASK_VIS = {
      img: true,   // image visibility
      fg: true,    // foreground mask
      bg: true     // background mask
    };
  }

  // Auto-enable highlight states for image, fg, bg buttons
  function updateMaskButtonStates() {
    ["image", "fgmask", "bgmask"].forEach(panel => {
      const btn = document.getElementById("btn" + panel);
      if (!btn) return;

      // Map btn IDs to our mask keys: image → img, fgmask → fg, bgmask → bg
      const key = panel === "image" ? "img"
                : panel === "fgmask" ? "fg"
                : panel === "bgmask" ? "bg"
                : null;
      if (!key) return;

      btn.classList.toggle("btnon", window.RADQY_MASK_VIS[key]);
    });
  }

  document.addEventListener("radqy:selection-changed", updateMaskButtonStates);

  document.addEventListener("DOMContentLoaded", () => {
    function maskAvailability() {
      const meta = window.DATA?.META || {};
      return {
        hasFG: !!(meta.save_fg || meta.save_fgbg),
        hasBG: !!(meta.save_bg || meta.save_fgbg)
      };
    }

    function syncPanelsToMaskVis() {
      const avail = maskAvailability();
      const anyMaskOn =
        (!!window.RADQY_MASK_VIS.img) ||
        (avail.hasFG && !!window.RADQY_MASK_VIS.fg) ||
        (avail.hasBG && !!window.RADQY_MASK_VIS.bg);
      const hasSelection =
        Array.isArray(window.RADQY?._selectedIndices) &&
        window.RADQY._selectedIndices.length > 0;
      if (window.RADQY) {
        RADQY.visibility.image = anyMaskOn && hasSelection;
        RADQY.visibility.fgmask = avail.hasFG && !!window.RADQY_MASK_VIS.fg;
        RADQY.visibility.bgmask = avail.hasBG && !!window.RADQY_MASK_VIS.bg;
        RADQY._vis = RADQY._vis || {};
        RADQY._vis.image = RADQY.visibility.image;
        RADQY._vis.fgmask = RADQY.visibility.fgmask;
        RADQY._vis.bgmask = RADQY.visibility.bgmask;
        if (typeof RADQY._write === "function") {
          RADQY._write(RADQY._vis);
        }
        if (typeof RADQY.applyVisibility === "function") {
          RADQY.applyVisibility();
        }
      }
    }

    function clearSelectionIfAllOff() {
      const avail = maskAvailability();
      const imgOff = !window.RADQY_MASK_VIS.img;
      const fgOff = !avail.hasFG || !window.RADQY_MASK_VIS.fg;
      const bgOff = !avail.hasBG || !window.RADQY_MASK_VIS.bg;
      const allOff = imgOff && fgOff && bgOff;
      if (allOff) {
        if (window.RADQY && typeof RADQY.setSelectedRowIndices === "function") {
          RADQY.setSelectedRowIndices([]);
        } else {
          document.dispatchEvent(new CustomEvent("radqy:selection-changed", {
            detail: { count: 0, indices: [] }
          }));
        }
        syncPanelsToMaskVis();
        updateMaskButtonStates();
      }
    }

    // Standard panel toggles (table, chart, etc.)
    ["table", "chart", "umap"].forEach(panel => {
      on("btn" + panel, () => {
        RADQY.togglePanel(panel);
        logSafe("toggle_panel", { panel, on: !!RADQY._vis[panel] });
      });
    });

    // ------------------ IMAGE visibility toggle ------------------
    // IMAGE TOGGLE — independent of FG/BG
    on("btnimage", () => {
      window.RADQY_MASK_VIS.img = !window.RADQY_MASK_VIS.img;

      logSafe("toggle_panel", { panel: "image", on: window.RADQY_MASK_VIS.img });

      document.dispatchEvent(new CustomEvent("radqy:masks-changed", {
        detail: { ...window.RADQY_MASK_VIS }
      }));

      syncPanelsToMaskVis();
      clearSelectionIfAllOff();
      updateMaskButtonStates();
    });

    // ------------------ FG MASK toggle ------------------
    on("btnfgmask", () => {
      window.RADQY_MASK_VIS.fg = !window.RADQY_MASK_VIS.fg;

      document.dispatchEvent(new CustomEvent("radqy:masks-changed", {
        detail: { ...window.RADQY_MASK_VIS }
      }));

      syncPanelsToMaskVis();
      clearSelectionIfAllOff();
      updateMaskButtonStates();
    });

    // ------------------ BG MASK toggle ------------------
    on("btnbgmask", () => {
      window.RADQY_MASK_VIS.bg = !window.RADQY_MASK_VIS.bg;

      document.dispatchEvent(new CustomEvent("radqy:masks-changed", {
        detail: { ...window.RADQY_MASK_VIS }
      }));

      syncPanelsToMaskVis();
      clearSelectionIfAllOff();
      updateMaskButtonStates();
    });

    // PANEL: Report
    on("btnreport", () => {
      const before = !!RADQY._vis.report;
      RADQY.toggleReport();
      const after = !!RADQY._vis.report;

      if (before !== after) {
        logSafe("toggle_report", { open: after });
      }
    });

    // Hide FG/BG buttons if not available (based on meta)
    const meta = window.DATA?.META || {};
    const btnFGMask = document.getElementById("btnfgmask");
    const btnBGMask = document.getElementById("btnbgmask");

    const hasFG = meta.save_fg === true || meta.save_fgbg === true;
    const hasBG = meta.save_bg === true || meta.save_fgbg === true;

    if (btnFGMask && !hasFG) btnFGMask.style.display = "none";
    if (btnBGMask && !hasBG) btnBGMask.style.display = "none";

    // HARD RESET
    on("btnreset", () => {
      window.RADQY_REPORT_LOCK = false;
      const banner = document.getElementById("report-open-banner");
      if (banner) banner.style.display = "none";

      try {
        localStorage.removeItem(RADQY._STORAGE_KEY);
      } catch (e) {}

      logSafe("reset_panels", { source: "header_reset" });

      if (typeof location !== "undefined" && location.reload) {
        location.reload();
      }
    });

    updateMaskButtonStates();
  });
})();
