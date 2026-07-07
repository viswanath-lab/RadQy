(function(){
  const STORAGE_KEY = "radqy_openai_key_enc";
  const STATE = {
    apiKey: null,
    encrypted: loadEncrypted(),
    connecting: false,
    connected: false,
    retryAfterTs: 0,
    generating: false,
    lastReport: "",
    reportVisible: false,
    reportType: "mri"
  };

  const QC_SYSTEM_PROMPT_MRI = `You are an expert medical imaging quality control analyst and scientific report writer with deep knowledge of MRI QC, image quality metrics (IQMs), and unsupervised data analysis. Your task is to generate a comprehensive, professional AI-based QC report using outputs from RadQy. The report should be suitable for researchers, clinicians, and data managers evaluating MRI datasets for reliability, harmonization, and downstream AI training. Follow the required sections and tone: Dataset Overview; IQM Distribution Analysis; Outlier Detection and Severity Ranking; Clustering and Data Structure Analysis; Inter-Cluster Comparison; Cohort and Dataset Comparisons; Visualization-Aware Interpretation; Actionable Recommendations. Keep it concise, evidence-based, and ready to paste into documentation.`;

  const QC_SYSTEM_PROMPT_CT = `You are an expert medical imaging quality control analyst and scientific report writer with deep knowledge of CT QC, image quality metrics (IQMs), and unsupervised data analysis. Your task is to generate a comprehensive, professional AI-based QC report using outputs from RadQy. The report should be suitable for researchers, clinicians, and data managers evaluating CT datasets for reliability, harmonization, and downstream AI training. Follow the required sections and tone: Dataset Overview; IQM Distribution Analysis; Outlier Detection and Severity Ranking; Clustering and Data Structure Analysis; Inter-Cluster Comparison; Cohort and Dataset Comparisons; Visualization-Aware Interpretation; Actionable Recommendations. Keep it concise, evidence-based, and ready to paste into documentation.`;

  const QC_USER_INSTRUCTIONS_MRI = `Generate the final QC report. Use ONLY the dataset context provided below; do not invent data you don't see. If certain analyses (e.g., clustering, inter-cluster, cohort/dataset comparisons, visualization) are absent, explicitly note the gap AND add a polite, actionable suggestion tagged with "Suggestion:" that tells the user which RadQy module to run (e.g., clustering, Cohort Finder, visualization) to populate that section. Keep the section concise and never fabricate numbers. Write in polished, scientific prose with clear headings and bullet points where appropriate. Avoid speculative claims.`;

  const QC_USER_INSTRUCTIONS_CT = `Generate the final QC report. Use ONLY the dataset context provided below; do not invent data you don't see. If certain analyses (e.g., clustering, inter-cluster, cohort/dataset comparisons, visualization) are absent, explicitly note the gap AND add a polite, actionable suggestion tagged with "Suggestion:" that tells the user which RadQy module to run (e.g., clustering, Cohort Finder, visualization) to populate that section. Keep the section concise and never fabricate numbers. Write in polished, scientific prose with clear headings and bullet points where appropriate. Avoid speculative claims.`;

  const QC_CHAT_SYSTEM_PROMPT_MRI = `You are the RadQy QC assistant. Always answer using the current QC dataset context and QC report provided. Use supplied metric counts, summary stats, max/min (extremes), and unique-value frequency summaries to answer questions (including “highest”, “lowest”, “how many classes/categories”, or “most common”). If a requested metric/field is missing from the dataset, say it is not available. Do not invent numbers. Keep answers concise and practical.`;

  const QC_CHAT_SYSTEM_PROMPT_CT = `You are the RadQy QC assistant. Always answer using the current QC dataset context and QC report provided. Use supplied metric counts, summary stats, max/min (extremes), and unique-value frequency summaries to answer questions (including "highest", "lowest", "how many classes/categories", or "most common"). If a requested metric/field is missing from the dataset, say it is not available. Do not invent numbers. Keep answers concise and practical.`;

  function getDatasetScanType(){
    const s = String(window.DATA?.META?.scantype || "").trim().toLowerCase();
    return s === "ct" ? "ct" : "mri";
  }

  function getPromptSet(){
    const type = String(STATE.reportType || getDatasetScanType()).toLowerCase();
    if (type === "ct") {
      return {
        system: QC_SYSTEM_PROMPT_CT,
        userInstructions: QC_USER_INSTRUCTIONS_CT,
        chatSystem: QC_CHAT_SYSTEM_PROMPT_CT
      };
    }
    return {
      system: QC_SYSTEM_PROMPT_MRI,
      userInstructions: QC_USER_INSTRUCTIONS_MRI,
      chatSystem: QC_CHAT_SYSTEM_PROMPT_MRI
    };
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64encode(buf){
    return btoa(String.fromCharCode.apply(null, Array.from(buf)));
  }
  function b64decode(str){
    return new Uint8Array(atob(str).split("").map(c=>c.charCodeAt(0)));
  }

  function loadEncrypted(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }

  async function deriveKey(passphrase, salt){
    const base = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name:"PBKDF2", salt, iterations:120000, hash:"SHA-256" },
      base,
      { name:"AES-GCM", length:256 },
      false,
      ["encrypt","decrypt"]
    );
  }

  async function encryptApiKey(apiKey, passphrase){
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await deriveKey(passphrase, salt);
    const cipher = await crypto.subtle.encrypt(
      { name:"AES-GCM", iv },
      key,
      enc.encode(apiKey.trim())
    );
    return {
      salt: b64encode(salt),
      iv:   b64encode(iv),
      data: b64encode(new Uint8Array(cipher))
    };
  }

  async function decryptApiKey(blob, passphrase){
    if (!blob || !passphrase) throw new Error("Missing encrypted key");
    const salt = b64decode(blob.salt);
    const iv   = b64decode(blob.iv);
    const data = b64decode(blob.data);
    const key  = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, data);
    return dec.decode(plain);
  }

  function saveEncrypted(blob){
    if (!blob) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  }

  function getReportHost(){
    return document.getElementById("reporthost");
  }
  function getChatHost(){
    return document.getElementById("reportchat");
  }

  function ensureReportStyles(){
    if (document.getElementById("report-style-qc")) return;
    const style = document.createElement("style");
    style.id = "report-style-qc";
    style.textContent = `
      .report-content strong { font-weight: 700; }
      .report-content .qc-suggestion { color: #b25c00; font-weight: 600; }
      .report-content .qc-suggestion strong { color: #b25c00; }
      .report-participant-link {
        border: 0;
        background: transparent;
        color: #1f5aa6;
        text-decoration: underline;
        cursor: pointer;
        font: inherit;
        padding: 0;
      }
      .participant-detail-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .participant-detail-overlay.is-open {
        display: flex;
      }
      .participant-detail-modal {
        width: min(920px, calc(100vw - 40px));
        max-height: calc(100vh - 60px);
        overflow: auto;
        background: #fff;
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      }
      .participant-detail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .participant-detail-title {
        margin: 0;
        font-size: 18px;
      }
      .participant-detail-close {
        border: 0;
        background: #f2f2f2;
        cursor: pointer;
        border-radius: 6px;
        padding: 6px 10px;
      }
      .participant-detail-section {
        margin-top: 12px;
      }
      .participant-detail-section h3 {
        margin: 0 0 6px;
        font-size: 14px;
      }
      .participant-detail-kv {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 8px;
      }
      .participant-detail-kv .item {
        border: 1px solid #e6e6e6;
        border-radius: 6px;
        padding: 8px;
        font-size: 12px;
      }
      .participant-detail-kv .k {
        color: #666;
        display: block;
      }
      .participant-detail-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .participant-detail-table th,
      .participant-detail-table td {
        border: 1px solid #e8e8e8;
        padding: 6px;
        text-align: left;
      }
      .participant-detail-list {
        margin: 0;
        padding-left: 18px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeParticipantId(text){
    const raw = String(text || "").trim();
    if (!raw) return null;
    let m = raw.match(/^P(\d+)$/i);
    if (m) return "P" + String(Number(m[1]));
    m = raw.match(/^(?:participant|case|subject)\s+P?(\d+)$/i);
    if (m) return "P" + String(Number(m[1]));
    return null;
  }

  function formatMaybe(v){
    if (v === null || v === undefined) return "Not available";
    const s = String(v).trim();
    return s ? s : "Not available";
  }

  function escapeHTML(s){
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toNum(v){
    if (v === null || v === undefined) return null;
    const n = Number(String(v).replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function median(vals){
    if (!vals.length) return null;
    const a = vals.slice().sort((x,y)=>x-y);
    const mid = Math.floor(a.length / 2);
    if (a.length % 2) return a[mid];
    return (a[mid - 1] + a[mid]) / 2;
  }

  function findParticipantRow(participantId){
    const headers = Array.isArray(window.DATA?.HEADERS) ? window.DATA.HEADERS : [];
    const rows = Array.isArray(window.DATA?.ROWS) ? window.DATA.ROWS : [];
    if (!headers.length || !rows.length) return { index: -1, row: null, headers };

    const pHeader = headers.find(h => String(h).toLowerCase() === "p#");
    if (pHeader) {
      for (let i = 0; i < rows.length; i++) {
        const pid = normalizeParticipantId(rows[i][pHeader]);
        if (pid === participantId) return { index: i, row: rows[i], headers };
      }
    }
    return { index: -1, row: null, headers };
  }

  function buildCohortStats(headers, rows, metricHeaders){
    const stats = {};
    metricHeaders.forEach(h => {
      const vals = rows.map(r => toNum(r[h])).filter(v => v !== null);
      if (!vals.length) {
        stats[h] = { mean: null, median: null, sd: null };
        return;
      }
      const mean = vals.reduce((a,b)=>a+b,0) / vals.length;
      const med = median(vals);
      let sd = null;
      if (vals.length > 1) {
        const variance = vals.reduce((s,v)=>s + Math.pow(v - mean, 2), 0) / vals.length;
        sd = Math.sqrt(variance);
      }
      stats[h] = { mean, median: med, sd };
    });
    return stats;
  }

  function getMetricHeaders(headers, rows){
    const iqms = Array.isArray(window.DATA?.META?.iqms) ? window.DATA.META.iqms : [];
    const hasNumeric = (h) => rows.some(r => toNum(r[h]) !== null);
    if (iqms.length) {
      const set = new Set(iqms.map(x => String(x).toLowerCase()));
      return headers.filter(h => set.has(String(h).toLowerCase()) && hasNumeric(h));
    }
    const metaExclude = new Set([
      "p#", "participant (topfolder--subfolder--patient id)", "images",
      "mfr", "b0", "tr", "te", "nsl", "row", "col", "vrx", "vry", "vrz"
    ]);
    return headers.filter(h => !metaExclude.has(String(h).toLowerCase()) && hasNumeric(h));
  }

  function metricRowsForParticipant(row, headers, rows){
    const metricHeaders = getMetricHeaders(headers, rows);
    const stats = buildCohortStats(headers, rows, metricHeaders);
    const out = metricHeaders.map(h => {
      const value = toNum(row[h]);
      const mean = stats[h].mean;
      const med = stats[h].median;
      const sd = stats[h].sd;
      let z = null;
      if (value !== null && mean !== null && sd !== null && sd > 0) {
        z = (value - mean) / sd;
      }
      const diffMedian = (value !== null && med !== null) ? (value - med) : null;
      const diffMean = (value !== null && mean !== null) ? (value - mean) : null;
      const score = z !== null ? Math.abs(z)
        : (diffMedian !== null ? Math.abs(diffMedian)
        : (diffMean !== null ? Math.abs(diffMean) : -1));
      return {
        metric: h,
        value,
        z,
        median: med,
        mean,
        diffMedian,
        diffMean,
        score
      };
    });
    out.sort((a,b) => b.score - a.score);
    return out;
  }

  function renderMetricTable(rowsData){
    if (!rowsData.length) return '<p>Not available</p>';
    const rowsHtml = rowsData.map(r => `
      <tr>
        <td>${escapeHTML(r.metric)}</td>
        <td>${formatMaybe(r.value !== null ? round(r.value, 3) : null)}</td>
        <td>${formatMaybe(r.z !== null ? round(r.z, 3) : null)}</td>
        <td>${formatMaybe(r.median !== null ? round(r.median, 3) : null)}</td>
        <td>${formatMaybe(r.mean !== null ? round(r.mean, 3) : null)}</td>
        <td>${formatMaybe(r.diffMedian !== null ? round(r.diffMedian, 3) : null)}</td>
      </tr>
    `).join("");
    return `
      <table class="participant-detail-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>z-score</th>
            <th>Cohort Median</th>
            <th>Cohort Mean</th>
            <th>Diff from Median</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    `;
  }

  function ensureParticipantDetailOverlay(){
    let overlay = document.getElementById("participant-detail-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "participant-detail-overlay";
    overlay.className = "participant-detail-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("is-open");
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function openParticipantDetail(participantId){
    const normalized = normalizeParticipantId(participantId);
    const overlay = ensureParticipantDetailOverlay();
    if (!normalized) {
      overlay.innerHTML = `
        <div class="participant-detail-modal">
          <div class="participant-detail-head">
            <h2 class="participant-detail-title">Participant not found</h2>
            <button type="button" class="participant-detail-close">Close</button>
          </div>
          <p>Participant not found.</p>
        </div>`;
      overlay.querySelector(".participant-detail-close").addEventListener("click", () => overlay.classList.remove("is-open"));
      overlay.classList.add("is-open");
      return;
    }

    const rows = Array.isArray(window.DATA?.ROWS) ? window.DATA.ROWS : [];
    const imagesByRow = Array.isArray(window.DATA?.IMAGES) ? window.DATA.IMAGES : [];
    const found = findParticipantRow(normalized);
    if (!found.row) {
      overlay.innerHTML = `
        <div class="participant-detail-modal">
          <div class="participant-detail-head">
            <h2 class="participant-detail-title">${escapeHTML(normalized)}</h2>
            <button type="button" class="participant-detail-close">Close</button>
          </div>
          <p>Participant not found.</p>
        </div>`;
      overlay.querySelector(".participant-detail-close").addEventListener("click", () => overlay.classList.remove("is-open"));
      overlay.classList.add("is-open");
      return;
    }

    const row = found.row;
    const headers = found.headers;
    const metrics = metricRowsForParticipant(row, headers, rows);
    const topMetrics = metrics.slice(0, 8);
    const compareRows = metrics.slice(0, 10);
    const metadataKeys = ["MFR", "B0", "TR", "TE", "NSL", "ROW", "COL", "VRX", "VRY", "VRZ"];

    const metadataMap = {};
    metadataKeys.forEach(k => {
      const h = headers.find(x => String(x).toLowerCase() === k.toLowerCase());
      metadataMap[k] = h ? formatMaybe(row[h]) : "Not available";
    });

    overlay.innerHTML = `
      <div class="participant-detail-modal">
        <div class="participant-detail-head">
          <h2 class="participant-detail-title">Participant Detail: ${escapeHTML(normalized)}</h2>
          <button type="button" class="participant-detail-close">Close</button>
        </div>

        <section class="participant-detail-section">
          <h3>Participant Overview</h3>
          <div class="participant-detail-kv">
            <div class="item"><span class="k">Participant ID</span>${escapeHTML(normalized)}</div>
            <div class="item"><span class="k">Dataset row</span>${formatMaybe(found.index + 1)}</div>
          </div>
        </section>

        <section class="participant-detail-section">
          <h3>Acquisition Metadata</h3>
          <div class="participant-detail-kv">
            ${metadataKeys.map(k => `<div class="item"><span class="k">${k}</span>${escapeHTML(String(metadataMap[k]))}</div>`).join("")}
          </div>
        </section>

        <section class="participant-detail-section">
          <h3>Highest / Most Abnormal Metrics</h3>
          ${renderMetricTable(topMetrics)}
        </section>

        <section class="participant-detail-section">
          <h3>Compare to Cohort Median</h3>
          ${renderMetricTable(compareRows)}
        </section>
      </div>`;

    overlay.querySelector(".participant-detail-close").addEventListener("click", () => overlay.classList.remove("is-open"));
    overlay.classList.add("is-open");
  }

  function linkifyParticipantRefs(root){
    if (!root) return;
    const regex = /\bP\d+\b|\b(?:Participant|Case|Subject)\s+P?\d+\b/gi;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest("button,a,[data-participant-link='1']")) continue;
      if (!regex.test(node.nodeValue)) continue;
      regex.lastIndex = 0;
      textNodes.push(node);
    }

    textNodes.forEach(textNode => {
      const txt = textNode.nodeValue;
      regex.lastIndex = 0;
      let last = 0;
      let changed = false;
      const frag = document.createDocumentFragment();
      let m;
      while ((m = regex.exec(txt)) !== null) {
        const full = m[0];
        const normalized = normalizeParticipantId(full);
        if (!normalized) continue;
        changed = true;
        if (m.index > last) {
          frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "report-participant-link";
        btn.dataset.participantLink = "1";
        btn.dataset.participantId = normalized;
        btn.textContent = full;
        frag.appendChild(btn);
        last = m.index + full.length;
      }
      if (!changed) return;
      if (last < txt.length) {
        frag.appendChild(document.createTextNode(txt.slice(last)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function ensureReportShell(){
    const host = getReportHost();
    if (!host) return;
    if (host.dataset.ready) return;
    host.dataset.ready = "1";
    ensureReportStyles();
    host.innerHTML = `
      <div class="report-layout">
        <div class="report-header">
          <h2 class="report-title">AI Generated QC Report</h2>
          <div class="report-divider"></div>
          <div class="report-actions">
            <button id="btn-report-copy" class="btn btnsm" disabled>Copy</button>
            <div id="report-status" class="report-status report-status-inline">
              <div class="report-spinner" aria-hidden="true"></div>
              <div class="report-status-text">Waiting to connect&hellip;</div>
            </div>
          </div>
        </div>
        <div id="report-body" class="report-body">
          <div class="report-placeholder">Report content will appear here.</div>
        </div>
      </div>
    `;
    bindReportActions();
    const chat = getChatHost();
    if (chat) {
      chat.innerHTML = `
        <div class="report-chat">
          <div class="report-chat-header">
            <span class="report-chat-title">QC Assistant</span>
            <div class="report-divider"></div>
          </div>
          <div id="report-chat-log" class="report-chat-log"></div>
          <form id="report-chat-form" class="report-chat-form">
            <input id="report-chat-input" class="report-chat-input" type="text" placeholder="Ask a question about your data..." autocomplete="off" required />
            <button class="btn btnsm" type="submit">Send</button>
          </form>
        </div>
      `;
      bindChatForm();
    }
  }


  function setStatus(text, mode){
    const status = document.getElementById("report-status");
    if (!status) return;
    const spinner = status.querySelector(".report-spinner");
    const label = status.querySelector(".report-status-text");
    status.classList.toggle("is-error", mode === "error");
    status.classList.toggle("is-ready", mode === "ready");
    status.classList.toggle("is-waiting", mode !== "ready");
    if (spinner) spinner.style.display = mode === "ready" ? "none" : "inline-block";
    if (label && text) label.textContent = text;
  }

  function isReportVisible(){
    return !!(window.RADQY && RADQY._vis && RADQY._vis.report);
  }

  function showModal(content){
    let overlay = document.getElementById("report-modal-overlay");
    if (!overlay){
      overlay = document.createElement("div");
      overlay.id = "report-modal-overlay";
      overlay.className = "report-modal-overlay";
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = "";
    overlay.appendChild(content);
    overlay.style.display = "flex";
    return overlay;
  }
  function closeModal(){
    const overlay = document.getElementById("report-modal-overlay");
    if (overlay) overlay.style.display = "none";
  }

  function buildKeyModal(){
    const hasEncrypted = !!STATE.encrypted;
    STATE.reportType = getDatasetScanType();
    const box = document.createElement("div");
    box.className = "report-modal";
    const title = document.createElement("div");
    title.className = "report-modal-title";
    title.textContent = hasEncrypted ? "Unlock OpenAI" : "Enter OpenAI API Key";
    const desc = document.createElement("p");
    desc.className = "report-modal-desc";
    desc.textContent = hasEncrypted
      ? "Enter your passphrase to unlock your encrypted API key."
      : "Add a passphrase if you want to save the key encrypted on this device.";

    const form = document.createElement("form");
    form.className = "report-modal-form";
    const errText = document.createElement("div");
    errText.className = "report-modal-error";
    errText.style.display = "none";
    errText.textContent = "Passphrase is incorrect.";

    let keyInput = null;

    const typeLbl = document.createElement("label");
    typeLbl.textContent = "Report type";
    typeLbl.setAttribute("for", "report-type");

    const typeSelect = document.createElement("select");
    typeSelect.id = "report-type";
    typeSelect.className = "report-chat-input";
    typeSelect.innerHTML = `
      <option value="mri">MRI report</option>
      <option value="ct">CT report</option>
    `;
    typeSelect.value = STATE.reportType || "mri";
    typeSelect.addEventListener("change", () => {
      STATE.reportType = typeSelect.value === "ct" ? "ct" : "mri";
    });

    form.appendChild(typeLbl);
    form.appendChild(typeSelect);

    if (!hasEncrypted) {
      const keyLbl = document.createElement("label");
      keyLbl.textContent = "OpenAI API key";
      keyLbl.setAttribute("for", "report-api-key");
      keyInput = document.createElement("input");
      keyInput.id = "report-api-key";
      keyInput.type = "password";
      keyInput.required = true;
      keyInput.placeholder = "sk-...";
      form.appendChild(keyLbl);
      form.appendChild(keyInput);
    }

    const passLbl = document.createElement("label");
    passLbl.textContent = hasEncrypted ? "Passphrase" : "Passphrase (optional, to encrypt locally)";
    passLbl.setAttribute("for", "report-passphrase");
    const passInput = document.createElement("input");
    passInput.id = "report-passphrase";
    passInput.type = "password";
    passInput.required = hasEncrypted;
    passInput.placeholder = hasEncrypted ? "Enter your passphrase" : "Only you know this";

    const saveWrap = document.createElement("label");
    saveWrap.className = "report-modal-save";
    const saveCb = document.createElement("input");
    saveCb.type = "checkbox";
    saveCb.id = "report-save-encrypted";
    saveCb.checked = false;
    if (hasEncrypted) {
      saveWrap.style.display = "none";
    }
    const saveText = document.createElement("span");
    saveText.textContent = "Save encrypted on this device";
    saveWrap.appendChild(saveCb);
    saveWrap.appendChild(saveText);

    const actions = document.createElement("div");
    actions.className = "report-modal-actions";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn btnsm";
    cancelBtn.textContent = "Cancel";
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "btn btnsm";
    resetBtn.textContent = hasEncrypted ? "Use new API key" : "Clear";
    const okBtn = document.createElement("button");
    okBtn.type = "submit";
    okBtn.className = "btn btnsm btnon";
    okBtn.textContent = hasEncrypted ? "Unlock" : "Connect";

    actions.appendChild(cancelBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(okBtn);

    form.appendChild(passLbl);
    form.appendChild(passInput);
    form.appendChild(errText);
    form.appendChild(saveWrap);
    form.appendChild(actions);

    box.appendChild(title);
    box.appendChild(desc);
    box.appendChild(form);

    cancelBtn.addEventListener("click", closeModal);
    resetBtn.addEventListener("click", ()=>{
      // Clear encrypted blob and switch to API key entry
      saveEncrypted(null);
      STATE.encrypted = null;
      STATE.apiKey = null;
      closeModal();
      promptForKey(true); // force fresh key mode
    });

    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const apiKey = keyInput ? keyInput.value.trim() : null;
      const pass = passInput.value.trim();
      try{
        errText.style.display = "none";
        if (hasEncrypted) {
          setStatus("Unlocking key...","wait");
          try{
            STATE.apiKey = await decryptApiKey(STATE.encrypted, pass);
          }catch(eUnlock){
            console.error(eUnlock);
            errText.style.display = "block";
            setStatus("Passphrase incorrect. Try again or use a new API key.","error");
            return;
          }
          closeModal();
          connectWithKey(STATE.apiKey);
          return;
        }
        if (!apiKey) {
          alert("API key is required.");
          return;
        }
        STATE.apiKey = apiKey;
        if (pass && saveCb.checked) {
          setStatus("Encrypting key...","wait");
          const blob = await encryptApiKey(apiKey, pass);
          saveEncrypted(blob);
          STATE.encrypted = blob;
        } else {
          saveEncrypted(null);
        }
        closeModal();
        connectWithKey(apiKey);
      }catch(err){
        console.error(err);
        setStatus("Could not unlock key. Check your passphrase.","error");
      }
    });

    return box;
  }

  function promptForKey(forceFresh){
    if (forceFresh) {
      STATE.encrypted = null;
      saveEncrypted(null);
    }
    const modal = buildKeyModal();
    showModal(modal);
    const firstInput = modal.querySelector("input");
    if (firstInput) firstInput.focus();
  }

  async function connectWithKey(apiKey){
    if (!apiKey) {
      promptForKey();
      return;
    }
    setStatus("Connecting to OpenAI...","wait");
    STATE.connecting = true;
    try{
      const ok = await testOpenAI(apiKey);
      if (!ok) throw new Error("Connection failed");
      STATE.connected = true;
      setStatus("Connected to OpenAI","ready");
      if (isReportVisible() && !STATE.generating) {
        generateReport();
      }
    }catch(err){
      console.error("OpenAI connect error", err);
      STATE.connected = false;
      setStatus("OpenAI connection failed. Re-enter key.", "error");
      promptForKey();
    }finally{
      STATE.connecting = false;
    }
  }

  async function testOpenAI(apiKey){
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      }
    });
    return res.ok;
  }

  function appendChat(role, text){
    const log = document.getElementById("report-chat-log");
    if (!log) return;
    const row = document.createElement("div");
    row.className = "report-chat-row report-chat-" + role;
    row.textContent = text;
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function mdToHtml(md){
    if (!md) return "";
    // basic escape
    md = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // headings
    md = md.replace(/^###\s*(.+)$/gm, "<h3>$1</h3>");
    md = md.replace(/^##\s*(.+)$/gm, "<h2>$1</h2>");
    md = md.replace(/^#\s*(.+)$/gm, "<h1>$1</h1>");
    // bold
    md = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const lines = md.split(/\n/);
    const out = [];
    let inList = false;
    lines.forEach(line => {
      const m = line.match(/^\s*[-*]\s+(.*)/);
      if (m) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push("<li>" + m[1] + "</li>");
      } else {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        const trimmed = line.trim();
        const suggestionMatch = trimmed.match(/^Suggestion:\s*(.*)/i);
        if (suggestionMatch) {
          out.push(`<p class="qc-suggestion"><strong>Suggestion:</strong> ${suggestionMatch[1]}</p>`);
        } else if (trimmed === "") {
          out.push("");
        } else {
          out.push("<p>" + line + "</p>");
        }
      }
    });
    if (inList) out.push("</ul>");
    return out.join("\n");
  }

  function setReportContent(markdown){
    const body = document.getElementById("report-body");
    if (!body) return;
    if (!markdown) {
      setPlaceholder("Generating QC report...");
      return;
    }
    body.classList.remove("is-placeholder");
    const html = mdToHtml(markdown);
    body.innerHTML = `<div class="report-content">${html}</div>`;
    linkifyParticipantRefs(body);
    STATE.lastReport = markdown;
    const copyBtn = document.getElementById("btn-report-copy");
    if (copyBtn) copyBtn.disabled = false;
  }

  function setPlaceholder(text){
    const body = document.getElementById("report-body");
    if (!body) return;
    body.classList.add("is-placeholder");
    body.innerHTML = `<div class="report-placeholder">${text}</div>`;
    STATE.lastReport = "";
    const copyBtn = document.getElementById("btn-report-copy");
    if (copyBtn) copyBtn.disabled = true;
  }

  function round(val, digits){
    const d = typeof digits === "number" ? digits : 2;
    if (!Number.isFinite(val)) return val;
    const m = Math.pow(10, d);
    return Math.round(val * m) / m;
  }

  function summarizeDataset(){
    const meta = window.DATA?.META || {};
    const rows = Array.isArray(window.DATA?.ROWS) ? window.DATA.ROWS : [];
    const headers = Array.isArray(window.DATA?.HEADERS) ? window.DATA.HEADERS : [];
    const N = meta.N || rows.length || 0;
    const tags = meta.tags || [];
    const iqms = (meta.iqms && meta.iqms.length) ? meta.iqms : headers.filter(h => h && h !== "P#");

    // consider all headers (not just iqms) to answer metric-specific questions
    const candidateHeaders = headers.filter(h => h && !/^p#$/i.test(h));
    const numericHeaders = candidateHeaders.filter(h => {
      for (let i = 0; i < rows.length; i++) {
        const v = parseFloat(rows[i][h]);
        if (Number.isFinite(v)) return true;
        if (rows[i][h] && rows[i][h] !== "") return false;
      }
      return false;
    }); // include all numeric headers to answer metric-specific questions
    const categoricalHeaders = candidateHeaders.filter(h => !numericHeaders.includes(h));

    const stats = [];
    numericHeaders.forEach(h => {
      const vals = rows.map(r => parseFloat(r[h])).filter(Number.isFinite);
      if (vals.length < 4) return;
      const sorted = vals.slice().sort((a,b)=>a-b);
      const n = sorted.length;
      const mean = vals.reduce((a,b)=>a+b,0)/n;
      const median = sorted[Math.floor(n*0.5)];
      const q1 = sorted[Math.floor(n*0.25)];
      const q3 = sorted[Math.floor(n*0.75)];
      const min = sorted[0];
      const max = sorted[n-1];
      stats.push({
        metric: h,
        n,
        mean: round(mean,3),
        median: round(median,3),
        q1: round(q1,3),
        q3: round(q3,3),
        min: round(min,3),
        max: round(max,3)
      });
    });

    const pidHeader = headers.find(h => /^p#$/i.test(h) || /participant/i.test(h));
    const outliers = [];
    numericHeaders.forEach(h => {
      const entries = rows.map((r, idx) => ({
        id: pidHeader ? r[pidHeader] : `row-${idx+1}`,
        v: parseFloat(r[h])
      })).filter(o => Number.isFinite(o.v));
      if (entries.length < 8) return;
      const mean = entries.reduce((s,o)=>s+o.v,0)/entries.length;
      const variance = entries.reduce((s,o)=>s+Math.pow(o.v - mean,2),0)/entries.length;
      const sd = Math.sqrt(variance);
      if (!sd || !Number.isFinite(sd)) return;
      entries.forEach(o => o.z = (o.v - mean) / sd);
      entries.sort((a,b)=>Math.abs(b.z) - Math.abs(a.z));
      const top = entries.filter(o => Math.abs(o.z) >= 3).slice(0,3);
      if (top.length) {
        outliers.push({
          metric: h,
          cases: top.map(o => ({
            id: String(o.id || ""),
            value: round(o.v,3),
            z: round(o.z,2)
          }))
        });
      }
    });

    const extremes = [];
    numericHeaders.forEach(h => {
      const entries = rows.map((r, idx) => ({
        id: pidHeader ? r[pidHeader] : `row-${idx+1}`,
        v: parseFloat(r[h])
      })).filter(o => Number.isFinite(o.v));
      if (!entries.length) return;
      entries.sort((a,b)=> a.v - b.v);
      extremes.push({
        metric: h,
        min: { id: entries[0].id || "", value: round(entries[0].v, 3) },
        max: { id: entries[entries.length-1].id || "", value: round(entries[entries.length-1].v, 3) }
      });
    });

    const counts = headers.filter(Boolean).map(h => {
      const count = rows.reduce((acc, r) => {
        const v = r[h];
        return (v !== undefined && v !== null && String(v).trim() !== "") ? acc + 1 : acc;
      }, 0);
      return { header: h, count };
    }).sort((a, b) => b.count - a.count);

    const categories = [];
    candidateHeaders.forEach(h => {
      const freq = new Map();
      rows.forEach(r => {
        const v = r[h];
        if (v === undefined || v === null) return;
        const s = String(v).trim();
        if (!s) return;
        freq.set(s, (freq.get(s) || 0) + 1);
      });
      if (!freq.size) return;
      const top = Array.from(freq.entries())
        .sort((a,b)=>b[1]-a[1])
        .slice(0,8)
        .map(([val,count]) => ({ value: val, count }));
      categories.push({
        header: h,
        unique: freq.size,
        top
      });
    });

    return {
      dataset: meta.dataset || "Unspecified dataset",
      scantype: meta.scantype || "Unknown",
      N,
      tags,
      iqms,
      headers,
      stats,
      extremes,
      counts,
      categories,
      outliers,
      timestamp: new Date().toISOString()
    };
  }

  function contextAsText(ctx){
    const lines = [];
    lines.push(`Dataset: ${ctx.dataset}`);
    lines.push(`Scan type: ${ctx.scantype}`);
    lines.push(`Total cases: ${ctx.N}`);
    lines.push(`IQMs (${ctx.iqms.length}): ${ctx.iqms.slice(0,15).join(", ") || "none listed"}`);
    lines.push(`Headers (${ctx.headers.length}): ${ctx.headers.slice(0,40).join(", ")}${ctx.headers.length>40 ? ", ..." : ""}`);
    if (ctx.tags.length) lines.push(`Tags (${ctx.tags.length}): ${ctx.tags.slice(0,12).join(", ")}`);
    if (ctx.stats.length) {
      lines.push("Summary stats (top 30 metrics):");
      ctx.stats.slice(0,30).forEach(s => {
        lines.push(`- ${s.metric}: n=${s.n}, mean=${s.mean}, median=${s.median}, q1=${s.q1}, q3=${s.q3}, min=${s.min}, max=${s.max}`);
      });
    }
    if (ctx.counts && ctx.counts.length) {
      lines.push("Non-empty value counts (top 30):");
      ctx.counts.slice(0,30).forEach(c => {
        lines.push(`- ${c.header}: ${c.count}`);
      });
    }
    if (ctx.categories && ctx.categories.length) {
      lines.push("Unique values summary (top 30 fields):");
      ctx.categories.slice(0,30).forEach(cat => {
        const topVals = cat.top.map(t => `${t.value} (${t.count})`).join("; ");
        lines.push(`- ${cat.header}: unique=${cat.unique}; top=${topVals}`);
      });
    }
    if (ctx.extremes && ctx.extremes.length) {
      lines.push("Metric extremes (max/min):");
      ctx.extremes.forEach(ex => {
        const maxPart = ex.max ? `${ex.max.id || "n/a"} (max=${ex.max.value})` : "max=n/a";
        const minPart = ex.min ? `${ex.min.id || "n/a"} (min=${ex.min.value})` : "min=n/a";
        lines.push(`- ${ex.metric}: ${maxPart}; ${minPart}`);
      });
    }
    if (ctx.outliers.length) {
      lines.push("Outlier candidates (|z|>=3):");
      ctx.outliers.forEach(o => {
        const items = o.cases.map(c => `${c.id} (z=${c.z}, value=${c.value})`).join("; ");
        lines.push(`- ${o.metric}: ${items}`);
      });
    } else {
      lines.push("Outlier candidates: not detected in quick z-score scan.");
    }
    lines.push(`Timestamp: ${ctx.timestamp}`);
    return lines.join("\n");
  }

  function buildReportMessages(){
    const ctx = summarizeDataset();
    const ctxText = contextAsText(ctx);
    const prompts = getPromptSet();
    const userPrompt = `${prompts.userInstructions}\n\nRadQy dataset context:\n${ctxText}`;
    return [
      { role:"system", content: prompts.system },
      { role:"user",   content: userPrompt }
    ];
  }

  function buildChatMessages(userQuestion){
    const ctx = summarizeDataset();
    const ctxText = contextAsText(ctx);
    const prompts = getPromptSet();
    const latestReport = STATE.lastReport && STATE.lastReport.trim()
      ? STATE.lastReport.trim()
      : "(No QC report has been generated yet.)";
    const userPrompt = [
      "Current RadQy dataset context:",
      ctxText,
      "",
      "Current QC report (may be empty):",
      latestReport,
      "",
      "User question:",
      userQuestion,
      "",
      "Answer only if it relates to this dataset/QC. If a requested metric is missing (e.g., not in headers), say it is not available in the current dataset."
    ].join("\n");
    return [
      { role:"system", content: prompts.chatSystem },
      { role:"user", content: userPrompt }
    ];
  }

  async function generateReport(){
    if (!STATE.connected || !STATE.apiKey) {
      setStatus("Connect to OpenAI first.", "error");
      promptForKey();
      return;
    }
    if (STATE.generating) return;
    STATE.generating = true;
    setStatus("Generating QC report...","wait");
    setPlaceholder("Generating QC report...");
    try{
      const messages = buildReportMessages();
      const answer = await askOpenAI(null, {
        messages,
        model: "gpt-4o-mini",
        maxTokens: 1200,
        temperature: 0.25
      });
      setReportContent(answer || "(No response)");
      setStatus("Report ready","ready");
    }catch(err){
      console.error(err);
      setStatus(err?.message || "Could not generate report","error");
    }finally{
      STATE.generating = false;
    }
  }

  function bindReportActions(){
    const copyBtn = document.getElementById("btn-report-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", async ()=>{
        if (!STATE.lastReport) return;
        try{
          await navigator.clipboard.writeText(STATE.lastReport);
          copyBtn.textContent = "Copied";
          setTimeout(()=> copyBtn.textContent = "Copy", 1200);
        }catch(err){
          console.error(err);
          copyBtn.textContent = "Copy failed";
          setTimeout(()=> copyBtn.textContent = "Copy", 1400);
        }
      });
    }

    const body = document.getElementById("report-body");
    if (body && !body.dataset.participantBindDone) {
      body.dataset.participantBindDone = "1";
      body.addEventListener("click", (e) => {
        const btn = e.target && e.target.closest ? e.target.closest(".report-participant-link") : null;
        if (!btn) return;
        const pid = btn.dataset.participantId || "";
        openParticipantDetail(pid);
      });
    }
  }

  function bindChatForm(){
    const form = document.getElementById("report-chat-form");
    const input = document.getElementById("report-chat-input");
    if (!form || !input) return;
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      if (!STATE.connected || !STATE.apiKey) {
        setStatus("Connect to OpenAI first.", "error");
        return;
      }
      const q = input.value.trim();
      if (!q) return;
      appendChat("user", q);
      input.value = "";
      appendChat("status", "Thinking...");
      try{
        const answer = await askOpenAI(null, {
          messages: buildChatMessages(q),
          model: "gpt-4o-mini",
          maxTokens: 600,
          temperature: 0.2
        });
        const log = document.getElementById("report-chat-log");
        if (log && log.lastChild && log.lastChild.classList.contains("report-chat-status")) {
          log.removeChild(log.lastChild);
        }
        appendChat("assistant", answer || "(No response)");
      }catch(err){
        console.error(err);
        const log = document.getElementById("report-chat-log");
        if (log && log.lastChild && log.lastChild.classList.contains("report-chat-status")) {
          log.removeChild(log.lastChild);
        }
        if (err && err.status === 429) {
          const waitMs = Math.max(STATE.retryAfterTs - Date.now(), 0);
          const secs = Math.max(1, Math.round(waitMs/1000));
          appendChat("assistant", `Rate limited by OpenAI (429). Please wait ~${secs || 5}s and retry.`);
        } else if (err && typeof err.message === "string" && /quota|billing|payment/i.test(err.message)) {
          appendChat("assistant", "OpenAI reported a quota/billing issue. Please check your plan/billing and retry.");
        } else {
          appendChat("assistant", "Error: " + (err?.message || "Unable to answer right now."));
        }
      }
    });
  }

  function sleep(ms){
    return new Promise(res => setTimeout(res, ms));
  }

  async function askOpenAI(prompt, opts){
    const options = opts || {};
    const messages = options.messages || [{ role:"user", content: prompt }];
    if (!messages || !messages.length) throw new Error("No prompt provided");
    const body = {
      model: options.model || "gpt-3.5-turbo",
      messages
    };
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (typeof options.temperature === "number") body.temperature = options.temperature;
    if (typeof options.top_p === "number") body.top_p = options.top_p;
    const url = "https://api.openai.com/v1/chat/completions";
    let lastErr = null;
    for (let attempt=0; attempt<3; attempt++){
      const res = await fetch(url, {
        method:"POST",
        headers:{
          "Authorization": "Bearer " + STATE.apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const json = await res.json();
        return json?.choices?.[0]?.message?.content?.trim();
      }

      let errBody = null;
      try { errBody = await res.json(); } catch(e){}
      const msg = errBody?.error?.message || `Request failed: ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      lastErr = err;

      if (res.status === 429 || res.status >= 500) {
        const retryHeader = res.headers.get("retry-after");
        const waitMs = retryHeader ? Number(retryHeader) * 1000 : (500 * (attempt + 1));
        STATE.retryAfterTs = Date.now() + waitMs;
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
    throw lastErr || new Error("Request failed after retries");
  }

  function maybeAutoConnect(){
    if (STATE.connected || STATE.connecting) return;
    if (STATE.apiKey) {
      connectWithKey(STATE.apiKey);
    } else if (STATE.encrypted) {
      promptForKey();
    } else {
      promptForKey();
    }
  }

  function maybeAutoGenerate(){
    if (!isReportVisible()) return;
    if (STATE.generating) return;
    if (STATE.lastReport && STATE.lastReport.trim()) return; // do not regenerate automatically if we already have a report
    if (!STATE.connected || !STATE.apiKey) {
      maybeAutoConnect();
      return;
    }
    generateReport();
  }

  document.addEventListener("DOMContentLoaded", ()=>{
    ensureReportShell();
    STATE.reportType = getDatasetScanType();
    // Keep the report closed/idle on first load; wait for the user to click
    // the Report button and confirm before prompting for API unlock.
    STATE.reportVisible = isReportVisible();
  });

  document.addEventListener("radqy:panel-visibility-changed", (e)=>{
    const vis = e?.detail?.visibility || {};
    const nowVisible = !!vis.report;
    if (nowVisible && !STATE.reportVisible) { // just opened
      ensureReportShell();
      STATE.reportVisible = true;
      STATE.lastReport = ""; // force regeneration each time opened
      setPlaceholder("Generating QC report...");
      maybeAutoConnect();
      maybeAutoGenerate();
    } else if (!nowVisible && STATE.reportVisible) { // just closed
      STATE.reportVisible = false;
      STATE.lastReport = "";
      setPlaceholder("Report content will appear here.");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const overlay = document.getElementById("participant-detail-overlay");
    if (overlay) overlay.classList.remove("is-open");
  });
})();
