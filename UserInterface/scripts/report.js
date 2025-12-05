(function(){
  const STORAGE_KEY = "radqy_openai_key_enc";
  const STATE = {
    apiKey: null,
    encrypted: loadEncrypted(),
    connecting: false,
    connected: false,
    retryAfterTs: 0
  };

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

  function ensureReportShell(){
    const host = getReportHost();
    if (!host) return;
    if (host.dataset.ready) return;
    host.dataset.ready = "1";
    host.innerHTML = `
      <div class="report-layout">
        <div class="report-header">
          <h2 class="report-title">AI Generated QC Report</h2>
          <div class="report-divider"></div>
          <div id="report-status" class="report-status report-status-inline">
            <div class="report-spinner" aria-hidden="true"></div>
            <div class="report-status-text">Waiting to connect&hellip;</div>
          </div>
        </div>
        <div id="report-body" class="report-body">
          <div class="report-placeholder">Report content will appear here.</div>
        </div>
      </div>
    `;
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
          setStatus("Unlocking key…","wait");
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
          setStatus("Encrypting key…","wait");
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
    setStatus("Connecting to OpenAI…","wait");
    STATE.connecting = true;
    try{
      const ok = await testOpenAI(apiKey);
      if (!ok) throw new Error("Connection failed");
      STATE.connected = true;
      setStatus("Connected to OpenAI","ready");
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
      appendChat("status", "Thinking…");
      try{
        const answer = await askOpenAI(q);
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

  async function askOpenAI(prompt){
    const body = {
      model: "gpt-3.5-turbo",
      messages: [{ role:"user", content: prompt }]
    };
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

  document.addEventListener("DOMContentLoaded", ()=>{
    ensureReportShell();
  });

  document.addEventListener("radqy:panel-visibility-changed", (e)=>{
    const vis = e?.detail?.visibility || {};
    if (vis.report) {
      ensureReportShell();
      maybeAutoConnect();
    }
  });
})();
