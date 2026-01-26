// image.js — Show thumbnails (img / fg / bg) for selected participant(s)
(function () {
  const panel =
    document.getElementById("imagehost") ||
    document.getElementById("image-panel");

  if (!panel) return;

  // Derive base directory for images: prefer run outdir, fall back to legacy path
  function getLegacyRoot(dataset) {
    const path = window.location.pathname; // e.g., /frontend/index.html
    const key = "/frontend";
    const idx = path.indexOf(key);
    const root = idx === -1 ? "" : path.slice(0, idx);
    const safeDataset = (dataset || "").trim();
    return `${root}/frontend/Data/${safeDataset}/`;
  }

  function toWebPath(absPath) {
    if (!absPath) return "";
    const idx = absPath.indexOf("/frontend/");
    if (idx === -1) return "";
    return absPath.slice(idx);
  }

  function buildBaseDirs(dataset) {
    const runInfo = (window.DATA && window.DATA.RUN_INFO) || {};
    const metaOutdir = (window.DATA && window.DATA.META && window.DATA.META.outdir) || "";
    const outdir = runInfo.outdir || metaOutdir || "";

    const bases = [];
    if (outdir) {
      const clean = outdir.replace(/\/?$/, "/");
      const webPath = toWebPath(clean);
      if (webPath) bases.push(webPath);
      bases.push(clean);
    }

    const legacy = getLegacyRoot(dataset);
    if (legacy && legacy.trim() !== "//") bases.push(legacy);

    // de-duplicate while preserving order
    const seen = new Set();
    return bases.filter(b => {
      if (seen.has(b)) return false;
      seen.add(b);
      return true;
    });
  }

  function extractSliceNumber(fname) {
    if (!fname) return "";
    const base = fname.split("/").pop();
    const noExt = base.replace(/\.[^.]+$/, "");
    const m = noExt.match(/(\d+)$/);
    return m ? m[1] : noExt;
  }

  function getChannelVisibility() {
    const v = window.RADQY_MASK_VIS || {};

    return {
      showImg: v.img !== false,
      showFG:  v.fg  !== false,
      showBG:  v.bg  !== false
    };
  }

  function getChannelAvailability() {
    const meta = (window.DATA && window.DATA.META) || {};
    const hasFG = !!(meta.save_fg || meta.save_fgbg);
    const hasBG = !!(meta.save_bg || meta.save_fgbg);
    return { hasFG, hasBG };
  }

  function makeScanCell(baseDirs, pidFolder, fname, vis, avail, rowIdx) {
    const sliceNum = extractSliceNumber(fname);

    const cell = document.createElement("div");
    cell.className = "image-cell";

    const idxDiv = document.createElement("div");
    idxDiv.className = "image-index";
    idxDiv.textContent = "Slice " + sliceNum;
    cell.appendChild(idxDiv);

    const rowDiv = document.createElement("div");
    rowDiv.className = "image-row";

    const entriesAll = [{ kind: "im", sub: "" }];
    if (avail.hasFG) entriesAll.push({ kind: "fg", sub: "foreground/" });
    if (avail.hasBG) entriesAll.push({ kind: "bg", sub: "background/" });

    const entriesVisible = [];
    if (vis.showImg) entriesVisible.push({ kind: "im", sub: "" });
    if (vis.showFG && avail.hasFG) entriesVisible.push({ kind: "fg", sub: "foreground/" });
    if (vis.showBG && avail.hasBG) entriesVisible.push({ kind: "bg", sub: "background/" });

    // Always show at least the base image in the grid even if masks are toggled off
    const thumbEntries = entriesVisible.length ? entriesVisible : [{ kind: "im", sub: "" }];

    const channelCount = thumbEntries.length || 1;
    cell.style.setProperty("--channels", channelCount);
    cell.classList.add("chan-" + channelCount);

    const primaryBase = baseDirs[0] || "";
    const sliceSources = [];
    const lightboxSources = [];
    const size =
      (window.DATA &&
       window.DATA.IMAGE_SIZE &&
       window.DATA.IMAGE_SIZE[rowIdx]) ||
      { row: 256, col: 256 };

    entriesAll.forEach(info => {
      if (!primaryBase) return;
      lightboxSources.push({
        label: info.kind,
        src: `${primaryBase}${pidFolder}/${info.sub}${fname}`,
        aspect: `${size.col} / ${size.row}`
      });
    });

    thumbEntries.forEach(info => {
      const im = document.createElement("img");
      im.dataset.baseIndex = "0";
      im.dataset.sub = info.sub;
      im.dataset.fname = fname;
      im.dataset.pid = pidFolder;

      function setSrcFromBase(idx) {
        const base = baseDirs[idx];
        if (!base) return false;
        im.src = `${base}${pidFolder}/${info.sub}${fname}`;
        im.dataset.baseIndex = String(idx);
        return true;
      }

      setSrcFromBase(0);
      im.alt = `${info.kind}-${fname}`;
      im.loading = "lazy";

      im.style.aspectRatio = `${size.col} / ${size.row}`;

      im.onerror = function () {
        // try next base dir if available
        const next = Number(this.dataset.baseIndex || 0) + 1;
        if (setSrcFromBase(next)) return;
        this.style.display = "none";
      };

      rowDiv.appendChild(im);

      // primary source for lightbox
      if (primaryBase) {
        sliceSources.push({
          label: info.kind,
          src: `${primaryBase}${pidFolder}/${info.sub}${fname}`,
          aspect: `${size.col} / ${size.row}`
        });
      }
    });

    cell.appendChild(rowDiv);

    const labels = document.createElement("div");
    labels.className = "image-labels";
    thumbEntries.forEach(info => {
      const sp = document.createElement("span");
      sp.textContent = info.kind;
      labels.appendChild(sp);
    });
    cell.appendChild(labels);

    // Slice-level lightbox on title click
    idxDiv.style.cursor = "pointer";
    idxDiv.addEventListener("click", () => {
      const sources = lightboxSources.length ? lightboxSources : sliceSources;
      if (!sources.length) return;
      showSliceLightbox(sources, `Slice ${sliceNum}`);
    });

    return cell;
  }

  function getPNumberForRow(row) {
    if (!row) return "";
    if (row["P#"] != null) return String(row["P#"]);
    if (row["p#"] != null) return String(row["p#"]);
    return "";
  }

  function getColorIndexForRow(rowIdx) {
    // Prefer the detailed mapping (uses current Color-by map), fall back to rowCats
    if (window.RADQY && typeof window.RADQY.getRowCategoryDetail === "function") {
      const detail = window.RADQY.getRowCategoryDetail(rowIdx);
      const cat = detail && Number.isFinite(detail.cat) ? detail.cat : 1;
      return cat || 1;
    }

    let cat = 1;
    if (window.RADQY && typeof window.RADQY.getRowCategoryForIndex === "function") {
      const v = window.RADQY.getRowCategoryForIndex(rowIdx);
      if (v && Number.isFinite(v)) cat = v;
    }
    return cat || 1;
  }

  function renderImagesForSelected() {
    if (!window.DATA || !window.DATA.ROWS || !window.DATA.IMAGES) return;

    panel.innerHTML = "";

    let selectedIdxs =
      (window.RADQY && typeof window.RADQY.getSelectedRowIndices === "function")
        ? window.RADQY.getSelectedRowIndices()
        : [];

    // Keep render order aligned with current table order, but move most recent selection to top
    selectedIdxs = (function orderByTable(idxArr){
      if (!window.dt || !idxArr.length) return idxArr.slice().sort((a,b)=>a-b);
      const set = new Set(idxArr);
      const ordered = [];
      window.dt.rows({ order: 'applied' }).every(function(){
        const idx = this.index();
        if (set.has(idx)) ordered.push(idx);
      });
      if (!ordered.length) return idxArr.slice().sort((a,b)=>a-b);
      const lastSel = window.RADQY_LAST_SELECTED;
      if (Number.isFinite(lastSel) && set.has(lastSel)) {
        ordered.unshift(lastSel);
        const seen = new Set([lastSel]);
        return ordered.filter(i => {
          if (seen.has(i)) return false;
          seen.add(i);
          return true;
        });
      }
      return ordered;
    })(selectedIdxs);

    if (!selectedIdxs.length) {
      panel.innerHTML =
        '<p style="color:#888; padding:10px;">No participant selected.</p>';
      return;
    }

    const dataset = (window.DATA.META && window.DATA.META.dataset || "").trim();
    if (!dataset) return;

    const baseDirs = buildBaseDirs(dataset);
    const vis = getChannelVisibility();
    const avail = getChannelAvailability();

    // If masks are not available, don't attempt to render them even if toggled
    if (!avail.hasFG) vis.showFG = false;
    if (!avail.hasBG) vis.showBG = false;

    selectedIdxs.forEach((rowIdx) => {
      const row = window.DATA.ROWS[rowIdx];
      const pidRaw = row["Participant (topfolder--subfolder--patient ID)"];
      const imgListRaw = window.DATA.IMAGES[rowIdx];
      const pidParts = window.RADQY?.getPidParts ? window.RADQY.getPidParts(rowIdx) : null;

      if (!pidRaw || !imgListRaw) return;

      const pidFolder = pidRaw.replace(/\s+/g, "_");

      const imgList = imgListRaw
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      if (!imgList.length) return;

      const participantBlock = document.createElement("div");
      participantBlock.className = "image-participant-block";

      const title = document.createElement("div");
      title.className = "image-participant-title";

      const pNumber = getPNumberForRow(row);
      title.innerHTML = "";
      if (pNumber || pidRaw) {
        const label = document.createElement("strong");
        label.textContent = pNumber ? `${pNumber}:` : "P#:";

        const pidSpan = document.createElement("span");
        pidSpan.className = "image-participant-pid";

        if (pidParts) {
          const top = pidParts.topfolder || "";
          const sub = pidParts.subfolder || "";
          const pat = pidParts.patientId || "";
          const pieces = [];
          if (top) pieces.push(top);
          if (sub) pieces.push(sub);
          const pidText = pieces.join("--");
          pidSpan.textContent = pidText ? ` ${pidText}--` : " ";

          const patSpan = document.createElement("span");
          patSpan.className = "image-participant-patient";
          patSpan.textContent = pat;
          pidSpan.appendChild(patSpan);
        } else if (pidRaw) {
          pidSpan.textContent = ` ${pidRaw}`;
        }

        title.appendChild(label);
        title.appendChild(pidSpan);
      } else {
        title.textContent = "P";
      }

      const colorIndex = getColorIndexForRow(rowIdx);
      participantBlock.dataset.cat = String(colorIndex);
      participantBlock.classList.add("cat" + String(colorIndex));
      title.dataset.cat = String(colorIndex);
      title.classList.add("cat" + String(colorIndex));

      participantBlock.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "image-grid";

      imgList.forEach(fname => {
        const cell = makeScanCell(baseDirs, pidFolder, fname, vis, avail, rowIdx);
        cell.querySelectorAll("img").forEach(imgEl => {
          imgEl.addEventListener("click", () => {
            showLightbox(imgEl.src, imgEl.alt || fname);
          });
        });
        grid.appendChild(cell);
      });

      participantBlock.appendChild(grid);
      panel.appendChild(participantBlock);
    });
  }

  document.addEventListener("radqy:data:ready", function () {
    renderImagesForSelected();
  });

  document.addEventListener("radqy:selection-changed", function () {
    renderImagesForSelected();
  });

  document.addEventListener("radqy:table:sorted", function () {
    renderImagesForSelected();
  });

  document.addEventListener("radqy:panel-toggled", function (e) {
    const p = e.detail && e.detail.panel;
    if (p === "image" && e.detail.visible) {
      renderImagesForSelected();
    }
  });

  document.addEventListener("radqy:masks-changed", function () {
    renderImagesForSelected();
  });

  document.addEventListener("radqy:colorby:changed", function () {
    // Defer to allow table to update rowCats first
    requestAnimationFrame(() => renderImagesForSelected());
  });

  // Keep image colors in sync when legend updates color-by mapping
  document.addEventListener("radqy:legend:update", function () {
    requestAnimationFrame(() => renderImagesForSelected());
  });

  // -------------- Lightbox --------------
  function ensureLightbox() {
    let lb = document.getElementById("img-lightbox");
    if (lb) return lb;
    lb = document.createElement("div");
    lb.id = "img-lightbox";
    lb.innerHTML = `
      <div class="img-lightbox-content">
        <div id="img-lightbox-body"></div>
        <div id="img-lightbox-caption"></div>
      </div>
    `;
    document.body.appendChild(lb);

    lb.addEventListener("click", hideLightbox);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideLightbox();
    });
    return lb;
  }

  function showLightbox(src, caption) {
    const lb = ensureLightbox();
    const body = document.getElementById("img-lightbox-body");
    const capEl = document.getElementById("img-lightbox-caption");
    if (body) {
      body.innerHTML = `<img src="${src}" alt="">`;
    }
    if (capEl) capEl.textContent = caption || "";
    lb.classList.add("is-open");
  }

  function showSliceLightbox(channels, caption) {
    const lb = ensureLightbox();
    const body = document.getElementById("img-lightbox-body");
    const capEl = document.getElementById("img-lightbox-caption");
    if (body) {
      body.innerHTML = "";
      channels.forEach(ch => {
        const wrap = document.createElement("div");
        wrap.className = "lb-channel";
        const img = document.createElement("img");
        img.src = ch.src;
        img.alt = ch.label;
        if (ch.aspect) img.style.aspectRatio = ch.aspect;
        img.onerror = () => {
          wrap.remove();
        };
        const lab = document.createElement("div");
        lab.textContent = ch.label;
        wrap.appendChild(img);
        wrap.appendChild(lab);
        body.appendChild(wrap);
      });
    }
    if (capEl) capEl.textContent = caption || "";
    lb.classList.add("is-open");
  }

  function hideLightbox() {
    const lb = document.getElementById("img-lightbox");
    if (!lb) return;
    lb.classList.remove("is-open");
  }
})();
