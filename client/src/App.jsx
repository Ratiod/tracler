import { useState, useEffect } from "react";

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
  { name:"Jett",    color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"Raze",    color:"#ffab40", bg:"#2b1a08" },
  { name:"Sage",    color:"#69f0ae", bg:"#0a1e16" },
  { name:"Sova",    color:"#b39ddb", bg:"#1a1428" },
  { name:"Omen",    color:"#8892aa", bg:"#141820" },
  { name:"Killjoy", color:"#d4ff1e", bg:"#1e2408" },
  { name:"Cypher",  color:"#c8d0e0", bg:"#161c28" },
  { name:"Neon",    color:"#4fc3f7", bg:"#0b1e2b" },
  { name:"Fade",    color:"#d4b0ff", bg:"#1c0e2e" },
  { name:"Gekko",   color:"#a3e84f", bg:"#182010" },
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
  const [stratTab, setStratTab] = useState("raw");
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
    { key:"raw",          label:"Raw Database" },
    { key:"playbooks",    label:"Playbooks" },
    { key:"gameplans",    label:"Game Plans" },
    { key:"compositions", label:"Compositions" },
    { key:"lineups",      label:"Lineups" },
  ];
  return (
    <div style={{ padding:"28px 32px" }}>
      <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em", marginBottom:4 }}>STRATEGY</div>
      <div style={{ color:"var(--t2)", fontSize:13, marginBottom:20 }}>Tactical hub — strats, playbooks, and match prep</div>
      <div className="tab-bar" style={{ maxWidth:580, marginBottom:24 }}>
        {TABS.map(t=><button key={t.key} className={`tab${tab===t.key?" on":""}`} onClick={()=>setTab(t.key)}>{t.label}</button>)}
      </div>
      {tab==="raw"          && <RawDB/>}
      {tab==="playbooks"    && <Playbooks/>}
      {tab==="gameplans"    && <GamePlans/>}
      {tab==="compositions" && <Compositions/>}
      {tab==="lineups"      && <Lineups/>}
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
  const [pbs, setPbs] = useState([]);
  const [sel, setSel] = useState(null);
  if (pbs.length === 0 || sel === null) {
    return (
      <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18 }}>
        <div>
          <div className="label-sm" style={{ marginBottom:8 }}>Playbooks</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {pbs.map((p,i)=>(
              <div key={i} onClick={()=>setSel(i)} style={{ padding:"11px 13px", borderRadius:"var(--r2)", cursor:"pointer", background:sel===i?"var(--s3)":"var(--s1)", border:`1px solid ${sel===i?"var(--b3)":"var(--b1)"}` }}>
                <div style={{ fontWeight:500, marginBottom:5, fontSize:13 }}>{p.name}</div>
                <div style={{ display:"flex", gap:4 }}>{p.comp.map((a,j)=><AgentBadge key={j} name={a} size={20}/>)}</div>
              </div>
            ))}
            <button className="btn btn-sub" style={{ marginTop:4 }} onClick={()=>{ const nb={name:`Playbook ${pbs.length+1}`,map:"Ascent",comp:[]}; setPbs(prev=>[...prev,nb]); setSel(pbs.length); }}>+ New Playbook</button>
          </div>
        </div>
        <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
          <div style={{ textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:26, marginBottom:8 }}>⬡</div>
            <div style={{ fontSize:13 }}>{pbs.length===0?"No playbooks yet — create one to get started":"Select a playbook to view"}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18 }}>
      <div>
        <div className="label-sm" style={{ marginBottom:8 }}>Playbooks</div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {pbs.map((p,i)=>(
            <div key={i} onClick={()=>setSel(i)} style={{ padding:"11px 13px", borderRadius:"var(--r2)", cursor:"pointer", background:sel===i?"var(--s3)":"var(--s1)", border:`1px solid ${sel===i?"var(--b3)":"var(--b1)"}` }}>
              <div style={{ fontWeight:500, marginBottom:5, fontSize:13 }}>{p.name}</div>
              <div style={{ display:"flex", gap:4 }}>{p.comp.map((a,j)=><AgentBadge key={j} name={a} size={20}/>)}</div>
            </div>
          ))}
          <button className="btn btn-sub" style={{ marginTop:4 }} onClick={()=>{ const nb={name:`Playbook ${pbs.length+1}`,map:"Ascent",comp:[]}; setPbs(prev=>[...prev,nb]); setSel(pbs.length); }}>+ New Playbook</button>
        </div>
      </div>
      <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
        <div style={{ textAlign:"center", color:"var(--t3)" }}>
          <div style={{ fontSize:26, marginBottom:8 }}>⬡</div>
          <div style={{ fontSize:13 }}>{pbs.length===0?"No playbooks yet — create one to get started":"Select a playbook to view"}</div>
        </div>
      </div>
    </div>
  );
}

function GamePlans() {
  const [docs, setDocs] = useState([]);
  const [sel, setSel]   = useState(null);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"240px 1fr", gap:18 }}>
      <div>
        <button className="btn btn-acc" style={{ width:"100%", justifyContent:"center", marginBottom:10 }}>+ New Game Plan</button>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {docs.map(d=>(
            <div key={d.id} onClick={()=>setSel(d)} style={{ padding:"11px 13px", borderRadius:"var(--r2)", cursor:"pointer", background:sel?.id===d.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===d.id?"var(--b3)":"var(--b1)"}` }}>
              <div style={{ fontWeight:500, marginBottom:5, fontSize:13 }}>{d.title}</div>
              <div style={{ display:"flex", gap:4 }}>{d.maps.map(m=><span key={m} className="chip chip-blue">{m}</span>)}</div>
              <div style={{ fontSize:11, color:"var(--t3)", marginTop:4 }}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>
      {sel ? (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div className="bc" style={{ fontSize:22, fontWeight:700, marginBottom:6 }}>{sel.title}</div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {sel.maps.map(m=><span key={m} className="chip chip-blue">{m}</span>)}
                <span style={{ color:"var(--t3)", fontSize:12 }}>vs {sel.opp} · {sel.date}</span>
              </div>
            </div>
            <button className="btn btn-sub" style={{ fontSize:12 }}>✎ Edit</button>
          </div>
          <Divider/>
          <p style={{ color:"var(--t2)", lineHeight:1.8, fontSize:13 }}>{sel.body}</p>
          <p style={{ color:"var(--t3)", fontStyle:"italic", marginTop:12, fontSize:12 }}>Add notes, embed videos, tag strategies, @mention players…</p>
        </div>
      ) : (
        <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:200 }}>
          <div style={{ textAlign:"center", color:"var(--t3)" }}>
            <div style={{ fontSize:26, marginBottom:8 }}>☰</div>
            <div style={{ fontSize:13 }}>{docs.length===0?"No game plans yet — create one to get started":"Select a game plan to view"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Compositions() {
  const [comps, setComps] = useState([]);
  return (
    <div>
      <button className="btn btn-acc" style={{ marginBottom:18 }} onClick={()=>setComps(p=>[...p,{map:"Ascent",agents:[],players:[]}])}>+ New Composition</button>
      {comps.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:26, marginBottom:8, color:"var(--t3)" }}>⬡</div>
          <div className="bc" style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No Compositions Yet</div>
          <div style={{ color:"var(--t2)", fontSize:13 }}>Create a composition to define your agent picks per map</div>
        </div>
      ) : (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
        {comps.map((c,i)=>(
          <div key={i} className="card">
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <span className="bc" style={{ fontSize:20, fontWeight:700 }}>{c.map}</span>
              <button className="btn btn-ghost" style={{ fontSize:11 }}>✎ Edit</button>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {c.agents.map((ag,j)=>(
                <div key={j} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                  <AgentBadge name={ag} size={36}/>
                  <span style={{ fontSize:10, color:"var(--t2)" }}>{ag}</span>
                  <span style={{ fontSize:10, color:"var(--t3)" }}>{c.players[j]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

function Lineups() {
  const [lus, setLus] = useState([]);
  return (
    <div>
      <button className="btn btn-acc" style={{ marginBottom:18 }} onClick={()=>setLus(p=>[...p,{agent:"Sova",map:"Ascent",name:"New Lineup",from:"",land:""}])}>+ Add Lineup</button>
      {lus.length===0 ? (
        <div className="card" style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:26, marginBottom:8, color:"var(--t3)" }}>◎</div>
          <div className="bc" style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>No Lineups Yet</div>
          <div style={{ color:"var(--t2)", fontSize:13 }}>Add lineups to track ability throws and landing spots</div>
        </div>
      ) : (
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))", gap:14 }}>
        {lus.map((l,i)=>{
          const ag = AGENTS.find(a=>a.name===l.agent);
          return (
            <div key={i} className="card" style={{ cursor:"pointer" }}>
              <div style={{ display:"flex", gap:10, marginBottom:12 }}>
                <AgentBadge name={l.agent} size={36}/>
                <div>
                  <div style={{ fontWeight:600, marginBottom:5 }}>{l.name}</div>
                  <div style={{ display:"flex", gap:5 }}>
                    <span className="chip chip-blue">{l.map}</span>
                    <span className="chip chip-purple">{l.agent}</span>
                  </div>
                </div>
              </div>
              <div style={{ height:96, background:"var(--s2)", borderRadius:"var(--r)", border:"1px solid var(--b2)", position:"relative", overflow:"hidden", marginBottom:10 }}>
                <div style={{ position:"absolute", inset:0, opacity:0.06, background:`radial-gradient(circle at 40% 30%, ${ag?.color}, transparent 60%)` }}/>
                <div style={{ position:"absolute", width:9, height:9, background:ag?.color||"#fff", borderRadius:"50%", top:"30%", left:"40%", boxShadow:`0 0 8px ${ag?.color}` }}/>
                <div style={{ position:"absolute", width:8, height:8, background:"var(--acc)", borderRadius:"50%", top:"68%", left:"72%", boxShadow:"0 0 8px var(--acc)" }}/>
                <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}>
                  <line x1="43%" y1="34%" x2="74%" y2="72%" stroke={ag?.color||"#fff"} strokeWidth="1" strokeDasharray="4,3" opacity="0.35"/>
                </svg>
                <div style={{ position:"absolute", bottom:6, right:8, fontSize:9, color:"var(--t3)", fontWeight:600, letterSpacing:"0.06em" }}>MAP PREVIEW</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div style={{ fontSize:11 }}><div style={{ color:"var(--t2)", fontWeight:600, marginBottom:2 }}>Throw</div><div style={{ color:"var(--t3)" }}>{l.from||"—"}</div></div>
                <div style={{ fontSize:11 }}><div style={{ color:"var(--t2)", fontWeight:600, marginBottom:2 }}>Landing</div><div style={{ color:"var(--t3)" }}>{l.land||"—"}</div></div>
              </div>
            </div>
          );
        })}
      </div>
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
   VOD REVIEW
════════════════════════════════════════ */
function VodReview() {
  const [vods, setVods]           = useState([]);
  const [sel, setSel]             = useState(null);
  const [reply, setReply]         = useState({});
  const [showNew, setShowNew]     = useState(false);
  const [activeFolder, setActiveFolder] = useState("All");
  const [newForm, setNewForm]     = useState({ title:"", folder:"Scrims", url:"" });

  const FOLDERS = ["All","Scrims","Opponent Analysis","Officials"];
  const TS_COLORS = { "Rotation":"#4fc3f7", "Util Usage":"#b39ddb", "Mistake":"#ff5252", "Win Cond":"#69f0ae" };

  const filteredVods = activeFolder==="All" ? vods : vods.filter(v=>v.folder===activeFolder);

  const addVod = () => {
    if(!newForm.title.trim()) return;
    const v = { id:Date.now(), title:newForm.title, folder:newForm.folder, url:newForm.url, ts:[] };
    setVods(p=>[...p,v]);
    setSel(v);
    setShowNew(false);
    setNewForm({ title:"", folder:"Scrims", url:"" });
  };

  const addReply = (ti, text) => {
    if(!text.trim()||!sel) return;
    const update = v => v.id===sel.id ? { ...v, ts:v.ts.map((t,i)=>i===ti?{...t,replies:[...t.replies,text]}:t) } : v;
    setVods(p=>p.map(update));
    setSel(prev=>update(prev));
    setReply(r=>({...r,[ti]:""}));
  };

  return (
    <div style={{ padding:"28px 32px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <div className="bc" style={{ fontSize:38, fontWeight:900, letterSpacing:"0.04em" }}>VOD REVIEW</div>
          <div style={{ color:"var(--t2)", fontSize:13, marginTop:2 }}>Annotate and discuss recordings with your team</div>
        </div>
        <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"200px 1fr", gap:18 }}>
        <div>
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
              <div key={v.id} onClick={()=>setSel(v)} style={{ padding:"10px 11px", borderRadius:"var(--r2)", cursor:"pointer", marginBottom:5,
                background:sel?.id===v.id?"var(--s3)":"var(--s1)", border:`1px solid ${sel?.id===v.id?"var(--b3)":"var(--b1)"}` }}>
                <div style={{ fontSize:12, fontWeight:500, marginBottom:3 }}>{v.title}</div>
                <div style={{ fontSize:10, color:"var(--t3)" }}>{v.ts.length} annotations</div>
              </div>
            ))
          }
        </div>

        {sel ? (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:"var(--s2)", border:"1px solid var(--b1)", borderRadius:12, overflow:"hidden", aspectRatio:"16/6.5", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {sel.url
                ? <iframe src={sel.url} width="100%" height="100%" style={{ border:"none" }} allowFullScreen/>
                : (
                  <div style={{ textAlign:"center", color:"var(--t3)" }}>
                    <div style={{ fontSize:40, marginBottom:8 }}>▶</div>
                    <div style={{ marginBottom:10 }}>No VOD attached</div>
                    <button className="btn btn-sub" style={{ fontSize:12 }}>Paste YouTube URL</button>
                  </div>
                )
              }
            </div>
            <div className="card" style={{ padding:"14px 18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span className="bc" style={{ fontSize:20, fontWeight:700 }}>{sel.title}</span>
                <button className="btn btn-sub" style={{ fontSize:11 }}>+ Timestamp</button>
              </div>
            </div>
            <div className="card">
              <div className="label-sm" style={{ marginBottom:12 }}>ANNOTATIONS ({sel.ts.length})</div>
              {sel.ts.length===0
                ? <div style={{ color:"var(--t3)", fontSize:13 }}>No annotations yet. Add timestamps to start reviewing.</div>
                : sel.ts.map((t,ti)=>(
                  <div key={ti} className="vts" style={{ borderBottom:ti<sel.ts.length-1?"1px solid var(--b1)":"none" }}>
                    <div style={{ background:(TS_COLORS[t.cat]||"#8892aa")+"18", color:TS_COLORS[t.cat]||"#8892aa", border:`1px solid ${(TS_COLORS[t.cat]||"#8892aa")}30`,
                      padding:"5px 9px", borderRadius:6, fontFamily:"'JetBrains Mono'", fontSize:11, flexShrink:0, minWidth:48, textAlign:"center" }}>
                      {t.time}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10, fontWeight:700, color:TS_COLORS[t.cat]||"#8892aa", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:3 }}>{t.cat}</div>
                      <div style={{ fontSize:13, color:"var(--t2)", marginBottom:6 }}>{t.note}</div>
                      {t.replies.map((r,ri)=>(
                        <div key={ri} style={{ fontSize:12, color:"var(--t3)", background:"var(--s2)", borderRadius:5, padding:"5px 9px", marginBottom:4, borderLeft:"2px solid var(--b3)" }}>↩ {r}</div>
                      ))}
                      <div style={{ display:"flex", gap:6 }}>
                        <input type="text" placeholder="Reply..." value={reply[ti]||""} onChange={e=>setReply(r=>({...r,[ti]:e.target.value}))}
                          onKeyDown={e=>{ if(e.key==="Enter") addReply(ti,reply[ti]||""); }}
                          style={{ flex:1, padding:"5px 10px", fontSize:12 }}/>
                        <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:11 }} onClick={()=>addReply(ti,reply[ti]||"")}>Reply</button>
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        ) : (
          <div className="card" style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300 }}>
            <div style={{ textAlign:"center", color:"var(--t3)" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>▶</div>
              <div className="bc" style={{ fontSize:20, fontWeight:700, marginBottom:8, color:"var(--t2)" }}>No Review Selected</div>
              <div style={{ fontSize:13, marginBottom:20 }}>Create a new review to get started</div>
              <button className="btn btn-acc" onClick={()=>setShowNew(true)}>+ New Review</button>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <Modal onClose={()=>setShowNew(false)} title="New VOD Review">
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Title</div><input type="text" value={newForm.title} onChange={e=>setNewForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Cloud9 Loss Breakdown"/></div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>Folder</div>
              <select value={newForm.folder} onChange={e=>setNewForm(f=>({...f,folder:e.target.value}))}>
                {FOLDERS.filter(f=>f!=="All").map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div><div className="label-sm" style={{ marginBottom:6 }}>YouTube URL (optional)</div><input type="text" value={newForm.url} onChange={e=>setNewForm(f=>({...f,url:e.target.value}))} placeholder="https://youtube.com/..."/></div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn btn-acc" style={{ flex:1, justifyContent:"center" }} onClick={addVod}>Create Review</button>
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
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
