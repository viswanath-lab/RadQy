// utils.js — no exports, works with normal <script> tags

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function show(el){ if (el) el.hidden = false; }
function hide(el){ if (el) el.hidden = true; }

function html(el, s){ if (el) el.innerHTML = s; }
function txt(el, s){ if (el) el.textContent = s; }

function toggleClass(el, cls, on){
  if (!el) return;
  if (on === undefined) el.classList.toggle(cls);
  else el.classList.toggle(cls, !!on);
}
