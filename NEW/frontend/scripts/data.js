// ===============================
// Exit splash → main view
// ===============================
function exitToMainView() {
  document.body.classList.remove("is-splash");

  const splash = document.getElementById("splash") || document.getElementById("upload-section");
  if (splash) splash.style.display = "none";

  const grid = document.querySelector(".grid");
  if (grid) grid.style.display = "";

  document.querySelectorAll(".topcenter .btn").forEach(b => (b.disabled = false));

  const metaHost = document.getElementById("infometa") || document.getElementById("meta-info");
  if (metaHost) metaHost.style.display = "";

  window.scrollTo({ top: 0, behavior: "instant" });
}

(function () {
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- small io helpers ----------
  function readText(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result || ""));
      fr.onerror = () => reject(fr.error || new Error("Read failed"));
      fr.readAsText(file);
    });
  }

  function splitLines(s) {
    s = String(s || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return s.split("\n").filter(l => l.length > 0);
  }

  function stripBOM(s) {
    return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
  }

  // ---------- TSV parsing ----------
  function parseTSV(txt) {
    txt = stripBOM(txt);
    const allLines = splitLines(txt);
    if (!allLines.length) return { headers: [], rows: [] };

    // find the line after "#Quality Metrics:"
    let dataStart = -1;
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].trim().toLowerCase().startsWith("#quality metrics")) {
        dataStart = i + 1;
        break;
      }
    }
    // fallback: first non-comment line
    if (dataStart === -1 || dataStart >= allLines.length) {
      dataStart = allLines.findIndex(l => !l.trim().startsWith("#"));
    }
    if (dataStart === -1) return { headers: [], rows: [] };

    const lines = allLines.slice(dataStart);
    const headers = lines[0].split("\t").map(h => String(h).trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      if (!cols.length || !cols[0]) continue;
      const o = {};
      for (let j = 0; j < headers.length; j++) {
        o[headers[j]] = cols[j] ?? "";
      }
      rows.push(o);
    }
    return { headers, rows };
  }

  // ---------- meta extraction ----------
  function parseBool(val) {
    if (val == null) return false;
    const t = String(val).trim().toLowerCase();
    return t === "true" || t === "1" || t === "yes";
  }

  function cleanPath(val) {
    if (!val) return "";
    const trimmed = String(val).trim();
    // common outputs end with a trailing period from the header comment
    return trimmed.replace(/\.*$/, "");
  }

  function buildMetaFromComments(txt) {
    const meta = {
      scantype: "",
      dataset: "",
      N: 0,
      tags: [],
      iqms: [],
      aux: [],
      exts: [],
      start_time: "",
      elapsed_time: "",
      outdir: "",
      settings: "",
      settingsMap: {}
    };

    const lines = splitLines(stripBOM(txt));

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("#")) continue;

      const lower = t.toLowerCase();

      if (lower.startsWith("#scantype:")) {
        meta.scantype = t.split(":")[1].trim();
      } else if (lower.startsWith("#dataset:")) {
        meta.dataset = t.split(":")[1].trim();
      } else if (lower.startsWith("#tags")) {
        const afterColon = t.split(":")[1] || "";
        const parts = afterColon.split(",");
        meta.tags = parts
          .map(p => p.trim())
          .map(p => {
            const m = p.match(/^\d+\.\s*(.*)$/);
            return (m ? m[1] : p).trim();
          })
          .filter(Boolean);
      } else if (lower.startsWith("#iqms") || lower.startsWith("#iqm")) {
        const afterColon = t.split(":")[1] || "";
        const parts = afterColon.split(",");
        meta.iqms = parts
          .map(p => p.trim())
          .map(p => {
            const m = p.match(/^\d+\.\s*(.*)$/);
            return (m ? m[1] : p).trim();
          })
          .filter(Boolean);
      } else if (lower.startsWith("#start_time:")) {
        const idx = t.indexOf(":");
        meta.start_time = idx >= 0 ? t.slice(idx + 1).trim() : "";
      } else if (lower.startsWith("#elapsed_time:")) {
        const idx = t.indexOf(":");
        meta.elapsed_time = idx >= 0 ? t.slice(idx + 1).trim() : "";
      } else if (lower.startsWith("#outdir:")) {
        const idx = t.indexOf(":");
        const raw = idx >= 0 ? t.slice(idx + 1) : "";
        meta.outdir = cleanPath(raw);
      } else if (lower.startsWith("#settings:")) {
        const idx = t.indexOf(":");
        const raw = idx >= 0 ? t.slice(idx + 1) : "";
        meta.settings = raw.trim();

        const parts = raw.split("|").map(p => p.trim()).filter(Boolean);
        parts.forEach(p => {
          const kv = p.split("=");
          if (kv.length < 2) return;
          const key = kv[0].trim();
          const val = kv.slice(1).join("=").trim();
          meta.settingsMap[key] = val;
          if (key === "save_fgbg") meta.save_fgbg = parseBool(val);
          if (key === "save_fg") meta.save_fg = parseBool(val);
          if (key === "save_bg") meta.save_bg = parseBool(val);
          if (key === "inputdir") meta.inputdir = cleanPath(val);
        });

        // robust substring check for save_fgbg=True / true / YES / etc.
        window.RADQY_SAVE_FGBG =
          raw.toLowerCase().includes("save_fgbg=true") ||
          raw.toLowerCase().includes("save-fgbg=true") ||
          raw.toLowerCase().includes("save_fgbg=1") ||
          raw.toLowerCase().includes("save-fgbg=1") ||
          raw.toLowerCase().includes("save_fgbg=yes") ||
          raw.toLowerCase().includes("save-fgbg=yes");
      }
    }
    return meta;
  }

  function buildMeta(headers, rows, fileName, fullText) {
    const base = buildMetaFromComments(fullText);
    let N = rows.length;

    // count participants from "P#" if present
    const lower = headers.map(h => h.toLowerCase());
    const idx = lower.indexOf("p#");
    if (idx !== -1) {
      const key = headers[idx];
      const uniq = new Set(
        rows
          .map(r => String(r[key] || "").trim())
          .filter(Boolean)
      );
      if (uniq.size > 0) N = uniq.size;
    }

    return {
      scantype: base.scantype || "—",
      dataset: base.dataset || (fileName ? fileName.replace(/\.[^.]+$/, "") : "—"),
      N,
      tags: base.tags || [],
      iqms: base.iqms || [],
      aux: base.aux || [],
      exts: base.exts || [],
      nTAG: 0,
      nIQM: 0,
      nAUX: 0,
      nEXT: 0,
      start_time: base.start_time || "",
      elapsed_time: base.elapsed_time || "",
      outdir: base.outdir || "",
      settings: base.settings || "",
      settingsMap: base.settingsMap || {},
      save_fgbg: base.save_fgbg || false,
      save_fg: base.save_fg || false,
      save_bg: base.save_bg || false,
      inputdir: base.inputdir || ""
    };
  }

  // ---------- cleaning helpers ----------
  function formatNumber(num) {
    if (!isFinite(num)) return "NA";
    let s = num.toFixed(2);
    s = s.replace(/\.?0+$/, "");
    return s;
  }

  function normalizeVendor(v) {
    const t = String(v || "").trim();
    if (!t) return "NA";
    const low = t.toLowerCase();

    if (low.includes("siemens")) return "Siemens";
    if (low.includes("philips")) return "Philips";
    if (low.includes("general electric")) return "GE";
    if (low.includes("ge ") || low === "ge" || low.includes("ge medical")) return "GE";
    if (low.includes("toshiba")) return "Toshiba";
    if (low.includes("hitachi")) return "Hitachi";

    return t;
  }

  function cleanRows(headers, rows) {
    const lower = headers.map(h => h.toLowerCase());
    const vendorIdx = lower.findIndex(
      h => h === "mfr" || h === "manufacturer" || h === "vendor"
    );

    return rows.map(r => {
      const out = {};
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        let val = r[key];

        if (val == null) val = "";
        val = String(val).trim();

        if (!val) {
          out[key] = "NA";
          continue;
        }

        if (j === vendorIdx) {
          out[key] = normalizeVendor(val);
          continue;
        }

        const num = Number(val.replace(",", ""));
        if (!Number.isNaN(num)) {
          out[key] = formatNumber(num);
        } else {
          out[key] = val;
        }
      }
      return out;
    });
  }

  // ---------- meta rendering ----------
  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderMeta(meta) {
    const host = $("#infometa") || $("#meta-info");
    if (!host) return;

    host.style.display = "";
    host.innerHTML =
      `<span class="meta-label">Scantype:</span> ${escapeHTML(meta.scantype)} ` +
      `| <span class="meta-label">Dataset:</span> ${escapeHTML(meta.dataset)} ` +
      `| <span class="meta-label">N:</span> ${meta.N}`;
  }

  // ---------- upload binding ----------
  async function handleFile(file) {
    if (!file) return;

    const txt = await readText(file);
    const parsed = parseTSV(txt);
    const meta = buildMeta(parsed.headers, parsed.rows, file.name, txt);

    // --- strip Images column from main data, but keep it for image panel ---
    const IMG_COL = "Images";
    const imgIdx = parsed.headers.indexOf(IMG_COL);

    let headersNoImg = parsed.headers;
    let rowsNoImg = parsed.rows;
    let imagesPerRow = null;

    if (imgIdx !== -1) {
      imagesPerRow = parsed.rows.map(r => r[IMG_COL] || "");
      headersNoImg = parsed.headers.filter(h => h !== IMG_COL);
      rowsNoImg = parsed.rows.map(r => {
        const copy = { ...r };
        delete copy[IMG_COL];
        return copy;
      });
    }

    const cleaned = cleanRows(headersNoImg, rowsNoImg);

    // global data object used by table / chart / image / etc.
    window.DATA = {
      META: meta,
      HEADERS: headersNoImg,
      ROWS: cleaned,
      RAW_ROWS: rowsNoImg,
      IMAGES: imagesPerRow // array aligned with ROWS index
    };

    // PID parts: topfolder -- subfolder -- patientId (aligned to ROWS)
    window.DATA.PID_PARTS = rowsNoImg.map(r => {
      const raw = r["Participant (topfolder--subfolder--patient ID)"] || "";
      const parts = String(raw).split("--");
      return {
        full: raw,
        topfolder: parts[0] || "",
        subfolder: parts[1] || "",
        patientId: parts.slice(2).join("--") || ""
      };
    });

    window.DATA.RUN_INFO = {
      start_time: meta.start_time || "",
      elapsed_time: meta.elapsed_time || "",
      outdir: meta.outdir || "",
      settings: meta.settings || "",
      settingsMap: meta.settingsMap || {},
      inputdir: meta.inputdir || ""
    };

    // Attach real image sizes (ROW, COL) to DATA
    window.DATA.IMAGE_SIZE = window.DATA.ROWS.map((row, i) => {
      return {
        row: Number(row["ROW"]) || 256,  // fallback if missing
        col: Number(row["COL"]) || 256
      };
    });


    if (window.RADQY && typeof RADQY.log === "function") {
      RADQY.log("file_loaded", {
        filename: file.name,
        nRows: rowsNoImg.length,
        meta
      });
    }

    renderMeta(meta);

    const uploadBtn = document.getElementById("upload-button");
    const uploadHint = document.getElementById("upload-hint");
    if (uploadBtn) uploadBtn.style.display = "none";
    if (uploadHint) uploadHint.style.display = "none";

    exitToMainView();

    // FG/BG buttons visibility based on global flag
    const fg = document.getElementById("btnfgmask");
    const bg = document.getElementById("btnbgmask");
    if (fg && bg) {
      if (window.RADQY_SAVE_FGBG) {
        fg.style.display = "";
        bg.style.display = "";
      } else {
        fg.style.display = "none";
        bg.style.display = "none";
      }
    }

    document.dispatchEvent(
      new CustomEvent("radqy:data:ready", { detail: { data: window.DATA } })
    );
  }

  function bindUpload() {
    const input = $("#upload-input");
    const label = $("#upload-button");
    if (!input) return;

    if (label && label.tagName === "LABEL" && label.htmlFor !== "upload-input") {
      label.htmlFor = "upload-input";
    }

    input.addEventListener("change", e => {
      const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
      handleFile(f).catch(console.error);
    });

    const dropHost = $("#upload-section") || $("#splash");
    if (dropHost) {
      ["dragenter", "dragover"].forEach(evt =>
        dropHost.addEventListener(evt, e => e.preventDefault())
      );
      dropHost.addEventListener("drop", e => {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0] || null;
        handleFile(f).catch(console.error);
      });
    }
  }

  function boot() {
    const metaHost = $("#infometa") || $("#meta-info");
    if (metaHost) metaHost.style.display = "none";
    bindUpload();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

