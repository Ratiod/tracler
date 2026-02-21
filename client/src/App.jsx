import React, { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const api = {
  get:    (path)       => fetch(`${API}${path}`).then(r=>r.json()),
  post:   (path, body) => fetch(`${API}${path}`, { method:"POST",   headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then(r=>r.json()),
  put:    (path, body) => fetch(`${API}${path}`, { method:"PUT",    headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then(r=>r.json()),
  delete: (path)       => fetch(`${API}${path}`, { method:"DELETE" }).then(r=>r.json()),
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:#080a10; --s1:#0d1018; --s2:#131720; --s3:#1a1f2e; --s4:#222736;
    --b1:#1e2436; --b2:#2a3148; --b3:#364060;
    --acc:#d4ff1e; --blue:#4fc3f7; --purple:#b39ddb;
    --red:#ff5252; --green:#69f0ae; --orange:#ffab40;
    --t1:#e8ecf4; --t2:#8892aa; --t3:#4a5470;
    --r:6px; --r2:10px; --r3:14px;
  }
  body { background:var(--bg); color:var(--t1); font-family:'Barlow',sans-serif; font-size:14px; line-height:1.5; overflow:hidden; }
  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--b2); border-radius:2px; }
  .bc { font-family:'Barlow Condensed',sans-serif; }
  .mono { font-family:'JetBrains Mono',monospace; }
  button { font-family:'Barlow',sans-serif; cursor:pointer; border:none; outline:none; }
  input,select,textarea { font-family:'Barlow',sans-serif; outline:none; }
  select option { background:var(--s2); }
  /* Rich editor content styles */
  .docs-editor h2 { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:800; color:var(--t1); margin:18px 0 8px; letter-spacing:0.02em; }
  .docs-editor h3 { font-family:'Barlow Condensed',sans-serif; font-size:19px; font-weight:700; color:var(--t2); margin:14px 0 6px; }
  .docs-editor p { margin:6px 0; }
  .docs-editor ul, .docs-editor ol { padding-left:22px; margin:6px 0; }
  .docs-editor li { margin:3px 0; }
  .docs-editor b, .docs-editor strong { color:var(--t1); font-weight:700; }
  .docs-editor img { border-radius:6px; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes slideRight { from{transform:scaleX(0)} to{transform:scaleX(1)} }
  .fade-up { animation:fadeUp 0.25s ease forwards; }
  .btn { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:13px;font-weight:500;transition:all 0.15s;white-space:nowrap; }
  .btn-acc { background:var(--acc);color:#080a10; }
  .btn-acc:hover { background:#c8f200;transform:translateY(-1px); }
  .btn-ghost { background:transparent;color:var(--t2);border:1px solid var(--b2); }
  .btn-ghost:hover { background:var(--s3);color:var(--t1);border-color:var(--b3); }
  .btn-sub { background:var(--s3);color:var(--t1);border:1px solid var(--b2); }
  .btn-sub:hover { background:var(--s4);border-color:var(--b3); }
  .btn-red { background:rgba(255,82,82,0.12);color:var(--red);border:1px solid rgba(255,82,82,0.25); }
  .btn-red:hover { background:rgba(255,82,82,0.22); }
  .card { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);padding:20px; }
  input[type=text],input[type=email],input[type=date],select,textarea {
    background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);
    color:var(--t1);padding:8px 12px;font-size:13px;width:100%;transition:border-color 0.15s;
  }
  input[type=text]:focus,input[type=email]:focus,select:focus,textarea:focus { border-color:var(--acc); }
  .chip { display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.03em; }
  .chip-acc    { background:rgba(212,255,30,0.12); color:var(--acc);    border:1px solid rgba(212,255,30,0.2); }
  .chip-blue   { background:rgba(79,195,247,0.12); color:var(--blue);   border:1px solid rgba(79,195,247,0.2); }
  .chip-purple { background:rgba(179,157,219,0.12);color:var(--purple); border:1px solid rgba(179,157,219,0.2); }
  .chip-red    { background:rgba(255,82,82,0.12);  color:var(--red);    border:1px solid rgba(255,82,82,0.2); }
  .chip-green  { background:rgba(105,240,174,0.12);color:var(--green);  border:1px solid rgba(105,240,174,0.2); }
  .chip-dim    { background:var(--s3);             color:var(--t2);     border:1px solid var(--b2); }
  .modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:999;display:flex;align-items:center;justify-content:center; }
  .modal { background:var(--s1);border:1px solid var(--b2);border-radius:var(--r3);padding:28px;width:500px;max-width:94vw;max-height:86vh;overflow-y:auto;animation:fadeUp 0.2s ease; }
  .tab-bar { display:flex;background:var(--s2);border-radius:var(--r);padding:3px;gap:2px; }
  .tab { flex:1;padding:6px 10px;border-radius:5px;font-size:12px;font-weight:500;background:transparent;color:var(--t3);border:none;cursor:pointer;transition:all 0.15s;white-space:nowrap; }
  .tab.on { background:var(--s3);color:var(--t1);border:1px solid var(--b2); }
  .hr { height:1px;background:var(--b1);margin:16px 0; }
  .label-sm { font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--t3); }
  .pbar { height:5px;background:var(--b1);border-radius:3px;overflow:hidden; }
  .pfill { height:100%;border-radius:3px;transform-origin:left;animation:slideRight 0.6s ease forwards; }
  .pip { width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-family:'JetBrains Mono',monospace;font-weight:500;flex-shrink:0; }
  .pip-w { background:rgba(105,240,174,0.15);color:var(--green);border:1px solid rgba(105,240,174,0.3); }
  .pip-l { background:rgba(255,82,82,0.15);  color:var(--red);  border:1px solid rgba(255,82,82,0.3); }
  .pip-e { background:var(--s2);border:1px dashed var(--b2);color:var(--t3); }
  .ldot { width:7px;height:7px;border-radius:50%;background:var(--acc);animation:blink 1.4s infinite; }
  .tbl { width:100%;border-collapse:collapse; }
  .tbl th { text-align:left;padding:10px 14px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--t3);border-bottom:1px solid var(--b1); }
  .tbl td { padding:12px 14px;border-bottom:1px solid var(--b1);vertical-align:middle; }
  .tbl tr:last-child td { border-bottom:none; }
  .tbl tbody tr { transition:background 0.1s; }
  .tbl tbody tr:hover td { background:var(--s2); }
  .kcol { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r3);width:230px;flex-shrink:0;display:flex;flex-direction:column; }
  .ktask { background:var(--s2);border:1px solid var(--b1);border-radius:var(--r2);padding:12px;margin:0 10px 8px;cursor:pointer;transition:border-color 0.15s; }
  .ktask:hover { border-color:var(--b3); }
  .cal-cell { border-right:1px solid var(--b1);border-bottom:1px solid var(--b1);min-height:90px;padding:6px;cursor:pointer;transition:background 0.1s; }
  .cal-cell:hover { background:var(--s2); }
  .cal-ev { padding:3px 7px;border-radius:4px;font-size:11px;font-weight:600;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
  .strat-card { background:var(--s1);border:1px solid var(--b1);border-radius:var(--r2);overflow:hidden;cursor:pointer;transition:all 0.2s; }
  .strat-card:hover { border-color:var(--b3);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.3); }
  .vts { display:flex;gap:12px;padding:12px;border-radius:var(--r);transition:background 0.1s; }
  .vts:hover { background:var(--s2); }
  .ab { border-radius:var(--r);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:700;letter-spacing:0.03em;flex-shrink:0; }
  .nav-item { display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--r);font-size:13px;font-weight:500;color:var(--t2);cursor:pointer;transition:all 0.15s;user-select:none;border:1px solid transparent; }
  .nav-item:hover { background:var(--s2);color:var(--t1); }
  .nav-item.on { background:var(--s2);color:var(--acc);border-color:var(--b1); }
`;

/* ── STATIC DATA ── */
const MAPS = ["Ascent","Bind","Haven","Pearl","Lotus","Sunset","Abyss","Split"];

const AGENTS = [
  // Duelists
  { name:"Jett",     color:"#4fc3f7", bg:"#0b1e2b", role:"Duelist" },
  { name:"Raze",     color:"#ffab40", bg:"#2b1a08", role:"Duelist" },
  { name:"Neon",     color:"#4fc3f7", bg:"#0b1e2b", role:"Duelist" },
  { name:"Phoenix",  color:"#ff7043", bg:"#2b1005", role:"Duelist" },
  { name:"Reyna",    color:"#c44cf5", bg:"#1e0a28", role:"Duelist" },
  { name:"Yoru",     color:"#4a6bff", bg:"#080e28", role:"Duelist" },
  { name:"Iso",      color:"#6fc0e8", bg:"#0a1a28", role:"Duelist" },
  { name:"Waylay",   color:"#ffcc44", bg:"#2a1e00", role:"Duelist" },
  // Initiators
  { name:"Sova",     color:"#b39ddb", bg:"#1a1428", role:"Initiator" },
  { name:"Fade",     color:"#d4b0ff", bg:"#1c0e2e", role:"Initiator" },
  { name:"Gekko",    color:"#a3e84f", bg:"#182010", role:"Initiator" },
  { name:"Breach",   color:"#ff8a65", bg:"#2b1008", role:"Initiator" },
  { name:"KAY/O",    color:"#80cbc4", bg:"#0a1e1c", role:"Initiator" },
  { name:"Skye",     color:"#69c47a", bg:"#0a1e10", role:"Initiator" },

  // Controllers
  { name:"Omen",     color:"#8892aa", bg:"#141820", role:"Controller" },
  { name:"Brimstone",color:"#ff8a50", bg:"#2a1008", role:"Controller" },
  { name:"Viper",    color:"#69f0ae", bg:"#0a1e12", role:"Controller" },
  { name:"Astra",    color:"#c39af5", bg:"#1a0e2e", role:"Controller" },
  { name:"Harbor",   color:"#4fc3f7", bg:"#0b1e2b", role:"Controller" },
  { name:"Clove",    color:"#e8b4d4", bg:"#28101e", role:"Controller" },
  // Sentinels
  { name:"Killjoy",  color:"#d4ff1e", bg:"#1e2408", role:"Sentinel" },
  { name:"Cypher",   color:"#c8d0e0", bg:"#161c28", role:"Sentinel" },
  { name:"Sage",     color:"#69f0ae", bg:"#0a1e16", role:"Sentinel" },
  { name:"Chamber",  color:"#d4aa70", bg:"#281e08", role:"Sentinel" },
  { name:"Deadlock", color:"#9eb8d4", bg:"#0e1820", role:"Sentinel" },
  { name:"Vyse",     color:"#b05090", bg:"#1e0818", role:"Sentinel" },
  { name:"Tejo",     color:"#a8c070", bg:"#161e08", role:"Sentinel" },
  { name:"Veto",     color:"#e05050", bg:"#2a0a0a", role:"Sentinel" },
];

const PLAYERS_DEFAULT = [];

const STRATS_INIT = [];

const ECO_STATES = ["Full Buy","Eco","Force","Semi Buy","Bonus"];

const CAT_COLORS = {
  "Scrim":       "#4fc3f7",
  "Server Time": "#69f0ae",
  "VOD Review":  "#b39ddb",
  "Official":    "#d4ff1e",
  "Other":       "#ffab40",
};

const LABEL_COLORS = [
  "#4fc3f7","#d4ff1e","#ff5252","#69f0ae","#ffab40","#b39ddb","#ff80ab","#80cbc4",
];

/* ── HELPERS ── */
const AgentBadge = ({ name, size=32 }) => {
  const ag = AGENTS.find(a=>a.name===name) || { color:"#8892aa", bg:"#141820" };
  return (
    <div className="ab" style={{ width:size, height:size, background:ag.bg, color:ag.color, fontSize:size*0.35, border:`1px solid ${ag.color}28` }}>
      {name.slice(0,2).toUpperCase()}
    </div>
  );
};

const StatBlock = ({ label, value, sub, accent }) => (
  <div className="card" style={{ position:"relative", overflow:"hidden" }}>
    {accent && <div style={{ position:"absolute",top:0,left:0,right:0,height:2,background:"var(--acc)" }}/>}
    <div className="label-sm" style={{ marginBottom:6 }}>{label}</div>
    <div className="bc" style={{ fontSize:36, fontWeight:900, color:accent?"var(--acc)":"var(--t1)", letterSpacing:"0.02em", lineHeight:1 }}>{value}</div>
    {sub && <div style={{ fontSize:12,color:"var(--t2)",marginTop:2 }}>{sub}</div>}
  </div>
);

const Bar = ({ pct, color="var(--acc)" }) => (
  <div className="pbar" style={{ flex:1 }}>
    <div className="pfill" style={{ width:`${pct}%`, background:color }}/>
  </div>
);

const Divider = () => <div className="hr"/>;

function Modal({ onClose, title, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <span className="bc" style={{ fontSize:22,fontWeight:700,letterSpacing:"0.03em" }}>{title}</span>
          <button className="btn btn-ghost" style={{ padding:"4px 10px" }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── NAV ── */
const NAV = [
  { key:"dashboard", label:"Dashboard",    icon:"▦" },
  { key:"tracker",   label:"Live Tracker", icon:"◉", live:true },
  { key:"scrimlog",  label:"Scrim Log",    icon:"≡" },
  { key:"strategy",  label:"Strategy",     icon:"⬡" },
  { key:"analysis",  label:"Analysis",     icon:"↗" },
  { key:"vod",       label:"VOD Review",   icon:"▶" },
  { key:"tasks",     label:"Tasks",        icon:"☑" },
  { key:"calendar",  label:"Calendar",     icon:"▦" },
];

/* ════════════════════════════════════════
   APP SHELL
════════════════════════════════════════ */
export default function BzTracker() {
  const [page, setPage]         = useState("dashboard");
  const [stratTab, setStratTab] = useState("playbooks");
  const [players, setPlayers]   = useState(PLAYERS_DEFAULT);

  useEffect(()=>{ api.get("/api/players").then(d=>{ if(Array.isArray(d)) setPlayers(d); }).catch(()=>{}); }, []);

  const renderPage = () => {
    switch(page) {
      case "dashboard": return <Dashboard setPage={setPage}/>;
      case "tracker":   return <LiveTracker players={players}/>;
      case "scrimlog":  return <ScrimLog setPage={setPage}/>;
      case "strategy":  return <Strategy tab={stratTab} setTab={setStratTab}/>;
      case "analysis":  return <DataAnalysis players={players}/>;
      case "vod":       return <VodReview/>;
      case "tasks":     return <Tasks players={players} setPlayers={setPlayers}/>;
      case "calendar":  return <CalendarPage/>;
      default:          return <Dashboard setPage={setPage}/>;
    }
  };

  return (
    <>
      <style>{css}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>
        {/* Sidebar */}
        <aside style={{ width:210, background:"var(--s1)", borderRight:"1px solid var(--b1)", display:"flex", flexDirection:"column", flexShrink:0 }}>
          <div style={{ padding:"18px 14px 14px", borderBottom:"1px solid var(--b1)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, background:"var(--acc)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span className="bc" style={{ fontSize:20, fontWeight:900, color:"#080a10" }}>TC</span>
              </div>
              <div>
                <div className="bc" style={{ fontSize:17, fontWeight:900, letterSpacing:"0.06em" }}>TICRA</div>
                <div className="label-sm" style={{ letterSpacing:"0.04em" }}></div>
              </div>
            </div>
          </div>
          <nav style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
            {NAV.map(n=>(
              <div key={n.key} className={`nav-item${page===n.key?" on":""}`} onClick={()=>setPage(n.key)} style={{ marginBottom:2 }}>
                <span style={{ fontSize:14, width:18, textAlign:"center", flexShrink:0 }}>{n.icon}</span>
                <span style={{ flex:1 }}>{n.label}</span>
                {n.live && <div className="ldot"/>}
              </div>
            ))}
          </nav>
          <div style={{ borderTop:"1px solid var(--b1)", padding:"12px 10px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:30, height:30, borderRadius:"50%", background:"var(--acc)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#080a10", flexShrink:0 }}>CO</div>
              <div>
                <div style={{ fontSize:12, fontWeight:600 }}>Coach</div>
                <div style={{ fontSize:10, color:"var(--t3)" }}>coach</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main key={page} className="fade-up" style={{ flex:1, overflowY:"auto", overflowX:"hidden" }}>
          {renderPage()}
        </main>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════ */
function Dashboard({ setPage }) {
  const [scrims]  = useState([]);
  const [events]  = useState([]);
  const [pending] = useState([]);

  return (
    <div style={{ padding:"28px 32px", maxWidth:1100 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", lineHeight:1 }}>DASHBOARD</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:4 }}>Welcome back, Coach</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-sub" onClick={()=>setPage("tracker")}><div className="ldot"/> New Game</button>
          <button className="btn btn-acc" onClick={()=>setPage("vod")}>+ VOD Review</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
        <StatBlock label="Win Rate"      value="—" sub="No games yet" accent/>
        <StatBlock label="Games Tracked" value="0" sub="This month"/>
        <StatBlock label="Best Map"      value="—" sub="No data yet"/>
        <StatBlock label="Avg Rds Won"   value="—" sub="No data yet"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.8fr 1fr", gap:16 }}>
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span className="bc" style={{ fontSize:18, fontWeight:700, letterSpacing:"0.04em" }}>RECENT SCRIMS</span>
            <button className="btn btn-ghost" style={{ fontSize:11 }} onClick={()=>setPage("scrimlog")}>View all →</button>
          </div>
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--t3)" }}>
            <div style={{ fontSize:28, marginBottom:10 }}>≡</div>
            <div style={{ fontSize:13, marginBottom:4 }}>No scrims tracked yet</div>
            <div style={{ fontSize:12, color:"var(--t3)" }}>Start a game in the Live Tracker</div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="card">
            <div className="bc" style={{ fontSize:16, fontWeight:700, letterSpacing:"0.04em", marginBottom:12 }}>UPCOMING</div>
            <div style={{ color:"var(--t3)", fontSize:12 }}>No events scheduled.</div>
          </div>
          <div className="card" style={{ flex:1 }}>
            <div className="bc" style={{ fontSize:16, fontWeight:700, letterSpacing:"0.04em", marginBottom:12 }}>PENDING TASKS</div>
            <div style={{ color:"var(--t3)", fontSize:12 }}>No pending tasks.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LIVE TRACKER
════════════════════════════════════════ */
function LiveTracker() {
  const [phase, setPhase]   = useState("setup");
  const [map, setMap]       = useState("Ascent");
  const [opp, setOpp]       = useState("");
  const [comp, setComp]     = useState(["Jett","Sova","Sage","Omen","Cypher"]);
  const [rounds, setRounds] = useState([]);
  const [eco, setEco]       = useState("Full Buy");
  const [strat, setStrat]   = useState("");

  const score = { us:rounds.filter(r=>r.res==="w").length, them:rounds.filter(r=>r.res==="l").length };

  const logRound = res => {
    if(rounds.length>=24) return;
    setRounds(p=>[...p, { res, eco, strat, n:p.length+1 }]);
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
              {AGENTS.map(ag=>{
                const sel = comp.includes(ag.name);
                return (
                  <button key={ag.name}
                    onClick={()=>{ if(sel) setComp(p=>p.filter(a=>a!==ag.name)); else if(comp.length<5) setComp(p=>[...p,ag.name]); }}
                    style={{ padding:"5px 11px", borderRadius:"var(--r)", fontSize:12, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                      background:sel?ag.bg:"var(--s3)", color:sel?ag.color:"var(--t3)", border:`1px solid ${sel?ag.color+"44":"var(--b2)"}` }}>
                    {ag.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:6, marginTop:10 }}>
              {comp.map((a,i)=><AgentBadge key={i} name={a} size={36}/>)}
              {Array(5-comp.length).fill(null).map((_,i)=>(
                <div key={i} style={{ width:36, height:36, border:"1px dashed var(--b2)", borderRadius:"var(--r)" }}/>
              ))}
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
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <div className="ldot"/>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:"var(--acc)" }}>LIVE</span>
          </div>
          <div className="bc" style={{ fontSize:30, fontWeight:900, letterSpacing:"0.04em" }}>{map} — vs {opp}</div>
        </div>
        <button className="btn btn-red" onClick={()=>{ setPhase("setup"); setRounds([]); }}>End Game</button>
      </div>

      <div className="card" style={{ textAlign:"center", marginBottom:18, background:"var(--s2)", border:"1px solid var(--b2)" }}>
        <div className="label-sm" style={{ marginBottom:8 }}>HALF {rounds.length>=12?2:1} · ROUND {rounds.length+1}</div>
        <div style={{ display:"flex", justifyContent:"center", gap:40, alignItems:"flex-end" }}>
          <div>
            <div className="bc" style={{ fontSize:80, fontWeight:900, color:"var(--green)", lineHeight:1 }}>{score.us}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--green)", letterSpacing:"0.08em" }}>TICRA</div>
          </div>
          <div style={{ fontSize:30, color:"var(--t3)", paddingBottom:12 }}>:</div>
          <div>
            <div className="bc" style={{ fontSize:80, fontWeight:900, color:"var(--red)", lineHeight:1 }}>{score.them}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--red)", letterSpacing:"0.08em" }}>{opp.toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="label-sm" style={{ marginBottom:8 }}>ROUND HISTORY</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {rounds.map((r,i)=><div key={i} className={`pip pip-${r.res}`}>{i+1}</div>)}
          {Array(Math.max(0,24-rounds.length)).fill(null).map((_,i)=>(
            <div key={`e${i}`} className="pip pip-e">{rounds.length+i+1}</div>
          ))}
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
            {STRATS_INIT.filter(s=>s.map===map).map(s=><option key={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
        <button onClick={()=>logRound("w")} style={{ padding:"32px", borderRadius:12, cursor:"pointer", transition:"all 0.15s",
          background:"rgba(105,240,174,0.07)", color:"var(--green)", border:"2px solid rgba(105,240,174,0.2)",
          fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, letterSpacing:"0.1em" }}>
          ▲ ROUND WIN
        </button>
        <button onClick={()=>logRound("l")} style={{ padding:"32px", borderRadius:12, cursor:"pointer", transition:"all 0.15s",
          background:"rgba(255,82,82,0.07)", color:"var(--red)", border:"2px solid rgba(255,82,82,0.2)",
          fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, letterSpacing:"0.1em" }}>
          ▼ ROUND LOSS
        </button>
      </div>

      {rounds.length>0 && (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="tbl">
            <thead><tr><th>#</th><th>Result</th><th>Economy</th><th>Strategy</th></tr></thead>
            <tbody>
              {[...rounds].reverse().slice(0,6).map((r,i)=>(
                <tr key={i}>
                  <td className="mono" style={{ color:"var(--t3)", fontSize:12 }}>{rounds.length-i}</td>
                  <td><span className={`chip ${r.res==="w"?"chip-green":"chip-red"}`}>{r.res==="w"?"▲ Win":"▼ Loss"}</span></td>
                  <td><span className="chip chip-dim">{r.eco}</span></td>
                  <td style={{ color:"var(--t2)", fontSize:12 }}>{r.strat||"—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   SCRIM LOG
════════════════════════════════════════ */
function ScrimLog({ setPage }) {
  const [scrims, setScrims] = useState([]);
  const [filter, setFilter] = useState({ map:"All", res:"All", q:"" });
  const [sel, setSel]       = useState(null);

  const filtered = scrims.filter(s=>{
    if(filter.map!=="All"&&s.map!==filter.map) return false;
    if(filter.res!=="All"&&s.res!==filter.res) return false;
    if(filter.q&&!s.opp.toLowerCase().includes(filter.q.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>SCRIM LOG</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>{scrims.length} games tracked</div>
        </div>
        <button className="btn btn-acc" onClick={()=>setPage("tracker")}><div className="ldot"/> New Game</button>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:18 }}>
        <input type="text" placeholder="Search opponent..." style={{ width:200 }} value={filter.q} onChange={e=>setFilter(f=>({...f,q:e.target.value}))}/>
        <select style={{ width:140 }} value={filter.map} onChange={e=>setFilter(f=>({...f,map:e.target.value}))}><option>All</option>{MAPS.map(m=><option key={m}>{m}</option>)}</select>
        <select style={{ width:120 }} value={filter.res} onChange={e=>setFilter(f=>({...f,res:e.target.value}))}><option>All</option><option value="win">Wins</option><option value="loss">Losses</option></select>
      </div>

      {scrims.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>≡</div>
          <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>No Scrims Yet</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Track your first game using the Live Tracker</div>
          <button className="btn btn-acc" onClick={()=>setPage("tracker")}><div className="ldot"/> Start Tracking</button>
        </div>
      ) : (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Map</th><th>Opponent</th><th>Comp</th><th>Score</th><th>Rounds</th><th></th></tr></thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.id} style={{ cursor:"pointer" }} onClick={()=>setSel(s)}>
                  <td className="mono" style={{ color:"var(--t3)", fontSize:12 }}>{s.date}</td>
                  <td><span className="chip chip-blue">{s.map}</span></td>
                  <td style={{ fontWeight:600 }}>vs {s.opp}</td>
                  <td><div style={{ display:"flex", gap:3 }}>{s.comp.map((a,i)=><AgentBadge key={i} name={a} size={22}/>)}</div></td>
                  <td><span className="bc" style={{ fontSize:22, fontWeight:900, color:s.res==="win"?"var(--green)":"var(--red)" }}>{s.score}</span></td>
                  <td><div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>{s.rounds.map((r,i)=><div key={i} style={{ width:7, height:7, borderRadius:2, background:r==="w"?"var(--green)":"var(--red)", opacity:0.75 }}/>)}</div></td>
                  <td><button className="btn btn-ghost" style={{ padding:"3px 9px", fontSize:11 }} onClick={e=>{e.stopPropagation();setPage("vod");}}>▶ VOD</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <Modal onClose={()=>setSel(null)} title={`vs ${sel.opp}`}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span className="chip chip-blue">{sel.map}</span>
              <span className={`chip ${sel.res==="win"?"chip-green":"chip-red"}`}>{sel.res==="win"?"▲ Win":"▼ Loss"}</span>
              <span style={{ color:"var(--t3)", fontSize:12 }}>{sel.date}</span>
            </div>
            <span className="bc" style={{ fontSize:40, fontWeight:900, color:sel.res==="win"?"var(--green)":"var(--red)" }}>{sel.score}</span>
          </div>
          <Divider/>
          <div className="label-sm" style={{ marginBottom:8 }}>Composition</div>
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            {sel.comp.map((a,i)=>(
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <AgentBadge name={a} size={36}/>
                <span style={{ fontSize:10, color:"var(--t2)" }}>{a}</span>
              </div>
            ))}
          </div>
          <div className="label-sm" style={{ marginBottom:8 }}>Round History</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:20 }}>
            {sel.rounds.map((r,i)=><div key={i} className={`pip pip-${r}`}>{i+1}</div>)}
          </div>
          <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center" }} onClick={()=>{setPage("vod");setSel(null);}}>▶ Create VOD Review</button>
        </Modal>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   STRATEGY
════════════════════════════════════════ */
function Strategy({ tab, setTab }) {
  const TABS = [
    { key:"playbooks",    label:"Playbooks" },
    { key:"gameplans",    label:"Game Plans" },
    { key:"compositions", label:"Compositions" },
  ];
  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>STRATEGY</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Tactical hub — strats, playbooks, and match prep</div>
      <div className="tab-bar" style={{ maxWidth:380, marginBottom:24 }}>
        {TABS.map(t=><button key={t.key} className={`tab${tab===t.key?" on":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
      </div>
      {tab==="playbooks"    && <Playbooks/>}
      {tab==="gameplans"    && <GamePlans/>}
      {tab==="compositions" && <Compositions/>}
    </div>
  );
}

function RawDB() {
  const [strats, setStrats] = useState(STRATS_INIT);
  const [filt, setFilt]     = useState({ map:"All", side:"All" });
  const [modal, setModal]   = useState(false);
  const [form, setForm]     = useState({ name:"", map:"Ascent", side:"atk", cat:"Default", desc:"" });

  useEffect(()=>{ api.get("/api/strats").then(d=>{ if(Array.isArray(d)) setStrats(d); }).catch(()=>{}); },[]);

  const filtered = strats.filter(s=>{
    if(filt.map!=="All"&&s.map!==filt.map) return false;
    if(filt.side!=="All"&&s.side!==filt.side) return false;
    return true;
  });

  const add = () => {
    if(!form.name.trim()) return;
    api.post("/api/strats", form)
      .then(d=>setStrats(p=>[...p, d]))
      .catch(()=>setStrats(p=>[...p, { ...form, id:Date.now() }]));
    setModal(false);
    setForm({ name:"", map:"Ascent", side:"atk", cat:"Default", desc:"" });
  };

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:18 }}>
        <select style={{ width:130 }} value={filt.map} onChange={e=>setFilt(f=>({...f,map:e.target.value}))}><option>All</option>{MAPS.map(m=><option key={m}>{m}</option>)}</select>
        <select style={{ width:120 }} value={filt.side} onChange={e=>setFilt(f=>({...f,side:e.target.value}))}><option>All</option><option value="atk">Attack</option><option value="def">Defense</option></select>
        <div style={{ flex:1 }}/>
        <button className="btn btn-acc" onClick={()=>setModal(true)}>+ New Strategy</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:12 }}>
        {filtered.map(s=>(
          <div key={s.id} className="strat-card">
            <div style={{ padding:"13px 15px", borderBottom:"1px solid var(--b1)" }}>
              <div style={{ fontWeight:600, marginBottom:7 }}>{s.name}</div>
              <div style={{ display:"flex", gap:6 }}>
                <span className="chip chip-blue">{s.map}</span>
                <span className={`chip ${s.side==="atk"?"chip-acc":"chip-blue"}`} style={{ color:s.side==="atk"?"var(--acc)":"var(--blue)" }}>{s.side==="atk"?"ATK":"DEF"}</span>
                <span className="chip chip-purple">{s.cat}</span>
              </div>
            </div>
            <div style={{ padding:"11px 15px" }}>
              <p style={{ fontSize:12, color:"var(--t2)", lineHeight:1.65 }}>{s.desc}</p>
            </div>
          </div>
        ))}
        <div className="strat-card" onClick={()=>setModal(true)} style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:120, borderStyle:"dashed", background:"transparent" }}>
          <div style={{ textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:26, marginBottom:4 }}>+</div>
            <div style={{ fontSize:12 }}>New Strategy</div>
          </div>
        </div>
      </div>
      {modal && (
        <Modal onClose={()=>setModal(false)} title="New Strategy">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Name</div><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Strategy name"/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Map</div><select value={form.map} onChange={e=>setForm(f=>({...f,map:e.target.value}))}>{MAPS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Side</div><select value={form.side} onChange={e=>setForm(f=>({...f,side:e.target.value}))}><option value="atk">Attack</option><option value="def">Defense</option></select></div>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Category</div><select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}><option>Default</option><option>Execute</option><option>Mid Control</option><option>Retake</option><option>Aggressive</option></select></div>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Description</div><textarea rows={3} style={{ resize:"vertical" }} value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={add}>Create</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Playbooks() {
  const STORAGE_KEY = "ticra_playbooks_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch{ return []; } };
  const save = (data) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch{} };

  const [pbs, setPbsRaw]  = useState(load);
  const [sel, setSel]     = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [modal, setModal] = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form, setForm]   = useState({ name:"", map:"Ascent", desc:"" });
  const fileRef = React.useRef();

  const setPbs = (fn) => setPbsRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    save(next); return next;
  });

  // Convert base64 → blob URL whenever selection changes (blob URLs work in iframes, data: URLs don't)
  React.useEffect(() => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    if (!sel?.pdfUrl) { setBlobUrl(null); return; }
    try {
      const base64 = sel.pdfUrl.split(",")[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      setBlobUrl(URL.createObjectURL(blob));
    } catch { setBlobUrl(null); }
  }, [sel?.id]);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result; // data:application/pdf;base64,...
      const nb = { id: Date.now(), name: form.name.trim() || file.name.replace(".pdf",""), map: form.map, desc: form.desc, pdfUrl: base64, fileName: file.name };
      setPbs(prev => [...prev, nb]);
      setSel(nb);
      setModal(false);
      setForm({ name:"", map:"Ascent", desc:"" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const deletePb = (id) => {
    setPbs(p => p.filter(x => x.id !== id));
    if(sel?.id === id) setSel(null);
    setDelConfirm(null);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:18, height:"calc(100vh - 200px)" }}>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        <div className="label-sm" style={{ marginBottom:8 }}>Playbooks</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1, overflowY:"auto" }}>
          {pbs.map((p)=>(
            <div key={p.id} style={{ position:"relative" }}>
              <div onClick={()=>setSel(p)} style={{ padding:"11px 13px", paddingRight:34, borderRadius:"var(--r2)", cursor:"pointer", background:sel?.id===p.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===p.id?"var(--b3)":"var(--b1)"}`, transition:"all 0.15s" }}>
                <div style={{ fontWeight:600, marginBottom:4, fontSize:13 }}>{p.name}</div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span className="chip chip-blue">{p.map}</span>
                  <span style={{ fontSize:10, color:"var(--t3)" }}>PDF</span>
                </div>
                {p.desc && <div style={{ fontSize:11, color:"var(--t2)", marginTop:3, lineHeight:1.4 }}>{p.desc}</div>}
              </div>
              <button onClick={()=>setDelConfirm(p)} style={{ position:"absolute", top:8, right:8, background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:15, padding:"2px 4px" }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn btn-acc" style={{ marginTop:10, justifyContent:"center" }} onClick={()=>setModal(true)}>+ Upload Playbook PDF</button>
        <input ref={fileRef} type="file" accept="application/pdf" style={{ display:"none" }} onChange={handleUpload}/>
      </div>

      {sel ? (
        <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ padding:"14px 18px", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div className="bc" style={{ fontSize:20, fontWeight:700 }}>{sel.name}</div>
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                <span className="chip chip-blue">{sel.map}</span>
                {sel.desc && <span style={{ fontSize:12, color:"var(--t2)" }}>{sel.desc}</span>}
              </div>
            </div>
            <button className="btn btn-red" onClick={()=>setDelConfirm(sel)}>🗑 Delete</button>
          </div>
          <iframe src={blobUrl||""} style={{ flex:1, border:"none", width:"100%", minHeight:500 }} title={sel.name}/>
        </div>
      ) : (
        <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
          <div style={{ textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
            <div className="bc" style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>{pbs.length===0?"No Playbooks Yet":"Select a Playbook"}</div>
            <div style={{ fontSize:13 }}>{pbs.length===0?"Upload a PDF playbook to get started":"Click a playbook on the left to view it"}</div>
          </div>
        </div>
      )}

      {modal && (
        <Modal onClose={()=>setModal(false)} title="Upload Playbook PDF">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Playbook Name</div><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Ascent Attack Executes"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Map</div><select value={form.map} onChange={e=>setForm(f=>({...f,map:e.target.value}))}>{MAPS.map(m=><option key={m}>{m}</option>)}</select></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Description (optional)</div><input type="text" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Short description"/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={()=>fileRef.current?.click()}>Choose PDF File</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            </div>
            <div style={{ fontSize:11, color:"var(--t3)", textAlign:"center" }}>Only PDF files are supported</div>
          </div>
        </Modal>
      )}

      {delConfirm && (
        <Modal onClose={()=>setDelConfirm(null)} title="Delete Playbook?">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.7 }}>Are you sure you want to delete <strong style={{ color:"var(--t1)" }}>"{delConfirm.name}"</strong>? This cannot be undone.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-red" style={{ flex:1, justifyContent:"center" }} onClick={()=>deletePb(delConfirm.id)}>🗑 Yes, Delete</button>
              <button className="btn btn-ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─ Google Docs-style Rich Editor ─ */
function DocsEditor({ value, onChange }) {
  const editorRef = React.useRef(null);
  const [selImg, setSelImg] = useState(null); // selected image id
  const [dragState, setDragState] = useState(null); // {id, startX, startY, origX, origY}
  const [resizeState, setResizeState] = useState(null); // {id, startX, origW}
  const isComposing = React.useRef(false);

  // Serialize editor DOM → value object {html, images:[{id,src,x,y,w,float}]}
  const serialize = () => {
    const el = editorRef.current;
    if (!el) return value;
    const imgs = [];
    el.querySelectorAll("img[data-imgid]").forEach(img => {
      imgs.push({
        id: img.dataset.imgid,
        src: img.src,
        w: parseInt(img.style.width)||320,
        float: img.style.float||"none",
      });
    });
    return { html: el.innerHTML, images: imgs };
  };

  const commit = () => { onChange(serialize()); };

  // Paste image handler
  const onPaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          const id = `img_${Date.now()}`;
          const imgEl = document.createElement("img");
          imgEl.src = ev.target.result;
          imgEl.dataset.imgid = id;
          imgEl.style.width = "340px";
          imgEl.style.display = "inline-block";
          imgEl.style.verticalAlign = "top";
          imgEl.style.margin = "6px 10px 6px 0";
          imgEl.style.borderRadius = "6px";
          imgEl.style.cursor = "pointer";
          imgEl.style.border = "2px solid transparent";
          imgEl.contentEditable = "false";
          // Insert at cursor
          const sel = window.getSelection();
          if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(imgEl);
            range.setStartAfter(imgEl);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          } else {
            editorRef.current.appendChild(imgEl);
          }
          commit();
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // Click on image to select it
  const onEditorClick = (e) => {
    const img = e.target.closest("img[data-imgid]");
    if (img) {
      e.preventDefault();
      setSelImg(img.dataset.imgid);
      // highlight
      editorRef.current.querySelectorAll("img[data-imgid]").forEach(i => {
        i.style.border = i.dataset.imgid === img.dataset.imgid ? "2px solid var(--acc)" : "2px solid transparent";
        i.style.outline = "none";
      });
    } else {
      setSelImg(null);
      editorRef.current.querySelectorAll("img[data-imgid]").forEach(i => { i.style.border = "2px solid transparent"; });
    }
    commit();
  };

  // Drag image
  const startDrag = (e, id) => {
    e.preventDefault();
    const img = editorRef.current.querySelector(`img[data-imgid="${id}"]`);
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setDragState({ id, startX: e.clientX, startY: e.clientY, img, origFloat: img.style.float });
    img.style.opacity = "0.7";
  };

  // Resize image
  const startResize = (e, id, edge) => {
    e.preventDefault();
    e.stopPropagation();
    const img = editorRef.current.querySelector(`img[data-imgid="${id}"]`);
    if (!img) return;
    setResizeState({ id, startX: e.clientX, origW: img.offsetWidth, img, edge });
  };

  React.useEffect(() => {
    if (!dragState && !resizeState) return;

    const onMove = (e) => {
      if (resizeState) {
        const { img, startX, origW, edge } = resizeState;
        const delta = edge === "left" ? startX - e.clientX : e.clientX - startX;
        const newW = Math.max(80, Math.min(860, origW + delta));
        img.style.width = newW + "px";
        return;
      }
      if (dragState) {
        const { img, startX, startY } = dragState;
        const dx = e.clientX - startX;
        // Determine float based on horizontal position relative to editor
        const editorRect = editorRef.current.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const centerX = imgRect.left + imgRect.width/2 + dx;
        const relX = (centerX - editorRect.left) / editorRect.width;
        if (relX < 0.35) {
          img.style.float = "left";
          img.style.margin = "6px 14px 6px 0";
        } else if (relX > 0.65) {
          img.style.float = "right";
          img.style.margin = "6px 0 6px 14px";
        } else {
          img.style.float = "none";
          img.style.margin = "6px 10px 6px 0";
          img.style.display = "block";
          img.style.marginLeft = "auto";
          img.style.marginRight = "auto";
        }
      }
    };

    const onUp = () => {
      if (dragState) { dragState.img.style.opacity = "1"; }
      setDragState(null);
      setResizeState(null);
      commit();
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragState, resizeState]);

  // Delete selected image with Backspace/Delete
  const onKeyDown = (e) => {
    if ((e.key === "Backspace" || e.key === "Delete") && selImg) {
      const img = editorRef.current.querySelector(`img[data-imgid="${selImg}"]`);
      if (img && document.activeElement !== editorRef.current) {
        e.preventDefault();
        img.remove();
        setSelImg(null);
        commit();
      }
    }
  };

  // Format commands
  const fmt = (cmd, val) => { document.execCommand(cmd, false, val); editorRef.current.focus(); commit(); };

  const lastLoadedHtml = React.useRef(null);

  // Sync HTML into DOM only when switching to a different doc (not from our own commits)
  React.useEffect(() => {
    if (editorRef.current && value?.html !== undefined && value.html !== lastLoadedHtml.current) {
      lastLoadedHtml.current = value.html;
      editorRef.current.innerHTML = value.html || "";
    }
  }, [value?.html]);

  const TOOLBAR_BTN = (label, action, title) => (
    <button title={title||label} onMouseDown={e=>{e.preventDefault(); action();}}
      style={{ padding:"4px 9px", background:"var(--s2)", border:"1px solid var(--b2)", borderRadius:"var(--r)", color:"var(--t1)", fontSize:12, fontWeight:600, cursor:"pointer", lineHeight:1.4 }}>
      {label}
    </button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", gap:0, background:"#1a1d28", borderRadius:"var(--r2)", border:"1px solid var(--b2)", overflow:"hidden" }}>
      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:4, padding:"7px 12px", borderBottom:"1px solid var(--b1)", background:"var(--s2)", flexWrap:"wrap" }}>
        {TOOLBAR_BTN("B", ()=>fmt("bold"), "Bold")}
        {TOOLBAR_BTN("I", ()=>fmt("italic"), "Italic")}
        {TOOLBAR_BTN("U", ()=>fmt("underline"), "Underline")}
        <div style={{ width:1, height:18, background:"var(--b2)", margin:"0 2px" }}/>
        {TOOLBAR_BTN("H1", ()=>fmt("formatBlock","h2"), "Heading")}
        {TOOLBAR_BTN("H2", ()=>fmt("formatBlock","h3"), "Subheading")}
        {TOOLBAR_BTN("¶", ()=>fmt("formatBlock","p"), "Paragraph")}
        <div style={{ width:1, height:18, background:"var(--b2)", margin:"0 2px" }}/>
        {TOOLBAR_BTN("• List", ()=>fmt("insertUnorderedList"), "Bullet list")}
        {TOOLBAR_BTN("1. List", ()=>fmt("insertOrderedList"), "Numbered list")}
        <div style={{ width:1, height:18, background:"var(--b2)", margin:"0 2px" }}/>
        {TOOLBAR_BTN("🎨", ()=>{ const c=prompt("Hex color (e.g. #ff5252):","#d4ff1e"); if(c) fmt("foreColor",c); }, "Text color")}
        {TOOLBAR_BTN("⬛ Hi", ()=>{ const c=prompt("Highlight color:","#ffab4040"); if(c) fmt("hiliteColor",c); }, "Highlight")}
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:"var(--t3)" }}>Ctrl+V to paste images · drag to reposition · drag edge to resize</span>
      </div>

      {/* Editable area */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px 32px", background:"#13151f" }}>
        {/* Fake doc page */}
        <div style={{ maxWidth:760, margin:"0 auto", background:"#1c1f2e", borderRadius:8, minHeight:600, padding:"40px 48px", boxShadow:"0 4px 32px rgba(0,0,0,0.4)", position:"relative" }}
          tabIndex={-1} onKeyDown={onKeyDown}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={commit}
            onPaste={onPaste}
            onClick={onEditorClick}
            onCompositionStart={()=>isComposing.current=true}
            onCompositionEnd={()=>{ isComposing.current=false; commit(); }}
            className="docs-editor"
            style={{
              minHeight: 520,
              outline:"none",
              color:"var(--t1)",
              fontSize:14,
              lineHeight:1.9,
              fontFamily:"'Barlow',sans-serif",
              caretColor:"var(--acc)",
            }}
          />
          {/* Image overlay controls when image selected */}
          {selImg && (() => {
            const img = editorRef.current?.querySelector(`img[data-imgid="${selImg}"]`);
            if (!img) return null;
            const rect = img.getBoundingClientRect();
            const containerRect = editorRef.current.closest("[tabindex]").getBoundingClientRect();
            const top = rect.top - containerRect.top;
            const left = rect.left - containerRect.left;
            const w = rect.width;
            const h = rect.height;
            return (
              <div style={{ position:"absolute", top, left, width:w, height:h, pointerEvents:"none", zIndex:20 }}>
                {/* Drag handle top */}
                <div title="Drag to move" onMouseDown={e=>startDrag(e,selImg)} style={{ position:"absolute", top:-1, left:"50%", transform:"translateX(-50%)", width:40, height:14, background:"var(--acc)", borderRadius:"4px 4px 0 0", cursor:"move", pointerEvents:"all", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:9, color:"#080a10", fontWeight:900, letterSpacing:1 }}>⠿</span>
                </div>
                {/* Left resize */}
                <div onMouseDown={e=>startResize(e,selImg,"left")} style={{ position:"absolute", left:-5, top:"50%", transform:"translateY(-50%)", width:10, height:32, background:"var(--acc)", borderRadius:3, cursor:"ew-resize", pointerEvents:"all" }}/>
                {/* Right resize */}
                <div onMouseDown={e=>startResize(e,selImg,"right")} style={{ position:"absolute", right:-5, top:"50%", transform:"translateY(-50%)", width:10, height:32, background:"var(--acc)", borderRadius:3, cursor:"ew-resize", pointerEvents:"all" }}/>
                {/* Delete */}
                <div onClick={()=>{ img.remove(); setSelImg(null); commit(); }} style={{ position:"absolute", top:-1, right:-1, width:20, height:20, background:"#ff5252", borderRadius:"0 4px 0 4px", cursor:"pointer", pointerEvents:"all", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:12, color:"#fff", lineHeight:1 }}>×</span>
                </div>
                {/* Size badge */}
                <div style={{ position:"absolute", bottom:-18, left:"50%", transform:"translateX(-50%)", fontSize:9, background:"var(--acc)", color:"#080a10", padding:"1px 7px", borderRadius:3, whiteSpace:"nowrap", fontFamily:"monospace", fontWeight:700 }}>
                  {Math.round(w)}px · drag edges to resize
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function GamePlans() {
  const STORAGE_KEY = "ticra_gameplans_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch{ return []; } };
  const save = (data) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch{} };

  const [docs, setDocsRaw] = useState(load);
  const [sel, setSel]      = useState(null);
  const [modal, setModal]  = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form, setForm]    = useState({ title:"", opp:"", maps:[], side:"atk" });
  const [docContent, setDocContent] = useState({ html:"", images:[] }); // live editor state

  const setDocs = (fn) => setDocsRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    save(next); return next;
  });

  // When switching docs, load content into editor (but NOT when docs array changes from our own save)
  React.useEffect(()=>{
    if (sel) setDocContent(sel.content || { html: sel.body||"", images:[] });
    else setDocContent({ html:"", images:[] });
  }, [sel?.id]); // only on ID change, not every save

  // Debounced save — writes to localStorage every 500ms after typing stops
  const saveTimer = React.useRef(null);
  const selIdRef  = React.useRef(sel?.id);
  React.useEffect(()=>{ selIdRef.current = sel?.id; }, [sel?.id]);

  const saveContent = (content) => {
    setDocContent(content);
    if (!selIdRef.current) return;
    // Save immediately to localStorage without going through React state loop
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDocsRaw(prev => {
        const next = prev.map(d => d.id===selIdRef.current ? { ...d, content } : d);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    }, 400);
  };

  const toggleMap = m => setForm(f=>({ ...f, maps: f.maps.includes(m)?f.maps.filter(x=>x!==m):[...f.maps,m] }));

  const create = () => {
    if(!form.title.trim()) return;
    const d = { id:Date.now(), ...form, date: new Date().toLocaleDateString(), content:{ html:"", images:[] } };
    setDocs(p=>[...p, d]);
    setSel(d);
    setModal(false);
    setForm({ title:"", opp:"", maps:[], side:"atk" });
  };

  const deleteDoc = (id) => {
    const next = docs.filter(d=>d.id!==id);
    setDocsRaw(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    if(sel?.id===id) setSel(null);
    setDelConfirm(null);
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18, height:"calc(100vh - 200px)" }}>
      {/* Sidebar */}
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        <div className="label-sm" style={{ marginBottom:8 }}>Game Plans</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6, flex:1, overflowY:"auto" }}>
          {docs.map(d=>(
            <div key={d.id} style={{ position:"relative" }}>
              <div onClick={()=>setSel(d)} style={{ padding:"11px 13px", paddingRight:32, borderRadius:"var(--r2)", cursor:"pointer", background:sel?.id===d.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===d.id?"var(--b3)":"var(--b1)"}`, transition:"all 0.15s" }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>{d.title}</div>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {d.maps?.map(m=><span key={m} className="chip chip-blue">{m}</span>)}
                  {d.opp && <span className="chip chip-purple">vs {d.opp}</span>}
                </div>
                <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{d.date}</div>
              </div>
              <button onClick={()=>setDelConfirm(d)} style={{ position:"absolute", top:8, right:8, background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:15, padding:"2px 4px" }}>×</button>
            </div>
          ))}
        </div>
        <button className="btn btn-acc" style={{ marginTop:10, justifyContent:"center" }} onClick={()=>setModal(true)}>+ New Game Plan</button>
      </div>

      {/* Editor area */}
      {sel ? (
        <div style={{ display:"flex", flexDirection:"column", gap:0, minHeight:0, overflow:"hidden" }}>
          {/* Doc header */}
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--s1)", borderRadius:"var(--r2) var(--r2) 0 0", border:"1px solid var(--b1)", marginBottom:0 }}>
            <div>
              <div className="bc" style={{ fontSize:20, fontWeight:700 }}>{sel.title}</div>
              <div style={{ display:"flex", gap:6, marginTop:3, alignItems:"center" }}>
                {sel.maps?.map(m=><span key={m} className="chip chip-blue">{m}</span>)}
                {sel.side && <span className={`chip ${sel.side==="atk"?"chip-acc":"chip-blue"}`}>{sel.side==="atk"?"ATTACK":"DEFENSE"}</span>}
                {sel.opp && <span style={{ color:"var(--t3)", fontSize:12 }}>vs {sel.opp}</span>}
                <span style={{ color:"var(--t3)", fontSize:11 }}>· {sel.date}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:11, color:"var(--green)" }}>✓ Auto-saving</span>
              <button className="btn btn-red" style={{ fontSize:12 }} onClick={()=>setDelConfirm(sel)}>🗑 Delete</button>
            </div>
          </div>
          {/* Docs editor fills remaining height */}
          <div style={{ flex:1, minHeight:0, borderRadius:"0 0 var(--r2) var(--r2)", overflow:"hidden" }}>
            <DocsEditor value={docContent} onChange={saveContent}/>
          </div>
        </div>
      ) : (
        <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
          <div style={{ textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🗂</div>
            <div className="bc" style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>{docs.length===0?"No Game Plans Yet":"Select a Game Plan"}</div>
            <div style={{ fontSize:13 }}>{docs.length===0?"Create your first game plan to get started":"Click a plan on the left to view it"}</div>
          </div>
        </div>
      )}

      {modal && (
        <Modal onClose={()=>setModal(false)} title="New Game Plan">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. vs LOUD — Ascent Game Plan"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Opponent (optional)</div><input type="text" value={form.opp} onChange={e=>setForm(f=>({...f,opp:e.target.value}))} placeholder="Team name"/></div>
            <div>
              <div className="label-sm" style={{ marginBottom:8 }}>Maps</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {MAPS.map(m=>(
                  <button key={m} onClick={()=>toggleMap(m)} style={{ padding:"4px 10px", borderRadius:"var(--r)", fontSize:12, fontWeight:500, background:form.maps.includes(m)?"rgba(79,195,247,0.15)":"var(--s3)", border:`1px solid ${form.maps.includes(m)?"var(--blue)":"var(--b2)"}`, color:form.maps.includes(m)?"var(--blue)":"var(--t2)", cursor:"pointer", transition:"all 0.15s" }}>{m}</button>
                ))}
              </div>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Side Focus</div>
              <select value={form.side} onChange={e=>setForm(f=>({...f,side:e.target.value}))}>
                <option value="atk">Attack</option><option value="def">Defense</option><option value="both">Both</option>
              </select>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={create}>Create Game Plan</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {delConfirm && (
        <Modal onClose={()=>setDelConfirm(null)} title="Delete Game Plan?">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.7 }}>Are you sure you want to delete <strong style={{ color:"var(--t1)" }}>"{delConfirm.title}"</strong>? This cannot be undone.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-red" style={{ flex:1, justifyContent:"center" }} onClick={()=>deleteDoc(delConfirm.id)}>🗑 Yes, Delete</button>
              <button className="btn btn-ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Compositions() {
  const STORAGE_KEY = "ticra_comps_v1";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch{ return []; } };
  const save = (data) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch{} };

  const [comps, setCompsRaw]  = useState(load);
  const [modal, setModal]     = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form, setForm]       = useState({ map:"Ascent", name:"", agents:[], players:["","","","",""] });
  const ROLES = ["Duelist","Initiator","Controller","Sentinel"];

  const setComps = (fn) => setCompsRaw(prev => {
    const next = typeof fn === "function" ? fn(prev) : fn;
    save(next); return next;
  });

  const toggleAgent = ag => {
    setForm(f=>{
      if(f.agents.includes(ag.name)) return { ...f, agents:f.agents.filter(a=>a!==ag.name) };
      if(f.agents.length>=5) return f;
      return { ...f, agents:[...f.agents, ag.name] };
    });
  };

  const create = () => {
    if(!form.agents.length) return;
    const c = { id:Date.now(), map:form.map, name:form.name||`${form.map} Comp`, agents:form.agents, players:form.players };
    setComps(p=>[...p,c]);
    setModal(false);
    setForm({ map:"Ascent", name:"", agents:[], players:["","","","",""] });
  };

  const del = id => { setDelConfirm(comps.find(c=>c.id===id)); };

  return (
    <div>
      <button className="btn btn-acc" style={{ marginBottom:18 }} onClick={()=>{ setForm({ map:"Ascent", name:"", agents:[], players:["","","","",""] }); setModal(true); }}>+ New Composition</button>
      {comps.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12, color:"var(--t3)" }}>⬡</div>
          <div className="bc" style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No Compositions Yet</div>
          <div style={{ color:"var(--t2)", fontSize:13 }}>Create a composition to define your agent picks per map</div>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:14 }}>
          {comps.map(c=>(
            <div key={c.id} className="card" style={{ position:"relative" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14, alignItems:"flex-start" }}>
                <div>
                  <span className="bc" style={{ fontSize:20, fontWeight:700, display:"block" }}>{c.name}</span>
                  <span className="chip chip-blue" style={{ marginTop:4 }}>{c.map}</span>
                </div>
                <button className="btn btn-red" style={{ fontSize:11 }} onClick={()=>del(c.id)}>✕</button>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {c.agents.map((ag,j)=>{
                  const agData = AGENTS.find(a=>a.name===ag);
                  return (
                    <div key={j} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <div style={{ width:44, height:44, borderRadius:"var(--r)", background:agData?.bg||"#141820", border:`1px solid ${agData?.color||"#333"}40`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13, color:agData?.color||"#888" }}>{ag.slice(0,3).toUpperCase()}</span>
                      </div>
                      <span style={{ fontSize:10, color:"var(--t2)", fontWeight:500 }}>{ag}</span>
                      {c.players[j] && <span style={{ fontSize:10, color:"var(--t3)" }}>{c.players[j]}</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid var(--b1)", display:"flex", gap:6, flexWrap:"wrap" }}>
                {c.agents.map(ag=>{
                  const agData = AGENTS.find(a=>a.name===ag);
                  return agData ? <span key={ag} className="chip" style={{ background:`${agData.color}18`, color:agData.color, border:`1px solid ${agData.color}30` }}>{agData.role}</span> : null;
                }).filter((v,i,a)=>a.findIndex(x=>x?.key===v?.key)===i)}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal onClose={()=>setModal(false)} title="New Composition">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Map</div><select value={form.map} onChange={e=>setForm(f=>({...f,map:e.target.value}))}>{MAPS.map(m=><option key={m}>{m}</option>)}</select></div>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Comp Name (optional)</div><input type="text" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Main Comp"/></div>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:8 }}>Pick Agents ({form.agents.length}/5)</div>
              {ROLES.map(role=>(
                <div key={role} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"var(--t3)", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>{role}</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {AGENTS.filter(a=>a.role===role).map(ag=>{
                      const picked = form.agents.includes(ag.name);
                      return (
                        <button key={ag.name} onClick={()=>toggleAgent(ag)} style={{ padding:"5px 10px", borderRadius:"var(--r)", fontSize:12, fontWeight:600, background:picked?`${ag.color}22`:"var(--s3)", border:`1px solid ${picked?ag.color:"var(--b2)"}`, color:picked?ag.color:"var(--t2)", cursor:"pointer", transition:"all 0.15s" }}>{ag.name}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {form.agents.length>0 && (
              <div>
                <div className="label-sm" style={{ marginBottom:8 }}>Assign Players (optional)</div>
                {form.agents.map((ag,i)=>(
                  <div key={ag} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                    <span style={{ width:80, fontSize:12, color:"var(--t2)" }}>{ag}</span>
                    <input type="text" value={form.players[i]||""} onChange={e=>setForm(f=>{ const p=[...f.players]; p[i]=e.target.value; return {...f,players:p}; })} placeholder="Player IGN" style={{ flex:1 }}/>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={create} disabled={form.agents.length===0}>Create Composition</button>
              <button className="btn btn-ghost" onClick={()=>setModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {delConfirm && (
        <Modal onClose={()=>setDelConfirm(null)} title="Delete Composition?">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.7 }}>Are you sure you want to delete <strong style={{ color:"var(--t1)" }}>"{delConfirm.name}"</strong>? This cannot be undone.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-red" style={{ flex:1, justifyContent:"center" }} onClick={()=>{ setComps(p=>p.filter(c=>c.id!==delConfirm.id)); setDelConfirm(null); }}>🗑 Yes, Delete</button>
              <button className="btn btn-ghost" onClick={()=>setDelConfirm(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ════════════════════════════════════════
   DATA ANALYSIS
════════════════════════════════════════ */
function DataAnalysis({ players=[] }) {
  const [tab, setTab] = useState("team");
  const playerData = players.map(p=>({
    ...p,
    acs:    Math.round(170+Math.random()*100),
    kd:     (0.85+Math.random()*0.8).toFixed(2),
    fk:     Math.round(1+Math.random()*6),
    clutch: Math.round(Math.random()*45),
    hs:     Math.round(20+Math.random()*30),
  }));

  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>DATA ANALYSIS</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Performance insights from tracked games</div>
      <div className="tab-bar" style={{ maxWidth:280, marginBottom:24 }}>
        <button className={`tab${tab==="team"?" on":""}`} onClick={()=>setTab("team")}>Team Stats</button>
        <button className={`tab${tab==="player"?" on":""}`} onClick={()=>setTab("player")}>Player Stats</button>
      </div>

      {tab==="team" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
            <StatBlock label="Overall Win Rate" value="—" sub="No games yet" accent/>
            <StatBlock label="Best Map"         value="—" sub="No data yet"/>
            <StatBlock label="Full Buy Win%"    value="—" sub="No data yet"/>
            <StatBlock label="Avg Rds Won"      value="—" sub="No data yet"/>
          </div>
          <div className="card" style={{ textAlign:"center", padding:"48px 20px" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>↗</div>
            <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>No Data Yet</div>
            <div style={{ color:"var(--t2)", fontSize:13 }}>Track games via the Live Tracker to generate stats</div>
          </div>
        </div>
      )}

      {tab==="player" && (
        <div className="card" style={{ padding:0, overflow:"hidden" }}>
          <table className="tbl">
            <thead><tr><th>Player</th><th>Role</th><th>ACS</th><th>K/D</th><th>First Kills</th><th>HS%</th><th>Clutch%</th></tr></thead>
            <tbody>
              {playerData.map(p=>{
                const kdc = parseFloat(p.kd)>=1.2?"var(--green)":parseFloat(p.kd)>=1.0?"var(--t1)":"var(--red)";
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:30, height:30, borderRadius:"50%", background:"var(--s3)", border:"1px solid var(--b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--acc)", flexShrink:0 }}>{p.av}</div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{p.name}</div>
                          <div className="mono" style={{ fontSize:10, color:"var(--t3)" }}>{p.ign}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="chip chip-blue">{p.role}</span></td>
                    <td><span className="bc" style={{ fontSize:22, fontWeight:900, color:p.acs>230?"var(--acc)":"var(--t1)" }}>{p.acs}</span></td>
                    <td><span className="mono" style={{ color:kdc, fontWeight:500 }}>{p.kd}</span></td>
                    <td><span className="mono">{p.fk}</span></td>
                    <td><div style={{ display:"flex", alignItems:"center", gap:8 }}><Bar pct={p.hs} color="var(--orange)"/><span className="mono" style={{ fontSize:11, width:30 }}>{p.hs}%</span></div></td>
                    <td><div style={{ display:"flex", alignItems:"center", gap:8 }}><Bar pct={p.clutch} color="var(--purple)"/><span className="mono" style={{ fontSize:11, width:30 }}>{p.clutch}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   VOD REVIEW — helpers
════════════════════════════════════════ */
function getEmbedUrl(url) {
  if (!url) return null;
  const params = "?rel=0&modestbranding=1";
  // Already an embed URL
  if (url.includes("youtube.com/embed/")) return url;
  // youtu.be short link  e.g. https://youtu.be/ABC123?si=xxx
  const short = url.match(/youtu\.be\/([^?&/]+)/);
  if (short) return `https://www.youtube.com/embed/${short[1]}${params}`;
  // Standard watch URL  e.g. https://www.youtube.com/watch?v=ABC123
  const watch = url.match(/[?&]v=([^&]+)/);
  if (watch) return `https://www.youtube.com/embed/${watch[1]}${params}`;
  // Live stream URL  e.g. https://www.youtube.com/live/ABC123?feature=share
  const live = url.match(/youtube\.com\/live\/([^?&/]+)/);
  if (live) return `https://www.youtube.com/embed/${live[1]}${params}`;
  // Shorts  e.g. https://www.youtube.com/shorts/ABC123
  const shorts = url.match(/youtube\.com\/shorts\/([^?&/]+)/);
  if (shorts) return `https://www.youtube.com/embed/${shorts[1]}${params}`;
  // Fallback: if it contains /embed/ anywhere just return it
  if (url.includes("/embed/")) return url;
  return null;
}

function fmt(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = Math.floor(secs%60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}

/* ─ Annotation Canvas (overlay on video) ─ */
const DRAW_COLORS = ["#d4ff1e","#ff5252","#4fc3f7","#69f0ae","#ffab40","#b39ddb","#ffffff"];
const DRAW_SIZES  = [2,4,8,14];
const DRAW_TOOLS  = ["pen","arrow","line","rect","circle","text","eraser"];
const TOOL_ICONS  = { pen:"✏️", arrow:"➜", line:"╱", rect:"▭", circle:"◯", text:"T", eraser:"⌫" };

function DrawCanvas({ strokes, onStrokes }) {
  const [tool,setTool]         = useState("pen");
  const [color,setColor]       = useState(DRAW_COLORS[0]);
  const [size,setSize]         = useState(DRAW_SIZES[1]);
  const [textInput,setTextInput] = useState("");
  const [textPos,setTextPos]   = useState(null);
  const realRef  = React.useRef(null);
  const drawing  = React.useRef(false);
  const cur      = React.useRef(null);

  const getPos = (e) => {
    const rect = realRef.current.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x:(cx-rect.left)*(realRef.current.width/rect.width), y:(cy-rect.top)*(realRef.current.height/rect.height) };
  };

  const paint = (ctx, s) => {
    ctx.save();
    ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
    ctx.lineWidth   = s.size;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.globalCompositeOperation = s.tool==="eraser" ? "destination-out" : "source-over";
    if (s.tool==="pen"||s.tool==="eraser") {
      ctx.beginPath(); s.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.stroke();
    } else if (s.tool==="line") {
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
    } else if (s.tool==="rect") {
      ctx.strokeRect(s.x1,s.y1,s.x2-s.x1,s.y2-s.y1);
    } else if (s.tool==="circle") {
      const rx=Math.abs(s.x2-s.x1)/2, ry=Math.abs(s.y2-s.y1)/2;
      ctx.beginPath(); ctx.ellipse((s.x1+s.x2)/2,(s.y1+s.y2)/2,rx,ry,0,0,Math.PI*2); ctx.stroke();
    } else if (s.tool==="arrow") {
      const dx=s.x2-s.x1, dy=s.y2-s.y1, ang=Math.atan2(dy,dx);
      const hl = Math.min(28, Math.sqrt(dx*dx+dy*dy)*0.35);
      ctx.beginPath();
      ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2);
      ctx.lineTo(s.x2-hl*Math.cos(ang-0.45),s.y2-hl*Math.sin(ang-0.45));
      ctx.moveTo(s.x2,s.y2);
      ctx.lineTo(s.x2-hl*Math.cos(ang+0.45),s.y2-hl*Math.sin(ang+0.45));
      ctx.stroke();
    } else if (s.tool==="text") {
      const fs = Math.max(14, s.size*3);
      ctx.font = `bold ${fs}px 'Barlow Condensed', sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
      ctx.fillText(s.text, s.x1, s.y1);
    }
    ctx.restore();
  };

  const redraw = (ss) => {
    const c = realRef.current; if(!c) return;
    const ctx = c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height);
    ss.forEach(s=>paint(ctx,s));
  };

  React.useEffect(()=>{ redraw(strokes); }, [strokes]);

  const onDown = (e) => {
    if(tool==="text") return; // text is handled on click
    e.preventDefault(); drawing.current=true;
    const p=getPos(e);
    cur.current = (tool==="pen"||tool==="eraser") ? {tool,color,size,pts:[p]} : {tool,color,size,x1:p.x,y1:p.y,x2:p.x,y2:p.y};
  };
  const onMove = (e) => {
    if(!drawing.current||!cur.current) return; e.preventDefault();
    const p=getPos(e);
    if(tool==="pen"||tool==="eraser") { cur.current.pts.push(p); }
    else { cur.current.x2=p.x; cur.current.y2=p.y; }
    redraw(strokes);
    paint(realRef.current.getContext("2d"), cur.current);
  };
  const onUp = () => {
    if(!drawing.current||!cur.current) return;
    drawing.current=false;
    onStrokes([...strokes, cur.current]);
    cur.current=null;
  };
  const onClick = (e) => {
    if(tool!=="text") return;
    const p=getPos(e);
    setTextPos(p);
    setTextInput("");
  };
  const commitText = () => {
    if(!textInput.trim()||!textPos) return;
    onStrokes([...strokes, { tool:"text", color, size, x1:textPos.x, y1:textPos.y, text:textInput.trim() }]);
    setTextPos(null); setTextInput("");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"#050709" }}>
      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", background:"rgba(13,16,24,0.95)", borderBottom:"1px solid var(--b1)", flexWrap:"wrap" }}>
        {/* Tools */}
        <div style={{ display:"flex", gap:3 }}>
          {DRAW_TOOLS.map(t=>(
            <button key={t} onClick={()=>{ setTool(t); setTextPos(null); }} title={t}
              style={{ width:32, height:32, borderRadius:"var(--r)", border:`1px solid ${tool===t?"var(--acc)":"var(--b2)"}`,
                background:tool===t?"rgba(212,255,30,0.15)":"var(--s2)", color:tool===t?"var(--acc)":"var(--t2)",
                fontSize:t==="text"?13:12, fontWeight:700, cursor:"pointer", transition:"all 0.1s" }}>
              {TOOL_ICONS[t]}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:22, background:"var(--b2)" }}/>

        {/* Colors */}
        <div style={{ display:"flex", gap:4 }}>
          {DRAW_COLORS.map(c=>(
            <button key={c} onClick={()=>setColor(c)}
              style={{ width:22, height:22, borderRadius:4, background:c,
                border:`2px solid ${color===c?"#fff":"transparent"}`,
                boxShadow:color===c?`0 0 0 1px ${c}`:"none", cursor:"pointer", transition:"all 0.1s" }}/>
          ))}
        </div>

        <div style={{ width:1, height:22, background:"var(--b2)" }}/>

        {/* Stroke size */}
        <div style={{ display:"flex", gap:5, alignItems:"center" }}>
          {DRAW_SIZES.map(s=>(
            <button key={s} onClick={()=>setSize(s)}
              style={{ width:s===2?14:s===4?18:s===8?22:26, height:s===2?14:s===4?18:s===8?22:26,
                borderRadius:"50%", background:size===s?"var(--acc)":"var(--s3)",
                border:`1px solid ${size===s?"var(--acc)":"var(--b2)"}`, cursor:"pointer", transition:"all 0.1s" }}/>
          ))}
        </div>

        <div style={{ flex:1 }}/>

        <div style={{ display:"flex", gap:6 }}>
          {strokes.length>0 && (
            <button onClick={()=>onStrokes(strokes.slice(0,-1))}
              style={{ background:"var(--s2)", border:"1px solid var(--b2)", color:"var(--t2)", borderRadius:"var(--r)", padding:"5px 12px", fontSize:11, cursor:"pointer" }}>
              ↩ Undo
            </button>
          )}
          <button onClick={()=>{ onStrokes([]); setTextPos(null); }}
            style={{ background:"rgba(255,82,82,0.1)", border:"1px solid rgba(255,82,82,0.25)", color:"var(--red)", borderRadius:"var(--r)", padding:"5px 12px", fontSize:11, cursor:"pointer" }}>
            Clear All
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        <canvas ref={realRef} width={1280} height={720}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          onClick={onClick}
          style={{ width:"100%", height:"100%", cursor:tool==="eraser"?"cell":tool==="text"?"text":"crosshair", touchAction:"none", display:"block" }}
        />

        {/* Text input popup */}
        {textPos && (
          <div style={{ position:"absolute", top:"40%", left:"50%", transform:"translate(-50%,-50%)", zIndex:10,
            background:"var(--s1)", border:"1px solid var(--acc)", borderRadius:"var(--r2)", padding:"14px 16px", minWidth:260, boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
            <div className="label-sm" style={{ marginBottom:8, color:"var(--acc)" }}>Add Text Label</div>
            <input autoFocus type="text" value={textInput} onChange={e=>setTextInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") commitText(); if(e.key==="Escape") setTextPos(null); }}
              placeholder="Type label..." style={{ marginBottom:10 }}/>
            <div style={{ display:"flex", gap:6 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center", fontSize:12 }} onClick={commitText}>Place</button>
              <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={()=>setTextPos(null)}>Cancel</button>
            </div>
          </div>
        )}

        {strokes.length===0 && !textPos && (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
            <div style={{ color:"var(--t3)", fontSize:12, textAlign:"center", background:"rgba(0,0,0,0.5)", padding:"16px 24px", borderRadius:"var(--r2)" }}>
              <div style={{ fontSize:28, marginBottom:6 }}>✏️</div>
              <div style={{ fontWeight:600, marginBottom:4 }}>Annotation Canvas</div>
              <div style={{ fontSize:11, color:"var(--t3)" }}>Draw over this frame using the tools above</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   VOD REVIEW
════════════════════════════════════════ */
function VodReview() {
  const STORAGE_KEY = "ticra_vods_v2";
  const load = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]"); } catch{ return []; } };

  const [vods, setVodsRaw]              = useState(load);
  const [selId, setSelId]               = useState(null);
  const [showNew, setShowNew]           = useState(false);
  const [activeFolder, setActiveFolder] = useState("All");
  const [newForm, setNewForm]           = useState({ title:"", folder:"Scrims", url:"" });
  const [selTsId, setSelTsId]           = useState(null);
  const [activeTab, setActiveTab]       = useState("notes");
  const [showAddTs, setShowAddTs]       = useState(false);
  const [tsForm, setTsForm]             = useState({ time:"0:00", label:"", cat:"Rotation" });
  const [urlInput, setUrlInput]         = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showAnnotate, setShowAnnotate] = useState(false);

  const FOLDERS   = ["All","Scrims","Opponent Analysis","Officials"];
  const TS_COLORS = { "Rotation":"#4fc3f7","Util Usage":"#b39ddb","Mistake":"#ff5252","Win Cond":"#69f0ae","General":"#ffab40" };

  const setVods = (fn) => {
    setVodsRaw(prev => {
      const next = typeof fn === "function" ? fn(prev) : fn;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch{}
      return next;
    });
  };

  const filteredVods = activeFolder==="All" ? vods : vods.filter(v=>v.folder===activeFolder);
  const sel   = vods.find(v=>v.id===selId) || null;
  const selTs = sel?.ts.find(t=>t.id===selTsId) || null;

  const mutateVod = (id, fn) => setVods(vs=>vs.map(v=>v.id===id?fn(v):v));
  const mutateTs  = (tsId, fn) => { if(!sel) return; mutateVod(sel.id, v=>({ ...v, ts:v.ts.map(t=>t.id===tsId?fn(t):t) })); };

  const addVod = () => {
    if(!newForm.title.trim()) return;
    const v = { id:Date.now(), title:newForm.title, folder:newForm.folder, url:newForm.url.trim(), ts:[], createdAt:new Date().toLocaleDateString() };
    setVods(p=>[...p,v]); setSelId(v.id); setUrlInput(v.url);
    setShowNew(false); setNewForm({ title:"", folder:"Scrims", url:"" });
  };

  const deleteVod = (id) => {
    setVods(vs=>vs.filter(v=>v.id!==id));
    if(selId===id) { setSelId(null); setSelTsId(null); }
    setDeleteConfirm(null);
  };

  const applyUrl = () => { if(!sel) return; mutateVod(sel.id, v=>({...v, url:urlInput.trim()})); };

  const openAddTs = () => { setTsForm({ time:"0:00", label:"", cat:"Rotation" }); setShowAddTs(true); };

  const confirmAddTs = () => {
    if(!tsForm.label.trim()||!sel) return;
    const parts = tsForm.time.split(":").map(Number);
    const secs  = parts.length===3 ? parts[0]*3600+parts[1]*60+parts[2] : (parts[0]||0)*60+(parts[1]||0);
    const ts = { id:Date.now(), time:fmt(secs), secs, label:tsForm.label.trim(), cat:tsForm.cat, note:"", strokes:[] };
    mutateVod(sel.id, v=>({ ...v, ts:[...v.ts, ts].sort((a,b)=>a.secs-b.secs) }));
    setSelTsId(ts.id); setActiveTab("notes");
    setShowAddTs(false);
  };

  const deleteTs = (tsId) => {
    if(!sel) return;
    mutateVod(sel.id, v=>({...v, ts:v.ts.filter(t=>t.id!==tsId)}));
    if(selTsId===tsId) setSelTsId(null);
    setDeleteConfirm(null);
  };

  const updateNote    = (tsId, note)    => mutateTs(tsId, t=>({...t,note}));
  const updateStrokes = (tsId, strokes) => mutateTs(tsId, t=>({...t,strokes}));

  React.useEffect(()=>{ setUrlInput(sel?.url||""); setSelTsId(null); setShowAnnotate(false); }, [selId]);

  const embedUrl = sel ? getEmbedUrl(sel.url) : null;
  const tsEmbedUrl = (ts) => {
    if(!sel?.url) return null;
    const base = getEmbedUrl(sel.url);
    return base ? `${base}&start=${ts.secs}&autoplay=1` : null;
  };

  return (
    <div style={{ padding:"28px 32px 0", height:"calc(100vh - 60px)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>VOD REVIEW</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>Annotate and discuss recordings with your team</div>
        </div>
        <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"210px 1fr", gap:18, flex:1, minHeight:0, overflow:"hidden" }}>
        {/* Sidebar */}
        <div style={{ display:"flex", flexDirection:"column", overflowY:"auto" }}>
          <div className="label-sm" style={{ marginBottom:8 }}>Folders</div>
          {FOLDERS.map(f=>(
            <div key={f} onClick={()=>setActiveFolder(f)} style={{ padding:"7px 10px", borderRadius:"var(--r)", cursor:"pointer", marginBottom:3, fontSize:13,
              color:activeFolder===f?"var(--t1)":"var(--t2)", background:activeFolder===f?"var(--s3)":"transparent" }}>
              📁 {f}
            </div>
          ))}
          <Divider/>
          <div className="label-sm" style={{ marginBottom:8 }}>Reviews</div>
          {filteredVods.length===0
            ? <div style={{ color:"var(--t3)", fontSize:12, padding:"4px 0" }}>No reviews yet.</div>
            : filteredVods.map(v=>(
              <div key={v.id} style={{ position:"relative", marginBottom:5 }}>
                <div onClick={()=>setSelId(v.id)} style={{ padding:"10px 11px", paddingRight:32, borderRadius:"var(--r2)", cursor:"pointer",
                  background:selId===v.id?"var(--s3)":"var(--s1)", border:`1px solid ${selId===v.id?"var(--b3)":"var(--b1)"}`, transition:"all 0.15s" }}>
                  <div style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{v.title}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ fontSize:10, color:"var(--t3)" }}>{v.ts.length} timestamps</span>
                    <span style={{ fontSize:10, color:"var(--t3)" }}>· {v.folder}</span>
                  </div>
                </div>
                <button onClick={e=>{ e.stopPropagation(); setDeleteConfirm({type:"vod",id:v.id,label:v.title}); }}
                  style={{ position:"absolute", top:8, right:8, background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:15, padding:"2px 4px", borderRadius:4 }}>✕</button>
              </div>
            ))
          }
        </div>

        {/* Main area */}
        {sel ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10, minWidth:0, minHeight:0, overflowY:"auto", paddingBottom:20 }}>

            {/* Title + action bar */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r2)", padding:"10px 16px", flexShrink:0 }}>
              <span className="bc" style={{ fontSize:18, fontWeight:700 }}>{sel.title}</span>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn btn-acc" style={{ fontSize:11 }} onClick={openAddTs}>+ Timestamp</button>
                <button className="btn btn-red" style={{ fontSize:11 }} onClick={()=>setDeleteConfirm({type:"vod",id:sel.id,label:sel.title})}>🗑 Delete</button>
              </div>
            </div>

            {/* Video — 16:9 */}
            <div style={{ flexShrink:0 }}>
              <div style={{ position:"relative", width:"100%", paddingTop:"56.25%", background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:10, overflow:"hidden" }}>
                <div style={{ position:"absolute", inset:0 }}>
                  {embedUrl
                    ? <iframe key={selTs ? `ts-${selTs.id}` : embedUrl}
                        src={selTs ? (tsEmbedUrl(selTs)||embedUrl) : embedUrl}
                        width="100%" height="100%"
                        style={{ border:"none", display:"block" }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
                    : <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, color:"var(--t3)" }}>
                        <div style={{ fontSize:40 }}>▶</div>
                        <div style={{ fontSize:13 }}>No video — paste a YouTube URL below</div>
                      </div>
                  }
                </div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <input type="text" placeholder="YouTube URL (e.g. https://youtu.be/...)" value={urlInput}
                  onChange={e=>setUrlInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") applyUrl(); }} style={{ flex:1 }}/>
                <button className="btn btn-sub" onClick={applyUrl}>Load</button>
              </div>
            </div>

            {/* Timestamps + Notes panel */}
            <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:10, minHeight:300 }}>
              {/* Timestamp list */}
              <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
                <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--b1)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                  <span className="label-sm">Timestamps ({sel.ts.length})</span>
                  <button onClick={openAddTs} style={{ fontSize:10, fontWeight:700, color:"var(--acc)", background:"rgba(212,255,30,0.1)", border:"1px solid rgba(212,255,30,0.2)", borderRadius:4, padding:"2px 8px", cursor:"pointer" }}>+ ADD</button>
                </div>
                <div style={{ flex:1, overflowY:"auto" }}>
                  {sel.ts.length===0
                    ? <div style={{ color:"var(--t3)", fontSize:12, padding:"16px 14px", lineHeight:1.7 }}>No timestamps yet.<br/>Click <strong style={{ color:"var(--acc)" }}>+ Timestamp</strong> above.</div>
                    : sel.ts.map(t=>(
                      <div key={t.id} onClick={()=>{ setSelTsId(t.id); setActiveTab("notes"); }}
                        style={{ padding:"10px 12px", cursor:"pointer", borderBottom:"1px solid var(--b1)",
                          background:selTsId===t.id?"var(--s3)":"transparent",
                          borderLeft:`3px solid ${selTsId===t.id?(TS_COLORS[t.cat]||"var(--acc)"):"transparent"}`, transition:"all 0.1s" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <span style={{ fontFamily:"'JetBrains Mono'", fontSize:11, color:TS_COLORS[t.cat]||"var(--acc)", fontWeight:700 }}>{t.time}</span>
                            <div style={{ fontSize:12, color:"var(--t1)", marginTop:2, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.label}</div>
                            <span style={{ fontSize:10, color:TS_COLORS[t.cat]||"var(--t3)" }}>{t.cat}</span>
                          </div>
                          <button onClick={e=>{ e.stopPropagation(); setDeleteConfirm({type:"ts",id:t.id,label:t.label}); }}
                            style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:15, padding:"0 4px", flexShrink:0 }}>×</button>
                        </div>
                        {t.note && <div style={{ fontSize:10, color:"var(--t2)", marginTop:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>📝 {t.note}</div>}
                        {t.strokes?.length>0 && <div style={{ fontSize:10, color:"var(--acc)", marginTop:2 }}>✏ {t.strokes.length} drawing{t.strokes.length!==1?"s":""}</div>}
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Notes / Draw panel */}
              {selTs ? (
                <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)", overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  <div style={{ display:"flex", borderBottom:"1px solid var(--b1)", padding:"12px 14px", alignItems:"center", gap:8, flexShrink:0 }}>
                    <span style={{ fontFamily:"'JetBrains Mono'", fontSize:12, color:TS_COLORS[selTs.cat]||"var(--acc)", fontWeight:700 }}>{selTs.time}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:"var(--t1)", marginRight:"auto" }}>{selTs.label}</span>
                    <span className="chip" style={{ background:`${TS_COLORS[selTs.cat]||"#888"}18`, color:TS_COLORS[selTs.cat]||"var(--t2)", border:`1px solid ${TS_COLORS[selTs.cat]||"var(--b2)"}30` }}>{selTs.cat}</span>
                  </div>
                  <div style={{ flex:1, display:"flex", flexDirection:"column", padding:16, gap:10 }}>
                    <textarea value={selTs.note} onChange={e=>updateNote(selTs.id, e.target.value)}
                      placeholder="Add your observations, callouts, feedback for this moment..."
                      style={{ flex:1, resize:"none", minHeight:180, lineHeight:1.75, padding:12, fontSize:13,
                        background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:"var(--r)", color:"var(--t1)", fontFamily:"'Barlow',sans-serif" }}/>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ fontSize:11, color:"var(--t3)" }}>{selTs.note.length} chars</span>
                      <span style={{ fontSize:11, color:"var(--green)" }}>✓ Saved automatically</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:"var(--r3)", display:"flex", alignItems:"center", justifyContent:"center", minHeight:300 }}>
                  <div style={{ textAlign:"center", color:"var(--t3)" }}>
                    <div style={{ fontSize:32, marginBottom:10 }}>←</div>
                    <div style={{ fontSize:13, marginBottom:6 }}>Select a timestamp to write notes or draw</div>
                    <div style={{ fontSize:11 }}>Use <strong style={{ color:"var(--acc)" }}>✏️ Annotate</strong> to draw over the video</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300 }}>
            <div style={{ textAlign:"center", color:"var(--t3)" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>▶</div>
              <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8, color:"var(--t2)" }}>No Review Selected</div>
              <div style={{ fontSize:13, marginBottom:20 }}>Create a new review or select one from the sidebar</div>
              <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <Modal onClose={()=>setShowNew(false)} title="New VOD Review">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div>
              <input autoFocus type="text" value={newForm.title} onChange={e=>setNewForm(f=>({...f,title:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&addVod()} placeholder="e.g. NRG vs LOUD — Ascent Review"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Folder</div>
              <select value={newForm.folder} onChange={e=>setNewForm(f=>({...f,folder:e.target.value}))}>
                {FOLDERS.filter(f=>f!=="All").map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>YouTube URL (optional)</div>
              <input type="text" value={newForm.url} onChange={e=>setNewForm(f=>({...f,url:e.target.value}))} placeholder="https://youtu.be/..."/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addVod}>Create Review</button>
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {showAddTs && (
        <Modal onClose={()=>setShowAddTs(false)} title="Add Timestamp">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:"var(--r2)", padding:"14px 16px", textAlign:"center" }}>
              <div className="label-sm" style={{ marginBottom:6 }}>Current Video Time</div>
              <div style={{ fontFamily:"'JetBrains Mono'", fontSize:32, fontWeight:700, color:"var(--acc)", marginBottom:8, letterSpacing:"0.05em" }}>{tsForm.time}</div>
              <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
                {[0,15,30,60,90,120,180,300].map(s=>(
                  <button key={s} onClick={()=>setTsForm(f=>({...f,time:fmt(s)}))}
                    style={{ padding:"3px 10px", borderRadius:"var(--r)", fontSize:11, fontWeight:600, background:"var(--s3)", border:"1px solid var(--b2)", color:"var(--t2)", cursor:"pointer" }}>
                    {fmt(s)}
                  </button>
                ))}
              </div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:8 }}>Pick a preset or type the time manually below · Pause your video first!</div>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Time (m:ss or h:mm:ss)</div>
              <input autoFocus type="text" value={tsForm.time} onChange={e=>setTsForm(f=>({...f,time:e.target.value}))} placeholder="e.g. 1:23 or 12:45"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Label</div>
              <input type="text" value={tsForm.label} onChange={e=>setTsForm(f=>({...f,label:e.target.value}))}
                onKeyDown={e=>e.key==="Enter"&&confirmAddTs()} placeholder="Describe this moment..."/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Category</div>
              <select value={tsForm.cat} onChange={e=>setTsForm(f=>({...f,cat:e.target.value}))}>
                {Object.keys(TS_COLORS).map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={confirmAddTs} disabled={!tsForm.label.trim()}>Add Timestamp</button>
              <button className="btn btn-ghost" onClick={()=>setShowAddTs(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal onClose={()=>setDeleteConfirm(null)} title="Confirm Delete">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ fontSize:13, color:"var(--t2)", lineHeight:1.7 }}>
              Are you sure you want to delete <strong style={{ color:"var(--t1)" }}>"{deleteConfirm.label}"</strong>?
              {deleteConfirm.type==="vod" && <span> This will remove the review and all its timestamps permanently.</span>}
              <br/>This cannot be undone.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-red" style={{ flex:1, justifyContent:"center" }}
                onClick={()=>deleteConfirm.type==="vod" ? deleteVod(deleteConfirm.id) : deleteTs(deleteConfirm.id)}>
                🗑 Yes, Delete
              </button>
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


/* ════════════════════════════════════════
   TASKS
════════════════════════════════════════ */
function Tasks({ players, setPlayers }) {
  const [tasks, setTasks]             = useState({});
  const [labels, setLabels]           = useState([]);
  const [taskModal, setTaskModal]     = useState(false);
  const [playerModal, setPlayerModal] = useState(false);
  const [labelModal, setLabelModal]   = useState(false);
  const [pForm, setPForm]             = useState({ name:"", ign:"", role:"" });
  const [lForm, setLForm]             = useState({ name:"", color: LABEL_COLORS[0] });
  const [form, setForm]               = useState({ title:"", desc:"", due:"", assignedTo:"", labels:[] });

  // Load labels + tasks from API on mount
  useEffect(()=>{
    api.get("/api/labels").then(d=>{ if(Array.isArray(d)) setLabels(d); }).catch(()=>{});
    api.get("/api/tasks").then(d=>{
      if(Array.isArray(d)){
        const byPlayer = {};
        d.forEach(t=>{ if(!byPlayer[t.player_id]) byPlayer[t.player_id]=[]; byPlayer[t.player_id].push({...t, labels:JSON.parse(t.labels||"[]")}); });
        setTasks(byPlayer);
      }
    }).catch(()=>{});
  },[]);

  const pending = Object.values(tasks).flatMap(t=>t).filter(t=>!t.done).length;

  const toggle = (pid,tid) => {
    const task = (tasks[pid]||[]).find(t=>t.id===tid);
    if(!task) return;
    const done = !task.done;
    api.put(`/api/tasks/${tid}`, { done }).catch(()=>{});
    setTasks(p=>({ ...p, [pid]:(p[pid]||[]).map(t=>t.id===tid?{...t,done}:t) }));
  };

  const addTask = () => {
    if(!form.title.trim() || !form.assignedTo) return;
    const pid = Number(form.assignedTo);
    api.post("/api/tasks", { ...form, player_id:pid, labels:JSON.stringify(form.labels) })
      .then(d=>{ setTasks(p=>({ ...p, [pid]:[...(p[pid]||[]), {...d, labels:form.labels}] })); })
      .catch(()=>{ setTasks(p=>({ ...p, [pid]:[...(p[pid]||[]), { id:Date.now(), ...form, done:false }] })); });
    setTaskModal(false);
    setForm({ title:"", desc:"", due:"", assignedTo:"", labels:[] });
  };

  const addPlayer = () => {
    if(!pForm.name.trim()) return;
    const av = pForm.name.slice(0,2).toUpperCase();
    api.post("/api/players", { ...pForm, av })
      .then(d=>{ setPlayers(prev=>[...prev, d]); setTasks(p=>({ ...p, [d.id]:[] })); })
      .catch(()=>{ const id=Date.now(); setPlayers(prev=>[...prev,{id,...pForm,av}]); setTasks(p=>({...p,[id]:[]})); });
    setPForm({ name:"", ign:"", role:"" });
    setPlayerModal(false);
  };

  const addLabel = () => {
    if(!lForm.name.trim()) return;
    api.post("/api/labels", lForm)
      .then(d=>{ setLabels(prev=>[...prev, d]); })
      .catch(()=>{ setLabels(prev=>[...prev, { name:lForm.name.trim(), color:lForm.color }]); });
    setLForm({ name:"", color: LABEL_COLORS[0] });
    setLabelModal(false);
  };

  const removeLabel = name => {
    api.delete(`/api/labels/${encodeURIComponent(name)}`).catch(()=>{});
    setLabels(prev=>prev.filter(l=>l.name!==name));
    setTasks(p=>{ const next={...p}; Object.keys(next).forEach(pid=>{ next[pid]=next[pid].map(t=>({...t,labels:t.labels.filter(l=>l!==name)})); }); return next; });
  };

  const removePlayer = pid => {
    api.delete(`/api/players/${pid}`).catch(()=>{});
    setPlayers(prev=>prev.filter(p=>p.id!==pid));
    setTasks(p=>{ const next={...p}; delete next[pid]; return next; });
  };

  const hex2rgba = (hex, a) => {
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>TASKS</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>{pending} pending tasks across the team</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost" onClick={()=>setLabelModal(true)}>⊕ Labels{labels.length>0?` (${labels.length})`:""}</button>
          <button className="btn btn-sub" onClick={()=>setPlayerModal(true)}>+ Add Player</button>
          <button className="btn btn-acc" onClick={()=>setTaskModal(true)} disabled={players.length===0} style={{ opacity:players.length===0?0.45:1 }}>+ Add Task</button>
        </div>
      </div>

      {players.length === 0 ? (
        <div className="card" style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>☑</div>
          <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8 }}>No Players Yet</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Add your team members first, then start assigning tasks</div>
          <button className="btn btn-acc" onClick={()=>setPlayerModal(true)}>+ Add Player</button>
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
                  <span style={{ background:"var(--s3)", border:"1px solid var(--b2)", borderRadius:10, padding:"1px 8px", fontSize:11, fontWeight:700 }}>
                    {(tasks[p.id]||[]).filter(t=>!t.done).length}
                  </span>
                  <button onClick={()=>removePlayer(p.id)} style={{ background:"transparent", border:"none", color:"var(--t3)", cursor:"pointer", fontSize:13, lineHeight:1, padding:"2px 4px", borderRadius:4 }} title="Remove player">✕</button>
                </div>
              </div>
              <div style={{ flex:1, padding:"8px 0", minHeight:80 }}>
                {(tasks[p.id]||[]).length === 0 && (
                  <div style={{ textAlign:"center", color:"var(--t3)", fontSize:11, padding:"20px 10px" }}>No tasks yet</div>
                )}
                {(tasks[p.id]||[]).map(t=>(
                  <div key={t.id} className="ktask" onClick={()=>toggle(p.id,t.id)}>
                    <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                      <div style={{ width:15, height:15, borderRadius:4, flexShrink:0, marginTop:1, transition:"all 0.15s",
                        background:t.done?"var(--acc)":"transparent", border:`1px solid ${t.done?"var(--acc)":"var(--b3)"}`,
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {t.done && <span style={{ fontSize:9, color:"#080a10", fontWeight:700 }}>✓</span>}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:500, lineHeight:1.4, marginBottom:5, textDecoration:t.done?"line-through":"none", color:t.done?"var(--t3)":"var(--t1)" }}>{t.title}</div>
                        {t.labels.length>0 && (
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                            {t.labels.map(lname=>{
                              const lb = labels.find(l=>l.name===lname);
                              if(!lb) return null;
                              return <span key={lname} style={{ padding:"1px 6px", borderRadius:3, fontSize:10, fontWeight:600, background:hex2rgba(lb.color,0.12), color:lb.color, border:`1px solid ${hex2rgba(lb.color,0.25)}` }}>{lname}</span>;
                            })}
                          </div>
                        )}
                        {t.due && <div style={{ fontSize:10, color:"var(--t3)" }}>Due {t.due}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Task Modal */}
      {taskModal && (
        <Modal onClose={()=>setTaskModal(false)} title="New Task">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <div className="label-sm" style={{ marginBottom:6 }}>Assigned To</div>
              <select value={form.assignedTo} onChange={e=>setForm(f=>({...f,assignedTo:e.target.value}))}>
                <option value="">— Select player —</option>
                {players.map(p=><option key={p.id} value={p.id}>{p.name}{p.role?` · ${p.role}`:""}</option>)}
              </select>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Task title"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Description</div><textarea rows={2} style={{ resize:"none" }} value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Due Date</div><input type="date" value={form.due} onChange={e=>setForm(f=>({...f,due:e.target.value}))}/></div>
            {labels.length > 0 && (
              <div>
                <div className="label-sm" style={{ marginBottom:8 }}>Labels</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {labels.map(lb=>{
                    const on = form.labels.includes(lb.name);
                    return (
                      <button key={lb.name} onClick={()=>setForm(f=>({ ...f, labels:on?f.labels.filter(x=>x!==lb.name):[...f.labels,lb.name] }))}
                        style={{ padding:"4px 10px", borderRadius:5, fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s",
                          background:on?hex2rgba(lb.color,0.12):"var(--s3)",
                          color:on?lb.color:"var(--t3)",
                          border:`1px solid ${on?hex2rgba(lb.color,0.3):"var(--b2)"}` }}>
                        {lb.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addTask} disabled={!form.title.trim()||!form.assignedTo}>Create Task</button>
              <button className="btn btn-ghost" onClick={()=>setTaskModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Labels Modal */}
      {labelModal && (
        <Modal onClose={()=>setLabelModal(false)} title="Manage Labels">
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {labels.length > 0 && (
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
            <div style={{ display:"flex", gap:10 }}>
              <input type="text" value={lForm.name} onChange={e=>setLForm(f=>({...f,name:e.target.value}))} placeholder="Label name" style={{ flex:1 }}/>
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom:8 }}>Color</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {LABEL_COLORS.map(c=>(
                  <button key={c} onClick={()=>setLForm(f=>({...f,color:c}))}
                    style={{ width:28, height:28, borderRadius:6, background:c, border:`2px solid ${lForm.color===c?"#fff":"transparent"}`, cursor:"pointer", transition:"all 0.15s", outline:"none" }}/>
                ))}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addLabel} disabled={!lForm.name.trim()}>Create Label</button>
              <button className="btn btn-ghost" onClick={()=>setLabelModal(false)}>Done</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Player Modal */}
      {playerModal && (
        <Modal onClose={()=>setPlayerModal(false)} title="Add Player">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Name</div><input type="text" value={pForm.name} onChange={e=>setPForm(f=>({...f,name:e.target.value}))} placeholder="Player name"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>IGN (optional)</div><input type="text" value={pForm.ign} onChange={e=>setPForm(f=>({...f,ign:e.target.value}))} placeholder="name#tag"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Role (optional)</div><input type="text" value={pForm.role} onChange={e=>setPForm(f=>({...f,role:e.target.value}))} placeholder="e.g. IGL, Entry, Flex"/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addPlayer}>Add Player</button>
              <button className="btn btn-ghost" onClick={()=>setPlayerModal(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   CALENDAR
════════════════════════════════════════ */
function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [week, setWeek]     = useState(0);
  const [modal, setModal]   = useState(null);
  const [form, setForm]     = useState({ title:"", time:"18:00", cat:"Scrim" });

  const getWeekDays = offset => {
    const base  = new Date(2025,1,17);
    const start = new Date(base);
    const dow   = base.getDay();
    start.setDate(base.getDate()-(dow===0?6:dow-1)+offset*7);
    return Array.from({length:7},(_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });
  };

  const days    = getWeekDays(week);
  const DAYS    = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const fmt     = d => `2025-02-${String(d.getDate()).padStart(2,"0")}`;
  const weekLbl = `Feb ${days[0].getDate()}–${days[6].getDate()}, 2025`;

  const addEvent = date => {
    if(!form.title.trim()) return;
    setEvents(p=>[...p, { id:Date.now(), ...form, date, color:CAT_COLORS[form.cat]||"#8892aa" }]);
    setModal(null);
    setForm({ title:"", time:"18:00", cat:"Scrim" });
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>CALENDAR</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>{weekLbl}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost" onClick={()=>setWeek(w=>w-1)}>← Prev</button>
          <button className="btn btn-ghost" onClick={()=>setWeek(0)}>Today</button>
          <button className="btn btn-ghost" onClick={()=>setWeek(w=>w+1)}>Next →</button>
          <button className="btn btn-acc" onClick={()=>setModal("manual")}>+ New Event</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:16, marginBottom:14 }}>
        {Object.entries(CAT_COLORS).map(([cat,color])=>(
          <div key={cat} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--t2)" }}>
            <div style={{ width:9, height:9, borderRadius:2, background:color }}/>
            {cat}
          </div>
        ))}
      </div>

      <div style={{ background:"var(--s1)", border:"1px solid var(--b1)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:"1px solid var(--b1)" }}>
          {days.map((d,i)=>{
            const isToday = fmt(d)==="2025-02-18";
            return (
              <div key={i} style={{ padding:"10px", textAlign:"center", background:"var(--s2)", borderRight:i<6?"1px solid var(--b1)":"none" }}>
                <div className="label-sm" style={{ marginBottom:4 }}>{DAYS[i]}</div>
                <div className="bc" style={{ fontSize:24, fontWeight:900, color:isToday?"var(--acc)":"var(--t1)" }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
          {days.map((d,i)=>{
            const ds = fmt(d);
            const dayEvents = events.filter(e=>e.date===ds);
            return (
              <div key={i} className="cal-cell" style={{ borderRight:i<6?"1px solid var(--b1)":"none" }} onClick={()=>setModal(ds)}>
                {dayEvents.map(ev=>(
                  <div key={ev.id} className="cal-ev" style={{ background:ev.color+"20", color:ev.color, border:`1px solid ${ev.color}28` }} onClick={e=>e.stopPropagation()}>
                    <span style={{ opacity:0.65, fontSize:10, marginRight:4 }}>{ev.time}</span>{ev.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <Modal onClose={()=>setModal(null)} title={modal==="manual"?"New Event":`New Event — Feb ${modal.split("-")[2]}`}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Event title"/></div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Time</div><input type="text" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))} placeholder="19:00"/></div>
              <div><div className="label-sm" style={{ marginBottom:6 }}>Category</div>
                <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}>
                  {Object.keys(CAT_COLORS).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={()=>addEvent(modal==="manual"?"2025-02-18":modal)}>Create Event</button>
              <button className="btn btn-ghost" onClick={()=>setModal(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
