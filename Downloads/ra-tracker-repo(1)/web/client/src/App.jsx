import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation, useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "https://tracker2-ten.vercel.app";

// In-memory cache with stale-while-revalidate
// Fresh 5min: serve instantly. Stale up to 10min: serve instantly + revalidate background. After 10min: block on fetch.
const _cache = {};
const _cacheTime = {};
const CACHE_TTL = 300_000;  // 5 min fresh window
const STALE_TTL = 600_000;  // 10 min stale window

// Auth token — declared early so api object can reference it
let _token = null;
let _user  = null;
try { _token = localStorage.getItem("ra_token") || null; } catch {}
try { _user  = JSON.parse(localStorage.getItem("ra_user") || "null"); } catch {}

// ── Recent Activity tracker ──
const RA_KEY = "ra_recent_activity";
function trackActivity(item) {
  // item: { type, label, sub, page, id? }
  try {
    const existing = JSON.parse(localStorage.getItem(RA_KEY) || "[]");
    const filtered = existing.filter(e => !(e.type === item.type && e.id === item.id && e.page === item.page));
    const updated  = [{ ...item, ts: Date.now() }, ...filtered].slice(0, 10);
    localStorage.setItem(RA_KEY, JSON.stringify(updated));
  } catch {}
}
function getRecentActivity() {
  try { return JSON.parse(localStorage.getItem(RA_KEY) || "[]"); } catch { return []; }
}

const _doFetch = (p) =>
  fetch(`${API}${p}`, { headers: _token ? { Authorization: `Bearer ${_token}` } : {} })
    .then(r => r.json())
    .then(d => { _cache[p] = d; _cacheTime[p] = Date.now(); return d; });

const cachedGet = (path) => {
  const age = Date.now() - (_cacheTime[path] || 0);
  if (_cache[path] && age < CACHE_TTL) return Promise.resolve(_cache[path]);
  if (_cache[path] && age < STALE_TTL) { _doFetch(path).catch(() => {}); return Promise.resolve(_cache[path]); }
  return _doFetch(path);
};

const invalidate = (...paths) => paths.forEach(p => { delete _cache[p]; delete _cacheTime[p]; });

const apiReq = (path, opts) => fetch(`${API}${path}`, opts).then(async r => {
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = { error: text }; }
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
});
const api = {
  get:    (path)       => cachedGet(path),
  post:   (path, body) => {
    invalidate(path.split("/").slice(0,-1).join("/") || path);
    return apiReq(path, { method:"POST", headers:{"Content-Type":"application/json", ...(_token?{Authorization:`Bearer ${_token}`}:{})}, body:JSON.stringify(body) });
  },
  put:    (path, body) => {
    invalidate(path); invalidate(path.split("/").slice(0,-1).join("/") || path);
    return apiReq(path, { method:"PUT", headers:{"Content-Type":"application/json", ...(_token?{Authorization:`Bearer ${_token}`}:{})}, body:JSON.stringify(body) });
  },
  patch:  (path, body) => {
    invalidate(path); invalidate(path.split("/").slice(0,-1).join("/") || path);
    return apiReq(path, { method:"PATCH", headers:{"Content-Type":"application/json", ...(_token?{Authorization:`Bearer ${_token}`}:{})}, body:JSON.stringify(body) });
  },
  delete: (path) => {
    invalidate(path); invalidate(path.split("/").slice(0,-1).join("/") || path);
    return apiReq(path, { method:"DELETE", headers:{...(_token?{Authorization:`Bearer ${_token}`}:{})} });
  },
};

const css = `
  @font-face {
    font-family: 'DIN Next LT Pro';
    src: url('/fonts/DINNextLTPro-Medium.woff2') format('woff2'),
         url('/fonts/DINNextLTPro-Medium.ttf') format('truetype');
    font-weight: 500;
    font-style: normal;
    font-display: swap;
  }
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#080a10; --s1:#0d1018; --s2:#131720; --s3:#1a1f2e; --s4:#222736;
    --b1:#1e2436; --b2:#2a3148; --b3:#364060;
    --acc:#d4ff1e; --blue:#4fc3f7; --purple:#b39ddb;
    --red:#ff5252; --green:#69f0ae; --orange:#ffab40;
    --t1:#e8ecf4; --t2:#e8ecf4; --t3:#e8ecf4;
    --r:6px; --r2:10px; --r3:14px;
    --glow-acc: 0 0 20px rgba(212,255,30,0.15);
    --glow-blue: 0 0 20px rgba(79,195,247,0.15);
    --shadow-card: 0 4px 24px rgba(0,0,0,0.4);
    --transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
  }
  body { background:var(--bg); color:var(--t1); font-family:'DIN Next LT Pro',sans-serif; font-size:14px; line-height:1.5; overflow:hidden; min-width:320px; }

  /* ── Scrollbars ── */
  ::-webkit-scrollbar { width:5px; height:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--b2); border-radius:3px; transition:background 0.2s; }
  ::-webkit-scrollbar-thumb:hover { background:var(--b3); }

  /* ── Typography ── */
  .bc { font-family:'DIN Next LT Pro',sans-serif; }
  .mono { font-family:'JetBrains Mono',monospace; }
  button { font-family:'DIN Next LT Pro',sans-serif; cursor:pointer; border:none; outline:none; }
  input,select,textarea { font-family:'DIN Next LT Pro',sans-serif; outline:none; }
  select option { background:var(--s2); }
  input::placeholder,textarea::placeholder { color:var(--t2); }
  [contenteditable]:empty:before { content:attr(data-placeholder); color:var(--t3); pointer-events:none; }
  [contenteditable] img { max-width:100%; border-radius:6px; margin:8px 0; display:block; }
  .ts-note img { max-width:100%; border-radius:8px; margin:8px 0; display:block; cursor:pointer; }
  .ts-note img:hover { opacity:0.9; transform:scale(1.01); transition:all 0.2s; }
  [contenteditable] h2 { font-size:20px; font-weight:700; margin:16px 0 6px; color:var(--t1); }
  [contenteditable] h3 { font-size:16px; font-weight:600; margin:12px 0 4px; color:var(--t2); }
  [contenteditable] ul, [contenteditable] ol { padding-left:22px; margin:6px 0; }
  [contenteditable] hr { border:none; border-top:1px solid var(--b2); margin:16px 0; }

  /* ── Animations ── */
  @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes slideInRight { from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)} }
  @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes pulse     { 0%,100%{box-shadow:0 0 0 0 rgba(212,255,30,0.4)} 50%{box-shadow:0 0 0 6px rgba(212,255,30,0)} }
  @keyframes slideRight{ from{transform:scaleX(0)} to{transform:scaleX(1)} }
  @keyframes shimmer   { from{background-position:-200% 0} to{background-position:200% 0} }
  @keyframes popIn     { 0%{opacity:0;transform:scale(0.92)} 60%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)} }
  @keyframes scanline  { 0%{top:-10%} 100%{top:110%} }
  .fade-up   { animation:fadeUp  0.28s cubic-bezier(0.4,0,0.2,1) forwards; }
  .fade-in   { animation:fadeIn  0.2s ease forwards; }
  .slide-in  { animation:slideIn 0.22s ease forwards; }
  .pop-in    { animation:popIn   0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }

  /* ── Buttons ── */
  .btn { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:13px;font-weight:600;transition:var(--transition);white-space:nowrap;position:relative;overflow:hidden; }
  .btn::after { content:"";position:absolute;inset:0;background:rgba(255,255,255,0);transition:background 0.15s; }
  .btn:active::after { background:rgba(255,255,255,0.07); }
  .btn-acc { background:var(--acc);color:#080a10;box-shadow:0 2px 12px rgba(212,255,30,0.2); }
  .btn-acc:hover { background:#cff500;transform:translateY(-2px);box-shadow:0 6px 20px rgba(212,255,30,0.35); }
  .btn-acc:active { transform:translateY(0); }
  .btn-ghost { background:transparent;color:var(--t2);border:1px solid var(--b2); }
  .btn-ghost:hover { background:var(--s3);color:var(--t1);border-color:var(--b3);transform:translateY(-1px); }
  .btn-sub { background:var(--s3);color:var(--t1);border:1px solid var(--b2); }
  .btn-sub:hover { background:var(--s4);border-color:var(--b3);transform:translateY(-1px); }
  .btn-hover-acc:hover { background:var(--acc);color:#080a10;border-color:var(--acc);box-shadow:0 4px 16px rgba(212,255,30,0.25);transform:translateY(-1px); }
  .btn-red { background:rgba(255,82,82,0.1);color:var(--red);border:1px solid rgba(255,82,82,0.2); }
  .btn-red:hover { background:rgba(255,82,82,0.2);transform:translateY(-1px); }

  /* ── Cards ── */
  .card { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);padding:20px;transition:border-color 0.2s; }
  .card:hover { border-color:var(--b2); }
  .card-interactive { cursor:pointer; }
  .card-interactive:hover { border-color:var(--b3);transform:translateY(-2px);box-shadow:var(--shadow-card); }

  /* ── Inputs ── */
  input[type=text],input[type=email],input[type=date],input[type=password],select,textarea {
    background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);
    color:var(--t1);padding:8px 12px;font-size:14px;width:100%;
    transition:border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  input[type=text]:hover,input[type=email]:hover,input[type=password]:hover,select:hover,textarea:hover { border-color:var(--b2); }
  input[type=text]:focus,input[type=email]:focus,input[type=password]:focus,select:focus,textarea:focus {
    border-color:var(--acc); box-shadow:0 0 0 3px rgba(212,255,30,0.08); background:var(--s3);
  }

  /* ── Chips ── */
  .chip { display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.03em;transition:all 0.15s; }
  .chip-acc    { background:rgba(212,255,30,0.12); color:var(--acc);    border:1px solid rgba(212,255,30,0.2); }
  .chip-blue   { background:rgba(79,195,247,0.12); color:var(--blue);   border:1px solid rgba(79,195,247,0.2); }
  .chip-purple { background:rgba(179,157,219,0.12);color:var(--purple); border:1px solid rgba(179,157,219,0.2); }
  .chip-red    { background:rgba(255,82,82,0.12);  color:var(--red);    border:1px solid rgba(255,82,82,0.2); }
  .chip-green  { background:rgba(105,240,174,0.12);color:var(--green);  border:1px solid rgba(105,240,174,0.2); }
  .chip-dim    { background:var(--s3);             color:var(--t2);     border:1px solid var(--b2); }

  /* ── Modals ── */
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);z-index:999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;animation:fadeIn 0.18s ease;padding:40px 0; }
  .modal { background:var(--s1);border:1px solid var(--b2);border-radius:12px;padding:32px 40px;width:min(560px,96vw);animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 24px 64px rgba(0,0,0,0.6); }
  .modal-sm { width:min(480px,94vw); }
  @media (max-width:900px) { .modal { padding:18px; width:96vw !important; } }

  /* ── Tabs ── */
  .tab-bar { display:flex;background:var(--s2);border-radius:var(--r);padding:3px;gap:2px; }
  .tab { flex:1;padding:6px 10px;border-radius:5px;font-size:12px;font-weight:600;background:transparent;color:var(--t3);border:none;cursor:pointer;transition:all 0.2s;white-space:nowrap; }
  .tab:hover:not(.on) { color:var(--t1);background:rgba(255,255,255,0.04); }
  .tab.on { background:var(--s3);color:var(--t1);border:1px solid var(--b2);box-shadow:0 1px 4px rgba(0,0,0,0.3); }

  /* ── Misc UI ── */
  .hr { height:1px;background:var(--b1);margin:16px 0; }
  .label-sm { font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3); }
  .pbar { height:5px;background:var(--b1);border-radius:3px;overflow:hidden; }
  .pfill { height:100%;border-radius:3px;transform-origin:left;animation:slideRight 0.7s cubic-bezier(0.4,0,0.2,1) forwards; }
  .pip { width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-family:'JetBrains Mono',monospace;font-weight:500;flex-shrink:0;transition:transform 0.15s; }
  .pip:hover { transform:scale(1.15); }
  .pip-w { background:rgba(105,240,174,0.15);color:var(--green);border:1px solid rgba(105,240,174,0.3); }
  .pip-l { background:rgba(255,82,82,0.15);  color:var(--red);  border:1px solid rgba(255,82,82,0.3); }
  .pip-e { background:var(--s2);border:1px dashed var(--b2);color:var(--t3); }
  .ldot { width:7px;height:7px;border-radius:50%;background:var(--acc);animation:blink 1.4s infinite; }

  /* ── Tables ── */
  .tbl { width:100%;border-collapse:collapse; }
  .tbl th { text-align:left;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--b1); }
  .tbl td { padding:10px 12px;border-bottom:1px solid var(--b1);vertical-align:middle;transition:background 0.12s; }
  .tbl-compact td, .tbl-compact th { padding:6px 12px; }
  .tbl tr:last-child td { border-bottom:none; }
  .tbl tbody tr { transition:background 0.12s; cursor:pointer; }
  .tbl tbody tr:hover td { background:var(--s2); }
  .tbl tbody tr:active td { background:var(--s3); }

  /* ── Kanban ── */
  .kcol { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);width:230px;flex-shrink:0;display:flex;flex-direction:column; }
  .ktask { background:var(--s2);border:1px solid var(--b1);border-radius:var(--r2);padding:12px;margin:0 10px 8px;cursor:pointer;transition:all 0.18s; }
  .ktask:hover { border-color:var(--acc);transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.35); }

  /* ── Calendar ── */
  .cal-cell { border-right:1px solid var(--b1);min-height:0;padding:6px;cursor:pointer;transition:all 0.15s; }
  .cal-cell:hover { background:var(--s2); }
  .cal-cell:active { background:var(--s3); }
  .cal-ev { padding:3px 7px;border-radius:4px;font-size:11px;font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity 0.15s;width:100%;box-sizing:border-box; }
  .cal-ev:hover { opacity:0.85; }

  /* ── Strategy cards ── */
  .strat-card { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;cursor:pointer;transition:all 0.22s cubic-bezier(0.4,0,0.2,1); }
  .strat-card:hover { border-color:var(--acc);transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.4),var(--glow-acc); }

  /* ── VOD rows ── */
  .vts { display:flex;gap:12px;padding:12px;border-radius:var(--r);transition:all 0.15s; }
  .vts:hover { background:var(--s2); }
  .vod-row { transition:all 0.12s !important; }
  .ab { border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-family:'DIN Next LT Pro',sans-serif;font-weight:700;letter-spacing:0.03em;flex-shrink:0; }

  /* ── Sidebar ── */
  .nav-item { display:flex;align-items:center;gap:12px;padding:9px 10px;border-radius:8px;font-size:14px;font-weight:500;color:var(--t2);cursor:pointer;transition:all 0.18s;user-select:none;white-space:nowrap;overflow:hidden;position:relative; }
  .nav-item::before { content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:var(--acc);border-radius:0 3px 3px 0;transition:height 0.2s ease; }
  .nav-item:hover { background:var(--s3);color:var(--t1); }
  .nav-item:hover::before { height:60%; }
  .nav-item.on { background:var(--s3);color:var(--acc); }
  .nav-item.on::before { height:70%; }
  .nav-icon { display:flex;align-items:center;justify-content:center;width:22px;height:22px;flex-shrink:0;transition:transform 0.2s; }
  .nav-item:hover .nav-icon { transform:scale(1.1); }
  .nav-item.on .nav-icon { transform:scale(1.1); }

  /* Sidebar expand */
  aside.sidebar { width:58px; transition:width 220ms cubic-bezier(0.4,0,0.2,1); overflow:hidden; flex-shrink:0; }
  aside.sidebar:hover { width:220px; }
  aside.sidebar .sb-text { opacity:0; width:0; overflow:hidden; pointer-events:none; transition:opacity 100ms,width 200ms ease-in-out; white-space:nowrap; }
  aside.sidebar:hover .sb-text { opacity:1; width:auto; transition:opacity 150ms 80ms,width 200ms ease-in-out; }
  aside.sidebar .nav-item { gap:0; justify-content:center; padding:9px 0; }
  aside.sidebar .nav-item.on .nav-icon { margin-left:3px; }
  aside.sidebar:hover .nav-item { gap:12px; justify-content:flex-start; padding:9px 10px; }
  aside.sidebar .nav-item .nav-icon { margin:0 auto; }
  aside.sidebar:hover .nav-item .nav-icon { margin:0; }
  aside.sidebar:hover .sb-logout { display:block !important; }

  /* ── Loading skeletons ── */
  .skeleton { background:linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%);background-size:200% 100%;animation:shimmer 1.6s infinite; border-radius:4px; }

  /* ── Stat blocks ── */
  .stat-block { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);padding:16px 20px;transition:all 0.2s;position:relative;overflow:hidden; }
  .stat-block::after { content:"";position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.01) 0%,transparent 60%);pointer-events:none; }
  .stat-block:hover { border-color:var(--b2);transform:translateY(-2px);box-shadow:var(--shadow-card); }
  .stat-block.accent { border-color:rgba(212,255,30,0.2);background:linear-gradient(135deg,var(--s1) 60%,rgba(212,255,30,0.03)); }
  .stat-block.accent:hover { border-color:rgba(212,255,30,0.4);box-shadow:var(--glow-acc); }

  /* ── Page transitions ── */
  main > * { animation:fadeUp 0.25s cubic-bezier(0.4,0,0.2,1) forwards; }

  /* ── Checkbox animations ── */
  input[type=checkbox] { accent-color:var(--acc); cursor:pointer; width:15px; height:15px; transition:transform 0.15s; }
  input[type=checkbox]:hover { transform:scale(1.1); }

  /* ── Selection highlight ── */
  ::selection { background:rgba(212,255,30,0.2); color:var(--t1); }

  /* ── Contenteditable placeholder ── */
  [contenteditable][data-placeholder]:empty::before { content:attr(data-placeholder); color:var(--t3); opacity:0.5; pointer-events:none; }
`;

const TRADE_WINDOW_MS = 2000; // ms after first death to count as a trade

const MAPS = ["Ascent","Breeze","Fracture","Haven","Split","Lotus","Pearl"];
const AGENTS = [
  { name:"Astra",     color:"#b39ddb", bg:"#1a1428" },
  { name:"Breach",    color:"#ffab40", bg:"#2b1a08" },
  { name:"Brimstone", color:"#ff7043", bg:"#2b1008" },
  { name:"Chamber",   color:"#d4ff1e", bg:"#1e2408" },
  { name:"Clove",     color:"#d4b0ff", bg:"#1c0e2e" },
  { name:"Cypher",    color:"#c8d0e0", bg:"#161c28" },
  { name:"Deadlock",  color:"#69f0ae", bg:"#0a1e16" },
  { name:"Fade",      color:"#d4b0ff", bg:"#1c0e2e" },
  { name:"Gekko",     color:"#a3e84f", bg:"#182010" },
  { name:"Harbor",    color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"Iso",       color:"#8892aa", bg:"#141820" },
  { name:"Jett",      color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"KAY/O",     color:"#c8d0e0", bg:"#161c28" },
  { name:"Killjoy",   color:"#d4ff1e", bg:"#1e2408" },
  { name:"Neon",      color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"Omen",      color:"#8892aa", bg:"#141820" },
  { name:"Phoenix",   color:"#ffab40", bg:"#2b1a08" },
  { name:"Raze",      color:"#ffab40", bg:"#2b1a08" },
  { name:"Reyna",     color:"#b39ddb", bg:"#1a1428" },
  { name:"Sage",      color:"#69f0ae", bg:"#0a1e16" },
  { name:"Skye",      color:"#a3e84f", bg:"#182010" },
  { name:"Sova",      color:"#b39ddb", bg:"#1a1428" },
  { name:"Tejo",      color:"#ffab40", bg:"#2b1a08" },
  { name:"Veto",      color:"#ff5252", bg:"#2b0808" },
  { name:"Viper",     color:"#69f0ae", bg:"#0a1e16" },
  { name:"Vyse",      color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"Waylay",    color:"#d4ff1e", bg:"#1e2408" },
  { name:"Yoru",      color:"#4fc3f7", bg:"#0b1e2b" },
];
const ECO_STATES = ["Pistol","Full Buy","Eco","Force","Semi Buy","Bonus"];
const CAT_COLORS = {
  "Scrim":"#4fc3f7","Server Time":"#69f0ae","VOD Review":"#b39ddb","Official":"#d4ff1e","Other":"#ffab40",
};
const LABEL_COLORS = ["#4fc3f7","#d4ff1e","#ff5252","#69f0ae","#ffab40","#b39ddb","#ff80ab","#80cbc4"];

const AGENT_COLOR_PALETTE = [
  { label:"Astra",     color:"#8435c9", icon:"Astra" },
  { label:"Breach",    color:"#ee9843", icon:"Breach" },
  { label:"Brimstone", color:"#c5510e", icon:"Brimstone" },
  { label:"Chamber",   color:"#557590", icon:"Chamber" },
  { label:"Clove",     color:"#eba2a8", icon:"Clove" },
  { label:"Cypher",    color:"#b0a090", icon:"Cypher" },
  { label:"Deadlock",  color:"#2aa4e6", icon:"Deadlock " },
  { label:"Fade",      color:"#c09482", icon:"Fade" },
  { label:"Gekko",     color:"#c4da4b", icon:"Gekko" },
  { label:"Harbor",    color:"#3e6ab1", icon:"Harbor" },
  { label:"Iso",       color:"#9e6cff", icon:"Iso" },
  { label:"Jett",      color:"#7bb8c4", icon:"Jett" },
  { label:"KAY/O",     color:"#1b4fd6", icon:"KAYO" },
  { label:"Killjoy",   color:"#f9cd22", icon:"Killjoy" },
  { label:"Neon",      color:"#5da8f0", icon:"Neon" },
  { label:"Omen",      color:"#3d7fd8", icon:"Omen" },
  { label:"Phoenix",   color:"#e97f53", icon:"Phoenix" },
  { label:"Raze",      color:"#f68e3d", icon:"Raze" },
  { label:"Reyna",     color:"#e743e0", icon:"Reyna" },
  { label:"Sage",      color:"#55c5ad", icon:"Sage" },
  { label:"Skye",      color:"#00dd60", icon:"Skye" },
  { label:"Sova",      color:"#3b6df8", icon:"Sova" },
  { label:"Tejo",      color:"#f4ba26", icon:"Tejo" },
  { label:"Veto",      color:"#00f7d4", icon:"Veto" },
  { label:"Viper",     color:"#8cd953", icon:"Viper" },
  { label:"Vyse",      color:"#c92e6c", icon:"Vyse" },
  { label:"Waylay",    color:"#c2d379", icon:"Waylay" },
  { label:"Yoru",      color:"#1851bd", icon:"Yoru" },
  { label:"White",     color:"#FFFFFF", icon:null },
  { label:"Reset",     color:null,      icon:null },
];

function AgentColorPicker({ onApply }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const savedRange = React.useRef(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    if (!savedRange.current) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange.current);
  };

  const applyColor = (color) => {
    restoreSelection();
    if (color === null) {
      document.execCommand("removeFormat", false, null);
    } else {
      document.execCommand("styleWithCSS", false, true);
      document.execCommand("foreColor", false, color);
    }
    setOpen(false);
    savedRange.current = null;
    onApply && onApply();
  };

  React.useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position:"relative", display:"inline-block" }}>
      <button
        title="Text color"
        onMouseDown={(e) => { e.preventDefault(); saveSelection(); setOpen(o => !o); }}
        style={{ padding:"4px 9px", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, color:"var(--t1)", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}
        onMouseOver={e=>e.currentTarget.style.background="var(--b2)"} onMouseOut={e=>e.currentTarget.style.background="var(--s3)"}>
        <span style={{ fontSize:13 }}>A</span>
        <span style={{ width:14, height:3, background:"var(--acc)", borderRadius:2, display:"inline-block" }}/>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, zIndex:10000, background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.6)", minWidth:280 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Agent Colors</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
            {AGENT_COLOR_PALETTE.map(({ label, color, icon }) => (
              <button
                key={label}
                title={label}
                onMouseDown={(e) => { e.preventDefault(); applyColor(color); }}
                style={{ width:30, height:36, borderRadius:5, cursor:"pointer", padding:0, overflow:"hidden", background:"var(--s2)", border:`2px solid ${color ? color+"55" : "#555"}`, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", transition:"transform 0.1s, border-color 0.1s" }}
                onMouseOver={e=>{ e.currentTarget.style.transform="scale(1.18)"; e.currentTarget.style.borderColor=color||"#aaa"; }}
                onMouseOut={e=>{ e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor=color ? color+"55" : "#555"; }}>
                {icon
                  ? <img src={`/assets/agents/${icon}.png`} alt={label} style={{ width:26, height:26, objectFit:"cover", objectPosition:"top center", display:"block" }}/>
                  : <span style={{ fontSize:color?"11px":"13px", color:color||"#aaa", fontWeight:700, lineHeight:1, paddingBottom:2 }}>{color?"W":"✕"}</span>
                }
                <div style={{ width:"100%", height:4, background: color || "#555", flexShrink:0 }}/>
              </button>
            ))}
          </div>
          <div style={{ fontSize:10, color:"var(--t3)", marginTop:8 }}>Select text first, then pick a color</div>
        </div>
      )}
    </div>
  );
}

// ── Supabase Storage image upload ──────────────────────────
const SUPABASE_URL  = "https://xciujyilunfjxoxacqek.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjaXVqeWlsdW5manhveGFjcWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MTgyNzYsImV4cCI6MjA4ODE5NDI3Nn0.bY1QuX36bCffja2Hitp-t-kjPT9snf7zLgDooyjuvb0";
const STORAGE_BUCKET = "tracker-images";

// Compress then upload to Supabase Storage. Returns public URL.
// Falls back to base64 if upload fails so nothing breaks.
function uploadImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let { width: w, height: h } = img;
        if (w > MAX || h > MAX) {
          if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
          else        { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(async blob => {
          try {
            const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
            const res  = await fetch(
              `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${name}`,
              { method:"POST", headers:{ "Authorization":`Bearer ${SUPABASE_ANON}`, "Content-Type":"image/jpeg", "x-upsert":"true" }, body:blob }
            );
            if (!res.ok) throw new Error(await res.text());
            resolve(`${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${name}`);
          } catch(err) {
            console.warn("Storage upload failed, falling back to base64:", err);
            resolve(canvas.toDataURL("image/jpeg", 0.82));
          }
        }, "image/jpeg", 0.82);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
// Alias so any remaining call sites work unchanged
const compressImage = uploadImage;

const AGENT_ICONS = {
  "Astra":     "/assets/agents/Astra.png",
  "Breach":    "/assets/agents/Breach.png",
  "Brimstone": "/assets/agents/Brimstone.png",
  "Chamber":   "/assets/agents/Chamber.png",
  "Clove":     "/assets/agents/Clove.png",
  "Cypher":    "/assets/agents/Cypher.png",
  "Deadlock":  "/assets/agents/Deadlock .png",  // filename has trailing space — keep matching actual file
  "Fade":      "/assets/agents/Fade.png",
  "Gekko":     "/assets/agents/Gekko.png",
  "Harbor":    "/assets/agents/Harbor.png",
  "Iso":       "/assets/agents/Iso.png",
  "Jett":      "/assets/agents/Jett.png",
  "KAY/O":     "/assets/agents/KAYO.png",
  "Killjoy":   "/assets/agents/Killjoy.png",
  "Neon":      "/assets/agents/Neon.png",
  "Omen":      "/assets/agents/Omen.png",
  "Phoenix":   "/assets/agents/Phoenix.png",
  "Raze":      "/assets/agents/Raze.png",
  "Reyna":     "/assets/agents/Reyna.png",
  "Sage":      "/assets/agents/Sage.png",
  "Skye":      "/assets/agents/Skye.png",
  "Sova":      "/assets/agents/Sova.png",
  "Tejo":      "/assets/agents/Tejo.png",
  "Veto":      "/assets/agents/Veto.png",
  "Viper":     "/assets/agents/Viper.png",
  "Vyse":      "/assets/agents/Vyse.png",
  "Waylay":    "/assets/agents/Waylay.png",
  "Yoru":      "/assets/agents/Yoru.png",
  "Miks":      "/assets/agents/Miks.png",
};
// Global UUID-short → agent name map (for resolving raw UUIDs stored in old DB records)
const CHAR_MAP_GLOBAL = {
  "41fb69c1":"Astra",    "5f8d3a7f":"Breach",   "9f0d8ba9":"Brimstone", "22697a3d":"Chamber",
  "1dbf2edd":"Clove",    "117ed9e3":"Cypher",   "cc8b64c8":"Deadlock",  "dade69b4":"Fade",
  "e370fa57":"Gekko",    "95b78ed7":"Harbor",   "0e38b510":"Iso",       "add6443a":"Jett",
  "601dbbe7":"KAY/O",    "1e58de9c":"Killjoy",  "7c8a4701":"Miks",      "bb2a4828":"Neon",
  "8e253930":"Omen",     "eb93336a":"Phoenix",  "f94c3b30":"Raze",      "a3bfb853":"Reyna",
  "569fdd95":"Sage",     "6f2a04ca":"Skye",     "320b2a48":"Sova",      "b444168c":"Tejo",
  "92eeef5d":"Veto",     "707eab51":"Viper",    "efba5359":"Vyse",      "df1cb487":"Waylay",
  "7f94d92c":"Yoru",
};
const AgentBadge = React.memo(({ name, size=32 }) => {
  // Normalise: "KAYO" legacy, raw UUID short (e.g. "add6443a"), or proper name
  const _n0 = name === "KAYO" ? "KAY/O" : name;
  const n   = (AGENT_ICONS[_n0] || AGENTS.find(a=>a.name===_n0)) ? _n0 : (CHAR_MAP_GLOBAL[_n0] || _n0);
  const ag  = AGENTS.find(a=>a.name===n) || { color:"#8892aa", bg:"#141820" };
  const url = AGENT_ICONS[n];
  const [err, setErr] = React.useState(false);
  return (
    <div className="ab" style={{ width:size, height:size, background:ag.bg, border:`1px solid ${ag.color}28`, overflow:"hidden" }}>
      {url && !err
        ? <img src={url} alt={n} onError={()=>setErr(true)}
            style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top center" }}/>
        : <span style={{ color:ag.color, fontSize:size*0.35, fontWeight:700 }}>{n.slice(0,2).toUpperCase()}</span>
      }
    </div>
  );
});
const STAT_ICONS = {
  // Crosshair: circle + 4 tick lines extending outward + filled center dot
  winrate: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="6.5"/>
      {/* top tick */}
      <line x1="12" y1="2" x2="12" y2="5.5"/>
      {/* bottom tick */}
      <line x1="12" y1="18.5" x2="12" y2="22"/>
      {/* left tick */}
      <line x1="2" y1="12" x2="5.5" y2="12"/>
      {/* right tick */}
      <line x1="18.5" y1="12" x2="22" y2="12"/>
      {/* center dot */}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // PS-style controller: body with curved grips, d-pad cross, 4 face buttons
  games: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* body */}
      <path d="M4 8.5C3 8.5 2 9.5 2 11v1.5c0 2 1.2 4 3 5l1.5 1c.5.3 1 .5 1.5.5h6c.5 0 1-.2 1.5-.5l1.5-1c1.8-1 3-3 3-5V11c0-1.5-1-2.5-2-2.5H4z"/>
      {/* d-pad horizontal */}
      <line x1="5.5" y1="12" x2="9" y2="12"/>
      {/* d-pad vertical */}
      <line x1="7.25" y1="10.25" x2="7.25" y2="13.75"/>
      {/* face buttons */}
      <circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="17.5" cy="12.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="13.5" cy="12.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="15.5" cy="14.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // Clipboard: rounded rect body + top clip with small knob + 3 rows of checkbox+line
  tasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* body */}
      <rect x="5" y="5" width="14" height="16" rx="2"/>
      {/* clip bar */}
      <rect x="9" y="3" width="6" height="3.5" rx="1"/>
      {/* knob on clip */}
      <circle cx="12" cy="3.5" r="0.9" fill="currentColor" stroke="none"/>
      {/* row 1 */}
      <rect x="8" y="10" width="1.5" height="1.5" rx="0.3" fill="currentColor" stroke="none"/>
      <line x1="11" y1="10.75" x2="16" y2="10.75"/>
      {/* row 2 */}
      <rect x="8" y="13" width="1.5" height="1.5" rx="0.3" fill="currentColor" stroke="none"/>
      <line x1="11" y1="13.75" x2="16" y2="13.75"/>
      {/* row 3 */}
      <rect x="8" y="16" width="1.5" height="1.5" rx="0.3" fill="currentColor" stroke="none"/>
      <line x1="11" y1="16.75" x2="16" y2="16.75"/>
    </svg>
  ),
  // Calendar: rounded rect + two ring binders at top + header band + 3x2 dot grid
  upcoming: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* body */}
      <rect x="3" y="5" width="18" height="16" rx="2.5"/>
      {/* header fill band */}
      <line x1="3" y1="10" x2="21" y2="10"/>
      {/* left binder */}
      <line x1="8" y1="3" x2="8" y2="7"/>
      {/* right binder */}
      <line x1="16" y1="3" x2="16" y2="7"/>
      {/* 3x2 dot grid */}
      <circle cx="8"  cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/>
      <circle cx="8"  cy="18" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
};

const StatBlock = ({ label, value, sub, accent, icon, extraContent, pendingTasks }) => {
  const [displayed, setDisplayed] = React.useState(0);
  const numVal = typeof value === "number" ? value : parseFloat(value);
  const isNum = !isNaN(numVal);
  React.useEffect(() => {
    if (!isNum) return;
    let start = 0; const end = numVal; const dur = 600;
    const step = () => { start += end / (dur / 16); if(start >= end){ setDisplayed(end); return; } setDisplayed(Math.floor(start)); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [numVal]);
  const display = isNum ? (typeof value === "string" && value.includes("%") ? displayed + "%" : displayed) : value;
  const iconEl = icon ? STAT_ICONS[icon] : null;
  return (
    <div className={`stat-block${accent?" accent":""}`}>
      {accent && <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--acc),transparent)" }}/>}
      <div className="label-sm" style={{ marginBottom:8, display:"flex", alignItems:"center", gap:5 }}>
        {iconEl && <span style={{ color: accent ? "var(--acc)" : "var(--t3)", opacity:0.85, display:"flex", alignItems:"center" }}>{iconEl}</span>}
        {label}
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, color:accent?"var(--acc)":"var(--t1)", letterSpacing:"0.02em", lineHeight:1, transition:"color 0.3s" }}>{display}</div>
          {sub && <div style={{ fontSize:12,color:"var(--t2)",marginTop:4 }}>{sub}</div>}
        </div>
        {pendingTasks && Array.isArray(pendingTasks) && (() => {
          const high   = pendingTasks.filter(t=>t.priority==="High").length;
          const medium = pendingTasks.filter(t=>t.priority==="Medium").length;
          const now = new Date(); now.setHours(0,0,0,0);
          const overdue = pendingTasks.filter(t=>t.due && new Date(t.due)<now).length;
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:3, alignItems:"flex-start" }}>
              <div style={{ fontSize:10, color:"var(--t2)" }}><span style={{ color: high>0 ? "#ff5252" : "var(--t3)" }}>●</span> {high} high priority</div>
              <div style={{ fontSize:10, color:"var(--t2)" }}><span style={{ color: medium>0 ? "#ffb347" : "var(--t3)" }}>●</span> {medium} medium priority</div>
              <div style={{ fontSize:10, color:"var(--t2)" }}><span style={{ color: overdue>0 ? "#ff5252" : "var(--t3)" }}>◎</span> {overdue} overdue</div>
            </div>
          );
        })()}
      </div>
      {extraContent && extraContent}
    </div>
  );
};
const Bar = React.memo(({ pct, color="var(--acc)" }) => (
  <div className="pbar" style={{ flex:1 }}><div className="pfill" style={{ width:`${pct}%`, background:color }}/></div>
));
const Divider = () => <div className="hr"/>;

function Modal({ onClose, title, children, wide, fullscreen }) {
  React.useEffect(() => {
    const handler = e => { if(e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  const widthStyle = fullscreen
    ? { width:"min(1100px,96vw)", minHeight:"80vh" }
    : wide
    ? { width:"min(760px,96vw)", maxHeight:"90vh", display:"flex", flexDirection:"column" }
    : {};
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ display:"flex", flexDirection:"column", ...widthStyle }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexShrink:0 }}>
          <span className="bc" style={{ fontSize:22,fontWeight:700,letterSpacing:"0.03em" }}>{title}</span>
          <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:16 }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflowY:"auto", minHeight:0 }}>{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" style={{ maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:12 }}>{title}</div>
        <div style={{ color:"var(--t2)", fontSize:14, marginBottom:20 }}>{message}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-red" style={{ flex:1, justifyContent:"center" }} onClick={onConfirm}>Delete</button>
          <button className="btn btn-ghost" style={{ flex:1, justifyContent:"center" }} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { key:"dashboard", label:"Dashboard",    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { key:"strategy",  label:"Strategy",     icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  { key:"scrimlog",  label:"Scrim Log",    icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
  { key:"analysis",  label:"Data Analysis",icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { key:"vod",       label:"Review",       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg> },
  { key:"tasks",     label:"Tasks",        icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
  { key:"calendar",  label:"Calendar",     icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { key:"stratboard", label:"Strat Board",   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
  { key:"sheets",    label:"Sheets",       icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg> },
  { key:"vetoplanner", label:"Veto Tools",   icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
];


/* ════ STRAT BOARD PAGE ════ */
function StratBoardPage({ isAdmin }) {
  const [sharedUrl, setSharedUrl] = React.useState("");
  const [loading, setLoading]     = React.useState(true);
  const [mode, setMode]           = React.useState("view");   // "view" | "create"
  const [shareInput, setShareInput] = React.useState("");
  const [shareError, setShareError] = React.useState("");
  const [shareBanner, setShareBanner] = React.useState("");
  const iframeRef = React.useRef(null);

  React.useEffect(() => {
    api.get("/api/settings").then(d => {
      const saved = d?.stratboard_url || "";
      setSharedUrl(saved);
      if (!saved) setMode("create"); // no board yet — show creator first
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Normalise any board URL into a shareable/embeddable form
  const normalise = url => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    
    
    // Accept other board tools too
    if (trimmed.startsWith("http")) return trimmed;
    return null;
  };

  const handleShare = () => {
    const clean = normalise(shareInput);
    if (!clean) { setShareError("Paste a valid URL"); return; }
    setShareError("");
    setSharedUrl(clean);
    api.put("/api/settings/stratboard_url", { value: clean }).catch(() => {});
    setShareBanner("✓ Board shared with team!");
    setTimeout(() => setShareBanner(""), 3000);
    setMode("view");
  };

  const handleClearShared = () => {
    setSharedUrl("");
    setShareInput("");
    api.put("/api/settings/stratboard_url", { value: "" }).catch(() => {});
    setMode("create");
  };

  if (loading) return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)", background:"var(--bg)" }}>Loading…</div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg)" }}>

      {/* Top bar */}
      <div style={{ padding:"0 0", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"stretch", flexShrink:0, background:"var(--s1)", height:44 }}>
        {/* View / Create tabs */}
        <button onClick={()=>setMode("view")}
          style={{ padding:"0 20px", border:"none", borderRight:"1px solid var(--b1)", cursor:"pointer", fontSize:13, fontWeight:700,
            background: mode==="view" ? "var(--s2)" : "transparent",
            color: mode==="view" ? "var(--t1)" : "var(--t3)",
            borderBottom: mode==="view" ? "2px solid var(--acc)" : "2px solid transparent" }}>
          👁 Team Board
        </button>
        <button onClick={()=>setMode("create")}
          style={{ padding:"0 20px", border:"none", borderRight:"1px solid var(--b1)", cursor:"pointer", fontSize:13, fontWeight:700,
            background: mode==="create" ? "var(--s2)" : "transparent",
            color: mode==="create" ? "var(--t1)" : "var(--t3)",
            borderBottom: mode==="create" ? "2px solid var(--acc)" : "2px solid transparent" }}>
          ✏️ Create Board
        </button>

        {/* Share input — shown in create mode */}
        {mode==="create" && (
          <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, padding:"0 16px" }}>
            <span style={{ fontSize:12, color:"var(--t3)", whiteSpace:"nowrap" }}>Share link:</span>
            <input
              value={shareInput}
              onChange={e=>setShareInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleShare()}
              placeholder="Paste your board URL here…"
              style={{ flex:1, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"5px 12px", fontSize:12, color:"var(--t1)", outline:"none", fontFamily:"inherit" }}
            />
            <button className="btn btn-acc" onClick={handleShare} style={{ padding:"5px 16px", fontSize:12, fontWeight:700, whiteSpace:"nowrap" }}>
              📢 Share with Team
            </button>
            {shareError && <span style={{ fontSize:11, color:"var(--red)", whiteSpace:"nowrap" }}>{shareError}</span>}
          </div>
        )}

        {/* Right side — share banner + current board info */}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12, padding:"0 16px" }}>
          {shareBanner && <span style={{ fontSize:12, color:"var(--green)", fontWeight:600 }}>{shareBanner}</span>}
          {mode==="view" && sharedUrl && (
            <>
              <span style={{ fontSize:11, color:"var(--t3)" }}>
                {sharedUrl.replace(/^https?:\/\//, "").slice(0,48)}{sharedUrl.length>48?"…":""}
              </span>
              <button className="btn btn-ghost" onClick={()=>setMode("create")} style={{ padding:"4px 10px", fontSize:11 }}>✏ Update</button>
              {isAdmin && <button className="btn btn-red" onClick={handleClearShared} style={{ padding:"4px 10px", fontSize:11 }}>✕ Clear</button>}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {mode==="view" ? (
        sharedUrl ? (
          <iframe
            src={sharedUrl}
            style={{ flex:1, border:"none", width:"100%", height:"100%" }}
            allow="clipboard-read; clipboard-write"
            title="Team Strat Board"
          />
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, color:"var(--t3)" }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No team board yet</div>
              <div style={{ fontSize:13, marginBottom:16 }}>Create a board and share it with the team</div>
              <button className="btn btn-acc" onClick={()=>setMode("create")}>✏️ Create a Board</button>
            </div>
          </div>
        )
      ) : (
        /* Create mode — tactical wingman embedded */
        <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"8px 16px", background:"rgba(212,255,30,0.06)", borderBottom:"1px solid rgba(212,255,30,0.15)", fontSize:12, color:"var(--acc)", display:"flex", alignItems:"center", gap:8 }}>
            <span>💡</span>
            <span>Create your board below, then copy its share URL and paste it in the bar above to share it with the whole team.</span>
          </div>
          <iframe
            src="https://tactical-wingman-app.vercel.app/"
            style={{ flex:1, border:"none", width:"100%", height:"100%" }}
            allow="clipboard-read; clipboard-write"
            title="Tactical Wingman"
          />
        </div>
      )}
    </div>
  );
}

export default function RaTracker() {
  const [page, setPage]         = useState("dashboard");
  const [pendingScrimId, setPendingScrimId] = useState(null);
  const [stratTab, setStratTab] = useState("raw");
  const [players, setPlayers]   = useState([]);
  const [vodDeepLink, setVodDeepLink] = useState(null); // scrim id to auto-open in VodReview

  useEffect(()=>{ api.get("/api/players").then(d=>{ if(Array.isArray(d)) setPlayers(d); }).catch(()=>{}); }, []);

  const renderPage = () => {
    switch(page) {
      case "dashboard": return <Dashboard setPage={setPage} user={user} setVodDeepLink={setVodDeepLink} setPendingScrimId={setPendingScrimId}/>;
      case "tracker":   return <LiveTracker players={players} setPage={setPage}/>;
      case "ocr":       return <OCRScanner setPage={setPage}/>;
      case "scrimlog":  return <ScrimLog setPage={setPage} pendingScrimId={pendingScrimId} onPendingConsumed={()=>setPendingScrimId(null)}/>;
      case "strategy":  return <Strategy tab={stratTab} setTab={setStratTab} isAdmin={true}/>;
      case "analysis":  return <DataAnalysis players={players}/>;
      case "vod":       return <VodReview deepScrimId={vodDeepLink} onDeepLinkConsumed={()=>setVodDeepLink(null)}/>;
      case "tasks":     return <Tasks players={players} setPlayers={setPlayers}/>;
      case "calendar":  return <CalendarPage/>;
      case "goals":      return <GoalsDebrief players={players}/>;
      case "stratboard": return <StratBoardPage isAdmin={true}/>;
      case "sheets":     return <SheetsPage isAdmin={true}/>;
      default:          return <Dashboard setPage={setPage} user={user} setVodDeepLink={setVodDeepLink} setPendingScrimId={setPendingScrimId}/>;
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
        <aside className="sidebar" style={{ background:"#0d1018", borderRight:"1px solid var(--b1)", display:"flex", flexDirection:"column", zIndex:10 }}>

          {/* Logo */}
          <div style={{ padding:"16px 0 14px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, overflow:"hidden", minHeight:60 }}>
            <div style={{ width:36, height:36, background:"var(--acc)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span className="bc" style={{ fontSize:15, fontWeight:900, color:"#080a10" }}>RA</span>
            </div>
            <div className="sb-text" style={{ marginLeft:10 }}>
              <div className="bc" style={{ fontSize:17, fontWeight:900, letterSpacing:"0.06em" }}>OUR TEAM</div>
              <div className="label-sm">Team Tracker</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"4px 8px", display:"flex", flexDirection:"column", gap:2 }}>
            {NAV.map(n=>(
              <div key={n.key}
                className={`nav-item${page===n.key?" on":""}`}
                onClick={()=>setPage(n.key)}
                title={n.label}>
                <span className="nav-icon" style={{ color: page===n.key ? "var(--acc)" : "inherit", flexShrink:0 }}>{n.icon}</span>
                <span className="sb-text" style={{ flex:1 }}>{n.label}</span>
                {n.live && <div className="sb-text" style={{ width:7, height:7, borderRadius:"50%", background:"var(--acc)", className:"skeleton", flexShrink:0 }}/>}
              </div>
            ))}
          </nav>

          {/* User */}
          <div style={{ borderTop:"1px solid var(--b1)", padding:"12px 0", flexShrink:0, overflow:"hidden", display:"flex", justifyContent:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:"50%", background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#080a10", flexShrink:0 }}>AD</div>
              <div className="sb-text">
                <div style={{ fontSize:13, fontWeight:700, whiteSpace:"nowrap" }}>admin</div>
                <div style={{ fontSize:11, color:"var(--t3)", whiteSpace:"nowrap" }}>admin</div>
              </div>
            </div>
          </div>
        </aside>
        <main key={page} className="fade-up" style={{ flex:1, overflowY: "auto", overflowX:"hidden", display:"flex", flexDirection:"column" }}>
          {renderPage()}
        </main>
      </div>
    </>
  );
}

/* ════ DASHBOARD ════ */
function Dashboard({ setPage, user, setVodDeepLink, setPendingScrimId }) {
  const [dismissedReviews, setDismissedReviews] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("dismissedReviews")||"[]")); } catch { return new Set(); }
  });
  const dismissReview = (key) => {
    setDismissedReviews(prev => {
      const next = new Set(prev); next.add(key);
      localStorage.setItem("dismissedReviews", JSON.stringify([...next]));
      return next;
    });
  };
  const setPendingScrimIdRef = React.useRef(setPendingScrimId);
  React.useEffect(() => { setPendingScrimIdRef.current = setPendingScrimId; }, [setPendingScrimId]);
  const openScrim = React.useCallback((id) => { setPendingScrimIdRef.current?.(id); setPage("scrimlog"); }, [setPage]);
  const openVod   = React.useCallback((scrimId) => { if(scrimId && setVodDeepLink) setVodDeepLink(scrimId); setPage("vod"); }, [setPage, setVodDeepLink]);
  const [scrims, setScrims]       = useState([]);
  const [allScrims, setAllScrims] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents]       = useState([]);
  const [tasks, setTasks]         = useState([]);
  const [vods, setVods]           = useState([]);
  const [pending, setPending]     = useState(0);
  const [reviewKeywords, setReviewKeywords] = useState(["review","follow-up","vod","plan","prep","analysis"]);
  const [dashLoading, setDashLoading] = useState(true);
  const [wrFilter, setWrFilter]       = useState("all");
  const [dashTaskModal, setDashTaskModal] = useState(false);
  const [dashTaskForm, setDashTaskForm]   = useState({ title:"", description:"", due:"", assignedTo:"", priority:"" });
  const [dashTaskSaving, setDashTaskSaving] = useState(false);
  const [dashPBModal, setDashPBModal]     = useState(false);
  const [dashPBForm, setDashPBForm]       = useState({ name:"", map:"", agents:["","","","",""], status:"Active" });
  const [dashPBSaving, setDashPBSaving]   = useState(false);
  const [dashPlayers, setDashPlayers]     = useState([]);
  const [dashStaff, setDashStaff]         = useState([]);
  const navigate = useNavigate();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek   = new Date(now); endOfWeek.setDate(now.getDate() + (6 - now.getDay()));
  const weekStr = (d) => { const dd = new Date(d); return dd >= startOfWeek && dd <= endOfWeek; };

  const filterUpcoming = (all) => {
    const nowMins = now.getHours()*60 + now.getMinutes();
    return all.filter(e=>{
      if(e.date > todayStr) return true;
      if(e.date < todayStr) return false;
      if(!e.time) return true;
      const [h,m] = e.time.split(":").map(Number);
      return (h*60+(m||0)) > nowMins;
    }).slice(0,5);
  };

  useEffect(()=>{
    Promise.all([
      api.get("/api/scrims").then(d=>{ if(Array.isArray(d)) { setAllScrims(d); setScrims(d.slice(0,4)); } }).catch(()=>{}),
      api.get("/api/events").then(d=>{ if(Array.isArray(d)) { setAllEvents(d); setEvents(filterUpcoming(d)); } }).catch(()=>{}),
      api.get(`/api/tasks?t=${Date.now()}`).then(d=>{ if(Array.isArray(d)) { const incomplete=d.filter(t=>!t.done); setTasks(incomplete); setPending(incomplete.length); } }).catch(()=>{}),
      api.get("/api/settings").then(d=>{ if(d?.review_keywords){ try{ const kw=JSON.parse(d.review_keywords); if(Array.isArray(kw)&&kw.length>0) setReviewKeywords(kw); }catch{} } }).catch(()=>{}),
      api.get("/api/vods").then(d=>{ if(Array.isArray(d)) setVods(d); }).catch(()=>{}),
    api.get("/api/players").then(d=>{ if(Array.isArray(d)) setDashPlayers(d); }).catch(()=>{}),
      api.get("/auth/users").then(d=>{ if(Array.isArray(d)) setDashStaff(d.filter(u=>!u.is_banned && u.role!=="player")); }).catch(()=>{}),
    ]).finally(()=>setDashLoading(false));
  },[]);

  useEffect(()=>{
    const interval = setInterval(()=>{ setEvents(filterUpcoming(allEvents)); }, 60000);
    return ()=>clearInterval(interval);
  }, [allEvents]);

  const wins = allScrims.filter(s=>(s.res==="win"||s.res==="W")).length;
  const wr   = allScrims.length>0 ? Math.round((wins/allScrims.length)*100) : null;
  const wrFilteredScrims = wrFilter==="all" ? allScrims : allScrims.slice(0, wrFilter==="5" ? 5 : 10);
  const wrFilteredWins   = wrFilteredScrims.filter(s=>(s.res==="win"||s.res==="W")).length;
  const wrFiltered       = wrFilteredScrims.length>0 ? Math.round((wrFilteredWins/wrFilteredScrims.length)*100) : null;

  // ── Quick Insights ──
  const insights = (() => {
    if (allScrims.length < 2) return [];
    const out = [];

    const mapGroups = {};
    allScrims.forEach(s=>{ if(!mapGroups[s.map]) mapGroups[s.map]=[]; mapGroups[s.map].push(s); });
    const mapStats = Object.entries(mapGroups)
      .filter(([,ms])=>ms.length>=2)
      .map(([map,ms])=>{ const w=ms.filter(s=>(s.res==="win"||s.res==="W")).length; return { map, wr:Math.round(w/ms.length*100), wins:w, losses:ms.length-w, games:ms.length }; })
      .sort((a,b)=>b.wr-a.wr);

    // Best map
    if(mapStats.length>0) out.push({ label:"Best Map", value:mapStats[0].map, sub:`${mapStats[0].wins}W – ${mapStats[0].losses}L`, color:"var(--green)", accent:"var(--green)" });
    else out.push({ label:"Best Map", value:"—", sub:"Need 2+ games per map", color:"var(--t3)", accent:"var(--b3)" });

    // Worst map
    if(mapStats.length>1) out.push({ label:"Needs Work", value:mapStats[mapStats.length-1].map, sub:`${mapStats[mapStats.length-1].wins}W – ${mapStats[mapStats.length-1].losses}L`, color:"var(--red)", accent:"var(--red)" });
    else out.push({ label:"Needs Work", value:"—", sub:"Need 2+ maps tracked", color:"var(--t3)", accent:"var(--b3)" });

    // Most played map
    const allMapStats = Object.entries(mapGroups).map(([map,ms])=>{ const w=ms.filter(s=>(s.res==="win"||s.res==="W")).length; return { map, games:ms.length, wr:Math.round(w/ms.length*100) }; }).sort((a,b)=>b.games-a.games);
    if(allMapStats.length>0) out.push({ label:"Most Played Map", value:allMapStats[0].map, sub:`${allMapStats[0].games} game${allMapStats[0].games!==1?"s":""} · ${allMapStats[0].wr}% WR`, color:"var(--blue)", accent:"var(--blue)" });
    else out.push({ label:"Most Played Map", value:"—", sub:"No data yet", color:"var(--t3)", accent:"var(--b3)" });

    // Map Pool Coverage — maps with 4+ scrims count as "covered"
    const coveredMaps = allMapStats.filter(m=>m.games>=4).length;
    const totalMaps = MAPS.length;
    const coverageColor = coveredMaps<=2 ? "var(--orange)" : coveredMaps<=5 ? "var(--blue)" : "var(--green)";
    out.push({ label:"Map Pool Coverage", value:`${coveredMaps}/${totalMaps}`, sub:`${coveredMaps} map${coveredMaps!==1?"s":""} with 4+ scrims`, color:coverageColor, accent:coverageColor });

    // Avg scoreline
    const scored = allScrims.filter(s=>s.score&&s.score.includes("-"));
    if(scored.length>=2){
      const avgUs   = scored.reduce((a,s)=>a+Number(s.score.split("-")[0]),0)/scored.length;
      const avgThem = scored.reduce((a,s)=>a+Number(s.score.split("-")[1]),0)/scored.length;
      const fmt = v => Number.isInteger(v)?String(v):v.toFixed(1);
      out.push({ label:"Average Map Scoreline", value:`${fmt(avgUs)} – ${fmt(avgThem)}`, sub:`Over ${scored.length} games`, color: avgUs>avgThem?"var(--green)":"var(--red)", accent: avgUs>avgThem?"var(--green)":"var(--red)" });
    } else { out.push({ label:"Average Map Scoreline", value:"—", sub:"Need more data", color:"var(--t3)", accent:"var(--b3)" }); }

    // Review Backlog — scrims where linked VOD review_status !== "reviewed"
    const reviewedScrimIds = new Set(vods.filter(v=>v.scrim_id&&v.review_status==="reviewed").map(v=>Number(v.scrim_id)));
    const unreviewedScrims = allScrims.filter(s=>!reviewedScrimIds.has(s.id));
    const unreviewed = unreviewedScrims.length;
    const unreviewedLosses = unreviewedScrims.filter(s=>s.res==="loss"||s.res==="L").length;
    const lossSub = unreviewedLosses>0 ? ` · ${unreviewedLosses} from losses` : "";
    out.push({ label:"Review Backlog", value:`${unreviewed}`, sub:`${unreviewed} game${unreviewed!==1?"s":""} unreviewed${lossSub}`, color: unreviewed>0?"var(--orange)":"var(--green)", accent: unreviewed>0?"var(--orange)":"var(--green)", onClick:()=>setPage("vod") });

    return out;
  })();

  // ── Today / This week events ──
  const todayEvents  = events.filter(e=>e.date===todayStr);
  const weekEvents   = events.filter(e=>e.date!==todayStr);

  return (
    <div style={{ padding:"16px 24px", display:"flex", flexDirection:"column", gap:10 }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
        <div>
          <div className="bc" style={{ fontSize:28, fontWeight:900, letterSpacing:"0.04em", lineHeight:1, background:"linear-gradient(90deg, var(--t1) 60%, rgba(212,255,30,0.6))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>DASHBOARD</div>
          <div style={{ fontSize:12, marginTop:2 }}><span style={{ background:"linear-gradient(90deg, #fff 60%, rgba(212,255,30,0.8))", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>Welcome back, {user?.username || "Coach"}</span></div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-sub btn-hover-acc" onClick={()=>setPage("tracker")}>+ Manual Scrim Log</button>
          <button className="btn btn-sub btn-hover-acc" onClick={()=>setPage("vod")}>+ VOD Review</button>
          <button className="btn btn-sub btn-hover-acc" onClick={()=>setDashTaskModal(true)}>+ Create Task</button>
          <button className="btn btn-sub btn-hover-acc" onClick={()=>setDashPBModal(true)}>+ Create Strategy</button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, flexShrink:0 }}>
        {/* Win Rate card — custom with filter buttons */}
        <div style={{ animation:`fadeUp 0.3s cubic-bezier(0.4,0,0.2,1) 0ms both`, cursor:"pointer" }} onClick={()=>setPage("analysis")}>
          <div className="stat-block accent" style={{ position:"relative" }}>
            <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,var(--acc),transparent)" }}/>
            <div className="label-sm" style={{ marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ color:"var(--acc)", opacity:0.85, display:"flex", alignItems:"center" }}>{STAT_ICONS["winrate"]}</span>
                WIN RATE
              </span>
              <div style={{ display:"flex", gap:3 }} onClick={e=>e.stopPropagation()}>
                {[["all","All"],["5","Last 5"],["10","Last 10"]].map(([val,lbl])=>(
                  <button key={val} onClick={()=>setWrFilter(val)}
                    style={{ fontSize:9, fontWeight:700, padding:"2px 6px", borderRadius:4, border:`1px solid ${wrFilter===val?"var(--acc)":"var(--b2)"}`,
                      background: wrFilter===val ? "var(--acc)" : "var(--s3)",
                      color: wrFilter===val ? "#080a10" : "var(--t3)", cursor:"pointer", transition:"all 0.15s" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div className="bc" style={{ fontSize:38, fontWeight:900, color:"var(--acc)", letterSpacing:"0.02em", lineHeight:1 }}>
              {wrFiltered!==null?`${wrFiltered}%`:"—"}
            </div>
            <div style={{ fontSize:12, color:"var(--t2)", marginTop:4 }}>
              {wrFilteredScrims.length>0
                ? (wrFilter==="all"?`Overall · ${wrFilteredScrims.length} games`:wrFilter==="5"?`Last 5 · ${Math.min(allScrims.length,5)} games`:`Last 10 · ${Math.min(allScrims.length,10)} games`)
                : "No games yet"}
            </div>
          </div>
        </div>
        {[
          { label:"Games Tracked", value:allScrims.length, sub:"Overall · all time", icon:"games", onClick:()=>setPage("scrimlog") },
          { label:"Pending Tasks", value:pending, sub:"Across team", icon:"tasks", onClick:()=>setPage("tasks") },
          { label:"Upcoming",      value:events.length, sub:"Events this week", icon:"upcoming", onClick:()=>setPage("calendar") },
        ].map((s,i)=>(
          <div key={s.label} style={{ animation:`fadeUp 0.3s cubic-bezier(0.4,0,0.2,1) ${(i+1)*60}ms both`, cursor:s.onClick?"pointer":"default" }} onClick={s.onClick}>
            <StatBlock {...s} pendingTasks={s.label==="Pending Tasks" ? tasks : undefined}/>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:10, alignItems:"start" }}>

        {/* Recent Scrims */}
        <div className="card" style={{ padding:"12px 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span className="bc" style={{ fontSize:13, fontWeight:700, letterSpacing:"0.04em" }}>RECENT SCRIMS <span style={{ fontSize:10, fontWeight:400, color:"var(--t3)" }}>(last 4)</span></span>
            <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={()=>setPage("scrimlog")}>View all →</button>
          </div>
          {dashLoading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[1,2,3,4].map(i=><div key={i} style={{ height:28, background:"var(--s3)", borderRadius:4 }}/>)}
            </div>
          ) : scrims.length===0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"var(--t3)", fontSize:13 }}>No scrims tracked yet</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Date</th><th>Map</th><th>vs</th><th>Score</th><th>Result</th><th>Review</th></tr></thead>
              <tbody>
                {scrims.map(s=>{
                  const linkedVod = vods.find(v=>v.scrim_id && String(v.scrim_id)===String(s.id));
                  const noVod = !linkedVod;
                  const rs = linkedVod?.review_status || "not_reviewed";
                  const reviewStatus = noVod ? "No VOD Attached" : rs==="reviewed" ? "Reviewed" : rs==="in_progress" ? "In Progress" : "Not Reviewed";
                  const reviewColor  = noVod ? "var(--t3)" : rs==="reviewed" ? "var(--green)" : rs==="in_progress" ? "var(--orange)" : "var(--t3)";
                  const reviewBg     = noVod ? "var(--s3)" : rs==="reviewed" ? "rgba(105,240,174,0.1)" : rs==="in_progress" ? "rgba(255,171,64,0.1)" : "var(--s3)";
                  const reviewBorder = noVod ? "var(--b2)" : rs==="reviewed" ? "rgba(105,240,174,0.3)" : rs==="in_progress" ? "rgba(255,171,64,0.3)" : "var(--b2)";
                  return (
                  <tr key={s.id} style={{ cursor:"pointer" }}>
                    <td onClick={()=>setPage("scrimlog")} style={{ color:"var(--t3)", fontSize:11 }}>{s.date}</td>
                    <td onClick={()=>setPage("scrimlog")}><span className="chip chip-blue" style={{ fontSize:10 }}>{s.map}</span></td>
                    <td onClick={()=>setPage("scrimlog")} style={{ fontWeight:600, fontSize:13 }}>vs {s.opp}</td>
                    <td onClick={()=>setPage("scrimlog")} className="bc" style={{ fontSize:16, fontWeight:900, color:(s.res==="win"||s.res==="W")?"var(--green)":"var(--red)" }}>{s.score}</td>
                    <td onClick={()=>setPage("scrimlog")}><span className={`chip ${(s.res==="win"||s.res==="W")?"chip-green":"chip-red"}`} style={{ fontSize:10 }}>{(s.res==="win"||s.res==="W")?"▲ W":"▼ L"}</span></td>
                    <td>
                      <span onClick={async()=>{
                          if(linkedVod && rs==="not_reviewed") {
                            const updated = {...linkedVod, review_status:"in_progress"};
                            await api.put(`/api/vods/${linkedVod.id}`, {...updated, ts:JSON.stringify(updated.ts||[]), gen_note:updated.genNote||"", review_status:"in_progress"}).catch(()=>{});
                          }
                          if(setVodDeepLink) setVodDeepLink(s.id);
                          setPage("vod");
                        }}
                        style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, cursor:"pointer",
                          background:reviewBg, color:reviewColor, border:`1px solid ${reviewBorder}`,
                          whiteSpace:"nowrap", transition:"opacity 0.15s" }}
                        title="Go to VOD Review">
                        {reviewStatus}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column: Today/This Week + Recent Notes stacked */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Today / This Week */}
          <div className="card" style={{ padding:"12px 16px" }}>
            <div className="bc" style={{ fontSize:13, fontWeight:700, letterSpacing:"0.04em", marginBottom:8 }}>TODAY / THIS WEEK</div>
            {dashLoading ? (
              [1,2].map(i=><div key={i} style={{ height:30, background:"var(--s3)", borderRadius:"var(--r)", marginBottom:5 }}/>)
            ) : events.length===0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 6px" }}>
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter:"drop-shadow(0 0 6px rgba(212,255,30,0.7)) drop-shadow(0 0 14px rgba(212,255,30,0.35))", opacity:0.75 }}>
                    <rect x="3.5" y="7.5" width="31" height="27" rx="4.5" stroke="#d4ff1e" strokeWidth="2"/>
                    <line x1="3.5" y1="14.5" x2="34.5" y2="14.5" stroke="#d4ff1e" strokeWidth="2"/>
                    <line x1="13" y1="3.5" x2="13" y2="10.5" stroke="#d4ff1e" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="25" y1="3.5" x2="25" y2="10.5" stroke="#d4ff1e" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ color:"var(--t3)", fontSize:12 }}>Nothing scheduled.</div>
                <button className="btn btn-sub" style={{ fontSize:11, justifyContent:"flex-start" }} onClick={()=>window.open("https://pracc.com/search","_blank")}>+ Schedule a Scrim <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft:4, opacity:0.6 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>
                <button className="btn btn-sub" style={{ fontSize:11, justifyContent:"flex-start" }} onClick={()=>setPage("tasks")}>+ Add a Task</button>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                {todayEvents.length>0 && <div style={{ fontSize:9, fontWeight:700, color:"var(--acc)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:2 }}>Today</div>}
                {todayEvents.map(e=>(
                  <div key={e.id} style={{ padding:"6px 10px", borderRadius:"var(--r)", background:"var(--s2)", borderLeft:`3px solid ${e.color||"var(--acc)"}`, cursor:"pointer" }}
                    onClick={()=>setPage("calendar")}
                    onMouseOver={ev=>{ev.currentTarget.style.background="var(--s3)";}}
                    onMouseOut={ev=>{ev.currentTarget.style.background="var(--s2)";}}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{e.title}</div>
                    <div style={{ fontSize:10, color:"var(--t3)" }}>{e.time||"All day"}</div>
                  </div>
                ))}
                {weekEvents.length>0 && <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginTop:3, marginBottom:2 }}>This Week</div>}
                {weekEvents.map(e=>(
                  <div key={e.id} style={{ padding:"6px 10px", borderRadius:"var(--r)", background:"var(--s2)", borderLeft:`3px solid ${e.color||"var(--b3)"}`, cursor:"pointer" }}
                    onClick={()=>setPage("calendar")}
                    onMouseOver={ev=>{ev.currentTarget.style.background="var(--s3)";}}
                    onMouseOut={ev=>{ev.currentTarget.style.background="var(--s2)";}}>
                    <div style={{ fontSize:12, fontWeight:600 }}>{e.title}</div>
                    <div style={{ fontSize:10, color:"var(--t3)" }}>{e.date}{e.time?` · ${e.time}`:""}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Bottom row: Quick Insights left + Review & Follow-up right */}
      <div style={{ display:"flex", flexDirection:"row", gap:10, flexShrink:0, alignItems:"flex-start" }}>

        {/* Quick Insights */}
        <div className="card" style={{ padding:"10px 16px", flexShrink:0, width:480 }}>
          {/* Header with neon bolt */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <div style={{ width:26, height:26, borderRadius:5, background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <svg width="13" height="18" viewBox="0 0 13 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter:"drop-shadow(0 0 4px rgba(212,255,30,0.8))", display:"block" }}>
                <path d="M7.5 1L1 10h5.5L5 17L12 8H6.5L7.5 1Z" stroke="#d4ff1e" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
              </svg>
            </div>
            <span className="bc" style={{ fontSize:13, fontWeight:700, letterSpacing:"0.04em" }}>Quick Insights</span>
          </div>
          {dashLoading ? (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {[1,2,3,4,5,6].map(i=><div key={i} style={{ height:52, background:"var(--s3)", borderRadius:6 }}/>)}
            </div>
          ) : insights.length===0 ? (
            <div style={{ color:"var(--t3)", fontSize:12 }}>Play more games to see insights.</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:6 }}>
              {insights.map((ins,i)=>(
                <div key={i} onClick={ins.onClick} style={{ padding:"8px 10px", background:"var(--s2)", borderRadius:8, border:"1px solid var(--b2)", borderLeft:`2px solid ${ins.accent||"var(--b3)"}`, cursor:ins.onClick?"pointer":"default", transition:"background 0.15s" }}
                  onMouseOver={ev=>{ if(ins.onClick) ev.currentTarget.style.background="var(--s3)"; }}
                  onMouseOut={ev=>{ if(ins.onClick) ev.currentTarget.style.background="var(--s2)"; }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:3 }}>{ins.label}</div>
                  <div className="bc" style={{ fontSize:14, fontWeight:900, color:ins.color, lineHeight:1.1, marginBottom:2 }}>{ins.value}</div>
                  <div style={{ fontSize:9, color:"var(--t3)" }}>{ins.sub}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review & Follow-up Queue */}
        <div className="card" style={{ padding:"12px 16px", flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              <span className="bc" style={{ fontSize:13, fontWeight:700, letterSpacing:"0.04em" }}>REVIEW &amp; FOLLOW-UP</span>
            </div>
            {(() => {
              const reviewedIds = new Set(vods.filter(v=>v.scrim_id&&v.review_status==="reviewed").map(v=>Number(v.scrim_id)));
              const total = allScrims.filter(s=>!reviewedIds.has(s.id)).length
                + vods.filter(v=>v.review_status==="draft"||v.review_status==="in_progress").length
                + (Array.isArray(tasks)?tasks.filter(t=>!t.done&&new RegExp(reviewKeywords.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"i").test(t.title+(t.description||""))).length:0);
              return total > 0 ? (
                <span style={{ fontSize:10, fontWeight:700, background:"rgba(212,255,30,0.1)", color:"var(--acc)", border:"1px solid rgba(212,255,30,0.25)", borderRadius:10, padding:"2px 8px" }}>{total} pending</span>
              ) : null;
            })()}
          </div>
          {(() => {
            const reviewItems = [];

            // 1. Scrims needing review — losses first, then in-progress, then unreviewed wins
            const reviewedIds = new Set(vods.filter(v=>v.scrim_id&&v.review_status==="reviewed").map(v=>Number(v.scrim_id)));
            const inProgressIds = new Set(vods.filter(v=>v.scrim_id&&v.review_status==="in_progress").map(v=>Number(v.scrim_id)));

            allScrims.forEach(s => {
              if (reviewedIds.has(s.id)) return;
              const isLoss = s.res==="loss"||s.res==="L";
              const isInProgress = inProgressIds.has(s.id);
              const status = isInProgress ? "In Progress" : "Not Reviewed";
              const statusColor = isInProgress ? "#ffb347" : "#ff5252";
              const statusBg = isInProgress ? "rgba(255,179,71,0.1)" : "rgba(255,82,82,0.1)";
              const daysAgo = s.date ? Math.floor((Date.now()-new Date(s.date))/(1000*60*60*24)) : null;
              const dateStr = daysAgo===0?"Today":daysAgo===1?"1d ago":daysAgo!=null?`${daysAgo}d ago`:"";
              reviewItems.push({
                sortPriority: isLoss ? 0 : isInProgress ? 1 : 2,
                dateMs: s.date ? new Date(s.date).getTime() : 0,
                dismissKey: `scrim-${s.id}`,
                typeLabel: isLoss ? "Scrim review · Loss" : "Scrim review",
                typeColor: isLoss ? "#ff5252" : "var(--t3)",
                title: `${s.map||"Unknown"} vs ${s.opponent||s.opp||"?"}`,
                status, statusColor, statusBg, dateStr,
                onClick: ()=>openScrim(s.id),
                tag: isInProgress ? "Continue →" : "Review →",
                tagColor: isInProgress ? "#ffb347" : "var(--green)"
              });
            });

            // 2. VOD/review notes that are draft or in-progress
            vods.filter(v=>v.review_status==="draft"||v.review_status==="in_progress").forEach(v=>{
              const isDraft = v.review_status==="draft";
              const status = isDraft ? "Draft" : "In Progress";
              const statusColor = isDraft ? "#4fc3f7" : "#ffb347";
              const statusBg = isDraft ? "rgba(79,195,247,0.1)" : "rgba(255,179,71,0.1)";
              const daysAgo = v.created_at ? Math.floor((Date.now()-new Date(v.created_at))/(1000*60*60*24)) : null;
              const dateStr = daysAgo===0?"Today":daysAgo===1?"1d ago":daysAgo!=null?`${daysAgo}d ago`:"";
              reviewItems.push({
                sortPriority: 1,
                dateMs: v.created_at ? new Date(v.created_at).getTime() : 0,
                typeLabel: isDraft ? "VOD notes · Draft" : "VOD notes · In Progress",
                typeColor: "var(--t3)",
                title: v.title||"VOD Review",
                status, statusColor, statusBg, dateStr,
                onClick: ()=>openVod(v.scrim_id),
                tag: "Open →",
                tagColor: "#4fc3f7"
              });
            });

            // 3. Tasks flagged as review/follow-up work
            if(Array.isArray(tasks)) {
              tasks.filter(t=>!t.done).forEach(t=>{
                const isReviewTask = new RegExp(reviewKeywords.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"i").test(t.title+(t.description||""));
                if(!isReviewTask) return;
                const today = new Date(); today.setHours(0,0,0,0);
                const overdue = t.due && new Date(t.due)<today;
                const daysAgo = t.due ? Math.floor((Date.now()-new Date(t.due))/(1000*60*60*24)) : null;
                const dateStr = overdue ? `${daysAgo}d overdue` : t.due ? new Date(t.due).toLocaleDateString("en-US",{month:"numeric",day:"numeric",year:"numeric"}) : "";
                const status = overdue ? "Overdue" : t.priority || "Follow-up";
                const statusColor = overdue ? "#ff5252" : t.priority==="High" ? "#ff5252" : t.priority==="Medium" ? "#ffb347" : "#4fc3f7";
                const statusBg = overdue ? "rgba(255,82,82,0.1)" : t.priority==="High" ? "rgba(255,82,82,0.1)" : t.priority==="Medium" ? "rgba(255,179,71,0.1)" : "rgba(79,195,247,0.1)";
                reviewItems.push({
                  sortPriority: t.priority==="High"?0:t.priority==="Medium"?1:2,
                  dateMs: t.due ? new Date(t.due).getTime() : (typeof t.id==="number"?t.id:0),
                  typeLabel: `Task · ${t.priority?t.priority+" priority":"Follow-up"}`,
                  typeColor: "var(--t3)",
                  title: t.title,
                  status, statusColor, statusBg, dateStr,
                  onClick: ()=>setPage("tasks"),
                  tag: "Open →",
                  tagColor: "#ffb347"
                });
              });
            }

            // Sort: priority bucket first, then most recent within bucket
            reviewItems.sort((a,b)=> a.sortPriority!==b.sortPriority ? a.sortPriority-b.sortPriority : b.dateMs-a.dateMs);
            const visibleItems = reviewItems.filter(item => !item.dismissKey || !dismissedReviews.has(item.dismissKey));

            if(visibleItems.length===0) return (
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", color:"var(--t3)", fontSize:12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                All caught up — no pending reviews or follow-ups.
              </div>
            );

            return (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {visibleItems.slice(0,6).map((item,i)=>(
                  <div key={i}
                    style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 12px", borderRadius:7, background:"var(--s2)", border:"1px solid var(--b2)", cursor:"pointer", transition:"background 0.15s" }}
                    onClick={item.onClick}
                    onMouseOver={ev=>ev.currentTarget.style.background="var(--s3)"}
                    onMouseOut={ev=>ev.currentTarget.style.background="var(--s2)"}>

                    {/* Title + context type */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{item.title}</div>
                      <div style={{ fontSize:10, color:item.typeColor||"var(--t3)" }}>{item.typeLabel}</div>
                    </div>

                    {/* Status badge */}
                    <span style={{ fontSize:10, fontWeight:700, color:item.statusColor, background:item.statusBg, border:`1px solid ${item.statusColor}40`, borderRadius:5, padding:"2px 8px", whiteSpace:"nowrap", flexShrink:0 }}>{item.status}</span>

                    {/* Date */}
                    <span style={{ fontSize:10, color:"var(--t3)", flexShrink:0, minWidth:50, textAlign:"right" }}>{item.dateStr}</span>

                    {/* Action link */}
                    <span style={{ fontSize:10, fontWeight:700, color:item.tagColor, flexShrink:0, whiteSpace:"nowrap" }}>{item.tag}</span>

                    {/* Dismiss */}
                    {item.dismissKey && (
                      <span onClick={e=>{ e.stopPropagation(); dismissReview(item.dismissKey); }}
                        style={{ fontSize:12, color:"var(--t3)", padding:"2px 5px", borderRadius:4, flexShrink:0, cursor:"pointer", lineHeight:1 }}
                        onMouseOver={ev=>ev.currentTarget.style.color="var(--red)"}
                        onMouseOut={ev=>ev.currentTarget.style.color="var(--t3)"}>✕</span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

      </div>

      {/* ── Dashboard: Quick Create Task Modal ── */}
      {dashTaskModal && (
        <div className="modal-backdrop" onClick={()=>setDashTaskModal(false)}>
          <div className="modal" style={{ maxWidth:480 }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <span className="bc" style={{ fontSize:22, fontWeight:700, letterSpacing:"0.03em" }}>New Task</span>
              <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:16 }} onClick={()=>setDashTaskModal(false)}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Assigned To</div>
                <select value={dashTaskForm.assignedTo} onChange={e=>setDashTaskForm(f=>({...f,assignedTo:e.target.value}))}>
                  <option value="">— Select Team Member —</option>
                  <option value="team">Whole Team</option>
                  {dashPlayers.length>0 && <option disabled>── Players ──</option>}
                  {dashPlayers.map(p=><option key={`p-${p.id}`} value={p.id}>{p.name}{p.role?` · ${p.role}`:""}</option>)}
                  {dashStaff.length>0 && <option disabled>── Staff ──</option>}
                  {dashStaff.map(u=><option key={`u-${u.id}`} value={`user-${u.id}`}>{u.username} · {u.role==="admin"?"Coach/Admin":u.role}</option>)}
                </select>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Title</div>
                <input type="text" value={dashTaskForm.title} onChange={e=>setDashTaskForm(f=>({...f,title:e.target.value}))} placeholder="Task title"/>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Description</div>
                <textarea rows={3} style={{ resize:"none" }} value={dashTaskForm.description} onChange={e=>setDashTaskForm(f=>({...f,description:e.target.value}))}/>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Due Date</div>
                <input type="date" value={dashTaskForm.due} onChange={e=>setDashTaskForm(f=>({...f,due:e.target.value}))}/>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Priority</div>
                <div style={{ display:"flex", gap:8 }}>
                  {["Low","Medium","High"].map(p=>(
                    <button key={p} onClick={()=>setDashTaskForm(f=>({...f,priority:f.priority===p?"":p}))}
                      style={{ flex:1, padding:"6px 0", borderRadius:6, fontWeight:700, fontSize:12, cursor:"pointer", border:`1px solid ${dashTaskForm.priority===p?(p==="High"?"#ff5555":p==="Medium"?"#ffb347":"#69f0ae"):"var(--b2)"}`, background:dashTaskForm.priority===p?(p==="High"?"rgba(255,85,85,0.15)":p==="Medium"?"rgba(255,179,71,0.15)":"rgba(105,240,174,0.15)"):"var(--s3)", color:dashTaskForm.priority===p?(p==="High"?"#ff5555":p==="Medium"?"#ffb347":"#69f0ae"):"var(--t2)", transition:"all 0.15s" }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button className="btn btn-ghost" onClick={()=>setDashTaskModal(false)}>Cancel</button>
                <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }}
                  disabled={!dashTaskForm.title.trim()||!dashTaskForm.assignedTo||dashTaskSaving}
                  onClick={async()=>{
                    setDashTaskSaving(true);
                    const newTask = await api.post("/api/tasks",{ title:dashTaskForm.title, description:dashTaskForm.description, due:dashTaskForm.due, assignedTo:dashTaskForm.assignedTo, player_id:Number(dashTaskForm.assignedTo), priority:dashTaskForm.priority, labels:JSON.stringify([]) }).catch(()=>null);
                    setDashTaskSaving(false);
                    setDashTaskModal(false);
                    setDashTaskForm({ title:"", description:"", due:"", assignedTo:"", priority:"" });
                    if(newTask?.id){
                      invalidate(`/api/tasks`);
                      api.get(`/api/tasks?t=${Date.now()}`).then(d=>{
                        if(Array.isArray(d)){ const incomplete=d.filter(t=>!t.done); setTasks(incomplete); setPending(incomplete.length); }
                      }).catch(()=>{});
                    }
                  }}>
                  {dashTaskSaving?"Saving…":"Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard: Quick Create Strategy Modal ── */}
      {dashPBModal && (()=>{
        const allAgentNames = AGENTS.map(a=>a.name).sort();
        const setAgent = (i, val) => setDashPBForm(f=>{ const ags=[...f.agents]; ags[i]=val; return {...f,agents:ags}; });
        const createPB = async () => {
          if(!dashPBForm.name.trim()||!dashPBForm.map) return;
          setDashPBSaving(true);
          const agList = dashPBForm.agents.filter(Boolean);
          const res = await api.post("/api/strats",{ name:dashPBForm.name, map:dashPBForm.map, cat:"Composition", agents:JSON.stringify(agList), side:"atk", description:"", status:dashPBForm.status }).catch(()=>null);
          setDashPBSaving(false);
          setDashPBModal(false);
          setDashPBForm({ name:"", map:"", agents:["","","","",""], status:"Active" });
          if(res?.id){ setPage("strategy"); navigate(`/strategy/${res.id}`); } else { setPage("strategy"); }
        };
        return (
          <div className="modal-backdrop" onClick={()=>setDashPBModal(false)}>
            <div className="modal" style={{ maxWidth:560 }} onClick={e=>e.stopPropagation()}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <span className="bc" style={{ fontSize:22, fontWeight:700, letterSpacing:"0.03em" }}>New Playbook</span>
                <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:16 }} onClick={()=>setDashPBModal(false)}>✕</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div>
                  <div className="label-sm" style={{ marginBottom:6 }}>Playbook Name *</div>
                  <input type="text" value={dashPBForm.name} onChange={e=>setDashPBForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Haven Double Duelist"/>
                </div>
                <div>
                  <div className="label-sm" style={{ marginBottom:6 }}>Map *</div>
                  <select value={dashPBForm.map} onChange={e=>setDashPBForm(f=>({...f,map:e.target.value}))}>
                    <option value="">Select a map…</option>
                    {MAPS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label-sm" style={{ marginBottom:8 }}>Composition — Pick 5 Agents</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                    {[0,1,2,3,4].map(i=>(
                      <div key={i} style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"center" }}>
                        {dashPBForm.agents[i] && AGENT_ICONS[dashPBForm.agents[i]]
                          ? <img src={AGENT_ICONS[dashPBForm.agents[i]]} alt={dashPBForm.agents[i]} style={{ width:40, height:40, borderRadius:8, objectFit:"cover", border:"2px solid var(--acc)" }}/>
                          : <div style={{ width:40, height:40, borderRadius:8, background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"var(--t3)" }}>?</div>
                        }
                        <select value={dashPBForm.agents[i]} onChange={e=>setAgent(i,e.target.value)} style={{ fontSize:10, padding:"3px 2px", textAlign:"center", width:"100%" }}>
                          <option value="">…</option>
                          {allAgentNames.map(a=><option key={a}>{a}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label-sm" style={{ marginBottom:8 }}>Status</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {["Active","In Progress","In Theory","Archived"].map(s=>(
                      <button key={s} onClick={()=>setDashPBForm(f=>({...f,status:s}))}
                        style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                          border:`1px solid ${STATUS_COLORS[s]?.border||"var(--b2)"}`,
                          background: dashPBForm.status===s ? (STATUS_COLORS[s]?.bg||"var(--s3)") : "transparent",
                          color: dashPBForm.status===s ? (STATUS_COLORS[s]?.color||"var(--t1)") : "var(--t3)", transition:"all 0.15s" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:4 }}>
                  <button className="btn btn-ghost" onClick={()=>setDashPBModal(false)}>Cancel</button>
                  <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }}
                    disabled={!dashPBForm.name.trim()||!dashPBForm.map||dashPBSaving}
                    onClick={createPB}>
                    {dashPBSaving?"Saving…":"Create Playbook"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

/* ════ LIVE TRACKER ════ */
function LiveTracker({ players, setPage }) {
  const [phase, setPhase]   = useState("setup");
  const [map, setMap]       = useState("Ascent");
  const [opp, setOpp]       = useState("");
  const [comp, setComp]     = useState([]);
  const [rounds, setRounds] = useState([]);
  const [eco, setEco]       = useState("Full Buy");
  const [strat, setStrat]   = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = React.useRef(false);

  useEffect(() => {
    api.get("/api/scrims").then(scrims => {
      if (!Array.isArray(scrims) || scrims.length === 0) return;
      const last = scrims[0];
      if (last.map) setMap(last.map);
    }).catch(() => {});
  }, []);

  const score = { us:rounds.filter(r=>r.res==="w").length, them:rounds.filter(r=>r.res==="l").length };

  // Auto-detect pistol rounds (round 1 and round 13)
  const nextRound = rounds.length + 1;
  const isPistolRound = nextRound === 1 || nextRound === 13;

  useEffect(() => {
    const n = rounds.length + 1;
    if (n === 1 || n === 13) setEco("Pistol");
    else if (n === 2 || n === 14) setEco("Full Buy"); // reset after pistol
  }, [rounds.length]);

  const logRound = res => { if(rounds.length>=24) return; setRounds(p=>[...p, { res, eco, strat, n:p.length+1 }]); };

  const endGame = () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const us = rounds.filter(r=>r.res==="w").length;
    const them = rounds.filter(r=>r.res==="l").length;
    const result = us > them ? "win" : "loss";
    api.post("/api/scrims", {
      date: new Date().toISOString().slice(0,10),
      map, opp,
      comp: JSON.stringify(comp),
      score: `${us}-${them}`,
      res: result,
      rounds: JSON.stringify(rounds.map(r=>({ res:r.res, eco:r.eco||"" })))
    }).finally(()=>{ savingRef.current = false; setSaving(false); setPhase("setup"); setRounds([]); });
  };

  if(phase==="setup") return (
    <div style={{ padding:"28px 32px", maxWidth:640 }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>LIVE TRACKER</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:28 }}>Configure a new game to start tracking</div>
      <div className="card" style={{ maxWidth:520 }}>
        <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:20 }}>New Game Setup</div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Map</div>
            <select value={map} onChange={e=>setMap(e.target.value)}>{MAPS.map(m=><option key={m}>{m}</option>)}</select>
          </div>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Opponent</div>
            <input type="text" placeholder="Team name..." value={opp} onChange={e=>setOpp(e.target.value)}/>
          </div>
          <div>
            <div className="label-sm" style={{ marginBottom:8 }}>Composition — {comp.length}/5</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {AGENTS.map(ag=>{ const sel=comp.includes(ag.name); return (
                <button key={ag.name} onClick={()=>{ if(sel) setComp(p=>p.filter(a=>a!==ag.name)); else if(comp.length<5) setComp(p=>[...p,ag.name]); }}
                  style={{ padding:"5px 11px", borderRadius:"var(--r)", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                    background:sel?ag.bg:"var(--s3)", color:sel?ag.color:"var(--t3)", border:`1px solid ${sel?ag.color+"44":"var(--b2)"}` }}>
                  {ag.name}
                </button>
              ); })}
            </div>
            <div style={{ display:"flex", gap:6, marginTop:10 }}>
              {comp.map((a,i)=><AgentBadge key={i} name={a} size={36}/>)}
              {Array(5-comp.length).fill(null).map((_,i)=><div key={i} style={{ width:36, height:36, border:"1px dashed var(--b2)", borderRadius:"var(--r)" }}/>)}
            </div>
          </div>
          <button className="btn btn-acc" style={{ justifyContent:"center", padding:"12px", marginTop:4 }}
            onClick={()=>comp.length===5&&opp.trim()&&setPhase("active")}>
            Start Tracking →
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}><div className="ldot"/><span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--acc)" }}>LIVE</span></div>
          <div className="bc" style={{ fontSize:30, fontWeight:900, letterSpacing:"0.04em" }}>{map} — vs {opp}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost" onClick={()=>setPage("ocr")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            OCR Stats
          </button>
          <button className="btn btn-red" onClick={endGame} disabled={saving}>{saving?"Saving...":"End & Save Game"}</button>
        </div>
      </div>
      <div className="card" style={{ textAlign:"center", marginBottom:18, background:"var(--s2)", border:"1px solid var(--b2)" }}>
        <div className="label-sm" style={{ marginBottom:8 }}>HALF {rounds.length>=12?2:1} · ROUND {rounds.length+1}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:40, alignItems:"flex-end" }}>
          <div><div className="bc" style={{ fontSize:80, fontWeight:900, color:"var(--green)", lineHeight:1 }}>{score.us}</div><div style={{ fontSize:12, fontWeight:700, color:"var(--green)", letterSpacing:"0.08em" }}>OUR TEAM</div></div>
          <div style={{ fontSize:30, color:"var(--t3)", paddingBottom:12 }}>:</div>
          <div><div className="bc" style={{ fontSize:80, fontWeight:900, color:"var(--red)", lineHeight:1 }}>{score.them}</div><div style={{ fontSize:12, fontWeight:700, color:"var(--red)", letterSpacing:"0.08em" }}>{opp.toUpperCase()}</div></div>
        </div>
      </div>
      <div className="card" style={{ marginBottom:16 }}>
        <div className="label-sm" style={{ marginBottom:8 }}>ROUND HISTORY</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {rounds.map((r,i)=><div key={i} className={`pip pip-${r.res}`}>{i+1}</div>)}
          {Array(Math.max(0,24-rounds.length)).fill(null).map((_,i)=><div key={`e${i}`} className="pip pip-e">{rounds.length+i+1}</div>)}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
        <div className="card">
          <div className="label-sm" style={{ marginBottom:8 }}>ECONOMY</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {ECO_STATES.map(e=>(
              <button key={e} onClick={()=>setEco(e)} style={{ padding:"5px 11px", borderRadius:5, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                background:eco===e?"rgba(212,255,30,0.12)":"var(--s3)", color:eco===e?"var(--acc)":"var(--t3)",
                border:`1px solid ${eco===e?"rgba(212,255,30,0.3)":"var(--b2)"}`, opacity:eco===e?1:0.7 }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="label-sm" style={{ marginBottom:8 }}>STRATEGY</div>
          <select value={strat} onChange={e=>setStrat(e.target.value)}>
            <option value="">— None —</option>
          </select>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
        <button onClick={()=>logRound("w")} style={{ padding:"32px", borderRadius:12, cursor:"pointer", transition:"all 0.15s",
          background:"rgba(105,240,174,0.07)", color:"var(--green)", border:"2px solid rgba(105,240,174,0.2)",
          fontFamily:"'DIN Next LT Pro'", fontSize:22, fontWeight:900, letterSpacing:"0.1em" }}>▲ ROUND WIN</button>
        <button onClick={()=>logRound("l")} style={{ padding:"32px", borderRadius:12, cursor:"pointer", transition:"all 0.15s",
          background:"rgba(255,82,82,0.07)", color:"var(--red)", border:"2px solid rgba(255,82,82,0.2)",
          fontFamily:"'DIN Next LT Pro'", fontSize:22, fontWeight:900, letterSpacing:"0.1em" }}>▼ ROUND LOSS</button>
      </div>
    </div>
  );
}

/* ════ OSR (Open Soup Rating) ════ */
function osrWinProb(atkAlive, defAlive, spikePlanted, killerIsAtk) {
  const no = {"5v5":0.4951,"5v4":0.7097,"4v4":0.5052,"4v5":0.2999,"4v3":0.7321,"3v3":0.4901,"3v2":0.7458,"2v2":0.4489,"1v2":0.132,"1v1":0.3842,"3v5":0.1255,"2v5":0.032,"1v5":0.0024,"1v4":0.0103,"1v3":0.0406,"3v4":0.2703,"4v2":0.9088,"4v1":0.9848,"2v4":0.0903,"2v3":0.2147,"5v3":0.8784,"3v1":0.9327,"2v1":0.7623,"5v2":0.9693,"5v1":0.9932,"5v0":1,"4v0":1,"3v0":1,"2v0":1,"0v5":0,"0v4":0,"0v3":0,"0v2":0,"0v1":0,"1v0":1};
  const sp = {"4v5":0.3984,"3v5":0.1911,"3v4":0.3615,"3v3":0.6062,"3v2":0.8441,"3v1":0.9746,"5v5":0.6375,"5v4":0.8166,"5v3":0.9366,"4v3":0.8206,"4v2":0.9504,"2v2":0.5994,"2v1":0.8849,"1v1":0.5979,"1v2":0.2495,"4v4":0.621,"2v4":0.1354,"2v3":0.3242,"4v1":0.9946,"1v4":0.0255,"1v3":0.0785,"5v2":0.9868,"5v1":0.9979,"2v5":0.0487,"1v5":0.0109,"5v0":1,"4v0":1,"3v0":1,"2v0":1,"0v5":0,"0v4":0,"0v3":0,"0v2":0,"0v1":0,"1v0":1};
  const key = `${atkAlive}v${defAlive}`, inv = `${defAlive}v${atkAlive}`;
  if (killerIsAtk) return spikePlanted ? (sp[key]??0.5) : (no[key]??0.5);
  return 1 - (spikePlanted ? (sp[inv]??0.5) : (no[inv]??0.5));
}
function osrEconMod(kLv, vLv) {
  const cats = (v) => v<=1500?"Save":v<=4000?"Eco":v<=7500?"Force":v<=10000?"Anti":v<=15000?"Full":"Op";
  const tbl = {"Save_Save":0.5,"Eco_Eco":0.5,"Full_Full":0.5,"Op_Op":0.5,"Force_Force":0.5,"Anti_Anti":0.5,"Full_Eco":0.6392,"Eco_Full":0.3608,"Anti_Eco":0.636,"Eco_Anti":0.364,"Anti_Save":0.7341,"Save_Anti":0.2659,"Op_Anti":0.5692,"Anti_Op":0.4308,"Op_Force":0.6237,"Force_Op":0.3763,"Full_Force":0.6143,"Force_Full":0.3857,"Anti_Full":0.4475,"Full_Anti":0.5525,"Op_Full":0.5164,"Full_Op":0.4836,"Full_Save":0.7354,"Save_Full":0.2646,"Force_Save":0.6653,"Save_Force":0.3347,"Op_Save":0.7401,"Save_Op":0.2599,"Op_Eco":0.6342,"Eco_Op":0.3658,"Force_Eco":0.5655,"Eco_Force":0.4345,"Force_Anti":0.5696,"Anti_Force":0.4304,"Eco_Save":0.5189,"Save_Eco":0.481};
  const wr = tbl[`${cats(kLv)}_${cats(vLv)}`] ?? 0.5;
  return 2 * (1 - wr);
}
function osrFinalize(netImpact, assists, rp, adra) {
  const N = {KC:{m:2.916,s:3.613773},AP:{m:0.281847,s:0.517299},AD:{m:66.120653,s:69.759798},fi:{m:1.0353714155416436,s:0.08979020976963815,b:1.0,sc:0.56}};
  const W = {KC:0.4314,DC:0.4314,AP:0.0520,AD:0.0851};
  const netNorm = (netImpact - (N.KC.m + (-2.916))) / N.KC.s;
  const aprNorm = ((assists/rp) - N.AP.m) / N.AP.s;
  const adrNorm = adra != null ? ((adra - N.AD.m) / N.AD.s) : 0;
  const ws = (W.KC + W.DC) * (netNorm / 2) + W.AP * aprNorm + W.AD * adrNorm;
  const pre = N.fi.b + N.fi.sc * ws;
  return Math.round(((pre - N.fi.m) / N.fi.s) * 100) / 100;
}
function osrAtkTeam(rounds, players) {
  for (const r of rounds.slice(0,12)) {
    if (r.bombPlanter) { const p = players.find(pl=>pl.subject===r.bombPlanter); if(p) return p.teamId; }
  }
  return "Blue";
}
function calculateOSR(rawJson) {
  if (!rawJson?.players || !rawJson?.roundResults) return {};
  const { players, roundResults } = rawJson;
  const atkTeamH1 = osrAtkTeam(roundResults, players);
  const kc={}, dc={}, dmg={}, assists={}, rp={};
  players.forEach(p => { kc[p.subject]=0; dc[p.subject]=0; dmg[p.subject]=0; assists[p.subject]=p.stats?.assists||0; rp[p.subject]=p.stats?.roundsPlayed||1; });
  roundResults.forEach(r => { r.playerStats?.forEach(ps => { (ps.damage||[]).forEach(d => { dmg[ps.subject]=(dmg[ps.subject]||0)+(d.damage||0); }); }); });
  const exDmg={};
  players.forEach(p => { exDmg[p.subject]=0; });
  roundResults.forEach((r,idx) => {
    const planted = 'plantRoundTime' in r;
    const atk = idx<12 ? atkTeamH1 : (atkTeamH1==="Blue"?"Red":"Blue");
    const kills=[];
    r.playerStats?.forEach(ps => { (ps.kills||[]).forEach(k => kills.push({ killer:k.killer??ps.subject, victim:k.victim, time:k.timeSinceRoundStartMillis??k.roundTime??0, kLv:r.playerStats?.find(x=>x.subject===(k.killer??ps.subject))?.economy?.loadoutValue||0, vLv:r.playerStats?.find(x=>x.subject===k.victim)?.economy?.loadoutValue||0, vArmor:r.playerStats?.find(x=>x.subject===k.victim)?.economy?.armor||"" })); });
    kills.sort((a,b)=>a.time-b.time);
    const dead=new Set();
    const team=s=>players.find(p=>p.subject===s)?.teamId||null;
    const alive=t=>players.filter(p=>p.teamId===t&&!dead.has(p.subject)).length;
    for (const k of kills) {
      const kt=team(k.killer), vt=team(k.victim);
      if (!kt||!vt||kt===vt){dead.add(k.victim);continue;}
      const kIsAtk=kt===atk;
      const pb=osrWinProb(alive(atk),alive(kIsAtk?vt:kt),planted,kIsAtk);
      dead.add(k.victim);
      const pa=osrWinProb(alive(atk),alive(kIsAtk?vt:kt),planted,kIsAtk);
      const em=osrEconMod(k.kLv,k.vLv);
      if(kc[k.killer]!==undefined) kc[k.killer]+=(pa-pb)*em;
      const vIsAtk=vt===atk;
      const pbv=osrWinProb(alive(atk),alive(vIsAtk?kt:vt),planted,vIsAtk);
      const pav=osrWinProb(alive(atk),alive(vIsAtk?kt:vt),planted,vIsAtk);
      if(dc[k.victim]!==undefined) dc[k.victim]-=Math.abs((pav-pbv)*osrEconMod(k.vLv,k.kLv));
      const av=k.vArmor==="Heavy"?50:(k.vArmor==="Light"||k.vArmor==="Regen")?25:0;
      exDmg[k.killer]=(exDmg[k.killer]||0)+100+av;
    }
  });
  const ratings={};
  players.forEach(p => {
    const s=p.subject, r=rp[s]||1;
    const adra=Math.max(0,((dmg[s]||0)-(exDmg[s]||0))/r);
    ratings[s]=osrFinalize((kc[s]||0)+(dc[s]||0),assists[s]||0,r,adra);
  });
  return ratings;
}
function calculateOSRFromStored(roundDetail, playerStats) {
  if (!roundDetail?.length || !playerStats?.length) return {};
  const players = playerStats.map(p=>({subject:p.puuid, teamId:p.side==="blue"?"Blue":"Red", assists:p.assists||0, rp:p.roundsPlayed||1, name:p.name}));
  const kc={}, dc={}, assists={}, rp={};
  players.forEach(p=>{kc[p.subject]=0;dc[p.subject]=0;assists[p.subject]=p.assists;rp[p.subject]=p.rp;});
  const h1Plant=roundDetail.slice(0,12).find(r=>r.planterTeam);
  const atkTeamH1=h1Plant?.planterTeam||"Blue";
  // Build lookup maps — by puuid AND by name for fallback
  const puuidToTeam={}, nameToTeam={}, nameToSubject={}, puuidToSubject={};
  players.forEach(p=>{
    if(p.subject){puuidToTeam[p.subject]=p.teamId; puuidToSubject[p.subject]=p.subject;}
    if(p.name){nameToTeam[p.name]=p.teamId; nameToSubject[p.name]=p.subject;}
  });
  const getTeam=(puuid,name)=>puuidToTeam[puuid]||nameToTeam[name]||null;
  const getSubj=(puuid,name)=>puuidToSubject[puuid]||nameToSubject[name]||null;

  roundDetail.forEach((rd,idx)=>{
    const planted=rd.planted||false;
    const atk=idx<12?atkTeamH1:(atkTeamH1==="Blue"?"Red":"Blue");
    const def=atk==="Blue"?"Red":"Blue";
    const kills=(rd.kills||[]).slice().sort((a,b)=>(a.time||0)-(b.time||0));
    const dead=new Set();
    const alive=t=>players.filter(p=>p.teamId===t&&!dead.has(p.subject)).length;
    for (const k of kills) {
      const kt=getTeam(k.killerPuuid,k.killerName), vt=getTeam(k.victimPuuid,k.victimName);
      const kp=getSubj(k.killerPuuid,k.killerName), vp=getSubj(k.victimPuuid,k.victimName);
      if (!kt||!vt||kt===vt){ if(vp) dead.add(vp); continue; }
      const kIsAtk=kt===atk;
      // state BEFORE kill
      const atkBefore=alive(atk), defBefore=alive(def);
      const pb=osrWinProb(atkBefore,defBefore,planted,kIsAtk);
      // apply kill
      if(vp) dead.add(vp);
      // state AFTER kill
      const atkAfter=alive(atk), defAfter=alive(def);
      const pa=osrWinProb(atkAfter,defAfter,planted,kIsAtk);
      const kLv=rd.playerEcon?.[kp]?.loadoutValue||0, vLv=rd.playerEcon?.[vp]?.loadoutValue||0;
      const em=(kLv||vLv)?osrEconMod(kLv,vLv):1.0;
      if(kp&&kc[kp]!==undefined) kc[kp]+=(pa-pb)*em;
      // death contrib — from victim's perspective (atk prob changes)
      const vIsAtk=vt===atk;
      const pbv=osrWinProb(atkBefore,defBefore,planted,vIsAtk);
      const pav=osrWinProb(atkAfter,defAfter,planted,vIsAtk);
      if(vp&&dc[vp]!==undefined) dc[vp]-=Math.abs((pav-pbv)*((kLv||vLv)?osrEconMod(vLv,kLv):1.0));
    }
  });
  const ratings={};
  players.forEach(p=>{
    const val=osrFinalize((kc[p.subject]||0)+(dc[p.subject]||0),assists[p.subject]||0,rp[p.subject]||1,null);
    if(p.subject) ratings[p.subject]=val;
    if(p.name) ratings[p.name]=val;
  });
  return ratings;
}

/* ════ SCRIM LOG ════ */
// ── Stat helpers for raw Riot JSON ──────────────────────────────────────────
function parseRiotStats(rawJson, myTeamId) {
  if (!rawJson || !rawJson.players) return null;
  const { players, roundResults, teams, matchInfo, kills: killsTop } = rawJson;

  // Build puuid → player map
  const pMap = {};
  players.forEach(p => { pMap[p.subject] = p; });

  // Per-player accumulators
  const acc = {};
  players.forEach(p => {
    acc[p.subject] = {
      totalDamage: 0, headshots: 0, bodyshots: 0, legshots: 0,
      tfk: 0, tfd: 0, plants: 0, defuses: 0,
    };
  });

  // Round-level tracking
  const roundDetail = [];
  roundResults.forEach((r, idx) => {
    // damage / hs
    r.playerStats.forEach(ps => {
      const a = acc[ps.subject];
      if (!a) return;
      (ps.damage || []).forEach(d => {
        a.totalDamage += d.damage;
        a.headshots   += d.headshots;
        a.bodyshots   += d.bodyshots;
        a.legshots    += d.legshots;
      });
    });

    // TFK / TFD + build kill feed per round
    const roundKills = [];
    r.playerStats.forEach(ps => {
      (ps.kills || []).forEach(k => {
        const killerP = pMap[ps.subject];
        const victimP = pMap[k.victim];
        const killerLoc = (k.playerLocations||[]).find(pl=>pl.subject===ps.subject)?.location||null;
        roundKills.push({
          time:           k.roundTime,
          killerPuuid:    ps.subject,
          killerName:     killerP ? `${killerP.gameName}#${killerP.tagLine}` : "?",
          killerTeam:     killerP?.teamId || "?",
          killerLocation: killerLoc,
          victimPuuid:    k.victim,
          victimName:     victimP ? `${victimP.gameName}#${victimP.tagLine}` : "?",
          victimTeam:     victimP?.teamId || "?",
          victimLocation: k.victimLocation || null,
          weapon:         k.finishingDamage?.damageItem || null,
          assistants:     (k.assistants || []).map(aid => {
            const ap = pMap[aid];
            return ap ? `${ap.gameName}#${ap.tagLine}` : aid;
          }),
        });
      });
    });
    roundKills.sort((a, b) => a.time - b.time);
    if (roundKills.length > 0) {
      const fb = roundKills[0];
      const fbKillerSubj = Object.keys(pMap).find(id=>`${pMap[id].gameName}#${pMap[id].tagLine}`===fb.killerName);
      const fbVictimSubj = Object.keys(pMap).find(id=>`${pMap[id].gameName}#${pMap[id].tagLine}`===fb.victimName);
      if (fbKillerSubj && acc[fbKillerSubj]) acc[fbKillerSubj].tfk += 1;
      if (fbVictimSubj && acc[fbVictimSubj]) acc[fbVictimSubj].tfd += 1;
    }

    // Plants / defuses
    if (r.bombPlanter && acc[r.bombPlanter]) acc[r.bombPlanter].plants += 1;

    const fbKill = roundKills[0] || null;
    const lastKillTime = roundKills.length > 0 ? roundKills[roundKills.length - 1].time : null;
    const plantRoundTime = r.plantRoundTime ?? null;
    const isPostPlant = !!r.bombPlanter && plantRoundTime !== null && (lastKillTime === null || plantRoundTime < lastKillTime);
    const planterTeam = r.bombPlanter ? (pMap[r.bombPlanter]?.teamId || null) : null;
    const winnerIsOurs = r.winningTeam === myTeamId;
    const dead = new Set(roundKills.map(k => k.victimPuuid));
    const redAlive  = players.filter(p => p.teamId === "Red"  && !dead.has(p.subject)).length;
    const blueAlive = players.filter(p => p.teamId === "Blue" && !dead.has(p.subject)).length;
    const xvy = `${redAlive}v${blueAlive}`;

    // Economy: avg loadout for our team vs theirs
    const econMap = {};
    (r.playerEconomies || r.playerStats?.map(ps=>({subject:ps.subject,...(ps.economy||{})})) || []).forEach(e => {
      econMap[e.subject] = e.loadoutValue || 0;
    });
    const ourPlayers   = players.filter(p => p.teamId === myTeamId);
    const theirPlayers = players.filter(p => p.teamId !== myTeamId);
    const avg = (arr) => arr.length ? Math.round(arr.reduce((s,p)=>s+(econMap[p.subject]||0),0)/arr.length) : 0;
    const ourAvgLoad   = avg(ourPlayers);
    const theirAvgLoad = avg(theirPlayers);
    const getEcoLabel = (val, roundIdx) => {
      if (roundIdx === 0 || roundIdx === 12) return "Pistol";
      if (val <= 2000) return "Eco";
      if (val <= 10000) return "Half";
      return "Full";
    };
    const ourEcoLabel   = getEcoLabel(ourAvgLoad, idx);
    const theirEcoLabel = getEcoLabel(theirAvgLoad, idx);
    const roundType = (() => {
      if (idx === 0 || idx === 12) return "Pistol";
      if (ourAvgLoad > 15000 && theirAvgLoad <= 5000) return "Anti-eco";
      if (ourAvgLoad <= 5000 && theirAvgLoad > 15000) return "Eco";
      return null;
    })();

    roundDetail.push({
      roundNum:    idx + 1,
      winner:      r.winningTeam,
      winnerIsOurs,
      site:        r.plantSite || null,
      outcome:     r.roundResultCode,
      planted:     !!r.bombPlanter,
      planterTeam,
      isPostPlant,
      xvy,
      firstBlood:  fbKill ? { killerName:fbKill.killerName, killerTeam:fbKill.killerTeam, victimName:fbKill.victimName, victimTeam:fbKill.victimTeam } : null,
      kills:       roundKills,
      ourAvgLoad, theirAvgLoad, ourEcoLabel, theirEcoLabel, roundType,
      playerEcon:  Object.fromEntries((r.playerStats||[]).map(ps=>[ps.subject,{loadoutValue:ps.economy?.loadoutValue||0,armor:ps.economy?.armor||""}])),
    });
  });

  // Build final player objects
  const AGENT_ICONS = {
    "Astra":"/assets/agents/Astra.png","Breach":"/assets/agents/Breach.png",
    "Brimstone":"/assets/agents/Brimstone.png","Chamber":"/assets/agents/Chamber.png",
    "Clove":"/assets/agents/Clove.png","Cypher":"/assets/agents/Cypher.png",
    "Deadlock":"/assets/agents/Deadlock .png","Fade":"/assets/agents/Fade.png",
    "Gekko":"/assets/agents/Gekko.png","Harbor":"/assets/agents/Harbor.png",
    "Iso":"/assets/agents/Iso.png","Jett":"/assets/agents/Jett.png",
    "KAY/O":"/assets/agents/KAYO.png","Killjoy":"/assets/agents/Killjoy.png",
    "Neon":"/assets/agents/Neon.png","Omen":"/assets/agents/Omen.png",
    "Phoenix":"/assets/agents/Phoenix.png","Raze":"/assets/agents/Raze.png",
    "Reyna":"/assets/agents/Reyna.png","Sage":"/assets/agents/Sage.png",
    "Skye":"/assets/agents/Skye.png","Sova":"/assets/agents/Sova.png",
    "Tejo":"/assets/agents/Tejo.png","Veto":"/assets/agents/Veto.png",
    "Viper":"/assets/agents/Viper.png","Vyse":"/assets/agents/Vyse.png",
    "Waylay":"/assets/agents/Waylay.png","Yoru":"/assets/agents/Yoru.png",
    "Miks":"/assets/agents/Miks.png",
  };

  const CHAR_MAP = {
    "41fb69c1":"Astra",    "5f8d3a7f":"Breach",   "9f0d8ba9":"Brimstone", "22697a3d":"Chamber",
    "1dbf2edd":"Clove",    "117ed9e3":"Cypher",   "cc8b64c8":"Deadlock",  "dade69b4":"Fade",
    "e370fa57":"Gekko",    "95b78ed7":"Harbor",   "0e38b510":"Iso",       "add6443a":"Jett",
    "601dbbe7":"KAY/O",    "1e58de9c":"Killjoy",  "7c8a4701":"Miks",      "bb2a4828":"Neon",
    "8e253930":"Omen",     "eb93336a":"Phoenix",  "f94c3b30":"Raze",      "a3bfb853":"Reyna",
    "569fdd95":"Sage",     "6f2a04ca":"Skye",     "320b2a48":"Sova",      "b444168c":"Tejo",
    "92eeef5d":"Veto",     "707eab51":"Viper",    "efba5359":"Vyse",      "df1cb487":"Waylay",
    "7f94d92c":"Yoru",
  };

  const playerList = players
    .filter(p => !p.isObserver)
    .map(p => {
      const s = p.stats;
      const a = acc[p.subject];
      const rp = s.roundsPlayed || 1;
      const shots = a.headshots + a.bodyshots + a.legshots;
      const charShort = p.characterId.split('-')[0];
      const agentName = CHAR_MAP[charShort] || "Unknown";
      const osrRatings = calculateOSR(rawJson);
      return {
        puuid: p.subject,
        name: (p.gameName || p.riotIdGameName || p.identity?.gameName || p.name)
          ? ((p.gameName || p.riotIdGameName || p.identity?.gameName || p.name) + "#" + (p.tagLine || p.riotIdTagline || p.riotIdTagLine || p.identity?.tagLine || p.tag || ""))
          : (p.tagLine || p.riotIdTagline || p.subject?.slice(0,8) || "?"),
        agent: agentName,
        team: p.teamId,
        side: myTeamId ? (p.teamId === myTeamId ? "blue" : "red") : (p.teamId === "Blue" ? "blue" : "red"),
        acs: Math.round(s.score / rp),
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        kd: s.deaths > 0 ? Math.round((s.kills / s.deaths) * 100) / 100 : s.kills,
        hsRate: shots > 0 ? Math.round(a.headshots / shots * 100) : 0,
        adr: Math.round(a.totalDamage / rp),
        tfk: a.tfk,
        tfd: a.tfd,
        plants: a.plants,
        roundsPlayed: rp,
        osr: osrRatings[p.subject] ?? null,
      };
    })
    .sort((a, b) => b.acs - a.acs);

  const blueTeam = teams.find(t => t.teamId === "Blue") || {};
  const redTeam  = teams.find(t => t.teamId === "Red")  || {};

  // ATK/DEF split: rounds 0–11 Blue=ATK, 12–23 Blue=DEF (standard)
  // Determine by counting who won ATK rounds as blue
  let blueAtkWins = 0, blueDefWins = 0;
  roundDetail.slice(0, 12).forEach(r => { if (r.winner === "Blue") blueAtkWins++; });
  roundDetail.slice(12).forEach(r => { if (r.winner === "Blue") blueDefWins++; });

  // Pistol rounds: round 1 (idx 0) and round 13 (idx 12)
  const pistol1 = roundDetail[0]?.winner;
  const pistol2 = roundDetail[12]?.winner;

  return {
    playerList,
    roundDetail,
    blueScore: blueTeam.roundsWon || 0,
    redScore:  redTeam.roundsWon  || 0,
    blueWon:   blueTeam.won || false,
    redWon:    redTeam.won  || false,
    blueAtkWins,
    blueDefWins,
    pistol1Winner: pistol1,
    pistol2Winner: pistol2,
    totalRounds: roundDetail.length,
    mapId: matchInfo?.mapId || "",
  };
}

// ── Map data cache & hook ──────────────────────────────────────────────────
const _minimapCache = {};
function useMinimapData(mapName) {
  const MAP_KEY = {
    "ascent":"ascent","bind":"bind","breeze":"breeze","fracture":"canyon",
    "haven":"triad","icebox":"port","lotus":"jam","pearl":"pearl",
    "split":"bonsai","sunset":"highrise","abyss":"foxtrot","corrode":"barbados",
  };
  const key = MAP_KEY[(mapName||"").toLowerCase()] || (mapName||"").toLowerCase();
  const [data, setData] = React.useState(_minimapCache[key] || null);
  React.useEffect(() => {
    if (!key) return;
    if (_minimapCache[key]) { setData(_minimapCache[key]); return; }
    fetch("https://valorant-api.com/v1/maps")
      .then(r=>r.json())
      .then(d=>{
        const m = d.data.find(m=>m.mapUrl.split("/").pop().toLowerCase()===key);
        if (m) {
          const info = { displayName:m.displayName, imageUrl:m.displayIcon,
            xM:m.xMultiplier, yM:m.yMultiplier, xA:m.xScalarToAdd, yA:m.yScalarToAdd };
          _minimapCache[key] = info;
          setData(info);
        }
      }).catch(()=>{});
  }, [key]);
  return data;
}

// Convert raw game coords → 0..1 (note: x/y are swapped per valorant-api convention)
function gToMap(gx, gy, md) {
  const nx = gy * md.xM + md.xA;
  const ny = gx * md.yM + md.yA;
  return { nx: Math.max(0,Math.min(1,nx)), ny: Math.max(0,Math.min(1,ny)) };
}

function RoundMinimap({ kills, ourTeam, md }) {
  const S = 260;
  if (!md) return (
    <div style={{width:S,height:S,background:"var(--s3)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:"1px solid var(--b1)"}}>
      <span style={{fontSize:11,color:"var(--t3)"}}>Loading map…</span>
    </div>
  );
  const dots = (kills||[]).map((k,i)=>{
    const vp = k.victimLocation   ? gToMap(k.victimLocation.x,   k.victimLocation.y,   md) : null;
    const kp = k.killerLocation   ? gToMap(k.killerLocation.x,   k.killerLocation.y,   md) : null;
    return { i, isOurKill: k.killerTeam===ourTeam, isOurVictim: k.victimTeam===ourTeam, vp, kp };
  });
  return (
    <div style={{position:"relative",width:S,height:S,flexShrink:0,borderRadius:8,overflow:"hidden",border:"1px solid var(--b2)"}}>
      <img src={md.imageUrl} alt={md.displayName} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",opacity:0.72}}/>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%"}} viewBox={`0 0 ${S} ${S}`}>
        {dots.map(({i,vp,kp,isOurKill})=> kp&&vp&&(
          <line key={`l${i}`} x1={kp.nx*S} y1={kp.ny*S} x2={vp.nx*S} y2={vp.ny*S}
            stroke={isOurKill?"rgba(105,240,174,0.4)":"rgba(255,82,82,0.4)"} strokeWidth="1" strokeDasharray="3,2"/>
        ))}
        {dots.map(({i,kp,isOurKill})=> kp&&(
          <circle key={`k${i}`} cx={kp.nx*S} cy={kp.ny*S} r={3.5}
            fill={isOurKill?"rgba(212,255,30,0.9)":"rgba(255,160,0,0.9)"} stroke="rgba(0,0,0,0.6)" strokeWidth="1"/>
        ))}
        {dots.map(({i,vp,isOurVictim})=> vp&&(
          <g key={`v${i}`}>
            <circle cx={vp.nx*S} cy={vp.ny*S} r={6}
              fill={isOurVictim?"rgba(255,82,82,0.92)":"rgba(105,240,174,0.92)"} stroke="rgba(0,0,0,0.7)" strokeWidth="1.5"/>
            <text x={vp.nx*S} y={vp.ny*S+4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#000">{i+1}</text>
          </g>
        ))}
      </svg>
      <div style={{position:"absolute",bottom:4,left:4,display:"flex",flexDirection:"column",gap:2,pointerEvents:"none"}}>
        {[["rgba(255,82,82,0.92)","Our death"],["rgba(105,240,174,0.92)","Their death"],["rgba(212,255,30,0.9)","Our kill pos"]].map(([c,l])=>(
          <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:c,border:"1px solid #000"}}/>
            <span style={{fontSize:8,color:"#fff",textShadow:"0 1px 2px #000"}}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScrimDetail({ sel, onClose, onDelete }) {
  const [tab, setTab]         = React.useState("scoreboard");
  const [editing, setEditing] = React.useState(false);
  const [saving,  setSaving]  = React.useState(false);
  const [saveErr, setSaveErr] = React.useState("");
  const draftRef              = React.useRef(null);

  // ── Parse stored data ───────────────────────────────────────────────────
  const rounds      = (() => { try { return Array.isArray(sel.rounds)?sel.rounds:JSON.parse(sel.rounds||"[]"); } catch { return []; } })();
  const roundDetailRaw = (() => {
    try {
      const rd = sel.round_detail;
      const raw = Array.isArray(rd) ? rd : (rd ? JSON.parse(rd) : []);
      // Normalize old records that are missing planterTeam / winnerIsOurs / xvy
      const atkFirst = sel.atk_first != null ? sel.atk_first : true;
      return raw.map((r, idx) => {
        const out = { ...r };
        // winnerIsOurs: our team is always "Red"
        if (out.winnerIsOurs === undefined || out.winnerIsOurs === null) out.winnerIsOurs = out.winner === "Red";
        // planterTeam: infer from atk_first + half
        if (out.planterTeam === undefined || (out.planterTeam === null && out.planted)) {
          if (!out.planted) {
            out.planterTeam = null;
          } else {
            const isH1 = idx < 12;
            const ourSideIsAtk = isH1 ? atkFirst : !atkFirst;
            out.planterTeam = ourSideIsAtk ? "Red" : "Blue";
          }
        }
        // xvy: derive from kills array if missing
        if (out.xvy === undefined || out.xvy === null) {
          const kills = out.kills || [];
          const dead = new Set(kills.map(k => k.victimPuuid).filter(Boolean));
          // fallback: count by victimTeam if victimPuuid not present
          const redDeaths  = kills.filter(k => k.victimTeam === "Red").length;
          const blueDeaths = kills.filter(k => k.victimTeam === "Blue").length;
          const redAlive  = dead.size > 0 ? Math.max(0, 5 - [...dead].filter(id => kills.find(k=>k.victimPuuid===id&&k.victimTeam==="Red")).length) : Math.max(0, 5 - redDeaths);
          const blueAlive = dead.size > 0 ? Math.max(0, 5 - [...dead].filter(id => kills.find(k=>k.victimPuuid===id&&k.victimTeam==="Blue")).length) : Math.max(0, 5 - blueDeaths);
          out.xvy = `${redAlive}v${blueAlive}`;
        }
        return out;
      });
    } catch { return []; }
  })();
  const playerStats = (() => {
          try {
            const raw = Array.isArray(sel.player_stats) ? sel.player_stats : JSON.parse(sel.player_stats||"[]");
            // Build puuid→name map from round_detail kill feed (killerName/victimName stored there)
        const buildNameMapFromDetail = (detail) => {
          const map = {};
          detail.forEach(rd => {
            (rd.kills || []).forEach(k => {
              if (k.killerPuuid && k.killerName && k.killerName !== "?") map[k.killerPuuid] = k.killerName;
              if (k.victimPuuid && k.victimName && k.victimName !== "?") map[k.victimPuuid] = k.victimName;
            });
            if (rd.firstBlood) {
              if (rd.firstBlood.killerPuuid && rd.firstBlood.killerName && rd.firstBlood.killerName !== "?") map[rd.firstBlood.killerPuuid] = rd.firstBlood.killerName;
              if (rd.firstBlood.victimPuuid && rd.firstBlood.victimName && rd.firstBlood.victimName !== "?") map[rd.firstBlood.victimPuuid] = rd.firstBlood.victimName;
            }
          });
          return map;
        };
            const detailNameMap = buildNameMapFromDetail(roundDetailRaw);
            return raw.map((p, i) => {
              if (p.name && p.name !== "#" && !p.name.startsWith("#")) return p;
              const gn = p.gameName || p.riotIdGameName || (p.identity && p.identity.gameName) || p.displayName || "";
              const tl = p.tagLine || p.riotIdTagline || p.riotIdTagLine || (p.identity && p.identity.tagLine) || p.tag || "";
              const fromDetail = p.puuid ? detailNameMap[p.puuid] : null;
              const resolved = gn ? (tl ? gn + "#" + tl : gn) : (fromDetail || tl || (p.puuid && p.puuid.slice(0, 8)) || ("Player " + (i + 1)));
              return Object.assign({}, p, { name: resolved });
            });
          } catch { return []; }
        })();
  const rawMatchData = (() => { try { return sel.raw_match ? JSON.parse(sel.raw_match) : null; } catch { return null; } })();
  const killPositions = (() => { try { const kp = sel.kill_positions; return Array.isArray(kp)?kp:(kp?JSON.parse(kp):[]); } catch { return []; } })();
  const mapMeta       = (() => { try { const mm = sel.map_meta; return mm?(typeof mm==="string"?JSON.parse(mm):mm):null; } catch { return null; } })();
  const hasHeatmap = killPositions.length > 0;

  const isWin = sel.res==="win"||sel.res==="W";
  const [ourScore, theirScore] = (sel.score||"0-0").split("-").map(Number);
  const hasRoundDetail = roundDetailRaw.length > 0;
  const minimapData = useMinimapData(sel.map);

  // ── Compute enhanced stats from player_stats (stored by import-raw) ─────
  const ourStats   = playerStats.filter(p=>p.side==="blue");
  const theirStats = playerStats.filter(p=>p.side==="red");
  const hasStats   = playerStats.length > 0;

  // Team-level round stats from roundDetail
  const roundsArr = hasRoundDetail ? roundDetailRaw : [];
  const totalRounds = roundsArr.length || ourScore + theirScore || 0;
  const ourWins  = roundsArr.filter(r=>r.winner==="Blue"||r.winnerIsOurs).length;
  const theirWins = roundsArr.filter(r=>r.winner!=="Blue"&&!r.winnerIsOurs).length;
  const h1 = roundsArr.slice(0,12);
  const h2 = roundsArr.slice(12);
  const h1OurWins = h1.filter(r=>r.winner==="Blue"||r.winnerIsOurs).length;
  const h2OurWins = h2.filter(r=>r.winner==="Blue"||r.winnerIsOurs).length;
  const plantedRounds = roundsArr.filter(r=>r.planted).length;
  const ourDefuses   = roundsArr.filter(r=>r.outcome==="Defuse"&&(r.winner==="Blue"||r.winnerIsOurs)).length;
  const bothAlive = r => { const m = String(r.xvy||"").match(/^(\d+)v(\d+)$/); return !m || (parseInt(m[1])>0 && parseInt(m[2])>0); };
  const isMoneyPlant = rd => {
    if (!rd.planted || !rd.plantRoundTime) return false;
    const lastKillTime = (rd.kills || []).reduce((max, k) => Math.max(max, k.time || 0), 0);
    return rd.plantRoundTime > lastKillTime;
  };
  const isValidPostPlant = r => r.planted && r.planterTeam==="Red" && !isMoneyPlant(r);
  const isValidRetake    = r => r.planted && r.planterTeam && r.planterTeam!=="Red" && !isMoneyPlant(r);
  const postPlantWins  = roundsArr.filter(r=>isValidPostPlant(r)&&r.winnerIsOurs).length;
  const postPlantTotal = roundsArr.filter(r=>isValidPostPlant(r)).length;
  const retakes        = roundsArr.filter(r=>isValidRetake(r)&&r.winnerIsOurs).length;

  // First blood breakdown from roundDetail
  const ourFBs  = roundsArr.filter(r=>r.firstBlood&&(r.firstBlood.killerTeam==="Blue")).length;
  const oppFBs  = roundsArr.filter(r=>r.firstBlood&&(r.firstBlood.killerTeam!=="Blue")).length;
  const fbWinRate = ourFBs > 0 ? Math.round(roundsArr.filter(r=>r.firstBlood&&r.firstBlood.killerTeam==="Blue"&&(r.winner==="Blue"||r.winnerIsOurs)).length/ourFBs*100) : null;

  // Team averages from playerStats
  const avgOf = (arr, key) => arr.length ? (arr.reduce((s,p)=>s+(Number(p[key])||0),0)/arr.length) : 0;
  const sumOf = (arr, key) => arr.reduce((s,p)=>s+(Number(p[key])||0),0);

  // ── Edit handlers ────────────────────────────────────────────────────────
  const startEdit = () => { draftRef.current = playerStats.map(p=>({...p})); setEditing(true); setSaveErr(""); };
  const cancelEdit = () => { setEditing(false); setSaveErr(""); };
  const onEditCell = (playerName, field, value) => {
    if (!draftRef.current) return;
    const p = draftRef.current.find(x=>x.name===playerName);
    if (p) p[field] = value;
  };
  const saveEdits = async () => {
    if (!draftRef.current) return;
    setSaving(true); setSaveErr("");
    try {
      await api.put(`/api/scrims/${sel.id}`, {
        date:sel.date, map:sel.map, opp:sel.opp, comp:sel.comp, score:sel.score, res:sel.res,
        rounds:sel.rounds,
        round_detail: typeof sel.round_detail==="string" ? sel.round_detail : JSON.stringify(sel.round_detail||[]),
        player_stats: JSON.stringify(draftRef.current),
        source: sel.source,
      });
      setEditing(false);
    } catch(e) { setSaveErr(e.message||"Save failed"); }
    finally { setSaving(false); }
  };

  // ── Scoreboard row ───────────────────────────────────────────────────────
  const StatRow = ({p, isOurs}) => {
    const kd = p.kd ?? (p.deaths>0 ? Math.round((p.kills/p.deaths)*100)/100 : p.kills);
    const kdColor = kd>=1?"var(--green)":"var(--red)";
    const fkVal = p.tfk ?? p.firstBloods ?? p.fk ?? "-";
    const fdVal = p.tfd ?? p.fd ?? "-";
    const hsVal = p.hsRate ?? p.hs_rate ?? p.hs ?? "-";
    const adrVal = p.adr ?? "-";
    return (
      <tr>
        <td>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <AgentBadge name={p.agent} size={20}/>
            <span style={{fontSize:11,color:"var(--t2)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",maxWidth:120,whiteSpace:"nowrap"}}>{(p.name||"").split("#")[0] || (p.name||"").split("#")[1] || "—"}</span>
          </div>
        </td>
        <td style={{textAlign:"right",fontWeight:800,color:"var(--acc)",fontSize:14}}>{p.acs??"-"}</td>
        <td style={{textAlign:"right",fontWeight:600,color:"var(--t1)"}}>{p.kills??"-"}</td>
        <td style={{textAlign:"right",color:"var(--t3)"}}>{p.deaths??"-"}</td>
        <td style={{textAlign:"right",color:"var(--t3)"}}>{p.assists??"-"}</td>
        <td style={{textAlign:"right",fontWeight:600,color:kdColor}}>{kd}</td>
        <td style={{textAlign:"right",color:"var(--t2)"}}>{hsVal !== "-" ? hsVal+"%" : "-"}</td>
        <td style={{textAlign:"right",color:"var(--t2)"}}>{adrVal}</td>
        <td style={{textAlign:"right",color:Number(fkVal)>0?"var(--green)":"var(--t3)",fontWeight:Number(fkVal)>0?700:400}}>{fkVal}</td>
        <td style={{textAlign:"right",color:Number(fkVal)>0?"var(--t3)":"var(--t3)"}}>{fdVal}</td>
        <td style={{textAlign:"right",color:"var(--t3)"}}>{p.plants??"-"}</td>
        <td style={{textAlign:"right",color:"var(--t3)"}}>{p.defuses??"-"}</td>
        <td style={{textAlign:"right",color:Number(p.clutchWon)>0?"var(--acc)":"var(--t3)"}}>{p.clutchWon??"-"}</td>
      </tr>
    );
  };

  const TableHead = () => (
    <tr>
      <th>Player</th>
      <th style={{textAlign:"right"}}>ACS</th>
      <th style={{textAlign:"right"}}>K</th>
      <th style={{textAlign:"right"}}>D</th>
      <th style={{textAlign:"right"}}>A</th>
      <th style={{textAlign:"right"}}>K/D</th>
      <th style={{textAlign:"right"}}>HS%</th>
      <th style={{textAlign:"right"}}>ADR</th>
      <th style={{textAlign:"right",color:"var(--green)"}}>TFK</th>
      <th style={{textAlign:"right",color:"var(--red)"}}>TFD</th>
      <th style={{textAlign:"right"}}>Plnt</th>
      <th style={{textAlign:"right"}}>Def</th>
      <th style={{textAlign:"right",color:"var(--acc)"}}>Clch</th>
    </tr>
  );

  // ── Stat card component ──────────────────────────────────────────────────
  const Card = ({label, value, sub, color, accent}) => (
    <div style={{
      background:"var(--s2)",border:`1px solid ${accent?"var(--acc)":"var(--b2)"}`,
      borderRadius:8,padding:"12px 16px",flex:1,minWidth:90,
      borderLeft: accent ? "3px solid var(--acc)" : undefined,
    }}>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",color:"var(--t3)",textTransform:"uppercase",marginBottom:4}}>{label}</div>
      <div style={{fontSize:20,fontWeight:900,color:color||"var(--t1)",lineHeight:1}}>{value??"-"}</div>
      {sub && <div style={{fontSize:10,color:"var(--t3)",marginTop:3}}>{sub}</div>}
    </div>
  );

  // ── Round timeline ───────────────────────────────────────────────────────
  const RoundTimeline = () => {
    const rd = hasRoundDetail ? roundDetailRaw : rounds.map((r,i)=>({winner:r==="w"?"Blue":"Red",roundNum:i+1}));

    // Detect which side our team starts on in H1 (ATK or DEF)
    let atkFirst = sel.atk_first;
    if (atkFirst === null || atkFirst === undefined) {
      try {
        const firstH1Plant = roundDetailRaw.slice(0,12).find(r => r.planted && r.planterTeam);
        if (firstH1Plant) {
          const ourTeamP = playerStats.find(p => p.side === "blue");
          const ourTeam = ourTeamP?.team || "";
          if (ourTeam) {
            atkFirst = firstH1Plant.planterTeam === ourTeam;
          } else {
            // No team field stored: check kills in H1 — if our players killed in H1 plant rounds, we were ATK
            const h1Wins = roundDetailRaw.slice(0,12).filter(r => r.winnerIsOurs);
            const h2Wins = roundDetailRaw.slice(12,24).filter(r => r.winnerIsOurs);
            atkFirst = h1Wins.length >= h2Wins.length;
          }
        } else { atkFirst = true; }
      } catch { atkFirst = true; }
    }
    const h1Side = atkFirst ? "ATK" : "DEF";
    const h2Side = atkFirst ? "DEF" : "ATK";
    const h1SideColor = atkFirst ? "#fb923c" : "#4fc3f7";
    const h2SideColor = atkFirst ? "#4fc3f7" : "#fb923c";

    const RoundPip = ({r, idx}) => {
      const isOurWin = r.winner==="Blue"||r.winnerIsOurs;
      const site = r.site || r.plantSite;
      const outcome = r.outcome;
      const siteColor = site==="A"?"#a78bfa":site==="B"?"#f87171":site==="C"?"#34d399":"#fb923c";
      const icon = outcome==="Defuse"?"✂":outcome==="Detonate"?"💥":outcome==="Surrendered"?"🏳":null;
      const fb = r.firstBlood;
      return (
        <div title={[`R${r.roundNum!=null?r.roundNum+1:idx+1}`, site?`Site ${site}`:"", outcome||"", fb?`FB: ${fb.killerName}`:""].filter(Boolean).join(" · ")}
          style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"default"}}>
          <div style={{
            width:30,height:30,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:10,fontWeight:700,
            background:isOurWin?"rgba(212,255,30,0.12)":"rgba(255,82,82,0.1)",
            border:`1px solid ${isOurWin?"var(--acc)":"var(--red)"}`,
            color:isOurWin?"var(--acc)":"var(--red)",
          }}>{r.roundNum!=null?r.roundNum+1:idx+1}</div>
          {site && <div style={{fontSize:7,fontWeight:800,color:siteColor,letterSpacing:"0.05em"}}>{site}</div>}
          {icon && <div style={{fontSize:8,color:"var(--t3)"}}>{icon}</div>}
        </div>
      );
    };

    return (
      <div style={{padding:"4px 0"}}>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <div style={{width:3,height:14,background:"var(--acc)",borderRadius:2}}/>
            <span style={{fontSize:11,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em",textTransform:"uppercase"}}>First Half</span>
            <span style={{fontSize:11,color:"var(--t3)"}}>{h1OurWins}/{h1.length || 12}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"flex-end"}}>
            {rd.slice(0,12).map((r,i)=>(
              <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                {i===0
                  ? <div style={{fontSize:8,fontWeight:900,color:h1SideColor,letterSpacing:"0.08em",lineHeight:1,marginBottom:2}}>{h1Side}</div>
                  : <div style={{height:11}}/>}
                <RoundPip r={r} idx={i}/>
              </div>
            ))}
          </div>
        </div>
        {rd.length > 12 && (
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{width:3,height:14,background:"var(--blue)",borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Second Half</span>
              <span style={{fontSize:11,color:"var(--t3)"}}>{h2OurWins}/{h2.length}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,alignItems:"flex-end"}}>
              {rd.slice(12).map((r,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                  {i===0
                    ? <div style={{fontSize:8,fontWeight:900,color:h2SideColor,letterSpacing:"0.08em",lineHeight:1,marginBottom:2}}>{h2Side}</div>
                    : <div style={{height:11}}/>}
                  <RoundPip r={r} idx={i+12}/>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasRoundDetail && (
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:8,paddingTop:12,borderTop:"1px solid var(--b1)"}}>
            {[
              {color:"var(--acc)",label:"Our Win"},
              {color:"var(--red)",label:"Loss"},
              {color:"var(--t3)",label:"✂ Defuse"},
              {color:"var(--t3)",label:"💥 Detonate"},
              {color:"#a78bfa",label:"A Site"},
              {color:"#f87171",label:"B Site"},
            ].map(({color,label},i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"var(--t3)"}}>
                {!label.startsWith("✂")&&!label.startsWith("💥")&&<div style={{width:8,height:8,borderRadius:2,background:color,opacity:0.7}}/>}
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Overview tab ─────────────────────────────────────────────────────────
  const Overview = () => {
    const totalFKs  = sumOf(ourStats,"tfk")||sumOf(ourStats,"firstBloods")||0;
    const totalFDs  = sumOf(ourStats,"tfd")||0;
    const avgACS    = ourStats.length ? Math.round(avgOf(ourStats,"acs")) : "-";
    const avgHS     = ourStats.length ? Math.round(avgOf(ourStats,"hsRate")||avgOf(ourStats,"hs_rate")) + "%" : "-";
    const avgADR    = ourStats.length ? Math.round(avgOf(ourStats,"adr")) : "-";
    const teamKills = sumOf(ourStats,"kills");
    const teamDeaths= sumOf(ourStats,"deaths");

    return (
      <div>
        {/* Match overview cards */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          <Card label="Score" value={sel.score} color={isWin?"var(--green)":"var(--red)"} accent={isWin}/>
          <Card label="Result" value={isWin?"WIN":"LOSS"} color={isWin?"var(--green)":"var(--red)"}/>
          <Card label="Map" value={sel.map} color="var(--t1)"/>
          <Card label="Opponent" value={sel.opp} color="var(--t2)"/>
        </div>

        {hasRoundDetail && (
          <>
            {/* ATK/DEF breakdown */}
            <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:"var(--acc)",borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--t3)",textTransform:"uppercase"}}>Round Breakdown</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              <Card label="H1 Rounds" value={`${h1OurWins}/${h1.length||12}`} sub="our wins" color="var(--acc)"/>
              <Card label="H2 Rounds" value={`${h2OurWins}/${h2.length}`} sub="our wins" color="var(--acc)"/>
              <Card label="Plants" value={plantedRounds} sub="rounds planted"/>
              <Card label="Post-Plant" value={postPlantTotal>0?`${postPlantWins}/${postPlantTotal}`:"-"} sub="our wins after plant"/>
              <Card label="Defuses" value={ourDefuses} sub="our defuses"/>
              {retakes > 0 && <Card label="Retakes" value={retakes} sub="won after plant vs us"/>}
            </div>

            {/* First blood */}
            <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:"var(--green)",borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--t3)",textTransform:"uppercase"}}>First Blood</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              <Card label="Our FBs" value={ourFBs} sub={`of ${totalRounds} rounds`} color="var(--green)"/>
              <Card label="Opp FBs" value={oppFBs} color="var(--red)"/>
              {fbWinRate !== null && <Card label="FB Win Rate" value={fbWinRate+"%"} sub="win% when we get FB" color={fbWinRate>=50?"var(--green)":"var(--red)"}/>}
            </div>
          </>
        )}

        {hasStats && (
          <>
            {/* Team averages */}
            <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:"var(--blue)",borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--t3)",textTransform:"uppercase"}}>Team Averages</span>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
              <Card label="Avg ACS" value={avgACS} color="var(--acc)"/>
              <Card label="Avg HS%" value={avgHS}/>
              <Card label="Avg ADR" value={avgADR}/>
              <Card label="Total TFK" value={totalFKs} color="var(--green)"/>
              <Card label="Total TFD" value={totalFDs} color="var(--red)"/>
              <Card label="K/D Ratio" value={teamDeaths>0?(teamKills/teamDeaths).toFixed(2):teamKills} color={teamKills>=teamDeaths?"var(--green)":"var(--red)"}/>
            </div>

            {/* Top performers */}
            <div style={{marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:14,background:"var(--purple)",borderRadius:2}}/>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:"var(--t3)",textTransform:"uppercase"}}>Top Performers</span>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8,marginBottom:20}}>
              {[...ourStats].sort((a,b)=>(b.acs||0)-(a.acs||0)).map((p,i)=>(
                <div key={i} style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:8,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:12,color:"var(--t3)",fontWeight:700,width:16}}>{i+1}</span>
                  <AgentBadge name={p.agent} size={22}/>
                  <div style={{flex:1,overflow:"hidden"}}>
                    <div style={{fontSize:11,color:"var(--t2)",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                    <div style={{fontSize:10,color:"var(--t3)"}}>{p.kills}K / {p.deaths}D / {p.assists}A</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontWeight:900,color:"var(--acc)"}}>{p.acs}</div>
                    <div style={{fontSize:9,color:"var(--t3)"}}>ACS</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const TABS = ["scoreboard","rounds","overview","heatmap"];
  const tabLabel = {scoreboard:"Scoreboard",rounds:"Round Timeline",overview:"Overview",heatmap:"Kill Map"};

  return ReactDOM.createPortal(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"var(--bg)",overflowY:"auto",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"14px 28px",borderBottom:"1px solid var(--b2)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,background:"var(--s1)",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <span className="bc" style={{fontSize:22,fontWeight:900}}>vs {sel.opp}</span>
          <span className="chip chip-blue">{sel.map}</span>
          <span className={`chip ${isWin?"chip-green":"chip-red"}`}>{isWin?"▲ Win":"▼ Loss"}</span>
          <span style={{color:"var(--t3)",fontSize:11}}>{sel.date}</span>
          {sel.source && <span className="chip" style={{fontSize:9,opacity:0.6}}>{sel.source}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <span className="bc" style={{fontSize:36,fontWeight:900,color:isWin?"var(--green)":"var(--red)"}}>{sel.score}</span>
          {!editing
            ? <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 10px"}} onClick={startEdit}>✏ Edit</button>
            : <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {saveErr && <span style={{fontSize:11,color:"var(--red)"}}>{saveErr}</span>}
                <button className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                <button className="btn btn-acc" onClick={saveEdits} disabled={saving} style={{padding:"5px 14px"}}>
                  {saving?"Saving…":"✓ Save"}
                </button>
              </div>
          }
          <button style={{background:"none",border:"none",color:"var(--t2)",cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px"}} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--b1)",flexShrink:0,background:"var(--s1)"}}>
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"10px 20px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
            background:"transparent",letterSpacing:"0.06em",textTransform:"uppercase",
            color:tab===t?"var(--acc)":"var(--t3)",
            borderBottom:tab===t?"2px solid var(--acc)":"2px solid transparent",
            transition:"color 0.15s",
          }}>{tabLabel[t]}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,padding:"20px 28px",maxWidth:1200,width:"100%",margin:"0 auto"}}>

        {/* SCOREBOARD */}
        {tab==="scoreboard" && (<>
          {hasStats ? (<>
            {[{label:"Our Team",color:"var(--acc)",stats:ourStats},{label:"Opponents",color:"var(--red)",stats:theirStats}].map(({label,color,stats})=>(
              <div key={label} style={{marginBottom:24}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <div style={{width:3,height:16,background:color,borderRadius:2}}/>
                  <span style={{fontWeight:800,fontSize:13,color,letterSpacing:"0.06em",textTransform:"uppercase"}}>{label}</span>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table className="tbl tbl-compact" style={{width:"100%",minWidth:750}}>
                    <thead><TableHead/></thead>
                    <tbody>{stats.map((p,i)=><StatRow key={i} p={p}/>)}</tbody>
                  </table>
                </div>
              </div>
            ))}
          </>) : (
            <div style={{textAlign:"center",padding:"60px 0",color:"var(--t3)"}}>
              <div style={{fontSize:32,marginBottom:8}}>📊</div>
              <div style={{fontWeight:700,marginBottom:4}}>No Stats Available</div>
              <div style={{fontSize:12}}>Upload a JSON file from SCRIM_STATS_FINAL.bat to see player stats</div>
            </div>
          )}
        </>)}

        {/* ROUND TIMELINE */}
        {tab==="rounds" && <RoundTimeline/>}

        {/* OVERVIEW */}
        {tab==="overview" && <Overview/>}


        {/* KILL HEATMAP */}
        {tab==="heatmap" && <KillHeatmap killPositions={killPositions} mapMeta={mapMeta} map={sel.map} date={sel.date}/>}


        <button className="btn btn-red" style={{marginTop:24,width:"100%",justifyContent:"center",opacity:0.7}} onClick={onDelete}>
          Delete Scrim
        </button>
      </div>
    </div>,
    document.body
  );
}

// KillHeatmap — proper component (not IIFE) so useState is valid per React hook rules
function KillHeatmap({ killPositions, mapMeta, map, date }) {
  const [hmFilter, setHmFilter] = React.useState("all");

  if (!killPositions || killPositions.length === 0) return (
    <div style={{textAlign:"center",padding:"60px 0",color:"var(--t3)"}}>
      <div style={{fontSize:32,marginBottom:8}}>🗺</div>
      <div style={{fontWeight:700,marginBottom:4}}>No Kill Position Data</div>
      <div style={{fontSize:12}}>Re-import this scrim using the JSON file to see the kill heatmap</div>
    </div>
  );

  const ourKills  = killPositions.filter(k => k.isOurKill && !k.isOurDeath);
  const ourDeaths = killPositions.filter(k => k.isOurDeath);
  const shown = hmFilter==="kills" ? ourKills : hmFilter==="deaths" ? ourDeaths : killPositions;

  const W = 1024, H = 1024; // match valorant-api.com minimap dimensions

  // Convert Riot game coords to SVG pixel coords.
  // Valorant minimap coordinate conversion:
  // IMPORTANT: game_x and game_y must be SWAPPED before applying the multipliers.
  // px = game_y * xMultiplier + xScalarToAdd   (note: game_y → px)
  // py = game_x * yMultiplier + yScalarToAdd   (note: game_x → py)
  // Source: https://www.studocu.com/row/document/national-school-of-applied-sciences-of-safi/mecanique-de-point/valorant-coordinate-conversion-guide-minimap-mapping-techniques/148158289
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let toSvg;
  if (mapMeta && mapMeta.xMult != null) {
    toSvg = (x, y) => ({
      px: clamp((y * mapMeta.xMult + mapMeta.xScalar) * W, 0, W),
      py: clamp((x * mapMeta.yMult + mapMeta.yScalar) * H, 0, H),
    });
  } else {
    // Fallback: min/max normalisation when no map metadata is available.
    // Swap x/y here too for consistency.
    const xs = killPositions.map(k=>k.y), ys = killPositions.map(k=>k.x);
    const xMin=Math.min(...xs), xMax=Math.max(...xs);
    const yMin=Math.min(...ys), yMax=Math.max(...ys);
    const pad = 0.05;
    toSvg = (x, y) => ({
      px: clamp(pad*W + ((y-xMin)/(xMax-xMin||1))*(W*(1-2*pad)), 0, W),
      py: clamp(pad*H + ((x-yMin)/(yMax-yMin||1))*(H*(1-2*pad)), 0, H),
    });
  }

  return (
    <div>
      {/* Filter buttons */}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        {[
          {k:"all",    label:`All (${killPositions.length})`},
          {k:"kills",  label:`Our Kills (${ourKills.length})`,  color:"var(--green)"},
          {k:"deaths", label:`Our Deaths (${ourDeaths.length})`,color:"var(--red)"},
        ].map(({k,label,color})=>(
          <button key={k} onClick={()=>setHmFilter(k)} style={{
            padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
            background:hmFilter===k?"rgba(212,255,30,0.12)":"var(--s2)",
            color:hmFilter===k?color||"var(--acc)":"var(--t2)",
            border:`1px solid ${hmFilter===k?color||"rgba(212,255,30,0.3)":"var(--b2)"}`,
            transition:"all 0.15s",
          }}>{label}</button>
        ))}
        <span style={{fontSize:11,color:"var(--t3)",marginLeft:4}}>
          {map} · {date}{mapMeta ? "" : " · (no minimap — re-import for overlay)"}
        </span>
      </div>

      {/* Map + dots */}
      <div style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:10,overflow:"hidden",maxWidth:600,position:"relative"}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",display:"block"}}>
          {/* Minimap image background from valorant-api.com */}
          {mapMeta?.icon
            ? <image href={mapMeta.icon} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid meet"/>
            : <rect width={W} height={H} fill="var(--s1)"/>
          }
          {/* Slight darkening overlay so dots stand out */}
          <rect width={W} height={H} fill="rgba(0,0,0,0.35)"/>

          {/* Blur/heat layer */}
          <defs>
            <filter id="heatBlur"><feGaussianBlur stdDeviation="18"/></filter>
          </defs>
          <g filter="url(#heatBlur)" opacity={0.55}>
            {shown.map((k,i) => {
              const {px,py} = toSvg(k.x, k.y);
              const c = (k.isOurKill&&!k.isOurDeath)?"rgba(212,255,30,":k.isOurDeath?"rgba(255,82,82,":"rgba(79,195,247,";
              return <circle key={i} cx={px} cy={py} r={28} fill={`${c}0.45)`}/>;
            })}
          </g>

          {/* Sharp dots */}
          {shown.map((k,i) => {
            const {px,py} = toSvg(k.x, k.y);
            const color = (k.isOurKill&&!k.isOurDeath)?"var(--acc)":k.isOurDeath?"var(--red)":"rgba(79,195,247,0.8)";
            return <circle key={i} cx={px} cy={py} r={4} fill={color} opacity={0.9}/>;
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
        {[
          {color:"var(--acc)",              label:"Our Kills"},
          {color:"var(--red)",              label:"Our Deaths"},
          {color:"rgba(79,195,247,0.8)",    label:"Enemy Kills"},
        ].map(({color,label})=>(
          <div key={label} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--t2)"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadJsonModal({ onClose, onSaved }) {
  const [dragOver, setDragOver]   = useState(false);
  const [file, setFile]           = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [parseError, setParseError] = useState("");
  const [myTeam, setMyTeam]       = useState("Blue");
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef();

  const loadFile = async (f) => {
    setParseError(""); setMatchData(null); setFile(null); setSaveError("");
    if (!f || !f.name.endsWith(".json")) { setParseError("Please select a .json file."); return; }
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.errorCode) { setParseError("JSON contains a Riot API error: " + (data.message || data.errorCode)); return; }
      if (!data.matchInfo) { setParseError("Invalid match JSON — missing matchInfo. Make sure you're uploading a file from SCRIM_STATS_FINAL.bat."); return; }
      setFile(f);
      setMatchData(data);
    } catch(e) { setParseError("Could not parse file: " + e.message); }
  };

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  };

  const onFileChange = e => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) loadFile(f);
  };

  const handleSave = async () => {
    if (!matchData) return;
    setSaving(true); setSaveError("");
    try {
      const result = await api.post("/api/scrims/import-raw", { matchData, myTeamId: myTeam });
      if (result?.id) {
        const full = await api.get(`/api/scrims/${result.id}`).catch(() => result);
        onSaved(full || result);
      } else {
        setSaveError(result?.error || "Import failed — unknown error.");
      }
    } catch(e) { setSaveError(e.message || "Failed to save."); }
    finally { setSaving(false); }
  };

  const map = matchData?.matchInfo?.mapId?.replace(/.*\/Maps\//,"").replace(/\/.*/,"") || "";
  const MAP_DISPLAY = { Duality:"Bind", Bonsai:"Split", Canyon:"Fracture", Foxtrot:"Breeze", Port:"Icebox", Triad:"Haven", Pitt:"Pearl", Jam:"Lotus", Juliett:"Sunset", Infinity:"Abyss", Ascent:"Ascent" };
  const mapName = MAP_DISPLAY[map] || map;
  const playerCount = matchData?.players?.length || 0;
  const dateStr = matchData?.matchInfo?.gameStartMillis
    ? new Date(matchData.matchInfo.gameStartMillis).toLocaleDateString("en-CA")
    : "";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:18, fontWeight:700, color:"var(--t1)" }}>📁 Upload Match JSON</div>
          <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={onClose}>✕</button>
        </div>

        {/* Step 1: Drop zone */}
        <div
          style={{
            border: `2px dashed ${dragOver ? "var(--acc)" : matchData ? "var(--green)" : "var(--b2)"}`,
            borderRadius: "var(--r3)", padding: "32px 20px", textAlign:"center",
            background: dragOver ? "rgba(212,255,30,0.04)" : matchData ? "rgba(105,240,174,0.04)" : "var(--s2)",
            cursor:"pointer", transition:"all 0.18s", marginBottom:16,
          }}
          onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
          onDragLeave={()=>setDragOver(false)}
          onDrop={onDrop}
          onClick={()=>fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".json" style={{ display:"none" }} onChange={onFileChange}/>
          {matchData ? (
            <>
              <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
              <div style={{ fontWeight:700, color:"var(--green)", marginBottom:4 }}>{file?.name}</div>
              <div style={{ fontSize:12, color:"var(--t3)" }}>Click to choose a different file</div>
            </>
          ) : (
            <>
              <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
              <div style={{ fontWeight:600, color:"var(--t1)", marginBottom:4 }}>
                {dragOver ? "Drop it!" : "Drag & drop your JSON here"}
              </div>
              <div style={{ fontSize:12, color:"var(--t3)", marginBottom:12 }}>or click to browse</div>
              <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.5 }}>
                File saved by <span style={{ color:"var(--acc)", fontFamily:"monospace" }}>SCRIM_STATS_FINAL.bat</span><br/>
                Format: <span style={{ fontFamily:"monospace" }}>match-XXXXXXXX-YYYY-MM-DD.json</span>
              </div>
            </>
          )}
        </div>

        {parseError && (
          <div style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)", borderRadius:"var(--r)", padding:"10px 14px", fontSize:13, color:"var(--red)", marginBottom:14 }}>
            ⚠ {parseError}
          </div>
        )}

        {/* Step 2: Preview + team picker */}
        {matchData && (
          <>
            <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", marginBottom:10 }}>MATCH PREVIEW</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 16px", fontSize:13 }}>
                {mapName && <div><span style={{ color:"var(--t3)" }}>Map </span><span style={{ fontWeight:600, color:"var(--t1)" }}>{mapName}</span></div>}
                {dateStr && <div><span style={{ color:"var(--t3)" }}>Date </span><span style={{ fontWeight:600, color:"var(--t1)" }}>{dateStr}</span></div>}
                <div><span style={{ color:"var(--t3)" }}>Players </span><span style={{ fontWeight:600, color:"var(--t1)" }}>{playerCount}</span></div>
                <div><span style={{ color:"var(--t3)" }}>Rounds </span><span style={{ fontWeight:600, color:"var(--t1)" }}>{matchData.roundResults?.length || "?"}</span></div>
              </div>
            </div>

            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--t2)", marginBottom:8 }}>Which team are YOU on?</div>
              <div style={{ display:"flex", gap:8 }}>
                {["Blue","Red"].map(t=>(
                  <button
                    key={t}
                    onClick={()=>setMyTeam(t)}
                    style={{
                      flex:1, padding:"10px 0", borderRadius:"var(--r)", fontWeight:700, fontSize:14,
                      border: `2px solid ${myTeam===t ? (t==="Blue" ? "#4fc3f7" : "var(--red)") : "var(--b2)"}`,
                      background: myTeam===t ? (t==="Blue" ? "rgba(79,195,247,0.12)" : "rgba(255,82,82,0.12)") : "var(--s2)",
                      color: myTeam===t ? (t==="Blue" ? "#4fc3f7" : "var(--red)") : "var(--t3)",
                      cursor:"pointer", transition:"all 0.15s",
                    }}
                  >
                    {t==="Blue" ? "🔵" : "🔴"} {t} Team
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>
                This determines which team is counted as "us" for win/loss and opponent name.
              </div>
            </div>

            {saveError && (
              <div style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)", borderRadius:"var(--r)", padding:"10px 14px", fontSize:13, color:"var(--red)", marginBottom:14 }}>
                ⚠ {saveError}
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-acc" style={{ flex:2 }} onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "💾 Save to Tracker"}
              </button>
            </div>
          </>
        )}

        {!matchData && !parseError && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScrimLog({ setPage, pendingScrimId, onPendingConsumed }) {
  const [scrims, setScrims]       = useState([]);
  const [scrimsLoading, setScrimsLoading] = useState(true);
  const [filter, setFilter]       = useState({ map:"All", res:"All", q:"", type:"All" });
  const [sel, setSel]             = useState(null);
  const [selTab, setSelTab]       = useState("scoreboard");
  const [showImport, setShowImport] = useState(false);
  const [showJsonUpload, setShowJsonUpload] = useState(false);
  const [jsonTeam, setJsonTeam]   = useState("Red");
  const [jsonFile, setJsonFile]   = useState(null);
  const [jsonState, setJsonState] = useState("idle"); // idle | parsing | preview | saving | error
  const [jsonPreview, setJsonPreview] = useState(null);
  const [jsonError, setJsonError] = useState("");
  const [jsonOppName, setJsonOppName] = useState(""); // For editing opponent name in preview
  const [jsonOppDropdownOpen, setJsonOppDropdownOpen] = useState(false);
  const jsonOppInputRef = useRef(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const jsonSavingRef = useRef(false); // prevents double-save on rapid clicks
  const [savedApiKey, setSavedApiKey] = useState("");
  const [helperIp, setHelperIp] = useState(() => localStorage.getItem("ra_helper_ip") || "192.168.1.100");
  const [importData, setImportData] = useState({ matchId:"", apiKey:"", teamName:"" });
  const [importState, setImportState] = useState("idle");
  const [importPreview, setImportPreview] = useState(null);
  const [importError, setImportError] = useState("");
  const [editing, setEditing]         = React.useState(false);
  const [saving,  setSaving]          = React.useState(false);
  const [saveErr, setSaveErr]         = React.useState("");
  const draftRef                      = React.useRef(null);
  const draftOppRef                   = React.useRef("");
  const [patchingAdr, setPatchingAdr] = React.useState(false);
  const patchAdrInputRef              = React.useRef(null);
  const [fixingNames, setFixingNames] = React.useState(false);
  const fixNamesInputRef              = React.useRef(null);
  const [teamOverview, setTeamOverview] = useState(null); // null | { opp: string }
  const [vods, setVods]               = useState([]); // all vods for VOD linking
  const [vodInputs, setVodInputs]     = useState({}); // scrimId -> url input string
  const [vodSaving, setVodSaving]     = useState({}); // scrimId -> bool

  useEffect(()=>{
    Promise.all([
      api.get("/api/scrims").then(d=>{ if(Array.isArray(d)) setScrims(d); }).catch(()=>{}),
      api.get("/api/settings").then(d=>{ if(d?.henrik_api_key) setSavedApiKey(d.henrik_api_key); }).catch(()=>{}),
      api.get("/api/vods").then(d=>{ if(Array.isArray(d)) setVods(d.map(v=>({...v,ts:JSON.parse(v.ts||"[]"),genNote:v.gen_note||""}))); }).catch(()=>{}),
    ]).then(()=>{
      if(pendingScrimId) {
        api.get(`/api/scrims/${pendingScrimId}`).then(full=>{ if(full?.id){ setSel(full); setSelTab("scoreboard"); } }).catch(()=>{});
        onPendingConsumed?.();
      }
    }).finally(()=>setScrimsLoading(false));
  },[]);

  const saveHelperIp = (ip) => {
    setHelperIp(ip);
    localStorage.setItem("ra_helper_ip", ip);
  };

  const filtered = scrims.filter(s=>{
    if(filter.map!=="All"&&s.map!==filter.map) return false;
    if(filter.res!=="All"&&s.res!==filter.res) return false;
    if(filter.q&&!s.opp.toLowerCase().includes(filter.q.toLowerCase())) return false;
    if(filter.type==="Officials"&&!s.is_official) return false;
    if(filter.type==="Scrims"&&s.is_official) return false;
    return true;
  });

  const del = id => { api.delete(`/api/scrims/${id}`).catch(()=>{}); setScrims(p=>p.filter(s=>s.id!==id)); setSel(null); };
  // Sync draftOppRef and reset editing whenever selected scrim changes
  React.useEffect(() => { draftOppRef.current = sel?.opp || ""; setEditing(false); setConfirmDiscard(false); }, [sel?.id]);

  const handlePatchAdr = async (file) => {
    if (!sel || !file) return;
    setPatchingAdr(true);
    try {
      const text = await file.text();
      const matchData = JSON.parse(text);
      const result = await api.patch(`/api/scrims/${sel.id}/patch-adr`, { matchData });
      if (result?.ok) {
        const updated = await api.get(`/api/scrims/${sel.id}`);
        if (updated?.id) setSel(updated);
      } else {
        alert("Patch failed: " + (result?.error || "unknown error"));
      }
    } catch(e) { alert("Patch failed: " + e.message); }
    finally { setPatchingAdr(false); }
  }

  const handleFixNames = async (file) => {
    if (!sel || !file) return;
    setFixingNames(true);
    try {
      const text = await file.text();
      const matchData = JSON.parse(text);
      const result = await api.patch(`/api/scrims/${sel.id}/resolve-names`, { matchData });
      if (result?.ok) {
        const updated = await api.get(`/api/scrims/${sel.id}`);
        if (updated?.id) setSel(updated);
        alert(`Fixed ${result.patched} player name(s)!`);
      } else {
        alert("Fix failed: " + (result?.error || "unknown error"));
      }
    } catch(e) { alert("Fix failed: " + e.message); }
    finally { setFixingNames(false); }
  };;

  const scanForHelper = async () => {
    // First try saved/local IP
    const ipsToTry = ["127.0.0.1"];
    // Add saved IP if different
    if (helperIp !== "127.0.0.1") ipsToTry.push(helperIp);
    // Scan common LAN subnets for a helper
    const localSubnets = ["192.168.1", "192.168.0", "10.0.0", "10.0.1", "172.16.0"];
    for (const subnet of localSubnets) {
      for (let i = 1; i <= 254; i++) ipsToTry.push(`${subnet}.${i}`);
    }
    for (const ip of ipsToTry) {
      try {
        const r = await Promise.race([
          fetch(`http://${ip}:7429/health`),
          new Promise((_,rej) => setTimeout(()=>rej(new Error("timeout")), 300)),
        ]);
        if (r.ok) {
          const data = await r.json();
          if (data.ok) {
            saveHelperIp(ip);
            return ip;
          }
        }
      } catch(e) { /* skip */ }
    }
    return null;
  };

  const handleImportFetch = async () => {
    setImportState("loading");
    setImportError("");
    try {
      // First try the saved IP quickly
      let ip = helperIp;
      try {
        const health = await Promise.race([
          fetch(`http://${ip}:7429/health`),
          new Promise((_,rej) => setTimeout(()=>rej(new Error("timeout")), 800)),
        ]);
        if (!health.ok) throw new Error("not ok");
      } catch(e) {
        // Saved IP not responding — auto scan
        setImportError("Helper not found at saved IP, scanning network…");
        ip = await scanForHelper();
        if (!ip) {
          setImportError("Could not find RA Helper on the network. Make sure start-helper.bat is running.");
          setImportState("error");
          return;
        }
        setImportError("");
      }

      const url      = `http://${ip}:7429/import`;
      const response = await fetch(url);
      const result   = await response.json();
      if (!response.ok || result.error) {
        setImportError(result.error || "Import failed");
        setImportState("error");
        return;
      }
      setImportPreview(result.data);
      setImportState("preview");
    } catch(e) {
      setImportError("Could not reach RA Helper. Make sure start-helper.bat is running.");
      setImportState("error");
    }
  };

  const handleImportSave = async () => {
    if (!importPreview) return;
    setImportState("saving");
    try {
      const saved = await api.post("/api/scrims", { ...importPreview, source: "riot" });
      if (saved.id) {
        // Re-fetch full scrim data to ensure player_stats are included
        const full = await api.get(`/api/scrims/${saved.id}`).catch(() => saved);
        setScrims(p => [full || saved, ...p]);
        setShowImport(false);
        setImportData({ matchId:"", apiKey:"", teamName:"" });
        setImportPreview(null);
        setImportState("idle");
      }
    } catch(e) {
      setImportError(e.message || "Failed to save scrim");
      setImportState("error");
    }
  };

  const resetImport = () => {
    setImportState("idle");
    setImportPreview(null);
    setImportError("");
  };

  const resetJsonUpload = () => {
    setJsonState("idle");
    setJsonFile(null);
    setJsonPreview(null);
    setJsonError("");
    setJsonTeam("Blue");
    setJsonOppName("");
  };

  const handleJsonFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) setJsonFile(f);
  };

  const handleJsonParse = async () => {
    if (!jsonFile) return;
    setJsonState("parsing");
    setJsonError("");
    try {
      const text = await jsonFile.text();
      const matchData = JSON.parse(text);
      if (!matchData?.matchInfo) {
        setJsonError("Invalid Riot match JSON — missing matchInfo field.");
        setJsonState("error");
        return;
      }
      // parse-raw: preview only, does NOT insert into DB
      const result = await api.post("/api/scrims/parse-raw", { matchData, myTeamId: jsonTeam });
      if (result.error) { setJsonError(result.error); setJsonState("error"); return; }
      // Store raw matchData + teamId so save can use them
      setJsonPreview({ ...result, _matchData: matchData, _originalTeamId: jsonTeam });
      setJsonOppName("");
      setJsonState("preview");
    } catch(e) {
      setJsonError(e.message || "Failed to parse JSON file.");
      setJsonState("error");
    }
  };

  const handleJsonSave = async () => {
    if (!jsonPreview || jsonSavingRef.current) return;
    jsonSavingRef.current = true;
    setJsonState("saving");
    try {
      const matchData = jsonPreview._matchData;
      const teamToUse = jsonTeam;
      // Insert scrim into DB
      const result = await api.post("/api/scrims/import-raw", { matchData, myTeamId: teamToUse });
      if (result.error) { setJsonError(result.error); setJsonState("error"); jsonSavingRef.current = false; return; }
      // Apply opponent name override if user changed it
      const oppNameChanged = jsonOppName && jsonOppName !== result.opp;
      if (oppNameChanged) {
        await api.put(`/api/scrims/${result.id}`, { ...result, opp: jsonOppName });
      }
      // Re-fetch the full list so local state exactly matches DB — prevents any duplicates
      const fresh = await apiReq(`/api/scrims?t=${Date.now()}`, { headers: _token ? { Authorization: `Bearer ${_token}` } : {} });
      if (Array.isArray(fresh)) setScrims(fresh);
      setShowJsonUpload(false);
      resetJsonUpload();
    } catch(e) {
      setJsonError(e.message || "Failed to save scrim.");
      setJsonState("error");
      jsonSavingRef.current = false;
    }
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>SCRIM LOG</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>{scrims.length} games tracked</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <button className="btn btn-ghost" onClick={()=>{ setShowJsonUpload(true); resetJsonUpload(); }} style={{ border:"1px solid var(--b2)", padding:"8px 18px", borderRadius:8, fontWeight:700 }}>📂 Upload JSON</button>
          <button className="btn btn-ghost" onClick={()=>{ setShowImport(true); resetImport(); }} style={{ display:"none" }}>⬇ Import from Riot</button>
          <button className="btn btn-acc" onClick={()=>setPage("tracker")} style={{ padding:"8px 20px", borderRadius:8, fontWeight:700 }}><div className="ldot"/> New Game</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:18, flexWrap:"wrap", alignItems:"center" }}>
        <input type="text" placeholder="Search opponent..." style={{ width:200 }} value={filter.q} onChange={e=>setFilter(f=>({...f,q:e.target.value}))}/>
        <select style={{ width:140 }} value={filter.map} onChange={e=>setFilter(f=>({...f,map:e.target.value}))}><option>All</option>{MAPS.map(m=><option key={m}>{m}</option>)}</select>
        <select style={{ width:120 }} value={filter.res} onChange={e=>setFilter(f=>({...f,res:e.target.value}))}><option>All</option><option value="win">Wins</option><option value="loss">Losses</option></select>
        <select style={{ width:130 }} value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))}>
          <option value="All">All Games</option>
          <option value="Scrims">Scrims</option>
          <option value="Officials">Officials</option>
        </select>
        {filter.q.trim() && scrims.some(s=>s.opp.toLowerCase().includes(filter.q.toLowerCase())) && (
          <button className="btn btn-ghost" style={{ fontSize:12, padding:"5px 12px" }}
            onClick={()=>{ const opp=scrims.find(s=>s.opp.toLowerCase().includes(filter.q.toLowerCase()))?.opp; if(opp) setTeamOverview({opp}); }}>
            🔍 View Team Overview
          </button>
        )}
      </div>

      {scrimsLoading ? (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="tbl"><thead><tr><th>Date</th><th>Map</th><th>Opponent</th><th>Score</th><th>Result</th><th></th></tr></thead>
          <tbody>
            {[1,2,3,4,5].map(i=>(
              <tr key={i}>
                {[70,60,120,50,60,30].map((w,j)=>(
                  <td key={j}><div style={{ height:12, width:w, background:"var(--s3)", borderRadius:4, className:"skeleton" }}/></td>
                ))}
              </tr>
            ))}
          </tbody></table>
        </div>
      ) : scrims.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>≡</div>
          <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>No Scrims Yet</div>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button className="btn btn-ghost" onClick={()=>{ setShowJsonUpload(true); resetJsonUpload(); }}>📂 Upload JSON</button>
            <button className="btn btn-ghost" onClick={()=>{ setShowImport(true); resetImport(); }} style={{ display:"none" }}>⬇ Import from Riot</button>
            <button className="btn btn-acc" onClick={()=>setPage("tracker")}><div className="ldot"/> Start Tracking</button>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          {/* Header */}
          <div style={{ display:"grid", gridTemplateColumns:"180px 200px 120px 100px 420px 110px 36px", alignItems:"center", padding:"0 16px", height:34, borderBottom:"1px solid var(--b2)", background:"var(--s1)" }}>
            {["DATE & MAP","OPPONENT","SCORE","RESULT","AGENTS","ROUNDS",""].map((h,i)=>(
              <div key={i} style={{ fontSize:10, fontWeight:700, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.08em" }}>{h}</div>
            ))}
          </div>
          {filtered.map(s=>{
            const isWin = s.res==="win"||s.res==="W";
            const isDraw = s.res==="draw"||s.res==="D";
            const ps = (() => { try { return Array.isArray(s.player_stats)?s.player_stats:JSON.parse(s.player_stats||"[]"); } catch{ return []; } })();
            const ourAgents   = ps.filter(p=>p.side==="blue").map(p=>p.agent).filter(Boolean);
            const theirAgents = ps.filter(p=>p.side==="red").map(p=>p.agent).filter(Boolean);
            const rds = (() => { try { return Array.isArray(s.rounds)?s.rounds:JSON.parse(s.rounds||"[]"); } catch{ return []; } })();
            const atkFirst = s.atk_first != null ? s.atk_first : true;
            const h1 = rds.slice(0,12); const h2 = rds.slice(12);
            const h1W = h1.filter(r=>r==="w"||r==="win"||r===true||r==="W").length;
            const h2W = h2.filter(r=>r==="w"||r==="win"||r===true||r==="W").length;
            const atkW = atkFirst?h1W:h2W; const atkT = atkFirst?h1.length:h2.length;
            const defW = atkFirst?h2W:h1W; const defT = atkFirst?h2.length:h1.length;
            const [ourSc, theirSc] = (s.score||"0-0").split("-").map(Number);
            const mapSplash = {
              Ascent:"https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",
              Split:"https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
              Fracture:"https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",
              Bind:"https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",
              Breeze:"https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",
              Abyss:"https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",
              Lotus:"https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png",
              Sunset:"https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png",
              Pearl:"https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png",
              Icebox:"https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png",
              Haven:"https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png",
              Corrode:"https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/splash.png",
            }[s.map];
            return (
              <div key={s.id}
                style={{display:"grid",gridTemplateColumns:"180px 200px 120px 100px 420px 110px 36px",alignItems:"center",borderBottom:"1px solid var(--b2)",cursor:"pointer",transition:"background 0.12s",minHeight:64}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                onClick={async()=>{ trackActivity({ type:"scrim", label:`vs ${s.opp}`, sub:`${s.map} · ${s.date} · ${s.score}`, page:"scrimlog", id:s.id }); setEditing(false); setSel(s); setSelTab("scoreboard"); const full=await api.get(`/api/scrims/${s.id}`).catch(()=>null); if(full&&full.id) setSel(full); }}
              >
                {/* Map backdrop + date */}
                <div style={{position:"relative",height:64,overflow:"hidden",flexShrink:0,borderRadius:"4px 0 0 4px"}}>
                  {mapSplash && <img src={mapSplash} alt={s.map} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",objectPosition:"60% center",opacity:0.7}}/>}
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to right,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0.15) 100%)"}}/>
                  <div style={{position:"relative",zIndex:1,padding:"6px 12px",height:"100%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                    <span style={{fontSize:11,fontWeight:900,color:"#fff",textTransform:"uppercase",letterSpacing:"0.06em",textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{s.map}</span>
                    <span className="mono" style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.95)",marginTop:1,textShadow:"0 1px 4px rgba(0,0,0,0.8)"}}>{s.date}</span>
                    <span style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:1}}>{s.source==="riot_raw"||s.source==="riot"?"JSON":s.source==="ocr"?"OCR":"manual"}</span>
                    <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                      {s.is_official && <span style={{fontSize:8,fontWeight:900,letterSpacing:"0.08em",color:"#FFD700",background:"rgba(255,215,0,0.15)",border:"1px solid rgba(255,215,0,0.4)",borderRadius:3,padding:"1px 5px",textTransform:"uppercase"}}>OFFICIAL</span>}
                      <span
                        onClick={async e=>{
                          e.stopPropagation();
                          const newVal = !s.is_official;
                          await api.patch(`/api/scrims/${s.id}/official`, { is_official: newVal }).catch(()=>{});
                          setScrims(p=>p.map(x=>x.id===s.id?{...x,is_official:newVal}:x));
                          if(sel?.id===s.id) setSel(x=>({...x,is_official:newVal}));
                        }}
                        title={s.is_official?"Remove official flag":"Mark as official"}
                        style={{fontSize:9,cursor:"pointer",color:s.is_official?"rgba(255,215,0,0.6)":"rgba(255,255,255,0.25)",transition:"color 0.15s"}}
                        onMouseEnter={e=>e.currentTarget.style.color=s.is_official?"rgba(255,80,80,0.8)":"#FFD700"}
                        onMouseLeave={e=>e.currentTarget.style.color=s.is_official?"rgba(255,215,0,0.6)":"rgba(255,255,255,0.25)"}
                      >🏆</span>
                    </div>
                  </div>
                </div>
                {/* Opponent */}
                <div style={{padding:"0 12px",fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  <span onClick={e=>{e.stopPropagation();setTeamOverview({opp:s.opp});}} 
                    style={{cursor:"pointer",color:"#4fc3f7",background:"rgba(79,195,247,0.08)",border:"1px solid rgba(79,195,247,0.5)",borderRadius:4,padding:"2px 7px",fontSize:12,transition:"all 0.15s"}}
                    onMouseEnter={e=>{ e.currentTarget.style.background="rgba(79,195,247,0.18)"; e.currentTarget.style.boxShadow="0 0 8px rgba(79,195,247,0.4)"; e.currentTarget.style.borderColor="rgba(79,195,247,0.9)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.background="rgba(79,195,247,0.08)"; e.currentTarget.style.boxShadow=""; e.currentTarget.style.borderColor="rgba(79,195,247,0.5)"; }}
                    title={`View overview vs ${s.opp}`}>{s.opp}</span>
                </div>
                {/* Score */}
                <div style={{padding:"0 4px",display:"flex",alignItems:"baseline",gap:3}}>
                  <span className="bc" style={{fontSize:22,fontWeight:900,color:isWin?"var(--green)":isDraw?"var(--acc)":"var(--red)"}}>{ourSc}</span>
                  <span style={{fontSize:14,color:"var(--t3)",fontWeight:300}}>–</span>
                  <span className="bc" style={{fontSize:22,fontWeight:900,color:"var(--t2)"}}>{theirSc}</span>
                </div>
                {/* Result */}
                <div style={{padding:"0 4px"}}>
                  <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:20,
                    background:isWin?"rgba(105,240,174,0.12)":isDraw?"rgba(212,255,30,0.1)":"rgba(255,80,80,0.12)",
                    color:isWin?"var(--green)":isDraw?"var(--acc)":"var(--red)",
                    border:`1px solid ${isWin?"rgba(105,240,174,0.25)":isDraw?"rgba(212,255,30,0.2)":"rgba(255,80,80,0.25)"}`}}>
                    {isWin?"WIN":isDraw?"DRAW":"LOSS"}
                  </span>
                </div>
                {/* Agents + Rounds */}
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 8px"}}>
                  {/* Our agents */}
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Ours</div>
                    <div style={{display:"flex",gap:2}}>
                      {ourAgents.length>0?ourAgents.slice(0,5).map((a,i)=><AgentBadge key={i} name={a} size={26}/>):<span style={{fontSize:11,color:"var(--t3)"}}>–</span>}
                    </div>
                  </div>
                  <div style={{width:1,height:32,background:"var(--b2)",flexShrink:0}}/>
                  {/* Their agents */}
                  <div style={{display:"flex",flexDirection:"column",gap:3}}>
                    <div style={{fontSize:9,color:"var(--t3)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>Theirs</div>
                    <div style={{display:"flex",gap:2}}>
                      {theirAgents.length>0?theirAgents.slice(0,5).map((a,i)=><AgentBadge key={i} name={a} size={26}/>):<span style={{fontSize:11,color:"var(--t3)"}}>–</span>}
                    </div>
                  </div>
                </div>
                {/* ATK / DEF rounds — own column */}
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"center",gap:4,padding:"0 8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:9,fontWeight:700,color:"#fb923c",textTransform:"uppercase",letterSpacing:"0.05em",width:24}}>ATK</span>
                    <span style={{fontSize:18,fontWeight:900,color:"#fb923c",lineHeight:1}}>{atkT?atkW:"–"}</span>
                    <span style={{fontSize:11,color:"var(--t3)"}}>/{atkT||"–"}</span>
                  </div>
                  <div style={{width:"80%",height:1,background:"var(--b2)"}}/>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:9,fontWeight:700,color:"#4fc3f7",textTransform:"uppercase",letterSpacing:"0.05em",width:24}}>DEF</span>
                    <span style={{fontSize:18,fontWeight:900,color:"#4fc3f7",lineHeight:1}}>{defT?defW:"–"}</span>
                    <span style={{fontSize:11,color:"var(--t3)"}}>/{defT||"–"}</span>
                  </div>
                </div>
                {/* Delete */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <button className="btn btn-red" style={{padding:"3px 8px",fontSize:11}} onClick={e=>{e.stopPropagation();del(s.id);}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {sel && (() => {
        const rounds = (()=>{ try { const r=Array.isArray(sel.rounds)?sel.rounds:JSON.parse(sel.rounds||"[]"); return r.map(x=>typeof x==="string"?{res:x,eco:""}:x); } catch{ return []; } })();
        const detail = (()=>{ try { const d = sel.round_detail; return Array.isArray(d)?d:JSON.parse(d||"[]"); } catch{ return []; } })();
        const playerStats = (() => {
          try {
            const raw = Array.isArray(sel.player_stats) ? sel.player_stats : JSON.parse(sel.player_stats||"[]");
            const detailNameMap = {};
            detail.forEach(rd => {
              (rd.kills || []).forEach(k => {
                if (k.killerPuuid && k.killerName && k.killerName !== "?") detailNameMap[k.killerPuuid] = k.killerName;
                if (k.victimPuuid && k.victimName && k.victimName !== "?") detailNameMap[k.victimPuuid] = k.victimName;
              });
              if (rd.firstBlood) {
                if (rd.firstBlood.killerPuuid && rd.firstBlood.killerName && rd.firstBlood.killerName !== "?") detailNameMap[rd.firstBlood.killerPuuid] = rd.firstBlood.killerName;
                if (rd.firstBlood.victimPuuid && rd.firstBlood.victimName && rd.firstBlood.victimName !== "?") detailNameMap[rd.firstBlood.victimPuuid] = rd.firstBlood.victimName;
              }
            });
            return raw.map((p, i) => {
              if (p.name && p.name !== "#" && !p.name.startsWith("#")) return p;
              const gn = p.gameName || p.riotIdGameName || (p.identity && p.identity.gameName) || p.displayName || "";
              const tl = p.tagLine || p.riotIdTagline || p.riotIdTagLine || (p.identity && p.identity.tagLine) || p.tag || "";
              const fromDetail = p.puuid ? detailNameMap[p.puuid] : null;
              const resolved = gn ? (tl ? gn + "#" + tl : gn) : (fromDetail || tl || (p.puuid && p.puuid.slice(0, 8)) || ("Player " + (i + 1)));
              return Object.assign({}, p, { name: resolved });
            });
          } catch { return []; }
        })();
        const blueStats   = playerStats.filter(p=>p.side==="blue");
        const redStats    = playerStats.filter(p=>p.side==="red");
        const hasStats    = playerStats.length > 0;

        // Calculate OSR on the fly from stored round_detail + player_stats
        const osrRatings = calculateOSRFromStored(detail, playerStats);
        const playerStatsWithOsr = playerStats.map(p => ({
          ...p,
          osr: p.osr ?? (osrRatings[p.puuid] ?? osrRatings[p.name] ?? null),
        }));
        const blueStatsOsr = playerStatsWithOsr.filter(p=>p.side==="blue");
        const redStatsOsr  = playerStatsWithOsr.filter(p=>p.side==="red");
        const isWin = sel.res==="win"||sel.res==="W";

        // ── Editable cell helper ──
        const ECell = ({ value, onChange, type="number", width=44, color }) => (
          <input
            type={type}
            defaultValue={value}
            onChange={e => onChange(type==="number" ? Number(e.target.value) : e.target.value)}
            style={{
              width, background:"var(--b2)", border:"1px solid var(--acc)", borderRadius:3,
              color: color||"var(--t1)", fontSize:11, fontWeight:600, textAlign:"center",
              padding:"1px 3px", outline:"none"
            }}
          />
        );

        const ScoreRow = ({p, onEdit, editing}) => (
          <tr>
            <td>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <AgentBadge name={p.agent} size={22}/>
                <span className="mono" style={{ fontSize:11, color:"var(--t2)" }}>{(() => { const parts = (p.name||"").split("#"); return parts[0] || parts[1] || "—"; })()}</span>
              </div>
            </td>
            {editing ? (<>
              <td style={{textAlign:"right"}}><ECell value={p.acs}         onChange={v=>onEdit("acs",v)}         color="var(--acc)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.kills}       onChange={v=>onEdit("kills",v)}/></td>
              <td style={{textAlign:"right"}}><ECell value={p.deaths}      onChange={v=>onEdit("deaths",v)}      color="var(--t3)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.assists}     onChange={v=>onEdit("assists",v)}     color="var(--t3)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.kd}          onChange={v=>onEdit("kd",v)}          color={p.kd>=1?"var(--green)":"var(--red)"}/></td>
              <td style={{textAlign:"right"}}><ECell value={p.hsRate}      onChange={v=>onEdit("hsRate",v)}      color="var(--t2)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.firstBloods} onChange={v=>onEdit("firstBloods",v)} color="var(--green)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.firstDeaths || 0} onChange={v=>onEdit("firstDeaths",v)} color="var(--red)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.plants}      onChange={v=>onEdit("plants",v)}      color="var(--t3)"/></td>
              <td style={{textAlign:"right"}}><ECell value={p.defuses}     onChange={v=>onEdit("defuses",v)}     color="var(--t3)"/></td>
              <td style={{textAlign:"right"}}>
                {[p.mk5,p.mk4,p.mk3,p.mk2].map((v,i)=>v>0?(
                  <span key={i} style={{ marginRight:3, fontWeight:700, fontSize:10,
                    color: i===0?"#ffd700": i===1?"#ff5252": i===2?"var(--acc)":"var(--t3)" }}>
                    {["5K","4K","3K","2K"][i]}×{v}
                  </span>
                ):null)}
                {!p.mk2&&!p.mk3&&!p.mk4&&!p.mk5 && <span style={{color:"var(--t3)"}}>—</span>}
              </td>
              <td style={{textAlign:"right"}}><ECell value={p.clutchWon} onChange={v=>onEdit("clutchWon",v)} color={p.clutchWon>0?"var(--green)":"var(--t3)"}/></td>
            </>) : (<>
              <td style={{ textAlign:"right", fontWeight:700, color:"var(--acc)" }}>{p.acs}</td>
              <td style={{ textAlign:"right" }}>{p.kills}</td>
              <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.deaths}</td>
              <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.assists}</td>
              <td style={{ textAlign:"right", fontWeight:600, color: p.kd>=1?"var(--green)":"var(--red)" }}>{p.kd}</td>
              <td style={{ textAlign:"right", color:"var(--t2)" }}>{p.hsRate ?? "—"}%</td>
              <td style={{ textAlign:"right", color: p.firstBloods>0?"var(--green)":"var(--t3)" }}>{p.firstBloods ?? "—"}</td>
              <td style={{ textAlign:"right", color: (p.firstDeaths||0)>0?"var(--red)":"var(--t3)" }}>{p.firstDeaths ?? "—"}</td>
              <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.plants ?? "—"}</td>
              <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.defuses ?? "—"}</td>
              <td style={{ textAlign:"right" }}>
                {[p.mk5,p.mk4,p.mk3,p.mk2].map((v,i)=>v>0?(
                  <span
  key={i}
  style={{
    marginRight: 3,
    fontWeight: 700,
    fontSize: 10,
    color:
      i === 0
        ? "#ffd700"
        : i === 1
        ? "#ff5252"
        : i === 2
        ? "var(--acc)"
        : "var(--t3)"
  }}>
                    {["5K","4K","3K","2K"][i]}×{v}
                  </span>
                ):null)}
                {!p.mk2&&!p.mk3&&!p.mk4&&!p.mk5 && <span style={{color:"var(--t3)"}}>—</span>}
              </td>
              <td style={{ textAlign:"right", color: p.clutchWon>0?"var(--green)":"var(--t3)" }}>{p.clutchWon ?? "—"}</td>
              {p.osr != null && (
                <td style={{ textAlign:"right", fontWeight:700, color: p.osr > 0 ? "var(--green)" : p.osr < -0.5 ? "var(--red)" : "var(--t2)", minWidth:48 }}>
                  {p.osr > 0 ? "+" : ""}{p.osr.toFixed(2)}
                </td>
              )}
            </>)}
          </tr>
        );

        // ── Edit state ──

        const startEdit = () => {
          // Deep-clone playerStats into draft
          draftRef.current = playerStats.map(p => ({...p}));
          setEditing(true);
          setSaveErr("");
        };

        const cancelEdit = () => { setEditing(false); setSaveErr(""); };

        const onEditCell = (playerName, field, value) => {
          if (!draftRef.current) return;
          const p = draftRef.current.find(x => x.name === playerName);
          if (p) p[field] = value;
        };

        const saveEdits = async () => {
          if (!draftRef.current) return;
          setSaving(true);
          setSaveErr("");
          const newOpp = (draftOppRef.current || sel.opp).trim() || sel.opp;
          try {
            await api.put(`/api/scrims/${sel.id}`, {
              date: sel.date, map: sel.map, opp: newOpp,
              comp: sel.comp, score: sel.score, res: sel.res,
              rounds: sel.rounds, source: sel.source||"manual",
              player_stats: JSON.stringify(draftRef.current),
              round_detail: sel.round_detail || "[]",
            });
            // Update sel and scrims list so view reflects changes immediately
            setSel(prev => ({ ...prev, player_stats: JSON.stringify(draftRef.current), opp: newOpp }));
            setScrims(prev => prev.map(s => s.id===sel.id ? {...s, opp: newOpp} : s));
            setEditing(false);
          } catch(e) {
            setSaveErr(e.message || "Save failed");
          } finally {
            setSaving(false);
          }
        };

        // Round-by-round view
        const ecoColor = lbl => lbl==="Pistol"?"#b39ddb":lbl==="Full"?"var(--acc)":lbl==="Half"?"#4fc3f7":lbl==="Eco"?"#ff5555":"var(--t3)";
        const RoundRow = ({rd, idx, pip}) => {
          const won = (typeof pip==="object" ? pip?.res : pip) === "w";
          const site = rd.site;
          const fb = rd.firstBlood;
          const ourTeamSide = blueStats[0]?.team || "Blue";
          const weGotFB = fb ? fb.killerTeam === ourTeamSide : null;

          // True FK / FD
          let isTrueFB = false;
          if (fb && weGotFB) {
            const kills = rd.kills || [];
            const sorted = [...kills].sort((a,b)=>(a.time||0)-(b.time||0));
            const firstKill = sorted[0];
            if (firstKill) {
              const tradeWin = (firstKill.time||0) + TRADE_WINDOW_MS;
              const traded = sorted.slice(1).some(k =>
                (k.time||0) <= tradeWin &&
                k.killerTeam !== firstKill.killerTeam &&
                (firstKill.killerPuuid && k.victimPuuid ? k.victimPuuid === firstKill.killerPuuid : k.victimName === firstKill.killerName));
              isTrueFB = !traded;
            }
          }

          // Side label
          const af = sel.atk_first != null ? sel.atk_first : true;
          const isFirstHalf = idx < 12;
          const side = isFirstHalf ? (af ? "ATK" : "DEF") : (af ? "DEF" : "ATK");
          const sideColor = side === "ATK" ? "#fb923c" : "#4fc3f7";

          const delta = rd.ourAvgLoad != null ? rd.ourAvgLoad - rd.theirAvgLoad : null;
          const deltaColor = delta == null ? "var(--t3)" : delta > 0 ? "var(--green)" : delta < 0 ? "var(--red)" : "var(--t2)";
          const typeColor = rd.roundType === "Anti-eco" ? "#ff5555" : rd.roundType === "Pistol" ? "#b39ddb" : rd.roundType === "Eco" ? "#ffb347" : "var(--t3)";
          const siteColor = site==="A" ? "#a78bfa" : site==="B" ? "#f87171" : site==="C" ? "#34d399" : "#fb923c";

          return (
            <div style={{
              display:"grid",
              gridTemplateColumns:"32px 56px 140px 140px 80px 90px 44px 36px 44px 56px",
              alignItems:"center",
              gap:0,
              padding:"6px 16px",
              borderBottom:"1px solid var(--b2)",
              background: won ? "rgba(105,240,174,0.03)" : "rgba(255,82,82,0.03)",
              borderLeft: `3px solid ${won?"var(--green)":"var(--red)"}`,
            }}>
              {/* # */}
              <div style={{ fontSize:11, fontWeight:800, color:"var(--t3)", textAlign:"center" }}>{idx+1}</div>

              {/* SIDE */}
              <div>
                <span style={{ fontSize:10, fontWeight:900, color:sideColor, letterSpacing:"0.06em" }}>{side}</span>
              </div>

              {/* OUR LOADOUT */}
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                {rd.ourAvgLoad != null ? <>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--t1)" }}>{rd.ourAvgLoad.toLocaleString()}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:ecoColor(rd.ourEcoLabel), background:`${ecoColor(rd.ourEcoLabel)}18`, border:`1px solid ${ecoColor(rd.ourEcoLabel)}44`, borderRadius:3, padding:"1px 5px" }}>{rd.ourEcoLabel}</span>
                </> : <span style={{ fontSize:10, color:"var(--t3)" }}>—</span>}
              </div>

              {/* THEIR LOADOUT */}
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                {rd.theirAvgLoad != null ? <>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--t2)" }}>{rd.theirAvgLoad.toLocaleString()}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:ecoColor(rd.theirEcoLabel), background:`${ecoColor(rd.theirEcoLabel)}18`, border:`1px solid ${ecoColor(rd.theirEcoLabel)}44`, borderRadius:3, padding:"1px 5px" }}>{rd.theirEcoLabel}</span>
                </> : <span style={{ fontSize:10, color:"var(--t3)" }}>—</span>}
              </div>

              {/* DELTA */}
              <div>
                {delta != null
                  ? <span style={{ fontSize:11, fontWeight:800, color:deltaColor }}>{delta>0?"+":""}{delta.toLocaleString()}</span>
                  : <span style={{ fontSize:10, color:"var(--t3)" }}>—</span>}
              </div>

              {/* TYPE */}
              <div>
                {rd.roundType
                  ? <span style={{ fontSize:10, fontWeight:800, color:typeColor }}>{rd.roundType}</span>
                  : <span style={{ fontSize:10, color:"var(--t3)" }}>—</span>}
              </div>

              {/* SITE */}
              <div style={{ textAlign:"center" }}>
                {site
                  ? <span style={{ fontSize:11, fontWeight:900, color:siteColor }}>{site}</span>
                  : <span style={{ fontSize:10, color:"var(--t3)" }}>—</span>}
              </div>

              {/* FK */}
              <div style={{ textAlign:"center" }}>
                {fb != null
                  ? <span style={{ fontSize:10, fontWeight:800, color:weGotFB?"var(--green)":"var(--red)" }}>{weGotFB?"Y":"N"}</span>
                  : <span style={{ fontSize:10, color:"var(--t3)" }}>N</span>}
              </div>

              {/* TRUE (true FK/FD) */}
              <div style={{ textAlign:"center" }}>
                {fb != null
                  ? <span style={{ fontSize:10, fontWeight:800, color:isTrueFB?"var(--green)":"var(--t3)" }}>{isTrueFB?"Y":"N"}</span>
                  : <span style={{ fontSize:10, color:"var(--t3)" }}>N</span>}
              </div>

              {/* RESULT */}
              <div style={{ textAlign:"center" }}>
                <span style={{ fontSize:12, fontWeight:900, color:won?"var(--green)":"var(--red)" }}>{won?"W":"L"}</span>
              </div>
            </div>
          );
        };

        return ReactDOM.createPortal(
          <div style={{ position:"fixed", inset:0, zIndex:9999, background:"var(--s1)", overflowY:"auto", display:"flex", flexDirection:"column" }} ref={el=>{ if(el) el.scrollTop=0; }}>
            {/* Discard Changes confirm */}
            {confirmDiscard && (
              <div style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setConfirmDiscard(false)}>
                <div style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:12,padding:"28px 32px",width:380,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}} onClick={e=>e.stopPropagation()}>
                  <div className="bc" style={{fontSize:20,fontWeight:700,marginBottom:12}}>Discard Changes?</div>
                  <div style={{fontSize:14,color:"var(--t2)",marginBottom:24}}>You have unsaved changes. Are you sure you want to discard them?</div>
                  <div style={{display:"flex",gap:8}}>
                    <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setConfirmDiscard(false)}>Cancel</button>
                    <button className="btn btn-red" style={{flex:1,justifyContent:"center"}} onClick={()=>{ setConfirmDiscard(false); setEditing(false); setSel(null); }}>Discard</button>
                  </div>
                </div>
              </div>
            )}
            {/* Header */}
            <div style={{ padding:"12px 32px", borderBottom:"1px solid var(--b2)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                {editing ? (
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span className="bc" style={{ fontSize:18, fontWeight:800, color:"var(--t3)" }}>vs</span>
                    <input
                      type="text"
                      defaultValue={sel.opp}
                      onChange={e=>{ draftOppRef.current = e.target.value; }}
                      style={{ fontSize:20, fontWeight:800, background:"var(--s2)", border:"1px solid var(--acc)", borderRadius:6, padding:"4px 10px", color:"var(--t1)", width:200 }}
                      placeholder="Opponent name"
                    />
                  </div>
                ) : (
                  <span className="bc" style={{ fontSize:24, fontWeight:800 }}>vs {sel.opp}</span>
                )}
                <span className="chip chip-blue">{sel.map}</span>
                <span className={`chip ${isWin?"chip-green":"chip-red"}`}>{isWin?"▲ Win":"▼ Loss"}</span>
                <span style={{ color:"var(--t3)", fontSize:12 }}>{sel.date}</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span className="bc" style={{ fontSize:40, fontWeight:900, color:isWin?"var(--green)":"var(--red)" }}>{sel.score}</span>
                {hasStats && (<>
                  {editing ? (<>
                    {saveErr && <span style={{fontSize:11,color:"var(--red)"}}>{saveErr}</span>}
                    <button className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>Cancel</button>
                    <button className="btn btn-acc" onClick={saveEdits} disabled={saving} style={{padding:"6px 16px"}}>
                      {saving ? "Saving…" : "✓ Save"}
                    </button>
                  </>) : (<>
                    <button className="btn btn-ghost" onClick={startEdit} style={{fontSize:12}}>✏ Edit Stats</button>
                    {hasStats && playerStats.some(p => p.adr == null) && (
                      <>
                        <input ref={patchAdrInputRef} type="file" accept=".json" style={{display:"none"}}
                          onChange={e => { handlePatchAdr(e.target.files?.[0]); e.target.value=""; }} />
                        <button className="btn btn-ghost" style={{fontSize:12, color:"var(--orange)"}}
                          onClick={() => patchAdrInputRef.current?.click()}
                          disabled={patchingAdr}>
                          {patchingAdr ? "Patching…" : "⚡ Patch ADR"}
                        </button>
                      </>
                    )}
                    {/* Fix Names button removed - provides no value
                    {hasStats && playerStats.some(p => !p.name || p.name.match(/^[0-9a-f]{8}$/) || p.name === "#" || p.name.startsWith("Player ")) && (
                      <>
                        <input ref={fixNamesInputRef} type="file" accept=".json" style={{display:"none"}}
                          onChange={e => { handleFixNames(e.target.files?.[0]); e.target.value=""; }} />
                        <button className="btn btn-ghost" style={{fontSize:12, color:"var(--green)"}}
                          onClick={() => fixNamesInputRef.current?.click()}
                          disabled={fixingNames}>
                          {fixingNames ? "Fixing…" : "🔧 Fix Names"}
                        </button>
                      </>
                    )}
                    */}
                  </>)}
                </>)}
                <button className="btn btn-ghost" style={{ fontSize:20, padding:"4px 16px", marginLeft:8 }} onClick={()=>{
                  if(editing){ setConfirmDiscard(true); } else { setSel(null); }
                }}>✕</button>
              </div>
            </div>

            {/* Round pip bar */}
            <div style={{ padding:"8px 32px", borderBottom:"1px solid var(--b2)", flexShrink:0 }}>
              {(()=>{
                const pipAtkFirst = sel.atk_first != null ? sel.atk_first : true;
                const h1 = { label: pipAtkFirst ? "ATK" : "DEF", color: pipAtkFirst ? "#fb923c" : "#4fc3f7" };
                const h2 = { label: pipAtkFirst ? "DEF" : "ATK", color: pipAtkFirst ? "#4fc3f7" : "#fb923c" };
                const h1Rounds = rounds.slice(0, 12);
                const h2Rounds = rounds.slice(12);
                const PipGroup = ({rds, offset, sideLabel, sideColor}) => (
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <div style={{ fontSize:7, fontWeight:900, color:sideColor, letterSpacing:"0.08em", lineHeight:1, paddingLeft:1 }}>{sideLabel}</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:4, alignItems:"flex-start" }}>
                      {rds.map((r,i) => {
                        const rd = detail[offset+i] || {};
                        const site = rd.site;
                        return (
                          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1 }}>
                            <div className={`pip pip-${typeof r==="object"?r.res:r}`}>{offset+i+1}</div>
                            {site
                              ? <div style={{ fontSize:8, fontWeight:700, color:site==="A"?"#a78bfa":site==="B"?"#f87171":site==="C"?"#34d399":"#fb923c" }}>{site}</div>
                              : <div style={{ height:10 }}/>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
                return (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                    <PipGroup rds={h1Rounds} offset={0} sideLabel={h1.label} sideColor={h1.color}/>
                    {h2Rounds.length > 0 && <PipGroup rds={h2Rounds} offset={12} sideLabel={h2.label} sideColor={h2.color}/>}
                  </div>
                );
              })()}
            </div>

            {/* Tab bar */}
            <div style={{ display:"flex", gap:0, borderBottom:"1px solid var(--b2)", flexShrink:0 }}>
              {[["scoreboard","📊 Scoreboard"],["rounds","🗺 Round by Round"],["stats","📈 Round Stats"],["xvy","⚔ XvY"],["analytics","🔬 Analytics"]].map(([key,label])=>(
                <button key={key} onClick={()=>setSelTab(key)} style={{
                  padding:"10px 20px", fontSize:12, fontWeight:700, letterSpacing:"0.05em",
                  background:"none", border:"none", cursor:"pointer",
                  color: selTab===key?"var(--acc)":"var(--t3)",
                  borderBottom: selTab===key?"2px solid var(--acc)":"2px solid transparent",
                  transition:"all 0.15s"
                }}>{label}</button>
              ))}
            </div>

            {/* Content */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"0 32px 16px", overflowY:"auto" }}>

              {selTab==="scoreboard" && (<>
                {hasStats ? (<>
                  <div style={{ paddingTop:12 }}>
                    <table className="tbl tbl-compact" style={{ width:"100%" }}>
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th style={{textAlign:"right"}}>ACS</th>
                          <th style={{textAlign:"right"}}>K</th>
                          <th style={{textAlign:"right"}}>D</th>
                          <th style={{textAlign:"right"}}>A</th>
                          <th style={{textAlign:"right"}}>K/D</th>
                          <th style={{textAlign:"right"}}>HS%</th>
                          <th style={{textAlign:"right"}}>FB</th>
                          <th style={{textAlign:"right"}}>FD</th>
                          <th style={{textAlign:"right"}}>↑Plant</th>
                          <th style={{textAlign:"right"}}>↓Def</th>
                          <th style={{textAlign:"right"}}>Multi</th>
                          <th style={{textAlign:"right"}}>Clutch</th>
                          <th style={{textAlign:"right", color:"var(--acc)"}}>OSR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Our Team Section */}
                        <tr style={{ background:"var(--s2)" }}>
                          <td colSpan="14" style={{ padding:"6px 12px", fontSize:10, fontWeight:800, color:"var(--acc)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                            Our Team
                          </td>
                        </tr>
                        {blueStatsOsr.map((p,i)=><ScoreRow key={`blue-${i}`} p={p} editing={editing} onEdit={(f,v)=>onEditCell(p.name,f,v)}/>)}
                        {/* Opponents Section */}
                        <tr style={{ background:"var(--s2)" }}>
                          <td colSpan="14" style={{ padding:"6px 12px", fontSize:10, fontWeight:800, color:"var(--red)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                            Opponents
                          </td>
                        </tr>
                        {redStatsOsr.map((p,i)=><ScoreRow key={`red-${i}`} p={p} editing={editing} onEdit={(f,v)=>onEditCell(p.name,f,v)}/>)}
                      </tbody>
                    </table>
                  </div>
                </>) : (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:14, paddingTop:60, gap:10 }}>
                    <div style={{ fontSize:32 }}>📊</div>
                    <div>No scoreboard data — use Upload JSON or Import from Riot to get full stats.</div>
                    <button className="btn btn-ghost" style={{ marginTop:8 }} onClick={()=>{ setSel(null); setShowJsonUpload(true); resetJsonUpload(); }}>📂 Upload JSON</button>
                  </div>
                )}
              </>)}

              {selTab==="rounds" && (<>
                {detail.length > 0 ? (<>
                  {/* Column headers */}
                  <div style={{
                    display:"grid",
                    gridTemplateColumns:"32px 56px 140px 140px 80px 90px 44px 36px 44px 56px",
                    gap:0, padding:"8px 16px",
                    borderBottom:"2px solid var(--b2)",
                    marginTop:8,
                  }}>
                    {["#","SIDE","OUR LOADOUT","THEIR LOADOUT","DELTA","TYPE","SITE","FK","TRUE","RESULT"].map(h=>(
                      <div key={h} style={{ fontSize:9, fontWeight:800, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>{h}</div>
                    ))}
                  </div>
                  {/* Half 1 */}
                  {(()=>{
                    const af = sel.atk_first != null ? sel.atk_first : true;
                    const h1Side = af ? "ATK" : "DEF";
                    const h2Side = af ? "DEF" : "ATK";
                    const h1Color = af ? "#fb923c" : "#4fc3f7";
                    const h2Color = af ? "#4fc3f7" : "#fb923c";
                    return (<>
                      <div style={{ marginTop:4, marginBottom:2, padding:"4px 16px", display:"flex", alignItems:"center", gap:8 }}>
                        <span style={{ fontSize:10, fontWeight:800, color:"var(--t3)", letterSpacing:"0.1em" }}>HALF 1</span>
                        <span style={{ fontSize:9, fontWeight:900, color:h1Color, letterSpacing:"0.1em", padding:"1px 6px", borderRadius:3, background:`${h1Color}18`, border:`1px solid ${h1Color}44` }}>{h1Side}</span>
                      </div>
                      {rounds.slice(0,12).map((pip,i) => (
                        <RoundRow key={i} rd={detail[i]||{}} idx={i} pip={pip}/>
                      ))}
                      {rounds.length > 12 && (<>
                        <div style={{ margin:"8px 0 2px", padding:"4px 16px", display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, fontWeight:800, color:"var(--t3)", letterSpacing:"0.1em" }}>HALF 2</span>
                          <span style={{ fontSize:9, fontWeight:900, color:h2Color, letterSpacing:"0.1em", padding:"1px 6px", borderRadius:3, background:`${h2Color}18`, border:`1px solid ${h2Color}44` }}>{h2Side}</span>
                        </div>
                        {rounds.slice(12).map((pip,i) => (
                          <RoundRow key={i+12} rd={detail[i+12]||{}} idx={i+12} pip={pip}/>
                        ))}
                      </>)}
                    </>);
                  })()}
                </>) : (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:14, paddingTop:60, gap:10 }}>
                    <div style={{ fontSize:32 }}>🗺</div>
                    <div>No round detail data. Use Upload JSON to get full round-by-round breakdown.</div>
                    <button className="btn btn-ghost" style={{ marginTop:8 }} onClick={()=>{ setSel(null); setShowJsonUpload(true); resetJsonUpload(); }}>📂 Upload JSON</button>
                  </div>
                )}
              </>)}

              {selTab==="stats" && (<>
                {detail.length > 0 ? (() => {
                  const totalRounds = rounds.length;
                  const won = rounds.filter(r=>r.res==="w").length;

                  // FB rounds: rounds where our team got first blood
                  const ourTeamStatId = blueStats[0]?.team || "Blue";
                  const fbRounds    = detail.filter(rd => rd.firstBlood && rd.firstBlood.killerTeam === ourTeamStatId);
                  const fbWon       = fbRounds.filter((_,i) => rounds[detail.indexOf(fbRounds[i])]?.res === "w").length;
                  // FD rounds: rounds where our team gave up first blood
                  const fdRounds    = detail.filter(rd => rd.firstBlood && rd.firstBlood.victimTeam === ourTeamStatId);
                  const fdWon       = fdRounds.filter((_,i) => rounds[detail.indexOf(fdRounds[i])]?.res === "w").length;

                  // ── True FK / Untraded FK / Traded FD / Untraded FD round arrays ──
                  // Uses the kills array (sorted by time) for trade window logic
                  const nameMatchStat = (a, b) => {
                    if (!a || !b) return false;
                    return a === b || a.split('#')[0] === b || a === b.split('#')[0];
                  };
                  const tfkRoundNums = [], utfkRoundNums = [], tftRoundNums = [], utfdRoundNums = [];
                  detail.forEach((rd, rdIdx) => {
                    const kills = rd.kills || [];
                    if (!kills.length) return;
                    const sorted = [...kills].sort((a,b) => (a.time||0)-(b.time||0));
                    const firstKill = sorted[0];
                    if (!firstKill) return;
                    const weGotFK = firstKill.killerTeam === ourTeamStatId;
                    const tradeWindow = (firstKill.time || 0) + TRADE_WINDOW_MS;
                    const killerWasTraded = sorted.slice(1).some(k =>
                      (k.time||0) <= tradeWindow &&
                      k.killerTeam !== firstKill.killerTeam &&
                      (firstKill.killerPuuid && k.victimPuuid
                        ? k.victimPuuid === firstKill.killerPuuid
                        : (!firstKill.killerPuuid && !k.victimPuuid && nameMatchStat(k.victimName, firstKill.killerName))));
                    const rNum = (rd.roundNum != null ? rd.roundNum : rdIdx) + 1;
                    if (weGotFK) {
                      // True FK = we got first kill AND opponent didn't trade our killer
                      if (!killerWasTraded) tfkRoundNums.push(rNum);
                      // Untraded FK = same thing (alias for clarity)
                      else utfkRoundNums.push(rNum); // we got FK but got traded = "contested" — shown separately
                    } else {
                      // We gave first death
                      if (killerWasTraded) tftRoundNums.push(rNum);   // traded first death
                      else utfdRoundNums.push(rNum);                   // untraded first death
                    }
                  });
                  // Post-plant: rounds where we planted
                  const ourTeamId2  = "Red";
                  const _bAlive = rd => { const m = String(rd.xvy||"").match(/^(\d+)v(\d+)$/); return !m || (parseInt(m[1])>0 && parseInt(m[2])>0); };
                  const isMoneyPlantLocal = rd => {
                    if (!rd.planted || !rd.plantRoundTime) return false;
                    const lastKillTime = (rd.kills || []).reduce((max, k) => Math.max(max, k.time || 0), 0);
                    return rd.plantRoundTime > lastKillTime;
                  };
                  const ppRounds    = detail.filter(rd => rd.planted && rd.site && rd.planterTeam === ourTeamId2 && !isMoneyPlantLocal(rd));
                  const ppWon       = ppRounds.filter(rd => rd.winnerIsOurs).length;
                  // Pistol rounds (1 and 13)
                  const pistolIdxs  = [0, 12].filter(i => i < rounds.length);
                  const pistolWon   = pistolIdxs.filter(i => rounds[i]?.res === "w").length;
                  // Retakes: opp planted, we won
                  const retakeRounds = detail.filter(rd => rd.planted && rd.site && rd.planterTeam && rd.planterTeam !== ourTeamId2 && !isMoneyPlantLocal(rd));
                  const retakeWon   = retakeRounds.filter(rd => rd.winnerIsOurs).length;

                  const pct = (n, d) => d === 0 ? "—" : `${Math.round(n/d*100)}%`;
                  const StatCard = ({label, won, total, sub, color}) => (
                    <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"14px 18px", minWidth:140 }}>
                      <div style={{ fontSize:10, fontWeight:800, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
                      <div style={{ fontSize:32, fontWeight:900, color: color||"var(--acc)", fontFamily:"'DIN Next LT Pro',sans-serif", lineHeight:1 }}>{pct(won,total)}</div>
                      <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>{won}W / {total-won}L &nbsp;·&nbsp; {total} rounds</div>
                      {sub && <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>{sub}</div>}
                    </div>
                  );

                  // Expandable card with round number pills dropdown
                  const DropdownStatCard = ({label, won, total, sub, color, roundNums}) => {
                    const [open, setOpen] = React.useState(false);
                    return (
                      <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"14px 18px", minWidth:140, cursor: roundNums.length ? "pointer" : "default", userSelect:"none" }}
                        onClick={() => roundNums.length && setOpen(o => !o)}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ fontSize:10, fontWeight:800, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
                          {roundNums.length > 0 && <span style={{ fontSize:10, color:"var(--t3)", opacity:0.6, marginTop:1 }}>{open ? "▲" : "▼"}</span>}
                        </div>
                        <div style={{ fontSize:32, fontWeight:900, color: color||"var(--acc)", fontFamily:"'DIN Next LT Pro',sans-serif", lineHeight:1 }}>{pct(won,total)}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>{won}W / {total-won}L &nbsp;·&nbsp; {total} rounds</div>
                        {sub && <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>{sub}</div>}
                        {open && roundNums.length > 0 && (
                          <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--b1)" }}>
                            <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Rounds</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {roundNums.map(r => (
                                <span key={r} style={{ fontSize:10, fontWeight:700, color, background:`${color}18`, border:`1px solid ${color}40`, borderRadius:4, padding:"1px 6px" }}>R{r}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };

                  // Per-site post-plant & retake
                  const sites = [...new Set(detail.filter(rd=>rd.planted&&rd.site).map(rd=>rd.site))].sort();
                  const ppBySite = sites.map(s => {
                    const rds = ppRounds.filter(rd=>rd.site===s);
                    return { site:s, won:rds.filter(rd=>rd.winnerIsOurs).length, total:rds.length, rounds:rds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1) };
                  });
                  const retakeBySite = sites.map(s => {
                    const rds = retakeRounds.filter(rd=>rd.site===s);
                    return { site:s, won:rds.filter(rd=>rd.winnerIsOurs).length, total:rds.length, rounds:rds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1) };
                  });
                  const siteColor = s => s==="A"?"#a78bfa":s==="B"?"#f87171":s==="C"?"#34d399":"#fb923c";
                  const SiteRow = ({ site, won, total, rounds, barColor }) => {
                    const [open, setOpen] = React.useState(false);
                    const sc = siteColor(site);
                    return (
                      <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"10px 14px", cursor:rounds.length?"pointer":"default", userSelect:"none" }}
                        onClick={() => rounds.length && setOpen(o=>!o)}>
                        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                          <span style={{ fontSize:13, fontWeight:900, color:sc, minWidth:20 }}>{site}</span>
                          <div style={{ flex:1, height:4, borderRadius:2, background:"var(--b2)", overflow:"hidden" }}>
                            <div style={{ height:"100%", width:total>0?`${Math.round(won/total*100)}%`:"0%", background:barColor, borderRadius:2, transition:"width 0.4s" }}/>
                          </div>
                          <span style={{ fontSize:13, fontWeight:800, color:barColor, minWidth:36, textAlign:"right" }}>{total>0?`${Math.round(won/total*100)}%`:"—"}</span>
                          <span style={{ fontSize:10, color:"var(--t3)", minWidth:50 }}>{won}W / {total-won}L</span>
                          {rounds.length > 0 && <span style={{ fontSize:10, color:"var(--t3)", opacity:0.5, flexShrink:0 }}>{open?"▲":"▼"}</span>}
                        </div>
                        {open && rounds.length > 0 && (
                          <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--b1)" }}>
                            <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Rounds</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                              {rounds.map(r => (
                                <span key={r} style={{ fontSize:10, fontWeight:700, color:sc, background:`${sc}18`, border:`1px solid ${sc}40`, borderRadius:4, padding:"1px 6px" }}>R{r}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div style={{ paddingTop:16, display:"flex", flexDirection:"column", gap:20 }}>
                      <div>
                        <div className="label-sm" style={{ marginBottom:10 }}>Win Rate Breakdown</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                          <StatCard label="Overall WR"      won={won}        total={totalRounds}       color="var(--acc)"/>
                          <StatCard label="FK Round WR" won={fbWon} total={fbRounds.length} color="var(--green)" sub="Rounds where we got first kill"/>
                          <StatCard label="FD Round WR" won={fdWon} total={fdRounds.length} color="var(--red)" sub="Rounds where we got first death"/>
                          <StatCard label="Post-Plant WR"   won={ppWon}      total={ppRounds.length}   color="#4fc3f7"      sub="Rounds where we planted the spike"/>
                          <StatCard label="Retake WR"       won={retakeWon}  total={retakeRounds.length} color="#ffab40"   sub="Rounds where they planted, we defended"/>
                          <StatCard label="Pistol WR"       won={pistolWon}  total={pistolIdxs.length} color="#b39ddb"     sub="Rounds 1 and 13"/>
                        </div>
                      </div>

                      {/* Eco Type WR — only shown if rounds have eco data */}
                      {rounds.some(r=>r.eco) && (()=>{
                        const ecoTypes = ["Pistol","Full Buy","Eco","Force","Semi Buy","Bonus"];
                        const ecoColors = { "Pistol":"#b39ddb", "Full Buy":"var(--acc)", "Eco":"#ff5555", "Force":"#ffb347", "Semi Buy":"#4fc3f7", "Bonus":"#69f0ae" };
                        const ecoStats = ecoTypes.map(type => {
                          const rds = rounds.filter(r=>r.eco===type);
                          return { type, total:rds.length, won:rds.filter(r=>r.res==="w").length };
                        }).filter(e=>e.total>0);
                        if(!ecoStats.length) return null;
                        return (
                          <div>
                            <div className="label-sm" style={{ marginBottom:10 }}>Win Rate by Economy Type</div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                              {ecoStats.map(e=>(
                                <StatCard key={e.type} label={`${e.type} WR`} won={e.won} total={e.total} color={ecoColors[e.type]||"var(--t2)"} sub={`${e.total} round${e.total!==1?"s":""} on ${e.type}`}/>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Per-site post-plant & retake */}
                      {sites.length > 0 && (
                        <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                          {/* Post-plant by site */}
                          <div style={{ flex:1, minWidth:260 }}>
                            <div className="label-sm" style={{ marginBottom:10 }}>Post-Plant WR by Site</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                              {ppBySite.map(({site,won:sw,total:st})=>(
                                <div key={site} style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
                                  <span style={{ fontSize:13, fontWeight:900, color:siteColor(site), minWidth:20 }}>{site}</span>
                                  <div style={{ flex:1, height:4, borderRadius:2, background:"var(--b2)", overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:st>0?`${Math.round(sw/st*100)}%`:"0%", background:"#4fc3f7", borderRadius:2, transition:"width 0.4s" }}/>
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:800, color:"#4fc3f7", minWidth:36, textAlign:"right" }}>{st>0?`${Math.round(sw/st*100)}%`:"—"}</span>
                                  <span style={{ fontSize:10, color:"var(--t3)", minWidth:50 }}>{sw}W / {st-sw}L</span>
                                </div>
                              ))}
                              {ppBySite.length === 0 && <div style={{fontSize:11,color:"var(--t3)"}}>No plant data</div>}
                            </div>
                          </div>
                          {/* Retake by site */}
                          <div style={{ flex:1, minWidth:260 }}>
                            <div className="label-sm" style={{ marginBottom:10 }}>Retake WR by Site</div>
                            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                              {retakeBySite.filter(x=>x.total>0).map(({site,won:sw,total:st})=>(
                                <div key={site} style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
                                  <span style={{ fontSize:13, fontWeight:900, color:siteColor(site), minWidth:20 }}>{site}</span>
                                  <div style={{ flex:1, height:4, borderRadius:2, background:"var(--b2)", overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:st>0?`${Math.round(sw/st*100)}%`:"0%", background:"#ffab40", borderRadius:2, transition:"width 0.4s" }}/>
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:800, color:"#ffab40", minWidth:36, textAlign:"right" }}>{st>0?`${Math.round(sw/st*100)}%`:"—"}</span>
                                  <span style={{ fontSize:10, color:"var(--t3)", minWidth:50 }}>{sw}W / {st-sw}L</span>
                                </div>
                              ))}
                              {retakeBySite.filter(x=>x.total>0).length === 0 && <div style={{fontSize:11,color:"var(--t3)"}}>No retake data</div>}
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="label-sm" style={{ marginBottom:10 }}>First Blood / First Death</div>

                        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", overflow:"hidden" }}>
                          <table className="tbl tbl-compact" style={{ width:"100%" }}>
                            <thead><tr>
                              <th>Round</th><th>FB Killer</th><th>Agent</th><th>Team</th>
                              <th>↓ Victim</th><th>Agent</th><th>Team</th>
                              <th style={{textAlign:"right"}}>Type</th>
                              <th style={{textAlign:"right"}}>Result</th>
                            </tr></thead>
                            <tbody>
                              {detail.filter(rd=>rd.firstBlood).map((rd,i)=>{
                                const fb = rd.firstBlood;
                                const pip = rounds[rd.roundNum]?.res || rounds[rd.roundNum] || "l";
                                const rNum = (rd.roundNum != null ? rd.roundNum : i) + 1;
                                const isTFK = tfkRoundNums.includes(rNum);
                                const isContested = utfkRoundNums.includes(rNum);
                                const isTFT = tftRoundNums.includes(rNum);
                                const isUTFD = utfdRoundNums.includes(rNum);
                                const typeLabel = isTFK ? "True FK" : isContested ? "Contested FK" : isTFT ? "Traded FD" : isUTFD ? "Untraded FD" : "—";
                                const typeColor = isTFK ? "var(--green)" : isContested ? "var(--orange)" : isTFT ? "#4fc3f7" : isUTFD ? "var(--red)" : "var(--t3)";
                                return (
                                  <tr key={i}>
                                    <td className="mono" style={{color:"var(--t3)",fontSize:11}}>R{rd.roundNum+1}</td>
                                    <td><div style={{display:"flex",alignItems:"center",gap:5}}><AgentBadge name={fb.killerAgent} size={18}/><span style={{fontSize:11}}>{fb.killerName}</span></div></td>
                                    <td style={{fontSize:11,color:"var(--t3)"}}>{CHAR_MAP_GLOBAL[fb.killerAgent]||fb.killerAgent}</td>
                                    <td><span style={{fontSize:10,fontWeight:700,color:fb.killerTeam===ourTeamId2?"var(--acc)":"var(--t3)"}}>{fb.killerTeam===ourTeamId2?"US":"THEM"}</span></td>
                                    <td><div style={{display:"flex",alignItems:"center",gap:5}}><AgentBadge name={fb.victimAgent} size={18}/><span style={{fontSize:11,color:"var(--t3)"}}>{fb.victimName}</span></div></td>
                                    <td style={{fontSize:11,color:"var(--t3)"}}>{CHAR_MAP_GLOBAL[fb.victimAgent]||fb.victimAgent}</td>
                                    <td><span style={{fontSize:10,fontWeight:700,color:fb.victimTeam===ourTeamId2?"var(--red)":"var(--t3)"}}>{fb.victimTeam===ourTeamId2?"US":"THEM"}</span></td>
                                    <td style={{textAlign:"right"}}><span style={{fontSize:10,fontWeight:800,color:typeColor}}>{typeLabel}</span></td>
                                    <td style={{textAlign:"right"}}><span style={{fontSize:10,fontWeight:800,color:pip==="w"?"var(--green)":"var(--red)"}}>{pip==="w"?"▲ WIN":"▼ LOSS"}</span></td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:14, paddingTop:60, gap:10 }}>
                    <div style={{ fontSize:32 }}>📈</div>
                    <div>No round data. Upload a JSON file to see round stats.</div>
                  </div>
                )}
              </>)}

              {selTab==="xvy" && (<>
                {detail.length > 0 ? (() => {
                  const ourTeam = blueStats[0]?.team || "Blue";
                  const pct = (n,d) => d===0?"—":`${Math.round(n/d*100)}%`;

                  // Simulate alive counts kill-by-kill
                  const computeXvX = (rd) => {
                    const kills = [...(rd.kills||[])].sort((a,b)=>(a.time||0)-(b.time||0));
                    let ours=5, theirs=5;
                    return kills.map(k=>{
                      if (k.victimTeam===ourTeam) ours=Math.max(0,ours-1);
                      else theirs=Math.max(0,theirs-1);
                      return { ...k, ours, theirs };
                    });
                  };

                  // Summary table — aggregate all states that appeared
                  const xvxMap = {};
                  detail.forEach((rd,i)=>{
                    const won = rounds[i]?.res==="w";
                    const seen = new Set();
                    computeXvX(rd).forEach(e=>seen.add(`${e.ours}v${e.theirs}`));
                    seen.forEach(state=>{
                      const [a,b] = state.split("v").map(Number);
                      if (a===0||b===0) return; // skip dead states
                      if (!xvxMap[state]) xvxMap[state]={won:0,lost:0};
                      if (won) xvxMap[state].won++; else xvxMap[state].lost++;
                    });
                  });
                  const xvxRows = Object.entries(xvxMap).sort((a,b)=>(b[1].won+b[1].lost)-(a[1].won+a[1].lost));

                  // Per-round expandable row
                  const XvXRow = ({rd, i}) => {
                    const [open, setOpen] = React.useState(false);
                    const pip = rounds[i]?.res||"l";
                    const events = computeXvX(rd);
                    const last = events[events.length-1];
                    const fs = last?`${last.ours}v${last.theirs}`:"5v5";
                    const [fo,ft] = fs.split("v").map(Number);
                    const fc = fo>ft?"var(--green)":fo<ft?"var(--red)":"#ffab40";
                    // Determine side: first 12 rounds = first half
                    const isFirstHalf = i < 12;
                    const blueAtkFirst = (() => {
                      // Count blue wins in first half
                      const bw = detail.slice(0,12).filter((_,j)=>rounds[j]==="w").length;
                      return bw >= detail.slice(12).filter((_,j)=>rounds[j+12]==="w").length;
                    })();
                    const ourSide = isFirstHalf ? (blueAtkFirst?"ATK":"DEF") : (blueAtkFirst?"DEF":"ATK");
                    return (<>
                      <tr onClick={()=>setOpen(o=>!o)} style={{cursor:"pointer"}}>
                        <td className="mono" style={{color:"var(--t3)",fontSize:11}}>R{i+1}</td>
                        <td><span style={{fontSize:9,fontWeight:800,letterSpacing:"0.06em",color:ourSide==="ATK"?"#fb923c":"#60a5fa",background:ourSide==="ATK"?"rgba(251,146,60,0.12)":"rgba(96,165,250,0.12)",padding:"2px 5px",borderRadius:3}}>{ourSide}</span></td>
                        <td><span style={{fontSize:10,fontWeight:800,color:pip==="w"?"var(--green)":"var(--red)"}}>{pip==="w"?"▲ WIN":"▼ LOSS"}</span></td>
                        <td><span style={{fontSize:14,fontWeight:900,fontFamily:"'DIN Next LT Pro',sans-serif",color:fc}}>{fs}</span></td>
                        <td style={{fontSize:11,color:"var(--t2)"}}>{rd.outcome||"—"}</td>
                        <td>{rd.site?<span style={{fontSize:11,fontWeight:700,color:rd.site==="A"?"#a78bfa":rd.site==="B"?"#f87171":"#34d399"}}>{rd.site}</span>:<span style={{color:"var(--t3)"}}>—</span>}</td>
                        <td style={{textAlign:"right",color:"var(--t3)",fontSize:11}}>{(rd.kills||[]).length}K</td>
                        <td style={{textAlign:"right",color:"var(--t3)",fontSize:10,paddingRight:10}}>{open?"▲":"▼"}</td>
                      </tr>
                      {open && (<tr><td colSpan={8} style={{padding:0,background:"var(--bg)",borderBottom:"2px solid var(--b2)"}}>
                        <div style={{padding:"12px 16px 16px",display:"flex",gap:16,alignItems:"flex-start"}}>
                          <div style={{flex:1,display:"flex",flexDirection:"column",gap:4,minWidth:0}}>
                            {events.length===0
                              ? <span style={{fontSize:11,color:"var(--t3)"}}>No kill feed data for this round.</span>
                              : (<>
                                {/* State timeline */}
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,paddingBottom:6,borderBottom:"1px solid var(--b1)",flexWrap:"wrap"}}>
                                  <span style={{fontSize:9,fontWeight:800,color:"var(--t3)",letterSpacing:"0.08em",textTransform:"uppercase",flexShrink:0}}>5v5</span>
                                  {events.map((e,ei)=>{
                                    const ac=e.ours>e.theirs?"var(--green)":e.ours<e.theirs?"var(--red)":"#ffab40";
                                    return (<React.Fragment key={ei}>
                                      <div style={{width:7,height:7,borderRadius:"50%",background:e.killerTeam===ourTeam?"var(--green)":"var(--red)",flexShrink:0}} title={`${e.killerName}→${e.victimName}`}/>
                                      <span style={{fontSize:9,fontWeight:800,fontFamily:"'DIN Next LT Pro',sans-serif",color:ac,whiteSpace:"nowrap"}}>{e.ours}v{e.theirs}</span>
                                    </React.Fragment>);
                                  })}
                                </div>
                                {/* Kill feed */}
                                {events.map((e,ei)=>{
                                  const isOurKill=e.killerTeam===ourTeam;
                                  const isOurVictim=e.victimTeam===ourTeam;
                                  const ac=e.ours>e.theirs?"var(--green)":e.ours<e.theirs?"var(--red)":"#ffab40";
                                  return (<div key={ei} style={{display:"grid",gridTemplateColumns:"20px 1fr 12px 1fr 52px",gap:8,alignItems:"center",fontSize:11}}>
                                    <span className="mono" style={{fontSize:9,color:"var(--t3)"}}>K{ei+1}</span>
                                    <span style={{color:isOurKill?"var(--acc)":"var(--t3)",fontWeight:isOurKill?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.killerName}</span>
                                    <span style={{color:"var(--t3)",textAlign:"center"}}>→</span>
                                    <span style={{color:isOurVictim?"var(--red)":"var(--t3)",fontWeight:isOurVictim?700:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.victimName}</span>
                                    <span style={{fontFamily:"'DIN Next LT Pro',sans-serif",fontWeight:900,fontSize:13,color:ac}}>{e.ours}v{e.theirs}</span>
                                  </div>);
                                })}
                              </>)
                            }
                          </div>
                        </div>
                      </td></tr>)}
                    </>);
                  };

                  return (
                    <div style={{paddingTop:16,display:"flex",flexDirection:"column",gap:20}}>
                      {/* Summary */}
                      <div>
                        <div className="label-sm" style={{marginBottom:10}}>XvX Summary <span style={{fontWeight:400,color:"var(--t3)"}}>— win rate when each state occurred (from kill feed)</span></div>
                        <div style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--r)",overflow:"hidden"}}>
                          <table className="tbl" style={{width:"100%"}}>
                            <thead><tr>
                              <th>Situation</th>
                              <th style={{textAlign:"right"}}>Rounds</th>
                              <th style={{textAlign:"right"}}>Won</th>
                              <th style={{textAlign:"right"}}>Lost</th>
                              <th style={{textAlign:"right"}}>Win Rate</th>
                              <th style={{textAlign:"right"}}>Bar</th>
                            </tr></thead>
                            <tbody>
                              {xvxRows.map(([key,v])=>{
                                const total=v.won+v.lost; const wr=v.won/total;
                                const [os,ts]=key.split("v").map(Number);
                                const color=os>ts?"var(--green)":os<ts?"var(--red)":"#ffab40";
                                return (<tr key={key}>
                                  <td>
                                    <span style={{fontSize:16,fontWeight:900,fontFamily:"'DIN Next LT Pro',sans-serif",color}}>{key}</span>
                                    <span style={{fontSize:10,color:"var(--t3)",marginLeft:6}}>{os>ts?"advantage":os<ts?"disadvantage":"even"}</span>
                                  </td>
                                  <td style={{textAlign:"right",color:"var(--t2)"}}>{total}</td>
                                  <td style={{textAlign:"right",color:"var(--green)",fontWeight:700}}>{v.won}</td>
                                  <td style={{textAlign:"right",color:"var(--red)",fontWeight:700}}>{v.lost}</td>
                                  <td style={{textAlign:"right",fontWeight:800,color:wr>=0.5?"var(--green)":"var(--red)"}}>{pct(v.won,total)}</td>
                                  <td style={{textAlign:"right",width:80}}>
                                    <div style={{background:"var(--s3)",borderRadius:3,height:8,overflow:"hidden"}}>
                                      <div style={{width:`${wr*100}%`,height:"100%",background:wr>=0.5?"var(--green)":"var(--red)",transition:"width 0.3s"}}/>
                                    </div>
                                  </td>
                                </tr>);
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      {/* Per-round */}
                      <div>
                        <div className="label-sm" style={{marginBottom:4}}>Round by Round — Kill-by-Kill XvX</div>
                        <div style={{fontSize:10,color:"var(--t3)",marginBottom:10}}>Click a row to expand the kill feed and minimap.</div>
                        <div style={{background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--r)",overflow:"hidden"}}>
                          <table className="tbl tbl-compact" style={{width:"100%"}}>
                            <thead><tr>
                              <th>Round</th><th>Side</th><th>Result</th><th>Final</th><th>Outcome</th><th>Site</th><th style={{textAlign:"right"}}>Kills</th><th/>
                            </tr></thead>
                            <tbody>
                              {detail.map((rd,i)=><XvXRow key={i} rd={rd} i={i}/>)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"var(--t3)",fontSize:14,paddingTop:60,gap:10}}>
                    <div style={{fontSize:32}}>⚔</div>
                    <div>No round data. Upload a JSON file to see XvX breakdown.</div>
                  </div>
                )}
              </>)}


              {selTab==="analytics" && (detail.length > 0 ? (() => {
                // ── Analytics tab: computed from round_detail + player_stats ────────
                const ourTeamIdStored = blueStats[0]?.team || "";
                let ourTeamId = ourTeamIdStored;
                if (!ourTeamId) {
                  let atkTeamId = null;
                  for (const r of detail.slice(0,12)) { if (r.planterTeam) { atkTeamId = r.planterTeam; break; } }
                  if (!atkTeamId) for (const r of detail.slice(12,24)) { if (r.planterTeam) { atkTeamId = r.planterTeam === "Blue" ? "Red" : "Blue"; break; } }
                  if (atkTeamId) { ourTeamId = atkFirst ? atkTeamId : (atkTeamId === "Blue" ? "Red" : "Blue"); }
                  else ourTeamId = "Blue";
                }

                // ── KAST% per player ─────────────────────────────────────────────
                // A player gets KAST credit in a round if they had a Kill, Assist,
                // Survived, or were Traded (killer eliminated within 3s of their death).
                // Key by puuid when available, else by name (handles older DB records).
                const kastKey = (p) => p.puuid || p.name || "";
                const kastRounds = {}; // key → Set of round indices with a KAST event
                blueStats.concat(redStats).forEach(p => { if (kastKey(p)) kastRounds[kastKey(p)] = new Set(); });

                // nameMatches: match stored name against player name (with or without #tag)
                const nameMatches = (stored, playerName) => {
                  if (!stored || !playerName) return false;
                  if (stored === playerName) return true;
                  const storedBase = stored.split("#")[0];
                  const playerBase = playerName.split("#")[0];
                  return storedBase === playerBase || stored === playerBase || storedBase === playerName;
                };

                // playerIs: check if a kill event field matches this player
                const playerIs = (puuidField, nameField, p) => {
                  if (puuidField && p.puuid) return puuidField === p.puuid;
                  return nameMatches(nameField, p.name);
                };

                detail.forEach((rd, ri) => {
                  const killsInRound = rd.kills || [];

                  blueStats.concat(redStats).forEach(p => {
                    const key = kastKey(p);
                    if (!key || !kastRounds[key]) return;

                    // Kill: this player got a kill
                    const gotKill = killsInRound.some(k =>
                      playerIs(k.killerPuuid, k.killerName, p)
                    );

                    // Assist: player name in assistants list (stored as name strings)
                    const gotAssist = killsInRound.some(k =>
                      (k.assistants || []).some(a => nameMatches(a, p.name))
                    );

                    // Survived: not killed in this round
                    const survived = !killsInRound.some(k =>
                      playerIs(k.victimPuuid, k.victimName, p)
                    );

                    // Traded: player died AND their killer was killed within 3s
                    let traded = false;
                    if (!survived) {
                      const myDeath = killsInRound.find(k =>
                        playerIs(k.victimPuuid, k.victimName, p)
                      );
                      if (myDeath) {
                        traded = killsInRound.some(k => {
                          const killerDied = myDeath.killerPuuid
                            ? (k.victimPuuid === myDeath.killerPuuid)
                            : nameMatches(k.victimName, myDeath.killerName);
                          return killerDied && Math.abs((k.time ?? 0) - (myDeath.time ?? 0)) <= 1500;
                        });
                      }
                    }

                    if (gotKill || gotAssist || survived || traded) {
                      kastRounds[key].add(ri);
                    }
                  });
                });

                // KAST% = (rounds with K/A/S/T) / (total rounds played) * 100
                const kastPct = (p) => {
                  const key = kastKey(p);
                  const rounds = kastRounds[key];
                  const roundsPlayed = p.roundsPlayed || detail.length;
                  if (!rounds || !roundsPlayed) return null;
                  return Math.round((rounds.size / roundsPlayed) * 100);
                };

                // ── Economy by round ─────────────────────────────────────────────
                // Use rounds array (w/l) as proxy — need to count eco from detail
                const econRounds = detail.map((rd, i) => ({
                  round: i + 1,
                  won: rounds[i]?.res === "w",
                  outcome: rd.outcome || "Eliminated",
                  planted: rd.planted,
                  site: rd.site,
                }));

                // ── Per-player stat bars ──────────────────────────────────────────
                const allPlayers = blueStats.concat(redStats).filter(p => p.name);
                const maxAcs   = Math.max(...allPlayers.map(p => p.acs  || 0), 1);
                const maxAdr   = Math.max(...allPlayers.map(p => p.adr  || 0), 1);
                const maxKills = Math.max(...allPlayers.map(p => p.kills|| 0), 1);

                // ── Multi-kill totals per player ──────────────────────────────────
                const multiKills = allPlayers.map(p => ({
                  name:  p.name,
                  team:  p.team,
                  agent: p.agent,
                  mk5:   p.mk5   || 0,
                  mk4:   p.mk4   || 0,
                  mk3:   p.mk3   || 0,
                  mk2:   p.mk2   || 0,
                  total: (p.mk5||0)*5 + (p.mk4||0)*4 + (p.mk3||0)*3 + (p.mk2||0)*2,
                })).filter(p => p.total > 0).sort((a,b) => b.total - a.total);

                // ── Round outcome breakdown ───────────────────────────────────────
                let blueAtkWins = 0;
                detail.slice(0, 12).forEach(r => { if (r.winner === "Blue") blueAtkWins++; });
                const blueAtkFirst = blueAtkWins >= (rounds.filter((_,i)=>i>=12&&rounds[i]?.res==="w").length);
                const outcomes = {};
                detail.forEach((rd, i) => {
                  let o = rd.outcome || "Eliminated";
                  if (o === "Detonate") {
                    const isFirstHalf = i < 12;
                    const weWereAtk = isFirstHalf ? blueAtkFirst : !blueAtkFirst;
                    o = weWereAtk ? "Detonate (ATK)" : "Save";
                  }
                  if (!outcomes[o]) outcomes[o] = { won: 0, lost: 0 };
                  if (rd.winnerIsOurs) outcomes[o].won++;
                  else outcomes[o].lost++;
                });
                const outcomeRows = Object.entries(outcomes).sort((a,b) => (b[1].won+b[1].lost) - (a[1].won+a[1].lost));

                // ── Site preference (our plants) ─────────────────────────────────
                const _bAlive = rd => { const m = String(rd.xvy||"").match(/^(\d+)v(\d+)$/); return !m || (parseInt(m[1])>0 && parseInt(m[2])>0); };
                const isMoneyPlantSites = rd => {
                  if (!rd.planted || !rd.plantRoundTime) return false;
                  const lastKillTime = (rd.kills || []).reduce((max, k) => Math.max(max, k.time || 0), 0);
                  return rd.plantRoundTime > lastKillTime;
                };
                const sites = {};
                detail.filter(rd => rd.planted && rd.site && rd.planterTeam === ourTeamId && !isMoneyPlantSites(rd)).forEach(rd => {
                  if (!sites[rd.site]) sites[rd.site] = { count: 0, won: 0 };
                  sites[rd.site].count++;
                  if (rd.winnerIsOurs) sites[rd.site].won++;
                });
                const siteRows = Object.entries(sites).sort((a,b) => b[1].count - a[1].count);

                // ── Opp site preference ───────────────────────────────────────────
                const oppSites = {};
                detail.filter(rd => rd.planted && rd.site && rd.planterTeam && rd.planterTeam !== ourTeamId && !isMoneyPlantSites(rd)).forEach(rd => {
                  if (!oppSites[rd.site]) oppSites[rd.site] = { count: 0, theyWon: 0 };
                  oppSites[rd.site].count++;
                  if (!rd.winnerIsOurs) oppSites[rd.site].theyWon++;
                });
                const oppSiteRows = Object.entries(oppSites).sort((a,b) => b[1].count - a[1].count);

                // ── Trading stats ─────────────────────────────────────────────────
                // True First Trade: first death was ours AND teammate killed the killer within 3s
                // True First Death: first death was ours AND no trade within 3s
                let tft = 0, tfd = 0, tradedRounds = 0, totalRoundsWithKills = 0;
                const tftRounds = [], tfdRounds = [], fbDeathRounds = [];
                detail.forEach((rd, rdIdx) => {
                  const kills = rd.kills || [];
                  if (!kills.length) return;
                  totalRoundsWithKills++;
                  const sorted = [...kills].sort((a,b) => (a.time||0)-(b.time||0));
                  const firstKill = sorted[0];
                  if (!firstKill) return;
                  const firstDeathWasOurs = firstKill.victimTeam === ourTeamId;
                  if (!firstDeathWasOurs) return;
                  fbDeathRounds.push(rdIdx + 1);
                  const tradeWindow = (firstKill.time || 0) + TRADE_WINDOW_MS;
                  // TFT: the killer dying to our team within 2s (any subsequent kill)
                  const traded = sorted.slice(1).some(k =>
                    (k.time||0) <= tradeWindow &&
                    k.killerTeam === ourTeamId &&
                    (firstKill.killerPuuid && k.victimPuuid
                      ? k.victimPuuid === firstKill.killerPuuid
                      : (!firstKill.killerPuuid && !k.victimPuuid && k.victimName === firstKill.killerName)));
                  if (traded) { tft++; tftRounds.push(rdIdx + 1); }
                  else { tfd++; tfdRounds.push(rdIdx + 1); }
                });
                const tradeTotal = tft + tfd;

                // ── Styles ───────────────────────────────────────────────────────
                const Section = ({ title, color="#d4ff1e", children }) => (
                  <div style={{ marginBottom:28 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, paddingBottom:8, borderBottom:"1px solid var(--b2)" }}>
                      <div style={{ width:3, height:16, background:color, borderRadius:2, flexShrink:0 }}/>
                      <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t2)" }}>{title}</span>
                    </div>
                    {children}
                  </div>
                );

                const MiniBar = ({ pct, color="var(--acc)", height=6 }) => (
                  <div style={{ flex:1, height, background:"var(--s3)", borderRadius:3, overflow:"hidden", minWidth:40 }}>
                    <div style={{ width:`${Math.min(pct,100)}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.4s ease" }}/>
                  </div>
                );

                const pct = (n, d) => d === 0 ? "—" : `${Math.round(n/d*100)}%`;

                return (
                  <div style={{ paddingTop:16 }}>

                    {/* ── PLAYER PERFORMANCE OVERVIEW ── */}
                    <Section title="Player Performance" color="var(--acc)">
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                          <thead>
                            <tr style={{ borderBottom:"1px solid var(--b2)" }}>
                              {["Player","Team","ACS","K","D","A","K/D","HS%","ADR","KAST%"].map(h => (
                                <th key={h} style={{ padding:"6px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", textAlign: h==="Player"||h==="Team" ? "left" : "right" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...allPlayers].sort((a,b) => (b.acs||0)-(a.acs||0)).map((p,i) => {
                              const kpct = kastPct(p);
                              const isOurs = p.team === ourTeamId || p.side === "blue";
                              const kd = p.kd ?? (p.deaths > 0 ? Math.round((p.kills/p.deaths)*100)/100 : p.kills);
                              return (
                                <tr key={i} style={{ borderBottom:"1px solid var(--b1)", transition:"background 0.12s" }}
                                  onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                                  <td style={{ padding:"8px 10px" }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                      <AgentBadge name={p.agent} size={20}/>
                                      <span style={{ fontSize:11, fontFamily:"monospace", color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:120 }}>{(p.name||"").split("#")[0]}</span>
                                    </div>
                                  </td>
                                  <td style={{ padding:"8px 10px" }}>
                                    <span style={{ fontSize:9, fontWeight:800, padding:"2px 6px", borderRadius:3,
                                      background: isOurs ? "rgba(212,255,30,0.1)" : "rgba(255,82,82,0.1)",
                                      color: isOurs ? "var(--acc)" : "var(--red)" }}>
                                      {isOurs ? "US" : "THEM"}
                                    </span>
                                  </td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:800, color:"var(--acc)", fontSize:14 }}>{p.acs ?? "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600 }}>{p.kills ?? "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--t3)" }}>{p.deaths ?? "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--t3)" }}>{p.assists ?? "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color: kd >= 1 ? "var(--green)" : "var(--red)" }}>{kd}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right" }}>{p.hsRate != null ? `${p.hsRate}%` : "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right", color:"var(--t2)" }}>{p.adr ?? "—"}</td>
                                  <td style={{ padding:"8px 10px", textAlign:"right" }}>
                                    {kpct != null ? (
                                      <span style={{ fontWeight:700, color: kpct >= 70 ? "var(--green)" : kpct >= 50 ? "var(--orange)" : "var(--red)" }}>
                                        {kpct}%
                                      </span>
                                    ) : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Section>

                    {/* ── ACS + ADR BARS ── */}
                    <Section title="ACS & ADR Comparison" color="var(--blue)">
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                        {[
                          { label:"ACS (Combat Score / Round)", key:"acs", max:maxAcs, color:"var(--acc)" },
                          { label:"ADR (Damage / Round)", key:"adr", max:maxAdr, color:"var(--blue)" },
                        ].map(({ label, key, max, color }) => (
                          <div key={key}>
                            <div style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</div>
                            {[...allPlayers].sort((a,b) => (b[key]||0)-(a[key]||0)).map((p,i) => {
                              const isOurs = p.team === ourTeamId || p.side === "blue";
                              const val = p[key] || 0;
                              return (
                                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                                  <AgentBadge name={p.agent} size={18}/>
                                  <div style={{ width:90, fontSize:11, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: isOurs ? "var(--t1)" : "var(--t3)", flexShrink:0 }}>{(p.name||"").split("#")[0]}</div>
                                  <MiniBar pct={(val/max)*100} color={isOurs ? color : "var(--b3)"} height={8}/>
                                  <span style={{ fontSize:11, fontWeight:700, color: isOurs ? color : "var(--t3)", minWidth:32, textAlign:"right" }}>{val}</span>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </Section>

                    {/* ── ROUND OUTCOME BREAKDOWN ── */}
                    <Section title="Round Outcome Breakdown" color="var(--orange)">
                      {/* Top row: Our Postplant (left) + Enemy Postplant (right) */}
                      {(siteRows.length > 0 || oppSiteRows.length > 0) && (
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                          {siteRows.length > 0 && (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>Our Postplant (Planted)</div>
                              {siteRows.map(([site, v]) => {
                                const wr = v.count > 0 ? v.won / v.count : 0;
                                const sColor = site === "A" ? "#a78bfa" : site === "B" ? "#f87171" : site === "C" ? "#34d399" : "#fb923c";
                                return (
                                  <div key={site} style={{ marginBottom:8 }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                      <span style={{ fontSize:12, fontWeight:900, color:sColor, fontFamily:"'DIN Next LT Pro',sans-serif" }}>{site} Site</span>
                                      <span style={{ fontSize:11, color:"var(--t3)" }}>{v.count} plants · {pct(v.won,v.count)} WR</span>
                                    </div>
                                    <div style={{ height:6, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                                      <div style={{ width:`${wr*100}%`, height:"100%", background:sColor, borderRadius:3, opacity:0.8 }}/>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {oppSiteRows.length > 0 && (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>Enemy Postplant (Their Plants)</div>
                              {oppSiteRows.map(([site, v]) => {
                                const retakeWR = v.count > 0 ? (v.count - v.theyWon) / v.count : 0;
                                const sColor = site === "A" ? "#a78bfa" : site === "B" ? "#f87171" : site === "C" ? "#34d399" : "#fb923c";
                                return (
                                  <div key={site} style={{ marginBottom:8 }}>
                                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                      <span style={{ fontSize:12, fontWeight:900, color:sColor, fontFamily:"'DIN Next LT Pro',sans-serif" }}>{site} Site</span>
                                      <span style={{ fontSize:11, color:"var(--t3)" }}>{v.count} plants · our retake {pct(v.count - v.theyWon, v.count)}</span>
                                    </div>
                                    <div style={{ height:6, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                                      <div style={{ width:`${retakeWR*100}%`, height:"100%", background:retakeWR >= 0.5 ? "var(--green)" : "var(--red)", borderRadius:3, opacity:0.8 }}/>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {/* Bottom: Outcome Type */}
                      <div>
                        <div style={{ fontSize:11, fontWeight:700, color:"var(--t3)", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>By Outcome Type</div>
                        {outcomeRows.map(([outcome, v]) => {
                          const total = v.won + v.lost;
                          const wr = total > 0 ? v.won / total : 0;
                          const oColor = outcome === "Defuse" ? "var(--blue)" : outcome === "Detonate (ATK)" ? "var(--green)" : outcome === "Save" ? "#a78bfa" : outcome === "Eliminated" ? "var(--orange)" : "var(--t3)";
                          return (
                            <div key={outcome} style={{ marginBottom:8 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:12, color:oColor, fontWeight:700 }}>{outcome}</span>
                                <span style={{ fontSize:11, color:"var(--t3)" }}>{v.won}W / {v.lost}L · {pct(v.won,total)}</span>
                              </div>
                              <div style={{ height:6, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                                <div style={{ width:`${wr*100}%`, height:"100%", background: wr >= 0.5 ? "var(--green)" : "var(--red)", borderRadius:3 }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>

                    {/* ── TRADING STATS ── */}
                    {tradeTotal > 0 && (
                      <Section title="Trading Stats" color="var(--orange)">
                        {(() => {
                          const TradeCard = ({ label, count, color, border, subtitle, roundNums }) => {
                            const [open, setOpen] = React.useState(false);
                            return (
                              <div style={{ background:"var(--s2)", border:`1px solid ${border}`, borderRadius:8, padding:"12px 18px", minWidth:130, cursor: roundNums.length ? "pointer" : "default", userSelect:"none" }}
                                onClick={() => roundNums.length && setOpen(o => !o)}>
                                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", marginBottom:6 }}>{label}</div>
                                <div className="bc" style={{ fontSize:28, fontWeight:900, color, lineHeight:1 }}>{count}</div>
                                <div style={{ fontSize:10, color:"var(--t3)", marginTop:3, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                  <span>{subtitle}</span>
                                  {roundNums.length > 0 && <span style={{ fontSize:9, color:"var(--t3)", opacity:0.6 }}>{open ? "▲" : "▼"}</span>}
                                </div>
                                {open && (
                                  <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid var(--b1)" }}>
                                    <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:5 }}>Rounds</div>
                                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                      {roundNums.map(r => (
                                        <span key={r} style={{ fontSize:10, fontWeight:700, color, background:`${color}18`, border:`1px solid ${color}40`, borderRadius:4, padding:"1px 6px" }}>R{r}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          };
                          return (
                            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
                              <TradeCard label="True First Trade" count={tft} color="var(--green)" border="rgba(212,255,30,0.2)" subtitle={`${pct(tft,tradeTotal)} of FB deaths traded`} roundNums={tftRounds}/>
                              <TradeCard label="True First Death" count={tfd} color="var(--red)" border="rgba(255,82,82,0.2)" subtitle={`${pct(tfd,tradeTotal)} of FB deaths untraded`} roundNums={tfdRounds}/>
                              <TradeCard label="Rounds We Got FB Death" count={tradeTotal} color="var(--t2)" border="var(--b2)" subtitle={`of ${totalRoundsWithKills} rounds w/ kills`} roundNums={fbDeathRounds}/>
                            </div>
                          );
                        })()}
                        <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.6, padding:"8px 12px", background:"var(--s2)", borderRadius:6, border:"1px solid var(--b1)" }}>
                          <b style={{ color:"var(--green)" }}>True First Trade</b> — we gave first blood but a teammate killed their killer within 2s. &nbsp;
                          <b style={{ color:"var(--red)" }}>True First Death</b> — we gave first blood with no trade in 3s (real info advantage to them).
                        </div>
                      </Section>
                    )}

                    {/* ── FIRST BLOOD / FIRST DEATH ── */}
                    {detail.some(rd => rd.firstBlood) && (() => {
                      const fbAnRounds  = detail.filter(rd => rd.firstBlood && rd.firstBlood.killerTeam === ourTeamId);
                      const fbAnWon     = fbAnRounds.filter(rd => rd.winnerIsOurs).length;
                      const fdAnRounds  = detail.filter(rd => rd.firstBlood && rd.firstBlood.victimTeam === ourTeamId);
                      const fdAnWon     = fdAnRounds.filter(rd => rd.winnerIsOurs).length;
                      const nameMatchAn = (a, b) => { if (!a || !b) return false; return a === b || a.split('#')[0] === b || a === b.split('#')[0]; };
                      const tfkAn = [], utfkAn = [], tftAn = [], utfdAn = [];
                      detail.forEach((rd, rdIdx) => {
                        const kills = rd.kills || [];
                        if (!kills.length) return;
                        const sorted = [...kills].sort((a,b) => (a.time||0)-(b.time||0));
                        const firstKill = sorted[0];
                        if (!firstKill) return;
                        const weGotFK = firstKill.killerTeam === ourTeamId;
                        const tradeWin = (firstKill.time || 0) + TRADE_WINDOW_MS;
                        const traded = sorted.slice(1).some(k =>
                          (k.time||0) <= tradeWin &&
                          k.killerTeam !== firstKill.killerTeam &&
                          (firstKill.killerPuuid && k.victimPuuid
                            ? k.victimPuuid === firstKill.killerPuuid
                            : (!firstKill.killerPuuid && !k.victimPuuid && nameMatchAn(k.victimName, firstKill.killerName))));
                        const rNum = (rd.roundNum != null ? rd.roundNum : rdIdx) + 1;
                        if (weGotFK) { if (!traded) tfkAn.push(rNum); else utfkAn.push(rNum); }
                        else { if (traded) tftAn.push(rNum); else utfdAn.push(rNum); }
                      });
                      const totalFBAn = fbAnRounds.length + fdAnRounds.length;
                      const pctAn = (n, d) => d === 0 ? "—" : `${Math.round(n/d*100)}%`;
                      const FBDropCard = ({ label, won, total, sub, color, roundNums, isCount }) => {
                        const [open, setOpen] = React.useState(false);
                        return (
                          <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"14px 18px", minWidth:140, flex:"1 1 140px", cursor: roundNums.length ? "pointer" : "default", userSelect:"none" }}
                            onClick={() => roundNums.length && setOpen(o => !o)}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                              <div style={{ fontSize:10, fontWeight:800, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
                              {roundNums.length > 0 && <span style={{ fontSize:10, color:"var(--t3)", opacity:0.5 }}>{open ? "▲" : "▼"}</span>}
                            </div>
                            <div style={{ fontSize:32, fontWeight:900, color: color||"var(--acc)", fontFamily:"'DIN Next LT Pro',sans-serif", lineHeight:1 }}>{isCount ? won : pctAn(won, total)}</div>
                            <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>
                              {isCount ? `of ${total} rounds` : `${won}W / ${total-won}L · ${total} rounds`}
                            </div>
                            {sub && <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>{sub}</div>}
                            {open && roundNums.length > 0 && (
                              <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--b1)" }}>
                                <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Rounds</div>
                                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                  {roundNums.map(r => (
                                    <span key={r} style={{ fontSize:10, fontWeight:700, color, background:`${color}18`, border:`1px solid ${color}40`, borderRadius:4, padding:"1px 6px" }}>R{r}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      };
                      return (
                        <>
                        {detail.some(rd => rd.planted && rd.site) && (() => {
                          const anOurTeamId = blueStats[0]?.team || "Red";
                          const isMoneyPlantAn = rd => {
                            if (!rd.planted || !rd.plantRoundTime) return false;
                            const lastKillTime = (rd.kills || []).reduce((max, k) => Math.max(max, k.time || 0), 0);
                            return rd.plantRoundTime > lastKillTime;
                          };
                          const anPpRounds = detail.filter(rd => rd.planted && rd.site && rd.planterTeam === anOurTeamId && !isMoneyPlantAn(rd));
                          const anRetakeRounds = detail.filter(rd => rd.planted && rd.site && rd.planterTeam && rd.planterTeam !== anOurTeamId && !isMoneyPlantAn(rd));
                          const anSites = [...new Set(detail.filter(rd=>rd.planted&&rd.site).map(rd=>rd.site))].sort();
                          const anSiteColor = s => s==="A"?"#a78bfa":s==="B"?"#f87171":s==="C"?"#34d399":"#fb923c";
                          const anPpBySite = anSites.map(s => {
                            const rds = anPpRounds.filter(rd=>rd.site===s);
                            return { site:s, won:rds.filter(rd=>rd.winnerIsOurs).length, total:rds.length, rounds:rds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1) };
                          }).filter(x=>x.total>0);
                          const anRetakeBySite = anSites.map(s => {
                            const rds = anRetakeRounds.filter(rd=>rd.site===s);
                            return { site:s, won:rds.filter(rd=>rd.winnerIsOurs).length, total:rds.length, rounds:rds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1) };
                          }).filter(x=>x.total>0);
                          const AnSiteRow = ({ site, won, total, rounds, barColor }) => {
                            const [open, setOpen] = React.useState(false);
                            const sc = anSiteColor(site);
                            return (
                              <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"10px 14px", cursor:rounds.length?"pointer":"default", userSelect:"none" }}
                                onClick={() => rounds.length && setOpen(o=>!o)}>
                                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                                  <span style={{ fontSize:13, fontWeight:900, color:sc, minWidth:20 }}>{site}</span>
                                  <div style={{ flex:1, height:4, borderRadius:2, background:"var(--b2)", overflow:"hidden" }}>
                                    <div style={{ height:"100%", width:total>0?`${Math.round(won/total*100)}%`:"0%", background:barColor, borderRadius:2, transition:"width 0.4s" }}/>
                                  </div>
                                  <span style={{ fontSize:13, fontWeight:800, color:barColor, minWidth:36, textAlign:"right" }}>{total>0?`${Math.round(won/total*100)}%`:"—"}</span>
                                  <span style={{ fontSize:10, color:"var(--t3)", minWidth:50 }}>{won}W / {total-won}L</span>
                                  {rounds.length > 0 && <span style={{ fontSize:10, color:"var(--t3)", opacity:0.5, flexShrink:0 }}>{open?"▲":"▼"}</span>}
                                </div>
                                {open && rounds.length > 0 && (
                                  <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid var(--b1)" }}>
                                    <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Rounds</div>
                                    <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                      {rounds.map(r => (
                                        <span key={r} style={{ fontSize:10, fontWeight:700, color:sc, background:`${sc}18`, border:`1px solid ${sc}40`, borderRadius:4, padding:"1px 6px" }}>R{r}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          };
                          return (
                            <Section title="Post-Plant / Retake by Site" color="#4fc3f7">
                              <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                                <div style={{ flex:1, minWidth:260 }}>
                                  <div className="label-sm" style={{ marginBottom:10 }}>Post-Plant WR by Site</div>
                                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                    {anPpBySite.map(({site,won:sw,total:st,rounds}) => (
                                      <AnSiteRow key={site} site={site} won={sw} total={st} rounds={rounds} barColor="#4fc3f7"/>
                                    ))}
                                    {anPpBySite.length === 0 && <div style={{fontSize:11,color:"var(--t3)"}}>No plant data</div>}
                                  </div>
                                </div>
                                <div style={{ flex:1, minWidth:260 }}>
                                  <div className="label-sm" style={{ marginBottom:10 }}>Retake WR by Site</div>
                                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                    {anRetakeBySite.map(({site,won:sw,total:st,rounds}) => (
                                      <AnSiteRow key={site} site={site} won={sw} total={st} rounds={rounds} barColor="#ffab40"/>
                                    ))}
                                    {anRetakeBySite.length === 0 && <div style={{fontSize:11,color:"var(--t3)"}}>No retake data</div>}
                                  </div>
                                </div>
                              </div>
                            </Section>
                          );
                        })()}
                        <Section title="First Blood / First Death" color="var(--blue)">
                          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:12 }}>
                            <FBDropCard label="FK Round WR" won={fbAnWon} total={fbAnRounds.length} sub="Rounds where we got first kill" color="var(--green)"
                              roundNums={fbAnRounds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1)}/>
                            <FBDropCard label="FD Round WR" won={fdAnWon} total={fdAnRounds.length} sub="Rounds where we got first death" color="var(--red)"
                              roundNums={fdAnRounds.map(rd=>(rd.roundNum!=null?rd.roundNum:detail.indexOf(rd))+1)}/>
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:12 }}>
                            <FBDropCard label="True First Kill"        won={tfkAn.length}  total={totalFBAn} sub="FK, opp didn't trade (≤2s)"   color="var(--green)"  roundNums={tfkAn}  isCount/>
                            <FBDropCard label="Traded FK (Contested)"  won={utfkAn.length} total={totalFBAn} sub="FK but our killer was traded"  color="var(--orange)" roundNums={utfkAn} isCount/>
                            <FBDropCard label="Traded First Death"     won={tftAn.length}  total={totalFBAn} sub="FD but traded their killer"    color="var(--blue)"   roundNums={tftAn}  isCount/>
                            <FBDropCard label="Untraded First Death"   won={utfdAn.length} total={totalFBAn} sub="FD, no trade — real info loss" color="var(--red)"    roundNums={utfdAn} isCount/>
                          </div>
                          <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.6, padding:"8px 12px", background:"var(--s2)", borderRadius:6, border:"1px solid var(--b1)" }}>
                            <b style={{ color:"var(--green)" }}>True FK</b> — we got first kill, opponent didn't trade within 2s. &nbsp;
                            <b style={{ color:"var(--orange)" }}>Traded FK</b> — we got FK but our killer was immediately traded. &nbsp;
                            <b style={{ color:"var(--blue)" }}>Traded FD</b> — we got first death but a teammate traded within 2s. &nbsp;
                            <b style={{ color:"var(--red)" }}>Untraded FD</b> — we got first death with no trade (real info disadvantage). &nbsp;
                            Click any card to expand round numbers.
                          </div>
                        </Section>
                        </>
                      );
                    })()}

                    {/* ── MULTI-KILLS ── */}
                    {multiKills.length > 0 && (
                      <Section title="Multi-Kill Rounds" color="var(--purple)">
                        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                          {multiKills.map((p, i) => {
                            const isOurs = p.team === ourTeamId;
                            return (
                              <div key={i} style={{ background:"var(--s2)", border:`1px solid ${isOurs?"rgba(212,255,30,0.2)":"var(--b2)"}`, borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:10, minWidth:200 }}>
                                <AgentBadge name={p.agent} size={24}/>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:11, color:"var(--t2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(p.name||"").split("#")[0]}</div>
                                  <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                                    {p.mk5 > 0 && <span style={{ fontSize:10, fontWeight:800, color:"#ffd700", background:"rgba(255,215,0,0.12)", border:"1px solid rgba(255,215,0,0.25)", borderRadius:3, padding:"1px 6px" }}>ACE×{p.mk5}</span>}
                                    {p.mk4 > 0 && <span style={{ fontSize:10, fontWeight:800, color:"var(--red)", background:"rgba(255,82,82,0.12)", border:"1px solid rgba(255,82,82,0.25)", borderRadius:3, padding:"1px 6px" }}>4K×{p.mk4}</span>}
                                    {p.mk3 > 0 && <span style={{ fontSize:10, fontWeight:800, color:"var(--acc)", background:"rgba(212,255,30,0.1)", border:"1px solid rgba(212,255,30,0.2)", borderRadius:3, padding:"1px 6px" }}>3K×{p.mk3}</span>}
                                    {p.mk2 > 0 && <span style={{ fontSize:10, fontWeight:800, color:"var(--t2)", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:3, padding:"1px 6px" }}>2K×{p.mk2}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Section>
                    )}


                  </div>
                );
              })() : (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:14, paddingTop:60, gap:10 }}>
                  <div style={{ fontSize:32 }}>🔬</div>
                  <div>No round data. Upload a JSON file to see match analytics.</div>
                  <button className="btn btn-ghost" style={{ marginTop:8 }} onClick={()=>{ setSel(null); setShowJsonUpload(true); resetJsonUpload(); }}>📂 Upload JSON</button>
                </div>
              ))}

              <button className="btn btn-red" style={{ width:"100%", justifyContent:"center", marginTop:24, flexShrink:0 }} onClick={()=>del(sel.id)}>Delete Scrim</button>
            </div>
          </div>
        , document.body);
      })()}

      {/* ── Discard Changes Confirm ── */}
      {/* ── Upload JSON Modal ── */}
      {showJsonUpload && (
        <Modal onClose={()=>{ setShowJsonUpload(false); resetJsonUpload(); }} title="Upload Riot Match JSON">
          {jsonState === "preview" && jsonPreview ? (
            <div style={{ maxHeight:"70vh", overflowY:"auto", paddingRight:4 }}>
              <div style={{ marginBottom:16 }}>
                <div className="label-sm" style={{ marginBottom:8 }}>Which team is ours?</div>
                <div style={{ display:"flex", gap:8 }}>
                  {["Blue","Red"].map(t => (
                    <button key={t} onClick={()=>setJsonTeam(t)} style={{
                      flex:1, padding:"10px", borderRadius:"var(--r)", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                      background: jsonTeam===t ? (t==="Blue"?"rgba(79,195,247,0.15)":"rgba(255,82,82,0.15)") : "var(--s3)",
                      color: jsonTeam===t ? (t==="Blue"?"#4fc3f7":"var(--red)") : "var(--t3)",
                      border: `1px solid ${jsonTeam===t ? (t==="Blue"?"rgba(79,195,247,0.4)":"rgba(255,82,82,0.4)") : "var(--b2)"}`,
                    }}>
                      {jsonTeam===t ? "✓ " : ""}{t} Team
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>
                  Change this if needed before confirming
                </div>
              </div>
              <div style={{ marginBottom:16, position:"relative" }}>
                <div className="label-sm" style={{ marginBottom:8 }}>Opponent Team Name</div>
                {(()=>{
                  const seen = new Map(); scrims.map(s=>s.opp).filter(Boolean).forEach(n=>{ const k=n.trim().toLowerCase(); if(!seen.has(k)) seen.set(k,n.trim()); }); const allOppNames = [...seen.values()].sort((a,b)=>a.localeCompare(b));
                  const filtered = allOppNames.filter(n => n.toLowerCase().includes(jsonOppName.toLowerCase()));
                  return (
                    <>
                      <input
                        ref={jsonOppInputRef}
                        type="text"
                        value={jsonOppName}
                        onChange={(e) => { setJsonOppName(e.target.value); setJsonOppDropdownOpen(true); }}
                        onFocus={() => setJsonOppDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setJsonOppDropdownOpen(false), 150)}
                        placeholder="Enter opponent team name..."
                        style={{
                          width:"100%",
                          padding:"10px 12px",
                          background:"var(--s3)",
                          border:"1px solid var(--b2)",
                          borderRadius:"var(--r)",
                          color:"var(--t1)",
                          fontSize:13,
                          boxSizing:"border-box",
                        }}
                      />
                      {jsonOppDropdownOpen && filtered.length > 0 && (
                        <div style={{
                          position:"absolute", top:"100%", left:0, right:0, zIndex:999,
                          background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)",
                          marginTop:4, maxHeight:180, overflowY:"auto", boxShadow:"0 4px 16px rgba(0,0,0,0.4)",
                        }}>
                          {filtered.map((name) => (
                            <div
                              key={name}
                              onMouseDown={() => { setJsonOppName(name); setJsonOppDropdownOpen(false); }}
                              style={{
                                padding:"9px 12px", fontSize:13, cursor:"pointer", color:"var(--t1)",
                                borderBottom:"1px solid var(--b2)",
                                transition:"background 0.1s",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background="var(--s3)"}
                              onMouseLeave={e => e.currentTarget.style.background=""}
                            >
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>
                  Customize the opponent team name (default: {jsonPreview.opp})
                </div>
              </div>
              <div style={{ marginBottom:16, padding:"14px 16px", background:"var(--b2)", borderRadius:"var(--r)", border:"1px solid var(--border)" }}>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
                  <span className="chip chip-blue">{jsonPreview.map}</span>
  {(()=>{
                    // re-derive res/score based on currently selected team
                    const raw = jsonPreview._matchData;
                    const teamData = raw?.teams?.find(t=>t.teamId===jsonTeam);
                    const ourPts = teamData?.numPoints ?? 0;
                    const oppPts = (raw?.teams||[]).find(t=>t.teamId!==jsonTeam)?.numPoints ?? 0;
                    const isWin = teamData?.won === true;
                    const scoreStr = `${ourPts}-${oppPts}`;
                    return (<>
                      <span className={`chip ${isWin?"chip-green":"chip-red"}`}>{isWin?"▲ Win":"▼ Loss"}</span>
                      <span className="bc" style={{ fontSize:22, fontWeight:900, color:isWin?"var(--green)":"var(--red)" }}>{scoreStr}</span>
                    </>);
                  })()}
                </div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:4 }}>Date: <b style={{ color:"var(--t1)" }}>{jsonPreview.date}</b></div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:10 }}>Opponent: <b style={{ color:"var(--t1)" }}>vs {jsonOppName || jsonPreview.opp}</b></div>
                <div style={{ fontSize:12, color:"var(--t2)", marginBottom:6 }}>Our Team ({jsonTeam}):</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {(()=>{
                    try {
                      const raw = jsonPreview._matchData;
                      const agents = (raw?.players||[]).filter(p=>p.teamId===jsonTeam).map(p=>{
                        const cid = p.characterId?.toLowerCase()||"";
                        // map characterId to agent name via existing AGENT_ICONS keys — fallback to stored comp
                        return p.characterId;
                      });
                      // Use stored comp if team matches original, else re-derive from raw
                      if (jsonTeam === jsonPreview._originalTeamId) {
                        const c=Array.isArray(jsonPreview.comp)?jsonPreview.comp:JSON.parse(jsonPreview.comp||"[]"); return c.map((a,i)=><AgentBadge key={i} name={a} size={32}/>);
                      }
                      // Other team: get their agents from player_stats comp field if available
                      const oppStats = Array.isArray(jsonPreview.player_stats)?jsonPreview.player_stats:JSON.parse(jsonPreview.player_stats||"[]");
                      const oppAgents = oppStats.filter(p=>p.side==="red").map(p=>p.agent);
                      return oppAgents.map((a,i)=><AgentBadge key={i} name={a} size={32}/>);
                    } catch{ return []; }
                  })()}
                </div>
                <div style={{ fontSize:12, color:"var(--t2)", marginBottom:6 }}>Rounds:</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                  {(()=>{ try { const r=Array.isArray(jsonPreview.rounds)?jsonPreview.rounds:JSON.parse(jsonPreview.rounds||"[]"); return r; } catch{ return []; } })().map((r,i)=><div key={i} className={`pip pip-${r}`}>{i+1}</div>)}
                </div>
              </div>
              <div style={{ fontSize:12, color:"var(--green)", marginBottom:16, padding:"8px 12px", background:"rgba(105,240,174,0.07)", borderRadius:"var(--r)", border:"1px solid rgba(105,240,174,0.2)" }}>
                ✓ Match parsed. Saved to DB — click confirm to add to your Scrim Log.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={resetJsonUpload}>← Back</button>
                <button className="btn btn-acc" style={{ flex:2, justifyContent:"center" }} onClick={handleJsonSave} disabled={jsonState==="saving"}>
                  {jsonState==="saving" ? "Loading…" : "✓ Confirm & Add to Log"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom:16 }}>
                <div className="label-sm" style={{ marginBottom:8 }}>Which team is ours?</div>
                <div style={{ display:"flex", gap:8 }}>
                  {["Blue","Red"].map(t => (
                    <button key={t} onClick={()=>setJsonTeam(t)} style={{
                      flex:1, padding:"10px", borderRadius:"var(--r)", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
                      background: jsonTeam===t ? (t==="Blue"?"rgba(79,195,247,0.15)":"rgba(255,82,82,0.15)") : "var(--s3)",
                      color: jsonTeam===t ? (t==="Blue"?"#4fc3f7":"var(--red)") : "var(--t3)",
                      border: `1px solid ${jsonTeam===t ? (t==="Blue"?"rgba(79,195,247,0.4)":"rgba(255,82,82,0.4)") : "var(--b2)"}`,
                    }}>
                      {jsonTeam===t ? "✓ " : ""}{t} Team
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>
                  This sets which side's stats are labelled "Our Team" in the view.
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div className="label-sm" style={{ marginBottom:8 }}>Riot Match JSON File</div>
                <div style={{ padding:"20px", border:"2px dashed var(--b2)", borderRadius:"var(--r)", textAlign:"center", background:"var(--b1)" }}>
                  <input type="file" accept=".json,application/json" onChange={handleJsonFileChange}
                    style={{ display:"block", margin:"0 auto", fontSize:12, color:"var(--t2)" }}/>
                  {jsonFile && <div style={{ marginTop:8, fontSize:11, color:"var(--acc)", fontWeight:700 }}>📄 {jsonFile.name}</div>}
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>
                    Run the .bat file to get this JSON, then upload it here.
                  </div>
                </div>
              </div>

              {jsonState==="error" && (
                <div style={{ color:"var(--red)", fontSize:12, marginBottom:12, padding:"8px 12px", background:"rgba(255,80,80,0.08)", borderRadius:"var(--r)", border:"1px solid rgba(255,80,80,0.2)" }}>
                  ✕ {jsonError}
                </div>
              )}

              <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center" }}
                onClick={handleJsonParse} disabled={!jsonFile || jsonState==="parsing"}>
                {jsonState==="parsing" ? "Parsing…" : "📂 Parse & Preview"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ── Import Modal ── */}
      {showImport && (
        <Modal onClose={()=>setShowImport(false)} title="Import Scrim from Riot">
          {importState === "preview" && importPreview ? (
            <div>
              <div style={{ marginBottom:16, padding:"14px 16px", background:"var(--b2)", borderRadius:"var(--r)", border:"1px solid var(--border)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                  <span className="chip chip-blue">{importPreview.map}</span>
                  <span className={`chip ${importPreview.res==="W"?"chip-green":"chip-red"}`}>{importPreview.res==="W"?"▲ Win":"▼ Loss"}</span>
                  <span className="bc" style={{ fontSize:22, fontWeight:900, color:importPreview.res==="W"?"var(--green)":"var(--red)" }}>{importPreview.score}</span>
                </div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:6 }}>Date: <b style={{ color:"var(--t1)" }}>{importPreview.date}</b></div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:6 }}>Opponent: <b style={{ color:"var(--t1)" }}>vs {importPreview.opp}</b></div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:8 }}>Agents:</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                  {(()=>{ try { return Array.isArray(importPreview.comp)?importPreview.comp:JSON.parse(importPreview.comp||"[]"); } catch{ return []; } })().map((a,i)=><AgentBadge key={i} name={a} size={32}/>)}
                </div>
                <div style={{ fontSize:13, color:"var(--t2)", marginBottom:6 }}>Rounds:</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {(()=>{ try { return Array.isArray(importPreview.rounds)?importPreview.rounds:JSON.parse(importPreview.rounds||"[]"); } catch{ return []; } })().map((r,i)=><div key={i} className={`pip pip-${r}`}>{i+1}</div>)}
                </div>
              </div>
              <div style={{ fontSize:12, color:"var(--t3)", marginBottom:16 }}>
                ✓ Match parsed successfully. Review above and save to your scrim log.
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={resetImport}>← Back</button>
                <button className="btn btn-acc" style={{ flex:2, justifyContent:"center" }} onClick={handleImportSave} disabled={importState==="saving"}>
                  {importState==="saving" ? "Saving…" : "Save to Scrim Log"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ padding:"12px 14px", background:"var(--b2)", borderRadius:"var(--r)", border:"1px solid var(--border)", marginBottom:16, display:"flex", alignItems:"flex-start", gap:10 }}>
                <span style={{ fontSize:18, flexShrink:0 }}>🖥</span>
                <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.7 }}>
                  <b style={{ color:"var(--t1)" }}>RA Helper must be running.</b><br/>
                  If a player is running it on their PC, enter their IP below.<br/>
                  If running on this PC, leave it as <code>127.0.0.1</code>.
                </div>
              </div>
              <div style={{ marginBottom:12, fontSize:12, color:"var(--t3)" }}>
                {helperIp !== "127.0.0.1"
                  ? <span>✓ Helper found at <code style={{color:"var(--acc)"}}>{helperIp}</code> — <button onClick={()=>saveHelperIp("127.0.0.1")} style={{background:"none",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:11,textDecoration:"underline"}}>reset</button></span>
                  : <span>Will auto-scan network if helper not found locally</span>
                }
              </div>
              {importState==="error" && (
                <div style={{ color:"var(--red)", fontSize:12, marginBottom:12, padding:"8px 12px", background:"rgba(255,80,80,0.08)", borderRadius:"var(--r)", border:"1px solid rgba(255,80,80,0.2)" }}>
                  ✕ {importError}
                </div>
              )}
              <button
                className="btn btn-acc"
                style={{ width:"100%", justifyContent:"center" }}
                onClick={handleImportFetch}
                disabled={importState==="loading"}
              >
                {importState==="loading" ? "Reading match data…" : "⬇ Import Last Scrim"}
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ── Team Overview Modal ── */}
      {teamOverview && (() => {
        const opp = teamOverview.opp;
        const teamScrims = scrims.filter(s => s.opp === opp).sort((a,b)=>b.date.localeCompare(a.date));
        const wins = teamScrims.filter(s=>s.res==="win"||s.res==="W").length;
        const losses = teamScrims.length - wins;
        const winRate = teamScrims.length ? Math.round((wins/teamScrims.length)*100) : 0;

        const mapStats = {};
        teamScrims.forEach(s=>{
          if(!mapStats[s.map]) mapStats[s.map]={w:0,l:0};
          if(s.res==="win"||s.res==="W") mapStats[s.map].w++; else mapStats[s.map].l++;
        });

        const toEmbed = url => {
          if (!url) return null;
          const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
          if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
          return url;
        };

        const saveVod = async (scrim) => {
          const url = (vodInputs[scrim.id]||"").trim();
          if (!url) return;
          setVodSaving(p=>({...p,[scrim.id]:true}));
          try {
            const embed = toEmbed(url);
            const existing = vods.find(v=>v.scrim_id===scrim.id);
            if (existing) {
              const updated = {...existing, url:embed};
              await api.put(`/api/vods/${existing.id}`, {...updated, ts:JSON.stringify(updated.ts||[]), gen_note:updated.genNote||""});
              setVods(p=>p.map(v=>v.id===existing.id?{...v,url:embed}:v));
            } else {
              const saved = await api.post("/api/vods", { title:`vs ${scrim.opp} (${scrim.date})`, folder:"Scrims", url:embed, ts:"[]", scrim_id:scrim.id });
              if (saved?.id) setVods(p=>[...p, {...saved, ts:[], genNote:"", scrim_id:scrim.id}]);
            }
            setVodInputs(p=>({...p,[scrim.id]:""}));
          } catch(e) { /* silent */ }
          setVodSaving(p=>({...p,[scrim.id]:false}));
        };

        return ReactDOM.createPortal(
          <Modal onClose={()=>setTeamOverview(null)} title={`Overview — vs ${opp}`} wide>
            {/* Stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Games", value:teamScrims.length, color:"var(--t1)" },
                { label:"Wins",  value:wins,              color:"var(--green)" },
                { label:"Losses",value:losses,            color:"var(--red)" },
                { label:"Win Rate", value:`${winRate}%`,  color:winRate>=50?"var(--green)":"var(--red)" },
              ].map(({label,value,color})=>(
                <div key={label} style={{ background:"var(--b2)", borderRadius:"var(--r)", padding:"14px 16px", textAlign:"center", border:"1px solid var(--border)" }}>
                  <div className="bc" style={{ fontSize:28, fontWeight:900, color }}>{value}</div>
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Map breakdown */}
            {Object.keys(mapStats).length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Map Breakdown</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {Object.entries(mapStats).map(([map,{w,l}])=>(
                    <div key={map} style={{ background:"var(--b2)", borderRadius:"var(--r)", padding:"8px 14px", border:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                      <span className="chip chip-blue" style={{ fontSize:11 }}>{map}</span>
                      <span style={{ fontSize:12, color:"var(--green)", fontWeight:700 }}>{w}W</span>
                      <span style={{ fontSize:12, color:"var(--t3)" }}>–</span>
                      <span style={{ fontSize:12, color:"var(--red)", fontWeight:700 }}>{l}L</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scrim list with VODs */}
            <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>
              All Scrims vs {opp}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:"none", overflowY:"visible" }}>
              {teamScrims.map(s=>{
                const isWin = s.res==="win"||s.res==="W";
                const linkedVod = vods.find(v=>v.scrim_id===s.id);
                return (
                  <div key={s.id} style={{ background:"var(--b2)", borderRadius:"var(--r)", border:"1px solid var(--border)", borderLeft:`3px solid ${isWin?"var(--green)":"var(--red)"}`, padding:"12px 16px" }}>
                    {/* Row header */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                      <span className="mono" style={{ fontSize:11, color:"var(--t3)", minWidth:82 }}>{s.date}</span>
                      <span className="chip chip-blue" style={{ fontSize:10 }}>{s.map}</span>
                      <span className="bc" style={{ fontSize:18, fontWeight:900, color:isWin?"var(--green)":"var(--red)", minWidth:40 }}>{s.score}</span>
                      <span className={`chip ${isWin?"chip-green":"chip-red"}`} style={{ fontSize:10 }}>{isWin?"▲ Win":"▼ Loss"}</span>
                      <button className="btn btn-ghost" style={{ marginLeft:"auto", padding:"3px 10px", fontSize:11 }}
                        onClick={()=>{ setTeamOverview(null); setSel(s); setSelTab("scoreboard"); api.get(`/api/scrims/${s.id}`).then(f=>{ if(f?.id) setSel(f); }).catch(()=>{}); }}>
                        Details →
                      </button>
                    </div>

                    {/* VOD embed if exists */}
                    {linkedVod?.url && (
                      <div style={{ position:"relative", paddingBottom:"32%", height:0, borderRadius:6, overflow:"hidden", background:"#000", marginBottom:8 }}>
                        <iframe src={linkedVod.url} style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", border:"none" }} allowFullScreen title={`VOD vs ${s.opp} ${s.date}`}/>
                      </div>
                    )}

                    {/* VOD input */}
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <span style={{ fontSize:12 }}>🎬</span>
                      <input type="text" style={{ flex:1, fontSize:11 }}
                        placeholder={linkedVod?.url ? "Replace VOD URL (YouTube link)…" : "Paste YouTube VOD link to attach…"}
                        value={vodInputs[s.id]||""}
                        onChange={e=>setVodInputs(p=>({...p,[s.id]:e.target.value}))}/>
                      <button
                        className={linkedVod?.url ? "btn btn-ghost" : "btn btn-acc"}
                        style={{ fontSize:11, padding:"4px 12px", whiteSpace:"nowrap" }}
                        disabled={vodSaving[s.id]||!(vodInputs[s.id]||"").trim()}
                        onClick={()=>saveVod(s)}>
                        {vodSaving[s.id] ? "Saving…" : linkedVod?.url ? "Update" : "+ VOD"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Modal>
        , document.body);
      })()}
    </div>
  );
}

/* ════ STRATEGY ════ */
function Strategy({ tab, setTab, isAdmin }) {
  const { playbookId } = useParams();
  const TABS = [{ key:"playbooks", label:"Playbooks" },{ key:"gameplans", label:"Anti-Strat Plans" }];
  const safeTab = TABS.find(t=>t.key===tab) ? tab : "playbooks";
  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>STRATEGY</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Tactical hub — playbooks and game plans</div>
      <div className="tab-bar" style={{ maxWidth:280, marginBottom:24 }}>
        {TABS.map(t=><button key={t.key} className={`tab${safeTab===t.key?" on":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
      </div>
      {safeTab==="playbooks" && <Playbooks isAdmin={isAdmin} autoOpenId={playbookId ? Number(playbookId) : null}/>}
      {safeTab==="gameplans" && <GamePlans/>}
    </div>
  );
}

/* ── PLAYBOOKS: PDF embed, saved to DB ── */
const FALLBACK_MAPS = [
  { displayName:"Ascent",   splash:"https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png" },
  { displayName:"Split",    splash:"https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png" },
  { displayName:"Fracture", splash:"https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png" },
  { displayName:"Bind",     splash:"https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png" },
  { displayName:"Breeze",   splash:"https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png" },
  { displayName:"Abyss",    splash:"https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png" },
  { displayName:"Lotus",    splash:"https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/splash.png" },
  { displayName:"Sunset",   splash:"https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/splash.png" },
  { displayName:"Pearl",    splash:"https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/splash.png" },
  { displayName:"Icebox",   splash:"https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/splash.png" },
  { displayName:"Haven",    splash:"https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/splash.png" },
  { displayName:"Corrode",  splash:"https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/splash.png" },
];
function Playbooks({ isAdmin, autoOpenId }) {
  const [comps, setComps]       = useState([]);
  const [selComp, setSelComp]   = useState(null);
  const [agents, setAgents]     = useState([]);
  const [mapData, setMapData]   = useState(FALLBACK_MAPS);
  const [strats, setStrats]     = useState([]);
  const [blocks, setBlocks]     = useState([]);
  const [activeSide, setActiveSide] = useState("atk");
  const [collapsed, setCollapsed]   = useState({});
  const [addStratModal, setAddStratModal] = useState(null);
  const [addBlockModal, setAddBlockModal] = useState(null);
  const [blockMenuCat, setBlockMenuCat]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [lightbox, setLightbox]     = useState(null);
  const [newPlaybookModal, setNewPlaybookModal] = useState(false);
  const [newPBForm, setNewPBForm] = useState({ name:"", map:"", agents:["","","","",""], status:"Active" });
  const [loading, setLoading]   = useState(false);
  const [selStrat, setSelStrat] = useState(null);
  const [compsLoading, setCompsLoading] = useState(true);
  const [pbTab, setPbTab]       = useState("strats"); // "strats" | "lineups"
  const [lineups, setLineups]   = useState([]);
  const [lineupsLoading, setLineupsLoading] = useState(false);
  const [lineupModal, setLineupModal] = useState(null); // null | "new" | {lineup obj}
  const [exporting, setExporting] = useState(false);
  const [swapIndex, setSwapIndex] = useState(null); // index of agent being swapped
  const [editingCat, setEditingCat] = useState(null); // { side, index } of cat being renamed
  const [editingCatVal, setEditingCatVal] = useState("");

  const DEFAULT_ATK_CATS = ["Pistol","Defaults","Executes","Eco/Force/Set Plays"];
  const DEFAULT_DEF_CATS = ["Pistol","Setups","Retakes","Eco/Force/Set Plays"];

  const getCustomCats = (comp) => {
    if (!comp) return { atk: DEFAULT_ATK_CATS, def: DEFAULT_DEF_CATS };
    try {
      const parsed = comp.custom_cats ? JSON.parse(comp.custom_cats) : null;
      return {
        atk: (parsed?.atk && parsed.atk.length > 0) ? parsed.atk : DEFAULT_ATK_CATS,
        def: (parsed?.def && parsed.def.length > 0) ? parsed.def : DEFAULT_DEF_CATS,
      };
    } catch { return { atk: DEFAULT_ATK_CATS, def: DEFAULT_DEF_CATS }; }
  };

  const saveCustomCats = async (newCats) => {
    if (!selComp) return;
    const updated = { ...selComp, custom_cats: JSON.stringify(newCats) };
    await api.put(`/api/strats/${selComp.id}`, updated).catch(() => {});
    setSelComp(updated);
    setComps(p => p.map(c => c.id === selComp.id ? updated : c));
  };

  const customCats = getCustomCats(selComp);
  const ATK_CATS = customCats.atk;
  const DEF_CATS = customCats.def;
  const CATS = activeSide === "atk" ? ATK_CATS : DEF_CATS;
  const catDbName = (cat) => cat;

  useEffect(() => {
    fetch("https://valorant-api.com/v1/maps")
      .then(r=>r.json()).then(d=>{ if(d.data){ setMapData(d.data.filter(m=>m.splash).map(m=>({ displayName:m.displayName, splash:m.splash }))); } }).catch(()=>{});
    api.get("/api/strats").then(d=>{
      if(Array.isArray(d)) {
        const cs = d.filter(s=>s.cat==="Composition");
        setComps(cs);
        setCompsLoading(false);
        if (autoOpenId) { const target = cs.find(c => c.id === autoOpenId); if (target) openPlaybook(target); }
        // Background prefetch all playbooks so opening is instant
        cs.forEach((comp, i) => {
          setTimeout(() => {
            if (prefetchCache.current[comp.id] || prefetching.current[comp.id]) return;
            prefetching.current[comp.id] = true;
            Promise.all([
              api.get(`/api/comp-strats?comp_id=${comp.id}`),
              api.get(`/api/comp-blocks?comp_id=${comp.id}`)
            ]).then(([s, b]) => {
              prefetchCache.current[comp.id] = {
                strats: Array.isArray(s) ? s : [],
                blocks: Array.isArray(b) ? b : [],
              };
            }).catch(()=>{}).finally(()=>{ prefetching.current[comp.id] = false; });
          }, i * 300); // stagger requests so we don't hammer the server
        });
      }
    }).catch(()=>{ setCompsLoading(false); });
  }, []);

  const agentIcon = name => AGENT_ICONS[name] || null;

  // Close agent swap picker when clicking outside
  useEffect(() => {
    if (swapIndex === null) return;
    const handler = () => setSwapIndex(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [swapIndex]);

  const getAgents = comp => {
    try { return Array.isArray(comp.agents)?comp.agents:JSON.parse(comp.agents||"[]"); }
    catch { return []; }
  };

  const mapSplash = map => {
    if (!map) return null;
    const found = mapData.find(m => m.displayName.toLowerCase().trim() === map.toLowerCase().trim());
    return found ? found.splash : null;
  };

  // Prefetch cache: comp_id -> { strats, blocks }
  const prefetchCache = React.useRef({});
  const prefetching   = React.useRef({});

  const prefetchPlaybook = (comp) => {
    const id = comp.id;
    if (prefetchCache.current[id] || prefetching.current[id]) return;
    prefetching.current[id] = true;
    Promise.all([
      api.get(`/api/comp-strats?comp_id=${id}`),
      api.get(`/api/comp-blocks?comp_id=${id}`)
    ]).then(([s, b]) => {
      prefetchCache.current[id] = {
        strats: Array.isArray(s) ? s : [],
        blocks: Array.isArray(b) ? b : [],
      };
    }).catch(() => {}).finally(() => { prefetching.current[id] = false; });
  };

  const openPlaybook = comp => {
    trackActivity({ type:"playbook", label:comp.name||(comp.map+" Playbook"), sub:`${comp.map} · ${comp.side||"ATK+DEF"}`, page:"strategy", id:comp.id });
    setSelComp(comp);
    setActiveSide("atk");
    setPbTab("strats");
    // Load lineups
    setLineupsLoading(true);
    api.get(`/api/comp-lineups?comp_id=${comp.id}`).then(d=>setLineups(Array.isArray(d)?d:[])).catch(()=>setLineups([])).finally(()=>setLineupsLoading(false));
    const cached = prefetchCache.current[comp.id];
    if (cached) {
      setStrats(cached.strats);
      setBlocks(cached.blocks);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/api/comp-strats?comp_id=${comp.id}`),
      api.get(`/api/comp-blocks?comp_id=${comp.id}`)
    ]).then(([s,b])=>{
      const strats = Array.isArray(s)?s:[];
      const blocks = Array.isArray(b)?b:[];
      setStrats(strats);
      setBlocks(blocks);
      prefetchCache.current[comp.id] = { strats, blocks };
    })
      .catch(()=>{ setStrats([]); setBlocks([]); })
      .finally(()=>setLoading(false));
  };

  const saveLineup = async (form) => {
    if (!selComp) return;
    if (form.id) {
      const updated = await api.put(`/api/comp-lineups/${form.id}`, form).catch(()=>null);
      if (updated) setLineups(p=>p.map(l=>l.id===form.id?updated:l));
    } else {
      const created = await api.post("/api/comp-lineups", { ...form, comp_id: selComp.id }).catch(()=>null);
      if (created) setLineups(p=>[...p, created]);
    }
    setLineupModal(null);
  };

  const delLineup = async id => {
    await api.delete(`/api/comp-lineups/${id}`).catch(()=>{});
    setLineups(p=>p.filter(l=>l.id!==id));
  };

  const exportToPdf = async () => {
    if (!selComp) return;
    setExporting(true);
    const ags = getAgents(selComp);
    const agentIcons = ags.map(a => AGENT_ICONS[a] || null);

    // Build print HTML
    const ATK_CATS = ["Pistol","Defaults","Executes","Eco/Force"];
    const DEF_CATS = ["Pistol","Setups","Retakes","Eco/Force"];

    const stratSection = (side, cats) => cats.map(cat => {
      const cs = strats.filter(s=>s.side===side&&s.category===cat);
      if (!cs.length) return "";
      return `<div style="margin-bottom:24px">
        <h3 style="font-size:13px;font-weight:800;text-transform:uppercase;color:#888;border-bottom:1px solid #333;padding-bottom:6px;margin-bottom:12px">${cat}</h3>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          ${cs.map(s=>`
            <div style="border:1px solid #333;border-radius:8px;overflow:hidden;break-inside:avoid">
              ${s.image_data?`<img src="${s.image_data}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"/>`:
              `<div style="width:100%;aspect-ratio:16/9;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#444;font-size:24px">🗺</div>`}
              <div style="padding:10px 12px;background:#111">
                <div style="font-weight:800;font-size:13px;color:#fff;margin-bottom:4px">${s.name}</div>
                ${s.description?`<div style="font-size:11px;color:#aaa;margin-bottom:6px">${s.description}</div>`:""}
                ${(()=>{try{const raw=JSON.parse(s.protocols||"[]");const p=raw.map(x=>typeof x==="string"?{text:x,isHeader:false}:x);return p.length?`<ol style="margin:0;padding-left:16px;font-size:11px;color:#ccc">${p.map(l=>l.isHeader?`<li style="font-weight:700;list-style:none">${l.text}</li>`:`<li>${l.text}</li>`).join("")}</ol>`:"";}catch{return "";}})()}
              </div>
            </div>`).join("")}
        </div>
      </div>`;
    }).join("");

    const lineupsHtml = lineups.length ? `
      <div style="page-break-before:always">
        <h2 style="font-size:18px;font-weight:900;color:#d4ff1e;margin-bottom:16px;letter-spacing:0.04em">LINEUPS</h2>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px">
          ${lineups.map(l=>`
            <div style="border:1px solid #333;border-radius:8px;overflow:hidden;break-inside:avoid">
              ${l.image_data?`<img src="${l.image_data}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block"/>`:
              `<div style="width:100%;aspect-ratio:16/9;background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#444;font-size:24px">🎯</div>`}
              <div style="padding:10px 12px;background:#111">
                <div style="font-weight:800;font-size:13px;color:#fff;margin-bottom:4px">${l.title}</div>
                ${l.agent?`<div style="font-size:11px;color:#4fc3f7;margin-bottom:4px">${l.agent} • ${l.ability||""}</div>`:""}
                ${l.notes?`<div style="font-size:11px;color:#aaa">${l.notes}</div>`:""}
              </div>
            </div>`).join("")}
        </div>
      </div>` : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${selComp.name} — Playbook</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#0a0a0f;color:#fff;font-family:Arial,sans-serif;padding:32px;font-size:13px}
      @media print{body{padding:0}@page{margin:16mm;size:A4}}
    </style></head><body>
      <!-- Cover -->
      <div style="margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #333">
        <div style="font-size:28px;font-weight:900;letter-spacing:0.04em;color:#d4ff1e;margin-bottom:8px">${selComp.name.toUpperCase()}</div>
        <div style="display:flex;gap:16px;align-items:center">
          <span style="background:rgba(79,195,247,0.15);color:#4fc3f7;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700">${selComp.map}</span>
          <div style="display:flex;gap:6px">${agentIcons.map((icon,i)=>icon?`<img src="${icon}" style="width:28px;height:28px;border-radius:6px;object-fit:cover">`:`<div style="width:28px;height:28px;border-radius:6px;background:#222;display:flex;align-items:center;justify-content:center;font-size:9px;color:#888">${(ags[i]||"").slice(0,2)}</div>`).join("")}</div>
          <span style="font-size:12px;color:#888">Exported ${new Date().toLocaleDateString()}</span>
        </div>
      </div>
      <!-- Attack -->
      <div style="margin-bottom:32px">
        <h2 style="font-size:18px;font-weight:900;color:#ff5252;margin-bottom:16px;letter-spacing:0.04em">⚔ ATTACK</h2>
        ${stratSection("atk", ATK_CATS)}
      </div>
      <!-- Defense -->
      <div style="margin-bottom:32px">
        <h2 style="font-size:18px;font-weight:900;color:#4fc3f7;margin-bottom:16px;letter-spacing:0.04em">🛡 DEFENSE</h2>
        ${stratSection("def", DEF_CATS)}
      </div>
      ${lineupsHtml}
    </body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); };
    setExporting(false);
  };

  const addStrat = async (side, category, name, imageData) => {
    if(!selComp||!name.trim()) return;
    const s = await api.post("/api/comp-strats",{ comp_id:selComp.id, side, category, name, image_data:imageData }).catch(()=>null);
    if(s) { setStrats(p=>[...p,s]); delete prefetchCache.current[selComp.id]; }
    setAddStratModal(null);
  };

  const delStrat = async id => {
    await api.delete(`/api/comp-strats/${id}`).catch(()=>{});
    setStrats(p=>p.filter(s=>s.id!==id)); setConfirmDel(null);
  };

  const updateStrat = async (updated) => {
    const saved = await api.put(`/api/comp-strats/${updated.id}`, updated);
    if(saved) setStrats(p=>p.map(s=>s.id===updated.id?saved:s));
    else setStrats(p=>p.map(s=>s.id===updated.id?updated:s));
  };

  const addBlock = async (side, category, block_type, content) => {
    if(!selComp) return;
    const b = await api.post("/api/comp-blocks",{ comp_id:selComp.id, side, category, block_type, content }).catch(()=>null);
    if(b) setBlocks(p=>[...p,b]);
    setAddBlockModal(null); setBlockMenuCat(null);
  };

  const delBlock = async id => {
    await api.delete(`/api/comp-blocks/${id}`).catch(()=>{});
    setBlocks(p=>p.filter(b=>b.id!==id)); setConfirmDel(null);
  };

  const toggleCollapse = key => setCollapsed(p=>({...p,[key]:!p[key]}));

  const catStrats = (cat) => strats.filter(s=>s.side===activeSide&&s.category===catDbName(cat));
  const catBlocks = (cat) => blocks.filter(b=>b.side===activeSide&&b.category===catDbName(cat));

  // Drag state refs — must be declared before any conditional return (React hooks rules)
  const dragId     = React.useRef(null);
  const dragOver   = React.useRef(null);
  const dragStatus = React.useRef(null);

  const STATUSES = ["Active", "In Progress", "In Theory", "Archived"];

  const onDragStart = (e, comp) => {
    dragId.current = comp.id;
    e.dataTransfer.effectAllowed = "move";
    e.currentTarget.style.opacity = "0.4";
  };

  const onDragEnd = (e) => {
    e.currentTarget.style.opacity = "1";
    document.querySelectorAll("[data-pb-card]").forEach(el => { el.style.outline = ""; });
  };

  const onDragOver = (e, comp) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOver.current = comp.id;
  };

  const onDragOverSection = (e, status) => {
    e.preventDefault();
    dragStatus.current = status;
  };

  const onDrop = (e, targetComp, targetStatus) => {
    e.preventDefault();
    const fromId = dragId.current;
    dragId.current = null;
    dragOver.current = null;
    dragStatus.current = null;
    if (!fromId) return;

    setComps(prev => {
      const fromComp = prev.find(c => c.id === fromId);
      if (!fromComp) return prev;

      const newStatus = targetStatus || fromComp.status || "Active";

      // 1. Apply status change
      let updated = prev.map(c => c.id === fromId ? { ...c, status: newStatus } : c);

      // 2. Reorder if dropped onto another card (guard against -1)
      if (targetComp && targetComp.id !== fromId) {
        const fromIdx = updated.findIndex(c => c.id === fromId);
        const toIdx   = updated.findIndex(c => c.id === targetComp.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          updated = [...updated];
          const [moved] = updated.splice(fromIdx, 1);
          updated.splice(toIdx, 0, moved);
        }
      }

      // 3. Persist order + status change as side effects via setTimeout
      //    (keeps updater pure — no API calls inside setState)
      const order = updated.map((c, i) => ({ id: c.id, sort_order: i }));
      setTimeout(() => {
        api.patch("/api/strats/reorder", { order }).catch(() => {});
        if (newStatus !== fromComp.status) {
          api.put(`/api/strats/${fromId}`, {
            name: fromComp.name, map: fromComp.map, side: fromComp.side || "atk",
            cat: fromComp.cat || "Composition", description: fromComp.description || "",
            agents: typeof fromComp.agents === "string" ? fromComp.agents : JSON.stringify(fromComp.agents || []),
            status: newStatus,
          }).catch(() => {});
        }
      }, 0);

      return updated;
    });
  };

  // If viewing a playbook
  if(selComp) {
    const splash = mapSplash(selComp.map);
    const ags = getAgents(selComp);
    return (
      <div>
        {/* Playbook header banner */}
        <div style={{ position:"relative", borderRadius:12, overflow:"visible", marginBottom:0, height:72,
          background: splash ? `url(${splash}) center/cover` : "var(--s2)",
          border:"1px solid var(--b1)", borderBottomLeftRadius:0, borderBottomRightRadius:0 }}>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(to right, rgba(10,10,15,0.92) 0%, rgba(10,10,15,0.6) 100%)", borderRadius:"12px 12px 0 0" }}/>
          <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", height:"100%", padding:"0 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <button onClick={()=>setSelComp(null)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:4 }}>← Back</button>
              <span className="chip chip-blue" style={{ fontSize:11 }}>{selComp.map}</span>
              <div style={{ display:"flex", gap:4, position:"relative" }}>
                {ags.map((ag,i) => {
                  const icon = agentIcon(ag);
                  const isSelected = swapIndex === i;
                  return (
                    <div key={i} style={{ position:"relative" }}>
                      <button
                        title={`Click to swap ${ag}`}
                        onClick={(e) => { e.stopPropagation(); setSwapIndex(isSelected ? null : i); }}
                        style={{ padding:0, background:"none", border:"none", cursor:"pointer", display:"block", borderRadius:6,
                          outline: isSelected ? "2px solid var(--acc)" : "none", outlineOffset:1 }}>
                        {icon
                          ? <img src={icon} alt={ag} style={{ width:28,height:28,borderRadius:6,objectFit:"cover",border:`1px solid ${isSelected?"var(--acc)":"var(--b2)"}`}}/>
                          : <div style={{ width:28,height:28,borderRadius:6,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"var(--t2)",border:`1px solid ${isSelected?"var(--acc)":"var(--b2)"}`}}>{ag.slice(0,2)}</div>
                        }
                      </button>
                      {isSelected && (
                        <div style={{ position:"absolute", top:36, left:0, zIndex:999, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:10, padding:8, width:224, boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}
                          onClick={e=>e.stopPropagation()}>
                          <div style={{ fontSize:11, color:"var(--t3)", marginBottom:6, paddingLeft:2 }}>Swap <b style={{color:"var(--acc)"}}>{ag}</b> with:</div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                            {Object.keys(AGENT_ICONS).filter(a=>!ags.includes(a)||a===ag).map(a=>{
                              const ico = agentIcon(a);
                              return (
                                <button key={a} title={a} onClick={async ()=>{
                                  const newAgs = [...ags]; newAgs[i] = a;
                                  const updated = {...selComp, agents: JSON.stringify(newAgs)};
                                  await api.put(`/api/strats/${selComp.id}`, updated).catch(()=>{});
                                  setSelComp(updated);
                                  setComps(p=>p.map(c=>c.id===selComp.id?updated:c));
                                  setSwapIndex(null);
                                }} style={{ padding:0, background:"none", border:"none", cursor:"pointer", borderRadius:5, outline: a===ag?"2px solid var(--acc)":"none", outlineOffset:1 }}>
                                  {ico
                                    ? <img src={ico} alt={a} style={{ width:26,height:26,borderRadius:5,objectFit:"cover",border:"1px solid var(--b2)"}}/>
                                    : <div style={{ width:26,height:26,borderRadius:5,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"var(--t2)",border:"1px solid var(--b2)"}}>{a.slice(0,2)}</div>
                                  }
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <StatusDropdown
                status={selComp.status||"Active"}
                onSelect={s=>{
                  const updated = {...selComp, status:s};
                  api.put(`/api/strats/${selComp.id}`, updated).catch(()=>{});
                  setSelComp(updated);
                  setComps(p=>p.map(c=>c.id===selComp.id?updated:c));
                }}
              />
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {/* PDF Export — admin only */}
              {isAdmin && (
                <button onClick={exportToPdf} disabled={exporting}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:7, border:"1px solid rgba(212,255,30,0.3)", background:"rgba(212,255,30,0.08)", color:"var(--acc)", cursor:"pointer", fontSize:12, fontWeight:700 }}>
                  {exporting ? "Exporting…" : "⬇ Export PDF"}
                </button>
              )}
              {/* Atk/Def toggle — only shown on strats tab */}
              {pbTab==="strats" && (
                <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid var(--b2)" }}>
                  {["atk","def"].map(s=>(
                    <button key={s} onClick={()=>setActiveSide(s)}
                      style={{ padding:"6px 18px", border:"none", cursor:"pointer", fontWeight:700, fontSize:12,
                        background: activeSide===s ? (s==="atk"?"var(--acc)":"#7c3aed") : "transparent",
                        color: activeSide===s ? (s==="atk"?"#000":"#fff") : "var(--t2)", transition:"all 0.15s" }}>
                      {s==="atk" ? "⚔ Attack" : "🛡 Defense"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar: Strats / Lineups */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--b1)", background:"var(--s1)", borderRadius:"0 0 0 0", marginBottom:16 }}>
          {[["strats","📋 Strats"],["lineups","🎯 Lineups"],["gameplan","📝 Game Plan"]].map(([key,label])=>(
            <button key={key} onClick={()=>setPbTab(key)}
              style={{ padding:"10px 20px", border:"none", borderBottom: pbTab===key?"2px solid var(--acc)":"2px solid transparent",
                background:"transparent", color: pbTab===key?"var(--t1)":"var(--t3)", cursor:"pointer", fontWeight:700, fontSize:13, transition:"all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── STRATS TAB ── */}
        {pbTab==="strats" && (
          <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12, padding:"20px 24px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:14, height:14, borderRadius:"50%", background: activeSide==="atk"?"#ff5252":"#4fc3f7" }}/>
              <span style={{ fontWeight:800, fontSize:18 }}>{activeSide==="atk"?"Attack":"Defense"}</span>
            </div>

            {loading && <div style={{ color:"var(--t3)", padding:20 }}>Loading…</div>}

            {!loading && CATS.map((cat, catIdx) => {
              const cs = catStrats(cat);
              const cb = catBlocks(cat);
              const colKey = activeSide+cat;
              const isCollapsed = collapsed[colKey];
              const isEditingThisCat = editingCat && editingCat.side === activeSide && editingCat.index === catIdx;
              return (
                <div key={catIdx} style={{ borderBottom:"1px solid var(--b1)", paddingBottom:16, marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: isCollapsed?0:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:14, cursor:"pointer" }} onClick={()=>toggleCollapse(colKey)}>{isCollapsed?"›":"⌄"}</span>
                      {isAdmin && isEditingThisCat ? (
                        <input
                          autoFocus
                          value={editingCatVal}
                          onChange={e=>setEditingCatVal(e.target.value)}
                          onKeyDown={async e=>{
                            if(e.key==="Enter"){
                              const newVal = editingCatVal.trim();
                              if(!newVal){ setEditingCat(null); return; }
                              const newCats = { ...customCats };
                              newCats[activeSide] = [...CATS];
                              newCats[activeSide][catIdx] = newVal;
                              await saveCustomCats(newCats);
                              setEditingCat(null);
                            } else if(e.key==="Escape"){ setEditingCat(null); }
                          }}
                          onBlur={async ()=>{
                            const newVal = editingCatVal.trim();
                            if(newVal && newVal !== cat){
                              const newCats = { ...customCats };
                              newCats[activeSide] = [...CATS];
                              newCats[activeSide][catIdx] = newVal;
                              await saveCustomCats(newCats);
                            }
                            setEditingCat(null);
                          }}
                          style={{ fontWeight:700, fontSize:15, background:"var(--s3)", border:"1px solid var(--acc)", borderRadius:5, color:"var(--t1)", padding:"2px 8px", outline:"none", width:160 }}
                        />
                      ) : (
                        <>
                          <span
                            style={{ fontWeight:700, fontSize:15, cursor: isAdmin?"pointer":"default" }}
                            title={isAdmin?"Double-click to rename":""}
                            onDoubleClick={()=>{ if(!isAdmin) return; setEditingCat({side:activeSide,index:catIdx}); setEditingCatVal(cat); }}
                          >{cat}</span>
                          {isAdmin && (
                            <span
                              title="Rename category"
                              onClick={()=>{ setEditingCat({side:activeSide,index:catIdx}); setEditingCatVal(cat); }}
                              style={{ fontSize:11, color:"var(--t3)", cursor:"pointer", opacity:0.6 }}>✏️</span>
                          )}
                        </>
                      )}
                      <span style={{ fontSize:11, color:"var(--t3)", background:"var(--s3)", borderRadius:10, padding:"1px 8px", fontWeight:600 }}>{cs.length}</span>
                      {isAdmin && CATS.length > 1 && (
                        <span
                          title="Delete category"
                          onClick={async ()=>{
                            if(!confirm(`Delete category "${cat}"? Strats inside won't be deleted.`)) return;
                            const newCats = { ...customCats };
                            newCats[activeSide] = CATS.filter((_,i)=>i!==catIdx);
                            await saveCustomCats(newCats);
                          }}
                          style={{ fontSize:11, color:"var(--t3)", cursor:"pointer", opacity:0.5, marginLeft:2 }}>✕</span>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        className="btn btn-acc"
                        style={{ padding:"3px 12px", fontSize:11, fontWeight:700 }}
                        onClick={e=>{ e.stopPropagation(); setAddStratModal({ side: activeSide, category: cat }); }}
                      >+ Add Strat</button>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div>
                      {cs.length>0 && (
                        <StratCardGrid
                          strats={cs}
                          isAdmin={isAdmin}
                          onDelete={id=>setConfirmDel({type:"strat",id})}
                          onExpand={setLightbox}
                          onEdit={setSelStrat}
                          onReorder={newOrder=>{
                            setStrats(prev=>{
                              const ids = new Set(newOrder.map(s=>s.id));
                              const rest = prev.filter(s=>!ids.has(s.id));
                              const merged = [...newOrder, ...rest];
                              api.patch("/api/comp-strats/reorder", { order: merged.map((s,i)=>({id:s.id,sort_order:i})) }).catch(()=>{});
                              delete prefetchCache.current[selComp.id];
                              return merged;
                            });
                          }}
                        />
                      )}
                      {cb.filter(b=>b.block_type!=="image").map(b=>(
                        <div key={b.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:"1px solid var(--b1)" }}>
                          <div style={{ fontSize: b.block_type==="heading"?15:13, fontWeight: b.block_type==="heading"?700:400, color:"#ffffff", lineHeight:1.6 }}>{b.content}</div>
                          <button onClick={()=>setConfirmDel({type:"block",id:b.id})} style={{ background:"none",border:"none",color:"var(--t3)",cursor:"pointer",fontSize:11,marginLeft:8,flexShrink:0 }}>✕</button>
                        </div>
                      ))}
                      {cb.filter(b=>b.block_type==="image").map(b=>(
                        <div key={b.id} style={{ position:"relative",marginBottom:8,display:"inline-block" }}>
                          <img src={b.content} alt="block" style={{ maxWidth:"100%",borderRadius:8,display:"block" }}/>
                          <button onClick={()=>setConfirmDel({type:"block",id:b.id})} style={{ position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.7)",border:"none",color:"#fff",cursor:"pointer",fontSize:11,borderRadius:4,padding:"2px 6px" }}>✕</button>
                        </div>
                      ))}
                      {cs.length===0&&cb.length===0 && (
                        <div style={{ fontSize:12,color:"var(--t3)",padding:"4px 0" }}>No content yet</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {isAdmin && (
              <button
                onClick={async () => {
                  const name = prompt("New category name:");
                  if (!name || !name.trim()) return;
                  const newCats = { ...customCats };
                  newCats[activeSide] = [...CATS, name.trim()];
                  await saveCustomCats(newCats);
                }}
                style={{ marginTop:4, padding:"6px 16px", fontSize:12, fontWeight:700, borderRadius:7,
                  border:"1px dashed var(--b2)", background:"transparent", color:"var(--t3)", cursor:"pointer" }}>
                + Add Category
              </button>
            )}
          </div>
        )}

        {/* ── LINEUPS TAB ── */}
        {pbTab==="lineups" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:16 }}>Lineups — {selComp.map}</div>
                <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>Smokes, flashes, mollies and post-plants for this comp</div>
              </div>
              <button className="btn btn-acc" onClick={()=>setLineupModal("new")}>+ Add Lineup</button>
            </div>
            {lineupsLoading ? (
              <div style={{ color:"var(--t3)", padding:20 }}>Loading…</div>
            ) : lineups.length===0 ? (
              <div className="card" style={{ textAlign:"center", padding:"48px 20px", color:"var(--t3)" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
                <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No lineups yet</div>
                <div style={{ fontSize:13, marginBottom:14 }}>Add smokes, flashes, molotovs and post-plant lineups</div>
                <button className="btn btn-acc" onClick={()=>setLineupModal("new")}>+ Add First Lineup</button>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
                {lineups.map(l=>(
                  <div key={l.id} style={{ borderRadius:12, overflow:"hidden", background:"var(--s1)", border:"1px solid var(--b1)", transition:"all 0.2s" }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--b3)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.4)"; }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--b1)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                    {/* Images */}
                    {(()=>{
                      const raw = l.image_data || "";
                      let imgs = [];
                      try { const p = JSON.parse(raw); imgs = Array.isArray(p) ? p : (raw ? [raw] : []); } catch { if(raw) imgs = [raw]; }
                      const first = imgs[0] || "";
                      return (
                        <div style={{ position:"relative", background:"var(--s3)", aspectRatio:"16/9", overflow:"hidden" }}>
                          {first
                            ? <img src={first} alt={l.title} style={{ width:"100%",height:"100%",objectFit:"cover",display:"block",cursor:"pointer" }} onClick={()=>setLightbox(first)}/>
                            : <div style={{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,color:"var(--t3)",opacity:0.2 }}>🎯</div>
                          }
                          {imgs.length > 1 && (
                            <div style={{ position:"absolute",bottom:8,left:8,background:"rgba(0,0,0,0.65)",borderRadius:5,padding:"2px 8px",fontSize:11,color:"#fff",fontWeight:600 }}>
                              📷 {imgs.length}
                            </div>
                          )}
                          <button onClick={()=>setLineupModal(l)} style={{ position:"absolute",top:8,right:36,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer",fontSize:11,borderRadius:5,padding:"3px 8px",backdropFilter:"blur(4px)" }}>✏</button>
                          <button onClick={()=>delLineup(l.id)} style={{ position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",cursor:"pointer",fontSize:11,borderRadius:5,padding:"3px 8px",backdropFilter:"blur(4px)" }}>✕</button>
                        </div>
                      );
                    })()}
                    <div style={{ padding:"12px 14px 14px" }}>
                      <div style={{ fontWeight:800, fontSize:15, color:"#fff", marginBottom:6 }}>{l.title}</div>
                      {(l.agent||l.ability) && (
                        <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:6 }}>
                          {l.agent && agentIcon(l.agent) && <img src={agentIcon(l.agent)} alt={l.agent} style={{ width:20,height:20,borderRadius:4,objectFit:"cover" }}/>}
                          <span style={{ fontSize:12, color:"#4fc3f7", fontWeight:600 }}>{[l.agent,l.ability].filter(Boolean).join(" · ")}</span>
                        </div>
                      )}
                      {l.notes && <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.6 }}>{l.notes}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {lightbox && (
          <div onClick={()=>setLightbox(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out" }}>
            <img src={lightbox} alt="expanded" style={{ maxWidth:"92vw",maxHeight:"90vh",borderRadius:10,objectFit:"contain",boxShadow:"0 8px 64px rgba(0,0,0,0.8)" }}/>
            <button onClick={()=>setLightbox(null)} style={{ position:"absolute",top:18,right:18,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",cursor:"pointer",borderRadius:8,padding:"6px 12px",fontSize:13 }}>✕ Close</button>
          </div>
        )}
        {addStratModal && <AddStratModal side={addStratModal.side} category={addStratModal.category} onSave={addStrat} onClose={()=>setAddStratModal(null)}/>}
        {addBlockModal && <AddBlockModal side={addBlockModal.side} category={addBlockModal.category} blockType={addBlockModal.type} onSave={addBlock} onClose={()=>setAddBlockModal(null)}/>}
        {confirmDel && <ConfirmModal title="Delete" message="This cannot be undone." onConfirm={()=>confirmDel.type==="strat"?delStrat(confirmDel.id):delBlock(confirmDel.id)} onCancel={()=>setConfirmDel(null)}/>}
        {selStrat && <StratDetailModal strat={selStrat} onClose={()=>setSelStrat(null)} onSave={updateStrat} onDelete={()=>{ delStrat(selStrat.id); setSelStrat(null); }}/>}
        {pbTab==="gameplan" && selComp && (
          <CompGamePlan comp={selComp}/>
        )}

        {lineupModal && <LineupModal lineup={lineupModal==="new"?null:lineupModal} agents={AGENTS} agentIcon={agentIcon} onSave={saveLineup} onClose={()=>setLineupModal(null)}/>}
      </div>
    );
  }

  // Playbooks list view
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800 }} className="bc">Playbooks</div>
          <div style={{ fontSize:13, color:"var(--t3)", marginTop:2 }}>Organized strategy collections by team composition</div>
        </div>
        <button className="btn btn-acc" onClick={()=>setNewPlaybookModal(true)}>+ New Playbook</button>
      </div>

      {compsLoading
        ? <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
            {[1,2,3].map(i=>(
              <div key={i} style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--b1)", background:"var(--s1)" }}>
                <div style={{ height:160, background:"var(--s3)" }}/>
                <div style={{ padding:"14px 14px 16px" }}>
                  <div style={{ height:14, width:"60%", background:"var(--s3)", borderRadius:4, marginBottom:10 }}/>
                  <div style={{ height:34, width:120, background:"var(--s3)", borderRadius:20, marginBottom:12 }}/>
                  <div style={{ height:10, width:"40%", background:"var(--s3)", borderRadius:4 }}/>
                </div>
              </div>
            ))}
          </div>
        : comps.length===0
        ? <div className="card" style={{ textAlign:"center",padding:"48px 20px",color:"var(--t3)" }}>
            <div style={{ fontSize:28,marginBottom:8 }}>📋</div>
            <div style={{ fontWeight:700,color:"var(--t2)",marginBottom:6 }}>No playbooks yet</div>
            <div style={{ fontSize:13, marginBottom:14 }}>Create a playbook to start organizing strategies</div>
            <button className="btn btn-acc" onClick={()=>setNewPlaybookModal(true)}>+ New Playbook</button>
          </div>
        : <div style={{ display:"flex", flexDirection:"column", gap:28 }}>
            {STATUSES.map(status => {
              const group = comps.filter(c => (c.status || "Active") === status);
              const sc = STATUS_COLORS[status];
              return (
                <div key={status}
                  onDragOver={e => onDragOverSection(e, status)}
                  onDrop={e => onDrop(e, null, status)}>
                  {/* Section header */}
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <span style={{ width:10, height:10, borderRadius:"50%", background:sc.color, display:"inline-block", flexShrink:0 }}/>
                    <span style={{ fontSize:12, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:sc.color }}>{status}</span>
                    <span style={{ fontSize:11, color:"var(--t3)", fontWeight:600 }}>{group.length}</span>
                    <div style={{ flex:1, height:1, background:"var(--b1)" }}/>
                  </div>

                  {group.length === 0
                    ? <div style={{ border:"2px dashed var(--b1)", borderRadius:14, padding:"24px 16px", textAlign:"center", color:"var(--t3)", fontSize:12, minHeight:80, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        Drop playbooks here
                      </div>
                    : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
                        {group.map(comp => {
                          const splash = mapSplash(comp.map);
                          const ags = getAgents(comp);
                          return (
                            <div key={comp.id}
                              data-pb-card="1"
                              draggable
                              onDragStart={e => onDragStart(e, comp)}
                              onDragEnd={onDragEnd}
                              onDragOver={e => onDragOver(e, comp)}
                              onDrop={e => { e.stopPropagation(); onDrop(e, comp, status); }}
                              onClick={() => openPlaybook(comp)}
                              style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--b1)", background:"var(--s1)", cursor:"grab", transition:"border-color 0.2s, transform 0.2s, box-shadow 0.2s", position:"relative" }}
                              onMouseEnter={e=>{ prefetchPlaybook(comp); e.currentTarget.style.borderColor="var(--b3)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.4)"; }}
                              onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--b1)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                              {/* Drag handle indicator */}
                              <div style={{ position:"absolute", top:10, left:10, zIndex:2, display:"flex", flexDirection:"column", gap:3, opacity:0.5, pointerEvents:"none" }}>
                                {[0,1,2].map(i=><div key={i} style={{ width:16, height:2, background:"#fff", borderRadius:1 }}/>)}
                              </div>
                              {/* Map splash */}
                              <div style={{ position:"relative", height:160, overflow:"hidden", background:"var(--s3)" }}>
                                {splash && <img src={splash} alt={comp.map} style={{ width:"100%", height:"100%", objectFit:"cover", filter:"brightness(0.7) saturate(1.1)" }}/>}
                                <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(10,10,15,0.85) 100%)" }}/>
                                <button onClick={e=>{ e.stopPropagation(); api.delete(`/api/strats/${comp.id}`).catch(()=>{}); setComps(p=>p.filter(c=>c.id!==comp.id)); }}
                                  style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:6, color:"#fff", cursor:"pointer", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, backdropFilter:"blur(4px)", zIndex:2 }}>🗑</button>
                              </div>
                              {/* Card body */}
                              <div style={{ padding:"14px 14px 12px" }}>
                                <div style={{ fontWeight:800, fontSize:17, color:"#fff", marginBottom:10, lineHeight:1.2 }}>{comp.name}</div>
                                <div style={{ display:"flex", marginBottom:12, position:"relative", height:34 }}>
                                  {ags.map((ag, i) => {
                                    const icon = agentIcon(ag);
                                    return icon
                                      ? <img key={i} src={icon} alt={ag} title={ag} style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", objectPosition:"top", border:"2px solid var(--s1)", position:"absolute", left: i * 22 }}/>
                                      : <div key={i} title={ag} style={{ width:34, height:34, borderRadius:"50%", background:"var(--s3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"var(--t2)", border:"2px solid var(--s1)", fontWeight:700, position:"absolute", left: i * 22 }}>{ag.slice(0,2)}</div>;
                                  })}
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                                  <span className="chip chip-blue" style={{ fontSize:11 }}>{comp.map}</span>
                                  <StatusChip status={comp.status||"Active"}/>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  }
                </div>
              );
            })}
          </div>
      }

      {newPlaybookModal && (()=>{
        const allAgentNames = AGENTS.map(a=>a.name).sort();
        const setAgent = (i, val) => setNewPBForm(f=>{ const ags=[...f.agents]; ags[i]=val; return {...f,agents:ags}; });
        const createPlaybook = async () => {
          if(!newPBForm.name.trim()||!newPBForm.map) return;
          const agList = newPBForm.agents.filter(Boolean);
          const created = await api.post("/api/strats",{
            name: newPBForm.name, map: newPBForm.map,
            cat: "Composition", agents: JSON.stringify(agList),
            side: "atk", description: "", status: newPBForm.status
          }).catch(()=>null);
          if(created) {
            const comp = { ...created, agents: created.agents || JSON.stringify(agList) };
            setComps(p=>[...p, comp]);
            setNewPlaybookModal(false);
            setNewPBForm({ name:"", map:"", agents:["","","","",""], status:"Active" });
            openPlaybook(comp);
          }
        };
        return (
          <Modal onClose={()=>setNewPlaybookModal(false)} title="New Playbook" wide>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Playbook Name *</div>
                <input type="text" value={newPBForm.name} onChange={e=>setNewPBForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Haven Double Duelist"/>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:6 }}>Map *</div>
                <select value={newPBForm.map} onChange={e=>setNewPBForm(f=>({...f,map:e.target.value}))}>
                  <option value="">Select a map…</option>
                  {MAPS.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:8 }}>Composition — Pick 5 Agents</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                  {[0,1,2,3,4].map(i=>(
                    <div key={i} style={{ display:"flex", flexDirection:"column", gap:5, alignItems:"center" }}>
                      {newPBForm.agents[i] && agentIcon(newPBForm.agents[i])
                        ? <img src={agentIcon(newPBForm.agents[i])} alt={newPBForm.agents[i]} style={{ width:40, height:40, borderRadius:8, objectFit:"cover", border:"2px solid var(--acc)" }}/>
                        : <div style={{ width:40, height:40, borderRadius:8, background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:"var(--t3)" }}>?</div>
                      }
                      <select value={newPBForm.agents[i]} onChange={e=>setAgent(i,e.target.value)}
                        style={{ fontSize:10, padding:"3px 2px", textAlign:"center", width:"100%" }}>
                        <option value="">…</option>
                        {allAgentNames.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="label-sm" style={{ marginBottom:8 }}>Status</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {["Active","In Progress","In Theory","Archived"].map(s=>(
                    <button key={s} onClick={()=>setNewPBForm(f=>({...f,status:s}))}
                      style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                        border:`1px solid ${STATUS_COLORS[s]?.border||"var(--b2)"}`,
                        background: newPBForm.status===s ? (STATUS_COLORS[s]?.bg||"var(--s3)") : "transparent",
                        color: newPBForm.status===s ? (STATUS_COLORS[s]?.color||"var(--t1)") : "var(--t3)", transition:"all 0.15s" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                <button className="btn btn-ghost" onClick={()=>setNewPlaybookModal(false)}>Cancel</button>
                <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }}
                  disabled={!newPBForm.name.trim()||!newPBForm.map}
                  onClick={createPlaybook}>
                  Create Playbook
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

const STATUS_COLORS = {
  "Active":      { bg:"rgba(105,240,174,0.15)", color:"#69f0ae", border:"rgba(105,240,174,0.3)" },
  "In Progress": { bg:"rgba(79,195,247,0.15)",  color:"#4fc3f7", border:"rgba(79,195,247,0.3)" },
  "In Theory":   { bg:"rgba(179,157,219,0.15)", color:"#b39ddb", border:"rgba(179,157,219,0.3)" },
  "Archived":    { bg:"rgba(138,142,170,0.15)", color:"#8892aa", border:"rgba(138,142,170,0.3)" },
};
const StatusChip = ({ status }) => {
  const s = STATUS_COLORS[status] || STATUS_COLORS["Active"];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:s.color, display:"inline-block" }}/>
    {status}
  </span>;
};

function StatusDropdown({ status, onSelect }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const chipRef = React.useRef(null);
  const toggle = e => {
    e.stopPropagation();
    if(chipRef.current) setRect(chipRef.current.getBoundingClientRect());
    setOpen(o=>!o);
  };
  const menu = open && rect ? ReactDOM.createPortal(
    <>
      <div style={{ position:"fixed", inset:0, zIndex:9998 }} onClick={()=>setOpen(false)}/>
      <div style={{ position:"fixed", top:rect.bottom+6, left:rect.left, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, zIndex:9999, minWidth:150, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.7)" }}>
        {Object.keys(STATUS_COLORS).map(s=>(
          <div key={s} onClick={e=>{ e.stopPropagation(); onSelect(s); setOpen(false); }}
            style={{ padding:"9px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:600,
              background:status===s?"var(--s3)":"transparent", color:STATUS_COLORS[s].color, transition:"background 0.1s" }}
            onMouseEnter={e=>e.currentTarget.style.background="var(--s3)"}
            onMouseLeave={e=>e.currentTarget.style.background=status===s?"var(--s3)":"transparent"}>
            <span style={{ width:7,height:7,borderRadius:"50%",background:STATUS_COLORS[s].color,display:"inline-block",flexShrink:0 }}/>
            {s}
          </div>
        ))}
      </div>
    </>,
    document.body
  ) : null;
  return (
    <div onClick={e=>e.stopPropagation()}>
      <div ref={chipRef} onClick={toggle} style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
        <StatusChip status={status}/>
        <span style={{ fontSize:10, color:"#9aa0b4" }}>▾</span>
      </div>
      {menu}
    </div>
  );
}

function StratCardGrid({ strats, isAdmin, onDelete, onExpand, onEdit, onReorder }) {
  const [items, setItems]     = React.useState(strats);
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  React.useEffect(()=>{ setItems(strats); }, [strats]);

  const onDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(()=>document.body.removeChild(ghost), 0);
  };
  const onDragEnter = (e, idx) => {
    e.preventDefault();
    if (idx === dragIdx) return;
    setOverIdx(idx);
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      setDragIdx(idx);
      return next;
    });
  };
  const onDragEnd = () => {
    setDragIdx(null); setOverIdx(null);
    onReorder(items);
  };

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16,marginTop:10}}>
      {items.map((s,idx)=>(
        <div key={s.id}
          draggable={isAdmin}
          onDragStart={e=>onDragStart(e,idx)}
          onDragEnter={e=>onDragEnter(e,idx)}
          onDragOver={e=>e.preventDefault()}
          onDragEnd={onDragEnd}
          style={{
            opacity:    dragIdx===idx ? 0.4 : 1,
            outline:    overIdx===idx && overIdx!==dragIdx ? "2px solid var(--acc)" : "none",
            outlineOffset: 2, borderRadius:12,
            transition: "opacity 0.15s, outline 0.1s",
          }}
        >
          <StratCard strat={s} onDelete={()=>onDelete(s.id)} onExpand={onExpand} onEdit={onEdit}
            isDragging={dragIdx===idx} showHandle={isAdmin}/>
        </div>
      ))}
    </div>
  );
}

const StratCard = React.memo(function StratCard({ strat, onDelete, onExpand, onEdit, isDragging, showHandle }) {
  const protocols = (() => { try { const p = JSON.parse(strat.protocols || "[]"); return p.map(x => typeof x==="string" ? {text:x,type:"bullet"} : x.isHeader ? {text:x.text,type:"header"} : {text:x.text||x,type:x.type||"bullet"}); } catch { return []; } })();
  return (
    <div style={{ borderRadius:12, overflow:"hidden", background:"var(--s2)", border:"1px solid var(--b1)", transition:"all 0.2s", cursor: isDragging?"grabbing":"pointer", display:"flex", flexDirection:"column" }}
      onMouseEnter={e=>{ if(isDragging) return; e.currentTarget.style.borderColor="var(--b3)"; e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 28px rgba(0,0,0,0.4)"; }}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--b1)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}
      onClick={e=>{ if(isDragging) return; onEdit(strat); }}>
      {/* Image */}
      <div style={{ position:"relative", background:"var(--s3)", aspectRatio:"16/9", overflow:"hidden", flexShrink:0 }}>
        {strat.image_data
          ? <img src={strat.image_data} alt={strat.name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
          : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)", fontSize:36, opacity:0.2 }}>🗺</div>
        }
        {/* Drag handle */}
        {showHandle && (
          <div title="Drag to reorder" style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.55)", borderRadius:4, padding:"4px 5px", display:"flex", gap:2, backdropFilter:"blur(4px)", pointerEvents:"none" }}>
            {[0,1,2].map(c=>(
              <div key={c} style={{display:"flex",flexDirection:"column",gap:2}}>
                {[0,1].map(r=><div key={r} style={{width:3,height:3,borderRadius:"50%",background:"rgba(255,255,255,0.65)"}}/>)}
              </div>
            ))}
          </div>
        )}
        {/* Expand image button */}
        {strat.image_data && (
          <button onClick={e=>{ e.stopPropagation(); onExpand(strat.image_data); }}
            style={{ position:"absolute", bottom:8, left:8, background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"4px 9px", backdropFilter:"blur(4px)" }}>⛶ Expand</button>
        )}
        <button onClick={e=>{ e.stopPropagation(); onDelete(); }}
          style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"3px 8px", backdropFilter:"blur(4px)" }}>✕</button>
      </div>
      {/* Body */}
      <div style={{ padding:"14px 16px 16px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:15, color:"#fff", lineHeight:1.3, flex:1, minWidth:0 }}>{strat.name}</div>
            <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:10, flexShrink:0, background: strat.side==="atk"?"rgba(255,82,82,0.2)":"rgba(79,195,247,0.2)", color: strat.side==="atk"?"#ff5252":"#4fc3f7" }}>{strat.side==="atk"?"ATK":"DEF"}</span>
          </div>
          <StatusChip status={strat.status || "Active"}/>
        </div>
        {strat.description && (
          <div style={{ fontSize:12, color:"var(--t2)", lineHeight:1.6, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{strat.description.replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim()}</div>
        )}
        {protocols.length > 0 && (
          <div style={{ borderTop:"1px solid var(--b1)", paddingTop:8, marginTop:2 }}>
            {protocols.slice(0,3).map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:4 }}>
                <span style={{ fontSize:12, color: p.type==="header"?"#fff":"var(--t2)", fontWeight: p.type==="header"?700:400, lineHeight:1.5 }}>{p.type==="bullet"?"• ":""}{(p.text||"").replace(/<br\s*\/?>/gi," ").replace(/<[^>]+>/g,"").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').trim()}</span>
              </div>
            ))}
            {protocols.length > 3 && <div style={{ fontSize:11, color:"var(--t3)", paddingLeft:16 }}>+{protocols.length-3} more…</div>}
          </div>
        )}
      </div>
    </div>
  );
});

function StratDetailModal({ strat, onClose, onSave, onDelete }) {
  const [name, setName]           = useState(strat.name || "");
  const [desc, setDesc]           = useState(strat.description || "");
  const [status, setStatus]       = useState(strat.status || "Active");
  const [imageData, setImageData] = useState(strat.image_data || "");
  const [saving, setSaving]       = useState(false);
  const [lightbox, setLightbox]   = useState(false);
  // Protocols: array of strings
  const initProtocols = () => {
    try {
      const p = JSON.parse(strat.protocols || "[]");
      if (!p.length) return [{ text:"", type:"bullet" }];
      return p.map(x => {
        if (typeof x === "string") return { text:x, type:"bullet" };
        if (x.isHeader) return { text:x.text, type:"header" };
        return { text:x.text||x, type:x.type||"bullet" };
      });
    } catch { return [{ text:"", type:"bullet" }]; }
  };
  const [protocols, setProtocols] = useState(initProtocols);
  const [protoToolbar, setProtoToolbar] = useState(null); // {index, x, y}
  // Explanations: array of { text, image }
  const initExplanations = () => { try { return JSON.parse(strat.explanations || "[]"); } catch { return []; } };
  const [explanations, setExplanations] = useState(initExplanations);
  const [protocolsOpen, setProtocolsOpen] = useState(true);
  const [confirmExit, setConfirmExit] = useState(false);

  const isDirty = () => {
    const origProtocols = (() => { try { const p = JSON.parse(strat.protocols||"[]"); if(!p.length) return [{text:"",type:"bullet"}]; return p.map(x=>typeof x==="string"?{text:x,type:"bullet"}:x.isHeader?{text:x.text,type:"header"}:{text:x.text||x,type:x.type||"bullet"}); } catch { return [{text:"",type:"bullet"}]; } })();
    const origExplanations = (() => { try { return JSON.parse(strat.explanations||"[]"); } catch { return []; } })();
    return name !== (strat.name||"") || desc !== (strat.description||"") || status !== (strat.status||"Active") || imageData !== (strat.image_data||"") || JSON.stringify(protocols) !== JSON.stringify(origProtocols) || JSON.stringify(explanations) !== JSON.stringify(origExplanations);
  };

  const tryClose = () => { if (isDirty()) setConfirmExit(true); else onClose(); };

  const handleImg = e => {
    const file = e.target.files[0]; if(!file) return;
    compressImage(file).then(setImageData);
  };

  const handleExplImg = (i, e) => {
    const file = e.target.files[0]; if(!file) return;
    e.target.value = "";
    compressImage(file).then(result => setExplanations(prev => prev.map((x,xi) => xi===i ? {...x, image: result} : x)));
  };

  const addProtocolLine = (afterIndex) => {
    const idx = afterIndex !== undefined ? afterIndex + 1 : protocols.length;
    setProtocols(p => { const n=[...p]; n.splice(idx,0,{text:"",type:"bullet"}); return n; });
    return idx;
  };
  const setProtocolText = (i, v) => setProtocols(p => p.map((x,xi) => xi===i ? {...x, text:v} : x));
  const setProtocolType = (i, type) => { setProtocols(p => p.map((x,xi) => xi===i ? {...x, type} : x)); setProtoToolbar(null); };
  const delProtocolLine = (i) => setProtocols(p => p.length>1 ? p.filter((_,xi)=>xi!==i) : [{text:"",type:"bullet"}]);

  const addExplanation = () => setExplanations(p => [...p, { text:"", image:"" }]);
  const setExplText = (i, v) => setExplanations(p => p.map((x,xi) => xi===i ? {...x, text:v} : x));
  const delExplanation = (i) => setExplanations(p => p.filter((_,xi) => xi!==i));
  const explRefs = React.useRef([]);

  const [saveError, setSaveError] = useState(null);
  const save = async () => {
    if (!name.trim()) { setSaveError("Name is required."); return; }
    setSaving(true); setSaveError(null);
    // Flush any pending contenteditable html from explanation editors
    const flushedExplanations = explanations.map((exp, i) => ({
      ...exp,
      text: explRefs.current[i] ? explRefs.current[i].innerHTML : exp.text,
    }));
    try {
      await onSave({
        ...strat, name, description:desc, status,
        image_data: imageData !== strat.image_data ? imageData : undefined,
        protocols: JSON.stringify(protocols.filter(p=>p.text.trim())),
        explanations: JSON.stringify(flushedExplanations),
      });
      setSaving(false);
      onClose();
    } catch(e) {
      setSaving(false);
      setSaveError(e.message || "Save failed. Please try again.");
    }
  };

  return ReactDOM.createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", zIndex:9999, overflowY:"auto" }}
      onClick={tryClose}>
      <div style={{ background:"#111318", minHeight:"100vh", maxWidth:860, margin:"0 auto", padding:"48px 56px 80px", position:"relative", animation:"fadeUp 0.2s ease" }}
        onClick={e=>e.stopPropagation()}>

        {/* Close + Delete bar */}
        <div style={{ position:"sticky", top:0, zIndex:10, background:"#111318", display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:16, marginBottom:8, borderBottom:"1px solid var(--b1)" }}>
          <button onClick={tryClose} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13, padding:"4px 0" }}
            onMouseOver={e=>e.currentTarget.style.color="var(--t1)"} onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {saveError && <span style={{ fontSize:12, color:"#ff5252", maxWidth:220 }}>{saveError}</span>}
            <button className="btn btn-red" style={{ padding:"5px 14px", fontSize:12 }} onClick={()=>{ onDelete(); onClose(); }}>Delete</button>
            <button className="btn btn-ghost" style={{ padding:"5px 14px", fontSize:12 }} onClick={tryClose}>Cancel</button>
            <button className="btn btn-acc" style={{ padding:"5px 18px", fontSize:12 }} onClick={save} disabled={saving}>{saving?"Saving…":"Save"}</button>
          </div>
        </div>

        {/* Title */}
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{ fontSize:32, fontWeight:900, background:"transparent", border:"none", color:"#fff", outline:"none", width:"100%", fontFamily:"'DIN Next LT Pro',sans-serif", letterSpacing:"0.03em", marginBottom:20, display:"block" }}
          placeholder="Strategy name"/>

        {/* Status chips */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:28 }}>
          {Object.keys(STATUS_COLORS).map(s => (
            <button key={s} onClick={()=>setStatus(s)} style={{ padding:"4px 14px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
              border:`1px solid ${STATUS_COLORS[s].border}`,
              background: status===s ? STATUS_COLORS[s].bg : "transparent",
              color: status===s ? STATUS_COLORS[s].color : "var(--t3)", transition:"all 0.15s" }}>
              {s}
            </button>
          ))}
        </div>

        {/* Description section */}
        <div style={{ marginBottom:28 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, color:"var(--t3)", fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            Description
          </div>
          <textarea value={desc} onChange={e=>{ setDesc(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
            placeholder="Brief description or important information about the strategy that is displayed before opening it."
            rows={3}
            ref={el=>{ if(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } }}
            style={{ width:"100%", minHeight:28, resize:"none", overflow:"hidden", background:"transparent", border:"none", borderBottom:"1px solid var(--b1)", color:"var(--t2)", fontSize:14, padding:"4px 0 10px", lineHeight:1.7, boxSizing:"border-box", outline:"none" }}
            onFocus={e=>{ e.target.style.borderBottomColor="var(--b3)"; e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
            onBlur={e=>e.target.style.borderBottomColor="var(--b1)"}/>
        </div>

        {/* Main image */}
        <div style={{ position:"relative", background:"var(--s3)", borderRadius:12, overflow:"hidden", marginBottom:28, aspectRatio:"16/9" }}>
          {imageData
            ? <>
                <img src={imageData} alt={name} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", cursor:"zoom-in" }} onClick={()=>setLightbox(true)}/>
                <label style={{ position:"absolute", bottom:12, right:12, background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:6, padding:"6px 14px", backdropFilter:"blur(6px)" }}>
                  Replace Image <input type="file" accept="image/*" onChange={handleImg} style={{ display:"none" }}/>
                </label>
              </>
            : <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", cursor:"pointer", color:"var(--t3)", gap:10 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.25 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span style={{ fontSize:13 }}>Click to upload strategy image</span>
                <input type="file" accept="image/*" onChange={handleImg} style={{ display:"none" }}/>
              </label>
          }
        </div>

        {/* PROTOCOLS section */}
        <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:10, marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 18px", cursor:"pointer", userSelect:"none" }}
            onClick={()=>setProtocolsOpen(o=>!o)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span style={{ fontWeight:800, fontSize:14, letterSpacing:"0.06em", color:"#fff" }}>PROTOCOLS</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft:"auto", transform: protocolsOpen ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
          {protocolsOpen && (
            <div className="protocols-list" style={{ padding:"4px 18px 14px 18px" }}>
              {/* Floating toolbar */}
              {protoToolbar && (
                <div style={{ position:"fixed", left:protoToolbar.x, top:protoToolbar.y-40, zIndex:10000, display:"flex", alignItems:"center", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, overflow:"visible", boxShadow:"0 4px 16px rgba(0,0,0,0.5)" }}>
                  {[["H","header","#d4ff1e"],["•","bullet","#aaa"],["—","plain","#aaa"]].map(([label,type,color])=>(
                    <button key={type} onClick={()=>setProtocolType(protoToolbar.index, type)}
                      style={{ background:"none", border:"none", borderRight:"1px solid var(--b2)", color, cursor:"pointer", padding:"5px 12px", fontSize:13, fontWeight:700, transition:"background 0.1s" }}
                      onMouseOver={e=>e.currentTarget.style.background="var(--b1)"} onMouseOut={e=>e.currentTarget.style.background="none"}>
                      {label}
                    </button>
                  ))}
                  <div style={{ padding:"2px 6px", borderLeft:"1px solid var(--b2)" }}>
                    <AgentColorPicker onApply={()=>{}} />
                  </div>
                </div>
              )}
              {protocols.map((line, i) => {
                const isHeader = line.type==="header";
                const isBullet = line.type==="bullet";
                return (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:6, marginBottom:4 }}>
                    <span style={{ color: isHeader?"var(--acc)":"var(--b2)", fontSize: isHeader?10:16, fontWeight:700, marginTop: isHeader?5:3, flexShrink:0, width:14, textAlign:"center", lineHeight:1 }}>
                      {isHeader ? "H" : isBullet ? "•" : ""}
                    </span>
                    <textarea
                      value={line.text}
                      placeholder={isHeader ? "Header..." : "Step..."}
                      rows={1}
                      onChange={e=>{ setProtocolText(i, e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); addProtocolLine(i); setTimeout(()=>{ const inputs=e.target.closest(".protocols-list").querySelectorAll("textarea"); if(inputs[i+1]) inputs[i+1].focus(); },30); }
                        if(e.key==="Backspace"&&line.text===""&&protocols.length>1){ e.preventDefault(); delProtocolLine(i); setTimeout(()=>{ const inputs=document.querySelectorAll(".protocols-list textarea"); if(inputs[i-1]) inputs[i-1].focus(); },30); }
                      }}
                      onMouseUp={e=>{
                        const sel = window.getSelection();
                        if(sel && sel.toString().length>0){
                          const rect = e.target.getBoundingClientRect();
                          setProtoToolbar({ index:i, x: rect.left + (e.clientX - rect.left) - 40, y: e.clientY });
                        } else { setProtoToolbar(null); }
                      }}
                      onBlur={()=>setTimeout(()=>setProtoToolbar(null), 200)}
                      ref={el=>{ if(el){ el.style.height="auto"; el.style.height=el.scrollHeight+"px"; } }}
                      style={{ flex:1, background:"transparent", border:"none", borderBottom:"1px solid transparent", color: isHeader?"#fff":"var(--t2)", fontSize:13, fontWeight: isHeader?700:400, letterSpacing: isHeader?"0.05em":0, textTransform: isHeader?"uppercase":"none", padding:"3px 0", outline:"none", lineHeight:1.7, resize:"none", overflow:"hidden", fontFamily:"inherit", boxSizing:"border-box" }}
                      onFocus={e=>{ e.target.style.borderBottomColor="var(--b2)"; e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
                      onBlur2={e=>e.target.style.borderBottomColor="transparent"}
                    />
                    {protocols.length > 1 && (
                      <button onClick={()=>delProtocolLine(i)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"4px 2px", opacity:0.4, flexShrink:0, marginTop:2 }}>✕</button>
                    )}
                  </div>
                );
              })}
              <div className="protocols-list" style={{ display:"none" }}/>
              <button onClick={()=>addProtocolLine(protocols.length-1)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"6px 0 0 20px", display:"flex", alignItems:"center", gap:6 }}
                onMouseOver={e=>e.currentTarget.style.color="var(--t1)"} onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>
                + Add step
              </button>
            </div>
          )}
        </div>

        {/* Explanations */}
        {explanations.map((exp, i) => (
          <div key={i} style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:10, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderBottom:"1px solid var(--b1)" }}>
              <span style={{ fontWeight:700, fontSize:13, color:"var(--t2)", letterSpacing:"0.05em", textTransform:"uppercase" }}>ExplanationS</span>
              <button onClick={()=>delExplanation(i)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12 }}>✕</button>
            </div>
            <div style={{ padding:"14px 18px" }}>
              {/* Image upload for explanation */}
              {exp.image
                ? <div style={{ position:"relative", marginBottom:12 }}>
                    <img src={exp.image} alt="explanation" style={{ width:"100%", borderRadius:8, display:"block" }}/>
                    <label onClick={e=>e.stopPropagation()} style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"4px 10px" }}>
                      Replace <input type="file" accept="image/*" onChange={e=>handleExplImg(i,e)} style={{ display:"none" }}/>
                    </label>
                    <button onClick={e=>{ e.stopPropagation(); setExplanations(prev=>prev.map((x,xi)=>xi===i?{...x,image:""}:x)); }} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", border:"none", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"3px 8px" }}>✕</button>
                  </div>
                : <label onClick={e=>e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--s2)", borderRadius:8, cursor:"pointer", color:"var(--t3)", fontSize:13, marginBottom:12, border:"1px dashed var(--b2)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Add an image
                    <input type="file" accept="image/*" onChange={e=>handleExplImg(i,e)} style={{ display:"none" }}/>
                  </label>
              }
              <div style={{ borderBottom:"1px solid var(--b1)", paddingBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:6, flexWrap:"wrap" }}>
                  {[["B",()=>document.execCommand("bold"),"Bold"],["I",()=>document.execCommand("italic"),"Italic"],["U",()=>document.execCommand("underline"),"Underline"]].map(([lbl,fn,title])=>(
                    <button key={lbl} title={title} onMouseDown={e=>{e.preventDefault();fn();}}
                      style={{ padding:"3px 8px", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, color:"var(--t1)", cursor:"pointer", fontSize:11, fontWeight:700 }}
                      onMouseOver={e=>e.currentTarget.style.background="var(--b2)"} onMouseOut={e=>e.currentTarget.style.background="var(--s3)"}>{lbl}</button>
                  ))}
                  <AgentColorPicker onApply={()=>explRefs.current[i]?.focus()} />
                </div>
                <div
                  ref={el=>{ explRefs.current[i]=el; if(el && !el._initialized){ el.innerHTML = exp.text || ""; el._initialized=true; } }}
                  contentEditable suppressContentEditableWarning
                  data-placeholder="Add explanation notes..."
                  onInput={e=>setExplText(i, e.currentTarget.innerHTML)}
                  style={{ minHeight:40, outline:"none", color:"var(--t2)", fontSize:13, lineHeight:1.7, paddingBottom:4 }}/>
              </div>
            </div>
          </div>
        ))}

        {/* Add Explanation button */}
        <button onClick={addExplanation}
          style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 18px", borderRadius:8, border:"1px solid var(--b2)", background:"transparent", color:"var(--t3)", cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.15s", marginTop:4 }}
          onMouseOver={e=>{ e.currentTarget.style.background="var(--s2)"; e.currentTarget.style.color="var(--t1)"; }}
          onMouseOut={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="var(--t3)"; }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Explanation
        </button>

      </div>
      {lightbox && (
        <div onClick={e=>{ e.stopPropagation(); setLightbox(false); }} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:10000,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out" }}>
          <img src={imageData} alt={name} style={{ maxWidth:"95vw",maxHeight:"93vh",borderRadius:10,objectFit:"contain" }} onClick={e=>e.stopPropagation()}/>
          <button onClick={e=>{ e.stopPropagation(); setLightbox(false); }} style={{ position:"absolute",top:18,right:18,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",cursor:"pointer",borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700 }}>✕ Close</button>
        </div>
      )}
      {confirmExit && (
        <div onClick={e=>e.stopPropagation()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:10001,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"#1a1d24",border:"1px solid var(--b2)",borderRadius:12,padding:"28px 32px",maxWidth:340,width:"90%",textAlign:"center",boxShadow:"0 12px 48px rgba(0,0,0,0.7)" }}>
            <div style={{ fontSize:18,fontWeight:800,color:"#fff",marginBottom:8 }}>Unsaved changes</div>
            <div style={{ fontSize:13,color:"var(--t2)",marginBottom:24,lineHeight:1.6 }}>You have unsaved changes. Do you want to leave without saving?</div>
            <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
              <button className="btn btn-ghost" style={{ padding:"7px 20px",fontSize:13 }} onClick={()=>setConfirmExit(false)}>Keep editing</button>
              <button className="btn btn-red" style={{ padding:"7px 20px",fontSize:13 }} onClick={onClose}>Leave without saving</button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

const AGENT_ABILITIES = {
  // Controllers
  "Astra":     ["Gravity Well","Nova Pulse","Nebula","Cosmic Divide"],
  "Brimstone": ["Stim Beacon","Incendiary","Sky Smoke","Orbital Strike"],
  "Clove":     ["Pick-Me-Up","Meddle","Ruse","Not Dead Yet"],
  "Harbor":    ["Cascade","Cove","High Tide","Reckoning"],
  "Omen":      ["Shrouded Step","Paranoia","Dark Cover","From the Shadows"],
  "Viper":     ["Snake Bite","Poison Cloud","Toxic Screen","Viper's Pit"],
  // Duelists
  "Iso":       ["Contingency","Undercut","Double Tap","Kill Contract"],
  "Jett":      ["Cloudburst","Updraft","Tailwind","Blade Storm"],
  "Neon":      ["Fast Lane","Relay Bolt","High Gear","Overdrive"],
  "Phoenix":   ["Blaze","Hot Hands","Curveball","Run it Back"],
  "Raze":      ["Boom Bot","Blast Pack","Paint Shells","Showstopper"],
  "Reyna":     ["Leer","Devour","Dismiss","Empress"],
  "Waylay":    ["Saturate","Light Speed","Refract","Convergent Paths"],
  "Yoru":      ["Fakeout","Blindside","Gatecrash","Dimensional Drift"],
  // Initiators
  "Breach":    ["Aftershock","Flashpoint","Fault Line","Rolling Thunder"],
  "Fade":      ["Prowler","Seize","Haunt","Nightfall"],
  "Gekko":     ["Mosh Pit","Wingman","Dizzy","Thrash"],
  "KAY/O":     ["FRAG/ment","FLASH/drive","ZERO/point","NULL/cmd"],
  "Skye":      ["Regrowth","Trailblazer","Guiding Light","Seekers"],
  "Sova":      ["Owl Drone","Shock Bolt","Recon Bolt","Hunter's Fury"],
  "Tejo":      ["Stealth Drone","Special Delivery","Guided Salvo","Armageddon"],
  // Sentinels
  "Chamber":   ["Trademark","Headhunter","Rendezvous","Tour De Force"],
  "Cypher":    ["Trapwire","Cyber Cage","Spycam","Neural Theft"],
  "Deadlock":  ["Barrier Mesh","Sonic Sensor","GravNet","Annihilation"],
  "Killjoy":   ["Nanoswarm","Alarmbot","Turret","Lockdown"],
  "Sage":      ["Barrier Orb","Slow Orb","Healing Orb","Resurrection"],
  "Veto":      ["Crosscut","Chokehold","Interceptor","Evolution"],
  "Vyse":      ["Razorvine","Shear","Arc Rose","Steel Garden"],
};


function LineupModal({ lineup, agents, agentIcon, onSave, onClose }) {
  const [title, setTitle]   = useState(lineup?.title || "");
  const [agent, setAgent]   = useState(lineup?.agent || "");
  const [ability, setAbility] = useState(lineup?.ability || "");
  const [notes, setNotes]   = useState(lineup?.notes || "");

  // images: always an array of base64 strings
  const initImages = () => {
    const raw = lineup?.image_data || "";
    if (!raw) return [];
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; }
    catch { return raw ? [raw] : []; }
  };
  const [images, setImages] = useState(initImages);

  const allAgentNames = Object.keys(AGENT_ABILITIES).sort();
  const abilities = agent ? AGENT_ABILITIES[agent] || [] : [];

  const handleAgentChange = e => { setAgent(e.target.value); setAbility(""); };

  const addImages = e => {
    const files = Array.from(e.target.files);
    files.forEach(file => compressImage(file).then(result => setImages(prev => [...prev, result])));
    e.target.value = "";
  };

  const removeImage = i => setImages(prev => prev.filter((_,xi) => xi !== i));
  const replaceImage = (i, e) => {
    const file = e.target.files[0]; if (!file) return;
    compressImage(file).then(result => setImages(prev => prev.map((x,xi) => xi===i ? result : x)));
    e.target.value = "";
  };

  return (
    <Modal onClose={onClose} title={lineup ? "Edit Lineup" : "Add Lineup"} wide>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Title *</div>
          <input type="text" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. A Site Smoke from CT spawn"/>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Agent</div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {agent && agentIcon(agent)
                ? <img src={agentIcon(agent)} alt={agent} style={{ width:32,height:32,borderRadius:6,objectFit:"cover",border:"1px solid var(--b2)",flexShrink:0 }}/>
                : <div style={{ width:32,height:32,borderRadius:6,background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0 }}>?</div>
              }
              <select value={agent} onChange={handleAgentChange} style={{ flex:1 }}>
                <option value="">— Select agent —</option>
                {allAgentNames.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Ability</div>
            {agent ? (
              <select value={ability} onChange={e=>setAbility(e.target.value)}>
                <option value="">— Select ability —</option>
                {abilities.map(a=><option key={a}>{a}</option>)}
              </select>
            ) : (
              <div style={{ padding:"8px 12px", background:"var(--s2)", borderRadius:"var(--r)", border:"1px solid var(--b1)", fontSize:12, color:"var(--t3)" }}>
                Select an agent first
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        <div>
          <div className="label-sm" style={{ marginBottom:8 }}>Screenshots / Images</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {images.map((img, i) => (
              <div key={i} style={{ position:"relative" }}>
                <img src={img} alt={`screenshot ${i+1}`} style={{ width:"100%", borderRadius:8, maxHeight:220, objectFit:"cover", display:"block" }}/>
                <div style={{ position:"absolute", bottom:8, right:8, display:"flex", gap:6 }}>
                  <label style={{ background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.15)", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"4px 10px" }}>
                    Replace <input type="file" accept="image/*" onChange={e=>replaceImage(i,e)} style={{ display:"none" }}/>
                  </label>
                  <button onClick={()=>removeImage(i)} style={{ background:"rgba(180,0,0,0.8)", border:"none", color:"#fff", cursor:"pointer", fontSize:11, borderRadius:5, padding:"4px 8px" }}>✕</button>
                </div>
                {images.length > 1 && (
                  <div style={{ position:"absolute", top:8, left:8, background:"rgba(0,0,0,0.6)", borderRadius:5, padding:"2px 8px", fontSize:11, color:"#fff" }}>{i+1} / {images.length}</div>
                )}
              </div>
            ))}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:"var(--s2)", borderRadius:8, cursor:"pointer", color:"var(--t3)", fontSize:13, border:"1px dashed var(--b2)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              {images.length === 0 ? "Upload screenshot" : "+ Add another screenshot"}
              <input type="file" accept="image/*" multiple onChange={addImages} style={{ display:"none" }}/>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Notes</div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)}
            placeholder="Positioning, crosshair placement, timing, jump throw…"
            style={{ width:"100%", minHeight:72, resize:"vertical", fontSize:13, padding:"8px 10px", borderRadius:6, border:"1px solid var(--b2)", background:"var(--s1)", color:"var(--t1)" }}/>
        </div>

        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }}
            disabled={!title.trim()}
            onClick={()=>onSave({ ...(lineup||{}), title, agent, ability, notes, image_data: JSON.stringify(images) })}>
            {lineup ? "Save Changes" : "Add Lineup"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddStratModal({ side, category, onSave, onClose }) {
  const [name, setName]         = useState("");
  const [imageData, setImageData] = useState("");
  const [preview, setPreview]   = useState(null);

  const handleImg = e => {
    const file = e.target.files[0]; if(!file) return;
    compressImage(file).then(result => { setImageData(result); setPreview(result); });
  };

  return (
    <Modal onClose={onClose} title={`Add Strat — ${category}`}>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <div><div className="label-sm" style={{ marginBottom:6 }}>Name</div>
          <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. A Default Fast Execute"/>
        </div>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Upload Image</div>
          <input type="file" accept="image/*" onChange={handleImg} style={{ fontSize:12 }}/>
          {preview && <img src={preview} alt="preview" style={{ marginTop:8,width:"100%",borderRadius:8,maxHeight:200,objectFit:"cover" }}/>}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:1,justifyContent:"center" }}
            onClick={()=>onSave(side,category,name,imageData)} disabled={!name.trim()}>Save Strat</button>
        </div>
      </div>
    </Modal>
  );
}

function AddBlockModal({ side, category, blockType, onSave, onClose }) {
  const [content, setContent] = useState("");
  const [imageData, setImageData] = useState("");
  const [preview, setPreview] = useState(null);

  const handleImg = e => {
    const file = e.target.files[0]; if(!file) return;
    compressImage(file).then(result => { setImageData(result); setPreview(result); });
  };  if(blockType==="image") return (
    <Modal onClose={onClose} title="Add Image Block">
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Upload Image</div>
          <input type="file" accept="image/*" onChange={handleImg} style={{ fontSize:12 }}/>
          {preview && <img src={preview} alt="preview" style={{ marginTop:8,width:"100%",borderRadius:8,maxHeight:200,objectFit:"cover" }}/>}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:1,justifyContent:"center" }}
            onClick={()=>onSave(side,category,"image",imageData)} disabled={!imageData}>Save</button>
        </div>
      </div>
    </Modal>
  );

  return (
    <Modal onClose={onClose} title={`Add ${blockType==="heading"?"Heading":"Text"} Block`}>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Content</div>
          <textarea value={content} onChange={e=>setContent(e.target.value)}
            placeholder={blockType==="heading"?"Section heading...":"Notes, callouts, timing info..."}
            style={{ width:"100%",minHeight:80,resize:"vertical",fontSize:13,padding:"8px 10px",borderRadius:6,border:"1px solid var(--b2)",background:"var(--s1)",color:"var(--t1)" }}/>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" style={{ flex:1,justifyContent:"center" }}
            onClick={()=>onSave(side,category,blockType,content)} disabled={!content.trim()}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ── GAME PLANS: Google-Docs-like rich editor with image paste ── */
function CompGamePlan({ comp }) {
  const [plans, setPlans]   = useState([]);
  const [sel, sSel]         = useState(null);
  const [title, setTitle]   = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const editorRef = React.useRef(null);

  useEffect(()=>{
    setLoading(true); sSel(null);
    api.get(`/api/gameplans?comp_id=${comp.id}`).then(d=>{
      if(Array.isArray(d)){ setPlans(d); }
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, [comp.id]);

  const open = (p) => { sSel(p); setTitle(p.title); setTimeout(()=>{ if(editorRef.current) editorRef.current.innerHTML = p.content||""; },0); };

  const save = async () => {
    if(!sel||!editorRef.current) return;
    setSaving(true);
    const updated = { ...sel, title, content: editorRef.current.innerHTML };
    await api.put(`/api/gameplans/${sel.id}`, updated).catch(()=>{});
    setPlans(p=>p.map(x=>x.id===sel.id?updated:x)); sSel(updated); setSaving(false);
  };

  const add = async () => {
    const d = await api.post("/api/gameplans", { title:`${comp.map} Game Plan`, content:"", comp_id: comp.id }).catch(()=>null);
    if(d){ setPlans(p=>[...p,d]); open(d); }
  };

  const del = async (id) => {
    await api.delete(`/api/gameplans/${id}`).catch(()=>{});
    const next = plans.filter(p=>p.id!==id);
    setPlans(next); setConfirm(null);
    if(sel?.id===id) sSel(null);
  };

  const exec = (cmd, val=null) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };
  const handlePaste = e => {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(const item of items){
      if(item.type.startsWith("image/")){ e.preventDefault(); const file=item.getAsFile(); uploadImage(file).then(url=>document.execCommand("insertImage",false,url)); }
    }
  };
  const toolBtn = (label, action, ttl) => (
    <button title={ttl||label} onClick={action}
      style={{ padding:"4px 9px", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, color:"var(--t1)", cursor:"pointer", fontSize:12, fontWeight:500 }}
      onMouseOver={e=>e.target.style.background="var(--b2)"} onMouseOut={e=>e.target.style.background="var(--s3)"}>
      {label}
    </button>
  );

  return (
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16, minHeight:400 }}>
      <div>
        <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center", marginBottom:10, fontSize:12 }} onClick={add}>+ New Plan</button>
        {loading
          ? <div style={{ color:"var(--t3)", fontSize:12, padding:8 }}>Loading…</div>
          : plans.length===0
          ? <div style={{ color:"var(--t3)", fontSize:12, padding:"8px 4px" }}>No plans yet for this comp.</div>
          : plans.map(p=>(
            <div key={p.id} onClick={()=>open(p)}
              style={{ padding:"9px 12px", borderRadius:8, cursor:"pointer", marginBottom:5, background:sel?.id===p.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===p.id?"var(--b3)":"var(--b1)"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.title}</div>
                <button onClick={e=>{ e.stopPropagation(); setConfirm(p); }} style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:"0 2px", flexShrink:0 }}>✕</button>
              </div>
            </div>
          ))
        }
      </div>
      <div>
        {sel ? (
          <div style={{ display:"flex", flexDirection:"column", background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--b1)", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", background:"var(--s2)" }}>
              <input value={title} onChange={e=>setTitle(e.target.value)} onBlur={save}
                style={{ fontSize:14, fontWeight:700, background:"transparent", border:"none", color:"var(--t1)", outline:"none", minWidth:140, flex:1, maxWidth:280 }}
                placeholder="Plan title"/>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {toolBtn("B", ()=>exec("bold"), "Bold")}
                {toolBtn("I", ()=>exec("italic"), "Italic")}
                {toolBtn("U", ()=>exec("underline"), "Underline")}
                {toolBtn("H1", ()=>exec("formatBlock","h2"), "Heading")}
                {toolBtn("•", ()=>exec("insertUnorderedList"), "Bullet list")}
                {toolBtn("1.", ()=>exec("insertOrderedList"), "Numbered list")}
                {toolBtn("—", ()=>exec("insertHorizontalRule"), "Divider")}
                <AgentColorPicker onApply={()=>editorRef.current?.focus()} />
              </div>
              <button className="btn btn-acc" style={{ padding:"5px 12px", fontSize:12, marginLeft:"auto" }} onClick={save}>{saving?"Saving…":"Save"}</button>
            </div>
            <div ref={editorRef} contentEditable suppressContentEditableWarning onPaste={handlePaste} onBlur={save}
              style={{ minHeight:"50vh", padding:"24px 28px", outline:"none", fontSize:14, lineHeight:1.8, color:"var(--t1)", overflowY:"auto" }}
              data-placeholder="Write your game plan for this comp…"/>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, color:"var(--t3)", fontSize:13 }}>
            {loading ? "Loading…" : "Select a plan or create one"}
          </div>
        )}
      </div>
      {confirm && <ConfirmModal title="Delete Plan" message={`Delete "${confirm.title}"?`} onConfirm={()=>del(confirm.id)} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

function GamePlans() {
  const [plans, setPlans]   = useState([]);
  const [sel, sSel]         = useState(null);
  const [modal, setModal]   = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [title, setTitle]   = useState("");
  const editorRef           = React.useRef(null);
  const [saving, setSaving] = useState(false);

  const [gameplansLoading, setGameplansLoading] = useState(true);
  useEffect(()=>{ api.get("/api/gameplans").then(d=>{ if(Array.isArray(d)){ setPlans(d); } }).catch(()=>{}).finally(()=>setGameplansLoading(false)); },[]);

  const openPlan = (p) => { sSel(p); setTitle(p.title); setTimeout(()=>{ if(editorRef.current) editorRef.current.innerHTML = p.content||""; },0); };

  const save = async () => {
    if(!sel||!editorRef.current) return;
    setSaving(true);
    const content = editorRef.current.innerHTML;
    const updated = { ...sel, title, content };
    await api.put(`/api/gameplans/${sel.id}`, updated).catch(()=>{});
    setPlans(p=>p.map(x=>x.id===sel.id?updated:x));
    sSel(updated); setSaving(false);
  };

  const add = async () => {
    const d = await api.post("/api/gameplans", { title:"New Game Plan", content:"" }).catch(()=>({ id:Date.now(), title:"New Game Plan", content:"" }));
    setPlans(p=>[...p, d]); openPlan(d); setModal(false);
  };

  const del = async (id) => {
    await api.delete(`/api/gameplans/${id}`).catch(()=>{});
    const next = plans.filter(p=>p.id!==id);
    setPlans(next); setConfirm(null);
    if(sel?.id===id) sSel(null);
  };

  const exec = (cmd, val=null) => { document.execCommand(cmd, false, val); editorRef.current?.focus(); };

  const handlePaste = e => {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(const item of items) {
      if(item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        uploadImage(file).then(url => document.execCommand("insertImage", false, url));
      }
    }
  };

  const toolBtn = (label, action, title) => (
    <button title={title||label} onClick={action}
      style={{ padding:"4px 9px", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, color:"var(--t1)", cursor:"pointer", fontSize:12, fontWeight:500, transition:"all 0.1s" }}
      onMouseOver={e=>e.target.style.background="var(--s4)"} onMouseOut={e=>e.target.style.background="var(--s3)"}>
      {label}
    </button>
  );

  return (
    <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:18, minHeight:500 }}>
      <div>
        <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center", marginBottom:12 }} onClick={add}>+ New Plan</button>
        {gameplansLoading
          ? [1,2].map(i=><div key={i} style={{ height:40, background:"var(--s3)", borderRadius:"var(--r2)", marginBottom:5, className:"skeleton" }}/>)
          : plans.length===0
          ? <div style={{ color:"var(--t3)", fontSize:12, padding:"8px 4px" }}>No game plans yet.</div>
          : plans.map(p=>(
            <div key={p.id} onClick={()=>openPlan(p)} style={{ padding:"10px 12px", borderRadius:"var(--r2)", cursor:"pointer", marginBottom:5,
              background:sel?.id===p.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===p.id?"var(--b3)":"var(--b1)"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{p.title}</div>
                <button onClick={e=>{ e.stopPropagation(); setConfirm(p); }} style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:"0 2px", flexShrink:0 }}>✕</button>
              </div>
            </div>
          ))
        }
      </div>
      <div>
        {sel ? (
          <div style={{ display:"flex", flexDirection:"column", gap:0, background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12, overflow:"hidden" }}>
            {/* toolbar */}
            <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--b1)", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", background:"var(--s2)" }}>
              <input value={title} onChange={e=>setTitle(e.target.value)} onBlur={save}
                style={{ fontSize:15, fontWeight:700, background:"transparent", border:"none", color:"var(--t1)", outline:"none", minWidth:160, flex:1, maxWidth:320 }}
                placeholder="Plan title"/>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {toolBtn("B", ()=>exec("bold"), "Bold")}
                {toolBtn("I", ()=>exec("italic"), "Italic")}
                {toolBtn("U", ()=>exec("underline"), "Underline")}
                {toolBtn("H1", ()=>exec("formatBlock","h2"), "Heading")}
                {toolBtn("H2", ()=>exec("formatBlock","h3"), "Subheading")}
                {toolBtn("•", ()=>exec("insertUnorderedList"), "Bullet list")}
                {toolBtn("1.", ()=>exec("insertOrderedList"), "Numbered list")}
                {toolBtn("—", ()=>exec("insertHorizontalRule"), "Divider")}
                <label title="Insert image" style={{ padding:"4px 9px", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, color:"var(--t1)", cursor:"pointer", fontSize:12, fontWeight:500, display:"inline-flex", alignItems:"center" }}
                  onMouseOver={e=>e.currentTarget.style.background="var(--b2)"} onMouseOut={e=>e.currentTarget.style.background="var(--s3)"}>
                  🖼
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{
                    const file=e.target.files[0]; if(!file) return; e.target.value="";
                    const reader=new FileReader();
                    reader.onload=ev=>{
                      editorRef.current?.focus();
                      const img=document.createElement("img"); img.src=ev.target.result; img.style.maxWidth="100%";
                      const sel=window.getSelection();
                      if(sel&&sel.rangeCount){ const range=sel.getRangeAt(0); range.collapse(false); range.insertNode(img); range.setStartAfter(img); range.collapse(true); sel.removeAllRanges(); sel.addRange(range); }
                      else { editorRef.current.appendChild(img); }
                    };
                    reader.readAsDataURL(file);
                  }}/>
                </label>
                <AgentColorPicker onApply={()=>editorRef.current?.focus()} />
              </div>
              <button className="btn btn-acc" style={{ padding:"5px 14px", fontSize:12, marginLeft:"auto" }} onClick={save}>{saving?"Saving…":"Save"}</button>
            </div>
            {/* editor */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onPaste={handlePaste}
              onBlur={save}
              style={{
                minHeight:"65vh", padding:"28px 36px", outline:"none", fontSize:14, lineHeight:1.8,
                color:"var(--t1)", overflowY:"auto",
              }}
              data-placeholder="Start writing your game plan… paste images directly, use the toolbar above."
            />
          </div>
        ) : (
          <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:400 }}>
            <div style={{ textAlign:"center", color:"var(--t3)" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>☰</div>
              <div className="bc" style={{ fontSize:18, fontWeight:700, color:"var(--t2)", marginBottom:8 }}>No Game Plan Selected</div>
              <button className="btn btn-acc" onClick={add}>+ New Plan</button>
            </div>
          </div>
        )}
      </div>
      {confirm && (
        <ConfirmModal title="Delete Game Plan" message={`Delete "${confirm.title}"? This cannot be undone.`}
          onConfirm={()=>del(confirm.id)} onCancel={()=>setConfirm(null)}/>
      )}
    </div>
  );
}

function Compositions() {
  const [comps, setComps]   = useState([]);
  const [agents, setAgents] = useState([]);
  const [mapData, setMapData] = useState([]);
  const [modal, setModal]   = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm]     = useState({ name:"", map:"", agents:["","","","",""], status:"Active" });
  const [statusFilter, setStatusFilter] = useState("All");
  const [compsLoading2, setCompsLoading2] = useState(true);
  const [editStatusId, setEditStatusId] = useState(null);

  useEffect(() => {
    fetch("https://valorant-api.com/v1/maps")
      .then(r=>r.json()).then(d=>{ if(d.data){ setMapData(d.data.filter(m=>m.splash).map(m=>({ displayName:m.displayName, splash:m.splash }))); } }).catch(()=>{});
    api.get("/api/strats").then(d=>{
      if(Array.isArray(d)) setComps(d.filter(s=>s.cat==="Composition"));
    }).catch(()=>{}).finally(()=>setCompsLoading2(false));
  }, []);

  const agentIcon = name => {
    if(!name) return null;
    return AGENT_ICONS[name] || null;
  };

  const getAgents = comp => {
    try { return Array.isArray(comp.agents)?comp.agents:JSON.parse(comp.agents||"[]"); }
    catch { return []; }
  };

  const mapSplash = map => {
    if (!map) return null;
    const found = mapData.find(m => m.displayName.toLowerCase().trim() === map.toLowerCase().trim());
    return found ? found.splash : null;
  };

  const allAgentNames = AGENTS.map(a=>a.name).sort();

  const setAgent = (i, val) => setForm(f=>{ const ags=[...f.agents]; ags[i]=val; return {...f,agents:ags}; });

  const add = () => {
    if(!form.name.trim()||!form.map) return;
    const agList = form.agents.filter(Boolean);
    api.post("/api/strats",{ name:form.name, map:form.map, cat:"Composition", agents:JSON.stringify(agList), side:"atk", description:"", status:form.status })
      .then(d=>setComps(p=>[...p,{ ...d, agents: d.agents || JSON.stringify(agList) }])).catch(()=>{});
    setModal(false); setForm({ name:"", map:"", agents:["","","","",""], status:"Active" });
  };

  const del = id => { api.delete(`/api/strats/${id}`).catch(()=>{}); setComps(p=>p.filter(c=>c.id!==id)); setConfirm(null); };
  React.useEffect(() => {
    if (!editStatusId) return;
    const close = () => setEditStatusId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [editStatusId]);

  const updateCompStatus = (comp, newStatus) => {
    api.put(`/api/strats/${comp.id}`, { ...comp, status: newStatus }).catch(()=>{});
    setComps(p => p.map(c => c.id===comp.id ? {...c, status: newStatus} : c));
    setEditStatusId(null);
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:800 }} className="bc">Compositions</div>
          <div style={{ fontSize:13, color:"var(--t3)", marginTop:2 }}>Create and manage agent compositions</div>
        </div>
        <button className="btn btn-acc" onClick={()=>setModal(true)}>+ New Composition</button>
      </div>

      {/* Status filter tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {["All","Active","In Progress","Theory","Archived"].map(f => (
          <button key={f} onClick={()=>setStatusFilter(f)}
            style={{ padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600, cursor:"pointer", border:"1px solid",
              borderColor: statusFilter===f ? "var(--acc)" : "var(--b2)",
              background: statusFilter===f ? "rgba(212,255,30,0.12)" : "transparent",
              color: statusFilter===f ? "var(--acc)" : "var(--t3)", transition:"all 0.15s" }}>
            {f}
          </button>
        ))}
      </div>

      {compsLoading2
        ? <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
            {[1,2,3].map(i=>(
              <div key={i} style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--b1)", background:"var(--s1)" }}>
                <div style={{ height:160, background:"var(--s3)", className:"skeleton" }}/>
                <div style={{ padding:"14px 14px 16px" }}>
                  <div style={{ height:14, width:"60%", background:"var(--s3)", borderRadius:4, marginBottom:14, animation:"blink 1.4s infinite" }}/>
                  <div style={{ display:"flex", gap:4, marginBottom:14 }}>
                    {[0,1,2,3,4].map(j=><div key={j} style={{ width:34, height:34, borderRadius:"50%", background:"var(--s3)", animation:"blink 1.4s infinite" }}/>)}
                  </div>
                  <div style={{ height:10, width:"40%", background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
                </div>
              </div>
            ))}
          </div>
        : comps.length===0
        ? <div className="card" style={{ textAlign:"center",padding:"48px 20px",color:"var(--t3)" }}>
            <div style={{ fontSize:28,marginBottom:8 }}>⬡</div>
            <div style={{ fontWeight:700,color:"var(--t2)",marginBottom:6 }}>No compositions yet</div>
            <button className="btn btn-acc" style={{ marginTop:8 }} onClick={()=>setModal(true)}>+ New Composition</button>
          </div>
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
            {comps.filter(c => statusFilter==="All" || (c.status||"Active")===statusFilter).map(comp => {
              const splash = mapSplash(comp.map);
              const ags = getAgents(comp);
              return (
                <div key={comp.id} style={{ borderRadius:14, overflow:"hidden", border:"1px solid var(--b1)", background:"var(--s1)", transition:"all 0.2s", position:"relative", cursor:"pointer" }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor="var(--b3)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.4)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor="var(--b1)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
                  {/* Map splash */}
                  <div style={{ position:"relative", height:160, overflow:"hidden", background:"var(--s3)" }}>
                    {splash && <img src={splash} alt={comp.map} style={{ width:"100%", height:"100%", objectFit:"cover", filter:"brightness(0.7) saturate(1.1)" }}/>}
                    <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom, transparent 40%, rgba(10,10,15,0.85) 100%)" }}/>
                    {/* Delete button */}
                    <button onClick={()=>setConfirm(comp)} style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:6, color:"#fff", cursor:"pointer", width:28, height:28, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, backdropFilter:"blur(4px)" }}>🗑</button>
                  </div>
                  {/* Card body */}
                  <div style={{ padding:"14px 14px 14px" }}>
                    <div style={{ fontWeight:800, fontSize:17, color:"#fff", marginBottom:10, lineHeight:1.2 }}>{comp.name}</div>
                    {/* Agent icons — overlapping circles */}
                    <div style={{ display:"flex", marginBottom:14, position:"relative", height:34 }}>
                      {ags.map((ag, i) => {
                        const icon = agentIcon(ag);
                        return icon
                          ? <img key={i} src={icon} alt={ag} title={ag} style={{ width:34, height:34, borderRadius:"50%", objectFit:"cover", objectPosition:"top", border:"2px solid var(--s1)", position:"absolute", left: i * 22 }}/>
                          : <div key={i} title={ag} style={{ width:34, height:34, borderRadius:"50%", background:"var(--s3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"var(--t2)", border:"2px solid var(--s1)", fontWeight:700, position:"absolute", left: i * 22 }}>{ag.slice(0,2)}</div>;
                      })}
                    </div>
                    {/* Map chip + status */}
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4, position:"relative" }}>
                      <span className="chip chip-blue" style={{ fontSize:11 }}>{comp.map}</span>
                      <div style={{ position:"relative" }}>
                        <div onClick={e=>{ e.stopPropagation(); setEditStatusId(editStatusId===comp.id?null:comp.id); }}
                          style={{ cursor:"pointer" }}>
                          <StatusChip status={comp.status || "Active"}/>
                        </div>
                        {editStatusId===comp.id && (
                          <div onClick={e=>e.stopPropagation()}
                            style={{ position:"absolute", bottom:"calc(100% + 6px)", left:0, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, zIndex:50, minWidth:140, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
                            {Object.keys(STATUS_COLORS).map(s => (
                              <div key={s} onClick={()=>updateCompStatus(comp, s)}
                                style={{ padding:"8px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontSize:12, fontWeight:600,
                                  background: (comp.status||"Active")===s ? "var(--s3)" : "transparent",
                                  color: STATUS_COLORS[s].color, transition:"background 0.1s" }}
                                onMouseEnter={e=>e.currentTarget.style.background="var(--s3)"}
                                onMouseLeave={e=>e.currentTarget.style.background=(comp.status||"Active")===s?"var(--s3)":"transparent"}>
                                <span style={{ width:7, height:7, borderRadius:"50%", background:STATUS_COLORS[s].color, display:"inline-block", flexShrink:0 }}/>
                                {s}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {modal && (
        <Modal onClose={()=>setModal(false)} title="New Composition" wide>
          <div style={{ fontSize:13,color:"var(--t3)",marginBottom:16 }}>Select 5 agents to create a composition</div>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Composition Name</div>
              <input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Eg: Double Duelist Ascent"/>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Map</div>
              <select value={form.map} onChange={e=>setForm(f=>({...f,map:e.target.value}))}>
                <option value="">Select a map...</option>
                {MAPS.map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:8 }}>Agents</div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8 }}>
                {[0,1,2,3,4].map(i=>(
                  <div key={i} style={{ display:"flex",flexDirection:"column",gap:5,alignItems:"center" }}>
                    {form.agents[i] && agentIcon(form.agents[i])
                      ? <img src={agentIcon(form.agents[i])} alt={form.agents[i]} style={{ width:36,height:36,borderRadius:6,objectFit:"cover",border:"1px solid var(--acc)" }}/>
                      : <div style={{ width:36,height:36,borderRadius:6,background:"var(--s3)",border:"1px solid var(--b2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"var(--t3)" }}>?</div>
                    }
                    <select value={form.agents[i]} onChange={e=>setAgent(i,e.target.value)}
                      style={{ fontSize:11,padding:"4px 2px",textAlign:"center",width:"100%" }}>
                      <option value="">...</option>
                      {allAgentNames.map(a=><option key={a}>{a}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:8 }}>Status</div>
              <div style={{ display:"flex", gap:6 }}>
                {["Active","In Progress","Theory","Archived"].map(s => (
                  <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                    style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700, cursor:"pointer",
                      border:`1px solid ${STATUS_COLORS[s]?.border||"var(--b2)"}`,
                      background: form.status===s ? (STATUS_COLORS[s]?.bg||"var(--s3)") : "transparent",
                      color: form.status===s ? (STATUS_COLORS[s]?.color||"var(--t1)") : "var(--t3)", transition:"all 0.15s" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:"flex",gap:8,marginTop:4 }}>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
              <button className="btn btn-acc" style={{ flex:1,justifyContent:"center" }}
                onClick={add} disabled={!form.name.trim()||!form.map}>Create Composition</button>
            </div>
          </div>
        </Modal>
      )}
      {confirm && <ConfirmModal title="Delete Composition" message={`Delete "${confirm.name}"?`} onConfirm={()=>del(confirm.id)} onCancel={()=>setConfirm(null)}/>}
    </div>
  );
}

/* ════ PLAYER STATS TAB ════ */
function PlayerStatsTab({ scrims }) {
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [ocrScans, setOcrScans]           = useState([]);
  const [sideFilter, setSideFilter]       = useState("blue"); // default to our team
  const [sortKey, setSortKey]             = useState("avgAcs");
  const [sortDir, setSortDir]             = useState(-1);
  const [source, setSource]               = useState("all"); // "all" | "riot" | "ocr"
  const [deleting, setDeleting]           = useState(null); // player name being deleted
  const [selPlayer, setSelPlayer]         = useState(null); // selected row highlight

  useEffect(()=>{
    api.get("/api/players").then(d=>{ if(Array.isArray(d)) setRosterPlayers(d); }).catch(()=>{});
    api.get("/api/ocr-stats").then(d=>{ if(Array.isArray(d)) setOcrScans(d); }).catch(()=>{});
  }, []);

  const rosterIgns = new Set(rosterPlayers.map(p=>(p.ign||p.name||"").toLowerCase().trim()).filter(Boolean));

  // Build alias → canonical IGN map so alt accounts merge into the main player
  const aliasToCanonical = {};
  rosterPlayers.forEach(p => {
    const canonical = (p.ign||p.name||"").toLowerCase().trim();
    if (!canonical) return;
    const aliases = (() => { try { return Array.isArray(p.aliases) ? p.aliases : JSON.parse(p.aliases||"[]"); } catch { return []; } })();
    aliases.forEach(a => {
      const ak = a.toLowerCase().trim();
      if (ak) { aliasToCanonical[ak] = canonical; rosterIgns.add(ak); }
    });
  });

  // Resolve an IGN to its canonical form (main account) if it's an alias
  const resolveAlias = (name) => {
    const k = (name||"").toLowerCase().trim();
    return aliasToCanonical[k] || name;
  };

  const resolveSide = (name, explicitSide) => {
    const n = (name||"").toLowerCase().trim();
    if (rosterIgns.size > 0 && rosterIgns.has(n)) return "blue";
    return explicitSide || "unknown";
  };

  // Normalise a single player entry into a common shape
  const normalise = (p, explicitSide) => ({
    name:    resolveAlias(p.name || ""),
    agent:   p.agent || "",
    side:    resolveSide(p.name, explicitSide || p.side),
    acs:     Number(p.acs)                         || 0,
    kills:   Number(p.kills   ?? p.k)              || 0,
    deaths:  Number(p.deaths  ?? p.d)              || 0,
    assists: Number(p.assists ?? p.a)              || 0,
    hsRate:  p.hsRate != null ? Number(p.hsRate)   : null,
    fb:      Number(p.firstBloods ?? p.fb)         || 0,
    clutch:  Number(p.clutchWon)                   || 0,
    plants:  Number(p.plants)                      || 0,
    defuses: Number(p.defuses)                     || 0,
    osr:     p.osr != null ? Number(p.osr)         : null,
  });

  // Build the full player list from both sources, tracking source record IDs
  const allEntries = []; // { ...normalised, _src, _scrimId?, _ocrId? }

  if (source !== "ocr") {
    scrims.forEach(scrim => {
      const ps = Array.isArray(scrim.player_stats)
        ? scrim.player_stats
        : (() => { try { return JSON.parse(scrim.player_stats||"[]"); } catch { return []; } })();
      const rd = (() => { try { const d = scrim.round_detail; return Array.isArray(d)?d:JSON.parse(d||"[]"); } catch { return []; } })();
      const osrRatings = calculateOSRFromStored(rd, ps);
      ps.forEach(p => {
        if (p.name) allEntries.push({
          ...normalise(p),
          osr: p.osr ?? (osrRatings[p.puuid] ?? osrRatings[p.name] ?? null),
          opp: p.opp || scrim.opp || "—",
          score: p.score || scrim.score || "—",
          scrimMap: p.scrimMap || scrim.map || p.map || "—",
          scrimWon: p.scrimWon ?? (scrim.res==="win"||scrim.res==="W"),
          _src:"riot", _scrimId: scrim.id
        });
      });
    });
  }

  if (source !== "riot") {
    ocrScans.forEach(scan => {
      const ps = Array.isArray(scan.players)
        ? scan.players
        : (() => { try { return JSON.parse(scan.players||"[]"); } catch { return []; } })();
      ps.forEach(p => { if (p.name) allEntries.push({ ...normalise(p), _src:"ocr", _ocrId: scan.id }); });
    });
  }

  // Aggregate by player name, also collecting all source record IDs
  const allStats = {};
  allEntries.forEach(p => {
    if (!allStats[p.name]) allStats[p.name] = {
      name:p.name, agent:p.agent, side:p.side, games:0,
      totalAcs:0, totalKills:0, totalDeaths:0, totalAssists:0,
      totalHsRate:0, hsGames:0, totalFb:0, totalClutch:0, totalPlants:0, totalDefuses:0,
      totalOsr:0, osrGames:0,
      sources: new Set(), scrimIds: new Set(), ocrIds: new Set(),
    };
    const s = allStats[p.name];
    s.games++;
    s.totalAcs     += p.acs;
    s.totalKills   += p.kills;
    s.totalDeaths  += p.deaths;
    s.totalAssists += p.assists;
    s.totalFb      += p.fb;
    s.totalClutch  += p.clutch;
    s.totalPlants  += p.plants;
    s.totalDefuses += p.defuses;
    if (p.side !== "unknown") s.side = p.side;
    if (p.hsRate != null) { s.totalHsRate += p.hsRate; s.hsGames++; }
    if (p.osr != null) { s.totalOsr += p.osr; s.osrGames++; }
    s.sources.add(p._src);
    if (p._scrimId != null) s.scrimIds.add(p._scrimId);
    if (p._ocrId   != null) s.ocrIds.add(p._ocrId);
    if (p.agent) s.agent = p.agent;
  });

  const rows = Object.values(allStats).map(s => ({
    ...s,
    sources:  [...s.sources],
    scrimIds: [...s.scrimIds],
    ocrIds:   [...s.ocrIds],
    avgAcs:     s.games ? Math.round(s.totalAcs / s.games) : 0,
    avgKills:   s.games ? Math.round((s.totalKills / s.games) * 10) / 10 : 0,
    avgDeaths:  s.games ? Math.round((s.totalDeaths / s.games) * 10) / 10 : 0,
    avgAssists: s.games ? Math.round((s.totalAssists / s.games) * 10) / 10 : 0,
    kd: s.totalDeaths === 0 ? s.totalKills : Math.round((s.totalKills / s.totalDeaths) * 100) / 100,
    avgHs: s.hsGames > 0 ? Math.round(s.totalHsRate / s.hsGames) : null,
    avgOsr: s.osrGames > 0 ? Math.round((s.totalOsr / s.osrGames) * 100) / 100 : null,
  }));

  const filtered = (sideFilter === "all" ? rows : rows.filter(r => r.side === sideFilter))
    .sort((a,b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return sortDir * (av < bv ? -1 : av > bv ? 1 : 0);
    });

  const deletePlayer = async (p) => {
    setDeleting(p.name);
    try {
      // Remove from OCR scans that contain this player
      for (const ocrId of p.ocrIds) {
        const scan = ocrScans.find(s => s.id === ocrId);
        if (!scan) continue;
        const ps = Array.isArray(scan.players) ? scan.players : (() => { try { return JSON.parse(scan.players||"[]"); } catch { return []; } })();
        const remaining = ps.filter(pl => (pl.name||"") !== p.name);
        if (remaining.length === 0) {
          await api.delete(`/api/ocr-stats/${ocrId}`);
        } else {
          // Patch via re-post is not supported; just delete the whole scan if player was there
          await api.delete(`/api/ocr-stats/${ocrId}`);
        }
      }
      // Remove from scrim player_stats
      for (const scrimId of p.scrimIds) {
        const scrim = scrims.find(s => s.id === scrimId);
        if (!scrim) continue;
        const ps = Array.isArray(scrim.player_stats) ? scrim.player_stats : (() => { try { return JSON.parse(scrim.player_stats||"[]"); } catch { return []; } })();
        const remaining = ps.filter(pl => (pl.name||"") !== p.name);
        await api.put(`/api/scrims/${scrimId}/player_stats`, { player_stats: remaining });
      }
      // Refresh ocr scans
      const fresh = await api.get("/api/ocr-stats");
      if (Array.isArray(fresh)) setOcrScans(fresh);
    } catch(e) { console.error("Delete failed", e); }
    finally { setDeleting(null); }
  };

  const SortTh = ({ label, k, right }) => (
    <th style={{ textAlign:right?"right":"left", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap" }}
      onClick={()=>{ if(sortKey===k) setSortDir(d=>d*-1); else { setSortKey(k); setSortDir(-1); } }}>
      {label}{sortKey===k ? (sortDir===-1?" ↓":" ↑") : ""}
    </th>
  );

  const riotCount = scrims.reduce((n,s)=>{ const ps=Array.isArray(s.player_stats)?s.player_stats:(()=>{try{return JSON.parse(s.player_stats||"[]");}catch{return [];}})(); return n+ps.length; }, 0);
  const ocrCount  = ocrScans.reduce((n,s)=>{ const ps=Array.isArray(s.players)?s.players:(()=>{try{return JSON.parse(s.players||"[]");}catch{return [];}})(); return n+ps.length; }, 0);

  return (
    <div>
      {/* Source + Side filters */}
      <div style={{ display:"flex", gap:16, marginBottom:16, alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:"var(--t3)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Source</span>
          {[["all",`All (${riotCount+ocrCount})`],["riot",`Riot Import (${riotCount})`],["ocr",`OCR Scanner (${ocrCount})`]].map(([v,l]) => (
            <button key={v} className={`btn ${source===v?"btn-acc":"btn-ghost"}`} style={{ fontSize:11, padding:"4px 12px" }} onClick={()=>setSource(v)}>{l}</button>
          ))}
        </div>
        <div style={{ width:1, height:24, background:"var(--b2)" }}/>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:11, color:"var(--t3)", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase" }}>Team</span>
          {[["all","All"],["blue","Our Team"],["red","Opponents"],["unknown","?"]].map(([v,l]) => (
            <button key={v} className={`btn ${sideFilter===v?"btn-acc":"btn-ghost"}`} style={{ fontSize:11, padding:"4px 12px" }} onClick={()=>setSideFilter(v)}>{l}</button>
          ))}
        </div>
        {rosterIgns.size > 0
          ? <span style={{ fontSize:11, color:"var(--t3)", marginLeft:"auto" }}>✓ Matching {rosterIgns.size} IGN{rosterIgns.size!==1?"s":""} from roster</span>
          : <span style={{ fontSize:11, color:"var(--red)", marginLeft:"auto" }}>⚠ Add IGNs to Roster to auto-identify your team</span>
        }
      </div>

      {/* Info banner */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, padding:"8px 12px", background:"rgba(79,195,247,0.08)", border:"1px solid rgba(79,195,247,0.2)", borderRadius:8 }}>
        <span style={{ color:"var(--blue)", fontSize:13, fontWeight:800, flexShrink:0 }}>!</span>
        <span style={{ fontSize:12, color:"var(--blue)", opacity:0.85 }}>Player stats use imported games only. Manual scrims are not included.</span>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding:"48px", textAlign:"center", color:"var(--t3)" }}>
          <div style={{ fontSize:28, marginBottom:10 }}>📊</div>
          <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No player stats yet</div>
          <div style={{ fontSize:13 }}>Import a scrim via the Riot helper or use the OCR Scanner on a scoreboard screenshot</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding:"32px", textAlign:"center", color:"var(--t3)", fontSize:13 }}>
          No players match this filter
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:"auto" }}>
          <table className="tbl" style={{ minWidth:820 }}>
            <thead>
              <tr>
                <SortTh label="Player" k="name"/>
                <th>Team</th>
                <th>Src</th>
                <SortTh label="Games" k="games" right/>
                <SortTh label="Avg ACS" k="avgAcs" right/>
                <SortTh label="Avg K" k="avgKills" right/>
                <SortTh label="Avg D" k="avgDeaths" right/>
                <SortTh label="Avg A" k="avgAssists" right/>
                <SortTh label="K/D" k="kd" right/>
                <SortTh label="HS%" k="avgHs" right/>
                <SortTh label="FK" k="totalFb" right/>
                <SortTh label="Clutch" k="totalClutch" right/>
                <SortTh label="OSR" k="avgOsr" right/>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.name}
                  onClick={()=>setSelPlayer(p.name===selPlayer?null:p.name)}
                  style={{ opacity: deleting===p.name ? 0.4 : 1, transition:"opacity 0.2s, background 0.12s", cursor:"pointer", background: selPlayer===p.name?"rgba(212,255,30,0.06)":"" }}
                  onMouseEnter={e=>{ if(selPlayer!==p.name) e.currentTarget.style.background="var(--s2)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background=selPlayer===p.name?"rgba(212,255,30,0.06)":""; }}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <AgentBadge name={p.agent} size={24}/>
                      <span className="mono" style={{ fontSize:12 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>
                    {p.side==="blue" ? <span className="chip chip-blue">Ours</span>
                    : p.side==="red" ? <span className="chip chip-red">Opp</span>
                    : <span className="chip" style={{ background:"var(--s3)", color:"var(--t3)" }}>?</span>}
                  </td>
                  <td>
                    <div style={{ display:"flex", gap:3 }}>
                      {p.sources.includes("riot") && <span style={{ fontSize:9, fontWeight:700, padding:"2px 5px", borderRadius:4, background:"rgba(79,195,247,0.15)", color:"#4fc3f7" }}>RIOT</span>}
                      {p.sources.includes("ocr")  && <span style={{ fontSize:9, fontWeight:700, padding:"2px 5px", borderRadius:4, background:"rgba(212,255,30,0.12)", color:"var(--acc)" }}>OCR</span>}
                    </div>
                  </td>
                  <td style={{ textAlign:"right", color:"var(--t3)", fontSize:12 }}>{p.games}</td>
                  <td style={{ textAlign:"right", fontWeight:700, color:"var(--acc)" }}>{p.avgAcs}</td>
                  <td style={{ textAlign:"right" }}>{p.avgKills}</td>
                  <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.avgDeaths}</td>
                  <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.avgAssists}</td>
                  <td style={{ textAlign:"right", fontWeight:600, color:p.kd>=1?"var(--green)":"var(--red)" }}>{p.kd}</td>
                  <td style={{ textAlign:"right" }}>{p.avgHs!=null?`${p.avgHs}%`:"—"}</td>
                  <td style={{ textAlign:"right", color:p.totalFb>0?"var(--green)":"var(--t3)" }}>{p.totalFb||"—"}</td>
                  <td style={{ textAlign:"right", color:p.totalClutch>0?"var(--green)":"var(--t3)" }}>{p.totalClutch||"—"}</td>
                  <td style={{ textAlign:"right", fontWeight:700, color: p.avgOsr == null ? "var(--t3)" : p.avgOsr > 0 ? "var(--green)" : p.avgOsr < -0.5 ? "var(--red)" : "var(--t2)" }}>
                    {p.avgOsr != null ? (p.avgOsr > 0 ? `+${p.avgOsr.toFixed(2)}` : p.avgOsr.toFixed(2)) : "—"}
                  </td>
                  <td style={{ textAlign:"right", paddingRight:4, color:"var(--t3)", fontSize:16, fontWeight:300, opacity: selPlayer===p.name ? 1 : 0.4 }}>›</td>
                  <td style={{ textAlign:"right", paddingRight:10 }}>
                    <button
                      onClick={()=>{ if(window.confirm(`Delete all stats for "${p.name}"? This cannot be undone.`)) deletePlayer(p); }}
                      disabled={deleting===p.name}
                      title="Delete all stats for this player"
                      style={{ background:"none", border:"none", cursor:"pointer", color:"var(--t3)", fontSize:14, padding:"2px 4px", borderRadius:4, transition:"color 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.color="var(--red)"}
                      onMouseLeave={e=>e.currentTarget.style.color="var(--t3)"}>
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"10px 14px", borderTop:"1px solid var(--b1)", fontSize:11, color:"var(--t3)", textAlign:"center" }}>
            Showing {filtered.length} player{filtered.length!==1?"s":""}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ DATA ANALYSIS ════ */
function DataAnalysis({ players=[] }) {
  const [tab, setTab]     = useState("team");
  const [scrims, setScrims] = useState([]);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  useEffect(()=>{
    api.get("/api/scrims").then(d=>{ if(Array.isArray(d)) setScrims(d); }).catch(()=>{}).finally(()=>setAnalysisLoading(false));
  },[]);

  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>DATA ANALYSIS</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Performance insights from tracked games</div>
      <div className="tab-bar" style={{ maxWidth:460, marginBottom:24 }}>
        <button className={`tab${tab==="team"?" on":""}`} onClick={()=>setTab("team")}>Team Stats</button>
        <button className={`tab${tab==="maps"?" on":""}`} onClick={()=>setTab("maps")}>Maps</button>
        <button className={`tab${tab==="profile"?" on":""}`} onClick={()=>setTab("profile")}>Player Stats</button>
        <button className={`tab${tab==="accounts"?" on":""}`} onClick={()=>setTab("accounts")}>Linked Accounts</button>
        <button className={`tab${tab==="heatmaps"?" on":""}`} onClick={()=>setTab("heatmaps")}>Heatmaps</button>
      </div>
      {tab==="team"   && <TeamStatsTab   scrims={scrims} loading={analysisLoading}/>}
      {tab==="maps"   && <MapsAnalyticsTab scrims={scrims} loading={analysisLoading}/>}
      {tab==="profile"&& <PlayerProfileTab scrims={scrims} loading={analysisLoading}/>}
      {tab==="accounts" && <AccountsTab scrims={scrims}/>}
      {tab==="heatmaps" && <AggregateHeatmapTab scrims={scrims} loading={analysisLoading}/>}
    </div>
  );
}


/* ── Aggregate Heatmap Tab ── */
function AggregateHeatmapTab({ scrims, loading }) {
  const [filterMap,  setFilterMap]  = React.useState("All Maps");
  const [filterSide, setFilterSide] = React.useState("All");
  const [filterOpp,  setFilterOpp]  = React.useState("All");
  const [hmFilter,   setHmFilter]   = React.useState("deaths");
  const [dateFrom,   setDateFrom]   = React.useState("");
  const [dateTo,     setDateTo]     = React.useState("");

  if (loading) return <div style={{color:"var(--t3)",padding:40,textAlign:"center"}}>Loading…</div>;

  // Build list of scrims with kill_positions
  const advanced = scrims.filter(s => {
    const kp = (() => { try { const v = s.kill_positions; return Array.isArray(v)?v:(v?JSON.parse(v):[]); } catch { return []; } })();
    return kp.length > 0;
  });

  const maps = ["All Maps", ...Array.from(new Set(advanced.map(s=>s.map).filter(Boolean))).sort()];
  const opps = ["All", ...Array.from(new Set(advanced.map(s=>s.opp).filter(Boolean))).sort()];

  // Filter scrims
  const filtered = advanced.filter(s => {
    if (filterMap !== "All Maps" && s.map !== filterMap) return false;
    if (filterOpp !== "All" && s.opp !== filterOpp) return false;
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo   && s.date > dateTo)   return false;
    return true;
  });

  // Determine our team side per scrim (atkFirst stored on scrim)
  // For side filter: atkFirst=true means our team attacked in H1 (rounds 0-11)
  const allKills = [];
  let mapMeta = null;
  filtered.forEach(s => {
    const kp = (() => { try { const v = s.kill_positions; return Array.isArray(v)?v:(v?JSON.parse(v):[]); } catch { return []; } })();
    const mm = (() => { try { const v = s.map_meta; return v?(typeof v==="string"?JSON.parse(v):v):null; } catch { return null; } })();
    const atkFirst = s.atk_first; // true = our team ATK in rounds 0-11
    const totalRounds = (() => { try { const rd = s.round_detail; const a = Array.isArray(rd)?rd:(rd?JSON.parse(rd):[]); return a.length; } catch { return 24; } })();
    const halfLen = Math.floor(totalRounds / 2);

    if (mm && !mapMeta && (filterMap !== "All Maps")) mapMeta = mm;
    else if (mm && !mapMeta) mapMeta = mm; // use first available

    kp.forEach(k => {
      // Determine side of kill
      let side = "ATK";
      if (k.round < halfLen) {
        side = atkFirst ? "ATK" : "DEF";
      } else {
        side = atkFirst ? "DEF" : "ATK";
      }
      allKills.push({ ...k, side, mapMeta: mm });
    });
  });

  // Use map meta from first scrim matching selected map
  const usedMeta = (() => {
    if (filterMap === "All Maps") return null;
    const s = filtered.find(sc => {
      const mm = (() => { try { const v = sc.map_meta; return v?(typeof v==="string"?JSON.parse(v):v):null; } catch { return null; } })();
      return mm?.xMult != null;
    });
    if (!s) return null;
    try { const v = s.map_meta; return typeof v==="string"?JSON.parse(v):v; } catch { return null; }
  })();

  // Side filter
  const sideFiltered = allKills.filter(k => {
    if (filterSide === "All") return true;
    return k.side === filterSide;
  });

  const ourKills  = sideFiltered.filter(k => k.isOurKill && !k.isOurDeath);
  const ourDeaths = sideFiltered.filter(k => k.isOurDeath);
  const enemyKills = sideFiltered.filter(k => !k.isOurKill && !k.isOurDeath && k.killerTeam && k.victimTeam);
  const shown = hmFilter==="kills" ? ourKills : hmFilter==="deaths" ? ourDeaths : hmFilter==="enemy" ? enemyKills : sideFiltered;

  const W = 1024, H = 1024;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  let toSvg;
  if (usedMeta?.xMult != null) {
    toSvg = (x, y) => ({
      px: clamp((y * usedMeta.xMult + usedMeta.xScalar) * W, 0, W),
      py: clamp((x * usedMeta.yMult + usedMeta.yScalar) * H, 0, H),
    });
  } else {
    const pts = sideFiltered.length > 0 ? sideFiltered : [{x:0,y:0}];
    const xs = pts.map(k=>k.y), ys = pts.map(k=>k.x);
    const xMin=Math.min(...xs), xMax=Math.max(...xs);
    const yMin=Math.min(...ys), yMax=Math.max(...ys);
    const pad = 0.05;
    toSvg = (x, y) => ({
      px: clamp(pad*W + ((y-xMin)/(xMax-xMin||1))*(W*(1-2*pad)), 0, W),
      py: clamp(pad*H + ((x-yMin)/(yMax-yMin||1))*(H*(1-2*pad)), 0, H),
    });
  }

  const mapIcon = usedMeta?.icon || null;

  return (
    <div>
      {/* Filters */}
      <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <select value={filterMap} onChange={e=>setFilterMap(e.target.value)} style={{minWidth:130}}>
          {maps.map(m=><option key={m}>{m}</option>)}
        </select>
        <select value={filterSide} onChange={e=>setFilterSide(e.target.value)}>
          <option>All</option>
          <option>ATK</option>
          <option>DEF</option>
        </select>
        <select value={filterOpp} onChange={e=>setFilterOpp(e.target.value)} style={{minWidth:130}}>
          {opps.map(o=><option key={o}>{o}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:150}}/>
        <span style={{fontSize:12,color:"var(--t3)"}}>to</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:150}}/>
        <span style={{fontSize:12,color:"var(--t3)",marginLeft:4}}>{filtered.length} scrim{filtered.length!==1?"s":""} · {sideFiltered.length} kills</span>
      </div>

      {/* View filter */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[
          {k:"deaths", label:`Our Deaths (${ourDeaths.length})`,  color:"var(--red)"},
          {k:"kills",  label:`Our Kills (${ourKills.length})`,    color:"var(--green)"},
          {k:"enemy",  label:`Enemy Kills (${enemyKills.length})`,color:"rgba(79,195,247,0.9)"},
          {k:"all",    label:`All (${sideFiltered.length})`},
        ].map(({k,label,color})=>(
          <button key={k} onClick={()=>setHmFilter(k)} style={{
            padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
            background:hmFilter===k?"rgba(212,255,30,0.12)":"var(--s2)",
            color:hmFilter===k?color||"var(--acc)":"var(--t2)",
            border:`1px solid ${hmFilter===k?color||"rgba(212,255,30,0.3)":"var(--b2)"}`,
          }}>{label}</button>
        ))}
      </div>

      {advanced.length === 0 ? (
        <div style={{textAlign:"center",padding:"60px 0",color:"var(--t3)"}}>
          <div style={{fontSize:32,marginBottom:8}}>🗺</div>
          <div style={{fontWeight:700,marginBottom:4}}>No heatmap data</div>
          <div style={{fontSize:12}}>Re-import scrims using JSON files to generate heatmaps</div>
        </div>
      ) : filterMap === "All Maps" ? (
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--t3)",fontSize:13}}>
          Select a specific map to view the heatmap overlay
        </div>
      ) : shown.length === 0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:"var(--t3)",fontSize:13}}>No data for selected filters</div>
      ) : (
        <div style={{display:"flex",gap:20,alignItems:"flex-start",flexWrap:"wrap"}}>
          {/* Heatmap */}
          <div style={{flex:"0 0 560px",background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:10,overflow:"hidden",position:"relative"}}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",display:"block"}}>
              {mapIcon
                ? <image href={mapIcon} x={0} y={0} width={W} height={H} preserveAspectRatio="xMidYMid meet"/>
                : <rect width={W} height={H} fill="var(--s1)"/>
              }
              <rect width={W} height={H} fill="rgba(0,0,0,0.35)"/>
              <defs>
                <filter id="aggHeatBlur"><feGaussianBlur stdDeviation="22"/></filter>
              </defs>
              <g filter="url(#aggHeatBlur)" opacity={0.5}>
                {shown.map((k,i) => {
                  const {px,py} = toSvg(k.x, k.y);
                  const c = k.isOurDeath ? "rgba(255,82,82," : (k.isOurKill&&!k.isOurDeath) ? "rgba(212,255,30," : "rgba(79,195,247,";
                  return <circle key={i} cx={px} cy={py} r={32} fill={`${c}0.5)`}/>;
                })}
              </g>
              {shown.map((k,i) => {
                const {px,py} = toSvg(k.x, k.y);
                const color = k.isOurDeath ? "var(--red)" : (k.isOurKill&&!k.isOurDeath) ? "var(--acc)" : "rgba(79,195,247,0.8)";
                return <circle key={i} cx={px} cy={py} r={4} fill={color} opacity={0.85}/>;
              })}
            </svg>
          </div>

          {/* Stats sidebar */}
          <div style={{flex:1,minWidth:200,display:"flex",flexDirection:"column",gap:10}}>
            <div className="card" style={{padding:"12px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--t3)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>{filterMap} · Summary</div>
              {[
                {label:"Scrims",      value:filtered.length},
                {label:"Our Deaths",  value:ourDeaths.length,  color:"var(--red)"},
                {label:"Our Kills",   value:ourKills.length,   color:"var(--green)"},
                {label:"Enemy Kills", value:enemyKills.length, color:"var(--blue)"},
                {label:"Death/Kill",  value:ourKills.length>0?(ourDeaths.length/ourKills.length).toFixed(2):"—"},
              ].map(({label,value,color})=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:12,color:"var(--t3)"}}>{label}</span>
                  <span style={{fontSize:12,fontWeight:700,color:color||"var(--t1)"}}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{fontSize:11,color:"var(--t3)",lineHeight:1.6}}>
              Showing deaths/kills aggregated across <strong style={{color:"var(--t2)"}}>{filtered.length}</strong> scrim{filtered.length!==1?"s":""} on <strong style={{color:"var(--t2)"}}>{filterMap}</strong>.{!usedMeta&&" Re-import scrims to enable map overlay."}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      {shown.length > 0 && filterMap !== "All Maps" && (
        <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
          {[
            {color:"var(--acc)",           label:"Our Kills"},
            {color:"var(--red)",           label:"Our Deaths"},
            {color:"rgba(79,195,247,0.8)", label:"Enemy Kills"},
          ].map(({color,label})=>(
            <div key={label} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"var(--t2)"}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:color}}/>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Accounts Tab ── */
function AccountsTab({ scrims }) {
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [saving, setSaving]               = useState(null); // player id being saved
  const [assignTarget, setAssignTarget]   = useState({}); // ign → selected player id
  const [flash, setFlash]                 = useState("");

  const loadRoster = () => api.get("/api/players").then(d => { if (Array.isArray(d)) setRosterPlayers(d); }).catch(() => {});
  useEffect(() => { loadRoster(); }, []);

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 2200); };

  // Build full alias list per player
  const getAliases = (p) => {
    try { return Array.isArray(p.aliases) ? p.aliases : JSON.parse(p.aliases || "[]"); } catch { return []; }
  };

  // All known IGNs (main + aliases, lowercased)
  const allKnownIgns = new Set();
  rosterPlayers.forEach(p => {
    const main = (p.ign || p.name || "").toLowerCase().trim();
    if (main) allKnownIgns.add(main);
    getAliases(p).forEach(a => { if (a) allKnownIgns.add(a.toLowerCase().trim()); });
  });

  // Collect all IGNs seen in scrim data
  const seenIgns = new Set();
  scrims.forEach(scrim => {
    const ps = Array.isArray(scrim.player_stats)
      ? scrim.player_stats
      : (() => { try { return JSON.parse(scrim.player_stats || "[]"); } catch { return []; } })();
    ps.forEach(p => { if (p.name && p.name !== "#" && !p.name.startsWith("Player ") && p.side === "blue") seenIgns.add(p.name); });
  });

  // Unrecognized = seen in scrims but not matched to any roster player
  const unrecognized = [...seenIgns].filter(ign => !allKnownIgns.has(ign.toLowerCase().trim())).sort();

  const removeAlias = async (player, alias) => {
    const aliases = getAliases(player).filter(a => a.toLowerCase().trim() !== alias.toLowerCase().trim());
    setSaving(player.id);
    const payload = { ...player, aliases: JSON.stringify(aliases) };
    const d = await api.put(`/api/players/${player.id}`, payload).catch(() => null);
    if (d) { showFlash("Removed"); loadRoster(); }
    setSaving(null);
  };

  const assignAlias = async (ign) => {
    const playerId = assignTarget[ign];
    if (!playerId) return;
    const player = rosterPlayers.find(p => p.id === Number(playerId));
    if (!player) return;
    const aliases = [...getAliases(player), ign];
    setSaving(player.id);
    const payload = { ...player, aliases: JSON.stringify(aliases) };
    const d = await api.put(`/api/players/${player.id}`, payload).catch(() => null);
    if (d) { showFlash(`Linked ${ign} → ${player.name}`); loadRoster(); setAssignTarget(t => ({ ...t, [ign]: "" })); }
    setSaving(null);
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {flash && (
        <div style={{ background:"var(--green)", color:"#000", fontWeight:700, fontSize:12, padding:"6px 14px", borderRadius:6, marginBottom:16, display:"inline-block" }}>
          {flash}
        </div>
      )}

      {/* ── Roster players + their linked accounts ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize:13, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t2)", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:3, height:14, background:"var(--acc)", borderRadius:2, display:"inline-block" }}/>
          Roster Players
        </div>
        {rosterPlayers.length === 0 && (
          <div style={{ color:"var(--t3)", fontSize:13 }}>No roster players found. Add players in Admin first.</div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {rosterPlayers.map(p => {
            const aliases = getAliases(p);
            const mainIgn = p.ign || p.name || "";
            return (
              <div key={p.id} style={{ background:"var(--s1)", border:"1px solid var(--b2)", borderRadius:8, padding:"12px 16px", display:"flex", alignItems:"flex-start", gap:16, flexWrap:"wrap" }}>
                {/* Avatar */}
                <div style={{ width:36, height:36, borderRadius:8, background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:14, color:"#000", flexShrink:0 }}>
                  {(p.name||"?").slice(0,2).toUpperCase()}
                </div>
                {/* Name + accounts */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, marginBottom:6 }}>{p.name}</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                    {/* Main IGN chip */}
                    {mainIgn && (
                      <span style={{ fontSize:11, fontFamily:"monospace", background:"rgba(212,255,30,0.12)", color:"var(--acc)", border:"1px solid rgba(212,255,30,0.3)", borderRadius:4, padding:"2px 8px", fontWeight:700 }}>
                        {mainIgn} <span style={{ opacity:0.6, fontWeight:400 }}>main</span>
                      </span>
                    )}
                    {/* Alias chips */}
                    {aliases.map((a, i) => (
                      <span key={i} style={{ fontSize:11, fontFamily:"monospace", background:"var(--s2)", color:"var(--t2)", border:"1px solid var(--b2)", borderRadius:4, padding:"2px 8px", display:"flex", alignItems:"center", gap:4 }}>
                        {a}
                        <span
                          onClick={() => !saving && removeAlias(p, a)}
                          style={{ cursor:"pointer", color:"var(--t3)", fontSize:13, lineHeight:1, marginLeft:2, fontFamily:"sans-serif" }}
                          title="Remove alias"
                        >×</span>
                      </span>
                    ))}
                    {aliases.length === 0 && !mainIgn && (
                      <span style={{ fontSize:11, color:"var(--t3)" }}>No IGNs linked</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Unrecognized IGNs ── */}
      <div>
        <div style={{ fontSize:13, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t2)", marginBottom:6, display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ width:3, height:14, background:"var(--red)", borderRadius:2, display:"inline-block" }}/>
          Unrecognized IGNs
          <span style={{ fontSize:11, color:"var(--t3)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>— seen in scrim data but not linked to anyone</span>
        </div>
        {unrecognized.length === 0 ? (
          <div style={{ fontSize:13, color:"var(--green)", fontWeight:600 }}>✓ All IGNs are accounted for</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {unrecognized.map(ign => (
              <div key={ign} style={{ background:"var(--s1)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontFamily:"monospace", color:"var(--t1)", flex:1, minWidth:160 }}>{ign}</span>
                <select
                  value={assignTarget[ign] || ""}
                  onChange={e => setAssignTarget(t => ({ ...t, [ign]: e.target.value }))}
                  style={{ background:"var(--s2)", color:"var(--t1)", border:"1px solid var(--b2)", borderRadius:5, padding:"4px 8px", fontSize:12 }}
                >
                  <option value="">— assign to player —</option>
                  {rosterPlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-acc"
                  style={{ fontSize:11, padding:"4px 14px", opacity: assignTarget[ign] ? 1 : 0.4 }}
                  disabled={!assignTarget[ign] || saving !== null}
                  onClick={() => assignAlias(ign)}
                >
                  Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Team Stats Tab ── */
function TeamStatsTab({ scrims, loading }) {
  const wins = scrims.filter(s=>(s.res==="win"||s.res==="W")).length;
  const wr = scrims.length>0 ? Math.round((wins/scrims.length)*100) : null;
  const mapStats = MAPS.map(m=>{ const ms=scrims.filter(s=>s.map===m); const mw=ms.filter(s=>(s.res==="win"||s.res==="W")).length; return { map:m, games:ms.length, wr:ms.length>0?Math.round((mw/ms.length)*100):null }; }).filter(m=>m.games>0).sort((a,b)=>b.games-a.games);
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
        {loading
          ? [1,2,3,4].map(i=><div key={i} className="card" style={{ position:"relative", overflow:"hidden" }}>
              <div style={{ height:10, width:60, background:"var(--s3)", borderRadius:4, marginBottom:10, animation:"blink 1.4s infinite" }}/>
              <div style={{ height:36, width:80, background:"var(--s3)", borderRadius:6, marginBottom:6, animation:"blink 1.4s infinite" }}/>
              <div style={{ height:10, width:90, background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
            </div>)
          : <>
              <StatBlock label="Win Rate"    value={wr!==null?`${wr}%`:"—"} sub={scrims.length>0?`${scrims.length} games`:"No games yet"} accent/>
              <StatBlock label="Total Games" value={scrims.length} sub="Tracked"/>
              <StatBlock label="Wins"        value={wins} sub="Total wins"/>
              <StatBlock label="Losses"      value={scrims.length-wins} sub="Total losses"/>
            </>
        }
      </div>
      {mapStats.length>0 && (
        <div className="card">
          <div className="bc" style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>MAP BREAKDOWN</div>
          {mapStats.map(m=>(
            <div key={m.map} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:600, width:80, flexShrink:0 }}>{m.map}</div>
                <span className="mono" style={{ fontSize:12, fontWeight:700, color:m.wr>=50?"var(--green)":"var(--red)" }}>{m.wr!==null?`${m.wr}% WR`:"—"}</span>
                <span style={{ fontSize:11, color:"var(--t2)" }}>·</span>
                <span style={{ fontSize:11, color:"var(--t3)" }}>{m.games} game{m.games!==1?"s":""}</span>
              </div>
              <div style={{ paddingLeft:92 }}>
                <Bar pct={m.wr||0} color={m.wr>=50?"var(--green)":"var(--red)"}/>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Maps Analytics Tab ── */
function MapsAnalyticsTab({ scrims, loading }) {
  const [matchType, setMatchType] = useState("Scrims");
  const [filterMap, setFilterMap] = useState("All Maps");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const byType = scrims.filter(s => {
    if (matchType === "Scrims")    return !s.is_official;
    if (matchType === "Officials") return !!s.is_official;
    return true;
  });
  const availableMaps = ["All Maps", ...MAPS.filter(m => byType.some(s => s.map === m))];

  React.useEffect(() => {
    if (filterMap !== "All Maps" && !availableMaps.includes(filterMap)) setFilterMap("All Maps");
  }, [matchType]);

  const filtered = byType.filter(s => {
    if (filterMap !== "All Maps" && s.map !== filterMap) return false;
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo   && s.date > dateTo)   return false;
    return true;
  });

  const wins   = filtered.filter(s=>(s.res==="win"||s.res==="W")).length;
  const losses = filtered.length - wins;
  const total  = filtered.length;
  const wr     = total > 0 ? Math.round(wins/total*100) : null;

  const parseRounds = (s) => { try { return Array.isArray(s.rounds)?s.rounds:JSON.parse(s.rounds||"[]"); } catch { return []; } };

  let totalAtkWon=0,totalAtkPlayed=0,totalDefWon=0,totalDefPlayed=0;
  let pistolAtkWon=0,pistolAtkTotal=0,pistolDefWon=0,pistolDefTotal=0;
  let antiEcoAtkWon=0,antiEcoAtkTotal=0,antiEcoDefWon=0,antiEcoDefTotal=0;
  let ecoAtkWon=0,ecoAtkTotal=0,ecoDefWon=0,ecoDefTotal=0;
  // FK (First Kill) tracking — overall
  let fkTotal=0,fkWon=0,fdTotal=0,fdWon=0;
  let fkAtkTotal=0,fkAtkWon=0,fdAtkTotal=0,fdAtkWon=0;
  let fkDefTotal=0,fkDefWon=0,fdDefTotal=0,fdDefWon=0;
  let totalRoundsWithFB=0;
  let totalAvgOurs=0, totalAvgThem=0;
  // True First Kill / True First Death win tracking
  let tfkTotal=0,tfkWon=0,tfdTotal=0,tfdWon=0,tftTotal=0,tftWon=0;
  let tfkAtkTotal=0,tfkAtkWon=0,tfkDefTotal=0,tfkDefWon=0;
  let tfdAtkTotal=0,tfdAtkWon=0,tfdDefTotal=0,tfdDefWon=0;
  let tftAtkTotal=0,tftAtkWon=0,tftDefTotal=0,tftDefWon=0;

  filtered.forEach(s => {
    const rds = parseRounds(s);
    // atk_first stored on import (detected from first H1 bomb plant).
    // Backfilled on server start for old scrims. Client fallback mirrors server logic.
    let atkFirst = s.atk_first;
    if (atkFirst === null || atkFirst === undefined) {
      try {
        const ps = Array.isArray(s.player_stats) ? s.player_stats : JSON.parse(s.player_stats || "[]");
        const rd = Array.isArray(s.round_detail)  ? s.round_detail  : JSON.parse(s.round_detail  || "[]");
        const ourTeamPlayer = ps.find(p => p.side === "blue");
        // Use stored team field if available, else infer from planterTeam
        const ourTeam = ourTeamPlayer?.team || "";
        let atkTeam = null;
        for (const r of rd.slice(0, 12)) { if (r.planted && r.planterTeam) { atkTeam = r.planterTeam; break; } }
        if (!atkTeam) for (const r of rd.slice(12, 24)) { if (r.planted && r.planterTeam) { atkTeam = r.planterTeam === "Blue" ? "Red" : "Blue"; break; } }
        if (ourTeam) {
          atkFirst = (atkTeam || "Blue") === ourTeam;
        } else {
          // No team field: the H1 planter is the ATK team; we need to know if that's us.
          // Use player side="blue" as "our team" and check if any H1 kill's killerTeam matches atkTeam
          // when winnerIsOurs=true — if our team (blue) killed and won in H1, we were ATK
          const h1Wins = rd.slice(0, 12).filter(r => r.winnerIsOurs);
          const h2Wins = rd.slice(12, 24).filter(r => r.winnerIsOurs);
          // More wins in H1 than H2 typically means we were ATK (harder to win on DEF in Valorant)
          // Better: if atkTeam found, check kills in that team's winning rounds
          atkFirst = h1Wins.length >= h2Wins.length; // heuristic fallback
        }
      } catch { atkFirst = true; }
    }
    const h1 = rds.slice(0, 12);
    const h2 = rds.slice(12, 24);
    const atkRds = atkFirst ? h1 : h2;
    const defRds = atkFirst ? h2 : h1;
    atkRds.forEach(r => { totalAtkPlayed++; if (r === "w") totalAtkWon++; });
    defRds.forEach(r => { totalDefPlayed++; if (r === "w") totalDefWon++; });
    totalAvgOurs += rds.filter(r => r === "w").length;
    totalAvgThem += rds.filter(r => r === "l").length;

    // Pistol indices: round 0 of each half (absolute indices into rds)
    const atkPistolIdx = atkFirst ? 0 : 12;
    const defPistolIdx = atkFirst ? 12 : 0;
    // Bonus round indices: round 1 of each half (the round immediately after the pistol)
    const atkBonusIdx  = atkFirst ? 1 : 13;
    const defBonusIdx  = atkFirst ? 13 : 1;

    // ATK pistol + bonus round
    if (rds.length > atkPistolIdx) {
      const pistolWon = rds[atkPistolIdx] === "w";
      pistolAtkTotal++; if (pistolWon) pistolAtkWon++;
      // Bonus round only exists if there was a round after the pistol
      if (rds.length > atkBonusIdx) {
        const bonusWon = rds[atkBonusIdx] === "w";
        if (pistolWon) { antiEcoAtkTotal++; if (bonusWon) antiEcoAtkWon++; }
        else           { ecoAtkTotal++;     if (bonusWon) ecoAtkWon++;     }
      }
    }
    // DEF pistol + bonus round
    if (rds.length > defPistolIdx) {
      const pistolWon = rds[defPistolIdx] === "w";
      pistolDefTotal++; if (pistolWon) pistolDefWon++;
      if (rds.length > defBonusIdx) {
        const bonusWon = rds[defBonusIdx] === "w";
        if (pistolWon) { antiEcoDefTotal++; if (bonusWon) antiEcoDefWon++; }
        else           { ecoDefTotal++;     if (bonusWon) ecoDefWon++;     }
      }
    }

    // FK / FD per round using round_detail firstBlood
    try {
      const rd2 = Array.isArray(s.round_detail) ? s.round_detail : JSON.parse(s.round_detail||"[]");
      const ps2 = Array.isArray(s.player_stats) ? s.player_stats : JSON.parse(s.player_stats||"[]");
      const ourTeamFBPlayer = ps2.find(p => p.side === "blue");
      // Prefer stored team field (set on import for newer scrims)
      let ourTeamFB = ourTeamFBPlayer?.team || "";
      if (!ourTeamFB) {
        // Fallback: infer from planterTeam in round_detail + atkFirst
        // If atkFirst=true, our team attacked in H1 (rounds 0-11) → we planted in H1
        // Find the first H1 plant to get the attacking teamId
        let atkTeamId = null;
        for (const rd of rd2.slice(0, 12)) {
          if (rd.planterTeam) { atkTeamId = rd.planterTeam; break; }
        }
        if (!atkTeamId) {
          // Try H2: the H2 planter was the defending team in H1, so invert
          for (const rd of rd2.slice(12, 24)) {
            if (rd.planterTeam) { atkTeamId = rd.planterTeam === "Blue" ? "Red" : "Blue"; break; }
          }
        }
        if (atkTeamId) {
          ourTeamFB = af2 ? atkTeamId : (atkTeamId === "Blue" ? "Red" : "Blue");
        } else {
          ourTeamFB = "Blue"; // last resort
        }
      }
      const af2 = atkFirst;
      rd2.forEach((rd, rdIdx) => {
        const fb = rd.firstBlood;
        if (!fb) return;
        totalRoundsWithFB++;
        const weGotFK = fb.killerTeam === ourTeamFB;
        const weWon   = !!rd.winnerIsOurs;
        const isAtkRound = af2 ? rdIdx < 12 : rdIdx >= 12;
        if (weGotFK) {
          fkTotal++; if (weWon) fkWon++;
          if (isAtkRound) { fkAtkTotal++; if (weWon) fkAtkWon++; }
          else             { fkDefTotal++; if (weWon) fkDefWon++; }
        } else {
          fdTotal++; if (weWon) fdWon++;
          if (isAtkRound) { fdAtkTotal++; if (weWon) fdAtkWon++; }
          else             { fdDefTotal++; if (weWon) fdDefWon++; }
        }
      });

      // True First Kill: we got FK and the opponent did NOT trade our killer within 2s
      // True First Death: we gave FK and we did NOT trade their killer within 2s
      const af3 = atkFirst;
      const nameMatch = (a, b) => {
        if (!a || !b) return false;
        return a === b || a.split('#')[0] === b || a === b.split('#')[0];
      };
      rd2.forEach((rd, rdIdx) => {
        const kills = rd.kills || [];
        if (!kills.length) return;
        const sorted = [...kills].sort((a,b) => (a.time||0)-(b.time||0));
        const firstKill = sorted[0];
        if (!firstKill) return;
        const weGotFirstKill = firstKill.killerTeam === ourTeamFB; // we killed first
        const tradeWindow = (firstKill.time||0) + TRADE_WINDOW_MS;
        const weWon = !!rd.winnerIsOurs;
        const isAtk = af3 ? rdIdx < 12 : rdIdx >= 12;
        // TFT: the VERY NEXT kill must be the first killer dying to the other team within 2s
        const killerWasTraded = sorted.slice(1).some(k =>
          (k.time||0) <= tradeWindow &&
          k.killerTeam !== firstKill.killerTeam &&
          (firstKill.killerPuuid && k.victimPuuid
            ? k.victimPuuid === firstKill.killerPuuid
            : (!firstKill.killerPuuid && !k.victimPuuid && nameMatch(k.victimName, firstKill.killerName))));
        if (weGotFirstKill) {
          // TFK = we got FK and opponent did NOT trade our killer within 2s
          if (!killerWasTraded) {
            tfkTotal++; if (weWon) tfkWon++;
            if (isAtk) { tfkAtkTotal++; if (weWon) tfkAtkWon++; }
            else        { tfkDefTotal++; if (weWon) tfkDefWon++; }
          }
          // if killerWasTraded: opponent traded our FK — not counted as TFK (it was contested)
        } else {
          // We gave first death
          if (killerWasTraded) {
            // TFT = we gave first death but traded their killer within 2s
            tftTotal++; if (weWon) tftWon++;
            if (isAtk) { tftAtkTotal++; if (weWon) tftAtkWon++; }
            else        { tftDefTotal++; if (weWon) tftDefWon++; }
          } else {
            // TFD = we gave first death and did NOT trade within 2s
            tfdTotal++; if (weWon) tfdWon++;
            if (isAtk) { tfdAtkTotal++; if (weWon) tfdAtkWon++; }
            else        { tfdDefTotal++; if (weWon) tfdDefWon++; }
          }
        }
      });
    } catch {}
  });

  const pct = (n,d) => d===0?"—":`${Math.round(n/d*100)}%`;
  const fmtAvg = v => Number.isInteger(v) ? String(v) : v.toFixed(1);
  const overallAvgOurs = total > 0 ? totalAvgOurs / total : null;
  const overallAvgThem = total > 0 ? totalAvgThem / total : null;

  const mapRows = MAPS.map(map => {
    const ms = filtered.filter(s=>s.map===map);
    if (!ms.length) return null;
    const mw=ms.filter(s=>(s.res==="win"||s.res==="W")).length;
    let mAtk=0,mAtkW=0,mDef=0,mDefW=0,mAtkP=0,mAtkPW=0,mDefP=0,mDefPW=0;
    let mAvgOurs=0, mAvgThem=0;
    const mOurSites={}, mOppSites={};
    let mTft=0, mTfd=0;
    let mFkTotal=0,mFkWon=0,mFdTotal=0,mFdWon=0;
    let mFkAtkTotal=0,mFkAtkWon=0,mFdAtkTotal=0,mFdAtkWon=0;
    let mFkDefTotal=0,mFkDefWon=0,mFdDefTotal=0,mFdDefWon=0;
    let mAtkRoundsTotal=0, mAtkPlantsTotal=0, mDefRoundsTotal=0, mDefPlantsAllowed=0;
    ms.forEach(s => {
      const rds=parseRounds(s);
      let af = s.atk_first;
      if (af === null || af === undefined) {
        try {
          const ps = Array.isArray(s.player_stats) ? s.player_stats : JSON.parse(s.player_stats || "[]");
          const rd = Array.isArray(s.round_detail)  ? s.round_detail  : JSON.parse(s.round_detail  || "[]");
          const ourTeamPlayer3 = ps.find(p => p.side === "blue");
          const ourTeam = ourTeamPlayer3?.team || "";
          let atkTeam = null;
          for (const r of rd.slice(0,12))  { if (r.planted && r.planterTeam) { atkTeam = r.planterTeam; break; } }
          if (!atkTeam) for (const r of rd.slice(12,24)) { if (r.planted && r.planterTeam) { atkTeam = r.planterTeam === "Blue" ? "Red" : "Blue"; break; } }
          if (ourTeam) {
            af = (atkTeam || "Blue") === ourTeam;
          } else {
            const h1Wins = rd.slice(0, 12).filter(r => r.winnerIsOurs);
            const h2Wins = rd.slice(12, 24).filter(r => r.winnerIsOurs);
            af = h1Wins.length >= h2Wins.length;
          }
        } catch { af = true; }
      }
      const h1=rds.slice(0,12), h2=rds.slice(12,24);
      const atkRds=af?h1:h2, defRds=af?h2:h1;
      atkRds.forEach(r=>{ mAtk++; if(r==="w") mAtkW++; });
      defRds.forEach(r=>{ mDef++; if(r==="w") mDefW++; });
      mAvgOurs += rds.filter(r=>r==="w").length;
      mAvgThem += rds.filter(r=>r==="l").length;
      mAtkRoundsTotal += atkRds.length;
      mDefRoundsTotal += defRds.length;
      const atkPIdx=af?0:12, defPIdx=af?12:0;
      if(rds.length>atkPIdx){ mAtkP++; if(rds[atkPIdx]==="w") mAtkPW++; }
      if(rds.length>defPIdx){ mDefP++; if(rds[defPIdx]==="w") mDefPW++; }
      // Postplant sites + Trading stats
      try {
        const rd2 = Array.isArray(s.round_detail) ? s.round_detail : JSON.parse(s.round_detail||"[]");
        const ps2 = Array.isArray(s.player_stats) ? s.player_stats : JSON.parse(s.player_stats||"[]");
        const ourTeam2 = "Red";
        const _bA2 = rd => { const m = String(rd.xvy||"").match(/^(\d+)v(\d+)$/); return !m || (parseInt(m[1])>0 && parseInt(m[2])>0); };
        const isMoneyPlantMap = rd => {
          if (!rd.planted || !rd.plantRoundTime) return false;
          const lastKillTime = (rd.kills || []).reduce((max, k) => Math.max(max, k.time || 0), 0);
          return rd.plantRoundTime > lastKillTime;
        };
        rd2.forEach(rd => {
          // Postplant sites - only for planted rounds
          if (rd.planted && rd.site) {
            if (rd.planterTeam === ourTeam2 && !isMoneyPlantMap(rd)) {
              mAtkPlantsTotal++;
              if (!mOurSites[rd.site]) mOurSites[rd.site]={count:0,won:0};
              mOurSites[rd.site].count++;
              if (rd.winnerIsOurs) mOurSites[rd.site].won++;
            } else if (rd.planterTeam && !isMoneyPlantMap(rd)) {
              mDefPlantsAllowed++;
              if (!mOppSites[rd.site]) mOppSites[rd.site]={count:0,theyWon:0};
              mOppSites[rd.site].count++;
              if (!rd.winnerIsOurs) mOppSites[rd.site].theyWon++;
            }
          }
          // Trading stats - same logic as individual scrim view, all rounds
          const kills = rd.kills || [];
          if (!kills.length) return;
          const sorted = [...kills].sort((a,b)=>(a.time||0)-(b.time||0));
          const firstKill = sorted[0];
          if (!firstKill || firstKill.victimTeam !== ourTeam2) return;
          const tradeWindow = (firstKill.time||0) + TRADE_WINDOW_MS;
          // PUUID if available, otherwise: does the killer of first death die within 2s?
          const traded = sorted.slice(1).some(k =>
            (k.time||0) <= tradeWindow &&
            (k.victimPuuid && firstKill.killerPuuid
              ? k.victimPuuid === firstKill.killerPuuid
              : k.victimName === firstKill.killerName) &&
            k.killerTeam === ourTeam2);
          if (traded) mTft++; else mTfd++;
        });
        // FK / FD for this map
        rd2.forEach((rd, rdIdx) => {
          const fb = rd.firstBlood;
          if (!fb) return;
          const weGotFK = fb.killerTeam === ourTeam2;
          const weWon   = !!rd.winnerIsOurs;
          const isAtkRound = af ? rdIdx < 12 : rdIdx >= 12;
          if (weGotFK) {
            mFkTotal++; if (weWon) mFkWon++;
            if (isAtkRound) { mFkAtkTotal++; if (weWon) mFkAtkWon++; }
            else             { mFkDefTotal++; if (weWon) mFkDefWon++; }
          } else {
            mFdTotal++; if (weWon) mFdWon++;
            if (isAtkRound) { mFdAtkTotal++; if (weWon) mFdAtkWon++; }
            else             { mFdDefTotal++; if (weWon) mFdDefWon++; }
          }
        });
      } catch {}
    });
    return { map, sp:ms.length, w:mw, l:ms.length-mw, wr:Math.round(mw/ms.length*100), avgOurs:mAvgOurs/ms.length, avgTheirs:mAvgThem/ms.length, atkPistol:pct(mAtkPW,mAtkP), defPistol:pct(mDefPW,mDefP), atk:pct(mAtkW,mAtk), def:pct(mDefW,mDef), ourSites:mOurSites, oppSites:mOppSites, tft:mTft, tfd:mTfd, fkTotal:mFkTotal, fkWon:mFkWon, fdTotal:mFdTotal, fdWon:mFdWon, fkAtkTotal:mFkAtkTotal, fkAtkWon:mFkAtkWon, fdAtkTotal:mFdAtkTotal, fdAtkWon:mFdAtkWon, fkDefTotal:mFkDefTotal, fkDefWon:mFkDefWon, fdDefTotal:mFdDefTotal, fdDefWon:mFdDefWon, atkRoundsTotal:mAtkRoundsTotal, atkPlantsTotal:mAtkPlantsTotal, defRoundsTotal:mDefRoundsTotal, defPlantsAllowed:mDefPlantsAllowed };
  }).filter(Boolean).sort((a,b)=>b.sp-a.sp);

  const BIG = ({ label, value, sub, color="var(--acc)" }) => (
    <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:10, padding:"14px 18px", flex:1, minWidth:110 }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", marginBottom:6 }}>{label}</div>
      <div className="bc" style={{ fontSize:28, fontWeight:900, color, lineHeight:1 }}>{value??"—"}</div>
      {sub && <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{sub}</div>}
    </div>
  );

  const Tooltip = ({ text, children }) => {
    const [pos, setPos] = React.useState(null);
    const ref = React.useRef(null);
    const show = (e) => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setPos({ x: r.left + r.width/2, y: r.top });
    };
    return (
      <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}
        onMouseEnter={show} onMouseLeave={()=>setPos(null)}>
        {children}
        {pos && text && ReactDOM.createPortal(
          <span style={{ position:"fixed", left:pos.x, top:pos.y - 8, transform:"translate(-50%,-100%)", background:"var(--s4)", border:"1px solid var(--b2)", color:"var(--t1)", fontSize:11, padding:"5px 9px", borderRadius:6, whiteSpace:"nowrap", zIndex:99999, pointerEvents:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.4)" }}>
            {text}
            <span style={{ position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)", borderWidth:5, borderStyle:"solid", borderColor:"var(--b2) transparent transparent transparent" }}/>
          </span>,
          document.body
        )}
      </span>
    );
  };

  const WRBar = ({ label, won, total:t, color="var(--acc)", tooltip="" }) => {
    const p = t > 0 ? won/t : 0;
    return (
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
          <Tooltip text={tooltip}>
            <span style={{ fontSize:12, color:"var(--t2)", fontWeight:600, borderBottom: tooltip ? "1px dashed var(--b3)" : "none", cursor: tooltip ? "help" : "default" }}>{label}</span>
          </Tooltip>
          <span style={{ fontSize:12, fontWeight:800, color }}>{pct(won,t)}</span>
        </div>
        <div style={{ height:6, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
          <div style={{ width:`${p*100}%`, height:"100%", background:color, borderRadius:3, transition:"width 0.5s" }}/>
        </div>
        <div style={{ fontSize:10, color:"var(--t3)", marginTop:2 }}>{won}W · {t-won}L · {t} total</div>
      </div>
    );
  };

  if (loading) return <div style={{ color:"var(--t3)", padding:40, textAlign:"center" }}>Loading…</div>;

  return (
    <div>
      {/* Filters row */}
      <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:20, flexWrap:"wrap" }}>
        <select value={matchType} onChange={e=>setMatchType(e.target.value)} style={{ width:140, fontWeight:700, color: "var(--t1)" }}>
          <option value="Scrims">Scrims</option>
          <option value="Officials">Officials</option>
          <option value="Combined">Combined</option>
        </select>
        <select value={filterMap} onChange={e=>setFilterMap(e.target.value)} style={{ width:140 }}>
          {availableMaps.map(m=><option key={m}>{m}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ width:150 }}/>
        <span style={{ color:"var(--t3)", fontSize:12 }}>to</span>
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={{ width:150 }}/>
        <span style={{ fontSize:12, color:"var(--t3)", marginLeft:4 }}>
          {filtered.length} {matchType==="Officials"?"official":matchType==="Scrims"?"scrim":""} {filtered.length===1?"match":"matches"}
          {(() => {
            if(matchType==="Scrims"){
              const adv = filtered.filter(s=>s.source==="riot"||s.source==="riot_raw"||s.source==="ocr").length;
              const man = filtered.length - adv;
              return <span style={{ color:"var(--t3)", opacity:0.7 }}> ({adv} Advanced / {man} Manual)</span>;
            }
            if(matchType==="Combined"){
              const adv = filtered.filter(s=>s.source==="riot"||s.source==="riot_raw"||s.source==="ocr").length;
              const man = filtered.filter(s=>s.source==="manual"||!s.source).length;
              const off = filtered.length - adv - man;
              return <span style={{ color:"var(--t3)", opacity:0.7 }}> ({adv} Advanced / {man} Manual / {off} Officials)</span>;
            }
            if(matchType==="Officials"){
              return null;
            }
            return null;
          })()}
        </span>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, padding:"7px 12px", background:"rgba(79,195,247,0.06)", border:"1px solid rgba(79,195,247,0.2)", borderRadius:7 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{ fontSize:11, color:"var(--blue)" }}>Advanced round stats use imported games only. Manual scrims contribute to match-level stats only (Record, Win Rate, Scoreline).</span>
      </div>

      {total === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:"60px 20px", color:"var(--t3)" }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🗺</div>
          <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No scrims tracked yet</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* Overall Record */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:3, height:16, background:"var(--acc)", borderRadius:2 }}/>
              <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>OVERALL RECORD</span>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              <BIG label="Record"      value={`${wins}-${losses}-0`} sub="W-L-D" color="var(--t1)"/>
              <BIG label="Win %"       value={wr!==null?`${wr}%`:"—"} color={wr!==null&&wr>=50?"var(--green)":"var(--red)"}/>
              <BIG label="Total Games" value={total} sub="Matches" color="var(--blue)"/>
              <BIG label="Avg Score"   value={overallAvgOurs!==null?`${fmtAvg(overallAvgOurs)} – ${fmtAvg(overallAvgThem)}`:"—"} sub="Rounds per game" color={overallAvgOurs>overallAvgThem?"var(--green)":"var(--red)"}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:4 }}>ATK ROUNDS</div>
                <div className="bc" style={{ fontSize:22, fontWeight:900, color:"var(--orange)" }}>{totalAtkWon} / {totalAtkPlayed}</div>
                <div style={{ fontSize:10, color:"var(--t3)" }}>Won / Played</div>
              </div>
              <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:4 }}>DEF ROUNDS</div>
                <div className="bc" style={{ fontSize:22, fontWeight:900, color:"var(--blue)" }}>{totalDefWon} / {totalDefPlayed}</div>
                <div style={{ fontSize:10, color:"var(--t3)" }}>Won / Played</div>
              </div>
            </div>
          </div>

          {/* Win Rates */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:3, height:16, background:"var(--green)", borderRadius:2 }}/>
              <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>WIN RATES</span>
            </div>
            <WRBar label="Overall Map Win %" won={wins}         total={total}          color="var(--green)"  tooltip="Overall map win rate across all tracked games"/>
            <WRBar label="ATK Win %"         won={totalAtkWon}  total={totalAtkPlayed}  color="var(--orange)" tooltip="Attack round win rate"/>
            <WRBar label="DEF Win %"         won={totalDefWon}  total={totalDefPlayed}  color="var(--blue)"   tooltip="Defence round win rate"/>
          </div>

          {/* Opening Duels */}
          <div className="card" style={{ gridColumn:"1 / -1" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <div style={{ width:3, height:16, background:"var(--green)", borderRadius:2 }}/>
              <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>Opening Duels</span>
            </div>
            {(() => {
              const ODTooltip = ({ text, children }) => {
                const [pos, setPos] = React.useState(null);
                const ref = React.useRef(null);
                return (
                  <span ref={ref} style={{ position:"relative", display:"inline-flex", alignItems:"center" }}
                    onMouseEnter={()=>{ const r=ref.current?.getBoundingClientRect(); if(r) setPos({x:r.left+r.width/2,y:r.top}); }}
                    onMouseLeave={()=>setPos(null)}>
                    {children}
                    {pos && text && ReactDOM.createPortal(
                      <span style={{ position:"fixed", left:pos.x, top:pos.y-8, transform:"translate(-50%,-100%)", background:"var(--s4)", border:"1px solid var(--b2)", color:"var(--t1)", fontSize:11, padding:"5px 9px", borderRadius:6, whiteSpace:"nowrap", zIndex:99999, pointerEvents:"none", boxShadow:"0 4px 12px rgba(0,0,0,0.4)" }}>
                        {text}
                        <span style={{ position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)", borderWidth:5, borderStyle:"solid", borderColor:"var(--b2) transparent transparent transparent" }}/>
                      </span>,
                      document.body
                    )}
                  </span>
                );
              };
              const Row = ({ rows }) => (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                  {rows.map(({ label, pctVal, sub, bar, color, tooltip }) => (
                    <div key={label} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:8, padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:3 }}>
                        <ODTooltip text={tooltip}>
                          <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", borderBottom: tooltip?"1px dashed var(--b3)":"none", cursor: tooltip?"help":"default" }}>{label}</span>
                        </ODTooltip>
                        <span className="bc" style={{ fontSize:20, fontWeight:900, color, lineHeight:1 }}>{pctVal}</span>
                        <span style={{ fontSize:10, color:"var(--t3)", marginLeft:"auto" }}>{sub}</span>
                      </div>
                      <div style={{ height:4, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ width:`${bar}%`, height:"100%", background:color, borderRadius:3 }}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
              const fkColor  = fkTotal>0&&Math.round(fkWon/fkTotal*100)>=50?"var(--green)":"var(--red)";
              const fkAColor = fkAtkTotal>0&&Math.round(fkAtkWon/fkAtkTotal*100)>=50?"var(--orange)":"var(--red)";
              const fkDColor = fkDefTotal>0&&Math.round(fkDefWon/fkDefTotal*100)>=50?"var(--blue)":"var(--red)";
              const fdColor  = fdTotal>0&&Math.round(fdWon/fdTotal*100)>=50?"var(--green)":"var(--red)";
              const fdAColor = fdAtkTotal>0&&Math.round(fdAtkWon/fdAtkTotal*100)>=50?"var(--orange)":"var(--red)";
              const fdDColor = fdDefTotal>0&&Math.round(fdDefWon/fdDefTotal*100)>=50?"var(--blue)":"var(--red)";
              const tfkColor  = tfkTotal>0&&Math.round(tfkWon/tfkTotal*100)>=50?"var(--green)":"var(--red)";
              const tfkAColor = tfkAtkTotal>0&&Math.round(tfkAtkWon/tfkAtkTotal*100)>=50?"var(--orange)":"var(--red)";
              const tfkDColor = tfkDefTotal>0&&Math.round(tfkDefWon/tfkDefTotal*100)>=50?"var(--blue)":"var(--red)";
              const tfdColor  = tfdTotal>0&&Math.round(tfdWon/tfdTotal*100)>=50?"var(--green)":"var(--red)";
              const tfdAColor = tfdAtkTotal>0&&Math.round(tfdAtkWon/tfdAtkTotal*100)>=50?"var(--orange)":"var(--red)";
              const tfdDColor = tfdDefTotal>0&&Math.round(tfdDefWon/tfdDefTotal*100)>=50?"var(--blue)":"var(--red)";
              return (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <Row rows={[
                    { label:"FK %",     pctVal:pct(fkTotal,fkTotal+fdTotal),          sub:`${fkTotal}FK · ${fkTotal+fdTotal} rounds`,              bar:fkTotal/(fkTotal+fdTotal||1)*100,          color:"var(--green)", tooltip:"How often your team gets the first kill" },
                    { label:"ATK FK %", pctVal:pct(fkAtkTotal,fkAtkTotal+fdAtkTotal), sub:`${fkAtkTotal}FK · ${fkAtkTotal+fdAtkTotal} atk rounds`, bar:fkAtkTotal/(fkAtkTotal+fdAtkTotal||1)*100, color:"var(--orange)", tooltip:"How often your team gets the first kill on attack" },
                    { label:"DEF FK %", pctVal:pct(fkDefTotal,fkDefTotal+fdDefTotal), sub:`${fkDefTotal}FK · ${fkDefTotal+fdDefTotal} def rounds`, bar:fkDefTotal/(fkDefTotal+fdDefTotal||1)*100, color:"var(--blue)", tooltip:"How often your team gets the first kill on defence" },
                  ]}/>
                  <Row rows={[
                    { label:"FK WR %",     pctVal:pct(fkWon,fkTotal),       sub:`${fkWon}W · ${fkTotal} rounds we got FK`,           bar:fkTotal>0?fkWon/fkTotal*100:0,         color:fkColor,  tooltip:"Round winrate after getting first kill" },
                    { label:"ATK FK WR %", pctVal:pct(fkAtkWon,fkAtkTotal), sub:`${fkAtkWon}W · ${fkAtkTotal} atk rounds we got FK`, bar:fkAtkTotal>0?fkAtkWon/fkAtkTotal*100:0, color:fkAColor, tooltip:"Round winrate after getting first kill on attack" },
                    { label:"DEF FK WR %", pctVal:pct(fkDefWon,fkDefTotal), sub:`${fkDefWon}W · ${fkDefTotal} def rounds we got FK`, bar:fkDefTotal>0?fkDefWon/fkDefTotal*100:0, color:fkDColor, tooltip:"Round winrate after getting first kill on defence" },
                  ]}/>
                  <Row rows={[
                    { label:"FD WR %",     pctVal:pct(fdWon,fdTotal),       sub:`${fdWon}W · ${fdTotal} rounds we got FD`,           bar:fdTotal>0?fdWon/fdTotal*100:0,         color:fdColor,  tooltip:"Round winrate after giving first death" },
                    { label:"ATK FD WR %", pctVal:pct(fdAtkWon,fdAtkTotal), sub:`${fdAtkWon}W · ${fdAtkTotal} atk rounds we got FD`, bar:fdAtkTotal>0?fdAtkWon/fdAtkTotal*100:0, color:fdAColor, tooltip:"Round winrate after giving first death on attack" },
                    { label:"DEF FD WR %", pctVal:pct(fdDefWon,fdDefTotal), sub:`${fdDefWon}W · ${fdDefTotal} def rounds we got FD`, bar:fdDefTotal>0?fdDefWon/fdDefTotal*100:0, color:fdDColor, tooltip:"Round winrate after giving first death on defence" },
                  ]}/>
                  <Row rows={[
                    { label:"TRUE FK WR %",     pctVal:pct(tfkWon,tfkTotal),       sub:`${tfkWon}W · ${tfkTotal} rounds we got TFK`,           bar:tfkTotal>0?tfkWon/tfkTotal*100:0,         color:tfkColor,  tooltip:"Round winrate after getting a true first kill" },
                    { label:"ATK TRUE FK WR %", pctVal:pct(tfkAtkWon,tfkAtkTotal), sub:`${tfkAtkWon}W · ${tfkAtkTotal} atk rounds we got TFK`, bar:tfkAtkTotal>0?tfkAtkWon/tfkAtkTotal*100:0, color:tfkAColor, tooltip:"Round winrate after getting a true first kill on attack" },
                    { label:"DEF TRUE FK WR %", pctVal:pct(tfkDefWon,tfkDefTotal), sub:`${tfkDefWon}W · ${tfkDefTotal} def rounds we got TFK`, bar:tfkDefTotal>0?tfkDefWon/tfkDefTotal*100:0, color:tfkDColor, tooltip:"Round winrate after getting a true first kill on defence" },
                  ]}/>
                  <Row rows={[
                    { label:"TRUE FD WR %",     pctVal:pct(tfdWon,tfdTotal),       sub:`${tfdWon}W · ${tfdTotal} rounds we got TFD`,           bar:tfdTotal>0?tfdWon/tfdTotal*100:0,         color:tfdColor,  tooltip:"Round winrate after giving a true first death" },
                    { label:"ATK TRUE FD WR %", pctVal:pct(tfdAtkWon,tfdAtkTotal), sub:`${tfdAtkWon}W · ${tfdAtkTotal} atk rounds we got TFD`, bar:tfdAtkTotal>0?tfdAtkWon/tfdAtkTotal*100:0, color:tfdAColor, tooltip:"Round winrate after giving a true first death on attack" },
                    { label:"DEF TRUE FD WR %", pctVal:pct(tfdDefWon,tfdDefTotal), sub:`${tfdDefWon}W · ${tfdDefTotal} def rounds we got TFD`, bar:tfdDefTotal>0?tfdDefWon/tfdDefTotal*100:0, color:tfdDColor, tooltip:"Round winrate after giving a true first death on defence" },
                  ]}/>
                </div>
              );
            })()}
          </div>

                    {/* Pistol Rounds */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:3, height:16, background:"var(--purple)", borderRadius:2 }}/>
              <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>PISTOL ROUNDS</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"ATK PISTOL WR %", won:pistolAtkWon, total:pistolAtkTotal, color:"var(--orange)", tooltip:"Round winrate after getting first kill" },
                { label:"DEF PISTOL WR %", won:pistolDefWon, total:pistolDefTotal, color:"var(--blue)", tooltip:"Round winrate after getting first kill on attack" },
              ].map(({ label, won, total:t, color }) => (
                <div key={label} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:8, padding:"14px 16px" }}>
                  <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:4 }}>{label}</div>
                  <div className="bc" style={{ fontSize:26, fontWeight:900, color, lineHeight:1 }}>{pct(won,t)}</div>
                  <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>{won}W · {t} total</div>
                  <div style={{ marginTop:8, height:5, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${t>0?won/t*100:0}%`, height:"100%", background:color, borderRadius:3 }}/>
                  </div>
                </div>
              ))}
            </div>
            {/* Anti-eco / Eco bonus rounds */}
            <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid var(--b1)" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:10 }}>
                Anti-Eco / Eco WR % (Round 2 / Round 14)
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {[
                  { label:"ATK Anti-Eco WR %", won:antiEcoAtkWon, total:antiEcoAtkTotal, color:"var(--green)",  tooltip:"Win rate on round 2 after winning ATK pistol" },
                  { label:"DEF Anti-Eco WR %", won:antiEcoDefWon, total:antiEcoDefTotal, color:"var(--green)",  tooltip:"Win rate on round 14 after winning DEF pistol" },
                  { label:"ATK Eco WR %",      won:ecoAtkWon,     total:ecoAtkTotal,     color:"var(--orange)", tooltip:"Win rate on round 2 after losing ATK pistol"  },
                  { label:"DEF Eco WR %",      won:ecoDefWon,     total:ecoDefTotal,     color:"var(--orange)", tooltip:"Win rate on round 14 after losing DEF pistol"  },
                ].map(({ label, won, total:t, color, tooltip }) => (
                  <div key={label} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:3 }}>
                      <Tooltip text={tooltip}>
                        <span style={{ borderBottom:"1px dashed var(--b3)", cursor:"help" }}>{label}</span>
                      </Tooltip>
                    </div>
                    <div className="bc" style={{ fontSize:22, fontWeight:900, color, lineHeight:1 }}>{pct(won,t)}</div>
                    <div style={{ fontSize:10, color:"var(--t3)", marginTop:3 }}>{won}W · {t} total</div>
                    <div style={{ marginTop:6, height:4, background:"var(--s3)", borderRadius:2, overflow:"hidden" }}>
                      <div style={{ width:`${t>0?won/t*100:0}%`, height:"100%", background:color, borderRadius:2 }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Win Rate by Map */}
          <div className="card">
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:3, height:16, background:"var(--acc)", borderRadius:2 }}/>
              <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>{filterMap !== "All Maps" ? `WIN RATE · ${filterMap.toUpperCase()}` : "WIN RATE BY MAP"}</span>
            </div>
            {mapRows.length === 0 ? (
              <div style={{ color:"var(--t3)", fontSize:13 }}>No data for selected filters</div>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--b2)" }}>
                      {["Map","SP","W","L","Win%","Avg Score","ATK Pistol%","DEF Pistol%","ATK%","DEF%","FK%","FK WR%","ATK FK%","ATK FK WR%","DEF FK%","DEF FK WR%"].map(h=>(
                        <th key={h} style={{ padding:"5px 8px", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", textAlign:h==="Map"?"left":"center" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapRows.map(row => {
                      const wc = row.wr>=60?"var(--green)":row.wr>=50?"var(--orange)":"var(--red)";
                      const ac = v => { const n=parseInt(v); return isNaN(n)?"var(--t3)":n>=60?"var(--green)":n>=50?"var(--orange)":"var(--red)"; };
                      const fkPct     = pct(row.fkTotal, row.fkTotal+row.fdTotal);
                      const fkWrPct   = pct(row.fkWon, row.fkTotal);
                      const fkAtkPct  = pct(row.fkAtkTotal, row.fkAtkTotal+row.fdAtkTotal);
                      const fkAtkWrPct= pct(row.fkAtkWon, row.fkAtkTotal);
                      const fkDefPct  = pct(row.fkDefTotal, row.fkDefTotal+row.fdDefTotal);
                      const fkDefWrPct= pct(row.fkDefWon, row.fkDefTotal);
                      return (
                        <tr key={row.map} style={{ borderBottom:"1px solid var(--b1)", transition:"background 0.12s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"7px 8px", fontWeight:700 }}>{row.map}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:"var(--t3)", fontSize:12 }}>{row.sp}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:"var(--green)", fontWeight:700 }}>{row.w}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:"var(--red)",   fontWeight:700 }}>{row.l}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", fontWeight:800, color:wc }}>{row.wr}%</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"var(--t2)", whiteSpace:"nowrap" }}>{fmtAvg(row.avgOurs)} – {fmtAvg(row.avgTheirs)}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(row.atkPistol) }}>{row.atkPistol}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(row.defPistol) }}>{row.defPistol}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(row.atk) }}>{row.atk}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(row.def) }}>{row.def}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkPct), borderLeft:"1px solid var(--b2)" }}>{fkPct}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkWrPct), fontWeight:700 }}>{fkWrPct}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkAtkPct), borderLeft:"1px solid var(--b2)" }}>{fkAtkPct}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkAtkWrPct), fontWeight:700 }}>{fkAtkWrPct}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkDefPct), borderLeft:"1px solid var(--b2)" }}>{fkDefPct}</td>
                          <td style={{ padding:"7px 8px", textAlign:"center", color:ac(fkDefWrPct), fontWeight:700 }}>{fkDefWrPct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Postplant + Trading side by side */}
          {(mapRows.some(r => Object.keys(r.ourSites).length > 0 || Object.keys(r.oppSites).length > 0) || mapRows.some(r => r.tft+r.tfd > 0)) && (
            <div style={{ gridColumn:"1 / -1", display:"flex", gap:12, alignItems:"flex-start" }}>

              {/* Postplant Stats by Map */}
              {mapRows.some(r => Object.keys(r.ourSites).length > 0 || Object.keys(r.oppSites).length > 0) && (
                <div className="card" style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <div style={{ width:3, height:16, background:"var(--orange)", borderRadius:2 }}/>
                    <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>{filterMap !== "All Maps" ? `POSTPLANT · ${filterMap.toUpperCase()}` : "POSTPLANT BY MAP"}</span>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid var(--b2)" }}>
                          {["Map","ATK Plant Rate","Our Site Split","DEF Plant Rate","Opp Site Split"].map(h=>(
                            <th key={h} style={{ padding:"5px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", textAlign:h==="Map"?"left":"center" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mapRows.map(row => {
                          const siteColor = s => s==="A"?"#a78bfa":s==="B"?"#f87171":s==="C"?"#34d399":"#fb923c";
                          const totalOurPlants = Object.values(row.ourSites).reduce((a,v)=>a+v.count,0);
                          const totalOppPlants = Object.values(row.oppSites).reduce((a,v)=>a+v.count,0);
                          const atkPlantRatePct = row.atkRoundsTotal > 0 ? Math.round(row.atkPlantsTotal/row.atkRoundsTotal*100) : null;
                          const defPlantRatePct = row.defRoundsTotal > 0 ? Math.round(row.defPlantsAllowed/row.defRoundsTotal*100) : null;
                          return (
                            <tr key={row.map} style={{ borderBottom:"1px solid var(--b1)", verticalAlign:"top" }}
                              onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{ padding:"9px 10px", fontWeight:700 }}>{row.map}<div style={{ fontSize:10, color:"var(--t3)" }}>{row.sp} games</div></td>
                              {/* ATK Plant Rate */}
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                {atkPlantRatePct !== null ? (
                                  <>
                                    <div className="bc" style={{ fontSize:20, fontWeight:900, color:atkPlantRatePct>=50?"var(--orange)":"var(--t2)" }}>{atkPlantRatePct}%</div>
                                    <div style={{ fontSize:10, color:"var(--t3)" }}>{row.atkPlantsTotal} plants / {row.atkRoundsTotal} atk rounds</div>
                                  </>
                                ) : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                              </td>
                              {/* Our site split + WR */}
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                {totalOurPlants > 0
                                  ? Object.entries(row.ourSites).sort((a,b)=>b[1].count-a[1].count).map(([s,v])=>(
                                      <div key={s} style={{ fontSize:11, marginBottom:3 }}>
                                        <span style={{ fontWeight:800, color:siteColor(s) }}>{s}:</span>
                                        <span style={{ color:"var(--t3)", marginLeft:4 }}>{Math.round(v.count/totalOurPlants*100)}%</span>
                                        <span style={{ color:"var(--t3)", marginLeft:4 }}>WR {pct(v.won,v.count)}</span>
                                      </div>
                                    ))
                                  : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>
                                }
                              </td>
                              {/* DEF Plant Rate Allowed */}
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                {defPlantRatePct !== null ? (
                                  <>
                                    <div className="bc" style={{ fontSize:20, fontWeight:900, color:defPlantRatePct>=50?"var(--red)":"var(--green)" }}>{defPlantRatePct}%</div>
                                    <div style={{ fontSize:10, color:"var(--t3)" }}>{row.defPlantsAllowed} allowed / {row.defRoundsTotal} def rounds</div>
                                  </>
                                ) : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                              </td>
                              {/* Opp site split + retake WR */}
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                {totalOppPlants > 0
                                  ? Object.entries(row.oppSites).sort((a,b)=>b[1].count-a[1].count).map(([s,v])=>(
                                      <div key={s} style={{ fontSize:11, marginBottom:3 }}>
                                        <span style={{ fontWeight:800, color:siteColor(s) }}>{s}:</span>
                                        <span style={{ color:"var(--t3)", marginLeft:4 }}>{Math.round(v.count/totalOppPlants*100)}%</span>
                                        <span style={{ color:"var(--t3)", marginLeft:4 }}>retake {pct(v.count-v.theyWon,v.count)}</span>
                                      </div>
                                    ))
                                  : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Trading Stats by Map */}
              {mapRows.some(r => r.tft+r.tfd > 0) && (
                <div className="card" style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <div style={{ width:3, height:16, background:"var(--blue)", borderRadius:2 }}/>
                    <span className="bc" style={{ fontSize:15, fontWeight:800, letterSpacing:"0.06em" }}>{filterMap !== "All Maps" ? `TRADING · ${filterMap.toUpperCase()}` : "TRADING BY MAP"}</span>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid var(--b2)" }}>
                          {["Map","Trade Rate","Traded / First Deaths"].map(h=>(
                            <th key={h} style={{ padding:"5px 10px", fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", textAlign:h==="Map"?"left":"center" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mapRows.map(row => {
                          const tradeTotal = row.tft + row.tfd;
                          const tradeRate = tradeTotal > 0 ? Math.round(row.tft/tradeTotal*100) : null;
                          return (
                            <tr key={row.map} style={{ borderBottom:"1px solid var(--b1)", verticalAlign:"top" }}
                              onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{ padding:"9px 10px", fontWeight:700 }}>{row.map}<div style={{ fontSize:10, color:"var(--t3)" }}>{row.sp} games</div></td>
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                {tradeRate !== null
                                  ? <><div className="bc" style={{ fontSize:20, fontWeight:900, color:tradeRate>=50?"var(--green)":"var(--red)" }}>{tradeRate}%</div><div style={{ fontSize:10, color:"var(--t3)" }}>of FB deaths traded</div></>
                                  : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>
                                }
                              </td>
                              <td style={{ padding:"9px 10px", textAlign:"center" }}>
                                <div className="bc" style={{ fontSize:20, fontWeight:900, color:"var(--t1)" }}>
                                  <span style={{ color:"var(--green)" }}>{row.tft}</span>
                                  <span style={{ color:"var(--t3)", fontWeight:400, fontSize:16, margin:"0 4px" }}>/</span>
                                  <span style={{ color:"var(--t1)" }}>{tradeTotal}</span>
                                </div>
                                <div style={{ fontSize:10, color:"var(--t3)" }}>first deaths traded</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Player Profile Tab ── */
function PlayerProfileTab({ scrims, loading }) {
  const [selPlayerName, setSelPlayerName] = useState(null);
  const [lineMetric, setLineMetric]       = useState("acs");
  const [scatterMode, setScatterMode]     = useState("FK vs FD");
  const profileRef = useRef(null);
  const [rosterPlayers, setRosterPlayers] = useState([]);

  useEffect(() => { api.get("/api/players").then(d=>{ if(Array.isArray(d)) setRosterPlayers(d); }).catch(()=>{}); }, []);

  // Build alias → canonical IGN map (same logic as PlayerStatsTab)
  const aliasToCanonical = React.useMemo(() => {
    const map = {};
    rosterPlayers.forEach(p => {
      const canonical = (p.ign||p.name||"").toLowerCase().trim();
      if (!canonical) return;
      const aliases = (() => { try { return Array.isArray(p.aliases)?p.aliases:JSON.parse(p.aliases||"[]"); } catch { return []; } })();
      aliases.forEach(a => { const ak = a.toLowerCase().trim(); if (ak) map[ak] = canonical; });
    });
    return map;
  }, [rosterPlayers]);

  const resolveAlias = (name) => {
    const k = (name||"").toLowerCase().trim();
    const canonical = aliasToCanonical[k];
    if (!canonical) return name;
    // Return the display name of the canonical player from roster
    const rp = rosterPlayers.find(p => (p.ign||p.name||"").toLowerCase().trim() === canonical);
    return rp ? (rp.ign||rp.name) : name;
  };

  const allEntries = React.useMemo(() => {
    const entries = [];
    scrims.forEach(s => {
      const ps = (() => { try { return Array.isArray(s.player_stats)?s.player_stats:JSON.parse(s.player_stats||"[]"); } catch { return []; } })();
      const detail = (() => { try { const d=s.round_detail; return Array.isArray(d)?d:JSON.parse(d||"[]"); } catch { return []; } })();
      // Compute KAST per player from round_detail
      const kastMap = {};
      if (detail.length) {
        ps.forEach(p => { const k = p.puuid||p.name||""; if(k) kastMap[k] = new Set(); });
        detail.forEach((rd, ri) => {
          const kills = rd.kills||[];
          ps.forEach(p => {
            const k = p.puuid||p.name||""; if(!k||!kastMap[k]) return;
            const pIs = (pf,nf) => pf&&p.puuid ? pf===p.puuid : (nf===p.name||(nf&&p.name&&nf.split("#")[0]===p.name.split("#")[0]));
            const gotKill   = kills.some(kl=>pIs(kl.killerPuuid,kl.killerName));
            const gotAssist = kills.some(kl=>(kl.assistants||[]).some(a=>a===p.name||(a&&p.name&&a.split("#")[0]===p.name.split("#")[0])));
            const survived  = !kills.some(kl=>pIs(kl.victimPuuid,kl.victimName));
            let traded=false;
            if(!survived){ const myD=kills.find(kl=>pIs(kl.victimPuuid,kl.victimName)); if(myD) traded=kills.some(kl=>{ const kd=myD.killerPuuid?(kl.victimPuuid===myD.killerPuuid):(kl.victimName===myD.killerName); return kd&&Math.abs((kl.time||0)-(myD.time||0))<=1500; }); }
            if(gotKill||gotAssist||survived||traded) kastMap[k].add(ri);
          });
        });
      }
      ps.forEach(p => {
        if(p.name && p.side==="blue") {
          const k = p.puuid||p.name||"";
          const rp = p.roundsPlayed||detail.length||1;
          const kastPct = kastMap[k] ? Math.round((kastMap[k].size/rp)*100) : null;
          const resolvedName = resolveAlias(p.name);
          if (!resolvedName || resolvedName === "#" || resolvedName.startsWith("#")) return;
          entries.push({ ...p, name: resolvedName, scrimId:s.id, scrimDate:s.date, scrimMap:s.map, scrimWon:(s.res==="win"||s.res==="W"), kastPct });
        }
      });
    });
    return entries;
  }, [scrims, aliasToCanonical]);

  const playerNames = [...new Set(allEntries.map(e=>e.name))].sort();
  const playerEntries = selPlayerName ? allEntries.filter(e=>e.name===selPlayerName) : [];

  const agg = React.useMemo(() => {
    if (!playerEntries.length) return null;
    const n = playerEntries.length;
    const sumK = (key) => playerEntries.reduce((a,e)=>a+(Number(e[key])||0),0);
    const avgK = (key) => Math.round((sumK(key)/n)*100)/100;
    const totalKills   = sumK("kills");
    const totalDeaths  = sumK("deaths");
    const totalAssists = sumK("assists");
    const totalFk = playerEntries.reduce((a,e)=>a+(Number(e.tfk??e.firstBloods??e.fk)||0),0);
    const totalFd = playerEntries.reduce((a,e)=>a+(Number(e.tfd??e.firstDeaths??e.fd)||0),0);
    const kastEntries = playerEntries.filter(e=>e.kastPct!=null);
    const avgKast = kastEntries.length ? Math.round(kastEntries.reduce((a,e)=>a+e.kastPct,0)/kastEntries.length) : null;
    return {
      n,
      totalKills, totalDeaths, totalAssists, totalFk, totalFd,
      fkfd: totalFd>0 ? Math.round(totalFk/totalFd*100)/100 : totalFk,
      avgAcs:    Math.round(sumK("acs")/n),
      avgKills:  avgK("kills"),
      avgDeaths: avgK("deaths"),
      avgAssists:avgK("assists"),
      avgAdr:    Math.round(sumK("adr")/n) || 0,
      kd: totalDeaths>0 ? Math.round(totalKills/totalDeaths*100)/100 : totalKills,
      fkpr: Math.round(totalFk/n*100)/100,
      fdpr: Math.round(totalFd/n*100)/100,
      kpr:  avgK("kills"),
      dpr:  avgK("deaths"),
      apr:  avgK("assists"),
      wins: playerEntries.filter(e=>e.scrimWon).length,
      avgKast,
    };
  }, [selPlayerName, scrims]);

  const teamAgg = React.useMemo(() => {
    if (!allEntries.length) return null;
    const n = allEntries.length;
    const avg = k => Math.round(allEntries.reduce((a,e)=>a+(Number(e[k])||0),0)/n*100)/100;
    const totalFk = allEntries.reduce((a,e)=>a+(Number(e.tfk??e.firstBloods??e.fk)||0),0);
    const totalFd = allEntries.reduce((a,e)=>a+(Number(e.tfd??e.firstDeaths??e.fd)||0),0);
    const kastEntries = allEntries.filter(e=>e.kastPct!=null);
    const avgKast = kastEntries.length ? Math.round(kastEntries.reduce((a,e)=>a+e.kastPct,0)/kastEntries.length) : null;
    return {
      avgAcs:Math.round(avg("acs")), avgKills:avg("kills"), avgDeaths:avg("deaths"), avgAssists:avg("assists"), avgAdr:Math.round(avg("adr"))||0,
      fkfd: totalFd>0 ? Math.round(totalFk/totalFd*100)/100 : totalFk,
      avgKast,
    };
  }, [allEntries]);

  const scrimTimeline = playerEntries.map((e,i) => ({
    label: `S${i+1}`,
    acs:  e.acs||0,
    adr:  e.adr||0,
    kpr:  e.kills||0,
    dpr:  e.deaths||0,
    apr:  e.assists||0,
    fkpr: Number(e.tfk??e.firstBloods??e.fk)||0,
    fdpr: Number(e.tfd??e.firstDeaths??e.fd)||0,
    map:  e.scrimMap||e.map||"—",
    won:  e.scrimWon,
    opp:  e.opp||"—",
    score: e.score||"—",
    result: e.scrimWon ? "Win" : "Loss",
  }));

  const scatterData = React.useMemo(() => allEntries.map(e => ({
    name: e.name,
    fk: Number(e.tfk??e.firstBloods??e.fk)||0,
    fd: Number(e.tfd??e.firstDeaths??e.fd)||0,
    kpr: e.kills||0,
    dpr: e.deaths||0,
    isSelected: e.name===selPlayerName,
    opp: e.opp||"—",
    map: e.map||"—",
    score: e.score||"—",
    acs: e.acs||e.avgAcs||"—",
    result: e.res||e.result||"—",
  })), [allEntries, selPlayerName]);

  // SVG Radar
  const RadarChart = ({ player, team }) => {
    if (!player || !team) return null;
    const metrics = [
      { label:"ACS",        pv:Math.min((player.avgAcs||0)/400,1),                              tv:Math.min((team.avgAcs||0)/400,1)                              },
      { label:"KAST%",      pv:player.avgKast!=null?player.avgKast/100:null,                    tv:team.avgKast!=null?team.avgKast/100:null                      },
      { label:"Avg Kills",  pv:Math.min((player.avgKills||0)/25,1),                             tv:Math.min((team.avgKills||0)/25,1)                             },
      { label:"Survival",    pv:1-Math.min((player.avgDeaths||0)/25,1),                          tv:1-Math.min((team.avgDeaths||0)/25,1)                          },
      { label:"Avg Assists",pv:Math.min((player.avgAssists||0)/10,1),                           tv:Math.min((team.avgAssists||0)/10,1)                           },
      { label:"FK/FD",      pv:Math.min(Math.max(((player.fkfd||0)+2)/4,0),1),                  tv:Math.min(Math.max(((team.fkfd||0)+2)/4,0),1)                  },
    ].filter(m => m.pv !== null && m.tv !== null);
    const N=metrics.length, cx=160, cy=150, R=100;
    const ang = i => (i/N)*2*Math.PI - Math.PI/2;
    const pt  = (i,r) => [cx+r*Math.cos(ang(i)), cy+r*Math.sin(ang(i))];
    const poly = vals => vals.map((v,i)=>pt(i,v*R).join(",")).join(" ");
    return (
      <svg viewBox="0 0 320 300" style={{ width:"100%", maxWidth:300 }}>
        {[0.25,0.5,0.75,1].map(t=>(
          <polygon key={t} points={metrics.map((_,i)=>pt(i,t*R).join(",")).join(" ")} fill="none" stroke="var(--b2)" strokeWidth={t===1?1.5:0.7} opacity={0.6}/>
        ))}
        {metrics.map((_,i)=>(
          <line key={i} x1={cx} y1={cy} x2={pt(i,R)[0]} y2={pt(i,R)[1]} stroke="var(--b2)" strokeWidth={0.7} opacity={0.5}/>
        ))}
        <polygon points={poly(metrics.map(m=>m.tv))} fill="rgba(255,82,82,0.07)" stroke="var(--red)" strokeWidth={1.5} strokeDasharray="4 2"/>
        <polygon points={poly(metrics.map(m=>m.pv))} fill="rgba(212,255,30,0.12)" stroke="var(--acc)" strokeWidth={2}/>
        {metrics.map((m,i)=>{ const [x,y]=pt(i,m.pv*R); return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--acc)"/>; })}
        {metrics.map((m,i)=>{ const [x,y]=pt(i,R+18); return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fill="var(--t2)" fontFamily="'DIN Next LT Pro',sans-serif" fontWeight={600}>{m.label}</text>
        ); })}
        <circle cx={10} cy={285} r={4} fill="var(--acc)"/>
        <text x={18} y={289} fontSize={9} fill="var(--t2)" fontFamily="'DIN Next LT Pro',sans-serif">Player</text>
        <circle cx={68} cy={285} r={4} fill="var(--red)"/>
        <text x={76} y={289} fontSize={9} fill="var(--t3)" fontFamily="'DIN Next LT Pro',sans-serif">Team Avg</text>
      </svg>
    );
  };

  // SVG Scatter
  const PLAYER_COLORS = ["#4fc3f7","#69f0ae","#ffab40","#b39ddb","#f48fb1","#80cbc4","#fff176","#ff8a65"];
  const ScatterPlot = ({ data, xKey, yKey, xLabel, yLabel }) => {
    const [tip, setTip] = React.useState(null); // { d, x, y }
    if (!data.length) return null;
    // Assign a stable color per player name
    const playerNames = [...new Set(data.map(d=>d.name))].sort();
    const playerColor = name => PLAYER_COLORS[playerNames.indexOf(name) % PLAYER_COLORS.length];
    const xs=data.map(d=>d[xKey]), ys=data.map(d=>d[yKey]);
    const xMax=Math.max(...xs,1), yMax=Math.max(...ys,1);
    const W=280,H=200,PAD=38;
    const px = v => PAD+(v/xMax)*(W-PAD*2);
    const py = v => H-PAD-(v/yMax)*(H-PAD*2);
    const resColor = r => {
      const v = (r||"").toLowerCase();
      if (v==="win"||v==="w") return "var(--green)";
      if (v==="loss"||v==="l") return "var(--red)";
      return "var(--t3)";
    };
    const resLabel = r => {
      const v = (r||"").toLowerCase();
      if (v==="win"||v==="w") return "Win";
      if (v==="loss"||v==="l") return "Loss";
      if (v==="draw"||v==="d") return "Draw";
      return r||"—";
    };
    return (
      <div style={{ position:"relative", display:"inline-block", width:"100%", maxWidth:310 }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", display:"block" }}
          onMouseLeave={()=>setTip(null)}>
          {[0,0.25,0.5,0.75,1].map(t=>(
            <React.Fragment key={t}>
              <line x1={PAD} y1={py(t*yMax)} x2={W-PAD} y2={py(t*yMax)} stroke="var(--b2)" strokeWidth={0.5} opacity={0.5}/>
              <line x1={px(t*xMax)} y1={PAD} x2={px(t*xMax)} y2={H-PAD} stroke="var(--b2)" strokeWidth={0.5} opacity={0.5}/>
              <text x={PAD-3} y={py(t*yMax)} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="var(--t3)">{Math.round(t*yMax)}</text>
              <text x={px(t*xMax)} y={H-PAD+10} textAnchor="middle" fontSize={7} fill="var(--t3)">{Math.round(t*xMax)}</text>
            </React.Fragment>
          ))}
          <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke="var(--b3)" strokeWidth={1}/>
          <line x1={PAD} y1={PAD}   x2={PAD}   y2={H-PAD}  stroke="var(--b3)" strokeWidth={1}/>
          {data.map((d,i)=>(
            <circle key={i} cx={px(d[xKey])} cy={py(d[yKey])} r={d.isSelected?7:5}
              fill={d.isSelected?"var(--acc)":playerColor(d.name)}
              stroke={d.isSelected?"#fff":"rgba(0,0,0,0.3)"} strokeWidth={d.isSelected?2:1} opacity={d.isSelected?1:0.75}
              style={{ cursor:"pointer" }}
              onMouseEnter={e=>setTip({ d, svgX: px(d[xKey]), svgY: py(d[yKey]), clientX: e.clientX, clientY: e.clientY })}
            />
          ))}
          <text x={W/2} y={H-3} textAnchor="middle" fontSize={8} fill="var(--t3)">{xLabel}</text>
          <text x={9} y={H/2} textAnchor="middle" fontSize={8} fill="var(--t3)" transform={`rotate(-90,9,${H/2})`}>{yLabel}</text>
        </svg>
        {tip && (
          <div style={{
            position:"absolute", left: `${(tip.svgX/W)*100}%`, top: `${(tip.svgY/H)*100}%`,
            transform:"translate(-50%, calc(-100% - 10px))",
            background:"var(--s1)", border:"1px solid var(--b2)", borderRadius:8,
            padding:"8px 12px", pointerEvents:"none", zIndex:99, minWidth:140,
            boxShadow:"0 4px 20px rgba(0,0,0,0.5)", fontSize:11, lineHeight:1.7,
          }}>
            <div style={{ fontWeight:800, color:"var(--t1)", marginBottom:4 }}>{tip.d.name.split("#")[0]}</div>
            <div><span style={{ color:"var(--t3)" }}>vs </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.opp}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Map </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.map}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Score </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.score}</span></div>
            <div><span style={{ color:"var(--t3)" }}>ACS </span><span style={{ color:"var(--acc)", fontWeight:700 }}>{tip.d.acs}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Result </span><span style={{ color:resColor(tip.d.result), fontWeight:700 }}>{resLabel(tip.d.result)}</span></div>
          </div>
        )}
      </div>
    );
  };

  // SVG Line
  const LineChart = ({ data, yKey, yLabel="ACS", color="var(--acc)" }) => {
    const [tip, setTip] = React.useState(null);
    if (data.length < 2) return <div style={{ color:"var(--t3)", fontSize:12, padding:"20px 0" }}>Need at least 2 scrims for a trend line</div>;
    const vals=data.map(d=>d[yKey]);
    const fixedScales = { acs:[0,500], kpr:[0,40], dpr:[0,40], apr:[0,20], fkpr:[0,10], fdpr:[0,10] };
    const scale = fixedScales[yKey];
    const yMin = scale ? scale[0] : Math.min(...vals)*0.85;
    const yMax = scale ? scale[1] : (Math.max(...vals)*1.1||1);
    const W=460,H=120,PL=36,PR=10,PT=10,PB=28;
    const pw = i => PL+(i/(data.length-1))*(W-PL-PR);
    const ph = v => PT+(1-(v-yMin)/(yMax-yMin||1))*(H-PT-PB);
    const pts = data.map((d,i)=>`${pw(i)},${ph(d[yKey])}`).join(" ");
    const fillPts = `${PL},${H-PB} ${pts} ${pw(data.length-1)},${H-PB}`;
    return (
      <div style={{ position:"relative", width:"100%" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", maxWidth:"100%", display:"block" }}
          onMouseLeave={()=>setTip(null)}>
          <defs>
            <linearGradient id="lcGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0,0.25,0.5,0.75,1].map(t=>{
            const v=yMin+t*(yMax-yMin);
            return <React.Fragment key={t}>
              <line x1={PL} y1={ph(v)} x2={W-PR} y2={ph(v)} stroke="var(--b2)" strokeWidth={0.5} opacity={0.5}/>
              <text x={PL-4} y={ph(v)} textAnchor="end" dominantBaseline="middle" fontSize={7} fill="var(--t3)">{Math.round(v*10)/10}</text>
            </React.Fragment>;
          })}
          <polygon points={fillPts} fill="url(#lcGrad)"/>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
          {data.map((d,i)=>(
            <circle key={i} cx={pw(i)} cy={ph(d[yKey])} r={5}
              fill={d.won?"var(--green)":"var(--red)"} stroke={color} strokeWidth={1.5}
              style={{ cursor:"pointer" }}
              onMouseEnter={()=>setTip({ d, svgX: pw(i), svgY: ph(d[yKey]) })}
            />
          ))}
          {data.map((d,i)=>(
            i%Math.max(1,Math.floor(data.length/8))===0
              ? <text key={i} x={pw(i)} y={H-4} textAnchor="middle" fontSize={7} fill="var(--t3)">{d.label}</text>
              : null
          ))}
        </svg>
        {tip && (
          <div style={{
            position:"absolute",
            left:`${(tip.svgX/W)*100}%`, top:`${(tip.svgY/H)*100}%`,
            transform:"translate(-50%, calc(-100% - 10px))",
            background:"var(--s1)", border:"1px solid var(--b2)", borderRadius:8,
            padding:"8px 12px", pointerEvents:"none", zIndex:99, minWidth:140,
            boxShadow:"0 4px 20px rgba(0,0,0,0.5)", fontSize:11, lineHeight:1.7,
          }}>
            <div style={{ fontWeight:800, color:"var(--t1)", marginBottom:4 }}>{tip.d.label}</div>
            <div><span style={{ color:"var(--t3)" }}>vs </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.opp}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Map </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.map}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Score </span><span style={{ color:"var(--t2)", fontWeight:600 }}>{tip.d.score}</span></div>
            <div><span style={{ color:"var(--t3)" }}>{yLabel} </span><span style={{ color:"var(--acc)", fontWeight:700 }}>{tip.d[yKey]}</span></div>
            <div><span style={{ color:"var(--t3)" }}>Result </span><span style={{ color:tip.d.won?"var(--green)":"var(--red)", fontWeight:700 }}>{tip.d.result}</span></div>
          </div>
        )}
      </div>
    );
  };

  const [sortKey, setSortKey]   = useState("avgAcs");
  const [sortDir, setSortDir]   = useState(-1);

  // Build aggregated per-player stats from allEntries (alias-merged)
  const allPlayerStats = React.useMemo(() => {
    const agg = {};
    allEntries.forEach(e => {
      if (!agg[e.name]) agg[e.name] = { name:e.name, agent:e.agent, games:0, totalAcs:0, totalKills:0, totalDeaths:0, totalAssists:0, totalHs:0, hsGames:0, totalFb:0, totalClutch:0 };
      const s = agg[e.name];
      s.games++;
      s.totalAcs     += Number(e.acs)||0;
      s.totalKills   += Number(e.kills)||0;
      s.totalDeaths  += Number(e.deaths)||0;
      s.totalAssists += Number(e.assists)||0;
      s.totalFb      += Number(e.tfk??e.firstBloods??e.fk)||0;
      s.totalClutch  += Number(e.clutchWon)||0;
      if (e.hsRate != null) { s.totalHs += Number(e.hsRate)||0; s.hsGames++; }
      if (e.agent) s.agent = e.agent;
    });
    return Object.values(agg).map(s => ({
      ...s,
      avgAcs:    s.games ? Math.round(s.totalAcs/s.games) : 0,
      avgKills:  s.games ? Math.round(s.totalKills/s.games*10)/10 : 0,
      avgDeaths: s.games ? Math.round(s.totalDeaths/s.games*10)/10 : 0,
      avgAssists:s.games ? Math.round(s.totalAssists/s.games*10)/10 : 0,
      kd: s.totalDeaths>0 ? Math.round(s.totalKills/s.totalDeaths*100)/100 : s.totalKills,
      avgHs: s.hsGames>0 ? Math.round(s.totalHs/s.hsGames) : null,
    })).sort((a,b) => sortDir*(( a[sortKey]??-Infinity) < (b[sortKey]??-Infinity) ? -1 : 1));
  }, [allEntries, sortKey, sortDir]);

  const SortTh = ({ label, k, right }) => (
    <th style={{ textAlign:right?"right":"left", cursor:"pointer", userSelect:"none", whiteSpace:"nowrap", padding:"8px 10px" }}
      onClick={()=>{ if(sortKey===k) setSortDir(d=>d*-1); else { setSortKey(k); setSortDir(-1); } }}>
      {label}{sortKey===k?(sortDir===-1?" ↓":" ↑"):""}
    </th>
  );
  const scatterOpts = {
    "FK vs FD": { x:"fk",  y:"fd",  xl:"First Kills",  yl:"First Deaths" },
    "K vs D":   { x:"kpr", y:"dpr", xl:"Kills",         yl:"Deaths"       },
  };
  const lineOpts = [
    { key:"acs",  label:"ACS" },
    { key:"kpr",  label:"Kills Per Game" },
    { key:"dpr",  label:"Deaths Per Game" },
    { key:"apr",  label:"Assists Per Game" },
    { key:"fkpr", label:"First Kills" },
    { key:"fdpr", label:"First Deaths" },
  ];

  if (loading) return <div style={{ color:"var(--t3)", padding:40, textAlign:"center" }}>Loading…</div>;
  if (playerNames.length===0) return (
    <div className="card" style={{ textAlign:"center", padding:"60px 20px", color:"var(--t3)", tooltip:"Round winrate after giving a true first death on defence" }}>
      <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
      <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No player stats yet</div>
      <div style={{ fontSize:13 }}>Import scrims with JSON files to see player profiles</div>
    </div>
  );

  return (
    <div>
      {/* ── Player Stats Notice ── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 14px", marginBottom:16, background:"rgba(79,195,247,0.08)", border:"1px solid rgba(79,195,247,0.25)", borderRadius:8, color:"var(--blue)", fontSize:12 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0 }}>
          <circle cx="8" cy="8" r="7.5" stroke="#4fc3f7" strokeOpacity="0.7"/>
          <path d="M8 7v5" stroke="#4fc3f7" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="8" cy="5" r="0.75" fill="#4fc3f7"/>
        </svg>
        <span>Player stats use imported games only. Manual scrims are not included.</span>
      </div>
      {/* ── All Players Stats Table ── */}
      {allPlayerStats.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"auto", marginBottom:20 }}>
          <table className="tbl" style={{ minWidth:720 }}>
            <thead>
              <tr>
                <SortTh label="Player" k="name"/>
                <SortTh label="Games" k="games" right/>
                <SortTh label="Avg ACS" k="avgAcs" right/>
                <SortTh label="Avg K" k="avgKills" right/>
                <SortTh label="Avg D" k="avgDeaths" right/>
                <SortTh label="Avg A" k="avgAssists" right/>
                <SortTh label="K/D" k="kd" right/>
                <SortTh label="HS%" k="avgHs" right/>
                <SortTh label="FK" k="totalFb" right/>
                <SortTh label="Clutch" k="totalClutch" right/>
                <th style={{ width:28 }}/>
              </tr>
            </thead>
            <tbody>
              {allPlayerStats.map(p => (
                <tr key={p.name} onClick={()=>{ const next = p.name===selPlayerName?null:p.name; setSelPlayerName(next); if(next) setTimeout(()=>profileRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50); }}
                  style={{ cursor:"pointer", background: selPlayerName===p.name?"rgba(212,255,30,0.06)":"", transition:"background 0.12s" }}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <AgentBadge name={p.agent} size={24}/>
                      <span className="mono" style={{ fontSize:12 }}>{p.name.split("#")[0]}</span>
                    </div>
                  </td>
                  <td style={{ textAlign:"right", color:"var(--t3)", fontSize:12 }}>{p.games}</td>
                  <td style={{ textAlign:"right", fontWeight:700, color:"var(--acc)" }}>{p.avgAcs}</td>
                  <td style={{ textAlign:"right" }}>{p.avgKills}</td>
                  <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.avgDeaths}</td>
                  <td style={{ textAlign:"right", color:"var(--t3)" }}>{p.avgAssists}</td>
                  <td style={{ textAlign:"right", fontWeight:600, color:p.kd>=1?"var(--green)":"var(--red)" }}>{p.kd}</td>
                  <td style={{ textAlign:"right" }}>{p.avgHs!=null?`${p.avgHs}%`:"—"}</td>
                  <td style={{ textAlign:"right", color:p.totalFb>0?"var(--green)":"var(--t3)" }}>{p.totalFb||"—"}</td>
                  <td style={{ textAlign:"right", color:p.totalClutch>0?"var(--green)":"var(--t3)" }}>{p.totalClutch||"—"}</td>
                  <td style={{ textAlign:"center", color:"var(--t3)", fontSize:16, paddingRight:8, opacity:0.6 }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!selPlayerName ? (
        <div ref={profileRef} style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:14, padding:"40px 48px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:32, position:"relative", overflow:"hidden" }}>
          {/* subtle bg glow */}
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 50%, rgba(179,157,219,0.07) 0%, transparent 60%)", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 80% 50%, rgba(179,157,219,0.05) 0%, transparent 60%)", pointerEvents:"none" }}/>
          {/* Left icon */}
          <img src="/icon_player.png" alt="" style={{ flexShrink:0, width:110, height:110, borderRadius:20, objectFit:"cover" }}/>
          {/* Centre text */}
          <div style={{ flex:1 }}>
            <div className="bc" style={{ fontSize:22, fontWeight:900, letterSpacing:"0.06em", color:"var(--t1)", marginBottom:10 }}>PLAYER PROFILE</div>
            <div style={{ fontSize:13, color:"var(--t3)", lineHeight:1.6, maxWidth:480 }}>
              Select a player from the table above to view detailed performance, map breakdowns, agent usage and match history.
            </div>
          </div>
          {/* Right icon */}
          <img src="/icon_chart.png" alt="" style={{ flexShrink:0, width:110, height:110, borderRadius:20, objectFit:"cover" }}/>
        </div>
      ) : agg && (
        <div ref={profileRef} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

          {/* LEFT — stat blocks */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Overall Totals */}
            <div className="card">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:3, height:14, background:"var(--acc)", borderRadius:2 }}/>
                <span className="bc" style={{ fontSize:14, fontWeight:800, letterSpacing:"0.06em" }}>OVERALL TOTALS</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {[
                  { l:"KILLS",   v:agg.totalKills,   c:"var(--green)"  },
                  { l:"DEATHS",  v:agg.totalDeaths,  c:"var(--red)"    },
                  { l:"ASSISTS", v:agg.totalAssists, c:"var(--t1)"     },
                  { l:"FK",      v:agg.totalFk,      c:"var(--orange)" },
                  { l:"FD",      v:agg.totalFd,      c:"var(--t2)"     },
                  { l:"FK/FD",   v:agg.fkfd,         c:agg.fkfd>=1?"var(--green)":"var(--red)" },
                ].map(({l,v,c})=>(
                  <div key={l} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:7, padding:"9px 12px" }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", marginBottom:3 }}>{l}</div>
                    <div className="bc" style={{ fontSize:22, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Averages */}
            <div className="card">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:3, height:14, background:"var(--blue)", borderRadius:2 }}/>
                <span className="bc" style={{ fontSize:14, fontWeight:800, letterSpacing:"0.06em" }}>AVERAGES</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {[
                  { l:"KILLS",   v:agg.avgKills,   c:"var(--t1)"     },
                  { l:"DEATHS",  v:agg.avgDeaths,  c:"var(--t3)"     },
                  { l:"ASSISTS", v:agg.avgAssists, c:"var(--t3)"     },
                  { l:"FK",      v:agg.fkpr,       c:"var(--orange)" },
                  { l:"FD",      v:agg.fdpr,       c:"var(--t3)"     },
                  { l:"ACS",     v:agg.avgAcs,     c:"var(--acc)"    },
                  { l:"ADR",     v:agg.avgAdr,     c:"var(--t2)"     },
                  { l:"KAST%",   v:"~70%",         c:"var(--green)"  },
                  { l:"FK/FD",   v:agg.fkfd,       c:agg.fkfd>=1?"var(--green)":"var(--red)" },
                ].map(({l,v,c})=>(
                  <div key={l} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:7, padding:"9px 12px" }}>
                    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--t3)", marginBottom:3 }}>{l}</div>
                    <div className="bc" style={{ fontSize:20, fontWeight:900, color:c, lineHeight:1 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT — charts */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Radar */}
            <div className="card">
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                <div style={{ width:3, height:14, background:"var(--acc)", borderRadius:2 }}/>
                <span className="bc" style={{ fontSize:13, fontWeight:800, letterSpacing:"0.06em" }}>PLAYER PROFILE VS. TEAM AVERAGE</span>
              </div>
              <div style={{ display:"flex", justifyContent:"center" }}>
                <RadarChart player={agg} team={teamAgg}/>
              </div>
            </div>

            {/* Scatter */}
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:3, height:14, background:"var(--blue)", borderRadius:2 }}/>
                  <span className="bc" style={{ fontSize:13, fontWeight:800, letterSpacing:"0.06em" }}>SCATTER PLOT</span>
                </div>
                <select value={scatterMode} onChange={e=>setScatterMode(e.target.value)} style={{ width:90, fontSize:11, padding:"3px 6px" }}>
                  {Object.keys(scatterOpts).map(k=><option key={k}>{k}</option>)}
                </select>
              </div>
              <ScatterPlot
                data={scatterData}
                xKey={scatterOpts[scatterMode].x} yKey={scatterOpts[scatterMode].y}
                xLabel={scatterOpts[scatterMode].xl} yLabel={scatterOpts[scatterMode].yl}
              />
              <div style={{ fontSize:10, color:"var(--t3)", marginTop:6, display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
                {[...new Set(scatterData.map(d=>d.name))].sort().map((name,i) => (
                  <span key={name} style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:PLAYER_COLORS[i%PLAYER_COLORS.length], display:"inline-block", flexShrink:0 }}/>
                    <span style={{ color: name===selPlayerName?"var(--acc)":"var(--t3)", fontWeight: name===selPlayerName?700:400 }}>{name.split("#")[0]}</span>
                  </span>
                ))}
                <span style={{ display:"flex", alignItems:"center", gap:4, marginLeft:4 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"var(--acc)", display:"inline-block", border:"1.5px solid #fff", flexShrink:0 }}/>
                  <span>selected player's dot</span>
                </span>
                <span style={{ color:"var(--t3)" }}>· each dot = one scrim</span>
              </div>
            </div>

            {/* Line chart */}
            <div className="card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:3, height:14, background:"var(--green)", borderRadius:2 }}/>
                  <span className="bc" style={{ fontSize:13, fontWeight:800, letterSpacing:"0.06em" }}>
                    {(lineOpts.find(o=>o.key===lineMetric)?.label||"").toUpperCase()} OVER TIME
                  </span>
                </div>
                <select value={lineMetric} onChange={e=>setLineMetric(e.target.value)} style={{ width:160, fontSize:11, padding:"3px 6px" }}>
                  {lineOpts.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ fontSize:10, color:"var(--t3)", marginBottom:6 }}>Last {scrimTimeline.length} scrims · green dot = win, red = loss</div>
              <LineChart data={scrimTimeline} yKey={lineMetric} yLabel={lineOpts.find(o=>o.key===lineMetric)?.label||"Value"} color="var(--acc)"/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ VOD REVIEW ════ */
function VodReview({ deepScrimId, onDeepLinkConsumed }) {
  const [vods, setVods]               = useState([]);
  const [sel, setSel]                 = useState(null);
  const [activeFolder, setActiveFolder] = useState("All");
  const [newForm, setNewForm]         = useState({ title:"", folder:"Scrims", url:"" });
  const [showNew, setShowNew]         = useState(false);
  const [urlEdit, setUrlEdit]         = useState(false);
  const [urlVal, setUrlVal]           = useState("");
  // annotation panel state
  const [showAddForm, setShowAddForm] = useState(false);
  const [tsForm, setTsForm]           = useState({ time:"", cat:"General", note:"" });
  const [editingTS, setEditingTS]     = useState(null); // {ti, note}
  const [replyOpen, setReplyOpen]     = useState(null);
  const [replyText, setReplyText]     = useState("");
  const [confirmTS, setConfirmTS]     = useState(null);
  const [confirmVod, setConfirmVod]   = useState(null);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [minimapZoom, setMinimapZoom] = useState(false);
  // ── Drawing overlay ──
  const [drawMode, setDrawMode]       = useState(false);
  const [overlayDrawing, setOverlayDrawing] = useState(null); // {drawing, time}
  const [drawTool, setDrawTool]       = useState("pen"); // pen | arrow | rect | text | eraser
  const [drawColor, setDrawColor]     = useState("#d4ff1e");
  const [drawSize, setDrawSize]       = useState(3);
  const canvasRef                     = useRef(null);
  const drawingRef                    = useRef({ active:false, startX:0, startY:0, snapshot:null });
  const [mmX, setMmX] = useState(0);  // % from left — minimap starts at x=0 — center of minimap region  
  const [mmY, setMmY] = useState(0);  // % from top  — minimap starts at y=0
  const [minimapPos, setMinimapPos]   = useState({ x: 75, y: 60 }); // percent from top-left of video
  const [mmDragging, setMmDragging]   = useState(false);
  const mmDragStart                   = useRef(null);
  const videoDivRef                   = useRef(null);
  const noteEditorRef                 = useRef(null);
  const editEditorRef                 = useRef(null);
  const iframeRef                     = useRef(null);
  const timeTickRef                   = useRef(null);
  const ytPlayerRef                   = useRef(null);
  const ytReadyRef                    = useRef(false);

  const FOLDERS   = ["All","Scrims","Opponent Analysis","Officials"];
  const TS_COLORS = { "General":"#8892aa", "Rotation":"#4fc3f7", "Util Usage":"#b39ddb", "Mistake":"#ff5252", "Win Cond":"#69f0ae" };

  const [vodsLoading, setVodsLoading] = useState(true);
  const [scrims, setScrims]     = useState([]);
  const [vodPlayers, setVodPlayers] = useState([]);
  const [genNoteText, setGenNoteText] = useState("");
  useEffect(()=>{
    Promise.all([
      api.get("/api/vods").then(d=>{ if(Array.isArray(d)){ const p=d.map(v=>({...v,ts:JSON.parse(v.ts||"[]"),genNote:v.gen_note||"",review_status:v.review_status||"not_reviewed"})); setVods(p); return p; } return []; }),
      api.get("/api/scrims").then(d=>{ if(Array.isArray(d)) { setScrims(d); return d; } return []; }),
    ]).then(([loadedVods, loadedScrims])=>{
      if(deepScrimId) {
        setActiveFolder("Scrims");
        const linked = loadedVods.find(v=>v.scrim_id && String(v.scrim_id)===String(deepScrimId));
        const scrim  = loadedScrims.find(s=>String(s.id)===String(deepScrimId));
        if(linked) {
          const withScrim = {...linked, _scrim:scrim||null};
          setSel(withScrim); setShowAddForm(false); setEditingTS(null); setReplyOpen(null);
          setGenNoteText(linked.genNote||"");
          setTimeout(()=>{ const vid=extractYouTubeId(linked.url||""); if(vid) initYTPlayer(vid); },80);
        } else if(scrim) {
          setSel({ _scrimOnly:true, _scrim:scrim, id:`scrim-${scrim.id}`, title:`vs ${scrim.opp}`, ts:[], genNote:"", url:"", review_status:"not_reviewed" });
          setShowAddForm(false); setEditingTS(null); setReplyOpen(null); setGenNoteText("");
          setTimeout(()=>{ setUrlVal(""); setUrlEdit(true); },80);
        }
        if(onDeepLinkConsumed) onDeepLinkConsumed();
      }
    }).finally(()=>setVodsLoading(false));
    api.get("/api/players").then(d=>{ if(Array.isArray(d)) setVodPlayers(d); }).catch(()=>{});
  },[]);

  // Load YouTube IFrame API script once
  useEffect(()=>{
    if(!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    // Poll current time from YT.Player instance
    timeTickRef.current = setInterval(()=>{
      try {
        if(ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
          const s = Math.floor(ytPlayerRef.current.getCurrentTime());
          const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
          setCurrentTime(h>0 ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`);
        }
      } catch{}
    }, 1000);
    return ()=>{ clearInterval(timeTickRef.current); };
  },[]);

  const filteredVods = activeFolder==="All" ? vods : vods.filter(v=>v.folder===activeFolder);

  const parseTime = str => {
    if(!str) return 0;
    const parts = str.replace(/\s/g,"").split(":").map(Number);
    if(parts.some(isNaN)) return 0;
    if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2];
    if(parts.length===2) return parts[0]*60+parts[1];
    return parts[0];
  };

  const extractYouTubeId = (url) => {
    if(!url) return "";
    // Already an embed URL (youtube.com/embed/ or youtube-nocookie.com/embed/)
    const embedMatch = url.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if(embedMatch) return embedMatch[1];
    try {
      const u = new URL(url);
      // youtu.be/ID
      if(u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
      if(u.hostname.includes("youtube.com")) {
        // Standard watch?v=ID (works for public, unlisted, logged-in)
        const v = u.searchParams.get("v");
        if(v) return v;
        // /live/ID
        if(u.pathname.startsWith("/live/")) return u.pathname.replace("/live/","").split("?")[0];
        // /shorts/ID
        if(u.pathname.startsWith("/shorts/")) return u.pathname.replace("/shorts/","").split("?")[0];
        // /v/ID
        if(u.pathname.startsWith("/v/")) return u.pathname.replace("/v/","").split("?")[0];
      }
    } catch{}
    // Fallback: try regex for any 11-char YouTube ID
    const m = url.match(/[?&]v=([A-Za-z0-9_-]{11})|youtu\.be\/([A-Za-z0-9_-]{11})|\/embed\/([A-Za-z0-9_-]{11})/);
    return m ? (m[1]||m[2]||m[3]) : "";
  };

  const toEmbedUrl = (url, startSec=0) => {
    if(!url) return "";
    const videoId = extractYouTubeId(url);
    // Use regular youtube.com/embed for unlisted video support (nocookie blocks some unlisted)
    if(videoId) return `https://www.youtube.com/embed/${videoId}?start=${startSec}&autoplay=1&rel=0&enablejsapi=1`;
    return url;
  };
  const toBaseEmbedUrl = url => { const id = extractYouTubeId(url); return id ? `https://www.youtube.com/embed/${id}?rel=0&enablejsapi=1` : url; };

  const seekTo = timeStr => {
    const sec = parseTime(timeStr);
    try {
      if(ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === "function") {
        ytPlayerRef.current.seekTo(sec, true);
        ytPlayerRef.current.playVideo();
      }
    } catch{}
  };

  const seekAndOverlay = (timeStr, drawing) => {
    const sec = parseTime(timeStr);
    try {
      if(ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === "function") {
        ytPlayerRef.current.seekTo(sec, true);
        ytPlayerRef.current.pauseVideo();
      }
    } catch{}
    setOverlayDrawing({ drawing, time: timeStr });
  };

  // Apply minimap zoom directly via DOM — React won't re-render wrapper after YT mutates it
  useEffect(() => {
    const wrapper = document.getElementById("yt-player-div")?.parentElement;
    if (!wrapper) return;
    wrapper.style.transition = "transform 0.35s cubic-bezier(0.4,0,0.2,1)";
    wrapper.style.transformOrigin = `${mmX}% ${mmY}%`;
    wrapper.style.transform = minimapZoom ? "scale(2.4)" : "scale(1)";
  // mmX/mmY from nudge controls override defaults
  }, [minimapZoom, mmX, mmY]);

  // Initialize or destroy YT.Player when sel changes
  const initYTPlayer = (videoId, startSec=0) => {
    // Destroy existing player
    try { if(ytPlayerRef.current) { ytPlayerRef.current.destroy(); ytPlayerRef.current = null; } } catch{}
    if(!videoId) return;
    const create = () => {
      try {
        ytPlayerRef.current = new window.YT.Player("yt-player-div", {
          videoId,
          playerVars: {
            autoplay: 1,
            start: startSec,
            rel: 0,
            modestbranding: 1,
            origin: window.location.origin || "https://localhost",
          },
          events: {
            onReady: e => { try { e.target.playVideo(); window._ytPlayer = e.target; } catch{} },
          }
        });
      } catch(err) { console.warn("YT.Player init failed", err); }
    };
    if(window.YT && window.YT.Player) {
      create();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if(prev) prev(); create(); };
    }
  };

  const saveVod = updated => {
    api.put(`/api/vods/${updated.id}`, { ...updated, ts:JSON.stringify(updated.ts), gen_note:updated.genNote||"", scrim_id:updated.scrim_id||null }).catch(()=>{});
    setVods(p=>p.map(v=>v.id===updated.id?updated:v));
    setSel(updated);
  };

  const addVod = () => {
    if(!newForm.title.trim()) return;
    const vid = extractYouTubeId(newForm.url);
    const embedUrl = vid ? `https://www.youtube.com/embed/${vid}?rel=0&enablejsapi=1` : (newForm.url||"");
    api.post("/api/vods", { title:newForm.title, folder:newForm.folder, url:embedUrl, ts:"[]" })
      .then(d=>{ const v={...d,ts:[],genNote:""}; setVods(p=>[...p,v]);
        setTimeout(()=>{ setSel(v); setGenNoteText(""); if(vid) initYTPlayer(vid); },80);
      })
      .catch(()=>{ const v={id:Date.now(),title:newForm.title,folder:newForm.folder,url:embedUrl,ts:[],genNote:""}; setVods(p=>[...p,v]);
        setTimeout(()=>{ setSel(v); if(vid) initYTPlayer(vid); },80);
      });
    setShowNew(false); setNewForm({ title:"", folder:"Scrims", url:"" });
  };

  const delVod = id => { api.delete(`/api/vods/${id}`).catch(()=>{}); setVods(p=>p.filter(v=>v.id!==id)); if(sel?.id===id) setSel(null); setConfirmVod(null); };

  const attachUrl = () => {
    if(!sel) return;
    const vid = extractYouTubeId(urlVal);
    const embed = vid ? `https://www.youtube.com/embed/${vid}?rel=0&enablejsapi=1` : urlVal;

    if(sel._scrimOnly) {
      // Create a brand new vod entry linked to this scrim
      const s = sel._scrim;
      api.post("/api/vods", { title:`vs ${s.opp}`, folder:"Scrims", url:embed, ts:"[]", scrim_id:s.id })
        .then(d=>{
          const v = {...d, ts:[], genNote:"", _scrim:s, scrim_id:s.id};
          setVods(p=>[...p,v]);
          setSel(v);
          setUrlEdit(false);
          setTimeout(()=>{ if(vid) initYTPlayer(vid); }, 100);
        })
        .catch(()=>{
          const v = { id:Date.now(), title:`vs ${s.opp}`, folder:"Scrims", url:embed, ts:[], genNote:"", _scrim:s, scrim_id:s.id };
          setVods(p=>[...p,v]);
          setSel({...sel, url:embed, _scrimOnly:false});
          setUrlEdit(false);
          setTimeout(()=>{ if(vid) initYTPlayer(vid); }, 100);
        });
    } else {
      saveVod({...sel, url:embed});
      setUrlEdit(false);
      setTimeout(()=>{ if(vid) initYTPlayer(vid); }, 100);
    }
  };

  // image paste helper
  const handleImgPaste = (e, ref) => {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(const item of items){
      if(item.type.startsWith("image/")){
        e.preventDefault();
        uploadImage(item.getAsFile()).then(url => document.execCommand("insertImage", false, url));
      }
    }
  };

  const addTimestamp = () => {
    if(!sel) return;
    const note = tsForm.note || "";
    if(!note.trim() && !tsForm.drawing) return;
    const time = tsForm.time || currentTime;
    const ts_entry = {time, cat:tsForm.cat, note, replies:[], ...(tsForm.drawing?{drawing:tsForm.drawing}:{})};
    const updated = {...sel, ts:[...sel.ts, ts_entry]};
    saveVod(updated);
    // fire mention notifications
    sendMentionNotifications(note, `VOD annotation: ${sel.title||""}`, vodPlayers);
    setShowAddForm(false);
    setTsForm({time:"", cat:"General", note:"", drawing:null});
    if(canvasRef.current) canvasRef.current.getContext("2d").clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
  };

  const saveEditTS = ti => {
    if(!sel||!editEditorRef.current) return;
    const note = editEditorRef.current.innerHTML;
    const updated = {...sel, ts:sel.ts.map((t,i)=>i===ti?{...t,note}:t)};
    saveVod(updated); setEditingTS(null);
  };

  const delTimestamp = ti => {
    if(!sel) return;
    saveVod({...sel, ts:sel.ts.filter((_,i)=>i!==ti)}); setConfirmTS(null);
  };

  const addReply = ti => {
    if(!replyText.trim()||!sel) return;
    const updated = {...sel, ts:sel.ts.map((t,i)=>i===ti?{...t,replies:[...(t.replies||[]),replyText]}:t)};
    saveVod(updated); setReplyText(""); setReplyOpen(null);
  };

  const saveGenNote = (text) => {
    if(!sel) return;
    const genNote = text !== undefined ? text : genNoteText;
    const updated = {...sel, genNote};
    api.put(`/api/vods/${updated.id}`, { ...updated, ts:JSON.stringify(updated.ts), gen_note:genNote, review_status:updated.review_status||"not_reviewed" }).catch(()=>{});
    setVods(p=>p.map(v=>v.id===updated.id?updated:v));
    setSel(prev=>prev ? {...prev, genNote} : prev);
    sendMentionNotifications(genNote, `VOD notes: ${sel.title||""}`, vodPlayers);
  };

  const openSel = v => {
    trackActivity({ type:"vod", label:v.title, sub:v.folder||"Review", page:"vod", id:v.id });
    setSel(v); setShowAddForm(false); setEditingTS(null); setReplyOpen(null);
    setGenNoteText(v.genNote||"");
    setTimeout(()=>{
      const vid = extractYouTubeId(v.url||"");
      if(vid) initYTPlayer(vid);
    },80);
  };

  // Group vods by folder for sidebar
  const vodsByFolder = {};
  FOLDERS.filter(f=>f!=="All").forEach(f=>{ vodsByFolder[f]=vods.filter(v=>v.folder===f); });

  // ── FULL PAGE REVIEW MODE ──
  if(sel) return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#0d0f14", overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"0 20px", height:48, borderBottom:"1px solid var(--b1)", flexShrink:0, background:"#0d0f14" }}>
        <button onClick={()=>setSel(null)}
          style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13, padding:"4px 8px", borderRadius:6, transition:"color 0.15s" }}
          onMouseOver={e=>e.currentTarget.style.color="var(--t1)"} onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <span style={{ color:"var(--t3)", fontSize:13 }}>VOD Review</span>
        {sel._scrim && <><span style={{ color:"var(--b3)", fontSize:13 }}>/</span><span style={{ color:"var(--t3)", fontSize:13 }}>Scrims</span></>}
        <span style={{ color:"var(--b3)", fontSize:13 }}>/</span>
        <span style={{ fontSize:14, fontWeight:700, color:"var(--t1)" }}>{sel._scrim ? `vs ${sel._scrim.opp} · ${sel._scrim.date}` : sel.title}</span>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:20, padding:"3px 12px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:"var(--t2)", fontWeight:600 }}>{currentTime}</span>
          </div>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 12px" }} onClick={()=>{ setUrlVal(sel.url||""); setUrlEdit(true); }}>
            {sel.url ? "Change URL" : "+ Attach URL"}
          </button>
        </div>
      </div>

      {/* URL edit bar */}
      {urlEdit && (
        <div style={{ background:"var(--s2)", borderBottom:"1px solid var(--b1)", padding:"8px 16px", display:"flex", gap:8, flexShrink:0 }}>
          <input type="text" value={urlVal} onChange={e=>setUrlVal(e.target.value)} placeholder="https://youtube.com/..." style={{ flex:1 }} autoFocus/>
          <button className="btn btn-acc" onClick={attachUrl}>Save</button>
          <button className="btn btn-ghost" onClick={()=>setUrlEdit(false)}>Cancel</button>
        </div>
      )}

      {/* Body: video + notes | annotation panel */}
      <div style={{ display:"flex", flex:1, minHeight:0 }}>

        {/* LEFT: scrollable — video then notes card below */}
        <div style={{ flex:1, overflowY:"auto", minWidth:0, background:"#0d0f14" }}>

          {/* ── SCRIM STATS BANNER (shown when opened from Scrims folder) ── */}
          {sel._scrim && (() => {
            const s = sel._scrim;
            const isWin = s.res==="win"||s.res==="W";
            const playerStats = (() => { try { return Array.isArray(s.player_stats) ? s.player_stats : JSON.parse(s.player_stats||"[]"); } catch { return []; } })();
            return (
              <div style={{ background:"var(--s1)", borderBottom:"1px solid var(--b1)", padding:"16px 20px" }}>
                {/* Match header */}
                <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom: 0 }}>
                  <div>
                    <div style={{ fontSize:11, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>{s.date} · {s.map}</div>
                    <div style={{ fontSize:20, fontWeight:900, color:"var(--t1)" }}>vs {s.opp}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginLeft:"auto" }}>
                    <span className="bc" style={{ fontSize:28, fontWeight:900, color:isWin?"var(--green)":"var(--red)" }}>{s.score}</span>
                    <span className={`chip ${isWin?"chip-green":"chip-red"}`} style={{ fontSize:13 }}>{isWin?"▲ Win":"▼ Loss"}</span>
                  </div>
                </div>

              </div>
            );
          })()}

          {/* Video — explicit height so notes card is reachable by scrolling */}
          {/* overflow:hidden clips the scaled iframe when in minimap zoom mode */}
          <div style={{ height:"56vw", maxHeight:"calc(100vh - 120px)", minHeight:240, background:"#000", position:"relative", overflow:"hidden" }}>
            {sel.url ? (
              <div style={{
                width:"100%", height:"100%",
                transition:"transform 0.35s cubic-bezier(0.4,0,0.2,1)",
                transformOrigin:`${mmX}% ${mmY}%`,
                transform: minimapZoom ? "scale(2.4)" : "scale(1)",
              }}>
                <div id="yt-player-div" style={{ width:"100%", height:"100%" }}/>
              </div>
            ) : (
              <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14, color:"var(--t3)" }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity:0.3 }}><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16"/></svg>
                <div style={{ fontSize:14 }}>No VOD linked yet</div>
                <button className="btn btn-acc" onClick={()=>{ setUrlVal(""); setUrlEdit(true); }}>+ Attach YouTube VOD</button>
              </div>
            )}

            {/* ── DRAWING OVERLAY ── */}
            {sel.url && drawMode && (()=>{
              const getPos = (e, canvas) => {
                const r = canvas.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                // Scale from CSS pixels to canvas internal pixels
                const scaleX = canvas.width / r.width;
                const scaleY = canvas.height / r.height;
                return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY };
              };
              // Sync canvas internal size to its actual rendered size
              const syncCanvasSize = () => {
                const canvas = canvasRef.current; if(!canvas) return;
                const r = canvas.getBoundingClientRect();
                if(canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) {
                  const ctx = canvas.getContext("2d");
                  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  canvas.width  = Math.round(r.width);
                  canvas.height = Math.round(r.height);
                  ctx.putImageData(img, 0, 0);
                }
              };
              const startDraw = (e) => {
                const canvas = canvasRef.current; if(!canvas) return;
                syncCanvasSize();
                const ctx = canvas.getContext("2d");
                const {x,y} = getPos(e, canvas);
                drawingRef.current = { active:true, startX:x, startY:y, snapshot: ctx.getImageData(0,0,canvas.width,canvas.height) };
                if(drawTool==="pen"||drawTool==="eraser") {
                  ctx.beginPath(); ctx.moveTo(x,y);
                }
              };
              const doDraw = (e) => {
                if(!drawingRef.current.active) return;
                const canvas = canvasRef.current; if(!canvas) return;
                const ctx = canvas.getContext("2d");
                const {x,y} = getPos(e, canvas);
                const {startX,startY,snapshot} = drawingRef.current;
                ctx.lineWidth = drawSize;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                if(drawTool==="pen") {
                  ctx.globalCompositeOperation="source-over";
                  ctx.strokeStyle = drawColor;
                  ctx.lineTo(x,y); ctx.stroke();
                } else if(drawTool==="eraser") {
                  ctx.globalCompositeOperation="destination-out";
                  ctx.strokeStyle = "rgba(0,0,0,1)";
                  ctx.lineTo(x,y); ctx.stroke();
                  ctx.globalCompositeOperation="source-over";
                } else {
                  ctx.putImageData(snapshot,0,0);
                  ctx.strokeStyle = drawColor;
                  ctx.globalCompositeOperation="source-over";
                  if(drawTool==="rect") {
                    ctx.beginPath(); ctx.strokeRect(startX,startY,x-startX,y-startY);
                  } else if(drawTool==="arrow") {
                    ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(x,y); ctx.stroke();
                    const angle=Math.atan2(y-startY,x-startX);
                    const len=18;
                    ctx.beginPath();
                    ctx.moveTo(x,y);
                    ctx.lineTo(x-len*Math.cos(angle-0.4),y-len*Math.sin(angle-0.4));
                    ctx.lineTo(x-len*Math.cos(angle+0.4),y-len*Math.sin(angle+0.4));
                    ctx.closePath(); ctx.fillStyle=drawColor; ctx.fill();
                  }
                }
              };
              const endDraw = () => { drawingRef.current.active=false; };
              const clearCanvas = () => { const canvas=canvasRef.current; if(canvas) canvas.getContext("2d").clearRect(0,0,canvas.width,canvas.height); };
              const saveDrawing = () => {
                const canvas = canvasRef.current; if(!canvas) return;
                const dataUrl = canvas.toDataURL("image/png");
                setTsForm(f=>({...f, time:currentTime, drawing:dataUrl}));
                setShowAddForm(true);
                setDrawMode(false);
                setOverlayDrawing(null);
              };
              return (
                <>
                  {/* Toolbar */}
                  <div style={{ position:"absolute", top:10, left:"50%", transform:"translateX(-50%)", zIndex:30, display:"flex", alignItems:"center", gap:6, background:"rgba(8,10,16,0.85)", border:"1px solid var(--b2)", borderRadius:10, padding:"6px 10px", backdropFilter:"blur(8px)" }}>
                    {[["pen","✏️","Pen"],["arrow","➡️","Arrow"],["rect","⬜","Rectangle"],["eraser","🧹","Eraser"]].map(([tool,icon,label])=>(
                      <button key={tool} title={label} onClick={()=>setDrawTool(tool)}
                        style={{ width:32, height:32, borderRadius:7, border:`2px solid ${drawTool===tool?"var(--acc)":"transparent"}`, background:drawTool===tool?"rgba(212,255,30,0.15)":"transparent", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {icon}
                      </button>
                    ))}
                    <div style={{ width:1, height:24, background:"var(--b2)", margin:"0 2px" }}/>
                    {["#d4ff1e","#ff4d6d","#4fc3f7","#ff9f40","#69f0ae","#ffffff"].map(c=>(
                      <button key={c} onClick={()=>setDrawColor(c)}
                        style={{ width:20, height:20, borderRadius:"50%", background:c, border:`2px solid ${drawColor===c?"#fff":"transparent"}`, cursor:"pointer", flexShrink:0 }}/>
                    ))}
                    <div style={{ width:1, height:24, background:"var(--b2)", margin:"0 2px" }}/>
                    <input type="range" min={1} max={12} value={drawSize} onChange={e=>setDrawSize(Number(e.target.value))}
                      style={{ width:60, accentColor:"var(--acc)" }}/>
                    <div style={{ width:1, height:24, background:"var(--b2)", margin:"0 2px" }}/>
                    <button title="Clear" onClick={()=>{ const c=canvasRef.current; if(c) c.getContext("2d").clearRect(0,0,c.width,c.height); }}
                      style={{ padding:"4px 8px", borderRadius:6, background:"rgba(255,77,109,0.15)", border:"1px solid rgba(255,77,109,0.3)", color:"#ff4d6d", fontSize:11, fontWeight:700, cursor:"pointer" }}>Clear</button>
                    <button title="Save to timestamp" onClick={()=>{
                        const canvas=canvasRef.current; if(!canvas) return;
                        const dataUrl=canvas.toDataURL("image/png");
                        setTsForm(f=>({...f,time:currentTime,drawing:dataUrl}));
                        setShowAddForm(true); setDrawMode(false);
                      }}
                      style={{ padding:"4px 10px", borderRadius:6, background:"var(--acc)", border:"none", color:"#080a10", fontSize:11, fontWeight:700, cursor:"pointer" }}>Save to Note</button>
                    <button onClick={()=>setDrawMode(false)}
                      style={{ padding:"4px 8px", borderRadius:6, background:"transparent", border:"1px solid var(--b2)", color:"var(--t3)", fontSize:11, fontWeight:700, cursor:"pointer" }}>✕</button>
                  </div>
                  {/* Canvas */}
                  <canvas ref={canvasRef} width={canvasRef.current?.parentElement?.offsetWidth||1280} height={canvasRef.current?.parentElement?.offsetHeight||720} onMouseEnter={syncCanvasSize}
                    style={{ position:"absolute", inset:0, width:"100%", height:"100%", zIndex:25, cursor:drawTool==="eraser"?"cell":"crosshair", touchAction:"none" }}
                    onMouseDown={startDraw} onMouseMove={doDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                    onTouchStart={e=>{e.preventDefault();startDraw(e);}} onTouchMove={e=>{e.preventDefault();doDraw(e);}} onTouchEnd={endDraw}
                  />
                </>
              );
            })()}

            {/* ── DRAW TOGGLE BUTTON ── */}
            {sel.url && (
              <button onClick={()=>{ setDrawMode(d=>!d); setOverlayDrawing(null); }}
                style={{ position:"absolute", top:10, right:10, zIndex:20, background:drawMode?"var(--acc)":"rgba(0,0,0,0.75)", border:drawMode?"none":"1px solid rgba(255,255,255,0.2)", borderRadius:8, padding:"6px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:6, color:drawMode?"#080a10":"#fff", fontSize:12, fontWeight:700, transition:"all 0.15s", backdropFilter:"blur(4px)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                {drawMode ? "Drawing" : "Draw"}
              </button>
            )}

            {/* ── ANNOTATION OVERLAY (replay mode) ── */}
            {overlayDrawing && !drawMode && (
              <div style={{ position:"absolute", inset:0, zIndex:30, pointerEvents:"none" }}>
                <img
                  src={overlayDrawing.drawing}
                  alt="annotation overlay"
                  style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill", display:"block", opacity:0.92 }}
                />
                {/* Close button */}
                <button
                  onClick={() => { setOverlayDrawing(null); try { if(ytPlayerRef.current) ytPlayerRef.current.playVideo(); } catch{} }}
                  style={{ position:"absolute", top:10, left:10, zIndex:31, pointerEvents:"all", background:"rgba(0,0,0,0.75)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:8, padding:"5px 11px", cursor:"pointer", color:"#fff", fontSize:12, fontWeight:700, backdropFilter:"blur(4px)", display:"flex", alignItems:"center", gap:5 }}>
                  ✕ <span style={{ fontSize:11, opacity:0.8 }}>{overlayDrawing.time}</span>
                </button>
                {/* Label */}
                <div style={{ position:"absolute", bottom:10, left:10, pointerEvents:"none", background:"rgba(0,0,0,0.6)", borderRadius:6, padding:"3px 10px", fontSize:11, color:"var(--acc)", fontWeight:700, backdropFilter:"blur(4px)" }}>
                  📍 Annotation @ {overlayDrawing.time}
                </div>
              </div>
            )}

            {/* ── MINIMAP ZOOM BUTTON ── */}
            {sel.url && (
              <button
                onClick={() => setMinimapZoom(z => !z)}
                style={{
                  position:"absolute", bottom:10, right:10, zIndex:20,
                  background: minimapZoom ? "var(--acc)" : "rgba(0,0,0,0.75)",
                  border: minimapZoom ? "none" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius:8, padding:"6px 12px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:6,
                  color: minimapZoom ? "#080a10" : "#fff",
                  fontSize:12, fontWeight:700, transition:"all 0.15s",
                  backdropFilter:"blur(4px)",
                }}>
                {minimapZoom ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    Normal View
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                    Minimap
                  </>
                )}
              </button>
            )}
            {/* Nudge controls — shown when zoomed so you can fine-tune position */}
            {sel.url && minimapZoom && (
              <div style={{
                position:"absolute", bottom:10, right:130, zIndex:20,
                display:"flex", gap:4, alignItems:"center",
              }}>
                {[["←",()=>setMmX(x=>Math.max(0,x-2))],["→",()=>setMmX(x=>Math.min(100,x+2))],["↑",()=>setMmY(y=>Math.max(0,y-2))],["↓",()=>setMmY(y=>Math.min(100,y+2))]].map(([lbl,fn])=>(
                  <button key={lbl} onClick={fn} style={{
                    background:"rgba(0,0,0,0.75)", border:"1px solid rgba(255,255,255,0.2)",
                    color:"#fff", borderRadius:6, width:26, height:26, cursor:"pointer",
                    fontSize:13, display:"flex", alignItems:"center", justifyContent:"center",
                    fontWeight:700, backdropFilter:"blur(4px)",
                  }}>{lbl}</button>
                ))}
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.4)", marginLeft:2 }}>{mmX}% {mmY}%</div>
              </div>
            )}
          </div>

          {/* General Notes — card below video, scroll to reach */}
          <div style={{ margin:"20px 20px 32px", background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12 }}>
            <div style={{ padding:"18px 20px 14px", display:"flex", alignItems:"center", gap:10, borderBottom:"1px solid var(--b1)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style={{ fontSize:15, fontWeight:700, color:"var(--t1)" }}>General Notes</span>
            </div>
            <div style={{ padding:"16px" }}>
              <MentionInput
                value={genNoteText}
                onChange={e=>setGenNoteText(e.target.value)}
                onBlur={()=>saveGenNote()}
                placeholder="Add general notes, observations, or summary for this VOD… (type @ to mention)"
                players={vodPlayers}
                onMention={p=>sendMentionNotifications(`@${p.name}`, `VOD notes: ${sel?.title||""}`, vodPlayers)}
                style={{
                  minHeight:150, width:"100%", boxSizing:"border-box",
                  background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8,
                  padding:"14px 16px", fontSize:13, lineHeight:1.75,
                  color:"var(--t1)", outline:"none", transition:"border-color 0.2s, box-shadow 0.2s",
                }}
              />
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10 }}>
                <div style={{ fontSize:11, color:"var(--t3)", opacity:0.5 }}>Auto-saved on blur · paste images directly</div>
                {sel && !sel._scrimOnly && (()=>{
                  const rs = sel.review_status || "not_reviewed";
                  const isReviewed = rs === "reviewed";
                  return (
                    <button
                      onClick={async()=>{
                        const newStatus = isReviewed ? "in_progress" : "reviewed";
                        const updated = {...sel, review_status:newStatus};
                        setSel(updated);
                        setVods(p=>p.map(v=>v.id===sel.id?{...v,review_status:newStatus}:v));
                        await api.put(`/api/vods/${sel.id}`,{...updated, ts:JSON.stringify(updated.ts||[]), gen_note:updated.genNote||"", review_status:newStatus}).catch(()=>{});
                      }}
                      style={{
                        padding:"5px 14px", borderRadius:6, fontSize:11, fontWeight:700, cursor:"pointer", border:"none", transition:"all 0.15s",
                        background: isReviewed ? "rgba(105,240,174,0.15)" : "var(--acc)",
                        color: isReviewed ? "var(--green)" : "#080a10",
                      }}>
                      {isReviewed ? "✓ Reviewed" : "Mark as Reviewed"}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Annotation Panel — matches Image 2 */}
        <div style={{ width:360, background:"#111318", borderLeft:"1px solid var(--b1)", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>

          {/* Panel header */}
          <div style={{ padding:"16px 18px 14px", borderBottom:"1px solid var(--b1)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span style={{ fontWeight:700, fontSize:15, color:"var(--t1)" }}>New Annotation</span>
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"var(--t3)", background:"var(--s2)", padding:"2px 10px", borderRadius:12, border:"1px solid var(--b2)" }}>{currentTime}</div>
            </div>

            {showAddForm ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {/* Timestamp + Category row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:5 }}>Timestamp</div>
                    <div style={{ position:"relative" }}>
                      <input type="text" value={tsForm.time} onChange={e=>setTsForm(f=>({...f,time:e.target.value}))}
                        placeholder={currentTime}
                        style={{ paddingRight:32, width:"100%", boxSizing:"border-box", background:"#1a1d26", border:"1px solid var(--b2)", borderRadius:6 }}/>
                      <button onClick={()=>setTsForm(f=>({...f,time:currentTime}))} title="Use current time"
                        style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"transparent", border:"none", cursor:"pointer", color:"var(--t3)", padding:0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--t3)", marginBottom:5 }}>Category</div>
                    <select value={tsForm.cat} onChange={e=>setTsForm(f=>({...f,cat:e.target.value}))}
                      style={{ width:"100%", background:"#1a1d26", border:"1px solid var(--b2)", borderRadius:6 }}>
                      {Object.keys(TS_COLORS).map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* Note editor with @mention support */}
                <div>
                  <MentionInput
                    value={tsForm.note||""}
                    onChange={e=>setTsForm(f=>({...f,note:e.target.value}))}
                    placeholder="Describe what's happening... @ to mention"
                    players={vodPlayers}
                    onMention={p=>sendMentionNotifications(`@${p.name}`, `VOD: ${sel?.title||""}`, vodPlayers)}
                    style={{
                      minHeight:72, maxHeight:140, overflowY:"auto",
                      background:"#1a1d26", border:"1px solid var(--b2)", borderRadius:6,
                      padding:"9px 11px", fontSize:13, lineHeight:1.6, color:"var(--t1)", outline:"none",
                      width:"100%", boxSizing:"border-box",
                    }}
                  />
                </div>
                {/* Drawing preview if attached */}
                {tsForm.drawing && (
                  <div style={{ position:"relative" }}>
                    <img src={tsForm.drawing} alt="drawing" style={{ width:"100%", borderRadius:6, border:"1px solid var(--b2)", display:"block" }}/>
                    <button onClick={()=>setTsForm(f=>({...f,drawing:null}))}
                      style={{ position:"absolute", top:4, right:4, background:"rgba(8,10,16,0.8)", border:"1px solid var(--b2)", color:"var(--t3)", borderRadius:4, padding:"2px 6px", fontSize:10, cursor:"pointer" }}>✕ Remove</button>
                  </div>
                )}
                {/* Add button */}
                <button
                  onClick={addTimestamp}
                  disabled={!tsForm.note?.trim() && !tsForm.drawing}
                  style={{
                    width:"100%", padding:"10px", borderRadius:8, border:"none", cursor:"pointer",
                    background:"var(--acc)", color:"#080a10", fontWeight:700, fontSize:13,
                    fontFamily:"'DIN Next LT Pro',sans-serif", transition:"opacity 0.15s",
                    opacity: (!tsForm.note?.trim() && !tsForm.drawing) ? 0.4 : 1,
                  }}
                  onMouseOver={e=>e.currentTarget.style.opacity="0.9"}
                  onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                  Add Note
                </button>
                <button className="btn btn-ghost" style={{ width:"100%", justifyContent:"center", fontSize:12 }} onClick={()=>setShowAddForm(false)}>Cancel</button>
              </div>
            ) : (
              <button
                onClick={()=>{ setShowAddForm(true); setTsForm(f=>({...f,time:currentTime})); setTimeout(()=>noteEditorRef.current?.focus(), 50); }}
                style={{
                  width:"100%", padding:"11px", borderRadius:8, border:"none", cursor:"pointer",
                  background:"var(--acc)", color:"#080a10", fontWeight:700, fontSize:13,
                  fontFamily:"'DIN Next LT Pro',sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#080a10" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                + Add Timestamp
              </button>
            )}
          </div>

          {/* Annotations list */}
          <div style={{ flex:1, overflowY:"auto", padding:"10px 10px 20px" }}>
            {(!sel.ts||sel.ts.length===0) ? (
              <div style={{ textAlign:"center", color:"var(--t3)", padding:"48px 20px", fontSize:13, opacity:0.6 }}>No timestamps yet.</div>
            ) : [...sel.ts].sort((a,b)=>parseTime(a.time)-parseTime(b.time)).map((t,_i)=>{
              const ti = sel.ts.indexOf(t);
              const col = TS_COLORS[t.cat]||"#8892aa";
              return (
                <div key={ti} style={{ marginBottom:10, background:"#0d0f14", borderRadius:10, border:"1px solid var(--b1)", overflow:"hidden", transition:"border-color 0.15s" }}
                  onMouseOver={e=>e.currentTarget.style.borderColor="var(--b2)"}
                  onMouseOut={e=>e.currentTarget.style.borderColor="var(--b1)"}>
                  {/* Timestamp header */}
                  <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px" }}>
                    <button onClick={()=> t.drawing ? seekAndOverlay(t.time, t.drawing) : seekTo(t.time)}
                      style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, padding:"2px 9px", borderRadius:6,
                        background:"var(--s2)", border:"1px solid var(--b2)", cursor:"pointer", color:"var(--t1)", flexShrink:0, transition:"all 0.1s" }}
                      onMouseOver={e=>{ e.currentTarget.style.background=col+"33"; e.currentTarget.style.borderColor=col+"66"; e.currentTarget.style.color=col; }}
                      onMouseOut={e=>{ e.currentTarget.style.background="var(--s2)"; e.currentTarget.style.borderColor="var(--b2)"; e.currentTarget.style.color="var(--t1)"; }}>
                      {t.time}
                    </button>
                    <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:10, background:col+"18", color:col, border:`1px solid ${col}30` }}>{t.cat}</span>
                    {t.drawing && (
                      <span title="Has annotation overlay" style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:10, background:"rgba(212,255,30,0.12)", color:"var(--acc)", border:"1px solid rgba(212,255,30,0.25)", cursor:"pointer" }}
                        onClick={()=>seekAndOverlay(t.time, t.drawing)}>📍</span>
                    )}
                    <div style={{ marginLeft:"auto", display:"flex", gap:2 }}>
                      <button onClick={()=>{ setEditingTS(editingTS===ti?null:ti); setTimeout(()=>{ if(editEditorRef.current) editEditorRef.current.innerHTML=t.note||""; },20); }}
                        style={{ background:"transparent", border:"none", color:editingTS===ti?"var(--acc)":"var(--t3)", cursor:"pointer", padding:"3px 6px", borderRadius:4, fontSize:13, transition:"color 0.1s" }}>✏</button>
                      <button onClick={()=>setConfirmTS({ti,t})}
                        style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", padding:"3px 6px", borderRadius:4, fontSize:13, transition:"color 0.1s" }}
                        onMouseOver={e=>e.currentTarget.style.color="var(--red)"}
                        onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>🗑</button>
                    </div>
                  </div>
                  {/* Note content */}
                  {t.note && editingTS!==ti && (
                    <div style={{ padding:"0 12px 10px" }}>
                      <MentionText text={t.note} style={{ fontSize:13, color:"var(--t2)", lineHeight:1.65 }}/>
                    </div>
                  )}
                  {t.drawing && editingTS!==ti && (
                    <div style={{ padding:"0 12px 10px", position:"relative" }}>
                      <img src={t.drawing} alt="annotation" style={{ width:"100%", borderRadius:6, border:"1px solid var(--b1)", display:"block", cursor:"pointer" }}
                        onClick={()=>seekAndOverlay(t.time, t.drawing)}/>
                      <button
                        title="Remove drawing"
                        onClick={()=>{
                          const updated = {...sel, ts: sel.ts.map((ts,i)=> i===ti ? {...ts, drawing:undefined} : ts)};
                          saveVod(updated);
                          if(overlayDrawing?.time===t.time) setOverlayDrawing(null);
                        }}
                        style={{ position:"absolute", top:6, right:18, background:"rgba(0,0,0,0.75)", border:"1px solid rgba(255,82,82,0.4)", borderRadius:6, padding:"3px 8px", cursor:"pointer", color:"var(--red)", fontSize:11, fontWeight:700, backdropFilter:"blur(4px)" }}
                        onMouseOver={e=>e.currentTarget.style.background="rgba(255,82,82,0.2)"}
                        onMouseOut={e=>e.currentTarget.style.background="rgba(0,0,0,0.75)"}>
                        ✕ drawing
                      </button>
                    </div>
                  )}
                  {/* Edit mode */}
                  {editingTS===ti && (
                    <div style={{ padding:"0 12px 10px" }}>
                      <div ref={editEditorRef} contentEditable suppressContentEditableWarning
                        onPaste={e=>handleImgPaste(e, editEditorRef)}
                        style={{ minHeight:50, background:"#1a1d26", border:"1px solid var(--acc)", borderRadius:6, padding:"7px 10px", fontSize:13, lineHeight:1.6, outline:"none", color:"var(--t1)", marginBottom:8 }}/>
                      <div style={{ display:"flex", gap:6 }}>
                        <button className="btn btn-acc" style={{ fontSize:11, padding:"4px 12px" }} onClick={()=>saveEditTS(ti)}>Save</button>
                        <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 10px" }} onClick={()=>setEditingTS(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNew && (
        <Modal title="New Review" onClose={()=>setShowNew(false)} fullscreen>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={newForm.title} onChange={e=>setNewForm(f=>({...f,title:e.target.value}))} placeholder="Review name" autoFocus/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Folder</div><select value={newForm.folder} onChange={e=>setNewForm(f=>({...f,folder:e.target.value}))}>{FOLDERS.filter(f=>f!=="All").map(f=><option key={f}>{f}</option>)}</select></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>YouTube URL (optional)</div><input type="text" value={newForm.url} onChange={e=>setNewForm(f=>({...f,url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addVod} disabled={!newForm.title.trim()}>Create Review</button>
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {confirmVod && <ConfirmModal title="Delete Review" message={`Delete "${confirmVod.title}"?`} onConfirm={()=>delVod(confirmVod.id)} onCancel={()=>setConfirmVod(null)}/>}
      {confirmTS  && <ConfirmModal title="Delete Timestamp" message={`Delete the "${confirmTS.t.cat}" timestamp at ${confirmTS.t.time}?`} onConfirm={()=>delTimestamp(confirmTS.ti)} onCancel={()=>setConfirmTS(null)}/>}
    </div>
  );

  // ── FOLDER BROWSE MODE ──
  return (
    <div style={{ display:"flex", height:"calc(100vh - 0px)", overflow:"hidden" }}>

      {/* ── LEFT SIDEBAR: fixed VOD folders panel ── */}
      <div style={{ width:250, background:"var(--s1)", borderRight:"1px solid var(--b1)", display:"flex", flexDirection:"column", flexShrink:0 }}>

        {/* Header */}
        <div style={{ padding:"16px 16px 12px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div className="bc" style={{ fontSize:15, fontWeight:900, letterSpacing:"0.1em", color:"var(--t1)" }}>VOD REVIEW</div>
          <button onClick={()=>setShowNew(true)}
            style={{ background:"var(--acc)", border:"none", borderRadius:6, width:26, height:26, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18, fontWeight:700, color:"#080a10", lineHeight:1 }}>+</button>
        </div>

        {/* FOLDERS label */}
        <div style={{ padding:"14px 16px 6px" }}>
          <div className="label-sm">FOLDERS</div>
        </div>

        {/* Folder list */}
        <div style={{ flex:1, overflowY:"auto", padding:"4px 8px 8px" }}>
          {FOLDERS.filter(f=>f!=="All").map(folder=>{
            const folderVods = vodsByFolder[folder]||[];
            const isExpanded = activeFolder===folder;
            const folderCount = folder==="Scrims" ? scrims.length : folderVods.length;
            return (
              <div key={folder}>
                {/* Folder row */}
                <div onClick={()=>{ setActiveFolder(isExpanded?null:folder); setSel(null); }}
                  style={{ padding:"8px 10px", borderRadius:8, display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                    background: isExpanded ? "var(--s3)" : "transparent",
                    color: isExpanded ? "var(--t1)" : "var(--t2)",
                    marginBottom:2, userSelect:"none", transition:"all 0.12s" }}
                  onMouseOver={e=>{ if(!isExpanded) e.currentTarget.style.background="var(--s2)"; }}
                  onMouseOut={e=>{ if(!isExpanded) e.currentTarget.style.background="transparent"; }}>
                  {/* chevron */}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style={{ flexShrink:0, opacity:0.5, transition:"transform 0.15s", transform:isExpanded?"rotate(90deg)":"rotate(0deg)" }}>
                    <polygon points="2,1 8,5 2,9"/>
                  </svg>
                  {/* folder icon */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span style={{ flex:1, fontSize:13, fontWeight:600 }}>{folder}</span>
                  <span style={{ fontSize:11, color:"var(--t3)", background:"var(--s3)", borderRadius:10, padding:"1px 7px", fontWeight:700 }}>{folderCount}</span>
                </div>

                {/* Reviews under folder */}
                {isExpanded && (
                  <div style={{ marginBottom:4 }}>
                    {folderVods.length===0 ? (
                      <div style={{ padding:"6px 10px 6px 34px", fontSize:11, color:"var(--t3)", fontStyle:"italic" }}>No reviews yet</div>
                    ) : folderVods.map(v=>(
                      <div key={v.id} onClick={()=>openSel(v)}
                        className="vod-row"
                        style={{ padding:"7px 10px 7px 34px", borderRadius:6, cursor:"pointer", fontSize:13, marginBottom:1,
                          background: sel?.id===v.id ? "rgba(212,255,30,0.08)" : "transparent",
                          borderLeft: sel?.id===v.id ? "2px solid var(--acc)" : "2px solid transparent",
                          color: sel?.id===v.id ? "var(--t1)" : "var(--t2)",
                          display:"flex", alignItems:"center", gap:8, transition:"all 0.1s" }}
                        onMouseOver={e=>{ if(sel?.id!==v.id) e.currentTarget.style.background="var(--s2)"; e.currentTarget.querySelector(".vod-del").style.opacity="1"; }}
                        onMouseOut={e=>{ if(sel?.id!==v.id) e.currentTarget.style.background="transparent"; e.currentTarget.querySelector(".vod-del").style.opacity="0"; }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink:0, opacity:0.4 }}>
                          <polygon points="5,3 19,12 5,21"/>
                        </svg>
                        <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight: sel?.id===v.id?600:400 }}>{v.title}</span>
                        <button className="vod-del" onClick={e=>{e.stopPropagation();setConfirmVod(v);}}
                          style={{ background:"transparent", border:"none", color:"var(--red)", cursor:"pointer", fontSize:12, padding:"2px 5px", borderRadius:4, opacity:0, transition:"opacity 0.15s", flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      {!activeFolder && !sel ? (
        /* ── NO FOLDER SELECTED: show folder cards ── */
        <div style={{ flex:1, padding:"32px 36px", overflowY:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
            <div className="bc" style={{ fontSize:32, fontWeight:900, letterSpacing:"0.04em" }}>VOD REVIEW</div>
            <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:14 }}>
            {vodsLoading
              ? [1,2,3].map(i=><div key={i} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:12, padding:"20px 18px" }}>
                  <div style={{ width:28, height:28, background:"var(--s3)", borderRadius:6, marginBottom:10, animation:"blink 1.4s infinite" }}/>
                  <div style={{ height:13, width:"60%", background:"var(--s3)", borderRadius:4, marginBottom:8, animation:"blink 1.4s infinite" }}/>
                  <div style={{ height:10, width:"40%", background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
                </div>)
              : FOLDERS.filter(f=>f!=="All").map(folder=>{
              const count = (vodsByFolder[folder]||[]).length;
              return (
                <div key={folder} onClick={()=>setActiveFolder(folder)}
                  style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:12, padding:"20px 18px", cursor:"pointer", transition:"all 0.15s" }}
                  onMouseOver={e=>{ e.currentTarget.style.borderColor="var(--acc)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseOut={e=>{ e.currentTarget.style.borderColor="var(--b1)"; e.currentTarget.style.transform="none"; }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:10 }}>
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{folder}</div>
                  <div style={{ fontSize:12, color:"var(--t3)" }}>{count} review{count!==1?"s":""}</div>
                </div>
              );
            })}
          </div>
        </div>

      ) : !sel ? (
        /* ── FOLDER SELECTED ── */
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Header */}
          <div style={{ padding:"24px 32px 16px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:2 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span className="bc" style={{ fontSize:28, fontWeight:900 }}>{activeFolder}</span>
              </div>
              <div style={{ color:"var(--t3)", fontSize:13 }}>
                {activeFolder==="Scrims" ? `${scrims.length} scrim${scrims.length!==1?"s":""}` : `${(vodsByFolder[activeFolder]||[]).length} review${(vodsByFolder[activeFolder]||[]).length!==1?"s":""}`}
              </div>
            </div>
            {activeFolder!=="Scrims" && <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"24px 32px" }}>
            {activeFolder==="Scrims" ? (
              /* ── SCRIMS FOLDER: show scrim log entries ── */
              scrims.length===0 ? (
                <div style={{ textAlign:"center", color:"var(--t3)", paddingTop:60 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>🎮</div>
                  <div style={{ fontSize:16, marginBottom:4 }}>No scrims logged yet</div>
                  <div style={{ fontSize:13, color:"var(--t3)", marginBottom:16 }}>Add scrims in the Scrim Log tab first</div>
                </div>
              ) : (
                <div className="card" style={{ padding:0, overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"var(--s2)" }}>
                        {["Date","Map","Opponent","Score","Result","VOD"].map(h=>(
                          <th key={h} style={{ padding:"10px 20px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scrims.map(s=>{
                        const linkedVod = vods.find(v=>v.scrim_id && String(v.scrim_id)===String(s.id));
                        const isWin = s.res==="win"||s.res==="W";
                        return (
                          <tr key={s.id} style={{ borderTop:"1px solid var(--b1)", cursor:"pointer" }}
                            onMouseOver={e=>e.currentTarget.style.background="var(--s2)"}
                            onMouseOut={e=>e.currentTarget.style.background="transparent"}
                            onClick={()=>{
                              const existingVod = vods.find(v=>v.scrim_id && String(v.scrim_id)===String(s.id));
                              if(existingVod) {
                                openSel({...existingVod, _scrim:s});
                              } else {
                                setSel({ _scrimOnly:true, _scrim:s, id:`scrim-${s.id}`, title:`vs ${s.opp}`, ts:[], genNote:"", url:"" });
                                setShowAddForm(false); setEditingTS(null); setReplyOpen(null);
                                setGenNoteText("");
                              }
                            }}>
                            <td style={{ padding:"12px 20px", fontSize:13, color:"var(--t3)" }}>{s.date}</td>
                            <td style={{ padding:"12px 20px" }}><span className="chip chip-blue">{s.map}</span></td>
                            <td style={{ padding:"12px 20px", fontWeight:600 }}>vs {s.opp}</td>
                            <td style={{ padding:"12px 20px" }}><span className="bc" style={{ fontSize:20, fontWeight:900, color:isWin?"var(--green)":"var(--red)" }}>{s.score}</span></td>
                            <td style={{ padding:"12px 20px" }}><span className={`chip ${isWin?"chip-green":"chip-red"}`}>{isWin?"▲ Win":"▼ Loss"}</span></td>
                            <td style={{ padding:"12px 20px" }} onClick={e=>e.stopPropagation()}>
                              {linkedVod ? (
                                <button onClick={()=>openSel({...linkedVod, _scrim:s})}
                                  style={{ background:"rgba(212,255,30,0.12)", border:"1px solid rgba(212,255,30,0.25)", color:"var(--acc)", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}
                                  onMouseOver={e=>e.currentTarget.style.background="rgba(212,255,30,0.22)"}
                                  onMouseOut={e=>e.currentTarget.style.background="rgba(212,255,30,0.12)"}>
                                  ▶ Open VOD
                                </button>
                              ) : (
                                <button onClick={()=>{
                                    setSel({ _scrimOnly:true, _scrim:s, id:`scrim-${s.id}`, title:`vs ${s.opp}`, ts:[], genNote:"", url:"" });
                                    setShowAddForm(false); setEditingTS(null); setReplyOpen(null);
                                    setGenNoteText("");
                                    setTimeout(()=>{ setUrlVal(""); setUrlEdit(true); }, 80);
                                  }}
                                  style={{ background:"var(--s3)", border:"1px solid var(--b2)", color:"var(--t2)", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}
                                  onMouseOver={e=>{ e.currentTarget.style.background="var(--s4)"; e.currentTarget.style.borderColor="var(--b3)"; e.currentTarget.style.color="var(--t1)"; }}
                                  onMouseOut={e=>{ e.currentTarget.style.background="var(--s3)"; e.currentTarget.style.borderColor="var(--b2)"; e.currentTarget.style.color="var(--t2)"; }}>
                                  + Add VOD
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (vodsByFolder[activeFolder]||[]).length===0 ? (
              <div style={{ textAlign:"center", color:"var(--t3)", paddingTop:60 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
                <div style={{ fontSize:16, marginBottom:8 }}>No reviews in this folder yet</div>
                <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
              </div>
            ) : (
              <div className="card" style={{ padding:0, overflow:"hidden" }}>
                <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>Reviews</div>
                  <div style={{ fontSize:12, color:"var(--t3)" }}>{(vodsByFolder[activeFolder]||[]).length} review{(vodsByFolder[activeFolder]||[]).length!==1?"s":""}</div>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"var(--s2)" }}>
                      <th style={{ padding:"10px 20px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", width:40 }}></th>
                      <th style={{ padding:"10px 20px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Title</th>
                      <th style={{ padding:"10px 20px", textAlign:"left", fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Date</th>
                      <th style={{ padding:"10px 20px", textAlign:"right", fontSize:11, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vodsByFolder[activeFolder]||[]).map(v=>(
                      <tr key={v.id} style={{ borderTop:"1px solid var(--b1)" }}
                        onMouseOver={e=>e.currentTarget.style.background="var(--s2)"}
                        onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{ padding:"12px 20px", color:"var(--t3)", fontSize:12 }}>⠿</td>
                        <td style={{ padding:"12px 20px", fontWeight:600, fontSize:14, cursor:"pointer" }} onClick={()=>openSel(v)}>{v.title}</td>
                        <td style={{ padding:"12px 20px", fontSize:13, color:"var(--t3)" }}>{v.date || new Date().toLocaleDateString()}</td>
                        <td style={{ padding:"12px 20px", textAlign:"right" }}>
                          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", alignItems:"center" }}>
                            {/* Edit name button */}
                            <button title="Rename" style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:14, padding:"4px 6px", borderRadius:5 }}>✏</button>
                            {/* PLAY button — opens review */}
                            <button onClick={()=>openSel(v)} title="Open review"
                              style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6, padding:"6px 10px", cursor:"pointer", color:"var(--t2)", display:"flex", alignItems:"center", gap:4, fontSize:13, transition:"all 0.15s" }}
                              onMouseOver={e=>{ e.currentTarget.style.background="var(--acc)"; e.currentTarget.style.color="#080a10"; e.currentTarget.style.borderColor="var(--acc)"; }}
                              onMouseOut={e=>{ e.currentTarget.style.background="var(--s3)"; e.currentTarget.style.color="var(--t2)"; e.currentTarget.style.borderColor="var(--b2)"; }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
                            </button>
                            {/* Delete button */}
                            <button onClick={e=>{e.stopPropagation();setConfirmVod(v);}} title="Delete"
                              style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)", borderRadius:6, padding:"6px 10px", cursor:"pointer", color:"var(--red)", fontSize:13, transition:"all 0.15s" }}
                              onMouseOver={e=>{ e.currentTarget.style.background="rgba(255,82,82,0.25)"; }}
                              onMouseOut={e=>{ e.currentTarget.style.background="rgba(255,82,82,0.1)"; }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      ) : null}

      {showNew && (
        <Modal onClose={()=>setShowNew(false)} title="New VOD Review" fullscreen>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={newForm.title} onChange={e=>setNewForm(f=>({...f,title:e.target.value}))} placeholder="e.g. SKF vs GC Scrim" autoFocus/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Folder</div><select value={newForm.folder} onChange={e=>setNewForm(f=>({...f,folder:e.target.value}))}>{FOLDERS.filter(f=>f!=="All").map(f=><option key={f}>{f}</option>)}</select></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>YouTube URL (optional)</div><input type="text" value={newForm.url} onChange={e=>setNewForm(f=>({...f,url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addVod} disabled={!newForm.title.trim()}>Create Review</button>
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
       )}

      {confirmVod && <ConfirmModal title="Delete Review" message={`Delete "${confirmVod.title}"? All timestamps will be lost.`} onConfirm={()=>delVod(confirmVod.id)} onCancel={()=>setConfirmVod(null)}/>}
      {confirmTS  && <ConfirmModal title="Delete Timestamp" message={`Delete the "${confirmTS.t.cat}" timestamp at ${confirmTS.t.time}?`} onConfirm={()=>delTimestamp(confirmTS.ti)} onCancel={()=>setConfirmTS(null)}/>}
    </div>
  );
}

/* ════ TASKS ════ */
function Tasks({ players, setPlayers, isAdmin=true }) {
  const [tasks, setTasks]         = useState({});
  const [labels, setLabels]       = useState([]);
  const [taskModal, setTaskModal] = useState(false);
  const [labelModal, setLabelModal]   = useState(false);
  const [lForm, setLForm]         = useState({ name:"", color: LABEL_COLORS[0] });
  const [form, setForm]           = useState({ title:"", description:"", due:"", assignedTo:"", priority:"", labels:[] });

  const [tasksLoading, setTasksLoading] = useState(true);
  useEffect(()=>{
    Promise.all([
      api.get("/api/labels").then(d=>{ if(Array.isArray(d)) setLabels(d); }).catch(()=>{}),
      api.get(`/api/tasks?t=${Date.now()}`).then(d=>{
        if(Array.isArray(d)){
          const byPlayer = {};
          d.forEach(t=>{ if(!byPlayer[t.player_id]) byPlayer[t.player_id]=[]; byPlayer[t.player_id].push({...t, labels:JSON.parse(t.labels||"[]")}); });
          setTasks(byPlayer);
        }
      }).catch(()=>{}),
    ]).finally(()=>setTasksLoading(false));
  },[]);

  const pending = Object.values(tasks).flatMap(t=>t).filter(t=>!t.done).length;

  const toggle = (pid,tid) => {
    const task = (tasks[pid]||[]).find(t=>t.id===tid);
    if(!task) return;
    const done = !task.done;
    api.put(`/api/tasks/${tid}`, { done }).catch(()=>{});
    setTasks(p=>({ ...p, [pid]:(p[pid]||[]).map(t=>t.id===tid?{...t,done}:t) }));
  };

  const delTask = (pid,tid) => {
    api.delete(`/api/tasks/${tid}`).catch(()=>{});
    setTasks(p=>({ ...p, [pid]:(p[pid]||[]).filter(t=>t.id!==tid) }));
  };

  const addTask = async () => {
    if(!form.title.trim() || !form.assignedTo) return;
    const pid = Number(form.assignedTo);
    setTaskModal(false);
    const savedForm = { ...form };
    setForm({ title:"", description:"", due:"", assignedTo:"", priority:"", labels:[] });
    const saved = await api.post("/api/tasks", { ...savedForm, player_id:pid, labels:JSON.stringify(savedForm.labels) }).catch(()=>null);
    if(saved?.id) {
      setTasks(p=>({ ...p, [pid]:[...(p[pid]||[]), {...saved, labels:savedForm.labels}] }));
      invalidate(`/api/tasks`);
      api.get(`/api/tasks?t=${Date.now()}`).then(d=>{
        if(Array.isArray(d)){
          const byPlayer = {};
          d.forEach(t=>{ if(!byPlayer[t.player_id]) byPlayer[t.player_id]=[]; byPlayer[t.player_id].push({...t, labels:JSON.parse(t.labels||"[]")}); });
          setTasks(byPlayer);
        }
      }).catch(()=>{});
    }
  };

  const addLabel = () => {
    if(!lForm.name.trim()) return;
    api.post("/api/labels", lForm).then(d=>{ setLabels(prev=>[...prev, d]); }).catch(()=>{ setLabels(prev=>[...prev, { name:lForm.name.trim(), color:lForm.color }]); });
    setLForm({ name:"", color: LABEL_COLORS[0] }); setLabelModal(false);
  };

  const removeLabel = name => {
    api.delete(`/api/labels/${encodeURIComponent(name)}`).catch(()=>{});
    setLabels(prev=>prev.filter(l=>l.name!==name));
  };


  const hex2rgba = (hex, a) => { const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>TASKS</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>{pending} pending tasks across the team</div>
        </div>
        {isAdmin && <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost" onClick={()=>setLabelModal(true)}>⊕ Labels{labels.length>0?` (${labels.length})`:""}</button>
          <button className="btn btn-acc" onClick={()=>setTaskModal(true)} disabled={players.length===0} style={{ opacity:players.length===0?0.45:1 }}>+ Add Task</button>
        </div>}
      </div>
      {tasksLoading ? (
        <div style={{ display:"flex", gap:12, paddingBottom:12 }}>
          {[1,2,3].map(i=>(
            <div key={i} style={{ width:230, flexShrink:0, background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)" }}>
              <div style={{ padding:"13px 14px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--s3)", animation:"blink 1.4s infinite" }}/>
                <div style={{ height:12, width:80, background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
              </div>
              <div style={{ padding:"10px 10px" }}>
                {[1,2].map(j=><div key={j} style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:"var(--r2)", padding:12, marginBottom:8 }}>
                  <div style={{ height:11, width:"80%", background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
                </div>)}
              </div>
            </div>
          ))}
        </div>
      ) : players.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>☑</div>
          <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>No Players Yet</div>
          <div style={{ color:"var(--t3)", fontSize:13 }}>Go to <b style={{color:"var(--acc)"}}>Admin → Roster</b> to add players first</div>
        </div>
      ) : (
        <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:12, alignItems:"flex-start" }}>
          {players.map(p=>(
            <div key={p.id} className="kcol">
              <div style={{ padding:"13px 14px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--acc)", flexShrink:0 }}>{p.av}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                    <div style={{ fontSize:10, color:"var(--t3)" }}>{p.role||"Player"}</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:10, padding:"1px 8px", fontSize:11, fontWeight:700 }}>{(tasks[p.id]||[]).filter(t=>!t.done).length}</span>

                </div>
              </div>
              <div style={{ flex:1, padding:"8px 0", minHeight:80 }}>
                {(tasks[p.id]||[]).length===0 && <div style={{ textAlign:"center", color:"var(--t3)", fontSize:11, padding:"20px 10px" }}>No tasks yet</div>}
                {(tasks[p.id]||[]).map(t=>(
                  <div key={t.id} className="ktask">
                    <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                      <div onClick={()=>toggle(p.id,t.id)}
                        style={{ width:16, height:16, flexShrink:0, marginTop:2, cursor:"pointer",
                          border:`2px solid ${!!t.done?"var(--acc)":"var(--b3)"}`,
                          borderRadius:3, background:!!t.done?"var(--acc)":"transparent",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"background 0.2s ease, border-color 0.2s ease, transform 0.1s ease",
                          transform:"scale(1)" }}
                        onMouseDown={e=>e.currentTarget.style.transform="scale(0.85)"}
                        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
                        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                          style={{ opacity:!!t.done?1:0, transform:!!t.done?"scale(1)":"scale(0.5)", transition:"opacity 0.2s ease, transform 0.2s ease" }}>
                          <polyline points="1.5,5 4,7.5 8.5,2.5" stroke="#080a10" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500, lineHeight:1.4, marginBottom:5, textDecoration:!!t.done?"line-through":"none", color:!!t.done?"var(--t3)":"var(--t1)" }}>{t.title}</div>
                        {t.labels.length>0 && (
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                            {t.labels.map(lname=>{ const lb=labels.find(l=>l.name===lname); if(!lb) return null; return <span key={lname} style={{ padding:"1px 6px", borderRadius:3, fontSize:10, fontWeight:600, background:hex2rgba(lb.color,0.12), color:lb.color, border:`1px solid ${hex2rgba(lb.color,0.25)}` }}>{lname}</span>; })}
                          </div>
                        )}
                        {t.due && <div style={{ fontSize:10, color:"var(--t3)" }}>Due {t.due}</div>}
                      </div>
                      <button onClick={()=>delTask(p.id,t.id)} style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:"2px 4px", flexShrink:0 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {taskModal && (
        <Modal onClose={()=>setTaskModal(false)} title="New Task">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Assigned To</div><select value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}><option value="">— Select player —</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}{p.role?` · ${p.role}`:""}</option>)}</select></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Task title"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Description</div><textarea rows={2} style={{ resize:"none" }} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Due Date</div><input type="date" value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))}/></div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Priority</div>
              <div style={{ display:"flex", gap:8 }}>
                {["Low","Medium","High"].map(p=>(
                  <button key={p} onClick={()=>setForm(f=>({...f,priority:f.priority===p?"":p}))}
                    style={{ flex:1, padding:"6px 0", borderRadius:6, fontWeight:700, fontSize:12, cursor:"pointer", border:`1px solid ${form.priority===p?(p==="High"?"#ff5555":p==="Medium"?"#ffb347":"#69f0ae"):"var(--b2)"}`, background:form.priority===p?(p==="High"?"rgba(255,85,85,0.15)":p==="Medium"?"rgba(255,179,71,0.15)":"rgba(105,240,174,0.15)"):"var(--s3)", color:form.priority===p?(p==="High"?"#ff5555":p==="Medium"?"#ffb347":"#69f0ae"):"var(--t2)", transition:"all 0.15s" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {labels.length>0 && (
              <div>
                <div className="label-sm" style={{ marginBottom:8 }}>Labels</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {labels.map(lb=>{ const on=form.labels.includes(lb.name); return (
                    <button key={lb.name} onClick={()=>setForm(f=>({ ...f, labels:on?f.labels.filter(x=>x!==lb.name):[...f.labels,lb.name] }))}
                      style={{ padding:"4px 10px", borderRadius:5, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                        background:on?hex2rgba(lb.color,0.12):"var(--s3)", color:on?lb.color:"var(--t3)", border:`1px solid ${on?hex2rgba(lb.color,0.3):"var(--b2)"}` }}>
                      {lb.name}
                    </button>
                  ); })}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-ghost" onClick={()=>setTaskModal(false)}>Cancel</button>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addTask} disabled={!form.title.trim()||!form.assignedTo}>Create Task</button>
            </div>
          </div>
        </Modal>
      )}
      {labelModal && (
        <Modal onClose={()=>setLabelModal(false)} title="Manage Labels">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {labels.length>0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {labels.map(lb=>(
                  <div key={lb.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"var(--s2)", borderRadius:"var(--r)", border:"1px solid var(--b1)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:12, height:12, borderRadius:3, background:lb.color, flexShrink:0 }}/>
                      <span style={{ fontSize:13, fontWeight:500 }}>{lb.name}</span>
                    </div>
                    <button onClick={()=>removeLabel(lb.name)} style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:13, padding:"2px 6px", borderRadius:4 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="hr" style={{ margin:"0" }}/>
            <div className="label-sm">New Label</div>
            <input type="text" value={lForm.name} onChange={e=>setLForm(f=>({...f,name:e.target.value}))} placeholder="Label name"/>
            <div><div className="label-sm" style={{ marginBottom:8 }}>Color</div><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{LABEL_COLORS.map(c=><button key={c} onClick={()=>setLForm(f=>({...f,color:c}))} style={{ width:28, height:28, borderRadius:6, background:c, border:`2px solid ${lForm.color===c?"#fff":"transparent"}`, cursor:"pointer", transition:"all 0.15s", outline:"none" }}/>)}</div></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addLabel} disabled={!lForm.name.trim()}>Create Label</button>
              <button className="btn btn-ghost" onClick={()=>setLabelModal(false)}>Done</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}

/* ════ CALENDAR ════ */

/* ════ MENTION SYSTEM ════ */

// Reusable mention-aware textarea
function MentionInput({ value, onChange, onKeyDown, onBlur, placeholder, style, players=[], onMention, autoFocus }) {
  const [mentionSearch, setMentionSearch] = React.useState("");
  const [mentionOpen,   setMentionOpen]   = React.useState(false);
  const [mentionIdx,    setMentionIdx]    = React.useState(0);
  const [caretPos,      setCaretPos]      = React.useState({ top:0, left:0 });
  const ref = React.useRef(null);

  const filtered = players.filter(p => p.name.toLowerCase().startsWith(mentionSearch.toLowerCase())).slice(0,6);

  const handleChange = e => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    // find @ before cursor
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if(match) {
      setMentionSearch(match[1]);
      setMentionOpen(true);
      setMentionIdx(0);
      // position dropdown near the textarea
      const ta = ref.current;
      if(ta) {
        const rect = ta.getBoundingClientRect();
        // Show above if near bottom of screen, below otherwise
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropTop = spaceBelow > 160 ? rect.bottom + 4 : rect.top - 164;
        setCaretPos({ top: dropTop, left: rect.left + 8 });
      }
    } else {
      setMentionOpen(false);
    }
    onChange(e);
  };

  const pickPlayer = (player) => {
    const ta = ref.current;
    if(!ta) return;
    const val = ta.value;
    const cursor = ta.selectionStart;
    const before = val.slice(0, cursor);
    const after  = val.slice(cursor);
    const newBefore = before.replace(/@\w*$/, `@${player.name} `);
    const newVal = newBefore + after;
    onChange({ target: { value: newVal } });
    setMentionOpen(false);
    if(onMention) onMention(player);
    setTimeout(()=>{ ta.focus(); ta.setSelectionRange(newBefore.length, newBefore.length); }, 0);
  };

  const handleKeyDown = e => {
    if(mentionOpen && filtered.length > 0) {
      if(e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i=>Math.min(i+1,filtered.length-1)); return; }
      if(e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i=>Math.max(i-1,0)); return; }
      if(e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickPlayer(filtered[mentionIdx]); return; }
      if(e.key === "Escape")    { setMentionOpen(false); return; }
    }
    if(onKeyDown) onKeyDown(e);
  };

  return (
    <>
      <textarea ref={ref} value={value} onChange={handleChange} onKeyDown={handleKeyDown}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{ ...style, resize:"vertical" }}
        onBlur={e=>{ setTimeout(()=>setMentionOpen(false), 150); if(onBlur) onBlur(e); }}/>
      {mentionOpen && filtered.length > 0 && (
        <div style={{ position:"fixed", top:caretPos.top, left:Math.min(caretPos.left, window.innerWidth - 220), zIndex:9999,
          background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8,
          boxShadow:"0 8px 32px rgba(0,0,0,0.5)", overflow:"visible", minWidth:180, maxWidth:260 }}>
          {filtered.map((p,i)=>(
            <div key={p.id} onMouseDown={()=>pickPlayer(p)}
              style={{ padding:"8px 14px", cursor:"pointer", fontSize:13, fontWeight: i===mentionIdx?700:400,
                background: i===mentionIdx?"var(--s3)":"transparent",
                display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:24, height:24, borderRadius:"50%", background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"#080a10", flexShrink:0 }}>
                {p.name.slice(0,2).toUpperCase()}
              </div>
              <span>@{p.name}</span>
            </div>
          ))}
          <div style={{ padding:"4px 14px 6px", fontSize:10, color:"var(--t3)", borderTop:"1px solid var(--b1)" }}>↑↓ navigate · Enter to pick</div>
        </div>
      )}
    </>
  );
}

// Parse @mentions in text and render with highlight spans
function MentionText({ text, style }) {
  if(!text) return null;
  const parts = text.split(/(@\w+)/g);
  return (
    <span style={style}>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} style={{ color:"var(--acc)", fontWeight:700, background:"rgba(212,255,30,0.08)", borderRadius:3, padding:"0 2px" }}>{part}</span>
        ) : part
      )}
    </span>
  );
}

// Send notifications for all @mentions found in text
// Matches against player.name OR player.username — whichever the user typed
async function sendMentionNotifications(text, context, players) {
  const matches = [...text.matchAll(/@(\w+)/g)];
  for(const match of matches) {
    const name = match[1].toLowerCase();
    // Match by roster name or linked username
    const player = players.find(p =>
      p.name.toLowerCase() === name ||
      (p.username && p.username.toLowerCase() === name)
    );
    if(player && player.username) {
      await api.post("/api/notifications", {
        username: player.username,
        message: `You were mentioned in ${context}`,
        context,
        read: 0,
      }).catch(()=>{});
    }
  }
}

/* ── Calendar Day Panel helpers ── */
function DaySection({ title, color, count, children }) {
  return (
    <div style={{ minWidth:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:12, paddingBottom:10, borderBottom:`2px solid ${color}30` }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }}/>
        <span style={{ fontWeight:800, fontSize:12, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--t2)" }}>{title}</span>
        {count && <span style={{ fontSize:11, color:"var(--t3)", marginLeft:"auto" }}>{count}</span>}
      </div>
      {children}
    </div>
  );
}

function DayGoalRow({ done, label, sub, color, onToggle, onDelete, onEdit }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(label);
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"5px 4px", borderRadius:6, group:"true" }}
      onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div onClick={onToggle} style={{ width:15, height:15, borderRadius:3, flexShrink:0, marginTop:1,
        border:`1.5px solid ${done?color:"var(--b3)"}`, background:done?color:"transparent",
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.2s ease" }}
        onMouseDown={e=>e.currentTarget.style.transform="scale(0.8)"}
        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#080a10" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity:done?1:0, transform:done?"scale(1)":"scale(0.3)", transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {editing
          ? <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
              onBlur={()=>{ setEditing(false); if(val.trim()!==label) onEdit(val.trim()||label); }}
              onKeyDown={e=>{ if(e.key==="Enter"){ setEditing(false); if(val.trim()!==label) onEdit(val.trim()||label); } if(e.key==="Escape"){ setVal(label); setEditing(false); } }}
              style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, padding:"1px 6px", fontSize:14, color:"var(--t1)", outline:"none", fontFamily:"inherit" }}/>
          : <div onDoubleClick={()=>setEditing(true)} style={{ fontSize:14, fontWeight:600, color:done?"var(--t3)":"var(--t1)", textDecoration:done?"line-through":"none", lineHeight:1.4, cursor:"text" }}>{label}</div>
        }
        {sub && <div style={{ fontSize:11, color:"var(--t3)", marginTop:1 }}>{sub}</div>}
      </div>
      <button onClick={e=>{ e.stopPropagation(); onDelete(); }}
        style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:13, padding:"0 4px", opacity:0.5, flexShrink:0, lineHeight:1, transition:"all 0.15s" }}
        onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.color="var(--red)"; }}
        onMouseLeave={e=>{ e.currentTarget.style.opacity="0.5"; e.currentTarget.style.color="var(--t3)"; }}>✕</button>
    </div>
  );
}

function DayAddRow({ placeholder, onAdd, players=[] }) {
  const [val, setVal] = React.useState("");
  const [mentionSearch, setMentionSearch] = React.useState("");
  const [mentionOpen, setMentionOpen]     = React.useState(false);
  const [mentionIdx, setMentionIdx]       = React.useState(0);
  const ref = React.useRef(null);
  const [dropPos, setDropPos] = React.useState({ top:0, left:0 });
  const filtered = players.filter(p=>p.name.toLowerCase().startsWith(mentionSearch.toLowerCase())).slice(0,6);

  const handleChange = e => {
    const v = e.target.value; setVal(v);
    const before = v.slice(0, e.target.selectionStart);
    const m = before.match(/@(\w*)$/);
    if(m){
      setMentionSearch(m[1]); setMentionOpen(true); setMentionIdx(0);
      if(ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setDropPos({ top: spaceBelow > 160 ? rect.bottom + 4 : rect.top - 164, left: Math.min(rect.left, window.innerWidth - 220) });
      }
    }
    else setMentionOpen(false);
  };
  const pick = p => { setVal(v => v.replace(/@\w*$/, `@${p.name} `)); setMentionOpen(false); setTimeout(()=>ref.current?.focus(),0); };
  const handleKey = e => {
    if(mentionOpen&&filtered.length>0){
      if(e.key==="ArrowDown"){e.preventDefault();setMentionIdx(i=>Math.min(i+1,filtered.length-1));return;}
      if(e.key==="ArrowUp"){e.preventDefault();setMentionIdx(i=>Math.max(i-1,0));return;}
      if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();pick(filtered[mentionIdx]);return;}
      if(e.key==="Escape"){setMentionOpen(false);return;}
    }
    if(e.key==="Enter"&&val.trim()){ onAdd(val.trim()); sendMentionNotifications(val.trim(), "scrim goal", players); setVal(""); setMentionOpen(false); }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 4px", marginTop:4, position:"relative" }}>
      <div style={{ width:15, height:15, borderRadius:3, border:"1.5px solid var(--b3)", flexShrink:0 }}/>
      <input ref={ref} value={val} onChange={handleChange} onKeyDown={handleKey}
        placeholder={placeholder} onBlur={()=>setTimeout(()=>setMentionOpen(false),150)}
        style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, color:"var(--t3)", padding:0, fontFamily:"inherit", cursor:"text" }}/>
      {mentionOpen && filtered.length>0 && (
        <div style={{ position:"fixed", top:dropPos.top, left:dropPos.left, zIndex:9999, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, boxShadow:"0 8px 24px rgba(0,0,0,0.5)", overflow:"hidden", minWidth:180 }}>
          {filtered.map((p,i)=>(
            <div key={p.id} onMouseDown={()=>pick(p)} style={{ padding:"7px 12px", cursor:"pointer", fontSize:13, fontWeight:i===mentionIdx?700:400, background:i===mentionIdx?"var(--s3)":"transparent", display:"flex", alignItems:"center", gap:7 }}>
              <div style={{ width:20,height:20,borderRadius:"50%",background:"var(--acc)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#080a10",flexShrink:0 }}>{p.name.slice(0,2).toUpperCase()}</div>
              @{p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DayAddIndGoalRow({ date, onAdd, players }) {
  const [open, setOpen]   = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc]   = React.useState("");
  const [pid, setPid]     = React.useState("");
  const reset = () => { setOpen(false); setTitle(""); setDesc(""); setPid(""); };
  const submit = () => {
    if(!title.trim()) return;
    onAdd(title.trim(), desc.trim(), pid || null);
    reset();
  };
  if(!open) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 4px", marginTop:4 }}>
      <div style={{ width:15, height:15, borderRadius:3, border:"1.5px solid var(--b3)", flexShrink:0 }}/>
      <div onClick={()=>setOpen(true)} style={{ fontSize:12, color:"var(--t3)", cursor:"pointer" }}>Add player goal…</div>
    </div>
  );
  return (
    <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px", marginTop:4 }}>
      {players.length > 0 && (
        <select value={pid} onChange={e=>setPid(e.target.value)}
          style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b1)", borderRadius:4, padding:"5px 8px", fontSize:14, color: pid?"var(--t1)":"var(--t3)", outline:"none", fontFamily:"inherit", marginBottom:6 }}>
          <option value="">— Select player (optional) —</option>
          {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <MentionInput autoFocus value={title} onChange={e=>setTitle(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Goal title (@ to mention)"
        players={players}
        style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b1)", borderRadius:4, padding:"5px 8px", fontSize:14, color:"var(--t1)", outline:"none", fontFamily:"inherit", marginBottom:6, resize:"none", minHeight:32 }}/>
      <MentionInput value={desc} onChange={e=>setDesc(e.target.value)}
        onKeyDown={e=>e.key==="Enter"&&submit()}
        placeholder="Description (optional, @ to mention)"
        players={players}
        style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b1)", borderRadius:4, padding:"5px 8px", fontSize:14, color:"var(--t1)", outline:"none", fontFamily:"inherit", marginBottom:8, resize:"none", minHeight:32 }}/>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button onClick={reset} style={{ background:"none", border:"1px solid var(--b2)", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:"3px 10px", borderRadius:4 }}>Cancel</button>
        <button onClick={submit} disabled={!title.trim()}
          style={{ background: title.trim()?"var(--acc)":"var(--s3)", border:"none", color: title.trim()?"#080a10":"var(--t3)", cursor: title.trim()?"pointer":"default", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:4, transition:"all 0.15s" }}>Add</button>
      </div>
    </div>
  );
}

function DayReflectionEntry({ r, pname, canEdit, canDelete, onDelete, onSave }) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({ mental: r.mental||0, self: r.self_rating??r.self??0, team: r.team_rating??r.team??0, notes: r.notes||"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  if (editing) return (
    <div style={{ background:"#252836", border:"1px solid #ab47bc", borderRadius:8, padding:"10px 12px" }}>
      {pname && <div style={{ fontSize:11, fontWeight:700, color:"#ab47bc", marginBottom:8 }}>{pname}</div>}
      <div style={{ display:"flex", gap:12, marginBottom:10 }}>
        {[["mental","Mental"],["self","Self"],["team","Team"]].map(([k,lbl])=>(
          <div key={k} style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{lbl}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:3 }}>
              {[1,2,3,4,5].map(n=>(
                <div key={n} onClick={()=>set(k,n===form[k]?0:n)} style={{ width:16, height:16, borderRadius:"50%", cursor:"pointer",
                  background: n<=form[k] ? "#ab47bc" : "#1a1f2e", border:`1px solid ${n<=form[k]?"#ab47bc":"#2a3148"}`, transition:"all 0.15s" }}/>
              ))}
            </div>
          </div>
        ))}
      </div>
      <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Notes…" rows={2}
        style={{ width:"100%", background:"#1a1f2e", border:"1px solid #2a3148", borderRadius:4, padding:"6px 8px", fontSize:13, color:"#e3e4e8", outline:"none", fontFamily:"inherit", resize:"vertical", marginBottom:8 }}/>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button onClick={()=>setEditing(false)} style={{ background:"none", border:"1px solid #2d3140", color:"#9aa0b4", cursor:"pointer", fontSize:11, padding:"3px 10px", borderRadius:4 }}>Cancel</button>
        <button onClick={()=>{ onSave({ mental:form.mental, self:form.self, self_rating:form.self, team:form.team, team_rating:form.team, notes:form.notes }); setEditing(false); }}
          style={{ background:"#ab47bc", border:"none", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:4 }}>Save</button>
      </div>
    </div>
  );

  return (
    <div style={{ background:"#252836", border:"1px solid #2d3140", borderRadius:8, padding:"10px 12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {pname && <div style={{ fontSize:11, fontWeight:700, color:"#ab47bc" }}>{pname}</div>}
          <div style={{ display:"flex", gap:16 }}>
            {[["Mental",r.mental],["Self",r.self_rating??r.self],["Team",r.team_rating??r.team]].map(([lbl,val])=>(
              <div key={lbl} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:900, color:"#ab47bc", lineHeight:1 }}>{val||"—"}</div>
                <div style={{ fontSize:9, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em", marginTop:2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:4 }}>
          {canEdit && <button onClick={()=>setEditing(true)} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:11, opacity:0.6 }} onMouseOver={e=>e.currentTarget.style.opacity="1"} onMouseOut={e=>e.currentTarget.style.opacity="0.6"}>✎</button>}
          {canDelete && <button onClick={onDelete} style={{ background:"none", border:"none", color:"#6b7280", cursor:"pointer", fontSize:12, opacity:0.5 }} onMouseOver={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color="#f87171"}} onMouseOut={e=>{e.currentTarget.style.opacity="0.5";e.currentTarget.style.color="#6b7280"}}>✕</button>}
        </div>
      </div>
      {r.notes && <div style={{ fontSize:12, color:"#9aa0b4", lineHeight:1.6, borderTop:"1px solid #2d3140", paddingTop:8 }}>{r.notes}</div>}
    </div>
  );
}

function DayAddReflectionRow({ date, onAdd, players=[], lockedPlayerId=null }) {
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ mental:0, self:0, team:0, notes:"", player_id: lockedPlayerId||"" });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  if(!open) return (
    <button onClick={()=>setOpen(true)} style={{ background:"none", border:"1px dashed var(--b2)", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"8px", borderRadius:8, width:"100%", textAlign:"center" }}>
      + Add My Reflection
    </button>
  );
  return (
    <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"12px" }}>
      {players.length > 0 && !lockedPlayerId && (
        <select value={form.player_id} onChange={e=>set("player_id", e.target.value)}
          style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b1)", borderRadius:4, padding:"5px 8px", fontSize:14, color: form.player_id?"var(--t1)":"var(--t3)", outline:"none", fontFamily:"inherit", marginBottom:10 }}>
          <option value="">— Select player (optional) —</option>
          {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <div style={{ display:"flex", gap:12, marginBottom:10 }}>
        {[["mental","Mental"],["self","Self"],["team","Team"]].map(([k,lbl])=>(
          <div key={k} style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:10, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{lbl}</div>
            <div style={{ display:"flex", justifyContent:"center", gap:3 }}>
              {[1,2,3,4,5].map(n=>(
                <div key={n} onClick={()=>set(k,n===form[k]?0:n)} style={{ width:16, height:16, borderRadius:"50%", cursor:"pointer",
                  background: n<=form[k] ? "#ab47bc" : "var(--s3)", border:`1px solid ${n<=form[k]?"#ab47bc":"var(--b2)"}`,
                  transition:"all 0.15s" }}/>
              ))}
            </div>
          </div>
        ))}
      </div>
      <textarea value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Notes…" rows={2}
        style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b1)", borderRadius:4, padding:"6px 8px", fontSize:14, color:"var(--t1)", outline:"none", fontFamily:"inherit", resize:"vertical", marginBottom:8 }}/>
      <div style={{ display:"flex", gap:6, justifyContent:"flex-end" }}>
        <button onClick={()=>{ setOpen(false); setForm({mental:0,self:0,team:0,notes:"",player_id:lockedPlayerId||""}); }} style={{ background:"none", border:"1px solid var(--b2)", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:"3px 10px", borderRadius:4 }}>Cancel</button>
        <button onClick={()=>{ onAdd(form); setOpen(false); setForm({mental:0,self:0,team:0,notes:"",player_id:lockedPlayerId||""}); }}
          style={{ background:"#ab47bc", border:"none", color:"#fff", cursor:"pointer", fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:4 }}>Save</button>
      </div>
    </div>
  );
}

function CalendarPage({ isAdmin=true, user=null }) {
  const [events, setEvents]           = useState([]);
  const [offset, setOffset]           = useState(0);  // week or month offset
  const [view, setView]               = useState("week"); // "week" | "month"
  const [viewOpen, setViewOpen]       = useState(false);
  const [modal, setModal]             = useState(null);
  const [form, setForm]               = useState({ title:"", time:"18:00", cat:"Scrim" });
  const [selectedDay, setSelectedDay] = useState(null);
  const [scrimGoals, setScrimGoals]   = useState([]);
  const [indGoals, setIndGoals]       = useState([]);
  const [reflections, setReflections] = useState([]);
  const [calLoading, setCalLoading]   = useState(true);
  const [calPlayers, setCalPlayers]   = useState([]);
  const scrollRef = useRef(null);

  useEffect(()=>{
    api.get("/api/events").then(d=>{ if(Array.isArray(d)) setEvents(d); }).catch(()=>{}).finally(()=>setCalLoading(false));
    api.get("/api/scrim-goals").then(d=>{ if(Array.isArray(d)) setScrimGoals(d); }).catch(()=>{});
    api.get("/api/individual-goals").then(d=>{ if(Array.isArray(d)) setIndGoals(d); }).catch(()=>{});
    api.get("/api/reflections").then(d=>{ if(Array.isArray(d)) setReflections(d); }).catch(()=>{});
    api.get("/api/players").then(d=>{ if(Array.isArray(d)) setCalPlayers(d); }).catch(()=>{});
  },[]);

  // Timezone label (e.g. "GMT+08")
  const tzLabel = (() => {
    const off = -new Date().getTimezoneOffset();
    const h = Math.floor(Math.abs(off)/60);
    const m = Math.abs(off)%60;
    return `GMT${off>=0?"+":"-"}${String(h).padStart(2,"0")}${m?":"+String(m).padStart(2,"0"):""}`;
  })();

  // Scroll to show earliest event this week, or current time if no events
  useEffect(()=>{
    if (view==="week" && scrollRef.current) {
      const weekDates = getWeekDays(offset).map(d=>fmt(d));
      const weekEvents = events.filter(e=>weekDates.includes(e.date)&&e.time);
      let scrollHour;
      if (weekEvents.length>0) {
        const earliest = weekEvents.reduce((a,b)=>a.time<b.time?a:b);
        scrollHour = parseInt(earliest.time.split(":")[0],10) - 1;
      } else {
        scrollHour = new Date().getHours() - 1;
      }
      scrollRef.current.scrollTop = Math.max(0, scrollHour * HOUR_H);
    }
  }, [calLoading, view, offset, events.length]);

  // ── Week helpers ──
  const getWeekDays = off => {
    const base=new Date(); const start=new Date(base); const dow=base.getDay();
    start.setDate(base.getDate()-(dow===0?6:dow-1)+off*7);
    return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  };

  // ── Month helpers ──
  const getMonthData = off => {
    const base = new Date();
    const y = base.getFullYear();
    const m = base.getMonth() + off;
    const first = new Date(y, m, 1);
    const last  = new Date(y, m+1, 0);
    // pad to Monday-start grid
    const startDow = first.getDay(); // 0=Sun
    const padBefore = startDow===0 ? 6 : startDow-1;
    const cells = [];
    for(let i=padBefore;i>0;i--){ const d=new Date(first); d.setDate(1-i); cells.push({d,cur:false}); }
    for(let i=1;i<=last.getDate();i++){ cells.push({d:new Date(y,m,i),cur:true}); }
    while(cells.length%7!==0){ const prev=cells[cells.length-1].d; const d=new Date(prev); d.setDate(prev.getDate()+1); cells.push({d,cur:false}); }
    return { cells, label: first.toLocaleDateString("en-US",{month:"long",year:"numeric"}) };
  };

  const days  = getWeekDays(offset);
  const DAYS  = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const fmt   = d => { const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; };
  const today = fmt(new Date());

  // Dynamic nav label
  const navLabel = view==="week"
    ? `${days[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${days[6].toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`
    : getMonthData(offset).label;

  // Time grid constants
  const HOUR_H = 60;
  const TOTAL_H = 24 * HOUR_H;
  const HOURS = Array.from({length:24},(_,i)=>i);

  const timeToY = t => {
    if (!t) return 9 * HOUR_H;
    const [h,m] = t.split(":").map(Number);
    return (h + (m||0)/60) * HOUR_H;
  };

  const nowY = () => {
    const n = new Date();
    return (n.getHours() + n.getMinutes()/60) * HOUR_H;
  };

  const addEvent = date => {
    if(!form.title.trim()) return;
    const color = CAT_COLORS[form.cat]||"#8892aa";
    api.post("/api/events", { ...form, date, color })
      .then(d=>setEvents(p=>[...p, d]))
      .catch(()=>setEvents(p=>[...p, { id:Date.now(), ...form, date, color }]));
    setModal(null); setForm({ title:"", time:"18:00", cat:"Scrim" });
  };

  const delEvent = id => { api.delete(`/api/events/${id}`).catch(()=>{}); setEvents(p=>p.filter(e=>e.id!==id)); };

  // Shared day sidebar — works for both views
  const DayPanel = ({ ds }) => {
    const dayScrimGoals  = scrimGoals.filter(g => g.scrim_date===ds);
    const dayIndGoals    = indGoals.filter(g => g.session_date===ds);
    const dayReflections = reflections.filter(r => r.scrim_date===ds);
    const label = new Date(ds+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    const sgDone = dayScrimGoals.filter(g=>!!g.done).length;

    const toggleSG  = async g => { const u={...g,done:!!g.done?0:1}; setScrimGoals(p=>p.map(x=>x.id===g.id?u:x)); await api.put(`/api/scrim-goals/${g.id}`,u).catch(()=>{}); };
    const deleteSG  = async id => { setScrimGoals(p=>p.filter(x=>x.id!==id)); await api.delete(`/api/scrim-goals/${id}`).catch(()=>{}); };
    const addSG     = async text => { if(!text.trim()) return; const r=await api.post("/api/scrim-goals",{content:text.trim(),scrim_date:ds,done:0}).catch(()=>null); if(r) setScrimGoals(p=>[...p,r]); sendMentionNotifications(text,`Scrim goal: ${ds}`,calPlayers); };
    const toggleIG  = async g => { const u={...g,done:!!g.done?0:1}; setIndGoals(p=>p.map(x=>x.id===g.id?u:x)); await api.put(`/api/individual-goals/${g.id}`,u).catch(()=>{}); };
    const deleteIG  = async id => { setIndGoals(p=>p.filter(x=>x.id!==id)); await api.delete(`/api/individual-goals/${id}`).catch(()=>{}); };
    const deleteRef = async id => { setReflections(p=>p.filter(x=>x.id!==id)); await api.delete(`/api/reflections/${id}`).catch(()=>{}); };

    return (
      <div style={{ position:"fixed", right:0, top:48, bottom:0, width:380, background:"#1e2130", borderLeft:"1px solid #2d3140", zIndex:50, display:"flex", flexDirection:"column", boxShadow:"-4px 0 24px rgba(0,0,0,0.5)", animation:"slideInRight 0.2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 18px 12px", borderBottom:"1px solid #2d3140", flexShrink:0 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:500, color:"#e3e4e8" }}>{label}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:6 }}>
              {events.filter(e=>e.date===ds).map(ev=>(
                <span key={ev.id} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:ev.color, background:ev.color+"18", border:`1px solid ${ev.color}35`, borderRadius:12, padding:"2px 8px" }}>
                  {ev.time} · {ev.title}
                  {(ev.url||ev.cat==="Pracc") && <a href={ev.url||"https://pracc.com/matches"} target="_blank" rel="noopener noreferrer" style={{ color:ev.color, opacity:0.7, textDecoration:"none", fontSize:9 }}>↗</a>}
                </span>
              ))}
            </div>
            {isAdmin && <button onClick={()=>setModal(ds)} style={{ marginTop:8, padding:"4px 12px", border:"1px solid #3d4151", borderRadius:4, background:"transparent", color:"#8ab4f8", cursor:"pointer", fontSize:11, fontWeight:500 }}>+ Add Event</button>}
          </div>
          <button onClick={()=>setSelectedDay(null)} style={{ width:28, height:28, border:"none", background:"transparent", color:"#9aa0b4", cursor:"pointer", fontSize:18, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"16px 18px", display:"flex", flexDirection:"column", gap:20 }}>
          <DaySection title="Scrim Goals" color="#d4ff1e" count={`${sgDone}/${dayScrimGoals.length}`}>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              {dayScrimGoals.map(g => <DayGoalRow key={g.id} done={!!g.done} label={g.content} color="#d4ff1e" onToggle={()=>toggleSG(g)} onDelete={()=>deleteSG(g.id)} onEdit={val=>{ const u={...g,content:val}; setScrimGoals(p=>p.map(x=>x.id===g.id?u:x)); api.put(`/api/scrim-goals/${g.id}`,u).catch(()=>{}); }}/>)}
              <DayAddRow placeholder="Add scrim goal… (@ to mention)" onAdd={addSG} players={calPlayers}/>
            </div>
          </DaySection>
          <DaySection title="Player Goals" color="#4fc3f7" count={`${dayIndGoals.filter(g=>!!g.done).length}/${dayIndGoals.length}`}>
            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
              {dayIndGoals.map(g => { const pname=calPlayers.find(p=>p.id===g.player_id)?.name; return <DayGoalRow key={g.id} done={!!g.done} label={g.title} sub={[pname,g.description].filter(Boolean).join(" · ")||undefined} color="#4fc3f7" onToggle={()=>toggleIG(g)} onDelete={()=>deleteIG(g.id)} onEdit={val=>{ const u={...g,title:val}; setIndGoals(p=>p.map(x=>x.id===g.id?u:x)); api.put(`/api/individual-goals/${g.id}`,u).catch(()=>{}); }}/>; })}
              <DayAddIndGoalRow date={ds} players={calPlayers} onAdd={(title,desc,pid)=>{ api.post("/api/individual-goals",{player_id:pid||null,title,description:desc,progress:0,done:0,session_date:ds,session_label:ds}).then(r=>{ if(r&&r.id) setIndGoals(p=>[...p,r]); }).catch(()=>{}); }}/>
            </div>
          </DaySection>
          <DaySection title="Reflection" color="#ab47bc">
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {dayReflections.map(r => {
                const pname = calPlayers.find(p=>String(p.id)===String(r.player_id))?.name;
                const myPlayer = calPlayers.find(p => p.username === user?.username);
                const isMyReflection = myPlayer && String(r.player_id) === String(myPlayer.id);
                const canEdit = isAdmin || isMyReflection;
                const canDelete = isAdmin || isMyReflection;
                return (
                  <DayReflectionEntry key={r.id} r={r} pname={pname} canEdit={canEdit} canDelete={canDelete}
                    onDelete={()=>deleteRef(r.id)}
                    onSave={updated=>{ const u={...r,...updated}; setReflections(p=>p.map(x=>x.id===r.id?u:x)); api.put(`/api/reflections/${r.id}`,u).catch(()=>{}); }}/>
                );
              })}
              {(() => {
                const myPlayer = calPlayers.find(p => p.username === user?.username);
                const alreadySubmitted = myPlayer && dayReflections.some(r => String(r.player_id) === String(myPlayer.id));
                if (isAdmin) {
                  return <DayAddReflectionRow date={ds} players={calPlayers} onAdd={data=>{ api.post("/api/reflections",{...data,scrim_date:ds,player_id:data.player_id||null}).then(r=>{ if(r&&r.id) setReflections(p=>[...p,r]); }).catch(()=>{}); }}/>;
                } else if (myPlayer && !alreadySubmitted) {
                  return <DayAddReflectionRow date={ds} players={[]} lockedPlayerId={myPlayer.id} onAdd={data=>{ api.post("/api/reflections",{...data,scrim_date:ds,player_id:myPlayer.id}).then(r=>{ if(r&&r.id) setReflections(p=>[...p,r]); }).catch(()=>{}); }}/>;
                }
                return null;
              })()}
            </div>
          </DaySection>
        </div>
      </div>
    );
  };

  const S = {
    wrapper: { display:"flex", flexDirection:"column", height:"calc(100vh - 48px)", background:"#1c1f26", color:"#e3e4e8" },
    topbar:  { display:"flex", alignItems:"center", gap:10, padding:"10px 16px", borderBottom:"1px solid #2d3140", flexShrink:0 },
    todayBtn:{ padding:"7px 16px", border:"1px solid #3d4151", borderRadius:4, background:"transparent", color:"#e3e4e8", cursor:"pointer", fontSize:13, fontWeight:500 },
    navBtn:  { width:30, height:30, border:"none", background:"transparent", color:"#9aa0b4", cursor:"pointer", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:"50%" },
  };

  return (
    <div style={S.wrapper} onClick={()=>{ if(viewOpen) setViewOpen(false); }}>

      {/* ── TOP BAR ── */}
      <div style={S.topbar}>
        <button style={S.todayBtn} onClick={()=>setOffset(0)}>Today</button>
        <button style={S.navBtn} onClick={()=>setOffset(o=>o-1)}>‹</button>
        <button style={S.navBtn} onClick={()=>setOffset(o=>o+1)}>›</button>
        <span style={{ fontSize:20, fontWeight:400, color:"#e3e4e8", marginRight:4 }}>{navLabel}</span>

        {/* View switcher dropdown */}
        <div style={{ position:"relative" }}>
          <button onClick={e=>{ e.stopPropagation(); setViewOpen(o=>!o); }}
            style={{ padding:"7px 14px", border:"1px solid #3d4151", borderRadius:4, background:"transparent", color:"#e3e4e8", cursor:"pointer", fontSize:13, fontWeight:500, display:"flex", alignItems:"center", gap:6 }}>
            {view==="week"?"Week":"Month"}
            <span style={{ fontSize:10, color:"#9aa0b4" }}>▾</span>
          </button>
          {viewOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, background:"#252836", border:"1px solid #2d3140", borderRadius:8, overflow:"hidden", zIndex:200, minWidth:130, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
              {[["week","Week"],["month","Month"]].map(([v,lbl])=>(
                <div key={v} onClick={e=>{ e.stopPropagation(); setView(v); setViewOpen(false); setOffset(0); setSelectedDay(null); }}
                  style={{ padding:"11px 16px", cursor:"pointer", fontSize:13, color:view===v?"#8ab4f8":"#e3e4e8", background:view===v?"rgba(138,180,248,0.08)":"transparent", fontWeight:view===v?600:400 }}
                  onMouseOver={e=>{ if(view!==v) e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}
                  onMouseOut={e=>{ if(view!==v) e.currentTarget.style.background="transparent"; }}>
                  {view===v && <span style={{ marginRight:8, fontSize:11 }}>✓</span>}{lbl}
                </div>
              ))}
            </div>
          )}
        </div>

        {isAdmin && (
          <button onClick={()=>setModal("manual")} style={{ marginLeft:"auto", padding:"8px 18px", border:"none", borderRadius:24, background:"#8ab4f8", color:"#1c1f26", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:18, lineHeight:1 }}>+</span> New Event
          </button>
        )}
      </div>

      {/* ══════════════════════════════
           WEEK VIEW
      ══════════════════════════════ */}
      {view==="week" && (
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
          {/* Time column */}
          <div style={{ width:62, flexShrink:0, borderRight:"1px solid #2d3140", overflowY:"hidden", display:"flex", flexDirection:"column" }}>
            {/* Timezone label above day headers */}
            <div style={{ height:56, flexShrink:0, display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:6 }}>
              <span style={{ fontSize:9, color:"#6b7280", fontWeight:600, letterSpacing:"0.04em" }}>{tzLabel}</span>
            </div>
            {/* Hour labels — synced to scrollable grid */}
            <div style={{ flex:1, overflowY:"hidden" }} ref={el => {
              // mirror scroll of main grid
              if (el && scrollRef.current) {
                const sync = () => { el.scrollTop = scrollRef.current.scrollTop; };
                scrollRef.current.addEventListener("scroll", sync);
              }
            }}>
              {HOURS.map(h=>(
                <div key={h} style={{ height:HOUR_H, display:"flex", alignItems:"flex-start", justifyContent:"flex-end", paddingRight:8, paddingTop:2 }}>
                  {h>0 && <span style={{ fontSize:10, color:"#6b7280", fontWeight:500 }}>
                    {h===12?"12 PM":h<12?`${h} AM`:h===24?"12 AM":`${h-12} PM`}
                  </span>}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #2d3140", flexShrink:0, height:56 }}>
              {days.map((d,i)=>{
                const ds=fmt(d); const isToday=ds===today;
                const hasSG=scrimGoals.some(g=>g.scrim_date===ds);
                const hasIG=indGoals.some(g=>g.session_date===ds);
                const hasRef=reflections.some(r=>r.scrim_date===ds);
                return (
                  <div key={i} style={{ padding:"6px 0 4px", textAlign:"center", borderRight:i<6?"1px solid #2d3140":"none", cursor:"pointer" }}
                    onClick={()=>setSelectedDay(selectedDay===ds?null:ds)}>
                    <div style={{ fontSize:11, fontWeight:500, letterSpacing:"0.08em", color:isToday?"#8ab4f8":"#9aa0b4", marginBottom:4 }}>{DAYS[d.getDay()]}</div>
                    <div style={{ width:32, height:32, borderRadius:"50%", margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"center", background:isToday?"#8ab4f8":"transparent", color:isToday?"#1c1f26":"#e3e4e8", fontSize:18, fontWeight:isToday?700:400 }}>{d.getDate()}</div>
                    {(hasSG||hasIG||hasRef) && (
                      <div style={{ display:"flex", gap:2, justifyContent:"center", marginTop:3 }}>
                        {hasSG  && <div style={{ width:5,height:5,borderRadius:"50%",background:"#d4ff1e" }}/>}
                        {hasIG  && <div style={{ width:5,height:5,borderRadius:"50%",background:"#4fc3f7" }}/>}
                        {hasRef && <div style={{ width:5,height:5,borderRadius:"50%",background:"#ab47bc" }}/>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Scrollable time grid */}
            <div style={{ flex:1, overflowY:"auto", position:"relative", display:"flex" }} ref={scrollRef}>
              <div style={{ position:"absolute", left:0, right:0, top:0, pointerEvents:"none", zIndex:0 }}>
                {HOURS.map(h=><div key={h} style={{ position:"absolute", top:h*HOUR_H, left:0, right:0, borderTop:"1px solid #2a2d3a", height:HOUR_H }}/>)}
              </div>
              {offset===0 && (
                <div style={{ position:"absolute", left:0, right:0, top:nowY(), zIndex:3, pointerEvents:"none" }}>
                  <div style={{ height:2, background:"#ea4335", position:"relative" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"#ea4335", position:"absolute", left:0, top:-4 }}/>
                  </div>
                </div>
              )}
              <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(7,1fr)", height:TOTAL_H, position:"relative" }}>
                {days.map((d,i)=>{
                  const ds=fmt(d); const dayEvents=events.filter(e=>e.date===ds); const isToday=ds===today;
                  return (
                    <div key={i} style={{ position:"relative", borderRight:i<6?"1px solid #2d3140":"none", background:isToday?"rgba(138,180,248,0.03)":"transparent", height:TOTAL_H, cursor:"pointer" }}
                      onClick={()=>{ if(isAdmin) setModal(ds); }}>
                      {dayEvents.map(ev=>(
                        <div key={ev.id}
                          style={{ position:"absolute", top:timeToY(ev.time)+2, left:2, right:2, minHeight:24, background:ev.color+"25", border:`1px solid ${ev.color}60`, borderLeft:`3px solid ${ev.color}`, borderRadius:4, padding:"3px 6px", cursor:"pointer", zIndex:2 }}
                          onClick={e=>e.stopPropagation()}
                          onMouseOver={e=>e.currentTarget.style.filter="brightness(1.3)"}
                          onMouseOut={e=>e.currentTarget.style.filter=""}>
                          <div style={{ fontSize:11, fontWeight:600, color:ev.color, lineHeight:1.3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ev.title}</div>
                          <div style={{ fontSize:10, color:ev.color, opacity:0.75 }}>{ev.time}</div>
                          {(ev.url||ev.cat==="Pracc") && <a href={ev.url||"https://pracc.com/matches"} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ fontSize:9, color:ev.color, opacity:0.8, textDecoration:"none" }}>pracc ↗</a>}
                          {isAdmin && <span onClick={e=>{e.stopPropagation();delEvent(ev.id);}} style={{ position:"absolute", top:3, right:5, cursor:"pointer", color:ev.color, opacity:0.5, fontSize:10 }}>✕</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
           MONTH VIEW
      ══════════════════════════════ */}
      {view==="month" && (()=>{
        const { cells } = getMonthData(offset);
        return (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid #2d3140", flexShrink:0 }}>
              {["MON","TUE","WED","THU","FRI","SAT","SUN"].map(d=>(
                <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:11, fontWeight:500, letterSpacing:"0.08em", color:"#9aa0b4" }}>{d}</div>
              ))}
            </div>
            <div style={{ flex:1, overflowY:"auto" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gridAutoRows:"minmax(100px,1fr)" }}>
                {cells.map(({d,cur},idx)=>{
                  const ds=fmt(d); const isToday=ds===today; const isSelected=selectedDay===ds;
                  const dayEvents=events.filter(e=>e.date===ds);
                  const hasSG=scrimGoals.some(g=>g.scrim_date===ds);
                  const hasIG=indGoals.some(g=>g.session_date===ds);
                  const hasRef=reflections.some(r=>r.scrim_date===ds);
                  return (
                    <div key={idx}
                      style={{ borderRight:"1px solid #2a2d3a", borderBottom:"1px solid #2a2d3a", padding:"6px 8px", cursor:"pointer", background:isSelected?"rgba(138,180,248,0.1)":isToday?"rgba(138,180,248,0.04)":"transparent", transition:"background 0.12s", minHeight:100, display:"flex", flexDirection:"column" }}
                      onClick={()=>setSelectedDay(isSelected?null:ds)}
                      onMouseOver={e=>{ if(!isSelected) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
                      onMouseOut={e=>{ e.currentTarget.style.background=isSelected?"rgba(138,180,248,0.1)":isToday?"rgba(138,180,248,0.04)":"transparent"; }}>
                      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
                        <div style={{ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                          background:isToday?"#8ab4f8":"transparent",
                          color:isToday?"#1c1f26":cur?"#e3e4e8":"#3d4460",
                          fontSize:13, fontWeight:isToday?700:400 }}>
                          {d.getDate()}
                        </div>
                      </div>
                      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:2, overflow:"hidden" }}>
                        {dayEvents.slice(0,3).map(ev=>(
                          <div key={ev.id}
                            style={{ fontSize:11, fontWeight:600, color:ev.color, background:ev.color+"20", borderLeft:`2px solid ${ev.color}`, borderRadius:"0 3px 3px 0", padding:"2px 5px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                            onClick={e=>{ e.stopPropagation(); if(isAdmin) setModal(ds); }}>
                            {ev.time} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length>3 && <div style={{ fontSize:10, color:"#6b7280", paddingLeft:4 }}>+{dayEvents.length-3} more</div>}
                      </div>
                      {(hasSG||hasIG||hasRef) && (
                        <div style={{ display:"flex", gap:3, marginTop:4 }}>
                          {hasSG  && <div style={{ width:5,height:5,borderRadius:"50%",background:"#d4ff1e" }}/>}
                          {hasIG  && <div style={{ width:5,height:5,borderRadius:"50%",background:"#4fc3f7" }}/>}
                          {hasRef && <div style={{ width:5,height:5,borderRadius:"50%",background:"#ab47bc" }}/>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Day detail sidebar — works in both views */}
      {selectedDay && <DayPanel ds={selectedDay}/>}

      {/* New event modal */}
      {modal && (
        <Modal onClose={()=>setModal(null)} title={modal==="manual"?"New Event":`New Event — ${modal}`}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Event title"/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Time</div><input type="text" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} placeholder="19:00"/></div>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Category</div><select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}>{Object.keys(CAT_COLORS).map(c=><option key={c}>{c}</option>)}</select></div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={()=>addEvent(modal==="manual"?today:modal)}>Create Event</button>
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ════ AUTH WRAPPER ════ */
export function AuthApp() {
  const [user, setUser]     = useState(_user);
  const [checking, setChecking] = useState(true);

  useEffect(()=>{
    if (_token) {
      api.get("/auth/me")
        .then(d=>{ if(d.id){ setUser(d); _user=d; localStorage.setItem("ra_user", JSON.stringify(d)); } else { logout(); } })
        .catch(()=>logout())
        .finally(()=>setChecking(false));
    } else { setChecking(false); }
  },[]);

  const login = (token, userData) => {
    _token = token;
    _user  = userData;
    localStorage.setItem("ra_token", token);
    localStorage.setItem("ra_user", JSON.stringify(userData));
    // Bust all cached data on login so we load fresh for this user
    Object.keys(_cache).forEach(k => { delete _cache[k]; delete _cacheTime[k]; });
    setUser(userData);
  };

  const logout = () => {
    _token = null; _user = null;
    localStorage.removeItem("ra_token");
    localStorage.removeItem("ra_user");
    Object.keys(_cache).forEach(k => { delete _cache[k]; delete _cacheTime[k]; });
    setUser(null);
  };

  if (checking) return (
    <div style={{ background:"var(--bg)", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{css}</style>
      <div style={{ color:"var(--t3)", fontSize:13 }}>Loading...</div>
    </div>
  );

  if (!user) return <LoginPage onLogin={login}/>;

  return (
    <HashRouter>
      <AppWithAuth user={user} onLogout={logout}/>
    </HashRouter>
  );
}

function LoginPage({ onLogin }) {
  const [form, setForm]   = useState({ username:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.username.trim() || !form.password.trim()) return;
    setLoading(true); setError("");
    try {
      const d = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) }).then(r=>r.json());
      if (d.token) { onLogin(d.token, d.user); }
      else { setError(d.error || "Login failed"); }
    } catch { setError("Cannot connect to server"); }
    setLoading(false);
  };

  return (
    <div style={{ background:"var(--bg)", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{css}</style>
      <div style={{ width:380 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, background:"var(--acc)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <span className="bc" style={{ fontSize:28, fontWeight:900, color:"#080a10" }}>RA</span>
          </div>
          <div className="bc" style={{ fontSize:32, fontWeight:900, letterSpacing:"0.06em" }}>OUR TEAM</div>
          <div style={{ color:"var(--t3)", fontSize:13, marginTop:4 }}>Team Tracker — Sign in to continue</div>
        </div>
        <div className="card">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Username</div>
              <input type="text" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="username" autoFocus/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Password</div>
              <input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••••"/>
            </div>
            {error && <div style={{ color:"var(--red)", fontSize:12, background:"rgba(255,82,82,0.08)", border:"1px solid rgba(255,82,82,0.2)", borderRadius:"var(--r)", padding:"8px 12px" }}>{error}</div>}
            <button className="btn btn-acc" style={{ justifyContent:"center", padding:"12px", marginTop:4 }} onClick={submit} disabled={loading}>
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </div>
        </div>
        <div style={{ textAlign:"center", marginTop:16, color:"var(--t3)", fontSize:12 }}>Contact your coach if you need an account</div>
      </div>
    </div>
  );
}

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

// Map nav keys to URL paths
const PAGE_TO_PATH = {
  dashboard:"/" , tracker:"/tracker", scrimlog:"/scrimlog", strategy:"/strategy",
  analysis:"/analysis", vod:"/vod", tasks:"/tasks", calendar:"/calendar",
  stratboard:"/stratboard", admin:"/admin", settings:"/settings", ocr:"/ocr",
  sheets:"/sheets", vetoplanner:"/vetoplanner",
};

function AppWithAuth({ user, onLogout }) {
  const [stratTab, setStratTab]     = useState("playbooks");
  const [players, setPlayers]       = useState([]);
  const [notifs, setNotifs]         = useState([]);
  const [notifOpen, setNotifOpen]   = useState(false);
  const [vodDeepLink, setVodDeepLink] = useState(null);
  const isAdmin = user.role === "admin";
  const navigate = useNavigate();
  const location = useLocation();

  const [notifError, setNotifError] = useState(false);

  useEffect(()=>{ api.get("/api/players").then(d=>{ if(Array.isArray(d)) setPlayers(d); }).catch(()=>{}); }, []);

  // Poll notifications every 60s (reduced from 5s to cut origin requests)
  useEffect(()=>{
    const fetchNotifs = () => api.get("/api/notifications")
      .then(d=>{ if(Array.isArray(d)){ setNotifs(d); setNotifError(false); } })
      .catch(()=>setNotifError(true));
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return ()=>clearInterval(interval);
  },[]);

  const unreadCount = notifs.filter(n=>!n.read).length;
  const markAllRead = () => {
    api.post("/api/notifications/read-all").catch(()=>{});
    setNotifs(p=>p.map(n=>({...n,read:1})));
  };

  // setPage shim — lets child components still call setPage("tracker") etc.
  const setPage = useCallback((key) => { navigate(PAGE_TO_PATH[key] || "/"); }, [navigate]);

  const ADMIN_NAV = isAdmin ? [
    { key:"admin",    label:"Admin",    path:"/admin",    icon:"⚙" },
    { key:"settings", label:"Settings", path:"/settings", icon:<SettingsIcon/> },
  ] : [];

  const NAV_WITH_PATHS = NAV.map(n => ({ ...n, path: PAGE_TO_PATH[n.key] || "/" }));

  const curPath = location.pathname;

  return (
    <>
      <style>{css}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
        <aside className="sidebar" style={{ background:"var(--s1)", borderRight:"1px solid var(--b1)", display:"flex", flexDirection:"column", flexShrink:0, zIndex:10 }}>
          <div style={{ padding:"18px 0 14px", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"center", overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, background:"var(--acc)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span className="bc" style={{ fontSize:20, fontWeight:900, color:"#080a10" }}>RA</span>
              </div>
              <div className="sb-text">
                <div className="bc" style={{ fontSize:17, fontWeight:900, letterSpacing:"0.06em" }}>OUR TEAM</div>
                <div className="label-sm">{isAdmin ? "⚙ Admin" : "Player"}</div>
              </div>
            </div>
          </div>
          <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
            {NAV_WITH_PATHS.map(n=>{ const on = curPath===n.path || (n.path!=="/" && curPath.startsWith(n.path)); return (
              <div key={n.key} className={`nav-item${on?" on":""}`} onClick={()=>navigate(n.path)} style={{ marginBottom:2 }} title={n.label}>
                <span className="nav-icon" style={{ fontSize:14, width:22, textAlign:"center", flexShrink:0, color: on?"var(--acc)":"inherit" }}>{n.icon}</span>
                <span className="sb-text" style={{ flex:1 }}>{n.label}</span>
                {n.live && <div className="sb-text ldot"/>}
              </div>
            );})}
          </nav>
          {ADMIN_NAV.length > 0 && (
            <div style={{ borderTop:"1px solid var(--b1)", padding:"6px 8px", flexShrink:0 }}>
              {ADMIN_NAV.map(n=>{ const on = curPath===n.path; return (
                <div key={n.key} className={`nav-item${on?" on":""}`} onClick={()=>navigate(n.path)} style={{ marginBottom:2 }} title={n.label}>
                  <span className="nav-icon" style={{ fontSize:14, width:22, textAlign:"center", flexShrink:0, color: on?"var(--acc)":"var(--t3)" }}>{n.icon}</span>
                  <span className="sb-text" style={{ flex:1, color:"var(--t3)" }}>{n.label}</span>
                </div>
              );})}
            </div>
          )}
          {/* Notification bell */}
          <div style={{ borderTop:"1px solid var(--b1)", padding:"8px 8px 0", flexShrink:0 }}>
            <div className="nav-item" onClick={()=>{ setNotifOpen(o=>!o); if(!notifOpen) markAllRead(); }}
              style={{ marginBottom:0, position:"relative" }}>
              <span className="nav-icon" style={{ fontSize:16, width:22, textAlign:"center", flexShrink:0 }}>
                🔔
              </span>
              <span className="sb-text" style={{ flex:1 }}>Notifications</span>
              {unreadCount>0 && (
                <span style={{ background:"var(--red)", color:"#fff", borderRadius:10, fontSize:10, fontWeight:800, padding:"1px 6px", minWidth:16, textAlign:"center" }}>{unreadCount}</span>
              )}
            </div>

            {/* Dropdown panel */}
            {notifOpen && (
              <div style={{ position:"fixed", bottom:80, left:8, width:300, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.6)", zIndex:999, overflow:"hidden" }}>
                <div style={{ padding:"12px 16px 10px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>Notifications</span>
                  <button onClick={markAllRead} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11 }}>Mark all read</button>
                </div>
                <div style={{ maxHeight:320, overflowY:"auto" }}>
                  {notifError ? (
                    <div style={{ padding:"20px 16px", textAlign:"center", fontSize:12 }}>
                      <div style={{ color:"var(--red)", fontWeight:700, marginBottom:4 }}>⚠ Notifications unavailable</div>
                      <div style={{ color:"var(--t3)", fontSize:11 }}>Deploy the latest index.js to enable this feature</div>
                    </div>
                  ) : notifs.length===0 ? (
                    <div style={{ padding:"24px 16px", textAlign:"center", color:"var(--t3)", fontSize:13 }}>No notifications yet</div>
                  ) : notifs.slice(0,20).map(n=>(
                    <div key={n.id} onClick={()=>{ setNotifOpen(false); navigate("/calendar"); }}
                      style={{ padding:"10px 16px", borderBottom:"1px solid var(--b1)", background:n.read?"transparent":"rgba(212,255,30,0.04)", display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", transition:"background 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--s2)"}
                      onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":"rgba(212,255,30,0.04)"}>
                      <span style={{ fontSize:16, flexShrink:0 }}>💬</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, lineHeight:1.4 }}>{n.message}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</div>
                      </div>
                      {!n.read && <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--acc)", flexShrink:0, marginTop:4 }}/>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding:"10px 8px", flexShrink:0, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:isAdmin?"var(--acc)":"var(--s3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:isAdmin?"#080a10":"var(--t2)", flexShrink:0 }}>
                {user.username.slice(0,2).toUpperCase()}
              </div>
              <div className="sb-text" style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{user.username}</div>
                <div style={{ fontSize:10, color:"var(--t3)", whiteSpace:"nowrap" }}>{user.role}</div>
              </div>
              <button onClick={onLogout} style={{ background:"transparent", border:"1px solid var(--b2)", color:"var(--t3)", cursor:"pointer", fontSize:11, fontWeight:600, padding:"4px 10px", borderRadius:4, whiteSpace:"nowrap", letterSpacing:"0.03em", flexShrink:0, display:"none" }} className="sb-logout" title="Sign out" onMouseEnter={e=>{e.target.style.color="var(--red)";e.target.style.borderColor="var(--red)";}} onMouseLeave={e=>{e.target.style.color="var(--t3)";e.target.style.borderColor="var(--b2)";}}>Sign out</button>
            </div>
          </div>
        </aside>
        <main className="fade-up" style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
          <Routes>
            <Route path="/"           element={<Dashboard setPage={setPage} user={user} setVodDeepLink={setVodDeepLink}/>}/>
            <Route path="/tracker"    element={<LiveTracker players={players} setPage={setPage}/>}/>
            <Route path="/ocr"        element={<OCRScanner setPage={setPage}/>}/>
            <Route path="/scrimlog"   element={<ScrimLog setPage={setPage}/>}/>
            <Route path="/strategy"   element={<Strategy tab={stratTab} setTab={setStratTab} isAdmin={isAdmin}/>}/>
            <Route path="/strategy/:playbookId" element={<Strategy tab={stratTab} setTab={setStratTab} isAdmin={isAdmin}/>}/>
            <Route path="/analysis"   element={<DataAnalysis players={players}/>}/>
            <Route path="/vod"        element={<VodReview deepScrimId={vodDeepLink} onDeepLinkConsumed={()=>setVodDeepLink(null)}/>}/>
            <Route path="/tasks"      element={<Tasks players={players} setPlayers={setPlayers} isAdmin={isAdmin}/>}/>
            <Route path="/calendar"   element={<CalendarPage isAdmin={isAdmin} user={user}/>}/>
            {isAdmin && <Route path="/admin"    element={<AdminPanel/>}/>}
            {isAdmin && <Route path="/settings" element={<SettingsPage/>}/>}
            <Route path="/stratboard" element={<StratBoardPage isAdmin={isAdmin}/>}/>
            <Route path="/sheets"     element={<SheetsPage isAdmin={isAdmin}/>}/>
            <Route path="/vetoplanner" element={<VetoPlannerPage/>}/>
            <Route path="*"           element={<Dashboard setPage={setPage} user={user} setVodDeepLink={setVodDeepLink}/>}/>
          </Routes>
        </main>
      </div>
    </>
  );
}

/* ════ SETTINGS PAGE ════ */
function SettingsPage() {
  const [apiKey, setApiKey]     = useState("");
  const [saved, setSaved]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const token = localStorage.getItem("ra_token") || "";

  useEffect(() => {
    api.get("/api/settings").then(d => {
      if (d?.henrik_api_key) setApiKey(d.henrik_api_key);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async () => {
    await api.put("/api/settings/henrik_api_key", { value: apiKey.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 2000);
  };

  return (
    <div style={{ padding:"28px 32px", maxWidth:600 }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>SETTINGS</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:28 }}>App configuration & integrations</div>

      <div className="card" style={{ padding:"24px", marginBottom:16 }}>
        <div className="bc" style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>RA Recorder — Auth Token</div>
        <div style={{ color:"var(--t2)", fontSize:13, marginBottom:16, lineHeight:1.6 }}>
          Used by the <b style={{color:"var(--t1)"}}>RA Recorder</b> desktop app to save scrims automatically.
          Paste this into the app the first time you save a scrim.
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input
            type={showToken ? "text" : "password"}
            readOnly
            value={token}
            style={{ flex:1, fontFamily:"monospace", fontSize:11, color:"var(--t2)", cursor:"default" }}
          />
          <button className="btn btn-ghost" onClick={()=>setShowToken(s=>!s)} style={{padding:"4px 10px",fontSize:11}}>
            {showToken ? "Hide" : "Show"}
          </button>
          <button className="btn btn-acc" onClick={copyToken} style={{padding:"4px 14px",fontSize:11}}>
            {tokenCopied ? "✓ Copied" : "Copy"}
          </button>
        </div>
        <div style={{ fontSize:11, color:"var(--t3)", marginTop:8 }}>
          ⚠ Keep this private — it gives access to your RA account.
        </div>
      </div>

      <div className="card" style={{ padding:"24px" }}>
        <div className="bc" style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>HenrikDev API Key</div>
        <div style={{ color:"var(--t2)", fontSize:13, marginBottom:16, lineHeight:1.6 }}>
          Used to auto-import scrim data from Riot. Save it here once and you'll never need to paste it into the import modal again.
          Get a free key at <a href="https://dash.henrikdev.xyz" target="_blank" rel="noreferrer" style={{ color:"var(--acc)" }}>dash.henrikdev.xyz</a>.
        </div>
        {loading ? (
          <div style={{ color:"var(--t3)", fontSize:13 }}>Loading…</div>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <input
              type="password"
              placeholder="HDEV-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ flex:1 }}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setSaved(false); }}
            />
            <button className="btn btn-acc" onClick={save} disabled={!apiKey.trim()}>
              {saved ? "✓ Saved" : "Save"}
            </button>
          </div>
        )}
        {saved && <div style={{ color:"var(--green)", fontSize:12, marginTop:8 }}>✓ API key saved successfully</div>}
      </div>
    </div>
  );
}

/* ════ SHEETS PAGE ════ */
function SheetsPage({ isAdmin }) {
  const [url, setUrl] = React.useState("");
  const [input, setInput] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  // Load from DB on mount — applies to all users
  React.useEffect(() => {
    api.get("/api/settings").then(d => {
      const saved = d?.sheets_url || "";
      if (saved) {
        const embed = toEmbedUrl(saved);
        setUrl(embed || saved);
      }
      setInput(saved);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toEmbedUrl = (raw) => {
    try {
      const match = raw.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) return null;
      const id = match[1];
      const gidMatch = raw.match(/gid=(\d+)/);
      const gid = gidMatch ? gidMatch[1] : "0";
      return `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing&rm=minimal&gid=${gid}`;
    } catch { return null; }
  };

  const handleLoad = () => {
    const embed = toEmbedUrl(input.trim());
    if (!embed) { setError("Invalid Google Sheets URL"); return; }
    setError("");
    setUrl(embed);
    api.put("/api/settings/sheets_url", { value: input.trim() }).catch(() => {});
  };

  const handleClear = () => {
    setUrl(""); setInput(""); setError("");
    api.put("/api/settings/sheets_url", { value: "" }).catch(() => {});
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"var(--bg)" }}>
      {/* Header bar */}
      <div style={{ padding:"16px 28px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", gap:12, flexShrink:0, background:"var(--s1)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        <span className="bc" style={{ fontSize:20, fontWeight:800, letterSpacing:"0.04em" }}>SHEETS</span>
        {isAdmin ? (
          <>
            <div style={{ flex:1, display:"flex", gap:8, marginLeft:16 }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLoad()}
                placeholder="Paste Google Sheets URL…"
                style={{ flex:1, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", padding:"7px 14px", fontSize:13, color:"var(--t1)", outline:"none", fontFamily:"inherit" }}
              />
              <button className="btn btn-acc" onClick={handleLoad} style={{ padding:"7px 18px", fontWeight:700 }}>Load</button>
              {url && <button className="btn btn-ghost" onClick={handleClear} style={{ padding:"7px 14px" }}>✕ Clear</button>}
            </div>
            {error && <span style={{ color:"var(--red)", fontSize:12 }}>{error}</span>}
          </>
        ) : (
          <span style={{ fontSize:12, color:"var(--t3)", marginLeft:8 }}>View only</span>
        )}
      </div>
      {/* Sheet iframe or empty state */}
      {loading ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"var(--t3)" }}>Loading…</div>
      ) : url ? (
        <iframe
          src={url}
          style={{ flex:1, border:"none", width:"100%", height:"100%" }}
          allow="clipboard-read; clipboard-write"
          title="Google Sheet"
        />
      ) : (
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, color:"var(--t3)" }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No sheet loaded</div>
            <div style={{ fontSize:13 }}>{isAdmin ? "Paste a Google Sheets link above and hit Load" : "An admin hasn't set a sheet yet"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ════ ADMIN PANEL ════ */
function AdminPanel() {
  const [tab, setTab]         = useState("users");
  const [users, setUsers]     = useState([]);
  const [players, setPlayers] = useState([]);
  const [modal, setModal]     = useState(false);
  const [pwModal, setPwModal] = useState(null);
  const [playerModal, setPlayerModal] = useState(false);
  const [editPlayer, setEditPlayer]   = useState(null);
  const [form, setForm]       = useState({ username:"", password:"", role:"player" });
  const [pwForm, setPwForm]   = useState({ password:"" });
  const [pForm, setPForm]     = useState({ name:"", ign:"", role:"", username:"" });
  const [error, setError]     = useState("");
  const [msg, setMsg]         = useState("");

  // ── Review keywords state ──
  const [keywords, setKeywords] = useState(["review","follow-up","vod","plan","prep","analysis"]);
  const [kwInput, setKwInput]   = useState("");
  const [kwLoaded, setKwLoaded] = useState(false);

  // ── Tracker keys state ──
  const [trackerKeys, setTrackerKeys]   = useState([]);
  const [tkForm, setTkForm]             = useState({ label:"", riot_id:"" });
  const [newKey, setNewKey]             = useState(null); // freshly generated key to show once
  const [tkLoading, setTkLoading]       = useState(false);

  useEffect(()=>{ loadUsers(); loadPlayers(); },[]);
  const loadUsers   = () => api.get("/auth/users").then(d=>{ if(Array.isArray(d)) setUsers(d); });
  const loadPlayers = () => api.get("/api/players").then(d=>{ if(Array.isArray(d)) setPlayers(d); });
  const loadTrackerKeys = () => api.get("/api/tracker-keys").then(d=>{ if(Array.isArray(d)) setTrackerKeys(d); });

  useEffect(()=>{ if(tab==="tracker") loadTrackerKeys(); },[tab]);
  useEffect(()=>{
    if(tab==="keywords" && !kwLoaded){
      api.get("/api/settings").then(d=>{
        if(d?.review_keywords){ try{ const kw=JSON.parse(d.review_keywords); if(Array.isArray(kw)) setKeywords(kw); }catch{} }
        setKwLoaded(true);
      }).catch(()=>setKwLoaded(true));
    }
  },[tab]);

  const flash = (m, isError=false) => { if(isError) setError(m); else setMsg(m); setTimeout(()=>{ setError(""); setMsg(""); },3000); };

  // ── Tracker key actions ──
  const generateKey = async () => {
    if(!tkForm.label.trim()) return flash("Enter a label first", true);
    setTkLoading(true);
    const d = await api.post("/api/tracker-keys", tkForm).catch(e=>({ error: e.message }));
    setTkLoading(false);
    if(d?.error) return flash(d.error, true);
    setNewKey(d.key);
    setTkForm({ label:"", riot_id:"" });
    loadTrackerKeys();
  };
  const revokeKey = async (id) => {
    if(!confirm("Revoke this tracker key? The player will need a new one.")) return;
    await api.delete(`/api/tracker-keys/${id}`).catch(()=>{});
    loadTrackerKeys();
    flash("Key revoked");
  };

  // ── Sign out all sessions ──
  const signOutAll = async () => {
    if(!confirm("This will sign out ALL users including yourself. Continue?")) return;
    const d = await api.post("/auth/revoke-all", {}).catch(()=>null);
    if(d?.success) { flash("All sessions revoked — signing out now."); setTimeout(()=>{ localStorage.clear(); window.location.reload(); }, 1500); }
    else flash(d?.error||"Failed", true);
  };

  // ── User actions ──
  const createUser = async () => {
    if(!form.username.trim()||!form.password.trim()) return;
    const d = await api.post("/auth/users", form);
    if(d.success) { flash("User created!"); setModal(false); setForm({ username:"", password:"", role:"player" }); loadUsers(); }
    else flash(d.error||"Failed", true);
  };
  const resetPw = async () => {
    if(!pwForm.password.trim()) return;
    const d = await api.post(`/auth/users/${pwModal.id}/reset-password`, { password:pwForm.password });
    if(d.success) { flash("Password reset!"); setPwModal(null); setPwForm({ password:"" }); }
    else flash(d.error||"Failed", true);
  };
  const ban = async (u) => {
    const d = await api.post(`/auth/users/${u.id}/${u.is_banned?"unban":"ban"}`, {});
    if(d.success) { flash(u.is_banned?"User unbanned":"User banned"); loadUsers(); }
    else flash(d.error||"Failed", true);
  };
  const delUser = async (u) => {
    if(!confirm(`Delete user "${u.username}"?`)) return;
    const d = await api.delete(`/auth/users/${u.id}`);
    if(d.success) { flash("User deleted"); loadUsers(); }
    else flash(d.error||"Failed", true);
  };

  // ── Player (roster) actions ──
  const openAddPlayer = () => { setPForm({ name:"", ign:"", role:"", username:"", aliases:[] }); setEditPlayer(null); setPlayerModal(true); };
  const openEditPlayer = (p) => { setPForm({ name:p.name, ign:p.ign||"", role:p.role||"", username:p.username||"", aliases: (() => { try { return Array.isArray(p.aliases) ? p.aliases : JSON.parse(p.aliases||"[]"); } catch { return []; } })() }); setEditPlayer(p); setPlayerModal(true); };
  const savePlayer = async () => {
    if(!pForm.name.trim()) return;
    const av = pForm.name.slice(0,2).toUpperCase();
    const payload = { ...pForm, av, aliases: JSON.stringify(pForm.aliases||[]) };
    if(editPlayer) {
      const d = await api.put(`/api/players/${editPlayer.id}`, payload).catch(()=>null);
      if(d) { flash("Player updated!"); loadPlayers(); setPlayerModal(false); }
      else flash("Failed to update", true);
    } else {
      const d = await api.post("/api/players", payload).catch(()=>null);
      if(d) { flash("Player added!"); loadPlayers(); setPlayerModal(false); }
      else flash("Failed to add", true);
    }
  };
  const delPlayer = async (p) => {
    if(!confirm(`Remove "${p.name}" from roster? This will also delete their tasks and goals.`)) return;
    await api.delete(`/api/players/${p.id}`).catch(()=>{});
    flash("Player removed"); loadPlayers();
  };

  const ROLES = ["IGL","Entry","Duelist","Initiator","Controller","Sentinel","Flex","Support","Coach"];

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>ADMIN PANEL</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>Manage team accounts, roster and access</div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <button className="btn btn-red" style={{ fontSize:12 }} onClick={signOutAll}>⏻ Sign Out All</button>
          {tab==="users"
            ? <button className="btn btn-acc" onClick={()=>setModal(true)}>+ Create User</button>
            : tab==="roster" ? <button className="btn btn-acc" onClick={openAddPlayer}>+ Add Player</button>
            : tab==="keywords" ? null
            : null}
        </div>
      </div>

      <div className="tab-bar" style={{ maxWidth:400, marginBottom:24 }}>
        <button className={`tab${tab==="users"?" on":""}`}   onClick={()=>setTab("users")}>Users</button>
        <button className={`tab${tab==="roster"?" on":""}`}  onClick={()=>setTab("roster")}>Roster</button>
        <button className={`tab${tab==="tracker"?" on":""}`} onClick={()=>setTab("tracker")}>🖥 Tracker Keys</button>
        <button className={`tab${tab==="keywords"?" on":""}`} onClick={()=>setTab("keywords")}>🏷 Keywords</button>
      </div>

      {msg && <div style={{ background:"rgba(105,240,174,0.1)", border:"1px solid rgba(105,240,174,0.3)", borderRadius:"var(--r)", padding:"10px 14px", marginBottom:16, color:"var(--green)", fontSize:13 }}>{msg}</div>}
      {error && <div style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)", borderRadius:"var(--r)", padding:"10px 14px", marginBottom:16, color:"var(--red)", fontSize:13 }}>{error}</div>}

      {tab==="users" && (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="tbl">
            <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.id}>
                  <td>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:u.role==="admin"?"var(--acc)":"var(--s3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:u.role==="admin"?"#080a10":"var(--t2)", flexShrink:0 }}>
                        {u.username.slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight:600 }}>{u.username}</span>
                    </div>
                  </td>
                  <td><span className={`chip ${u.role==="admin"?"chip-acc":"chip-blue"}`}>{u.role}</span></td>
                  <td><span className={`chip ${u.is_banned?"chip-red":"chip-green"}`}>{u.is_banned?"Banned":"Active"}</span></td>
                  <td style={{ color:"var(--t3)", fontSize:12 }}>{u.last_login?new Date(u.last_login).toLocaleDateString():"Never"}</td>
                  <td style={{ color:"var(--t3)", fontSize:12 }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display:"flex", gap:6 }}>
                      <button className="btn btn-ghost" style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>{ setPwModal(u); setPwForm({ password:"" }); }}>Reset PW</button>
                      {u.role!=="admin" && <button className={`btn ${u.is_banned?"btn-sub":"btn-red"}`} style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>ban(u)}>{u.is_banned?"Unban":"Ban"}</button>}
                      {u.role!=="admin" && <button className="btn btn-red" style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>delUser(u)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="roster" && (
        <>
          {players.length === 0 ? (
            <div className="card" style={{ padding:"56px", textAlign:"center", color:"var(--t3)" }}>
              <div style={{ fontSize:32, marginBottom:10 }}>👥</div>
              <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6, fontSize:16 }}>No players yet</div>
              <div style={{ fontSize:13, marginBottom:20 }}>Add your team roster — players appear in Tasks, Goals & Debrief, and Stats</div>
              <button className="btn btn-acc" onClick={openAddPlayer}>+ Add First Player</button>
            </div>
          ) : (
            <div className="card" style={{ padding:0, overflow:"hidden" }}>
              <table className="tbl">
                <thead><tr><th>Player</th><th>IGN</th><th>Linked User</th><th>Role</th><th>Actions</th></tr></thead>
                <tbody>
                  {players.map(p=>(
                    <tr key={p.id}>
                      <td>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:"50%", background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"var(--acc)", flexShrink:0 }}>
                            {(p.av||p.name.slice(0,2)).toUpperCase()}
                          </div>
                          <span style={{ fontWeight:600 }}>{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize:12, color:"var(--t2)" }}>{p.ign||<span style={{color:"var(--t3)"}}>—</span>}</span>
                        {(() => { try { const al = Array.isArray(p.aliases)?p.aliases:JSON.parse(p.aliases||"[]"); return al.length>0 ? <span style={{fontSize:11,color:"var(--t3)",marginLeft:6}}>+{al.length} alias{al.length>1?"es":""}</span> : null; } catch { return null; } })()}
                      </td>
                      <td><span style={{ fontSize:12, color: p.username?"var(--acc)":"var(--t3)" }}>{p.username||"—"}</span></td>
                      <td>{p.role ? <span className="chip chip-blue">{p.role}</span> : <span style={{color:"var(--t3)", fontSize:12}}>—</span>}</td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn btn-ghost" style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>openEditPlayer(p)}>Edit</button>
                          <button className="btn btn-red" style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>delPlayer(p)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab==="tracker" && (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

          {/* Download tracker */}
          <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:4 }}>RA Tracker App</div>
              <div style={{ fontSize:12, color:"var(--t3)" }}>Download and run this on the player's PC. It auto-uploads matches after every game.</div>
            </div>
            <a href="https://github.com/Ratiod/tracker-/releases/tag/1.0.0" download style={{ textDecoration:"none" }}>
              <button className="btn btn-acc" style={{ gap:8 }}>⬇ Download RA.Tracker.Setup.exe</button>
            </a>
          </div>

          {/* Generate new key */}
          <div className="card">
            <div style={{ fontSize:13, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:14 }}>Generate Tracker Key</div>
            <div style={{ display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:160 }}>
                <div className="label-sm" style={{ marginBottom:6 }}>Label</div>
                <input type="text" value={tkForm.label} onChange={e=>setTkForm(f=>({...f,label:e.target.value}))} placeholder="e.g. Boaster's PC"/>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <div className="label-sm" style={{ marginBottom:6 }}>Riot ID (optional)</div>
                <input type="text" value={tkForm.riot_id} onChange={e=>setTkForm(f=>({...f,riot_id:e.target.value}))} placeholder="Name#TAG"/>
              </div>
              <button className="btn btn-acc" onClick={generateKey} disabled={tkLoading} style={{ flexShrink:0 }}>
                {tkLoading ? "Generating…" : "Generate Key"}
              </button>
            </div>

            {/* Show newly generated key once */}
            {newKey && (
              <div style={{ marginTop:16, background:"rgba(212,255,30,0.06)", border:"1px solid rgba(212,255,30,0.25)", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--acc)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>
                  ✓ Key Generated — Copy it now, it won't be shown again
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <code style={{ flex:1, fontFamily:"monospace", fontSize:13, color:"var(--t1)", background:"var(--s3)", borderRadius:6, padding:"8px 12px", wordBreak:"break-all" }}>{newKey}</code>
                  <button className="btn btn-ghost" style={{ flexShrink:0 }} onClick={()=>{ navigator.clipboard.writeText(newKey); flash("Copied!"); }}>Copy</button>
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:8 }}>
                  Give this key + the RA Tracker exe to the player. They enter it in the app along with the API URL.
                </div>
                <div style={{ marginTop:10, background:"var(--s2)", borderRadius:6, padding:"10px 12px", fontSize:12, color:"var(--t2)" }}>
                  <div style={{ marginBottom:4 }}><span style={{ color:"var(--t3)" }}>API URL:</span> <code style={{ fontFamily:"monospace", color:"var(--acc)" }}>https://tracker2-ten.vercel.app</code></div>
                  <div><span style={{ color:"var(--t3)" }}>API Key:</span> <code style={{ fontFamily:"monospace", color:"var(--acc)" }}>{newKey}</code></div>
                </div>
                <button className="btn btn-ghost" style={{ marginTop:10, fontSize:11 }} onClick={()=>setNewKey(null)}>Dismiss</button>
              </div>
            )}
          </div>

          {/* Active keys list */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--b1)", fontSize:13, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
              Active Keys
            </div>
            {trackerKeys.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:"var(--t3)", fontSize:13 }}>No tracker keys yet — generate one above</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>Label</th><th>Riot ID</th><th>Key</th><th>Created</th><th>Last Used</th><th>Actions</th></tr></thead>
                <tbody>
                  {trackerKeys.map(k => (
                    <tr key={k.id}>
                      <td style={{ fontWeight:600 }}>{k.label || <span style={{color:"var(--t3)"}}>—</span>}</td>
                      <td><span className="mono" style={{ fontSize:12, color:"var(--t2)" }}>{k.riot_id || <span style={{color:"var(--t3)"}}>—</span>}</span></td>
                      <td><code style={{ fontFamily:"monospace", fontSize:11, color:"var(--t3)", background:"var(--s3)", padding:"2px 6px", borderRadius:4 }}>{k.key_preview}</code></td>
                      <td style={{ fontSize:12, color:"var(--t3)" }}>{new Date(k.created_at).toLocaleDateString()}</td>
                      <td style={{ fontSize:12, color: k.last_used ? "var(--green)" : "var(--t3)" }}>
                        {k.last_used ? new Date(k.last_used).toLocaleDateString() : "Never"}
                      </td>
                      <td>
                        <button className="btn btn-red" style={{ padding:"3px 9px", fontSize:11 }} onClick={()=>revokeKey(k.id)}>Revoke</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Instructions */}
          <div className="card" style={{ background:"var(--s2)", border:"1px solid var(--b1)" }}>
            <div style={{ fontSize:12, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:10 }}>How It Works</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:13, color:"var(--t3)", lineHeight:1.6 }}>
              <div><span style={{ color:"var(--t2)", fontWeight:600 }}>1.</span> Generate a key above and give it to the player running the tracker.</div>
              <div><span style={{ color:"var(--t2)", fontWeight:600 }}>2.</span> They install <span style={{ color:"var(--acc)", fontWeight:600 }}>RA Tracker.exe</span>, enter the API URL + key + their Riot ID, and hit Connect.</div>
              <div><span style={{ color:"var(--t2)", fontWeight:600 }}>3.</span> After every Valorant match the tracker auto-uploads it — no manual JSON needed.</div>
              <div><span style={{ color:"var(--t2)", fontWeight:600 }}>4.</span> Matches appear in the Scrim Log automatically. Only one player needs to run it per session.</div>
            </div>
          </div>
        </div>
      )}

      {tab==="keywords" && (
        <div style={{ maxWidth:560 }}>
          <div className="card" style={{ padding:"18px 20px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--t2)", marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase" }}>Review &amp; Follow-up Keywords</div>
            <div style={{ fontSize:12, color:"var(--t3)", marginBottom:14 }}>Tasks whose title or description match any of these keywords will appear in the Review &amp; Follow-up queue on the dashboard.</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
              {keywords.map((kw,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5, background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6, padding:"4px 10px" }}>
                  <span style={{ fontSize:12, color:"var(--t1)", fontWeight:600 }}>{kw}</span>
                  <span onClick={async()=>{
                    const next = keywords.filter((_,j)=>j!==i);
                    setKeywords(next);
                    await api.put("/api/settings/review_keywords",{ value:JSON.stringify(next) }).catch(()=>{});
                    flash("Keywords saved");
                  }} style={{ fontSize:12, color:"var(--t3)", cursor:"pointer", lineHeight:1, padding:"0 2px" }}
                  onMouseOver={e=>e.currentTarget.style.color="var(--red)"}
                  onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>x</span>
                </div>
              ))}
              {keywords.length===0 && <span style={{ fontSize:12, color:"var(--t3)" }}>No keywords set.</span>}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={kwInput}
                onChange={e=>setKwInput(e.target.value)}
                onKeyDown={async e=>{
                  if(e.key==="Enter"&&kwInput.trim()){
                    const next=[...keywords, kwInput.trim().toLowerCase()];
                    setKeywords(next); setKwInput("");
                    await api.put("/api/settings/review_keywords",{ value:JSON.stringify(next) }).catch(()=>{});
                    flash("Keywords saved");
                  }
                }}
                placeholder="Add keyword (press Enter)"
                style={{ flex:1, background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, color:"var(--t1)", padding:"8px 12px", fontSize:13, outline:"none" }}/>
              <button className="btn btn-acc" onClick={async()=>{
                if(!kwInput.trim()) return;
                const next=[...keywords, kwInput.trim().toLowerCase()];
                setKeywords(next); setKwInput("");
                await api.put("/api/settings/review_keywords",{ value:JSON.stringify(next) }).catch(()=>{});
                flash("Keywords saved");
              }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User modal */}
      {modal && (
        <Modal onClose={()=>setModal(false)} title="Create User">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Username</div><input type="text" value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} placeholder="e.g. player1"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Password</div><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Temporary password"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Role</div>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                <option value="player">Player</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={createUser}>Create</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset PW modal */}
      {pwModal && (
        <Modal onClose={()=>setPwModal(null)} title={`Reset Password — ${pwModal.username}`}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>New Password</div><input type="password" value={pwForm.password} onChange={e=>setPwForm({ password:e.target.value })} placeholder="New password (min 4 chars)"/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={resetPw}>Reset Password</button>
              <button className="btn btn-ghost" onClick={()=>setPwModal(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add/Edit Player modal */}
      {playerModal && (
        <Modal onClose={()=>setPlayerModal(false)} title={editPlayer ? "Edit Player" : "Add Player"}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Name</div><input autoFocus type="text" value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="Display name"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>IGN</div><input type="text" value={pForm.ign} onChange={e=>setPForm(f=>({...f,ign:e.target.value}))} placeholder="name#tag — used for stat auto-matching"/></div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Alt Accounts / Aliases</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:6 }}>
                {(pForm.aliases||[]).map((a,i)=>(
                  <span key={i} style={{ display:"flex", alignItems:"center", gap:4, background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:4, padding:"2px 8px", fontSize:12, fontFamily:"monospace" }}>
                    {a}
                    <span onClick={()=>setPForm(f=>({...f,aliases:f.aliases.filter((_,j)=>j!==i)}))} style={{ cursor:"pointer", color:"var(--t3)", fontFamily:"sans-serif", marginLeft:2 }}>×</span>
                  </span>
                ))}
              </div>
              <input type="text" placeholder="Add alias name#tag and press Enter"
                onKeyDown={e=>{ if(e.key==="Enter"&&e.target.value.trim()){ e.preventDefault(); const v=e.target.value.trim(); if(!pForm.aliases.includes(v)) setPForm(f=>({...f,aliases:[...f.aliases,v]})); e.target.value=""; }}}/>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>Extra IGNs (smurfs, old accounts) merged into this player's stats</div>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Role</div>
              <select value={pForm.role} onChange={e=>setPForm(f=>({...f,role:e.target.value}))}>
                <option value="">— No role —</option>
                {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Linked Username</div>
              <select value={pForm.username} onChange={e=>setPForm(f=>({...f,username:e.target.value}))}>
                <option value="">— Not linked —</option>
                {users.filter(u=>u.role==="player").map(u=><option key={u.id} value={u.username}>{u.username}</option>)}
              </select>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>Links this roster player to a user account for @mention pings</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={savePlayer} disabled={!pForm.name.trim()}>{editPlayer?"Save Changes":"Add Player"}</button>
              <button className="btn btn-ghost" onClick={()=>setPlayerModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ════ GOALS & DEBRIEF ════ */
function GoalsDebrief({ players: propPlayers = [], isAdmin = false, user = null }) {
  const [tab, setTab]                 = useState("scrim-goals");
  const [scrimGoals, setScrimGoals]   = useState([]);
  const [indGoals, setIndGoals]       = useState([]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [ownPlayers, setOwnPlayers]   = useState([]);
  const [activeSession, setActiveSession]           = useState(null);
  const [activeScrimSession, setActiveScrimSession] = useState(null);

  const players = ownPlayers.length > 0 ? ownPlayers : propPlayers;

  // Modal states
  const [goalModal, setGoalModal]     = useState(false);
  const [indModal, setIndModal]       = useState(null);
  const [refModal, setRefModal]       = useState(null);
  const [editGoal, setEditGoal]       = useState(null);

  // Single fetch for everything on mount
  useEffect(() => {
    Promise.all([
      api.get("/api/players").then(d=>{ if(Array.isArray(d)) setOwnPlayers(d); }).catch(()=>{}),
      api.get("/api/scrim-goals").then(d => { if(Array.isArray(d)) setScrimGoals(d); }).catch(()=>{}),
      api.get("/api/individual-goals").then(d => { if(Array.isArray(d)) setIndGoals(d); }).catch(()=>{}),
      api.get("/api/reflections").then(d => { if(Array.isArray(d)) setReflections(d); }).catch(()=>{}),
    ]).finally(() => setLoading(false));
  }, []);

  // ── Scrim Goals helpers ──
  const addScrimGoal = async (content, scrim_date) => {
    const date = scrim_date || new Date().toISOString().slice(0,10);
    const r = await api.post("/api/scrim-goals", { content, scrim_date: date, done: 0 }).catch(()=>null);
    if(r) setScrimGoals(p => [r, ...p]);
    setGoalModal(false);
  };
  const toggleGoal = async (g) => {
    const updated = { ...g, done: g.done ? 0 : 1 };
    await api.put(`/api/scrim-goals/${g.id}`, updated).catch(()=>{});
    setScrimGoals(p => p.map(x => x.id===g.id ? updated : x));
  };
  const deleteGoal = async (id) => {
    await api.delete(`/api/scrim-goals/${id}`).catch(()=>{});
    setScrimGoals(p => p.filter(x => x.id!==id));
  };
  const saveEditGoal = async (g) => {
    const r = await api.put(`/api/scrim-goals/${g.id}`, g).catch(()=>null);
    if(r) setScrimGoals(p => p.map(x => x.id===g.id ? r : x));
    setEditGoal(null);
  };

  // ── Individual Goals helpers ──
  const addIndGoal = async (player_id, title, description, session_date, session_label) => {
    const r = await api.post("/api/individual-goals", { player_id, title, description, progress: 0, done: 0, session_date, session_label }).catch(()=>null);
    if(r) setIndGoals(p => [r, ...p]);
    setIndModal(null);
  };
  const updateProgress = async (g, progress) => {
    const updated = { ...g, progress, done: progress >= 5 ? 1 : 0 };
    await api.put(`/api/individual-goals/${g.id}`, updated).catch(()=>{});
    setIndGoals(p => p.map(x => x.id===g.id ? updated : x));
  };
  const deleteIndGoal = async (id) => {
    await api.delete(`/api/individual-goals/${id}`).catch(()=>{});
    setIndGoals(p => p.filter(x => x.id!==id));
  };

  // ── Reflections helpers ──
  const saveReflection = async (data) => {
    if(data.id) {
      const r = await api.put(`/api/reflections/${data.id}`, data).catch(()=>null);
      if(r) setReflections(p => p.map(x => x.id===data.id ? r : x));
    } else {
      const r = await api.post("/api/reflections", data).catch(()=>null);
      if(r) setReflections(p => [r, ...p]);
    }
    setRefModal(null);
  };
  const deleteReflection = async (id) => {
    await api.delete(`/api/reflections/${id}`).catch(()=>{});
    setReflections(p => p.filter(x => x.id!==id));
  };

  const playerName = (id) => players.find(p=>p.id===id)?.name || "Unknown";

  // Rating display — dots 0-5
  const RatingDots = ({ value=0, max=5 }) => (
    <div style={{ display:"flex", gap:3 }}>
      {Array.from({length:max}).map((_,i) => (
        <div key={i} style={{ width:8, height:8, borderRadius:"50%",
          background: i < value ? "var(--acc)" : "var(--s3)",
          border: `1px solid ${i < value ? "var(--acc)" : "var(--b2)"}` }}/>
      ))}
    </div>
  );

  // ── Scrim Goals tab ── (session-based, mirrors IndividualGoalsTab)
  const ScrimGoalsTab = () => {
    const [newText, setNewText] = useState("");
    const today = new Date().toISOString().slice(0,10);

    // All unique sessions sorted newest first
    const sessions = [...new Map(
      scrimGoals
        .filter(g => g.scrim_date)
        .map(g => [g.scrim_date, { date: g.scrim_date, label: g.scrim_date }])
    ).values()].sort((a,b) => b.date.localeCompare(a.date));

    // If no session exists for today yet, show it as a "new" option
    const hasToday = sessions.some(s => s.date === today);
    const allSessions = hasToday ? sessions : [{ date: today, label: today, isNew: true }, ...sessions];

    const viewSession = activeScrimSession || allSessions[0] || null;
    const sessionGoals = viewSession ? scrimGoals.filter(g => g.scrim_date === viewSession.date) : [];
    const doneCount = sessionGoals.filter(g => !!g.done).length;

    return (
      <div style={{ display:"flex", gap:20 }}>
        {/* Session sidebar */}
        <div style={{ width:180, flexShrink:0 }}>
          <div className="label-sm" style={{ marginBottom:8 }}>Sessions</div>
          {allSessions.length === 0 ? (
            <div style={{ fontSize:12, color:"var(--t3)", padding:"12px 0" }}>No sessions yet</div>
          ) : allSessions.map(s => {
            const isActive = viewSession?.date === s.date;
            const count = scrimGoals.filter(g => g.scrim_date === s.date).length;
            const done  = scrimGoals.filter(g => g.scrim_date === s.date && !!g.done).length;
            return (
              <div key={s.date} onClick={()=>setActiveScrimSession(s)}
                style={{ padding:"10px 12px", borderRadius:8, marginBottom:4, cursor:"pointer",
                  background: isActive ? "var(--s3)" : "transparent",
                  border: isActive ? "1px solid var(--b2)" : "1px solid transparent",
                  transition:"all 0.15s" }}
                onMouseOver={e=>{ if(!isActive) e.currentTarget.style.background="var(--s2)"; }}
                onMouseOut={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}>
                <div style={{ fontSize:12, fontWeight:600, color: isActive ? "var(--t1)" : "var(--t2)", marginBottom:2 }}>
                  {s.date === today ? "Today" : s.date}
                </div>
                {s.isNew
                  ? <div style={{ fontSize:11, color:"var(--acc)" }}>+ New session</div>
                  : <div style={{ fontSize:11, color:"var(--t3)" }}>{done}/{count} done</div>
                }
              </div>
            );
          })}
        </div>

        {/* Goals for selected session */}
        <div style={{ flex:1, minWidth:0 }}>
          {viewSession && (
            <>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, paddingBottom:12, borderBottom:"1px solid var(--b1)" }}>
                <div>
                  <div className="bc" style={{ fontSize:16, fontWeight:900 }}>
                    {viewSession.date === today ? "Today" : viewSession.date}
                  </div>
                  {sessionGoals.length > 0 && (
                    <div style={{ fontSize:12, color:"var(--t3)", marginTop:2 }}>{doneCount}/{sessionGoals.length} completed</div>
                  )}
                </div>
                {/* Progress bar */}
                {sessionGoals.length > 0 && (
                  <div style={{ width:80, height:4, background:"var(--s3)", borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.round(doneCount/sessionGoals.length*100)}%`, background:"var(--acc)", borderRadius:2, transition:"width 0.3s ease" }}/>
                  </div>
                )}
              </div>

              {/* Goal items */}
              <div style={{ display:"flex", flexDirection:"column", gap:2, marginBottom:12 }}>
                {sessionGoals.map(g => (
                  <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 4px", borderRadius:6 }}
                    onMouseOver={e=>e.currentTarget.style.background="var(--s2)"}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <div onClick={()=>toggleGoal(g)}
                      style={{ width:16, height:16, borderRadius:3,
                        border:`1.5px solid ${!!g.done?"var(--acc)":"var(--b3)"}`,
                        background: !!g.done?"var(--acc)":"transparent",
                        cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
                        transition:"background 0.2s ease, border-color 0.2s ease, transform 0.1s ease" }}
                      onMouseDown={e=>e.currentTarget.style.transform="scale(0.8)"}
                      onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
                      onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#080a10" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ opacity:!!g.done?1:0, transform:!!g.done?"scale(1)":"scale(0.3)", transition:"opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <input value={g.content}
                      onChange={e => setScrimGoals(p => p.map(x => x.id===g.id ? {...x, content:e.target.value} : x))}
                      onBlur={e => saveEditGoal({...g, content: e.target.value})}
                      style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13,
                        color: !!g.done ? "var(--t3)" : "var(--t1)", textDecoration: !!g.done ? "line-through" : "none",
                        cursor:"text", padding:0, fontFamily:"inherit" }}/>
                    <button onClick={()=>deleteGoal(g.id)}
                      style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"0 2px", opacity:0.5 }}
                      onMouseOver={e=>{e.currentTarget.style.opacity="1"; e.currentTarget.style.color="var(--red)"}}
                      onMouseOut={e=>{e.currentTarget.style.opacity="0.5"; e.currentTarget.style.color="var(--t3)"}}>✕</button>
                  </div>
                ))}
              </div>

              {/* Add item row */}
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"5px 4px" }}>
                <div style={{ width:16, height:16, borderRadius:3, border:"1.5px solid var(--b3)", flexShrink:0 }}/>
                <input value={newText} onChange={e=>setNewText(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==="Enter" && newText.trim()) {
                      addScrimGoal(newText.trim(), viewSession.date);
                      setNewText("");
                      // If it was a "new" session, update sidebar
                      if(viewSession.isNew) setActiveScrimSession({ date:viewSession.date, label:viewSession.date });
                    }
                  }}
                  placeholder="Add goal… press Enter"
                  style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13,
                    fontSize:14, color:"var(--t3)", cursor:"text", padding:0, fontFamily:"inherit" }}/>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Individual Goals tab ──
  const IndividualGoalsTab = () => {
    // Get all unique sessions sorted newest first
    const sessions = [...new Map(
      indGoals
        .filter(g => g.session_date)
        .map(g => [g.session_date, { date: g.session_date, label: g.session_label || g.session_date }])
    ).values()].sort((a,b) => b.date.localeCompare(a.date));

    const viewSession = activeSession || sessions[0] || null;
    const sessionGoals = viewSession ? indGoals.filter(g => g.session_date === viewSession.date) : [];

    return (
      <div>
        {players.length === 0 ? (
          <div className="card" style={{ padding:"48px", textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>👤</div>
            <div style={{ fontWeight:700, color:"var(--t2)" }}>No players in roster yet</div>
            <div style={{ fontSize:12, color:"var(--t3)", marginTop:6 }}>Go to <b style={{color:"var(--acc)"}}>Admin → Roster</b> to add your team first</div>
          </div>
        ) : (
          <>
            {/* Session log sidebar + content */}
            <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

              {/* Left — session list */}
              <div style={{ width:220, flexShrink:0 }}>
                <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center", marginBottom:12 }}
                  onClick={()=>setIndModal({ newSession: true })}>
                  + New Session
                </button>
                {sessions.length === 0 ? (
                  <div style={{ fontSize:12, color:"var(--t3)", padding:"12px 0", textAlign:"center" }}>No sessions yet</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {sessions.map(s => (
                      <div key={s.date} onClick={()=>setActiveSession(s)}
                        style={{ padding:"10px 14px", borderRadius:"var(--r)", cursor:"pointer", border:"1px solid",
                          borderColor: viewSession?.date===s.date ? "var(--acc)" : "var(--b1)",
                          background: viewSession?.date===s.date ? "rgba(212,255,30,0.06)" : "var(--s1)",
                          transition:"all 0.15s" }}>
                        <div style={{ fontWeight:700, fontSize:13, color: viewSession?.date===s.date ? "var(--acc)" : "var(--t1)" }}>{s.label}</div>
                        <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{s.date} · {indGoals.filter(g=>g.session_date===s.date).length} goals</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right — session content */}
              <div style={{ flex:1 }}>
                {!viewSession ? (
                  <div className="card" style={{ padding:"48px", textAlign:"center", color:"var(--t3)" }}>
                    <div style={{ fontSize:24, marginBottom:8 }}>🎯</div>
                    <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:6 }}>No sessions yet</div>
                    <div style={{ fontSize:13, marginBottom:16 }}>Create a new session to start tracking goals</div>
                    <button className="btn btn-acc" onClick={()=>setIndModal({ newSession: true })}>+ New Session</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:18, color:"var(--t1)" }}>{viewSession.label}</div>
                        <div style={{ fontSize:12, color:"var(--t3)" }}>{viewSession.date} · {sessionGoals.length} goals across {players.length} players</div>
                      </div>
                      <button className="btn btn-ghost" style={{ fontSize:12 }}
                        onClick={()=>setIndModal({ addToSession: viewSession })}>
                        + Add Goal
                      </button>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:14 }}>
                      {players.map(player => {
                        const pGoals = sessionGoals.filter(g => g.player_id === player.id);
                        return (
                          <div key={player.id} className="card" style={{ padding:0, overflow:"hidden" }}>
                            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--b1)", display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ width:28, height:28, borderRadius:"50%", background:"var(--s3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"var(--acc)", flexShrink:0 }}>
                                {(player.name||"?").slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight:700, fontSize:13 }}>{player.name}</div>
                                {player.role && <div style={{ fontSize:10, color:"var(--t3)" }}>{player.role}</div>}
                              </div>
                            </div>
                            <div style={{ padding:"10px 12px", minHeight:60 }}>
                              {pGoals.length === 0 ? (
                                <div style={{ color:"var(--t3)", fontSize:11, padding:"8px 0", textAlign:"center" }}>No goals this session</div>
                              ) : pGoals.map(g => (
                                <div key={g.id} style={{ marginBottom:10 }}>
                                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                                    <span style={{ fontSize:13, fontWeight:600, color:"var(--t1)", flex:1 }}>{g.title}</span>
                                    <button onClick={()=>deleteIndGoal(g.id)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:10, padding:"0 0 0 4px" }}>✕</button>
                                  </div>
                                  {g.description && <div style={{ fontSize:11, color:"var(--t3)", marginBottom:4 }}>{g.description}</div>}
                                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <input type="number" min={0} max={5} value={g.progress}
                                      onChange={e=>updateProgress(g, Math.min(5,Math.max(0,Number(e.target.value)||0)))}
                                      style={{ width:24, background:"transparent", border:"none", borderBottom:"1px solid var(--b2)",
                                        color:"var(--green)", fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700,
                                        textAlign:"center", outline:"none", padding:"1px 0", flexShrink:0, MozAppearance:"textfield" }}/>
                                    <div style={{ flex:1, height:5, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
                                      <div style={{ height:"100%", width:`${(g.progress/5)*100}%`, background:"var(--green)", borderRadius:3, transition:"width 0.3s" }}/>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div style={{ padding:"6px 12px", borderTop:"1px solid var(--b1)" }}>
                              <button onClick={()=>setIndModal({ addToSession: viewSession, player_id: player.id })}
                                style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11, padding:0 }}
                                onMouseOver={e=>e.currentTarget.style.color="var(--acc)"}
                                onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>+ Add goal</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {indModal && <AddIndGoalModal players={players} prefill={indModal} onSave={addIndGoal} onClose={()=>setIndModal(null)}/>}
      </div>
    );
  };

  // ── Reflection tab ──
  const ReflectionTab = () => {
    const today = new Date().toISOString().slice(0,10);
    const myPlayer = players.find(p => p.username === user?.username);
    // Group by scrim_date
    const dates = [...new Set(reflections.map(r=>r.scrim_date||"—"))].sort().reverse();
    const canAddReflection = isAdmin || !!myPlayer;

    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:13, color:"var(--t3)" }}>{reflections.length} reflections logged</div>
          {canAddReflection && <button className="btn btn-acc" onClick={()=>setRefModal({ scrim_date:today, player_id: isAdmin ? "" : (myPlayer?.id||""), mental:0, self:0, team:0, notes:"" })}>+ Add Reflection</button>}
        </div>

        {reflections.length === 0 ? (
          <div className="card" style={{ padding:"48px", textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>🪞</div>
            <div style={{ fontWeight:700, color:"var(--t2)", marginBottom:4 }}>No reflections yet</div>
            <div style={{ fontSize:13, marginBottom:16 }}>Log how each player felt after scrims</div>
            {canAddReflection && <button className="btn btn-acc" onClick={()=>setRefModal({ scrim_date:today, player_id: isAdmin ? "" : (myPlayer?.id||""), mental:0, self:0, team:0, notes:"" })}>+ Add First Reflection</button>}
          </div>
        ) : (
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Player</th>
                  <th style={{ textAlign:"center" }}>Mental</th>
                  <th style={{ textAlign:"center" }}>Self</th>
                  <th style={{ textAlign:"center" }}>Team</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reflections.map(r => {
                  const isMyReflection = myPlayer && String(r.player_id) === String(myPlayer.id);
                  const canEdit = isAdmin || isMyReflection;
                  const canDelete = isAdmin || isMyReflection;
                  return (
                    <tr key={r.id} style={{ cursor: canEdit ? "pointer" : "default" }} onClick={()=>{ if(canEdit) setRefModal({...r}); }}>
                      <td style={{ color:"var(--t3)", fontSize:12 }}>{r.scrim_date || "—"}</td>
                      <td style={{ fontWeight:600 }}>{r.player_id ? playerName(r.player_id) : <span style={{color:"var(--t3)"}}>—</span>}</td>
                      <td style={{ textAlign:"center" }}><RatingDots value={r.mental}/></td>
                      <td style={{ textAlign:"center" }}><RatingDots value={r.self}/></td>
                      <td style={{ textAlign:"center" }}><RatingDots value={r.team}/></td>
                      <td style={{ color:"var(--t2)", fontSize:12, maxWidth:300 }}>
                        <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.notes || "—"}</div>
                      </td>
                      <td>
                        {canDelete && <button onClick={e=>{e.stopPropagation();deleteReflection(r.id);}} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:11 }}>✕</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {refModal && (
          <ReflectionModal
            data={refModal}
            players={isAdmin ? players : (myPlayer ? [myPlayer] : [])}
            lockPlayer={!isAdmin && !!myPlayer}
            onSave={saveReflection}
            onClose={()=>setRefModal(null)}/>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>GOALS & DEBRIEF</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:24 }}>Track scrim goals, player development, and post-scrim reflections</div>

      <div className="tab-bar" style={{ maxWidth:440, marginBottom:28 }}>
        <button className={`tab${tab==="scrim-goals"?" on":""}`} onClick={()=>setTab("scrim-goals")}>Scrim Goals</button>
        <button className={`tab${tab==="individual"?" on":""}`} onClick={()=>setTab("individual")}>Individual Goals</button>
        <button className={`tab${tab==="reflection"?" on":""}`} onClick={()=>setTab("reflection")}>Reflection</button>
      </div>

      {loading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ height:36, width:200, background:"var(--s2)", borderRadius:"var(--r)", animation:"blink 1.4s infinite" }}/>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[1,2,3].map(i=>(
              <div key={i} className="card" style={{ padding:16 }}>
                <div style={{ height:12, width:"60%", background:"var(--s3)", borderRadius:4, marginBottom:12, animation:"blink 1.4s infinite" }}/>
                <div style={{ height:8, width:"90%", background:"var(--s3)", borderRadius:4, marginBottom:8, animation:"blink 1.4s infinite" }}/>
                <div style={{ height:8, width:"75%", background:"var(--s3)", borderRadius:4, animation:"blink 1.4s infinite" }}/>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {tab==="scrim-goals" && <ScrimGoalsTab/>}
          {tab==="individual"  && <IndividualGoalsTab/>}
          {tab==="reflection"  && <ReflectionTab/>}
        </>
      )}
    </div>
  );
}

/* ── Sub-components for Goals & Debrief ── */
function ScrimGoalRow({ g, onToggle, onDelete, onEdit }) {
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 16px", background:"var(--s1)", borderRadius:"var(--r)", border:"1px solid var(--b1)", transition:"border-color 0.15s" }}
      onMouseOver={e=>e.currentTarget.style.borderColor="var(--b2)"}
      onMouseOut={e=>e.currentTarget.style.borderColor="var(--b1)"}>
      {/* Checkbox */}
      <div onClick={()=>onToggle(g)}
        style={{ width:18, height:18, borderRadius:4,
          border:`2px solid ${!!g.done?"var(--green)":"var(--b2)"}`,
          background:!!g.done?"var(--green)":"transparent",
          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          flexShrink:0, marginTop:2,
          transition:"background 0.2s ease, border-color 0.2s ease, transform 0.1s ease" }}
        onMouseDown={e=>e.currentTarget.style.transform="scale(0.8)"}
        onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
        onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity:!!g.done?1:0, transform:!!g.done?"scale(1)":"scale(0.3)", transition:"opacity 0.2s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:600, fontSize:14, color:!!g.done?"var(--t3)":"var(--t1)", textDecoration:!!g.done?"line-through":"none" }}>{g.content}</div>
        {g.scrim_date && <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{g.scrim_date}</div>}
      </div>
      <div style={{ display:"flex", gap:4 }}>
        <button onClick={()=>onEdit(g)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"2px 6px" }}
          onMouseOver={e=>e.currentTarget.style.color="var(--t1)"} onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>✎</button>
        <button onClick={()=>onDelete(g.id)} style={{ background:"none", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:12, padding:"2px 6px" }}
          onMouseOver={e=>e.currentTarget.style.color="var(--red)"} onMouseOut={e=>e.currentTarget.style.color="var(--t3)"}>✕</button>
      </div>
    </div>
  );
}

function AddGoalModal({ onSave, onClose }) {
  const [content, setContent]   = useState("");
  const [date, setDate]         = useState(new Date().toISOString().slice(0,10));
  return (
    <Modal onClose={onClose} title="Add Scrim Goal">
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Goal</div>
          <input autoFocus value={content} onChange={e=>setContent(e.target.value)} placeholder="e.g. Improve B default timing…"
            onKeyDown={e=>e.key==="Enter"&&content.trim()&&onSave(content,date)}/>
        </div>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Scrim Date</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" onClick={()=>content.trim()&&onSave(content,date)} disabled={!content.trim()}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

function EditGoalModal({ goal, onSave, onClose }) {
  const [content, setContent] = useState(goal.content);
  const [date, setDate]       = useState(goal.scrim_date||"");
  return (
    <Modal onClose={onClose} title="Edit Goal">
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Goal</div>
          <input autoFocus value={content} onChange={e=>setContent(e.target.value)}/>
        </div>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Scrim Date</div>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}/>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" onClick={()=>onSave({...goal,content,scrim_date:date})} disabled={!content.trim()}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

function AddIndGoalModal({ players, prefill={}, onSave, onClose }) {
  const isNewSession = !!prefill.newSession;
  const existingSession = prefill.addToSession || null;

  const today = new Date().toISOString().slice(0,10);
  const [sessionDate,  setSessionDate]  = useState(existingSession?.date  || today);
  const [sessionLabel, setSessionLabel] = useState(existingSession?.label || "");
  const [playerId,     setPlayerId]     = useState(prefill.player_id || "");
  const [title,        setTitle]        = useState("");
  const [desc,         setDesc]         = useState("");

  // New session = add goals for ALL players at once
  const [allGoals, setAllGoals] = useState(() =>
    players.map(p => ({ player_id: p.id, title: "", desc: "" }))
  );
  const setGoalField = (pid, field, val) =>
    setAllGoals(prev => prev.map(g => g.player_id===pid ? {...g,[field]:val} : g));

  const handleSave = () => {
    if (isNewSession) {
      // Save a goal entry for each player that has a title filled
      const toSave = allGoals.filter(g => g.title.trim());
      if (!toSave.length) return;
      toSave.forEach(g => onSave(g.player_id, g.title, g.desc, sessionDate, sessionLabel||sessionDate));
    } else {
      if (!playerId || !title.trim()) return;
      onSave(playerId, title, desc, sessionDate, sessionLabel||sessionDate);
    }
  };

  return (
    <Modal onClose={onClose} title={isNewSession ? "New Session" : "Add Goal"}>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Session info — always shown */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Session Label</div>
            <input value={sessionLabel} onChange={e=>setSessionLabel(e.target.value)}
              placeholder="e.g. Week 3 Scrims" disabled={!!existingSession}
              style={{ opacity: existingSession ? 0.5 : 1 }}/>
          </div>
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Date</div>
            <input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)} disabled={!!existingSession}
              style={{ opacity: existingSession ? 0.5 : 1 }}/>
          </div>
        </div>

        {isNewSession ? (
          // All players at once
          <div style={{ display:"flex", flexDirection:"column", gap:10, maxHeight:360, overflowY:"auto" }}>
            <div className="label-sm">Goals per Player</div>
            {players.map(p => (
              <div key={p.id} style={{ padding:"10px 12px", background:"var(--s2)", borderRadius:"var(--r)", border:"1px solid var(--b1)" }}>
                <div style={{ fontWeight:700, fontSize:12, marginBottom:8, color:"var(--acc)" }}>{p.name}</div>
                <input placeholder="Goal title…" value={allGoals.find(g=>g.player_id===p.id)?.title||""}
                  onChange={e=>setGoalField(p.id,"title",e.target.value)}
                  style={{ marginBottom:6 }}/>
                <input placeholder="Description (optional)" value={allGoals.find(g=>g.player_id===p.id)?.desc||""}
                  onChange={e=>setGoalField(p.id,"desc",e.target.value)}/>
              </div>
            ))}
          </div>
        ) : (
          // Single goal
          <>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Player</div>
              <select value={playerId} onChange={e=>setPlayerId(Number(e.target.value))}>
                <option value="">Select player…</option>
                {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Goal</div>
              <input autoFocus value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Improve crosshair placement"/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Description (optional)</div>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Details…" style={{ minHeight:50, resize:"vertical" }}/>
            </div>
          </>
        )}

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" onClick={handleSave}
            disabled={isNewSession ? !allGoals.some(g=>g.title.trim()) : (!playerId||!title.trim())}>
            {isNewSession ? "Create Session" : "Add Goal"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReflectionModal({ data, players, onSave, onClose, lockPlayer=false }) {
  const [form, setForm] = useState({ ...data });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const RatingInput = ({ label, field }) => (
    <div>
      <div className="label-sm" style={{ marginBottom:6 }}>{label}</div>
      <select value={form[field]||0} onChange={e=>set(field, Number(e.target.value))}
        style={{ width:"100%" }}>
        <option value={0}>— Not rated —</option>
        <option value={1}>1 — Poor</option>
        <option value={2}>2 — Below average</option>
        <option value={3}>3 — Average</option>
        <option value={4}>4 — Good</option>
        <option value={5}>5 — Excellent</option>
      </select>
    </div>
  );

  return (
    <Modal onClose={onClose} title={data.id?"Edit Reflection":"Add Reflection"}>
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ display:"grid", gridTemplateColumns: lockPlayer ? "1fr" : "1fr 1fr", gap:12 }}>
          {!lockPlayer && (
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Player</div>
              <select value={form.player_id||""} onChange={e=>set("player_id",Number(e.target.value)||null)}>
                <option value="">Select player…</option>
                {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <div className="label-sm" style={{ marginBottom:6 }}>Scrim Date</div>
            <input type="date" value={form.scrim_date||""} onChange={e=>set("scrim_date",e.target.value)}/>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <RatingInput label="Mental" field="mental"/>
            <RatingInput label="Self" field="self"/>
            <RatingInput label="Team" field="team"/>
          </div>
        </div>
        <div>
          <div className="label-sm" style={{ marginBottom:6 }}>Notes</div>
          <textarea value={form.notes||""} onChange={e=>set("notes",e.target.value)}
            placeholder="E.g. think our B postplant was weak, need to work on…"
            style={{ minHeight:80, resize:"vertical" }}/>
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-acc" onClick={()=>onSave(form)}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

/* ════ OCR SCANNER ════ */
function OCRScanner({ setPage }) {
  const [image, setImage]             = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [imageMime, setImageMime]     = useState("image/png");
  const [players, setPlayers]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState(null);
  const [dragOver, setDragOver]       = useState(false);
  const [saved, setSaved]             = useState(false);
  const fileRef                       = useRef();
  const [ourTeam, setOurTeam]         = useState(null);
  const [dragIdx, setDragIdx]         = useState(null);
  const [dropTarget, setDropTarget]   = useState(null); // "win" | "lose"

  const handleDragStart = (i) => setDragIdx(i);
  const handleDragEnd   = () => { setDragIdx(null); setDropTarget(null); };
  const handleDrop      = (team) => {
    if (dragIdx === null) return;
    update(dragIdx, "team", team);
    setDragIdx(null); setDropTarget(null);
  };

  // Scrim metadata for saving into scrim log
  const [scrimMeta, setScrimMeta]     = useState({
    date: new Date().toISOString().slice(0,10),
    map: "Ascent",
    opp: "",
    score: "",
    res: "loss",
  });

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file));
    setPlayers([]); setError(null); setSaved(false); setOurTeam(null);
    setImageMime(file.type || "image/png");
    const reader = new FileReader();
    reader.onload = e => setImageBase64(e.target.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const scan = async () => {
    if (!imageBase64) return;
    setLoading(true); setError(null);
    try {
      const res = await api.post("/api/ocr-scan", { imageBase64, imageMime });
      if (res.error) throw new Error(res.error);
      setPlayers(res.players);
      // Auto-detect result from win/lose team counts
      const wins = res.players.filter(p=>p.team==="win").length;
      const loses = res.players.filter(p=>p.team==="lose").length;
      if (wins > 0 || loses > 0) setScrimMeta(m=>({...m, res: wins >= loses ? "win" : "loss"}));
    } catch(e) {
      setError(e.message || "Could not extract stats — make sure the screenshot shows a clear Valorant scoreboard.");
    } finally { setLoading(false); }
  };

  const update = (i, f, v) => setPlayers(p => { const n=[...p]; n[i]={...n[i],[f]:v}; return n; });

  const saveToDb = async () => {
    if (!players.length || !ourTeam) return;
    setSaving(true); setError(null);
    try {
      // Normalise OCR fields to match scrim player_stats shape
      const tagged = players.map(p => ({
        name:        p.name || "",
        agent:       p.agent || "",
        side:        p.team === ourTeam ? "blue" : "red",
        acs:         Number(p.acs) || 0,
        kills:       Number(p.k)   || 0,
        deaths:      Number(p.d)   || 0,
        assists:     Number(p.a)   || 0,
        hsRate:      null,
        firstBloods: Number(p.fb)  || 0,
        plants:      Number(p.pl)  || 0,
        defuses:     Number(p.def) || 0,
        kd: Number(p.d) > 0 ? Math.round((Number(p.k)/Number(p.d))*100)/100 : Number(p.k),
      }));

      // Save as a scrim so it shows up everywhere
      const scrimPayload = {
        date:         scrimMeta.date,
        map:          scrimMeta.map,
        opp:          scrimMeta.opp || "Unknown",
        score:        scrimMeta.score || "—",
        res:          scrimMeta.res,
        comp:         "[]",
        rounds:       "[]",
        round_detail: "[]",
        player_stats: JSON.stringify(tagged),
        source:       "ocr",
      };

      const res = await api.post("/api/scrims", scrimPayload);
      if (res.error) { setError(res.error); return; }

      // Also save to ocr_scans for legacy access
      await api.post("/api/ocr-stats", { players: tagged }).catch(()=>{});

      setSaved(true);
    } catch(e) { setError("Save failed — check your connection."); }
    finally { setSaving(false); }
  };

  const exportCSV = () => {
    const rows = [
      "Name,Agent,Team,ACS,K,D,A,Econ,FB,PL,DEF",
      ...players.map(p => `${p.name},${p.agent||""},${p.team},${p.acs},${p.k},${p.d},${p.a},${p.econ},${p.fb},${p.pl},${p.def}`)
    ].join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(rows);
    a.download = "scoreboard.csv"; a.click();
  };

  const winP  = players.filter(p => p.team === "win");
  const loseP = players.filter(p => p.team === "lose");

  const colStyle = { padding:"8px 10px", fontSize:11, fontWeight:700, letterSpacing:"0.07em",
    textTransform:"uppercase", color:"var(--t3)", borderBottom:"1px solid var(--b1)", textAlign:"center" };
  const cellStyle = { padding:"7px 10px", fontSize:13, borderBottom:"1px solid var(--b1)", textAlign:"center", verticalAlign:"middle" };
  const numInput = (i, f, color) => (
    <input type="number" value={players[i][f] ?? 0}
      onChange={e => update(i, f, +e.target.value)}
      style={{ width:46, background:"transparent", border:"none", color: color || "var(--t1)",
        fontFamily:"'JetBrains Mono',monospace", fontSize:13, textAlign:"center", outline:"none", padding:"2px 0" }}/>
  );

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <button className="btn btn-ghost" style={{ padding:"6px 10px" }} onClick={()=>setPage("tracker")}>← Back</button>
          <div>
            <div className="bc" style={{ fontSize:32, fontWeight:900, letterSpacing:"0.04em" }}>OCR SCANNER</div>
            <div style={{ color:"var(--t2)", fontSize:12 }}>Upload a scoreboard screenshot — AI extracts all stats automatically</div>
          </div>
        </div>
        {players.length > 0 && (
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <button className="btn btn-ghost" onClick={exportCSV}>↓ CSV</button>
            {!ourTeam && (
              <span style={{ fontSize:11, color:"var(--red)", alignSelf:"center" }}>⚠ Mark your team first</span>
            )}
            <button className="btn btn-acc" onClick={saveToDb} disabled={saving || saved || !ourTeam}>
              {saved ? "✓ Saved to Scrim Log!" : saving ? "Saving…" : "Save to Scrim Log"}
            </button>
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns: image ? "1fr 1fr" : "1fr", gap:16, marginBottom:20 }}>
        <div>
          <div
            onClick={() => fileRef.current.click()}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{ border:`2px dashed ${dragOver?"var(--acc)":"var(--b2)"}`, borderRadius:"var(--r3)",
              padding:"40px 24px", textAlign:"center", cursor:"pointer",
              background: dragOver ? "rgba(212,255,30,0.04)" : "var(--s1)", transition:"all 0.15s" }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
              onChange={e => handleFile(e.target.files[0])} />
            <div style={{ fontSize:28, marginBottom:10 }}>📷</div>
            <div style={{ fontWeight:600, color:"var(--t1)", marginBottom:4 }}>
              {image ? "Drop new image to replace" : "Drop scoreboard screenshot here"}
            </div>
            <div style={{ fontSize:12, color:"var(--t3)" }}>Works with in-game, tracker.gg, or any Valorant scoreboard</div>
          </div>

          {image && (
            <button className="btn btn-acc" onClick={scan} disabled={loading}
              style={{ marginTop:12, width:"100%", justifyContent:"center", padding:"12px" }}>
              {loading
                ? <><span style={{ animation:"blink 1.2s infinite" }}>●</span>&nbsp; Scanning…</>
                : "⚡ Extract Player Stats"}
            </button>
          )}

          {error && (
            <div style={{ marginTop:10, padding:"10px 14px", background:"rgba(255,82,82,0.08)",
              border:"1px solid rgba(255,82,82,0.25)", borderRadius:"var(--r)", color:"var(--red)", fontSize:12 }}>
              {error}
            </div>
          )}
        </div>

        {image && (
          <div style={{ borderRadius:"var(--r2)", overflow:"hidden", border:"1px solid var(--b1)", maxHeight:220 }}>
            <img src={image} alt="scoreboard preview"
              style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }} />
          </div>
        )}
      </div>

      {players.length > 0 && (
        <>
        {/* Scrim metadata — required to save into scrim log */}
        <div className="card" style={{ marginBottom:16, padding:"16px 20px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"var(--t3)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:12 }}>
            Scrim Details — required to save to Scrim Log
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(160px,1fr))", gap:12 }}>
            <div>
              <div className="label-sm" style={{ marginBottom:4 }}>Date</div>
              <input type="date" value={scrimMeta.date} onChange={e=>setScrimMeta(m=>({...m,date:e.target.value}))}/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:4 }}>Map</div>
              <select value={scrimMeta.map} onChange={e=>setScrimMeta(m=>({...m,map:e.target.value}))}>
                {["Ascent","Bind","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset","Abyss","Corrode"].map(mp=>(
                  <option key={mp}>{mp}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:4 }}>Opponent</div>
              <input type="text" value={scrimMeta.opp} onChange={e=>setScrimMeta(m=>({...m,opp:e.target.value}))} placeholder="Team name…"/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:4 }}>Score</div>
              <input type="text" value={scrimMeta.score} onChange={e=>setScrimMeta(m=>({...m,score:e.target.value}))} placeholder="e.g. 13-7"/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:4 }}>Result</div>
              <select value={scrimMeta.res} onChange={e=>setScrimMeta(m=>({...m,res:e.target.value}))}>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)", overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"28px 200px 130px 62px 62px 62px 62px 62px 62px 62px 62px", background:"var(--s2)" }}>
            {["#","Player","Agent","ACS","K","D","A","Econ","FB","PL","DEF"].map(h => (
              <div key={h} style={{ ...colStyle, textAlign: h==="Player"||h==="Agent" ? "left" : "center" }}>{h}</div>
            ))}
          </div>

          {(winP.length > 0 || dragIdx !== null) && <>
            <div
              onDragOver={e=>{ e.preventDefault(); setDropTarget("win"); }}
              onDragLeave={()=>setDropTarget(null)}
              onDrop={()=>handleDrop("win")}
              style={{ padding:"6px 12px 2px", fontSize:10, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"var(--green)", borderBottom:"1px solid var(--b1)",
              display:"flex", alignItems:"center", gap:8,
              background: dropTarget==="win" ? "rgba(105,240,174,0.12)" : "transparent",
              transition:"background 0.15s",
              outline: dropTarget==="win" ? "2px dashed var(--green)" : "none",
              outlineOffset:-2 }}>
              <div style={{ width:24, height:1, background:"var(--green)" }}/> Victory
              {dropTarget==="win" && <span style={{ fontSize:9, color:"var(--green)", opacity:0.8 }}>drop here</span>}
              <button onClick={()=>setOurTeam(ourTeam==="win"?null:"win")}
                style={{ marginLeft:"auto", padding:"2px 10px", borderRadius:12, border:"none", cursor:"pointer", fontSize:10, fontWeight:700,
                  background: ourTeam==="win" ? "var(--acc)" : "var(--s3)",
                  color: ourTeam==="win" ? "#000" : "var(--t3)", transition:"all 0.15s" }}>
                {ourTeam==="win" ? "✓ Our Team" : "Mark as Our Team"}
              </button>
            </div>
            {winP.map(p => { const i = players.indexOf(p); return (
              <div key={i}
                draggable
                onDragStart={()=>handleDragStart(i)}
                onDragEnd={handleDragEnd}
                style={{ display:"grid", gridTemplateColumns:"28px 200px 130px 62px 62px 62px 62px 62px 62px 62px 62px",
                background: dragIdx===i ? "rgba(105,240,174,0.15)" : "rgba(105,240,174,0.03)",
                cursor:"grab", opacity: dragIdx===i ? 0.5 : 1, transition:"opacity 0.15s" }}
                onMouseEnter={e=>{ if(dragIdx===null) e.currentTarget.style.background="rgba(105,240,174,0.07)"; }}
                onMouseLeave={e=>{ if(dragIdx===null) e.currentTarget.style.background="rgba(105,240,174,0.03)"; }}>
                <div style={{...cellStyle,color:"var(--green)",fontSize:13,cursor:"grab"}} title="Drag to move team">⠿</div>
                <div style={{...cellStyle,textAlign:"left"}}>
                  <input value={p.name||""} onChange={e=>update(i,"name",e.target.value)}
                    style={{background:"transparent",border:"none",color:"var(--t1)",fontFamily:"'DIN Next LT Pro',sans-serif",fontSize:15,fontWeight:700,width:"100%",outline:"none",cursor:"text"}}/>
                </div>
                <div style={{...cellStyle,textAlign:"left"}}>
                  <select value={p.agent||""} onChange={e=>update(i,"agent",e.target.value)}
                    style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",padding:0,width:"100%"}}>
                    <option value="">— agent —</option>
                    {AGENTS.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div style={cellStyle}>{numInput(i,"acs","var(--acc)")}</div>
                <div style={cellStyle}>{numInput(i,"k")}</div>
                <div style={cellStyle}>{numInput(i,"d")}</div>
                <div style={cellStyle}>{numInput(i,"a")}</div>
                <div style={cellStyle}>{numInput(i,"econ",p.econ<0?"var(--red)":"var(--t2)")}</div>
                <div style={cellStyle}>{numInput(i,"fb")}</div>
                <div style={cellStyle}>{numInput(i,"pl")}</div>
                <div style={cellStyle}>{numInput(i,"def")}</div>
              </div>
            ); })}
          </>}

          {(loseP.length > 0 || dragIdx !== null) && <>
            <div
              onDragOver={e=>{ e.preventDefault(); setDropTarget("lose"); }}
              onDragLeave={()=>setDropTarget(null)}
              onDrop={()=>handleDrop("lose")}
              style={{ padding:"6px 12px 2px", fontSize:10, fontWeight:700, letterSpacing:"0.12em",
              textTransform:"uppercase", color:"var(--red)", borderBottom:"1px solid var(--b1)", marginTop:4,
              display:"flex", alignItems:"center", gap:8,
              background: dropTarget==="lose" ? "rgba(255,82,82,0.12)" : "transparent",
              transition:"background 0.15s",
              outline: dropTarget==="lose" ? "2px dashed var(--red)" : "none",
              outlineOffset:-2 }}>
              <div style={{ width:24, height:1, background:"var(--red)" }}/> Defeat
              {dropTarget==="lose" && <span style={{ fontSize:9, color:"var(--red)", opacity:0.8 }}>drop here</span>}
              <button onClick={()=>setOurTeam(ourTeam==="lose"?null:"lose")}
                style={{ marginLeft:"auto", padding:"2px 10px", borderRadius:12, border:"none", cursor:"pointer", fontSize:10, fontWeight:700,
                  background: ourTeam==="lose" ? "var(--acc)" : "var(--s3)",
                  color: ourTeam==="lose" ? "#000" : "var(--t3)", transition:"all 0.15s" }}>
                {ourTeam==="lose" ? "✓ Our Team" : "Mark as Our Team"}
              </button>
            </div>
            {loseP.map(p => { const i = players.indexOf(p); return (
              <div key={i}
                draggable
                onDragStart={()=>handleDragStart(i)}
                onDragEnd={handleDragEnd}
                style={{ display:"grid", gridTemplateColumns:"28px 200px 130px 62px 62px 62px 62px 62px 62px 62px 62px",
                background: dragIdx===i ? "rgba(255,82,82,0.15)" : "rgba(255,82,82,0.03)",
                cursor:"grab", opacity: dragIdx===i ? 0.5 : 1, transition:"opacity 0.15s" }}
                onMouseEnter={e=>{ if(dragIdx===null) e.currentTarget.style.background="rgba(255,82,82,0.07)"; }}
                onMouseLeave={e=>{ if(dragIdx===null) e.currentTarget.style.background="rgba(255,82,82,0.03)"; }}>
                <div style={{...cellStyle,color:"var(--red)",fontSize:13,cursor:"grab"}} title="Drag to move team">⠿</div>
                <div style={{...cellStyle,textAlign:"left"}}>
                  <input value={p.name||""} onChange={e=>update(i,"name",e.target.value)}
                    style={{background:"transparent",border:"none",color:"var(--t1)",fontFamily:"'DIN Next LT Pro',sans-serif",fontSize:15,fontWeight:700,width:"100%",outline:"none",cursor:"text"}}/>
                </div>
                <div style={{...cellStyle,textAlign:"left"}}>
                  <select value={p.agent||""} onChange={e=>update(i,"agent",e.target.value)}
                    style={{background:"transparent",border:"none",color:"var(--t2)",fontSize:12,cursor:"pointer",padding:0,width:"100%"}}>
                    <option value="">— agent —</option>
                    {AGENTS.map(a=><option key={a.name} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div style={cellStyle}>{numInput(i,"acs","var(--acc)")}</div>
                <div style={cellStyle}>{numInput(i,"k")}</div>
                <div style={cellStyle}>{numInput(i,"d")}</div>
                <div style={cellStyle}>{numInput(i,"a")}</div>
                <div style={cellStyle}>{numInput(i,"econ",p.econ<0?"var(--red)":"var(--t2)")}</div>
                <div style={cellStyle}>{numInput(i,"fb")}</div>
                <div style={cellStyle}>{numInput(i,"pl")}</div>
                <div style={cellStyle}>{numInput(i,"def")}</div>
              </div>
            ); })}
          </>}

          <div style={{ padding:"10px 14px", borderTop:"1px solid var(--b1)", display:"flex", justifyContent:"space-between",
            alignItems:"center", fontSize:11, color:"var(--t3)" }}>
            <span>{players.length} players extracted · drag ⠿ to move between teams · click any cell to edit</span>
            <button onClick={exportCSV} style={{ background:"none", border:"none", color:"var(--acc)", cursor:"pointer",
              fontFamily:"'DIN Next LT Pro'", fontSize:12, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" }}>
              ↓ Export CSV
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
// ── MAP VETO PAGE ─────────────────────────────────────────────────────────────
const MAP_IMAGES = {
  Abyss:    "https://www.vlr.gg/img/vlr/game/maps/abyss.png",
  Ascent:   "https://www.vlr.gg/img/vlr/game/maps/ascent.png",
  Bind:     "https://www.vlr.gg/img/vlr/game/maps/bind.png",
  Breeze:   "https://www.vlr.gg/img/vlr/game/maps/breeze.png",
  Corrode:  "https://www.vlr.gg/img/vlr/game/maps/corrode.png",
  Fracture: "https://www.vlr.gg/img/vlr/game/maps/fracture.png",
  Haven:    "https://www.vlr.gg/img/vlr/game/maps/haven.png",
  Icebox:   "https://www.vlr.gg/img/vlr/game/maps/icebox.png",
  Lotus:    "https://www.vlr.gg/img/vlr/game/maps/lotus.png",
  Pearl:    "https://www.vlr.gg/img/vlr/game/maps/pearl.png",
  Split:    "https://www.vlr.gg/img/vlr/game/maps/split.png",
  Sunset:   "https://www.vlr.gg/img/vlr/game/maps/sunset.png",
};

function MapVetoPage() {
  const [query, setQuery]           = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]   = useState(false);
  const [teamData, setTeamData]     = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [activeTab, setActiveTab]   = useState("series");
  const [hoveredMap, setHoveredMap] = useState(null);
  const [eventFilter, setEventFilter] = useState("all");
  const [hideMissingVeto, setHideMissingVeto] = useState(true);
  const [showStartingSides, setShowStartingSides] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const searchTimeout = React.useRef(null);

  // Debounced team search
  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      // If it looks like a numeric ID, load directly
      if (/^\d+$/.test(val.trim())) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const data = await api.get(`/api/veto/search?q=${encodeURIComponent(val.trim())}`);
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const loadTeam = async (idOrQuery) => {
    const trimmed = (idOrQuery || "").trim();
    if (!trimmed) return;
    const isNumeric = /^\d+$/.test(trimmed);
    // Numeric ID — load directly
    if (isNumeric) {
      setLoading(true); setError(""); setTeamData(null); setSearchResults([]);
      try {
        const data = await api.get(`/api/veto/team/${trimmed}`);
        if (!data || !Array.isArray(data.series)) throw new Error("Invalid response from server");
        setTeamData(data); setActiveTab("series"); setEventFilter("all");
      } catch (e) { setError(e.message || "Failed to load team data"); }
      finally { setLoading(false); }
      return;
    }
    // Dropdown already populated — use first result
    if (searchResults.length > 0) {
      const teamId = searchResults[0].id;
      setLoading(true); setError(""); setTeamData(null); setSearchResults([]);
      try {
        const data = await api.get(`/api/veto/team/${teamId}`);
        if (!data || !Array.isArray(data.series)) throw new Error("Invalid response from server");
        setTeamData(data); setActiveTab("series"); setEventFilter("all");
      } catch (e) { setError(e.message || "Failed to load team data"); }
      finally { setLoading(false); }
      return;
    }
    // No results yet — search first then load top result
    setLoading(true); setError(""); setTeamData(null);
    try {
      const results = await api.get(`/api/veto/search?q=${encodeURIComponent(trimmed)}`);
      if (!results || results.length === 0) { setError(`No teams found for '${trimmed}'`); return; }
      setQuery(results[0].name); setSearchResults([]);
      const data = await api.get(`/api/veto/team/${results[0].id}`);
      if (!data || !Array.isArray(data.series)) throw new Error("Invalid response from server");
      setTeamData(data); setActiveTab("series"); setEventFilter("all");
    } catch (e) { setError(e.message || "Failed to load team data"); }
    finally { setLoading(false); }
  };

  const handleSearchSelect = (team) => {
    setQuery(team.name);
    setSearchResults([]);
    loadTeam(String(team.id));
  };

  const allSeries = teamData ? (teamData.series || []) : [];
  const seriesFiltered = allSeries
    .filter(s => !hideMissingVeto || s.hasVeto)
    .filter(s => eventFilter === "all" || (s.event || "") === eventFilter);
  const uniqueEvents = teamData
    ? [...new Set(allSeries.map(s => s.event || "").filter(Boolean))].sort()
    : [];

  return (
    <div style={{ flex:1, overflow:"auto", background:"var(--bg)", padding:24 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"var(--t1)", margin:0 }}>Map Veto Analysis</h2>
          <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>Search a team on VLR.GG to analyse their ban/pick patterns</div>
        </div>
        <button
          onClick={() => setShowSettings(s => !s)}
          style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"7px 12px", color:"var(--t2)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          ⚙ Options
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:10, padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:12, color:"var(--t2)", marginBottom:12 }}>Options</div>
          {[
            { key:"hideMissingVeto", label:"Hide series without veto data", desc:"When enabled, series that don't have veto information will be hidden from the series list.", val:hideMissingVeto, set:setHideMissingVeto },
            { key:"showStartingSides", label:"Show starting sides by default", desc:"When enabled, map cards show starting sides by default and scores on hover. When disabled, maps show scores by default and starting sides on hover.", val:showStartingSides, set:setShowStartingSides },
          ].map(opt => (
            <div key={opt.key} style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom:12, padding:12, background:"var(--s3)", borderRadius:8 }}>
              <div onClick={() => opt.set(v => !v)} style={{ width:18, height:18, borderRadius:4, background: opt.val ? "var(--acc)" : "var(--s1)", border:`1px solid ${opt.val ? "var(--acc)" : "var(--b2)"}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, marginTop:1 }}>
                {opt.val && <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--t1)", marginBottom:3 }}>{opt.label}</div>
                <div style={{ fontSize:11, color:"var(--t3)", lineHeight:1.5 }}>{opt.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div style={{ position:"relative", maxWidth:520, marginBottom:20 }}>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, position:"relative" }}>
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadTeam(query)}
              placeholder="Team name or VLR team ID (e.g. 2593)…"
              style={{ width:"100%", background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 14px", color:"var(--t1)", fontSize:13, outline:"none", boxSizing:"border-box" }}
            />
            {searchResults.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, zIndex:100, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
                {searchResults.map(t => (
                  <div key={t.id} onClick={() => handleSearchSelect(t)}
                    style={{ padding:"9px 14px", cursor:"pointer", fontSize:12, color:"var(--t1)", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--s3)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span>{t.name}</span>
                    <span style={{ fontSize:10, color:"var(--t3)" }}>ID: {t.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => loadTeam(query)} disabled={!(query.trim() && !loading)}
            style={{ background:"var(--acc)", border:"none", borderRadius:8, padding:"10px 18px", color:"#000", fontWeight:800, fontSize:13, cursor:"pointer", flexShrink:0, opacity: (!query.trim()||loading) ? 0.5 : 1 }}>
            {loading ? "Loading…" : "Search"}
          </button>
        </div>
      </div>

      {error && <div style={{ color:"var(--red)", fontSize:13, marginBottom:16, padding:"10px 14px", background:"rgba(255,82,82,0.08)", borderRadius:8, border:"1px solid rgba(255,82,82,0.2)" }}>{error}</div>}

      {loading && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, gap:12, color:"var(--t3)" }}>
          <div style={{ width:32, height:32, border:"3px solid var(--b2)", borderTopColor:"var(--acc)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          <div style={{ fontSize:13 }}>Fetching veto data from VLR.GG…</div>
        </div>
      )}

      {teamData && !loading && (
        <>
          {/* Team header */}
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20, padding:"14px 18px", background:"var(--s2)", borderRadius:12, border:"1px solid var(--b2)" }}>
            {teamData.teamLogo && <img src={`${API}/api/img-proxy?url=${encodeURIComponent(teamData.teamLogo)}`} alt="" style={{ width:40, height:40, objectFit:"contain", borderRadius:4 }}/>}
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--t1)" }}>{teamData.teamName}</div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{teamData.totalSeries} series fetched · {seriesFiltered.length} with veto data</div>
            </div>
          </div>

          {/* Tabs + Event Filter */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid var(--b1)", marginBottom:16 }}>
            <div style={{ display:"flex", gap:2 }}>
              {[["series","📋 Series"],["patterns","📊 Patterns"]].map(([k,l]) => (
                <button key={k} onClick={() => setActiveTab(k)}
                  style={{ background:"none", border:"none", padding:"8px 18px", fontSize:13, fontWeight:700, cursor:"pointer", color: activeTab===k ? "var(--acc)" : "var(--t3)", borderBottom: activeTab===k ? "2px solid var(--acc)" : "2px solid transparent", marginBottom:-1 }}>
                  {l}
                </button>
              ))}
            </div>
            {uniqueEvents.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:4 }}>
                <span style={{ fontSize:11, color:"var(--t3)", fontWeight:600 }}>Event</span>
                <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
                  style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6, padding:"4px 10px", fontSize:12, color:"var(--t1)", cursor:"pointer" }}>
                  <option value="all">All Events</option>
                  {uniqueEvents.map(ev => (
                    <option key={ev} value={ev}>{ev}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* SERIES TAB */}
          {activeTab === "series" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {seriesFiltered.length === 0 && (
                <div style={{ textAlign:"center", padding:40, color:"var(--t3)", fontSize:13 }}>
                  No series with veto data found.{hideMissingVeto ? " Try disabling \"Hide series without veto data\" in Options." : ""}
                </div>
              )}
              {seriesFiltered.map(s => (
                <SeriesCard key={s.matchId} series={s} teamId={teamData.teamId}
                  hoveredMap={hoveredMap} onHoverMap={setHoveredMap}
                  showStartingSides={showStartingSides}/>
              ))}
            </div>
          )}

          {/* PATTERNS TAB */}
          {activeTab === "patterns" && (
            <PatternsTable patterns={teamData.patterns} teamName={teamData.teamName} totalSeries={seriesFiltered.length} seriesForPatterns={seriesFiltered}/>
          )}
        </>
      )}

      {!teamData && !loading && !error && (
        <div style={{ textAlign:"center", padding:60, color:"var(--t3)" }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>⊘</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>Search for a team to get started</div>
          <div style={{ fontSize:12 }}>Enter a team name or their VLR.GG team ID</div>
        </div>
      )}
    </div>
  );
}

function SeriesCard({ series, teamId, hoveredMap, onHoverMap, showStartingSides }) {
  const isTeamA = series.teamAId === teamId;
  const ourScore   = series.ourScore   ?? (isTeamA ? series.scoreA : series.scoreB);
  const theirScore = series.theirScore ?? (isTeamA ? series.scoreB : series.scoreA);
  const oppName = isTeamA ? series.teamBName : series.teamAName;
  const won = series.won ?? (ourScore > theirScore);

  const ACTION_COLOR = { ban:"var(--red)", pick:"#4fc3f7", decider:"#a78bfa" };
  const ACTION_LABEL = { ban:"BAN", pick:"PICK", decider:"DEC" };

  return (
    <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderBottom:"1px solid var(--b1)", background:"var(--s3)" }}>
        <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:4, background: won ? "rgba(105,240,174,0.15)" : "rgba(255,82,82,0.12)", color: won ? "var(--green)" : "var(--red)" }}>
          {won ? "WIN" : "LOSS"} {ourScore}–{theirScore}
        </span>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--t1)" }}>vs {oppName}</span>
        {series.event && <span style={{ fontSize:11, color:"var(--t3)", marginLeft:"auto" }}>{series.event}</span>}
        {series.date && <span style={{ fontSize:11, color:"var(--t3)" }}>{series.date}</span>}
      </div>

      {/* Veto sequence */}
      {series.veto.length > 0 && (
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--b1)", display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
          <span style={{ fontSize:9, fontWeight:700, color:"var(--t3)", letterSpacing:"0.1em", textTransform:"uppercase", marginRight:2, alignSelf:"center" }}>VETO</span>
          {series.veto.map((v, i) => {
            const isOurs = v.teamId === teamId;
            const col = ACTION_COLOR[v.action] || "var(--t3)";
            const isHighlighted = hoveredMap === v.map;
            const ourName = isTeamA ? series.teamAName : series.teamBName;
            const teamLabel = isOurs ? ourName : (v.teamName || oppName);
            const cleanLabel = (teamLabel || "").replace(/[^a-zA-Z0-9\s.]/g, "").trim();
            return (
              <div key={i}
                onMouseEnter={() => onHoverMap(v.map)}
                onMouseLeave={() => onHoverMap(null)}
                style={{
                  display:"flex", alignItems:"stretch", borderRadius:6, overflow:"hidden", cursor:"default",
                  border: `1px solid ${isHighlighted ? col : "var(--b2)"}`,
                  boxShadow: isHighlighted ? `0 0 8px ${col}40` : "none",
                  transition:"all 0.15s",
                }}>
                {/* Action badge */}
                <div style={{
                  padding:"4px 7px", display:"flex", alignItems:"center",
                  background: `${col}22`, borderRight:`1px solid ${col}55`,
                }}>
                  <span style={{ fontSize:9, fontWeight:900, color: col, letterSpacing:"0.06em" }}>{ACTION_LABEL[v.action]||v.action.toUpperCase()}</span>
                </div>
                {/* Map name + team */}
                <div style={{
                  padding:"4px 8px", display:"flex", flexDirection:"column", justifyContent:"center",
                  background: isHighlighted ? `${col}12` : "var(--s1)",
                }}>
                  <span style={{ fontSize:12, fontWeight:800, color: isOurs ? "var(--acc)" : "var(--t1)", lineHeight:1.1, fontFamily:"'DIN Next LT Pro',sans-serif", letterSpacing:"0.02em" }}>{v.map}</span>
                  <span style={{ fontSize:8, fontWeight:700, color: isOurs ? "var(--acc)" : "var(--t3)", opacity:0.85, letterSpacing:"0.04em", marginTop:1 }}>{cleanLabel || "?"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Map results grid */}
      {series.maps && series.maps.length > 0 && (
        <div style={{ padding:"10px 16px", display:"flex", gap:8, flexWrap:"wrap" }}>
          {series.maps.map((mg, i) => {
            const isHovered = hoveredMap === mg.map;
            return (
              <MapResultChip key={i} mapGame={mg} isHovered={isHovered}
                onHover={onHoverMap} showStartingSides={showStartingSides}
                vetoAction={series.veto.find(v => v.map === mg.map)}/>
            );
          })}
        </div>
      )}

      {series.veto.length === 0 && (!series.maps || series.maps.length === 0) && (
        <div style={{ padding:"10px 16px", fontSize:11, color:"var(--t3)", fontStyle:"italic" }}>No veto or map data available for this series.</div>
      )}
    </div>
  );
}

function MapResultChip({ mapGame, isHovered, onHover, showStartingSides, vetoAction }) {
  const [hover, setHover] = useState(false);
  const showSides = showStartingSides ? !hover : hover; // toggle on hover

  const mapImg = MAP_IMAGES[mapGame.map];
  const col = vetoAction?.action === "ban" ? "var(--red)" : vetoAction?.action === "pick" ? "#4fc3f7" : "var(--b2)";

  return (
    <div
      onMouseEnter={() => { setHover(true); onHover(mapGame.map); }}
      onMouseLeave={() => { setHover(false); onHover(null); }}
      style={{
        width:90, borderRadius:8, overflow:"hidden", border:`1px solid ${isHovered ? col : "var(--b1)"}`,
        background:"var(--s3)", transition:"border-color 0.15s", cursor:"default", flexShrink:0,
      }}>
      {mapImg && <img src={mapImg} alt={mapGame.map} style={{ width:"100%", height:44, objectFit:"cover", display:"block", opacity:0.8 }}/>}
      <div style={{ padding:"5px 6px" }}>
        <div style={{ fontSize:10, fontWeight:800, color:"var(--t1)", marginBottom:2 }}>{mapGame.map}</div>
        {showSides && mapGame.atkWins !== undefined ? (
          <div style={{ fontSize:9, color:"var(--t3)" }}>
            ATK <span style={{ color:"#fb923c", fontWeight:700 }}>{mapGame.atkWins}</span>
            &nbsp;DEF <span style={{ color:"#60a5fa", fontWeight:700 }}>{mapGame.defWins}</span>
          </div>
        ) : (
          <div style={{ fontSize:10, fontWeight:700, color: mapGame.ourScore > mapGame.theirScore ? "var(--green)" : mapGame.ourScore < mapGame.theirScore ? "var(--red)" : "var(--t3)" }}>
            {mapGame.ourScore !== undefined ? `${mapGame.ourScore}–${mapGame.theirScore}` : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

function PatternsTable({ patterns, teamName, totalSeries, seriesForPatterns }) {
  const teamShort = teamName ? teamName.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0,4) : "Us";
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState(-1);
  const [hoveredMap, setHoveredMap] = useState(null);

  // Recompute ban/pick counts from filtered series if provided
  const displayPatterns = React.useMemo(() => {
    if (!seriesForPatterns || seriesForPatterns.length === 0) return patterns;
    const ourNameClean = (teamName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const mapStats = {};
    seriesForPatterns.forEach(s => {
      const aNameClean = (s.teamAName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const weAreTeamA = ourNameClean.length >= 3 && aNameClean.includes(ourNameClean.slice(0, 4));
      (s.veto || []).forEach((v, vi) => {
        const map = v.map;
        if (!mapStats[map]) mapStats[map] = { ourBans: 0, oppBans: 0, ourPicks: 0, oppPicks: 0 };
        const ms = mapStats[map];
        const vNameClean = (v.teamName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        let isOurs;
        if (vNameClean && ourNameClean.length >= 3 && vNameClean.includes(ourNameClean.slice(0, 4))) {
          isOurs = true;
        } else if (vNameClean && ourNameClean.length >= 3 && ourNameClean.includes(vNameClean.slice(0, 4))) {
          isOurs = true;
        } else {
          isOurs = weAreTeamA ? vi % 2 === 0 : vi % 2 === 1;
        }
        if (v.action === "ban")  { isOurs ? ms.ourBans++  : ms.oppBans++;  }
        if (v.action === "pick") { isOurs ? ms.ourPicks++ : ms.oppPicks++; }
      });
    });
    return patterns.map(p => ({
      ...p,
      ourBans:  (mapStats[p.map] || {}).ourBans  || 0,
      oppBans:  (mapStats[p.map] || {}).oppBans  || 0,
      ourPicks: (mapStats[p.map] || {}).ourPicks || 0,
      oppPicks: (mapStats[p.map] || {}).oppPicks || 0,
      ourBanRate: seriesForPatterns.length > 0 ? Math.round(((mapStats[p.map] ? mapStats[p.map].ourBans : 0) / seriesForPatterns.length) * 100) : 0,
    }));
  }, [seriesForPatterns, patterns, teamName]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(-1); }
  };

  const sorted = [...displayPatterns].sort((a, b) => {
    const vals = {
      map:     [a.map, b.map],
      banRate: [a.ourBanRate ?? a.banRate ?? 0, b.ourBanRate ?? b.banRate ?? 0],
      total:   [(a.ourBans??0)+(a.oppBans??0)+(a.ourPicks??0)+(a.oppPicks??0),
                (b.ourBans??0)+(b.oppBans??0)+(b.ourPicks??0)+(b.oppPicks??0)],
      winRate: [a.winRate??-1, b.winRate??-1],
      played:  [a.played??0,   b.played??0],
      atkWR:   [a.atkWR??-1,   b.atkWR??-1],
      defWR:   [a.defWR??-1,   b.defWR??-1],
    };
    const [av, bv] = vals[sortKey] || [0, 0];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return (av - bv) * sortDir;
  });

  const Th = ({ k, label, title }) => (
    <th onClick={() => handleSort(k)} title={title}
      style={{ padding:"8px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase",
        color: sortKey===k ? "var(--acc)" : "var(--t3)", cursor:"pointer", textAlign:"center", userSelect:"none", whiteSpace:"nowrap" }}>
      {label}{sortKey===k ? (sortDir===-1 ? " ↓" : " ↑") : ""}
    </th>
  );

  const Bar = ({ val, max=100, color="var(--acc)", w=60 }) => (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:w, height:5, background:"var(--s3)", borderRadius:3, overflow:"hidden" }}>
        <div style={{ width:`${Math.min(100,(val/max)*100)}%`, height:"100%", background:color, borderRadius:3 }}/>
      </div>
      <span style={{ fontSize:11, color:"var(--t2)", minWidth:28, textAlign:"right" }}>{val}%</span>
    </div>
  );

  const WRColor = (wr) => wr == null ? "var(--t3)" : wr >= 55 ? "var(--green)" : wr >= 45 ? "var(--orange)" : "var(--red)";

  return (
    <div>
      <div style={{ fontSize:11, color:"var(--t3)", marginBottom:12 }}>
        Based on {seriesForPatterns ? seriesForPatterns.length : totalSeries} series · ATK/DEF RWin% sourced from VLR.gg stats · Click headers to sort
      </div>
      <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
            <thead>
              <tr style={{ borderBottom:"2px solid var(--b2)", background:"var(--s3)" }}>
                <th style={{ padding:"10px 14px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--t3)", textAlign:"left" }}>Map</th>
                <Th k="played"  label="Played"    title="Total maps played (from VLR stats)"/>
                <Th k="winRate" label="Map WR"    title="Overall map win rate (from VLR stats)"/>
                <Th k="banRate" label="Ban Rate"  title="How often this map was banned by either team"/>
                <th style={{ padding:"8px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--t3)", textAlign:"center" }} colSpan={2}>Bans</th>
                <th style={{ padding:"8px 10px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--t3)", textAlign:"center" }} colSpan={2}>Picks</th>
                <Th k="atkWR" label="ATK RWin%" title="Attack side round win rate (from VLR stats)"/>
                <Th k="defWR" label="DEF RWin%" title="Defense side round win rate (from VLR stats)"/>
              </tr>
              <tr style={{ borderBottom:"1px solid var(--b2)", background:"var(--s3)" }}>
                <th/><th/><th/>
                <th style={{ padding:"4px 10px", fontSize:9, color:"var(--t3)", textAlign:"center" }}>{totalSeries} series</th>
                <th style={{ padding:"4px 10px", fontSize:9, color:"var(--acc)", textAlign:"center" }}>{teamShort}</th>
                <th style={{ padding:"4px 10px", fontSize:9, color:"var(--t3)", textAlign:"center" }}>Opp</th>
                <th style={{ padding:"4px 10px", fontSize:9, color:"var(--acc)", textAlign:"center" }}>{teamShort}</th>
                <th style={{ padding:"4px 10px", fontSize:9, color:"var(--t3)", textAlign:"center" }}>Opp</th>
                <th/><th/>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const isHovered = hoveredMap === row.map;
                const losses = row.losses ?? (row.played > 0 ? row.played - (row.wins ?? 0) : 0);
                return (
                  <tr key={row.map}
                    onMouseEnter={() => setHoveredMap(row.map)}
                    onMouseLeave={() => setHoveredMap(null)}
                    style={{ borderBottom:"1px solid var(--b1)", background: isHovered ? "var(--s3)" : i%2===0 ? "transparent" : "rgba(255,255,255,0.01)", transition:"background 0.1s" }}>
                    {/* Map name */}
                    <td style={{ padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {MAP_IMAGES[row.map] && (
                          <img src={MAP_IMAGES[row.map]} alt={row.map}
                            style={{ width:44, height:28, objectFit:"cover", borderRadius:4, opacity:0.85, flexShrink:0 }}/>
                        )}
                        <span style={{ fontWeight:800, fontSize:13, color:"var(--t1)" }}>{row.map}</span>
                      </div>
                    </td>
                    {/* Played + W-L */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      {row.played > 0 ? (
                        <div>
                          <span style={{ fontSize:13, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color:"var(--t1)" }}>{row.played}</span>
                          <span style={{ fontSize:10, color:"var(--t3)", marginLeft:4 }}>
                            (<span style={{ color:"var(--green)" }}>{row.wins ?? 0}W</span>–<span style={{ color:"var(--red)" }}>{losses}L</span>)
                          </span>
                        </div>
                      ) : <span style={{ color:"var(--t3)" }}>—</span>}
                    </td>
                    {/* Map WR */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      {row.winRate != null
                        ? <span style={{ fontSize:15, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color: WRColor(row.winRate) }}>{row.winRate}%</span>
                        : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                    </td>
                    {/* Ban rate */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      {totalSeries > 0 ? <Bar val={row.ourBanRate ?? 0} color="var(--red)"/> : <span style={{ color:"var(--t3)" }}>—</span>}
                    </td>
                    {/* Bans ours/theirs */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <span style={{ fontSize:14, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color: (row.ourBans??0) > 0 ? "var(--red)" : "var(--t3)" }}>{row.ourBans || "–"}</span>
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <span style={{ fontSize:14, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color: (row.oppBans??0) > 0 ? "var(--red)" : "var(--t3)" }}>{row.oppBans || "–"}</span>
                    </td>
                    {/* Picks ours/theirs */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <span style={{ fontSize:14, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color: (row.ourPicks??0) > 0 ? "#4fc3f7" : "var(--t3)" }}>{row.ourPicks || "–"}</span>
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <span style={{ fontSize:14, fontWeight:900, fontFamily:"'DIN Next LT Pro',sans-serif", color: (row.oppPicks??0) > 0 ? "#4fc3f7" : "var(--t3)" }}>{row.oppPicks || "–"}</span>
                    </td>
                    {/* ATK RWin% */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      {row.atkWR != null
                        ? <Bar val={row.atkWR} color={WRColor(row.atkWR)} w={50}/>
                        : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                    </td>
                    {/* DEF RWin% */}
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      {row.defWR != null
                        ? <Bar val={row.defWR} color={WRColor(row.defWR)} w={50}/>
                        : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ════ VETO PLANNER PAGE ════ */
/* Two tabs: Auto-Draft (Workflow 1) + Interactive Veto Board (Workflow 2) */
/* ── MAP VETO TAB (embedded inside Veto Tools) ── */
function MapVetoTab() {
  const [query, setQuery]             = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]     = useState(false);
  const [teamData, setTeamData]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [activeTab, setActiveTab]     = useState("series");
  const [hoveredMap, setHoveredMap]   = useState(null);
  const [eventFilter, setEventFilter] = useState("all");
  const [hideMissingVeto, setHideMissingVeto]     = useState(true);
  const [showStartingSides, setShowStartingSides] = useState(true);
  const [showSettings, setShowSettings]           = useState(false);
  const searchTimeout = useRef(null);

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      if (/^\d+$/.test(val.trim())) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const data = await api.get(`/api/veto/search?q=${encodeURIComponent(val.trim())}`);
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const loadTeam = async (idOrQuery) => {
    const trimmed = (idOrQuery || "").trim();
    if (!trimmed) return;
    const validate = (data) => {
      if (!data) throw new Error("No response from server");
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.series)) throw new Error("Invalid response from server");
    };
    const isNumeric = /^\d+$/.test(trimmed);
    if (isNumeric) {
      setLoading(true); setError(""); setTeamData(null); setSearchResults([]);
      try { const d = await api.get(`/api/veto/team/${trimmed}`); validate(d); setTeamData(d); setActiveTab("series"); setEventFilter("all"); }
      catch (e) { setError(e.message || "Failed to load team data"); }
      finally { setLoading(false); }
      return;
    }
    if (searchResults.length > 0) {
      const teamId = searchResults[0].id;
      setLoading(true); setError(""); setTeamData(null); setSearchResults([]);
      try { const d = await api.get(`/api/veto/team/${teamId}`); validate(d); setTeamData(d); setActiveTab("series"); setEventFilter("all"); }
      catch (e) { setError(e.message || "Failed to load team data"); }
      finally { setLoading(false); }
      return;
    }
    setLoading(true); setError(""); setTeamData(null);
    try {
      const results = await api.get(`/api/veto/search?q=${encodeURIComponent(trimmed)}`);
      if (!results || results.length === 0) { setError(`No teams found for '${trimmed}'`); return; }
      setQuery(results[0].name); setSearchResults([]);
      const d = await api.get(`/api/veto/team/${results[0].id}`);
      validate(d); setTeamData(d); setActiveTab("series"); setEventFilter("all");
    } catch (e) { setError(e.message || "Failed to load team data"); }
    finally { setLoading(false); }
  };

  const handleSearchSelect = (team) => { setQuery(team.name); setSearchResults([]); loadTeam(String(team.id)); };

  const allSeries = teamData ? (teamData.series || []) : [];
  const seriesFiltered = allSeries
    .filter(s => !hideMissingVeto || s.hasVeto)
    .filter(s => eventFilter === "all" || (s.event || "") === eventFilter);
  const uniqueEvents = teamData ? [...new Set(allSeries.map(s => s.event || "").filter(Boolean))].sort() : [];

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontSize:12, color:"var(--t3)" }}>Search a team on VLR.GG to analyse their ban/pick patterns</div>
        <button onClick={() => setShowSettings(s => !s)}
          style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"6px 12px", color:"var(--t2)", fontSize:12, cursor:"pointer" }}>
          ⚙ Options
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:10, padding:14, marginBottom:14 }}>
          {[
            { key:"hideMissingVeto", label:"Hide series without veto data", val:hideMissingVeto, set:setHideMissingVeto },
            { key:"showStartingSides", label:"Show starting sides by default", val:showStartingSides, set:setShowStartingSides },
          ].map(opt => (
            <div key={opt.key} style={{ display:"flex", gap:10, alignItems:"center", marginBottom:8, cursor:"pointer" }} onClick={() => opt.set(v => !v)}>
              <div style={{ width:16, height:16, borderRadius:3, background: opt.val ? "var(--acc)" : "var(--s1)", border:`1px solid ${opt.val ? 'var(--acc)' : 'var(--b2)'}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {opt.val && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <span style={{ fontSize:12, color:"var(--t1)" }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div style={{ position:"relative", maxWidth:520, marginBottom:18 }}>
        <div style={{ display:"flex", gap:8 }}>
          <div style={{ flex:1, position:"relative" }}>
            <input value={query} onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadTeam(query)}
              placeholder="Team name or VLR team ID (e.g. 2593)…"
              style={{ width:"100%", background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 14px", color:"var(--t1)", fontSize:13, outline:"none", boxSizing:"border-box" }}/>
            {searchResults.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, zIndex:100, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
                {searchResults.map(t => (
                  <div key={t.id} onClick={() => handleSearchSelect(t)}
                    style={{ padding:"9px 14px", cursor:"pointer", fontSize:12, color:"var(--t1)", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e => e.currentTarget.style.background="var(--s3)"}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <span>{t.name}</span><span style={{ fontSize:10, color:"var(--t3)" }}>ID: {t.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => loadTeam(query)} disabled={!(query.trim() && !loading)}
            style={{ background:"var(--acc)", border:"none", borderRadius:8, padding:"10px 18px", color:"#000", fontWeight:800, fontSize:13, cursor:"pointer", flexShrink:0, opacity:(!query.trim()||loading)?0.5:1 }}>
            {loading ? "Loading…" : "Search"}
          </button>
        </div>
      </div>

      {error && <div style={{ color:"var(--red)", fontSize:13, marginBottom:14, padding:"10px 14px", background:"rgba(255,82,82,0.08)", borderRadius:8, border:"1px solid rgba(255,82,82,0.2)" }}>{error}</div>}

      {loading && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:60, gap:12, color:"var(--t3)" }}>
          <div style={{ width:32, height:32, border:"3px solid var(--b2)", borderTopColor:"var(--acc)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          <div style={{ fontSize:13 }}>Fetching veto data from VLR.GG…</div>
        </div>
      )}

      {teamData && !loading && (
        <>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16, padding:"12px 16px", background:"var(--s2)", borderRadius:12, border:"1px solid var(--b2)" }}>
            {teamData.teamLogo && <img src={`${API}/api/img-proxy?url=${encodeURIComponent(teamData.teamLogo)}`} alt="" style={{ width:36, height:36, objectFit:"contain", borderRadius:4 }}/>}
            <div>
              <div style={{ fontWeight:900, fontSize:16, color:"var(--t1)" }}>{teamData.teamName}</div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{teamData.totalSeries} series · {seriesFiltered.length} with veto data</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid var(--b1)", marginBottom:14 }}>
            <div style={{ display:"flex", gap:2 }}>
              {[["series","📋 Series"],["patterns","📊 Patterns"]].map(([k,l]) => (
                <button key={k} onClick={() => setActiveTab(k)}
                  style={{ background:"none", border:"none", padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer",
                    color: activeTab===k ? "var(--acc)" : "var(--t3)",
                    borderBottom: activeTab===k ? "2px solid var(--acc)" : "2px solid transparent", marginBottom:-1 }}>
                  {l}
                </button>
              ))}
            </div>
            {uniqueEvents.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingBottom:4 }}>
                <span style={{ fontSize:11, color:"var(--t3)", fontWeight:600 }}>Event</span>
                <select value={eventFilter} onChange={e => setEventFilter(e.target.value)}
                  style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6, padding:"4px 10px", fontSize:12, color:"var(--t1)" }}>
                  <option value="all">All Events</option>
                  {uniqueEvents.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </div>
            )}
          </div>

          {activeTab === "series" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {seriesFiltered.length === 0 && (
                <div style={{ textAlign:"center", padding:40, color:"var(--t3)", fontSize:13 }}>
                  No series with veto data found.{hideMissingVeto ? ' Try disabling "Hide series without veto data" in Options.' : ""}
                </div>
              )}
              {seriesFiltered.map(s => (
                <SeriesCard key={s.matchId} series={s} teamId={teamData.teamId}
                  hoveredMap={hoveredMap} onHoverMap={setHoveredMap} showStartingSides={showStartingSides}/>
              ))}
            </div>
          )}

          {activeTab === "patterns" && (
            <PatternsTable patterns={teamData.patterns} teamName={teamData.teamName}
              totalSeries={seriesFiltered.length} seriesForPatterns={seriesFiltered}/>
          )}
        </>
      )}

      {!teamData && !loading && !error && (
        <div style={{ textAlign:"center", padding:60, color:"var(--t3)" }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>⊘</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>Search for a team to get started</div>
          <div style={{ fontSize:12 }}>Enter a team name or their VLR.GG team ID</div>
        </div>
      )}
    </div>
  );
}

function VetoPlannerPage() {
  const [tab, setTab] = useState("draft"); // "draft" | "board" | "mapveto" | "reports"
  return (
    <div style={{ flex:1, overflow:"auto", background:"var(--bg)", padding:24 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"var(--t1)", margin:0 }}>Veto Tools</h2>
          <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>Auto-draft recommendations · Interactive veto board · Map veto analysis</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:2, borderBottom:"1px solid var(--b1)", marginBottom:20 }}>
        {[["draft","🎯 Auto-Draft"],["board","🗺 Veto Board"],["mapveto","📊 Map Veto Analysis"],["reports","📋 Saved Reports"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background:"none", border:"none", padding:"8px 20px", fontSize:13, fontWeight:700, cursor:"pointer",
              color: tab===k ? "var(--acc)" : "var(--t3)",
              borderBottom: tab===k ? "2px solid var(--acc)" : "2px solid transparent", marginBottom:-1 }}>
            {l}
          </button>
        ))}
      </div>
      {tab === "draft"   && <AutoDraftTab/>}
      {tab === "board"   && <VetoBoardTab/>}
      {tab === "mapveto" && <MapVetoTab/>}
      {tab === "reports" && <SavedReportsTab/>}
    </div>
  );
}

/* ── SAVED REPORTS TAB ── */
function SavedReportsTab() {
  const [reports, setReports]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [selected, setSelected]           = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleting, setDeleting]           = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchReports = async () => {
    setLoading(true); setError("");
    try {
      const data = await api.get("/api/veto-reports");
      setReports(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message || "Failed to load reports"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const openReport = async (id) => {
    setLoadingDetail(true); setSelected(null);
    try {
      const data = await api.get(`/api/veto-reports/${id}`);
      const parsed = {
        ...data,
        actions:      typeof data.actions      === "string" ? JSON.parse(data.actions)      : (data.actions      || []),
        opp_patterns: typeof data.opp_patterns === "string" ? JSON.parse(data.opp_patterns) : (data.opp_patterns || []),
      };
      setSelected(parsed);
    } catch (e) { setError(e.message || "Failed to load report"); }
    finally { setLoadingDetail(false); }
  };

  const deleteReport = async (id) => {
    setDeleting(id); setConfirmDelete(null);
    try {
      await api.delete(`/api/veto-reports/${id}`);
      setReports(r => r.filter(x => x.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) { setError(e.message || "Failed to delete"); }
    finally { setDeleting(null); }
  };

  const ACTION_COLOR = { ban:"var(--red)", pick:"var(--blue)", decider:"#a78bfa", side:"var(--purple)" };
  const ACTION_BG    = { ban:"rgba(255,82,82,0.13)", pick:"rgba(79,195,247,0.13)", decider:"rgba(167,139,250,0.13)", side:"rgba(179,157,219,0.12)" };
  const ACTION_LABEL = { ban:"BAN", pick:"PICK", decider:"DEC", side:"SIDE" };

  const fmtDate = (s) => {
    if (!s) return "";
    try { return new Date(s).toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" }); }
    catch { return s; }
  };

  if (loading) return <div style={{ textAlign:"center", padding:60, color:"var(--t3)", fontSize:13 }}>Loading saved reports…</div>;
  if (error)   return <div style={{ textAlign:"center", padding:60, color:"var(--red)", fontSize:13 }}>{error}</div>;
  if (reports.length === 0) return (
    <div style={{ textAlign:"center", padding:60, color:"var(--t3)" }}>
      <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>📋</div>
      <div style={{ fontSize:14, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>No saved veto reports yet</div>
      <div style={{ fontSize:12 }}>Use the Veto Board tab to plan a veto, then save it as a report.</div>
    </div>
  );

  return (
    <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

      {/* List */}
      <div style={{ width:300, flexShrink:0, display:"flex", flexDirection:"column", gap:8 }}>
        {reports.map(r => (
          <div key={r.id} onClick={() => openReport(r.id)}
            style={{ background: selected?.id === r.id ? "var(--s3)" : "var(--s2)",
              border:`1px solid ${selected?.id === r.id ? "var(--acc)" : "var(--b2)"}`,
              borderRadius:10, padding:"10px 14px", cursor:"pointer", transition:"all 0.15s" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:4 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--t1)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.name}</span>
              <button onClick={e => { e.stopPropagation(); setConfirmDelete(r.id); }}
                style={{ background:"none", border:"none", color:"var(--t3)", fontSize:13, cursor:"pointer", padding:"0 2px", flexShrink:0 }}>✕</button>
            </div>
            {r.opp_name && <div style={{ fontSize:11, color:"var(--acc)", fontWeight:600, marginBottom:3 }}>vs {r.opp_name}</div>}
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:10, color:"var(--t3)" }}>{r.format?.toUpperCase() || "BO3"}</span>
              <span style={{ fontSize:10, color:"var(--t3)" }}>·</span>
              <span style={{ fontSize:10, color:"var(--t3)" }}>{fmtDate(r.created_at)}</span>
            </div>
            {r.summary && <div style={{ fontSize:10, color:"var(--t3)", marginTop:5, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.summary}</div>}
          </div>
        ))}
      </div>

      {/* Detail panel */}
      <div style={{ flex:1, minWidth:0 }}>
        {loadingDetail && <div style={{ textAlign:"center", padding:60, color:"var(--t3)", fontSize:13 }}>Loading…</div>}

        {!loadingDetail && !selected && (
          <div style={{ textAlign:"center", padding:60, color:"var(--t3)" }}>
            <div style={{ fontSize:28, marginBottom:10, opacity:0.3 }}>👈</div>
            <div style={{ fontSize:13 }}>Select a report to view details</div>
          </div>
        )}

        {!loadingDetail && selected && (
          <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, padding:20 }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, gap:12 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--t1)", marginBottom:4 }}>{selected.name}</div>
                <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  {selected.opp_name && <span style={{ fontSize:12, color:"var(--acc)", fontWeight:600 }}>vs {selected.opp_name}</span>}
                  <span style={{ fontSize:11, color:"var(--t3)" }}>{selected.format?.toUpperCase() || "BO3"}</span>
                  <span style={{ fontSize:11, color:"var(--t3)" }}>{fmtDate(selected.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setConfirmDelete(selected.id)}
                style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.3)", borderRadius:7,
                  color:"var(--red)", fontSize:12, fontWeight:600, padding:"6px 14px", cursor:"pointer", flexShrink:0 }}>
                🗑 Delete
              </button>
            </div>

            {/* Veto sequence */}
            {selected.actions?.filter(a => a.action !== "side").length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:10 }}>Veto Sequence</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {selected.actions.filter(a => a.action !== "side").map((a, i) => (
                    <div key={i} style={{ display:"flex", alignItems:"stretch", borderRadius:6, overflow:"hidden",
                      border:`1px solid ${ACTION_COLOR[a.action] || "var(--b2)"}` }}>
                      <div style={{ padding:"4px 8px", background:ACTION_BG[a.action] || "var(--s3)",
                        borderRight:`1px solid ${ACTION_COLOR[a.action] || "var(--b2)"}40`,
                        display:"flex", alignItems:"center", gap:4 }}>
                        <span style={{ fontSize:9, fontWeight:800, color:ACTION_COLOR[a.action] || "var(--t3)" }}>{ACTION_LABEL[a.action] || a.action?.toUpperCase()}</span>
                        {a.team && <span style={{ fontSize:9, color:"var(--t3)" }}>Team {a.team}</span>}
                      </div>
                      <div style={{ padding:"4px 10px", display:"flex", alignItems:"center" }}>
                        <span style={{ fontSize:12, fontWeight:800, color:"var(--t1)", fontFamily:"'DIN Next LT Pro',sans-serif" }}>{a.map || "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side assignments */}
            {selected.actions?.filter(a => a.action === "side").length > 0 && (
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Side Assignments</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {selected.actions.filter(a => a.action === "side").map((a, i) => (
                    <div key={i} style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6, padding:"4px 10px", fontSize:11, color:"var(--t2)" }}>
                      Team {a.team} → <span style={{ fontWeight:700, color:a.side==="ATK" ? "var(--orange)" : "var(--blue)" }}>{a.side}</span>
                      {a.forPickIndex != null && <span style={{ color:"var(--t3)" }}> on Map {a.forPickIndex}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opponent patterns */}
            {selected.opp_patterns?.length > 0 && (
              <div>
                <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.07em", textTransform:"uppercase", marginBottom:8 }}>Opponent Map Patterns</div>
                <div style={{ background:"var(--s3)", borderRadius:8, overflow:"hidden", border:"1px solid var(--b1)" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 60px 60px 60px", padding:"7px 12px",
                    borderBottom:"1px solid var(--b1)", fontSize:10, fontWeight:800, color:"var(--t3)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                    <span>Map</span>
                    <span style={{ textAlign:"center" }}>Our Picks</span>
                    <span style={{ textAlign:"center" }}>Opp Picks</span>
                    <span style={{ textAlign:"center" }}>Our Bans</span>
                    <span style={{ textAlign:"center" }}>Opp Bans</span>
                  </div>
                  {selected.opp_patterns.map((p, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 60px 60px 60px 60px", padding:"6px 12px",
                      borderBottom: i < selected.opp_patterns.length-1 ? "1px solid var(--b1)" : "none",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"var(--t1)" }}>{p.map}</span>
                      <span style={{ fontSize:12, textAlign:"center", color:(p.ourPicks||0)>0 ? "var(--blue)"   : "var(--t3)" }}>{p.ourPicks||0}</span>
                      <span style={{ fontSize:12, textAlign:"center", color:(p.oppPicks||0)>0 ? "var(--orange)" : "var(--t3)" }}>{p.oppPicks||0}</span>
                      <span style={{ fontSize:12, textAlign:"center", color:(p.ourBans||0)>0  ? "var(--red)"    : "var(--t3)" }}>{p.ourBans||0}</span>
                      <span style={{ fontSize:12, textAlign:"center", color:(p.oppBans||0)>0  ? "var(--red)"    : "var(--t3)" }}>{p.oppBans||0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth:360 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:700, color:"var(--t1)", marginBottom:10 }}>Delete Report?</div>
            <div style={{ fontSize:13, color:"var(--t3)", marginBottom:20 }}>
              This will permanently delete <strong style={{ color:"var(--t1)" }}>{reports.find(r => r.id === confirmDelete)?.name || "this report"}</strong>. This can't be undone.
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, padding:"7px 16px", color:"var(--t2)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={() => deleteReport(confirmDelete)} disabled={!!deleting}
                style={{ background:"rgba(255,82,82,0.15)", border:"1px solid rgba(255,82,82,0.4)", borderRadius:7,
                  padding:"7px 16px", color:"var(--red)", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {deleting === confirmDelete ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── AUTO-DRAFT TAB ── */
function AutoDraftTab() {
  const [query, setQuery]         = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [oppData, setOppData]     = useState(null);  // full team data from /api/veto/team/:id
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const [error, setError]         = useState("");
  const [ourSide, setOurSide]     = useState("A");  // "A" or "B" — which team we are in the veto
  const [draftPool, setDraftPool] = useState(new Set(["Abyss","Ascent","Bind","Breeze","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset","Corrode"]));
  const searchTimeout = useRef(null);

  const MAPS = ["Ascent","Breeze","Fracture","Haven","Split","Lotus","Pearl"];

  const handleQueryChange = (val) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      if (/^\d+$/.test(val.trim())) { setSearchResults([]); return; }
      setSearching(true);
      try {
        const data = await api.get(`/api/veto/search?q=${encodeURIComponent(val.trim())}`);
        setSearchResults(data);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  };

  const loadOpp = async (idOrQuery) => {
    const trimmed = (idOrQuery || "").trim();
    if (!trimmed) return;
    setLoadingOpp(true); setError(""); setOppData(null); setSuggestions(null); setSearchResults([]);
    try {
      let teamId = trimmed;
      if (!/^\d+$/.test(trimmed)) {
        const results = await api.get(`/api/veto/search?q=${encodeURIComponent(trimmed)}`);
        if (!results || results.length === 0) throw new Error(`No teams found for '${trimmed}'`);
        teamId = String(results[0].id);
        setQuery(results[0].name);
      }
      const data = await api.get(`/api/veto/team/${teamId}`);
      if (!data) throw new Error("No response from server");
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.series)) throw new Error("Unexpected response format from VLR scraper");
      setOppData(data);
    } catch (e) { setError(e.message || "Failed to load team"); }
    finally { setLoadingOpp(false); }
  };

  const handleSearchSelect = (team) => {
    setQuery(team.name); setSearchResults([]);
    loadOpp(String(team.id));
  };

  const generateSuggestions = async () => {
    if (!oppData) return;
    setLoadingSugg(true); setError("");
    try {
      const data = await api.post("/api/veto/draft-suggestions", {
        oppPatterns: oppData.patterns || [],
        ourSide,
        mapPool: [...draftPool],
      });
      setSuggestions(data);
    } catch (e) { setError(e.message || "Failed to generate suggestions"); }
    finally { setLoadingSugg(false); }
  };

  const WRColor = (wr) => wr == null ? "var(--t3)" : wr >= 55 ? "var(--green)" : wr >= 45 ? "var(--orange)" : "var(--red)";

  const DraftOption = ({ opt, label, accent }) => {
    if (!opt) return null;
    const accentColor = accent ? "var(--acc)" : "var(--blue)";
    return (
      <div style={{ background:"var(--s2)", border:`1px solid ${accent ? "rgba(212,255,30,0.25)" : "var(--b2)"}`, borderRadius:12, overflow:"hidden", flex:1, minWidth:0 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--b1)", background: accent ? "rgba(212,255,30,0.05)" : "var(--s3)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontWeight:800, fontSize:14, color: accentColor }}>{opt.label}</div>
            <div style={{ fontSize:11, color:"var(--t3)", marginTop:2 }}>{opt.desc}</div>
          </div>
          <div style={{ fontSize:22 }}>{accent ? "⚔️" : "🛡️"}</div>
        </div>
        <div style={{ padding:16, display:"flex", flexDirection:"column", gap:8 }}>
          {/* Round 1 Bans */}
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase", color:"var(--t3)", marginBottom:4 }}>Round 1 Bans</div>
          {(opt.bans1 || opt.bans || []).map((b, i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"9px 12px", background:"rgba(255,82,82,0.06)", border:"1px solid rgba(255,82,82,0.15)", borderRadius:8 }}>
              <div style={{ width:28, height:18, borderRadius:3, background:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff", flexShrink:0, marginTop:1 }}>BAN</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"var(--t1)" }}>{b.map}</div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:2, lineHeight:1.4 }}>{b.reason}</div>
              </div>
            </div>
          ))}
          {/* Our Picks */}
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase", color:"var(--t3)", marginTop:4, marginBottom:4 }}>Our Picks</div>
          {(opt.picks || []).map((p, i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"9px 12px", background:"rgba(79,195,247,0.06)", border:"1px solid rgba(79,195,247,0.15)", borderRadius:8 }}>
              <div style={{ width:28, height:18, borderRadius:3, background:"var(--blue)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#000", flexShrink:0, marginTop:1 }}>PICK</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:13, color:"var(--t1)" }}>{p.map}</div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:2, lineHeight:1.4 }}>{p.reason}</div>
              </div>
            </div>
          ))}
          {/* Round 2 Bans */}
          {(opt.bans2 || []).length > 0 && (
            <>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase", color:"var(--t3)", marginTop:4, marginBottom:4 }}>Round 2 Bans</div>
              {(opt.bans2 || []).map((b, i) => (
                <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"9px 12px", background:"rgba(255,82,82,0.06)", border:"1px solid rgba(255,82,82,0.15)", borderRadius:8 }}>
                  <div style={{ width:28, height:18, borderRadius:3, background:"var(--red)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff", flexShrink:0, marginTop:1 }}>BAN</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:13, color:"var(--t1)" }}>{b.map}</div>
                    <div style={{ fontSize:11, color:"var(--t3)", marginTop:2, lineHeight:1.4 }}>{b.reason}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {/* Likely Decider */}
          {opt.decider && (
            <>
              <div style={{ fontSize:10, fontWeight:800, letterSpacing:"0.09em", textTransform:"uppercase", color:"var(--t3)", marginTop:4, marginBottom:4 }}>Likely Decider</div>
              <div style={{ display:"flex", gap:10, alignItems:"center", padding:"9px 12px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", borderRadius:8 }}>
                <div style={{ width:28, height:18, borderRadius:3, background:"#a78bfa", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#000", flexShrink:0 }}>DEC</div>
                <div style={{ fontWeight:800, fontSize:13, color:"var(--t1)" }}>{opt.decider}</div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Search bar */}
      <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, padding:16, marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:700, color:"var(--t2)", marginBottom:10 }}>Step 1 — Load opponent veto history from VLR.GG</div>
        <div style={{ position:"relative", display:"flex", gap:8, maxWidth:520 }}>
          <div style={{ flex:1, position:"relative" }}>
            <input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onKeyDown={e => e.key === "Enter" && loadOpp(query)}
              placeholder="Opponent team name or VLR team ID…"
              style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 14px", color:"var(--t1)", fontSize:13, outline:"none", boxSizing:"border-box" }}
            />
            {searchResults.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, zIndex:100, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
                {searchResults.map(t => (
                  <div key={t.id} onClick={() => handleSearchSelect(t)}
                    style={{ padding:"9px 14px", cursor:"pointer", fontSize:12, color:"var(--t1)", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--s3)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span>{t.name}</span>
                    <span style={{ fontSize:10, color:"var(--t3)" }}>ID: {t.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => loadOpp(query)} disabled={!(query.trim() && !loadingOpp)}
            style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:8, padding:"10px 16px", color:"var(--t1)", fontWeight:700, fontSize:13, cursor:"pointer", flexShrink:0, opacity:(!query.trim()||loadingOpp)?0.5:1 }}>
            {loadingOpp ? "Loading…" : "Load Opponent"}
          </button>
        </div>
        {oppData && !loadingOpp && (
          <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:"var(--s3)", borderRadius:8, border:"1px solid var(--b2)" }}>
              {oppData.teamLogo && <img src={`${API}/api/img-proxy?url=${encodeURIComponent(oppData.teamLogo)}`} alt="" style={{ width:22, height:22, objectFit:"contain", borderRadius:3 }}/>}
              <span style={{ fontSize:12, fontWeight:700, color:"var(--acc)" }}>{oppData.teamName}</span>
              <span style={{ fontSize:11, color:"var(--t3)" }}>·</span>
              <span style={{ fontSize:11, color:"var(--t3)" }}>{oppData.totalSeries} series</span>
            </div>
            <button onClick={generateSuggestions} disabled={loadingSugg}
              style={{ background:"var(--acc)", border:"none", borderRadius:8, padding:"9px 18px", color:"#080a10", fontWeight:800, fontSize:13, cursor:"pointer", opacity:loadingSugg?0.6:1 }}>
              {loadingSugg ? "Generating…" : "⚡ Generate Draft"}
            </button>
          </div>
        )}
        {/* Team side + map pool selector */}
        <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:10 }}>
          {/* Team side */}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--t2)", minWidth:80 }}>We are</span>
            {["A","B"].map(s => (
              <button key={s} onClick={() => setOurSide(s)}
                style={{ padding:"5px 16px", borderRadius:6, border:`1px solid ${ourSide===s ? "var(--acc)" : "var(--b2)"}`,
                  background: ourSide===s ? "rgba(212,255,30,0.12)" : "var(--s3)",
                  color: ourSide===s ? "var(--acc)" : "var(--t2)", fontWeight:800, fontSize:12, cursor:"pointer" }}>
                Team {s}
              </button>
            ))}
            <span style={{ fontSize:10, color:"var(--t3)" }}>
              {ourSide==="A" ? "Ban 1, Pick 1, Ban 3" : "Ban 2, Pick 2, Ban 4"}
            </span>
          </div>
          {/* Map pool */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--t2)", marginBottom:6 }}>
              Map Pool <span style={{ color:"var(--t3)", fontWeight:400 }}>({draftPool.size} maps)</span>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {MAPS.map(m => {
                const on = draftPool.has(m);
                return (
                  <button key={m} onClick={() => {
                    const np = new Set(draftPool);
                    if (on && np.size > 5) np.delete(m); else np.add(m);
                    setDraftPool(np);
                  }}
                  style={{ padding:"4px 10px", borderRadius:5, border:`1px solid ${on ? "var(--acc)" : "var(--b2)"}`,
                    background: on ? "rgba(212,255,30,0.1)" : "var(--s3)",
                    color: on ? "var(--acc)" : "var(--t3)", fontSize:11, fontWeight:700, cursor:"pointer" }}>
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {error && <div style={{ color:"var(--red)", fontSize:13, marginBottom:16, padding:"10px 14px", background:"rgba(255,82,82,0.08)", borderRadius:8, border:"1px solid rgba(255,82,82,0.2)" }}>{error}</div>}

      {(loadingOpp || loadingSugg) && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:40, gap:10, color:"var(--t3)" }}>
          <div style={{ width:24, height:24, border:"3px solid var(--b2)", borderTopColor:"var(--acc)", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
          <span style={{ fontSize:13 }}>{loadingOpp ? "Fetching opponent data from VLR.GG…" : "Crunching scrim stats…"}</span>
        </div>
      )}

      {suggestions && !loadingSugg && (
        <>
          {/* Data quality banner */}
          <div style={{ marginBottom:16, padding:"10px 14px", background: suggestions.hasScrimData ? "rgba(105,240,174,0.06)" : "rgba(255,171,64,0.06)", border:`1px solid ${suggestions.hasScrimData ? "rgba(105,240,174,0.2)" : "rgba(255,171,64,0.2)"}`, borderRadius:8, fontSize:12, color: suggestions.hasScrimData ? "var(--green)" : "var(--orange)" }}>
            {suggestions.hasScrimData
              ? `✓ Using ${suggestions.totalScrims} scrim${suggestions.totalScrims!==1?"s":""} from your database (recent scrims weighted higher)`
              : "⚠ No scrim data found — recommendations based on opponent patterns only. Add scrims to your Scrim Log for personalised picks."}
          </div>

          {/* Two draft options side by side */}
          <div style={{ display:"flex", gap:16, marginBottom:24, flexWrap:"wrap" }}>
            <DraftOption opt={suggestions.optionA} accent={true}/>
            <DraftOption opt={suggestions.optionB} accent={false}/>
          </div>

          {/* Map breakdown table */}
          <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--b1)", fontWeight:700, fontSize:13, color:"var(--t2)" }}>Map Breakdown</div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                <thead>
                  <tr style={{ background:"var(--s3)", borderBottom:"1px solid var(--b2)" }}>
                    {["Map","Our WR (raw)","Our WR (weighted)","Scrims","Opp Pick Rate","Opp Ban Rate"].map(h => (
                      <th key={h} style={{ padding:"8px 14px", fontSize:10, fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--t3)", textAlign: h==="Map"?"left":"center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MAPS.map((m, i) => {
                    const ms = suggestions.mapScores?.[m] || {};
                    const rawWR = ms.rawWR;
                    const wWR   = ms.weightedWR;
                    const games = ms.games || 0;
                    // find opp pattern for this map
                    const oppP  = (oppData.patterns || []).find(p => p.map === m);
                    const oppPickRate = oppP ? ((oppP.oppPicks||0) / Math.max(1, (oppData.patterns||[]).reduce((s,x)=>s+(x.oppPicks||0),0)) * 100) : 0;
                    const oppBanRate  = oppP ? ((oppP.oppBans||0)  / Math.max(1, (oppData.patterns||[]).reduce((s,x)=>s+(x.oppBans||0),0))  * 100) : 0;
                    const WRColor = (wr) => wr == null ? "var(--t3)" : wr >= 55 ? "var(--green)" : wr >= 45 ? "var(--orange)" : "var(--red)";
                    return (
                      <tr key={m} style={{ borderBottom:"1px solid var(--b1)", background: i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                        <td style={{ padding:"9px 14px", fontWeight:800, fontSize:13 }}>{m}</td>
                        <td style={{ padding:"9px 14px", textAlign:"center", fontWeight:700, color: WRColor(rawWR), fontFamily:"'DIN Next LT Pro',sans-serif", fontSize:14 }}>
                          {rawWR != null ? Math.round(rawWR)+"%" : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 14px", textAlign:"center", fontWeight:700, color: WRColor(wWR), fontFamily:"'DIN Next LT Pro',sans-serif", fontSize:14 }}>
                          {wWR != null ? Math.round(wWR)+"%" : <span style={{ color:"var(--t3)", fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 14px", textAlign:"center", color:"var(--t3)", fontSize:12 }}>{games || "—"}</td>
                        <td style={{ padding:"9px 14px", textAlign:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                            <div style={{ width:50, height:4, background:"var(--s3)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,oppPickRate)}%`, height:"100%", background:"var(--blue)", borderRadius:2 }}/>
                            </div>
                            <span style={{ fontSize:11, color:"var(--t2)", minWidth:28 }}>{Math.round(oppPickRate)}%</span>
                          </div>
                        </td>
                        <td style={{ padding:"9px 14px", textAlign:"center" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                            <div style={{ width:50, height:4, background:"var(--s3)", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ width:`${Math.min(100,oppBanRate)}%`, height:"100%", background:"var(--red)", borderRadius:2 }}/>
                            </div>
                            <span style={{ fontSize:11, color:"var(--t2)", minWidth:28 }}>{Math.round(oppBanRate)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!oppData && !loadingOpp && !error && (
        <div style={{ textAlign:"center", padding:60, color:"var(--t3)" }}>
          <div style={{ fontSize:40, marginBottom:12, opacity:0.3 }}>⚡</div>
          <div style={{ fontSize:14, fontWeight:600, color:"var(--t2)", marginBottom:6 }}>Load an opponent to generate draft suggestions</div>
          <div style={{ fontSize:12 }}>We'll cross-reference their VLR pick/ban patterns with your scrim win rates</div>
        </div>
      )}
    </div>
  );
}

/* ── VETO BOARD TAB ── */
// Sequences built dynamically based on format + who is Team A/B
// BO3: A ban, B ban, A pick (B side), B pick (A side), A ban, B ban, decider remains
// BO5: A ban, B ban, A pick (B side), B pick (A side), A pick (B side), B ban, A ban, decider remains
// BO5 GF: A ban, A ban, A pick (B side), B pick (A side), A pick (B side), B pick (A side), decider remains
// "side" steps = the OTHER team chooses ATK or DEF after the pick

function buildSequence(format) {
  // Each step: { action: "ban"|"pick"|"side"|"decider", team: "A"|"B"|null, label, pickIndex? }
  if (format === "bo3") {
    // A ban, B ban, A pick (B picks side), B pick (A picks side), A ban, B ban, decider
    return [
      { action:"ban",     team:"A", label:"Ban 1" },
      { action:"ban",     team:"B", label:"Ban 2" },
      { action:"pick",    team:"A", label:"Pick 1", pickIndex:1 },
      { action:"side",    team:"B", label:"Side 1", forPickIndex:1 },
      { action:"pick",    team:"B", label:"Pick 2", pickIndex:2 },
      { action:"side",    team:"A", label:"Side 2", forPickIndex:2 },
      { action:"ban",     team:"A", label:"Ban 3" },
      { action:"ban",     team:"B", label:"Ban 4" },
      { action:"decider", team:null, label:"Decider" },
    ];
  }
  if (format === "bo5") {
    return [
      { action:"ban",     team:"A", label:"Ban 1" },
      { action:"ban",     team:"B", label:"Ban 2" },
      { action:"pick",    team:"A", label:"Pick 1", pickIndex:1 },
      { action:"side",    team:"B", label:"Side 1", forPickIndex:1 },
      { action:"pick",    team:"B", label:"Pick 2", pickIndex:2 },
      { action:"side",    team:"A", label:"Side 2", forPickIndex:2 },
      { action:"pick",    team:"A", label:"Pick 3", pickIndex:3 },
      { action:"side",    team:"B", label:"Side 3", forPickIndex:3 },
      { action:"ban",     team:"B", label:"Ban 3" },
      { action:"ban",     team:"A", label:"Ban 4" },
      { action:"decider", team:null, label:"Decider" },
    ];
  }
  if (format === "bo5gf") {
    // Higher seed (Team A) gets 2 consecutive bans first
    return [
      { action:"ban",     team:"A", label:"Ban 1" },
      { action:"ban",     team:"A", label:"Ban 2" },
      { action:"pick",    team:"A", label:"Pick 1", pickIndex:1 },
      { action:"side",    team:"B", label:"Side 1", forPickIndex:1 },
      { action:"pick",    team:"B", label:"Pick 2", pickIndex:2 },
      { action:"side",    team:"A", label:"Side 2", forPickIndex:2 },
      { action:"pick",    team:"A", label:"Pick 3", pickIndex:3 },
      { action:"side",    team:"B", label:"Side 3", forPickIndex:3 },
      { action:"pick",    team:"B", label:"Pick 4", pickIndex:4 },
      { action:"side",    team:"A", label:"Side 4", forPickIndex:4 },
      { action:"decider", team:null, label:"Decider" },
    ];
  }
  return [];
}

const BOARD_MAP_IMAGES = {
  Abyss:    "https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/splash.png",
  Ascent:   "https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/splash.png",
  Bind:     "https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/splash.png",
  Breeze:   "https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/splash.png",
  Corrode:  "https://media.valorant-api.com/maps/de73029c-4d2a-4ef2-8c85-9ce6af884d1c/splash.png",
  Fracture: "https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/splash.png",
  Haven:    "https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7825db44f3a0/splash.png",
  Icebox:   "https://media.valorant-api.com/maps/e2ad5c4f-4423-0ea2-9f9e-a41fc15aab88/splash.png",
  Lotus:    "https://media.valorant-api.com/maps/2fe4ed3a-450a-01be-2778-15ed9f5c7e3f/splash.png",
  Pearl:    "https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821f8eca2b/splash.png",
  Split:    "https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/splash.png",
  Sunset:   "https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39f7a7b2c9b9/splash.png",
};

function VetoBoardTab() {
  const ALL_MAPS = ["Abyss","Ascent","Bind","Breeze","Corrode","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset"];

  // Config
  const [format, setFormat]   = useState("bo3");     // "bo3" | "bo5" | "bo5gf"
  const [weAreTeam, setWeAreTeam] = useState("A");   // "A" | "B" — which team is "Us"
  const [teamAName, setTeamAName] = useState("Us");
  const [teamBName, setTeamBName] = useState("Them");

  // Opponent VLR stats
  const [oppQuery, setOppQuery]         = useState("");
  const [oppSearchResults, setOppSearchResults] = useState([]);
  const [oppSearching, setOppSearching] = useState(false);
  const [oppData, setOppData]           = useState(null);  // { teamName, teamLogo, patterns, series }
  const [loadingOpp, setLoadingOpp]     = useState(false);
  const [oppError, setOppError]         = useState("");
  const oppSearchTimeout = useRef(null);

  // Opp series panel
  const [showOppSeries, setShowOppSeries] = useState(false);
  const [seriesMapFilter, setSeriesMapFilter] = useState(null);

  // Manual veto log
  const [manualEntries, setManualEntries] = useState([]);
  const [manualMap, setManualMap]         = useState('');
  const [manualAction, setManualAction]   = useState('ban');
  const [manualTeam, setManualTeam]       = useState('opp');
  const [manualOppName, setManualOppName] = useState('');
  const [showManual, setShowManual]       = useState(false);

  // Save report modal
  const [saveReportOpen, setSaveReportOpen] = useState(false);
  const [reportName, setReportName]         = useState("");
  const [savingReport, setSavingReport]     = useState(false);
  const [savedMsg, setSavedMsg]             = useState("");

  const handleOppQueryChange = (val) => {
    setOppQuery(val);
    clearTimeout(oppSearchTimeout.current);
    if (!val.trim()) { setOppSearchResults([]); return; }
    oppSearchTimeout.current = setTimeout(async () => {
      if (/^\d+$/.test(val.trim())) { setOppSearchResults([]); return; }
      setOppSearching(true);
      try {
        const data = await api.get(`/api/veto/search?q=${encodeURIComponent(val.trim())}`);
        setOppSearchResults(Array.isArray(data) ? data : []);
      } catch { setOppSearchResults([]); }
      finally { setOppSearching(false); }
    }, 400);
  };

  const loadOppBoard = async (idOrQuery) => {
    const trimmed = (idOrQuery || "").trim();
    if (!trimmed) return;
    setLoadingOpp(true); setOppError(""); setOppData(null); setOppSearchResults([]);
    try {
      let teamId = trimmed;
      if (!/^\d+$/.test(trimmed)) {
        const results = await api.get(`/api/veto/search?q=${encodeURIComponent(trimmed)}`);
        if (!results || results.length === 0) throw new Error(`No teams found for '${trimmed}'`);
        teamId = String(results[0].id);
        setOppQuery(results[0].name);
      }
      const data = await api.get(`/api/veto/team/${teamId}`);
      if (!data) throw new Error("No response from server");
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.series)) throw new Error("Unexpected response from VLR scraper");
      setOppData(data);
    } catch (e) { setOppError(e.message || "Failed to load opponent"); }
    finally { setLoadingOpp(false); }
  };

  // Active map pool — initialized from scrim stats (maps with recorded scrims)
  const [activeMapPool, setActiveMapPool] = useState(new Set());

  // State
  const [actions, setActions]   = useState([]); // { stepIdx, action, team, map?, side?, label }
  const [hoveredMap, setHoveredMap] = useState(null);
  const [copied, setCopied]     = useState(false);
  const [scrimStats, setScrimStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Scrim stats — also drives the initial active map pool
  useEffect(() => {
    setLoadingStats(true);
    api.get("/api/scrims")
      .then(rows => {
        if (!Array.isArray(rows)) return;
        const stats = {};
        ALL_MAPS.forEach(m => { stats[m] = { wins:0, losses:0, total:0 }; });
        rows.forEach(s => {
          if (!stats[s.map]) return;
          stats[s.map].total++;
          if (s.res === "win") stats[s.map].wins++;
          else stats[s.map].losses++;
        });
        setScrimStats(stats);
        // Set active pool to maps that have at least 1 scrim recorded
        const withData = new Set(ALL_MAPS.filter(m => stats[m]?.total > 0));
        // If no scrim data at all, fall back to full pool so board is usable
        setActiveMapPool(withData.size > 0 ? withData : new Set(ALL_MAPS));
      })
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, []);

  const sequence    = buildSequence(format);
  const mapPool     = ALL_MAPS.filter(m => activeMapPool.has(m));

  // Derive current step index (skip "side" steps that are auto-resolved)
  const currentStepIdx = actions.length;
  const currentStep    = sequence[currentStepIdx] || null;
  const isDone         = currentStepIdx >= sequence.length;

  // Maps used in bans/picks/decider (not side steps)
  const usedMaps = new Set(actions.filter(a => a.map).map(a => a.map));

  // Picks so far: { pickIndex -> { map, side } }
  const picks = {};
  actions.forEach(a => {
    if (a.action === "pick" && a.pickIndex) picks[a.pickIndex] = { map: a.map };
    if (a.action === "side" && a.forPickIndex) {
      if (!picks[a.forPickIndex]) picks[a.forPickIndex] = {};
      picks[a.forPickIndex].side = a.side;
      picks[a.forPickIndex].sideTeam = a.team; // who chose the side
    }
  });

  const handleMapClick = (map) => {
    if (!currentStep) return;
    if (currentStep.action === "side") return; // side is handled by buttons, not map click
    if (usedMaps.has(map)) return;
    if (!activeMapPool.has(map)) return;
    // Decider step: clicking a remaining map sets/overrides the decider
    if (currentStep.action === "decider") {
      setActions(prev => {
        const withoutDecider = prev.filter(a => a.action !== "decider");
        const deciderStep = sequence.find(s => s.action === "decider");
        return [...withoutDecider, { ...deciderStep, stepIdx: withoutDecider.length, map }];
      });
      return;
    }

    const newAction = { ...currentStep, stepIdx: currentStepIdx, map };
    const newActions = [...actions, newAction];

    // Check if next step is decider — auto-fill if only one map remains
    const nextStepIdx = newActions.length;
    const nextStep    = sequence[nextStepIdx];
    if (nextStep?.action === "decider") {
      const usedNow = new Set(newActions.filter(a=>a.map).map(a=>a.map));
      const remaining = mapPool.filter(m => !usedNow.has(m));
      if (remaining.length === 1) {
        newActions.push({ ...nextStep, stepIdx: nextStepIdx, map: remaining[0] });
      }
    }
    setActions(newActions);
  };

  const handleSide = (side) => {
    if (!currentStep || currentStep.action !== "side") return;
    const newActions = [...actions, { ...currentStep, stepIdx: currentStepIdx, side }];

    // Again check for auto-decider after side pick
    const nextStepIdx = newActions.length;
    const nextStep    = sequence[nextStepIdx];
    if (nextStep?.action === "decider") {
      const usedNow = new Set(newActions.filter(a=>a.map).map(a=>a.map));
      const remaining = mapPool.filter(m => !usedNow.has(m));
      if (remaining.length === 1) {
        newActions.push({ ...nextStep, stepIdx: nextStepIdx, map: remaining[0] });
      }
    }
    setActions(newActions);
  };

  const undo = () => {
    if (actions.length === 0) return;
    // If last action was an auto-filled decider, also remove it
    let cut = actions.length - 1;
    if (actions[cut]?.action === "decider" && cut > 0 && actions[cut-1]?.action !== "decider") cut--;
    else if (actions[cut]?.action === "decider") cut--;
    setActions(actions.slice(0, cut + (actions[cut]?.action === "decider" ? 0 : 1)));
  };
  const reset = () => { setActions([]); setCopied(false); };

  const handleSaveReport = async (name) => {
    if (!name.trim()) return;
    setSavingReport(true); setSavedMsg("");
    try {
      await api.post("/api/veto-reports", {
        name: name.trim(),
        opp_name: oppData?.teamName || "",
        format,
        actions,
        opp_patterns: oppData?.patterns || [],
        summary: actions.map(a => {
          if (a.action === "side") return null;
          if (a.action === "decider") return a.map + " (Decider)";
          return (a.action === "ban" ? "BAN " : "PICK ") + a.map;
        }).filter(Boolean).join(", "),
      });
      setSavedMsg("saved");
      setTimeout(() => { setSaveReportOpen(false); setSavedMsg(""); setReportName(""); }, 1200);
    } catch (e) { setSavedMsg("error"); }
    finally { setSavingReport(false); }
  };

  // When format changes, reset board
  useEffect(() => { reset(); }, [format]);

  const teamName = (t) => t === "A" ? teamAName : teamBName;
  const ACTION_COLOR  = { ban:"var(--red)", pick:"var(--blue)", side:"var(--purple)", decider:"#a78bfa" };
  const ACTION_BG     = { ban:"rgba(255,82,82,0.12)", pick:"rgba(79,195,247,0.12)", side:"rgba(179,157,219,0.12)", decider:"rgba(167,139,250,0.12)" };
  const ACTION_LABEL  = { ban:"BAN", pick:"PICK", side:"SIDE", decider:"DEC" };
  const TEAM_COLOR    = { A:"var(--acc)", B:"var(--orange)" };
  const WRColor       = (wr) => wr >= 55 ? "var(--green)" : wr >= 45 ? "var(--orange)" : "var(--red)";
  const US_COLOR      = TEAM_COLOR[weAreTeam];

  // Summary text
  const summaryText = () => actions.map(a => {
    if (a.action === "side") return `${teamName(a.team)} → ${a.side} on Map ${a.forPickIndex}`;
    if (a.action === "decider") return `${a.map} (Decider)`;
    const verb = a.action === "ban" ? "ban" : "pick";
    return `${teamName(a.team)} ${verb} ${a.map}`;
  }).join("; ");

  const copySummary = () => {
    navigator.clipboard.writeText(summaryText()).then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };

  const FORMAT_LABELS = { bo3:"BO3", bo5:"BO5", bo5gf:"BO5 Grand Finals" };

  return (
    <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

      {/* ── LEFT: Board ── */}
      <div style={{ flex:1, minWidth:0 }}>

        {/* Config bar */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          {/* Format selector */}
          <div style={{ display:"flex", background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, overflow:"hidden" }}>
            {Object.entries(FORMAT_LABELS).map(([k,l]) => (
              <button key={k} onClick={() => setFormat(k)}
                style={{ padding:"7px 14px", fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
                  background: format===k ? "var(--acc)" : "transparent",
                  color: format===k ? "#080a10" : "var(--t3)",
                  borderRight: k!=="bo5gf" ? "1px solid var(--b2)" : "none" }}>
                {l}
              </button>
            ))}
          </div>

          {/* We are Team A/B */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:8, padding:"6px 12px" }}>
            <span style={{ fontSize:11, fontWeight:700, color:"var(--t3)" }}>WE ARE</span>
            {["A","B"].map(t => (
              <button key={t} onClick={() => setWeAreTeam(t)}
                style={{ padding:"4px 12px", fontSize:12, fontWeight:800, cursor:"pointer", border:"none", borderRadius:5,
                  background: weAreTeam===t ? TEAM_COLOR[t] : "var(--s3)",
                  color: weAreTeam===t ? (t==="A"?"#080a10":"#080a10") : "var(--t3)" }}>
                Team {t}
              </button>
            ))}
          </div>

          {/* Team name inputs */}
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--s2)", border:`1px solid ${TEAM_COLOR.A}44`, borderRadius:8, padding:"5px 10px" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:TEAM_COLOR.A, flexShrink:0 }}/>
              <input value={teamAName} onChange={e=>setTeamAName(e.target.value)}
                style={{ background:"transparent", border:"none", outline:"none", color:"var(--t1)", fontSize:12, fontWeight:700, width:80 }}
                placeholder="Team A"/>
            </div>
            <span style={{ color:"var(--t3)", fontSize:11 }}>vs</span>
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--s2)", border:`1px solid ${TEAM_COLOR.B}44`, borderRadius:8, padding:"5px 10px" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:TEAM_COLOR.B, flexShrink:0 }}/>
              <input value={teamBName} onChange={e=>setTeamBName(e.target.value)}
                style={{ background:"transparent", border:"none", outline:"none", color:"var(--t1)", fontSize:12, fontWeight:700, width:80 }}
                placeholder="Team B"/>
            </div>
          </div>

          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            <button onClick={undo} disabled={actions.length===0}
              style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, padding:"7px 12px", color:"var(--t2)", fontSize:12, fontWeight:600, cursor:"pointer", opacity:actions.length===0?0.4:1 }}>
              ↩ Undo
            </button>
            <button onClick={reset}
              style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, padding:"7px 12px", color:"var(--t2)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
              ↺ Reset
            </button>
            <button onClick={() => { setReportName(oppData ? `Veto vs ${oppData.teamName}` : "Veto Report"); setSaveReportOpen(true); }}
              style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, padding:"7px 12px", color:"var(--acc)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              💾 Save
            </button>
          </div>
        </div>

        {/* Sequence timeline */}
        <div style={{ display:"flex", gap:4, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
          {sequence.map((s, i) => {
            const done    = i < actions.length;
            const current = i === actions.length && !isDone;
            const act     = actions[i];
            const isSide  = s.action === "side";
            return (
              <div key={i} style={{ flexShrink:0, minWidth: isSide ? 64 : 76,
                background: current ? ACTION_BG[s.action] : done ? "var(--s3)" : "var(--s2)",
                border:`1px solid ${current ? ACTION_COLOR[s.action] : done ? "var(--b2)" : "var(--b1)"}`,
                borderRadius:7, padding:"6px 8px", transition:"all 0.2s",
                boxShadow: current ? `0 0 10px ${ACTION_COLOR[s.action]}44` : "none" }}>
                <div style={{ fontSize:8, fontWeight:800, letterSpacing:"0.07em", textTransform:"uppercase",
                  color: current ? ACTION_COLOR[s.action] : "var(--t3)", marginBottom:3 }}>
                  {s.label}
                  {s.team && <span style={{ color: done||current ? TEAM_COLOR[s.team] : "var(--t3)" }}> · {teamName(s.team).slice(0,5)}</span>}
                </div>
                {done ? (
                  <div style={{ fontWeight:800, fontSize:11, color: isSide ? ACTION_COLOR.side : "var(--t1)", lineHeight:1.2 }}>
                    {isSide ? (act.side || "—") : act.map}
                  </div>
                ) : (
                  <div style={{ fontSize:11, color: current ? ACTION_COLOR[s.action] : "var(--t3)", fontWeight: current?700:400 }}>
                    {current ? (isSide ? "ATK/DEF" : "← click") : "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Current step CTA */}
        {!isDone && currentStep && (
          <div style={{ marginBottom:14, padding:"10px 14px",
            background: ACTION_BG[currentStep.action],
            border:`1px solid ${ACTION_COLOR[currentStep.action]}`,
            borderRadius:8, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:ACTION_COLOR[currentStep.action], animation:"blink 1s infinite", flexShrink:0 }}/>
            <div style={{ flex:1 }}>
              {currentStep.action === "decider" ? (
                <span style={{ fontSize:13, color:"var(--t2)" }}>Remaining map is the <span style={{ color:"#a78bfa", fontWeight:700 }}>Decider</span> — click any pool map to override</span>
              ) : currentStep.action === "side" ? (
                <span style={{ fontSize:13, color:"var(--t2)" }}>
                  <span style={{ fontWeight:700, color: TEAM_COLOR[currentStep.team] }}>{teamName(currentStep.team)}</span>
                  {" "}chooses starting side for <span style={{ fontWeight:700, color:"var(--t1)" }}>Map {currentStep.forPickIndex}</span>
                </span>
              ) : (
                <span style={{ fontSize:13, color:"var(--t2)" }}>
                  <span style={{ fontWeight:700, color: TEAM_COLOR[currentStep.team] }}>{teamName(currentStep.team)}</span>
                  {" "}{currentStep.action === "ban" ? "bans" : "picks"} a map
                </span>
              )}
            </div>
            {/* Side selection buttons — shown when step is "side" */}
            {currentStep.action === "side" && (
              <div style={{ display:"flex", gap:8 }}>
                {["ATK","DEF"].map(side => (
                  <button key={side} onClick={() => handleSide(side)}
                    style={{ padding:"7px 20px", fontSize:13, fontWeight:800, cursor:"pointer", borderRadius:7,
                      border:"none",
                      background: side==="ATK" ? "rgba(255,171,64,0.15)" : "rgba(79,195,247,0.15)",
                      color: side==="ATK" ? "var(--orange)" : "var(--blue)" }}
                    onMouseEnter={e => e.currentTarget.style.opacity="0.8"}
                    onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                    {side}
                  </button>
                ))}
              </div>
            )}
            <span style={{ fontSize:11, color:"var(--t3)", marginLeft:"auto", flexShrink:0 }}>
              Step {currentStepIdx + 1}/{sequence.length}
            </span>
          </div>
        )}

        {/* Map grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:8, marginBottom:16 }}>
          {ALL_MAPS.map(map => {
            const inPool  = activeMapPool.has(map);
            const act     = actions.find(a => a.map === map);
            const used    = usedMaps.has(map);
            const hovered = hoveredMap === map;
            const isDeciderStep = currentStep?.action === "decider";
            const isSideStep = currentStep?.action === "side";
            // Clickable for normal ban/pick, OR for decider step if map is still available
            const clickable  = inPool && !used && !isDone && currentStep && !isSideStep &&
                               (!isDeciderStep || (isDeciderStep && !used));
            // Pool-toggleable: any map not already used in the veto (right-click or click when no active step)
            const poolToggleable = !used;
            const col = act ? ACTION_COLOR[act.action] : "var(--b1)";
            const bg  = act ? ACTION_BG[act.action]    : "var(--s2)";
            // Which pick number is this map (if picked)?
            const pickEntry = act?.action === "pick" ? Object.entries(picks).find(([,v])=>v.map===map) : null;
            const pickNum   = pickEntry ? pickEntry[0] : null;
            const sideInfo  = pickNum ? picks[pickNum]?.side : null;
            const sideTeam  = pickNum ? picks[pickNum]?.sideTeam : null;
            const wr = scrimStats?.[map];
            const wrPct = wr?.total > 0 ? Math.round((wr.wins / wr.total)*100) : null;
            return (
              <div key={map}
                onClick={() => {
                  if (clickable) { handleMapClick(map); return; }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!poolToggleable) return;
                  const np = new Set(activeMapPool);
                  if (inPool) np.delete(map); else np.add(map);
                  setActiveMapPool(np);
                }}
                onMouseEnter={() => setHoveredMap(map)}
                onMouseLeave={() => setHoveredMap(null)}
                style={{ position:"relative", borderRadius:9, overflow:"hidden",
                  border:`2px solid ${used ? col : hovered && clickable ? "var(--acc)" : inPool ? "var(--b1)" : "rgba(255,255,255,0.08)"}`,
                  cursor: clickable ? "pointer" : poolToggleable ? "context-menu" : "default",
                  opacity: !inPool ? 0.3 : used && act?.action==="ban" ? 0.45 : 1,
                  transition:"all 0.18s",
                  transform: hovered && clickable ? "translateY(-3px)" : "none",
                  boxShadow: hovered && clickable ? "0 8px 20px rgba(0,0,0,0.4)" : act ? `0 0 8px ${col}44` : "none",
                  background: bg }}>
                {/* Splash image */}
                <div style={{ position:"relative", height:76, overflow:"hidden" }}>
                  {BOARD_MAP_IMAGES[map] ? (
                    <img src={BOARD_MAP_IMAGES[map]} alt={map}
                      style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center",
                        filter: act?.action==="ban" ? "grayscale(90%) brightness(0.4)" : "brightness(0.65)",
                        transition:"filter 0.2s" }}/>
                  ) : (
                    <div style={{ width:"100%", height:"100%", background:"var(--s3)" }}/>
                  )}
                  <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 55%)" }}/>
                  {/* Action badge */}
                  {act && (
                    <div style={{ position:"absolute", top:5, right:5,
                      background: col, color: act.action==="pick"?"#000":"#fff",
                      fontSize:8, fontWeight:800, padding:"2px 6px", borderRadius:3, letterSpacing:"0.06em" }}>
                      {ACTION_LABEL[act.action]}
                    </div>
                  )}
                  {/* Team badge */}
                  {act?.team && (
                    <div style={{ position:"absolute", top:5, left:5,
                      background: TEAM_COLOR[act.team]+"22", border:`1px solid ${TEAM_COLOR[act.team]}66`,
                      color: TEAM_COLOR[act.team], fontSize:8, fontWeight:800, padding:"2px 6px", borderRadius:3 }}>
                      {teamName(act.team).slice(0,8)}
                    </div>
                  )}
                  {/* Hover ghost badge */}
                  {!used && hovered && clickable && currentStep && (
                    <div style={{ position:"absolute", top:5, right:5,
                      background: ACTION_COLOR[currentStep.action],
                      color: currentStep.action==="pick"?"#000":"#fff",
                      fontSize:8, fontWeight:800, padding:"2px 6px", borderRadius:3, opacity:0.85 }}>
                      {ACTION_LABEL[currentStep.action]}?
                    </div>
                  )}
                  {/* WR pill on image */}
                  {wrPct != null && (
                    <div style={{ position:"absolute", bottom:5, right:5,
                      background:"rgba(0,0,0,0.65)", borderRadius:4, padding:"1px 6px",
                      fontSize:9, fontWeight:800, color: WRColor(wrPct) }}>
                      {wrPct}%
                    </div>
                  )}
                  {/* Pick number */}
                  {pickNum && (
                    <div style={{ position:"absolute", bottom:5, left:5,
                      background:"rgba(0,0,0,0.65)", borderRadius:4, padding:"1px 6px",
                      fontSize:9, fontWeight:800, color:"var(--blue)" }}>
                      Map {pickNum}
                    </div>
                  )}
                </div>
                {/* Name row */}
                <div style={{ padding:"6px 8px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:800, fontSize:12, color: act?.action==="ban" ? "var(--t3)" : "var(--t1)" }}>{map}</span>
                  {sideInfo && (
                    <span style={{ fontSize:9, fontWeight:800, color: sideInfo==="ATK"?"var(--orange)":"var(--blue)",
                      background: sideInfo==="ATK"?"rgba(255,171,64,0.1)":"rgba(79,195,247,0.1)",
                      padding:"1px 5px", borderRadius:3 }}>
                      {sideInfo}
                    </span>
                  )}
                  {!act && inPool && (
                    <span style={{ fontSize:9, color:"var(--t3)" }}>
                      {wr?.total > 0 ? `${wr.wins}W ${wr.losses}L` : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Map pool toggle hint */}
        <div style={{ fontSize:11, color:"var(--t3)", marginBottom:16, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span>💡 <b style={{color:"var(--t2)"}}>Right-click</b> any map to toggle it in/out of the pool.</span>
          <button onClick={() => setActiveMapPool(new Set(ALL_MAPS))}
            style={{ background:"none", border:"1px solid var(--b2)", borderRadius:5, padding:"2px 8px", fontSize:10, color:"var(--t3)", cursor:"pointer" }}>
            Reset Pool
          </button>
        </div>

        {/* Done — summary */}
        {isDone && (
          <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, padding:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{ fontWeight:800, fontSize:14, color:"var(--t1)" }}>✅ Veto Complete</span>
              <button onClick={copySummary}
                style={{ background: copied?"rgba(105,240,174,0.1)":"var(--s3)", border:`1px solid ${copied?"var(--green)":"var(--b2)"}`,
                  borderRadius:7, padding:"6px 12px", color: copied?"var(--green)":"var(--t2)", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
              {actions.map((a, i) => {
                if (a.action === "side") {
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"rgba(179,157,219,0.06)", borderRadius:6, border:"1px solid rgba(179,157,219,0.12)" }}>
                      <span style={{ fontSize:9, color:"var(--t3)", minWidth:16 }}>{i+1}</span>
                      <span style={{ fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:3, background:"rgba(179,157,219,0.12)", color:"var(--purple)" }}>SIDE</span>
                      <span style={{ fontSize:12, color:"var(--t2)" }}>
                        <span style={{ fontWeight:700, color: TEAM_COLOR[a.team] }}>{teamName(a.team)}</span> starts on
                        <span style={{ fontWeight:700, color: a.side==="ATK"?"var(--orange)":"var(--blue)", marginLeft:5 }}>{a.side}</span>
                        <span style={{ color:"var(--t3)", marginLeft:4 }}>· Map {a.forPickIndex}</span>
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"var(--s3)", borderRadius:6, border:"1px solid var(--b1)" }}>
                    <span style={{ fontSize:9, color:"var(--t3)", minWidth:16 }}>{i+1}</span>
                    <span style={{ fontSize:9, fontWeight:800, padding:"1px 6px", borderRadius:3, background: ACTION_BG[a.action], color: ACTION_COLOR[a.action], letterSpacing:"0.05em" }}>{ACTION_LABEL[a.action]}</span>
                    <span style={{ fontWeight:700, fontSize:12, color:"var(--t1)", flex:1 }}>{a.map}</span>
                    {a.team && <span style={{ fontSize:10, fontWeight:700, color: TEAM_COLOR[a.team] }}>{teamName(a.team)}</span>}
                    {a.action==="decider" && <span style={{ fontSize:10, color:"#a78bfa", fontWeight:600 }}>Decider</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop:12, padding:"8px 12px", background:"var(--s1)", borderRadius:7, border:"1px solid var(--b1)" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"var(--t3)", marginBottom:5, letterSpacing:"0.07em", textTransform:"uppercase" }}>Raw Summary</div>
              <div style={{ fontSize:11, color:"var(--t2)", lineHeight:1.9, fontFamily:"'JetBrains Mono',monospace" }}>{summaryText()}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: Stats Sidebar ── */}
      <div style={{ width:240, flexShrink:0 }}>

        {/* Opponent loader */}
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden", marginBottom:10 }}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--b1)", background:"var(--s3)" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Opponent VLR Stats</div>
          </div>
          <div style={{ padding:"10px 12px" }}>
            <div style={{ position:"relative" }}>
              <input value={oppQuery} onChange={e => handleOppQueryChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && loadOppBoard(oppQuery)}
                placeholder="Search team…"
                style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7,
                  color:"var(--t1)", padding:"7px 10px", fontSize:12, outline:"none" }}/>
              {oppSearchResults.length > 0 && (
                <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"var(--s1)", border:"1px solid var(--b2)",
                  borderRadius:7, zIndex:50, maxHeight:160, overflowY:"auto", marginTop:2, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" }}>
                  {oppSearchResults.map(t => (
                    <div key={t.id} onClick={() => { setOppQuery(t.name); setOppSearchResults([]); loadOppBoard(String(t.id)); }}
                      style={{ padding:"7px 10px", cursor:"pointer", fontSize:12, color:"var(--t1)", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--s3)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span>{t.name}</span>
                      <span style={{ fontSize:10, color:"var(--t3)" }}>#{t.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {oppError && <div style={{ fontSize:11, color:"var(--red)", marginTop:6 }}>{oppError}</div>}
            {loadingOpp && <div style={{ fontSize:11, color:"var(--t3)", marginTop:6 }}>Fetching from VLR.GG…</div>}
            {oppData && !loadingOpp && (
              <div style={{ marginTop:7, display:"flex", alignItems:"center", gap:6 }}>
                {oppData.teamLogo && <img src={`${API}/api/img-proxy?url=${encodeURIComponent(oppData.teamLogo)}`} alt="" style={{ width:16, height:16, objectFit:"contain", borderRadius:2 }}/>}
                <span style={{ fontSize:11, fontWeight:700, color:"var(--acc)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{oppData.teamName}</span>
                <span style={{ fontSize:10, color:"var(--t3)", flexShrink:0 }}>{oppData.totalSeries}s</span>
                <button onClick={() => { setOppData(null); setOppQuery(""); }} style={{ marginLeft:"auto", background:"none", border:"none", color:"var(--t3)", fontSize:11, cursor:"pointer", flexShrink:0 }}>✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Manual Veto Log */}
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden", marginBottom:10 }}>
          <div onClick={() => setShowManual(v => !v)}
            style={{ padding:"10px 14px", borderBottom: showManual ? "1px solid var(--b1)" : "none", background:"var(--s3)",
              display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
              📋 Manual Veto Log {manualEntries.length > 0 && <span style={{ color:"var(--acc)", fontWeight:700 }}>({manualEntries.length})</span>}
            </div>
            <span style={{ fontSize:11, color:"var(--t3)" }}>{showManual ? "▲" : "▼"}</span>
          </div>
          {showManual && (
            <div style={{ padding:"10px 12px" }}>
              {/* Opponent name */}
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:10, color:"var(--t3)", fontWeight:700, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>Opponent name</div>
                <input value={manualOppName} onChange={e => setManualOppName(e.target.value)}
                  placeholder="e.g. RVL"
                  style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:6,
                    color:"var(--t1)", padding:"5px 8px", fontSize:12, outline:"none" }}/>
              </div>
              {/* Entry row */}
              <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
                <div style={{ fontSize:10, color:"var(--t3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>Add veto step</div>
                {/* Map selector */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                  {ALL_MAPS.map(m => (
                    <button key={m} onClick={() => setManualMap(m)}
                      style={{ padding:"2px 7px", borderRadius:4, border:"1px solid " + (manualMap===m ? "var(--acc)" : "var(--b2)"),
                        background: manualMap===m ? "rgba(212,255,30,0.12)" : "var(--s3)",
                        color: manualMap===m ? "var(--acc)" : "var(--t3)", fontSize:10, fontWeight:700, cursor:"pointer" }}>{m}</button>
                  ))}
                </div>
                {/* Action + Team row */}
                <div style={{ display:"flex", gap:5 }}>
                  <div style={{ display:"flex", gap:3, flex:1 }}>
                    {[["ban","BAN","var(--red)"],["pick","PICK","var(--blue)"],["decider","DEC","#a78bfa"]].map(([v,l,c]) => (
                      <button key={v} onClick={() => setManualAction(v)}
                        style={{ flex:1, padding:"4px 0", borderRadius:5, border:"1px solid " + (manualAction===v ? c : "var(--b2)"),
                          background: manualAction===v ? c+"22" : "var(--s3)",
                          color: manualAction===v ? c : "var(--t3)", fontSize:10, fontWeight:800, cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:3 }}>
                    {[["us","Us","var(--acc)"],["opp","Opp","var(--orange)"]].map(([v,l,c]) => (
                      <button key={v} onClick={() => setManualTeam(v)}
                        style={{ padding:"4px 10px", borderRadius:5, border:"1px solid " + (manualTeam===v ? c : "var(--b2)"),
                          background: manualTeam===v ? c+"22" : "var(--s3)",
                          color: manualTeam===v ? c : "var(--t3)", fontSize:10, fontWeight:800, cursor:"pointer" }}>{l}</button>
                    ))}
                  </div>
                </div>
                <button
                  disabled={!manualMap}
                  onClick={() => {
                    if (!manualMap) return;
                    const next = [...manualEntries, { map: manualMap, action: manualAction, team: manualTeam }];
                    setManualEntries(next);
                    setManualMap("");
                    const recompute = (entries) => {
                      const ALL_M = ["Abyss","Ascent","Bind","Breeze","Corrode","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset"];
                      const counts = {};
                      ALL_M.forEach(m => { counts[m] = { ourPicks:0, oppPicks:0, ourBans:0, oppBans:0 }; });
                      entries.forEach(e => {
                        if (!counts[e.map]) return;
                        if (e.action==="pick")    { if (e.team==="us") counts[e.map].ourPicks++; else counts[e.map].oppPicks++; }
                        else if (e.action==="ban") { if (e.team==="us") counts[e.map].ourBans++;  else counts[e.map].oppBans++;  }
                      });
                      const totalOppPicks = Object.values(counts).reduce((s,c)=>s+c.oppPicks,0)||1;
                      const totalOppBans  = Object.values(counts).reduce((s,c)=>s+c.oppBans,0)||1;
                      return ALL_M.map(m => ({
                        map:m, ourPicks:counts[m].ourPicks, oppPicks:counts[m].oppPicks,
                        ourBans:counts[m].ourBans, oppBans:counts[m].oppBans,
                        oppPickRate: Math.round(counts[m].oppPicks/totalOppPicks*100),
                        oppBanRate:  Math.round(counts[m].oppBans/totalOppBans*100),
                      }));
                    };
                    const name = manualOppName.trim() || "Manual Opponent";
                    setOppData(prev => ({
                      teamName: name, teamLogo: null, teamId: "manual", totalSeries: 1,
                      series: prev?.series || [],
                      patterns: recompute(next),
                      _manual: true,
                    }));
                  }}
                  style={{ width:"100%", padding:"6px", borderRadius:6, border:"none",
                    background: manualMap ? "var(--acc)" : "var(--b2)",
                    color: manualMap ? "#080a10" : "var(--t3)", fontSize:12, fontWeight:800,
                    cursor: manualMap ? "pointer" : "not-allowed" }}>
                  + Add Step
                </button>
              </div>
              {/* Logged steps */}
              {manualEntries.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <div style={{ fontSize:10, color:"var(--t3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em" }}>Logged ({manualEntries.length})</div>
                    <button onClick={() => { setManualEntries([]); if (oppData?._manual) setOppData(null); }}
                      style={{ background:"none", border:"none", color:"var(--t3)", fontSize:10, cursor:"pointer" }}>Clear all</button>
                  </div>
                  {manualEntries.map((e, i) => {
                    const col = e.action==="ban" ? "var(--red)" : e.action==="pick" ? "var(--blue)" : "#a78bfa";
                    const teamCol = e.team==="us" ? "var(--acc)" : "var(--orange)";
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 6px",
                        background:"var(--s3)", borderRadius:5, border:"1px solid var(--b1)" }}>
                        <span style={{ fontSize:8, fontWeight:800, color:col, minWidth:24 }}>{e.action.toUpperCase().slice(0,3)}</span>
                        <span style={{ fontSize:11, fontWeight:700, color:"var(--t1)", flex:1 }}>{e.map}</span>
                        <span style={{ fontSize:9, fontWeight:700, color:teamCol }}>{e.team==="us"?"US":"OPP"}</span>
                        <button onClick={() => {
                          const next = manualEntries.filter((_,j)=>j!==i);
                          setManualEntries(next);
                          if (next.length === 0 && oppData?._manual) { setOppData(null); return; }
                          const ALL_M = ["Abyss","Ascent","Bind","Breeze","Corrode","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset"];
                          const counts = {};
                          ALL_M.forEach(m => { counts[m] = { ourPicks:0, oppPicks:0, ourBans:0, oppBans:0 }; });
                          next.forEach(en => {
                            if (!counts[en.map]) return;
                            if (en.action==="pick")    { if (en.team==="us") counts[en.map].ourPicks++; else counts[en.map].oppPicks++; }
                            else if (en.action==="ban") { if (en.team==="us") counts[en.map].ourBans++;  else counts[en.map].oppBans++;  }
                          });
                          const totalOppPicks = Object.values(counts).reduce((s,c)=>s+c.oppPicks,0)||1;
                          const totalOppBans  = Object.values(counts).reduce((s,c)=>s+c.oppBans,0)||1;
                          setOppData(prev => ({
                            ...prev,
                            patterns: ALL_M.map(m => ({
                              map:m, ourPicks:counts[m].ourPicks, oppPicks:counts[m].oppPicks,
                              ourBans:counts[m].ourBans, oppBans:counts[m].oppBans,
                              oppPickRate: Math.round(counts[m].oppPicks/totalOppPicks*100),
                              oppBanRate:  Math.round(counts[m].oppBans/totalOppBans*100),
                            })),
                            _manual: true,
                          }));
                        }}
                          style={{ background:"none", border:"none", color:"var(--t3)", fontSize:10, cursor:"pointer", padding:"0 2px" }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Per-map stats */}
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden", position:"sticky", top:0 }}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--b1)", background:"var(--s3)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Map Stats</div>
            {oppData && (
              <div style={{ display:"flex", gap:8, fontSize:9, color:"var(--t3)", fontWeight:700 }}>
                <span style={{ color:"var(--green)" }}>OUR WR</span>
                <span style={{ color:"var(--blue)" }}>PICK</span>
                <span style={{ color:"var(--red)" }}>BAN</span>
              </div>
            )}
          </div>
          {loadingStats ? (
            <div style={{ padding:20, textAlign:"center", color:"var(--t3)", fontSize:12 }}>Loading…</div>
          ) : (
            <div style={{ padding:"6px 0" }}>
              {ALL_MAPS.map(map => {
                const s  = scrimStats?.[map];
                const wr = s?.total > 0 ? Math.round((s.wins / s.total)*100) : null;
                const mapAct = actions.find(a => a.map === map);
                const barColor = wr == null ? "var(--b2)" : WRColor(wr);
                const pickNums = Object.entries(picks).filter(([,v])=>v.map===map);
                // Opponent patterns for this map
                const oppPattern = oppData?.patterns?.find(p => p.map === map);
                const oppPickRate = oppPattern ? oppPattern.oppPickRate : null;
                const oppBanRate  = oppPattern ? oppPattern.oppBanRate  : null;
                const inPool = activeMapPool.has(map);
                return (
                  <div key={map}
                    onMouseEnter={() => setHoveredMap(map)}
                    onMouseLeave={() => setHoveredMap(null)}
                    style={{ padding:"5px 12px", borderBottom:"1px solid var(--b1)",
                      background: hoveredMap===map ? "var(--s3)" : mapAct?.action==="ban" ? "rgba(255,82,82,0.04)" : "transparent",
                      transition:"background 0.1s", opacity: mapAct?.action==="ban" ? 0.5 : !inPool ? 0.35 : 1 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                      <span style={{ fontSize:11, fontWeight:700, color: mapAct?.action==="ban" ? "var(--t3)" : !inPool ? "var(--t3)" : "var(--t1)" }}>{map}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                        {mapAct && (
                          <span style={{ fontSize:8, fontWeight:800, padding:"1px 4px", borderRadius:3,
                            background: ACTION_BG[mapAct.action], color: ACTION_COLOR[mapAct.action] }}>
                            {ACTION_LABEL[mapAct.action]}
                          </span>
                        )}
                        <span style={{ fontSize:11, fontWeight:800, color: wr!=null ? WRColor(wr) : "var(--t3)", fontFamily:"'DIN Next LT Pro',sans-serif" }}>
                          {wr != null ? `${wr}%` : "—"}
                        </span>
                      </div>
                    </div>
                    {/* Our WR bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom: oppData ? 4 : 0 }}>
                      <div style={{ flex:1, height:3, background:"var(--b1)", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${wr ?? 0}%`, height:"100%", background: barColor, borderRadius:2, transition:"width 0.4s" }}/>
                      </div>
                      <span style={{ fontSize:9, color:"var(--t3)", minWidth:28, textAlign:"right" }}>
                        {s?.total > 0 ? `${s.wins}W ${s.losses}L` : "—"}
                      </span>
                    </div>
                    {/* Opponent pick/ban rates */}
                    {oppData && (
                      <div style={{ display:"flex", gap:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:8, color:"var(--blue)", fontWeight:700, marginBottom:1 }}>PICK {oppPickRate != null ? oppPickRate+"%" : "—"}</div>
                          <div style={{ height:2, background:"var(--b1)", borderRadius:1, overflow:"hidden" }}>
                            <div style={{ width:`${oppPickRate ?? 0}%`, height:"100%", background:"var(--blue)", borderRadius:1 }}/>
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:8, color:"var(--red)", fontWeight:700, marginBottom:1 }}>BAN {oppBanRate != null ? oppBanRate+"%" : "—"}</div>
                          <div style={{ height:2, background:"var(--b1)", borderRadius:1, overflow:"hidden" }}>
                            <div style={{ width:`${oppBanRate ?? 0}%`, height:"100%", background:"var(--red)", borderRadius:1 }}/>
                          </div>
                        </div>
                      </div>
                    )}
                    {pickNums.length > 0 && picks[pickNums[0][0]]?.side && (
                      <div style={{ marginTop:2, fontSize:9, fontWeight:700,
                        color: picks[pickNums[0][0]].side==="ATK"?"var(--orange)":"var(--blue)" }}>
                        {teamName(picks[pickNums[0][0]].sideTeam)} starts {picks[pickNums[0][0]].side}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Opp Series Panel */}
      {oppData && oppData.series && oppData.series.length > 0 && (
        <div style={{ background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:12, overflow:"hidden", marginTop:10 }}>
          <div
            onClick={() => setShowOppSeries(v => !v)}
            style={{ padding:"10px 14px", borderBottom: showOppSeries ? "1px solid var(--b1)" : "none", background:"var(--s3)", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--t2)", letterSpacing:"0.06em", textTransform:"uppercase" }}>Opp Series</div>
            <span style={{ fontSize:11, color:"var(--t3)" }}>{showOppSeries ? "▲" : "▼"}</span>
          </div>
          {showOppSeries && (
            <div>
              {/* Map filter chips */}
              <div style={{ padding:"8px 10px", display:"flex", flexWrap:"wrap", gap:4, borderBottom:"1px solid var(--b1)" }}>
                <button onClick={() => setSeriesMapFilter(null)}
                  style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, cursor:"pointer", border:"1px solid var(--b2)",
                    background: seriesMapFilter===null ? "var(--acc)" : "var(--s3)",
                    color: seriesMapFilter===null ? "#080a10" : "var(--t3)" }}>ALL</button>
                {ALL_MAPS.map(m => (
                  <button key={m} onClick={() => setSeriesMapFilter(seriesMapFilter===m ? null : m)}
                    style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:4, cursor:"pointer", border:"1px solid var(--b2)",
                      background: seriesMapFilter===m ? "var(--acc)" : "var(--s3)",
                      color: seriesMapFilter===m ? "#080a10" : "var(--t3)" }}>{m}</button>
                ))}
              </div>
              {/* Series list */}
              <div style={{ maxHeight:320, overflowY:"auto", padding:"6px 0" }}>
                {oppData.series
                  .filter(s => s.veto && s.veto.length > 0)
                  .filter(s => !seriesMapFilter || s.veto.some(v => v.map === seriesMapFilter))
                  .slice(0, 20)
                  .map((s, si) => {
                    const isTeamA = s.teamAId === oppData.teamId;
                    const oppName2 = isTeamA ? s.teamBName : s.teamAName;
                    const won = s.won ?? ((s.ourScore ?? (isTeamA ? s.scoreA : s.scoreB)) > (s.theirScore ?? (isTeamA ? s.scoreB : s.scoreA)));
                    const filteredVeto = seriesMapFilter ? s.veto.filter(v => v.map === seriesMapFilter) : s.veto;
                    return (
                      <div key={si} style={{ padding:"7px 10px", borderBottom:"1px solid var(--b1)" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
                          <span style={{ fontSize:9, fontWeight:800, padding:"1px 5px", borderRadius:3,
                            background: won ? "rgba(105,240,174,0.12)" : "rgba(255,82,82,0.1)",
                            color: won ? "var(--green)" : "var(--red)" }}>{won ? "W" : "L"}</span>
                          <span style={{ fontSize:10, fontWeight:700, color:"var(--t1)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>vs {oppName2}</span>
                          {s.date && <span style={{ fontSize:9, color:"var(--t3)", flexShrink:0 }}>{s.date}</span>}
                        </div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:3 }}>
                          {filteredVeto.map((v, vi) => {
                            const isOurs2 = v.teamId === oppData.teamId;
                            const col = v.action === "ban" ? "var(--red)" : v.action === "pick" ? "var(--blue)" : "#a78bfa";
                            const highlighted = seriesMapFilter && v.map === seriesMapFilter;
                            return (
                              <div key={vi} style={{ display:"flex", alignItems:"stretch", borderRadius:4, overflow:"hidden",
                                border:`1px solid ${highlighted ? col : 'var(--b2)'}`,
                                background: highlighted ? `${col}15` : "transparent" }}>
                                <div style={{ padding:"2px 5px", background:`${col}20`, borderRight:`1px solid ${col}40`, display:"flex", alignItems:"center" }}>
                                  <span style={{ fontSize:8, fontWeight:800, color:col }}>{v.action === "ban" ? "BAN" : v.action === "pick" ? "PICK" : "DEC"}</span>
                                </div>
                                <div style={{ padding:"2px 6px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
                                  <span style={{ fontSize:10, fontWeight:800, color: isOurs2 ? "var(--acc)" : "var(--t1)", fontFamily:"'DIN Next LT Pro',sans-serif" }}>{v.map}</span>
                                  <span style={{ fontSize:7, color: isOurs2 ? "var(--acc)" : "var(--t3)", opacity:0.8 }}>{isOurs2 ? oppData.teamName?.slice(0,6) : (oppName2 ? oppName2.slice(0,6) : "?")}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                {oppData.series.filter(s => s.veto && s.veto.length > 0 && (!seriesMapFilter || s.veto.some(v => v.map === seriesMapFilter))).length === 0 && (
                  <div style={{ padding:"16px 12px", fontSize:11, color:"var(--t3)", textAlign:"center" }}>No series with veto data{seriesMapFilter ? " for " + seriesMapFilter : ""}.</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Save Report Modal ── */}
      {saveReportOpen && (
      <div className="modal-backdrop" onClick={() => setSaveReportOpen(false)}>
        <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
          <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:16 }}>💾 Save Veto Report</div>
          <div style={{ fontSize:12, color:"var(--t3)", marginBottom:10 }}>Give this report a name so you can find it later.</div>
          <input
            value={reportName}
            onChange={e => setReportName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveReport(reportName)}
            placeholder={oppData ? `Veto vs ${oppData.teamName}` : "Veto Report"}
            autoFocus
            style={{ width:"100%", background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:8,
              color:"var(--t1)", padding:"10px 14px", fontSize:13, outline:"none", marginBottom:14 }}/>
          {oppData && (
            <div style={{ fontSize:11, color:"var(--t3)", marginBottom:14 }}>
              Opponent: <span style={{ color:"var(--acc)", fontWeight:700 }}>{oppData.teamName}</span>
              &nbsp;·&nbsp;Format: <span style={{ color:"var(--t2)", fontWeight:700 }}>{format.toUpperCase()}</span>
              &nbsp;·&nbsp;{actions.filter(a=>a.map).length} actions recorded
            </div>
          )}
          {savedMsg === "error" && <div style={{ fontSize:12, color:"var(--red)", marginBottom:10 }}>Failed to save. Try again.</div>}
          {savedMsg === "saved" && <div style={{ fontSize:12, color:"var(--green)", marginBottom:10 }}>✓ Report saved!</div>}
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button onClick={() => setSaveReportOpen(false)}
              style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:7, padding:"8px 16px", color:"var(--t2)", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
            <button onClick={() => handleSaveReport(reportName)} disabled={!(reportName.trim() && !savingReport)}
              style={{ background:"var(--acc)", border:"none", borderRadius:7, padding:"8px 18px", color:"#080a10", fontSize:13, fontWeight:800, cursor:"pointer", opacity:(reportName.trim()&&!savingReport)?1:0.5 }}>
              {savingReport ? "Saving…" : "Save Report"}
            </button>
          </div>
        </div>
      </div>
      )}

    </div>
  );
}
