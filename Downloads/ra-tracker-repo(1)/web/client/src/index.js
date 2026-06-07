const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");

const app        = express();
const JWT_SECRET = process.env.JWT_SECRET || "racker-dev-secret-change-in-prod";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  max: 10,
  idleTimeoutMillis: 10000,
  allowExitOnIdle: true,
});

app.use(cors({
  origin: [
    "https://tracker2-ten.vercel.app",
    "https://tracker2-cje.pages.dev",
    "https://api-cool-ocean-7995.fly.dev",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  credentials: true
}));
app.use(express.json({ limit: "20mb" }));
// Serve self-hosted TactiVal stratboard (same-origin = no X-Frame-Options block)
const path = require("path");
const STATIC_CACHE = { maxAge: "365d", immutable: true };
app.use("/stratboard", express.static(path.join(__dirname, "public/stratboard"), STATIC_CACHE));
app.use("/tactiboard", express.static(path.join(__dirname, "public/tactiboard/tactiboard"), STATIC_CACHE));
// Serve agent/role images
app.use("/agents", express.static(path.join(__dirname, "public/agents"), STATIC_CACHE));
app.use("/roles",  express.static(path.join(__dirname, "public/roles"),  STATIC_CACHE));
app.use("/spike",  express.static(path.join(__dirname, "public/spike"),  STATIC_CACHE));

async function getJwtSecret() {
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='jwt_secret'");
    return rows[0]?.value || JWT_SECRET;
  } catch { return JWT_SECRET; }
}
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });
  getJwtSecret().then(secret => {
    try { req.user = jwt.verify(header.slice(7), secret); next(); }
    catch { res.status(401).json({ error: "Invalid or expired token" }); }
  }).catch(() => res.status(500).json({ error: "Auth error" }));
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    next();
  });
}

// ── DB INIT ──────────────────────────────────────────────
let dbReady = false;
async function initDB() {
  // Always run new migrations even on warm instances
  try { await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS username TEXT DEFAULT ''`); } catch(e) { console.error("migration username col:", e.message); }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         SERIAL PRIMARY KEY,
        message    TEXT NOT NULL,
        context    TEXT DEFAULT '',
        read       INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch(e) { console.error("migration notifications table:", e.message); }
  try { await pool.query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''`); } catch(e) { console.error("migration notifications username col:", e.message); }

  if (dbReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'player',
      is_banned     INTEGER NOT NULL DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW(),
      last_login    TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS players (
      id   SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      ign  TEXT DEFAULT '',
      role TEXT DEFAULT '',
      av   TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT DEFAULT '',
      due         TEXT DEFAULT '',
      labels      TEXT DEFAULT '[]',
      done        INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS labels (
      id    SERIAL PRIMARY KEY,
      name  TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strats (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      map         TEXT DEFAULT 'Ascent',
      side        TEXT DEFAULT 'atk',
      cat         TEXT DEFAULT 'Default',
      description TEXT DEFAULT '',
      agents      TEXT DEFAULT '[]'
    );
    ALTER TABLE strats ADD COLUMN IF NOT EXISTS agents TEXT DEFAULT '[]';
    ALTER TABLE strats ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
    ALTER TABLE strats ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    ALTER TABLE strats ADD COLUMN IF NOT EXISTS custom_cats TEXT DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS vods (
      id       SERIAL PRIMARY KEY,
      title    TEXT NOT NULL,
      folder   TEXT DEFAULT 'Scrims',
      url      TEXT DEFAULT '',
      ts       TEXT DEFAULT '[]',
      gen_note TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS scrims (
      id           SERIAL PRIMARY KEY,
      date         TEXT NOT NULL,
      map          TEXT NOT NULL,
      opp          TEXT NOT NULL,
      comp         TEXT DEFAULT '[]',
      score        TEXT DEFAULT '0-0',
      res          TEXT DEFAULT 'loss',
      rounds       TEXT DEFAULT '[]',
      player_stats TEXT DEFAULT '[]',
      round_detail TEXT DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS calendar_events (
      id    SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      date  TEXT NOT NULL,
      time  TEXT DEFAULT '18:00',
      cat   TEXT DEFAULT 'Scrim',
      color TEXT DEFAULT '#4fc3f7',
      url   TEXT DEFAULT NULL
    );
    ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS url TEXT DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS playbooks (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      url         TEXT NOT NULL,
      map         TEXT DEFAULT 'Ascent',
      side        TEXT DEFAULT 'atk',
      description TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS gameplans (
      id      SERIAL PRIMARY KEY,
      title   TEXT NOT NULL,
      content TEXT DEFAULT '',
      comp_id INTEGER DEFAULT NULL
    );
    -- migration: add comp_id if missing
    ALTER TABLE gameplans ADD COLUMN IF NOT EXISTS comp_id INTEGER DEFAULT NULL;
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS comp_strats (
      id          SERIAL PRIMARY KEY,
      comp_id     INTEGER NOT NULL,
      side        TEXT DEFAULT 'atk',
      category    TEXT DEFAULT 'Pistol',
      name        TEXT NOT NULL DEFAULT '',
      image_data  TEXT DEFAULT '',
      description TEXT DEFAULT '',
      status      TEXT DEFAULT 'Active',
      sort_order  INTEGER DEFAULT 0
    );
    ALTER TABLE comp_strats ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
    ALTER TABLE comp_strats ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
    CREATE TABLE IF NOT EXISTS comp_blocks (
      id         SERIAL PRIMARY KEY,
      comp_id    INTEGER NOT NULL,
      side       TEXT DEFAULT 'atk',
      category   TEXT DEFAULT 'Pistol',
      block_type TEXT DEFAULT 'text',
      content    TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ocr_scans (
      id         SERIAL PRIMARY KEY,
      scanned_at TIMESTAMP DEFAULT NOW(),
      scanned_by TEXT DEFAULT '',
      players    TEXT DEFAULT '[]'
    );
  `);
  await pool.query(`ALTER TABLE vods ADD COLUMN IF NOT EXISTS gen_note TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE vods ADD COLUMN IF NOT EXISTS scrim_id INTEGER DEFAULT NULL`).catch(()=>{});
  // Backfill scrim_id for existing VODs by matching title pattern "vs OPP" to scrims
  await pool.query(`
    UPDATE vods v SET scrim_id = s.id
    FROM scrims s
    WHERE v.scrim_id IS NULL
      AND v.folder = 'Scrims'
      AND (v.title = 'vs ' || s.opp OR v.title LIKE 'vs ' || s.opp || ' -%')
  `).catch(()=>{});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS strat_boards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled',
      map TEXT NOT NULL DEFAULT 'Haven',
      strokes TEXT DEFAULT '[]',
      tokens TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(()=>{});
  await pool.query(`ALTER TABLE comp_strats ADD COLUMN IF NOT EXISTS protocols TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE comp_strats ADD COLUMN IF NOT EXISTS explanations TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS player_stats TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS round_detail TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS kill_positions TEXT DEFAULT '[]'`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS map_meta TEXT DEFAULT NULL`).catch(()=>{});
  await pool.query(`ALTER TABLE scrims ADD COLUMN IF NOT EXISTS atk_first BOOLEAN DEFAULT NULL`).catch(()=>{});

  // Backfill atk_first for existing scrims imported before the column existed.
  // Use round_detail: find first plant in H1 — planting team = ATK in H1.
  // Compare planterTeam against our side (derived from player_stats side field).
  try {
    const { rows: needsFill } = await pool.query(`SELECT id, player_stats, round_detail FROM scrims WHERE atk_first IS NULL`);
    for (const row of needsFill) {
      try {
        const ps  = JSON.parse(row.player_stats  || "[]");
        const rd  = JSON.parse(row.round_detail   || "[]");
        // Determine our teamId from player_stats: side="blue" → we are Blue team
        const ourSide = ps.find(p => p.side === "blue" || p.side === "red")?.side;
        if (!ourSide) continue;
        const ourTeam = ourSide === "blue" ? "Blue" : "Red";
        // Find first plant in H1 to identify ATK team
        let atkTeam = null;
        const h1 = rd.slice(0, 12);
        for (const r of h1) {
          if (r.planted && r.planterTeam) { atkTeam = r.planterTeam; break; }
        }
        // If no H1 plant, try H2 and flip
        if (!atkTeam) {
          const h2 = rd.slice(12, 24);
          for (const r of h2) {
            if (r.planted && r.planterTeam) { atkTeam = r.planterTeam === "Blue" ? "Red" : "Blue"; break; }
          }
        }
        // Fallback: assume Blue attacked first
        if (!atkTeam) atkTeam = "Blue";
        const atkFirst = atkTeam === ourTeam;
        await pool.query(`UPDATE scrims SET atk_first = $1 WHERE id = $2`, [atkFirst, row.id]);
      } catch {}
    }
    if (needsFill.length > 0) console.log(`[backfill] Set atk_first for ${needsFill.length} scrims`);
  } catch (e) { console.warn("[backfill] atk_first backfill failed:", e.message); }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comp_lineups (
      id         SERIAL PRIMARY KEY,
      comp_id    INTEGER NOT NULL,
      title      TEXT NOT NULL DEFAULT '',
      agent      TEXT DEFAULT '',
      ability    TEXT DEFAULT '',
      notes      TEXT DEFAULT '',
      image_data TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(()=>{});

  // (username + notifications migrations now run above the dbReady guard)

  // Goals & Debrief tables
  await pool.query(`ALTER TABLE individual_goals ADD COLUMN IF NOT EXISTS session_date TEXT DEFAULT ''`).catch(()=>{});
  await pool.query(`ALTER TABLE individual_goals ADD COLUMN IF NOT EXISTS session_label TEXT DEFAULT ''`).catch(()=>{});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scrim_goals (
      id         SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      scrim_date TEXT DEFAULT '',
      content    TEXT DEFAULT '',
      done       INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS individual_goals (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMP DEFAULT NOW(),
      player_id   INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      title       TEXT DEFAULT '',
      description TEXT DEFAULT '',
      progress    INTEGER DEFAULT 0,
      done        INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reflections (
      id         SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      scrim_date TEXT DEFAULT '',
      player_id  INTEGER REFERENCES players(id) ON DELETE SET NULL,
      mental     INTEGER DEFAULT 0,
      self       INTEGER DEFAULT 0,
      team       INTEGER DEFAULT 0,
      notes      TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS veto_reports (
      id           SERIAL PRIMARY KEY,
      created_at   TIMESTAMP DEFAULT NOW(),
      name         TEXT NOT NULL,
      opp_name     TEXT DEFAULT '',
      opp_id       TEXT DEFAULT '',
      format       TEXT DEFAULT 'bo3',
      actions      JSONB DEFAULT '[]',
      opp_patterns JSONB DEFAULT '[]',
      summary      TEXT DEFAULT ''
    
    );
  `).catch(()=>{});

  const { rows } = await pool.query("SELECT COUNT(*) as count FROM users");
  if (Number(rows[0].count) === 0) {
    const adminPass = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(adminPass, 12);
    await pool.query("INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3)", ["admin", hash, "admin"]);
  }
  dbReady = true;
}

// ── AUTH ─────────────────────────────────────────────────
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const { rows } = await pool.query("SELECT * FROM users WHERE username=$1", [username.trim().toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Invalid username or password" });
    if (user.is_banned) return res.status(403).json({ error: "Your account has been suspended." });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: "Invalid username or password" });
    await pool.query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);
    const secret = await getJwtSecret();
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, secret, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/auth/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id,username,role,is_banned FROM users WHERE id=$1", [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "User not found" });
    if (user.is_banned) return res.status(403).json({ error: "Account suspended" });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/auth/users", requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id,username,role,is_banned,created_at,last_login FROM users ORDER BY created_at ASC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/users", requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const hash = await bcrypt.hash(password, 12);
    await pool.query("INSERT INTO users (username,password_hash,role) VALUES ($1,$2,$3)", [username.trim().toLowerCase(), hash, role||"player"]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/users/:id/reset-password", requireAdmin, async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 12);
    await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [hash, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/users/:id/ban", requireAdmin, async (req, res) => {
  try { await pool.query("UPDATE users SET is_banned=1 WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/users/:id/unban", requireAdmin, async (req, res) => {
  try { await pool.query("UPDATE users SET is_banned=0 WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/auth/users/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/revoke-all", requireAdmin, async (req, res) => {
  try {
    // Rotate JWT secret stored in settings — all existing tokens become invalid
    const newSecret = require("crypto").randomBytes(48).toString("hex");
    await pool.query("INSERT INTO settings (key,value) VALUES ('jwt_secret',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [newSecret]);
    // Update the in-process secret so this response still succeeds
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PLAYERS ──────────────────────────────────────────────
app.get("/api/players", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM players ORDER BY id"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/players", requireAdmin, async (req, res) => {
  try {
    const { name, ign="", role="", av="", username="" } = req.body;
    const { rows } = await pool.query("INSERT INTO players (name,ign,role,av,username) VALUES ($1,$2,$3,$4,$5) RETURNING *", [name,ign,role,av,username.trim().toLowerCase()]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/players/:id", requireAdmin, async (req, res) => {
  try {
    const { name, ign="", role="", av="", username="" } = req.body;
    const { rows } = await pool.query("UPDATE players SET name=$1,ign=$2,role=$3,av=$4,username=$5 WHERE id=$6 RETURNING *", [name,ign,role,av||name.slice(0,2).toUpperCase(),username.trim().toLowerCase(),req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/players/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM players WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TASKS ────────────────────────────────────────────────
app.get("/api/tasks", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM tasks ORDER BY id"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/tasks", requireAdmin, async (req, res) => {
  try {
    const { player_id, title, description="", due="", labels="[]" } = req.body;
    const { rows } = await pool.query("INSERT INTO tasks (player_id,title,description,due,labels) VALUES ($1,$2,$3,$4,$5) RETURNING *", [player_id,title,description,due,labels]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, due, labels, done } = req.body;
    await pool.query("UPDATE tasks SET title=$1,description=$2,due=$3,labels=$4,done=$5 WHERE id=$6", [title,description,due,labels,done,req.params.id]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/tasks/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM tasks WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── LABELS ───────────────────────────────────────────────
app.get("/api/labels", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM labels ORDER BY id"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/labels", requireAdmin, async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows } = await pool.query("INSERT INTO labels (name,color) VALUES ($1,$2) ON CONFLICT (name) DO UPDATE SET color=$2 RETURNING *", [name,color]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/labels/:name", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM labels WHERE name=$1", [req.params.name]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMP STRATS ──────────────────────────────────────────
app.get("/api/comp-strats", requireAuth, async (req, res) => {
  try {
    const { comp_id } = req.query;
    const { rows } = comp_id
      ? await pool.query("SELECT * FROM comp_strats WHERE comp_id=$1 ORDER BY sort_order,id", [comp_id])
      : await pool.query("SELECT * FROM comp_strats ORDER BY sort_order,id");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/comp-strats", requireAuth, async (req, res) => {
  try {
    const { comp_id, side="atk", category="Pistol", name="", image_data="", description="", status="Active", sort_order=0 } = req.body;
    const { rows } = await pool.query("INSERT INTO comp_strats (comp_id,side,category,name,image_data,description,status,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", [comp_id,side,category,name,image_data,description,status,sort_order]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/comp-strats/:id", requireAuth, async (req, res) => {
  try {
    const { name, description="", status="Active", image_data, protocols="[]", explanations="[]" } = req.body;
    const { rows } = await pool.query(
      "UPDATE comp_strats SET name=$1,description=$2,status=$3,image_data=COALESCE($4,image_data),protocols=$5,explanations=$6 WHERE id=$7 RETURNING *",
      [name, description, status, image_data, protocols, explanations, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/comp-strats/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM comp_strats WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMP BLOCKS ──────────────────────────────────────────
app.get("/api/comp-blocks", requireAuth, async (req, res) => {
  try {
    const { comp_id } = req.query;
    const { rows } = comp_id
      ? await pool.query("SELECT * FROM comp_blocks WHERE comp_id=$1 ORDER BY sort_order,id", [comp_id])
      : await pool.query("SELECT * FROM comp_blocks ORDER BY sort_order,id");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/comp-blocks", requireAuth, async (req, res) => {
  try {
    const { comp_id, side="atk", category="Pistol", block_type="text", content="", sort_order=0 } = req.body;
    const { rows } = await pool.query("INSERT INTO comp_blocks (comp_id,side,category,block_type,content,sort_order) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [comp_id,side,category,block_type,content,sort_order]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/comp-blocks/:id", requireAuth, async (req, res) => {
  try {
    const { content, sort_order } = req.body;
    await pool.query("UPDATE comp_blocks SET content=$1,sort_order=$2 WHERE id=$3", [content,sort_order,req.params.id]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/comp-blocks/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM comp_blocks WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMP LINEUPS ─────────────────────────────────────────
app.get("/api/comp-lineups", requireAuth, async (req, res) => {
  try {
    const { comp_id } = req.query;
    const { rows } = comp_id
      ? await pool.query("SELECT * FROM comp_lineups WHERE comp_id=$1 ORDER BY sort_order,id", [comp_id])
      : await pool.query("SELECT * FROM comp_lineups ORDER BY sort_order,id");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/comp-lineups", requireAuth, async (req, res) => {
  try {
    const { comp_id, title="", agent="", ability="", notes="", image_data="", sort_order=0 } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO comp_lineups (comp_id,title,agent,ability,notes,image_data,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [comp_id, title, agent, ability, notes, image_data, sort_order]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/comp-lineups/:id", requireAuth, async (req, res) => {
  try {
    const { title, agent, ability, notes, image_data, sort_order=0 } = req.body;
    const { rows } = await pool.query(
      "UPDATE comp_lineups SET title=$1,agent=$2,ability=$3,notes=$4,image_data=COALESCE($5,image_data),sort_order=$6 WHERE id=$7 RETURNING *",
      [title, agent, ability, notes, image_data, sort_order, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/comp-lineups/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM comp_lineups WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── COMP LINEUPS ─────────────────────────────────────────
app.get("/api/comp-lineups", requireAuth, async (req, res) => {
  try {
    const { comp_id } = req.query;
    const { rows } = comp_id
      ? await pool.query("SELECT * FROM comp_lineups WHERE comp_id=$1 ORDER BY sort_order,id", [comp_id])
      : await pool.query("SELECT * FROM comp_lineups ORDER BY sort_order,id");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/comp-lineups", requireAuth, async (req, res) => {
  try {
    const { comp_id, title, agent="", ability="", notes="", image_data="", sort_order=0 } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO comp_lineups (comp_id,title,agent,ability,notes,image_data,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [comp_id, title, agent, ability, notes, image_data, sort_order]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/comp-lineups/:id", requireAuth, async (req, res) => {
  try {
    const { title, agent="", ability="", notes="", image_data="", sort_order=0 } = req.body;
    const { rows } = await pool.query(
      "UPDATE comp_lineups SET title=$1,agent=$2,ability=$3,notes=$4,image_data=$5,sort_order=$6 WHERE id=$7 RETURNING *",
      [title, agent, ability, notes, image_data, sort_order, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/comp-lineups/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM comp_lineups WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── STRATS ───────────────────────────────────────────────
app.get("/api/strats", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM strats ORDER BY sort_order, id"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch("/api/strats/reorder", requireAdmin, async (req, res) => {
  try {
    // Expects body: { order: [{id, sort_order}, ...] }
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be array" });
    await Promise.all(order.map(({ id, sort_order }) =>
      pool.query("UPDATE strats SET sort_order=$1 WHERE id=$2", [sort_order, id])
    ));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.patch("/api/comp-strats/reorder", requireAuth, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) return res.status(400).json({ error: "order must be array" });
    await Promise.all(order.map(({ id, sort_order }) =>
      pool.query("UPDATE comp_strats SET sort_order=$1 WHERE id=$2", [sort_order, id])
    ));
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/strats", requireAdmin, async (req, res) => {
  try {
    const { name, map="Ascent", side="atk", cat="Default", description="", agents="[]", status="Active", custom_cats } = req.body;
    const { rows } = await pool.query("INSERT INTO strats (name,map,side,cat,description,agents,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *", [name,map,side,cat,description,agents,status]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/strats/:id", requireAdmin, async (req, res) => {
  try {
    const { name, map="Ascent", side="atk", cat="Default", description="", agents="[]", status="Active", custom_cats } = req.body;
    const { rows } = await pool.query(
      "UPDATE strats SET name=$1,map=$2,side=$3,cat=$4,description=$5,agents=$6,status=$7,custom_cats=$8 WHERE id=$9 RETURNING *",
      [name, map, side, cat, description, agents, status, custom_cats||null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/strats/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM strats WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VODS ─────────────────────────────────────────────────
app.get("/api/vods", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM vods ORDER BY id DESC"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/vods", requireAuth, async (req, res) => {
  try {
    const { title, folder="Scrims", url="", ts="[]", gen_note="", scrim_id=null } = req.body;
    const { rows } = await pool.query("INSERT INTO vods (title,folder,url,ts,gen_note,scrim_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [title,folder,url,ts,gen_note,scrim_id||null]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/vods/:id", requireAuth, async (req, res) => {
  try {
    const { title, folder, url, ts, gen_note, scrim_id } = req.body;
    await pool.query("UPDATE vods SET title=$1,folder=$2,url=$3,ts=$4,gen_note=$5,scrim_id=$6 WHERE id=$7", [title,folder,url,ts,gen_note,scrim_id||null,req.params.id]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/vods/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM vods WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SCRIMS ───────────────────────────────────────────────
app.get("/api/scrims", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM scrims ORDER BY date DESC,id DESC"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/scrims", requireAuth, async (req, res) => {
  try {
    const { date, map, opp, comp="[]", score="0-0", res:result="loss", rounds="[]", player_stats="[]", round_detail="[]", source="manual" } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO scrims (date,map,opp,comp,score,res,rounds,player_stats,round_detail,source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
      [date,map,opp,comp,score,result,rounds,player_stats,round_detail,source]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get("/api/scrims/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM scrims WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/scrims/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM scrims WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/scrims/:id", requireAuth, async (req, res) => {
  try {
    const { date, map, opp, comp, score, res:result, rounds, player_stats, round_detail, source } = req.body;
    await pool.query(
      "UPDATE scrims SET date=$1,map=$2,opp=$3,comp=$4,score=$5,res=$6,rounds=$7,player_stats=$8,round_detail=$9,source=$10 WHERE id=$11",
      [date, map, opp, comp, score, result, rounds, player_stats, round_detail, source||"manual", req.params.id]
    );
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/scrims/:id/player_stats", requireAdmin, async (req, res) => {
  try {
    const { player_stats } = req.body;
    await pool.query("UPDATE scrims SET player_stats=$1 WHERE id=$2", [JSON.stringify(player_stats), req.params.id]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Patch ADR (and hsRate) onto existing player_stats using raw match JSON
app.patch("/api/scrims/:id/patch-adr", requireAuth, async (req, res) => {
  try {
    const { matchData } = req.body;
    if (!matchData?.players || !matchData?.roundResults) return res.status(400).json({ error: "matchData required" });

    const { rows } = await pool.query("SELECT player_stats FROM scrims WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Scrim not found" });

    const players = matchData.players.filter(p => !p.isObserver);
    const rounds  = matchData.roundResults || [];

    // Resolve names via Henrik if players are missing gameName
    const missingNames = players.filter(p => !resolvePlayerName(p).includes("#") && !p.gameName && !p.riotIdGameName && !p.name && !p.identity?.gameName);
    if (missingNames.length > 0) {
      const puuidNameMap = await resolveNamesViaHenrik(missingNames.map(p => p.subject));
      players.forEach(p => {
        if (puuidNameMap[p.subject]) {
          const [gn, tl] = puuidNameMap[p.subject].split("#");
          p.gameName = gn; p.tagLine = tl || "";
        }
      });
    }

    // Build puuid → name map
    const puuidToName = {};
    players.forEach(p => { puuidToName[p.subject] = resolvePlayerName(p); });

    // Compute damage + headshots per player
    const dmgMap = {};
    players.forEach(p => { dmgMap[p.subject] = { totalDamage: 0, hs: 0, bs: 0, ls: 0 }; });
    rounds.forEach(r => {
      (r.playerStats || []).forEach(ps => {
        if (!dmgMap[ps.subject]) return;
        (ps.damage || []).forEach(d => {
          dmgMap[ps.subject].totalDamage += d.damage    || 0;
          dmgMap[ps.subject].hs          += d.headshots || 0;
          dmgMap[ps.subject].bs          += d.bodyshots || 0;
          dmgMap[ps.subject].ls          += d.legshots  || 0;
        });
      });
    });

    // Patch existing player_stats
    const stored = JSON.parse(rows[0].player_stats || "[]");
    const patched = stored.map(p => {
      // Match by name "gameName#tagLine"
      const puuid = Object.keys(puuidToName).find(id => puuidToName[id] === p.name);
      if (!puuid || !dmgMap[puuid]) return p;
      const d = dmgMap[puuid];
      const rp = p.roundsPlayed || 1;
      const shots = d.hs + d.bs + d.ls;
      return {
        ...p,
        adr:    Math.round(d.totalDamage / rp),
        hsRate: shots > 0 ? Math.round((d.hs / shots) * 100) : (p.hsRate ?? 0),
      };
    });

    await pool.query("UPDATE scrims SET player_stats=$1 WHERE id=$2", [JSON.stringify(patched), req.params.id]);
    res.json({ ok: true, patched: patched.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Patch ult status into existing round_detail using raw match JSON
app.patch("/api/scrims/:id/patch-ult", requireAuth, async (req, res) => {
  try {
    const { matchData, myTeamId = "Blue" } = req.body;
    if (!matchData?.players || !matchData?.roundResults) return res.status(400).json({ error: "matchData required" });

    const { rows } = await pool.query("SELECT round_detail FROM scrims WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Scrim not found" });

    const players = matchData.players.filter(p => !p.isObserver);
    const rounds  = matchData.roundResults || [];
    const ourTeamId = myTeamId;

    const AGENT_MAP_LOCAL = {};
    try {
      const r = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
      if (r.ok) { const { data } = await r.json(); data.forEach(a => { AGENT_MAP_LOCAL[a.uuid.toLowerCase()] = a.displayName; }); }
    } catch {}

    function getAgent(charId) {
      if (!charId) return "Unknown";
      return AGENT_MAP_LOCAL[charId.toLowerCase()] || charId.slice(0,8);
    }

    const stored = JSON.parse(rows[0].round_detail || "[]");
    const patched = stored.map((rd, roundIdx) => {
      const r = rounds[roundIdx];
      if (!r) return rd;
      const ultStatus = {};
      (r.playerStats || []).forEach(ps => {
        const puuid = ps.subject;
        const orbs = ps.economy?.ultimateStatus ?? ps.ultimateStatus ?? null;
        const maxOrbs = ps.economy?.ultimateMaxOrbs ?? ps.ultimateMaxOrbs ?? null;
        const player = players.find(p => p.subject === puuid);
        if (puuid) {
          ultStatus[puuid] = {
            name: player ? resolvePlayerName(player) : puuid.slice(0,8),
            agent: getAgent(player?.characterId),
            side: player?.teamId === ourTeamId ? "blue" : "red",
            orbs, maxOrbs,
            ready: (maxOrbs !== null && orbs !== null) ? orbs >= maxOrbs : null,
          };
        }
      });
      return { ...rd, ultStatus };
    });

    await pool.query("UPDATE scrims SET round_detail=$1 WHERE id=$2", [JSON.stringify(patched), req.params.id]);
    res.json({ ok: true, rounds: patched.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── RIOT IMPORT ──────────────────────────────────────────
const MAP_NAME_MAP = {
  "/Game/Maps/Ascent/Ascent":"Ascent","/Game/Maps/Bonsai/Bonsai":"Split",
  "/Game/Maps/Canyon/Canyon":"Fracture","/Game/Maps/Duality/Duality":"Bind",
  "/Game/Maps/Foxtrot/Foxtrot":"Breeze","/Game/Maps/Port/Port":"Icebox",
  "/Game/Maps/Triad/Triad":"Haven","/Game/Maps/Pitt/Pitt":"Pitt",
};
function normalizeMap(mapId) {
  if (!mapId) return "Unknown";
  if (MAP_NAME_MAP[mapId]) return MAP_NAME_MAP[mapId];
  const parts = mapId.split("/").filter(Boolean);
  return parts[parts.length - 1] || "Unknown";
}
app.post("/api/scrims/import", requireAuth, async (req, res) => {
  try {
    const { matchId, teamName } = req.body;
    let { apiKey } = req.body;
    if (!matchId) return res.status(400).json({ error: "matchId is required" });
    if (!apiKey) {
      const { rows } = await pool.query("SELECT value FROM settings WHERE key='henrik_api_key'");
      apiKey = rows[0]?.value || "";
    }
    if (!apiKey) return res.status(400).json({ error: "No HenrikDev API key found." });
    const url = `https://api.henrikdev.xyz/valorant/v4/match/na/${encodeURIComponent(matchId)}`;
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    if (!response.ok) {
      const errBody = await response.json().catch(()=>({}));
      return res.status(response.status).json({ error: errBody?.errors?.[0]?.message || `API returned ${response.status}` });
    }
    const data  = await response.json();
    const match = data?.data;
    if (!match) return res.status(404).json({ error: "Match not found" });
    const map  = normalizeMap(match.metadata?.map?.id) || "Unknown";
    const date = match.metadata?.started_at ? new Date(match.metadata.started_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
    const teams = match.teams || [], players = match.players || [];
    let ourTeamId = teams[0]?.team_id || "Blue";
    if (teamName?.trim()) {
      const lower = teamName.trim().toLowerCase();
      const found = players.find(p => p.name?.toLowerCase().includes(lower) || p.tag?.toLowerCase().includes(lower));
      if (found) ourTeamId = found.team_id;
    }
    const ourTeam = teams.find(t=>t.team_id===ourTeamId), theirTeam = teams.find(t=>t.team_id!==ourTeamId);
    const ourScore = ourTeam?.rounds?.won??0, theirScore = theirTeam?.rounds?.won??0;
    const result = ourScore > theirScore ? "win" : "loss";
    const ourPlayers = players.filter(p=>p.team_id===ourTeamId);
    const comp = ourPlayers.slice(0,5).map(p=>p.agent?.name||"Unknown");
    const rounds = (match.rounds||[]).map(r=>r.winning_team===ourTeamId?"w":"l");
    const theirPlayers = players.filter(p=>p.team_id!==ourTeamId);
    res.json({ date, map, opp: theirPlayers[0]?.name||"Opponent", comp: JSON.stringify(comp), score:`${ourScore}-${theirScore}`, res:result, rounds:JSON.stringify(rounds) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── OCR SCAN ─────────────────────────────────────────────
app.post("/api/ocr-scan", requireAuth, async (req, res) => {
  try {
    const { imageBase64, imageMime = "image/png" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: "GROQ_API_KEY not set on server" });
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: `data:${imageMime};base64,${imageBase64}` } },
          { type: "text", text: `Extract all player rows from this Valorant scoreboard screenshot. Return ONLY a JSON array, no markdown or explanation.\n\nIMPORTANT: Riot Games updated their scoreboard layout. The KDA column may appear as a combined string like "35 / 26 / 13" instead of three separate columns. Parse it correctly either way.\n\nEach object must have exactly these keys:\n- name: player name string\n- agent: agent name string or null\n- team: "win" or "lose" (green highlighted rows = win team, red/pink highlighted rows = lose team)\n- acs: average combat score number (labeled AVG COMBAT SCORE or ACS)\n- k: kills number (first number in KDA)\n- d: deaths number (second number in KDA)\n- a: assists number (third number in KDA)\n- econ: econ rating number, can be negative (labeled ECON)\n- fb: first bloods number (labeled FIRST BLOODS or FB)\n- pl: plants number (labeled PLANTS)\n- def: defuses number (labeled DEFUSES)\n\nReturn only the raw JSON array, no other text.` }
        ]}]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || "Groq API error" });
    const text = data.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json|```/g, "").trim();
    res.json({ players: JSON.parse(clean) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── OCR STATS ────────────────────────────────────────────
app.get("/api/ocr-stats", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM ocr_scans ORDER BY scanned_at DESC");
    res.json(rows.map(r=>({...r, players: JSON.parse(r.players||"[]")})));
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/ocr-stats", requireAuth, async (req, res) => {
  try {
    const { players } = req.body;
    if (!Array.isArray(players)||players.length===0) return res.status(400).json({ error: "players array required" });
    const { rows } = await pool.query("INSERT INTO ocr_scans (scanned_by,players) VALUES ($1,$2) RETURNING *", [req.user.username, JSON.stringify(players)]);
    res.json({ ...rows[0], players });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/ocr-stats/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM ocr_scans WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── EVENTS ───────────────────────────────────────────────
app.get("/api/events", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM calendar_events ORDER BY date,time"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/events", requireAdmin, async (req, res) => {
  try {
    const { title, date, time="18:00", cat="Scrim", color="#4fc3f7", url=null } = req.body;
    const { rows } = await pool.query("INSERT INTO calendar_events (title,date,time,cat,color,url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [title,date,time,cat,color,url]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/events/pracc", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM calendar_events WHERE cat='Pracc'"); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/events/clear-pracc", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM calendar_events WHERE cat='Pracc'"); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/events/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM calendar_events WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SETTINGS ─────────────────────────────────────────────
app.get("/api/settings", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT key,value FROM settings");
    const obj = {}; rows.forEach(r=>{ obj[r.key]=r.value; }); res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// Allow any authenticated user to update the shared strat board URL
app.put("/api/settings/stratboard_url", requireAuth, async (req, res) => {
  try {
    await pool.query("INSERT INTO settings (key,value) VALUES ('stratboard_url',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [req.body.value??""]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/settings/:key", requireAdmin, async (req, res) => {
  try {
    await pool.query("INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [req.params.key, req.body.value??""]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PLAYBOOKS ────────────────────────────────────────────
app.get("/api/playbooks", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM playbooks ORDER BY id"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/playbooks", requireAdmin, async (req, res) => {
  try {
    const { title, url, map="Ascent", side="atk", description="" } = req.body;
    const { rows } = await pool.query("INSERT INTO playbooks (title,url,map,side,description) VALUES ($1,$2,$3,$4,$5) RETURNING *", [title,url,map,side,description]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/playbooks/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM playbooks WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GAMEPLANS ────────────────────────────────────────────
app.get("/api/gameplans", requireAuth, async (req, res) => {
  try {
    const { comp_id } = req.query;
    const { rows } = comp_id
      ? await pool.query("SELECT * FROM gameplans WHERE comp_id=$1 ORDER BY id", [comp_id])
      : await pool.query("SELECT * FROM gameplans WHERE comp_id IS NULL ORDER BY id");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/gameplans", requireAdmin, async (req, res) => {
  try {
    const { title="New Game Plan", content="", comp_id=null } = req.body;
    const { rows } = await pool.query("INSERT INTO gameplans (title,content,comp_id) VALUES ($1,$2,$3) RETURNING *", [title,content,comp_id||null]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/gameplans/:id", requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    await pool.query("UPDATE gameplans SET title=$1,content=$2 WHERE id=$3", [title,content,req.params.id]);
    res.json({ ok:true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/gameplans/:id", requireAdmin, async (req, res) => {
  try { await pool.query("DELETE FROM gameplans WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SCRIM GOALS ──────────────────────────────────────────
app.get("/api/scrim-goals", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM scrim_goals ORDER BY created_at DESC"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/scrim-goals", requireAuth, async (req, res) => {
  try {
    const { content="", scrim_date="", done=0 } = req.body;
    const { rows } = await pool.query("INSERT INTO scrim_goals (content,scrim_date,done) VALUES ($1,$2,$3) RETURNING *", [content,scrim_date,done]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/scrim-goals/:id", requireAuth, async (req, res) => {
  try {
    const { content, scrim_date, done } = req.body;
    const { rows } = await pool.query("UPDATE scrim_goals SET content=$1,scrim_date=$2,done=$3 WHERE id=$4 RETURNING *", [content,scrim_date,done,req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/scrim-goals/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM scrim_goals WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── INDIVIDUAL GOALS ─────────────────────────────────────
app.get("/api/individual-goals", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM individual_goals ORDER BY session_date DESC, created_at DESC"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/individual-goals", requireAuth, async (req, res) => {
  try {
    const { player_id, title="", description="", progress=0, done=0, session_date="", session_label="" } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO individual_goals (player_id,title,description,progress,done,session_date,session_label) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [player_id,title,description,progress,done,session_date,session_label]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/individual-goals/:id", requireAuth, async (req, res) => {
  try {
    const { title, description, progress, done, session_date, session_label } = req.body;
    const { rows } = await pool.query(
      "UPDATE individual_goals SET title=$1,description=$2,progress=$3,done=$4,session_date=$5,session_label=$6 WHERE id=$7 RETURNING *",
      [title,description,progress,done,session_date||"",session_label||"",req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/individual-goals/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM individual_goals WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── REFLECTIONS ──────────────────────────────────────────
app.get("/api/reflections", requireAuth, async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM reflections ORDER BY created_at DESC"); res.json(rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/reflections", requireAuth, async (req, res) => {
  try {
    const { player_id, scrim_date="", mental=0, self=0, team=0, notes="" } = req.body;
    const { rows } = await pool.query("INSERT INTO reflections (player_id,scrim_date,mental,self,team,notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *", [player_id,scrim_date,mental,self,team,notes]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/reflections/:id", requireAuth, async (req, res) => {
  try {
    const { player_id, scrim_date, mental, self, team, notes } = req.body;
    const { rows } = await pool.query("UPDATE reflections SET player_id=$1,scrim_date=$2,mental=$3,self=$4,team=$5,notes=$6 WHERE id=$7 RETURNING *", [player_id,scrim_date,mental,self,team,notes,req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/reflections/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM reflections WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── NOTIFICATIONS ────────────────────────────────────────
// GET: fetch notifications for the logged-in user
app.get("/api/notifications", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM notifications WHERE username=$1 ORDER BY created_at DESC LIMIT 50",
      [req.user.username]
    );
    res.json(rows);
  } catch (err) { console.error("GET /api/notifications:", err.message); res.status(500).json({ error: err.message }); }
});
// POST: create a notification — looks up username from player.username field
app.post("/api/notifications", requireAuth, async (req, res) => {
  try {
    const { username, message, context="" } = req.body;
    if (!username) return res.status(400).json({ error: "username required" });
    // Verify the target user exists
    const { rows: uRows } = await pool.query("SELECT id FROM users WHERE username=$1", [username.trim().toLowerCase()]);
    if (!uRows[0]) return res.status(404).json({ error: "User not found" });
    const { rows } = await pool.query(
      "INSERT INTO notifications (username,message,context,read) VALUES ($1,$2,$3,0) RETURNING *",
      [username.trim().toLowerCase(), message, context]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// POST: mark all notifications as read for logged-in user
app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
  try {
    await pool.query("UPDATE notifications SET read=1 WHERE username=$1", [req.user.username]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── STRAT BOARDS ─────────────────────────────────────────
app.get("/api/strat-boards", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id,name,map,notes,created_at,updated_at FROM strat_boards ORDER BY updated_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get("/api/strat-boards/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM strat_boards WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/strat-boards", requireAuth, async (req, res) => {
  try {
    const { name="Untitled", map="Haven", strokes="[]", tokens="[]", notes="" } = req.body;
    const { rows } = await pool.query(
      "INSERT INTO strat_boards (name,map,strokes,tokens,notes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, map, strokes, tokens, notes]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/api/strat-boards/:id", requireAuth, async (req, res) => {
  try {
    const { name, map, strokes, tokens, notes } = req.body;
    const { rows } = await pool.query(
      "UPDATE strat_boards SET name=$1,map=$2,strokes=$3,tokens=$4,notes=$5,updated_at=NOW() WHERE id=$6 RETURNING *",
      [name, map, strokes, tokens, notes, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/strat-boards/:id", requireAuth, async (req, res) => {
  try { await pool.query("DELETE FROM strat_boards WHERE id=$1", [req.params.id]); res.json({ ok:true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/health", (req, res) => res.send("Racker API running ✅"));

// ONE-TIME MIGRATION: rename "Eco/Force" -> "Eco/Force/Set Plays"
app.post("/api/migrate/eco-force", requireAdmin, async (req, res) => {
  try {
    const r1 = await pool.query("UPDATE comp_strats SET category=$1 WHERE category=$2", ["Eco/Force/Set Plays","Eco/Force"]);
    const r2 = await pool.query("UPDATE comp_blocks SET category=$1 WHERE category=$2", ["Eco/Force/Set Plays","Eco/Force"]);
    res.json({ ok:true, strats_updated: r1.rowCount, blocks_updated: r2.rowCount });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

// ── VETO REPORTS ────────────────────────────────────────────────────────────
app.get("/api/veto-reports", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, opp_name, opp_id, format, summary, created_at FROM veto_reports ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/veto-reports", requireAuth, async (req, res) => {
  try {
    const { name, opp_name, opp_id, format, actions, opp_patterns, summary } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const { rows } = await pool.query(
      "INSERT INTO veto_reports (name, opp_name, opp_id, format, actions, opp_patterns, summary) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [name, opp_name||"", opp_id||"", format||"bo3", JSON.stringify(actions||[]), JSON.stringify(opp_patterns||[]), summary||""]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/veto-reports/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM veto_reports WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/veto-reports/:id", requireAuth, async (req, res) => {
  try {
    await pool.query("DELETE FROM veto_reports WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VETO DRAFT SUGGESTIONS ──────────────────────────────────────────────────
// POST /api/veto/draft-suggestions
// Body: { oppTeamId, oppPatterns } — oppPatterns is the patterns array from /api/veto/team/:id
// Returns two draft options (aggressive + safe) based on scrim win rates vs opponent pick patterns
app.post("/api/veto/draft-suggestions", requireAuth, async (req, res) => {
  try {
    const { oppPatterns, ourSide = "A", mapPool } = req.body;

    // Pull all scrims to compute per-map win rates (with recency weighting)
    const { rows: scrims } = await pool.query("SELECT map, res, date FROM scrims ORDER BY date DESC");

    const ALL_MAPS = ["Abyss","Ascent","Bind","Breeze","Corrode","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset"];
    // Use client-specified map pool if provided, else full list
    const MAPS = (Array.isArray(mapPool) && mapPool.length >= 5)
      ? ALL_MAPS.filter(m => mapPool.includes(m))
      : ALL_MAPS;
    const now = Date.now();
    const mapStats = {};
    MAPS.forEach(m => { mapStats[m] = { wins: 0, total: 0, weightedWins: 0, weightedTotal: 0 }; });

    scrims.forEach((s, idx) => {
      const m = s.map;
      if (!mapStats[m]) return;
      const isWin = s.res === "win";
      // Recency weight: most recent gets weight 1.0, older scrims decay by 0.92 per position
      const weight = Math.pow(0.92, idx);
      mapStats[m].wins    += isWin ? 1 : 0;
      mapStats[m].total   += 1;
      mapStats[m].weightedWins  += isWin ? weight : 0;
      mapStats[m].weightedTotal += weight;
    });

    // Build per-map score object
    const mapScores = {};
    MAPS.forEach(m => {
      const s = mapStats[m];
      const rawWR    = s.total > 0 ? (s.wins / s.total) * 100 : null;
      const weightedWR = s.weightedTotal > 0 ? (s.weightedWins / s.weightedTotal) * 100 : null;
      // Effective WR: 60% weighted + 40% raw (fallback to weighted if no raw)
      const effectiveWR = weightedWR != null && rawWR != null
        ? weightedWR * 0.6 + rawWR * 0.4
        : (weightedWR ?? rawWR ?? 50);
      mapScores[m] = { rawWR, weightedWR, effectiveWR, games: s.total };
    });

    // Build opponent tendency data from their patterns
    const oppData = {};
    MAPS.forEach(m => { oppData[m] = { oppPickRate: 0, oppBanRate: 0 }; });
    if (Array.isArray(oppPatterns)) {
      const totalSeries = oppPatterns.reduce((mx, p) => Math.max(mx, (p.ourBans||0)+(p.oppBans||0)+(p.ourPicks||0)+(p.oppPicks||0)), 0);
      const seriesEst = totalSeries || 1;
      oppPatterns.forEach(p => {
        if (!oppData[p.map]) return;
        const oppPicks = p.oppPicks || 0;
        const oppBans  = p.oppBans  || 0;
        // Normalise by a rough series count derived from max bans (each series has 2 bans per team = ~4 bans total)
        const rough = Math.max(oppPatterns.reduce((s, x) => s + (x.oppBans||0), 0), 1);
        oppData[p.map].oppPickRate = oppPicks / rough;
        oppData[p.map].oppBanRate  = oppBans  / rough;
      });
    }

    // ── Scoring algorithm ──
    // BAN candidates: high opp pick rate + our low win rate = best to ban
    // PICK candidates: high our win rate + opp doesn't ban it often = best to pick
    const banScore = (map) => {
      const opp = oppData[map];
      const wr  = mapScores[map].effectiveWR;
      // Opp picks it a lot AND we're weak on it → strong ban
      return (opp.oppPickRate * 60) + Math.max(0, 50 - wr) * 0.8;
    };
    const pickScore = (map) => {
      const opp = oppData[map];
      const wr  = mapScores[map].effectiveWR;
      // We win it a lot AND opp doesn't ban it → strong pick
      return (wr * 0.9) - (opp.oppBanRate * 50);
    };

    const ranked = MAPS.map(m => ({
      map: m,
      banScore:  banScore(m),
      pickScore: pickScore(m),
      ourWR:     mapScores[m].effectiveWR,
      rawWR:     mapScores[m].rawWR,
      games:     mapScores[m].games,
      oppPickRate: oppData[m].oppPickRate,
      oppBanRate:  oppData[m].oppBanRate,
    })).sort((a,b) => b.banScore - a.banScore);

    // BO3: A ban1, B ban2, A pick1, B pick2, A ban3, B ban4, decider
    // Team A: ban1 + pick1 + ban3  |  Team B: ban2 + pick2 + ban4
    // We simulate the full 7-step sequence, making OUR moves optimally and estimating opp moves
    const buildDraft = (aggressive=false) => {
      const remaining = [...MAPS];
      const bans1 = [], picks = [], bans2 = [];

      // Opp ban estimates — maps they most likely ban (high oppBanRate)
      const oppBanOrder = [...ranked].sort((a,b) => b.oppBanRate - a.oppBanRate).map(c => c.map);

      if (ourSide === "A") {
        // Step 1: OUR ban (ban1)
        const ban1 = [...ranked].sort((a,b) => b.banScore - a.banScore).find(c => remaining.includes(c.map));
        if (ban1) { bans1.push({ map: ban1.map, action:"ban", reason: `Opp picks frequently (${Math.round(ban1.oppPickRate*100)}% rate), our WR ${ban1.rawWR != null ? Math.round(ban1.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban1.map), 1); }
        // Step 2: Opp ban (estimate)
        const oppBan1 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan1) remaining.splice(remaining.indexOf(oppBan1), 1);
        // Step 3: OUR pick (pick1)
        const pick1 = [...remaining].map(m => ({ map:m, score: pickScore(m), ...mapScores[m], ...oppData[m] })).sort((a,b) => b.score - a.score)[0];
        if (pick1) { picks.push({ map: pick1.map, action:"pick", reason: `Our WR ${pick1.rawWR != null ? Math.round(pick1.rawWR)+"%" : "no data"}, opp ban rate low (${Math.round(pick1.oppBanRate*100)}%)` }); remaining.splice(remaining.indexOf(pick1.map), 1); }
        // Step 4: Opp pick (estimate — their best map)
        const oppPick1 = [...remaining].map(m => ({ map:m, ...oppData[m] })).sort((a,b) => b.oppPickRate - a.oppPickRate)[0];
        if (oppPick1) remaining.splice(remaining.indexOf(oppPick1.map), 1);
        // Step 5: OUR ban (ban3)
        const ban3 = [...remaining].map(m => ({ map:m, ...mapScores[m], ...oppData[m] })).sort((a,b) => b.banScore - a.banScore)[0];
        if (ban3) { bans2.push({ map: ban3.map, action:"ban", reason: `Second ban — opp pick rate ${Math.round(ban3.oppPickRate*100)}%, our WR ${ban3.rawWR != null ? Math.round(ban3.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban3.map), 1); }
        // Step 6: Opp ban (estimate)
        const oppBan2 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan2) remaining.splice(remaining.indexOf(oppBan2), 1);
      } else {
        // Team B: Opp ban1, OUR ban2, Opp pick1, OUR pick2, Opp ban3, OUR ban4
        // Step 1: Opp ban (estimate)
        const oppBan1 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan1) remaining.splice(remaining.indexOf(oppBan1), 1);
        // Step 2: OUR ban (ban2)
        const ban2 = [...ranked].sort((a,b) => b.banScore - a.banScore).find(c => remaining.includes(c.map));
        if (ban2) { bans1.push({ map: ban2.map, action:"ban", reason: `Opp picks frequently (${Math.round(ban2.oppPickRate*100)}% rate), our WR ${ban2.rawWR != null ? Math.round(ban2.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban2.map), 1); }
        // Step 3: Opp pick (estimate)
        const oppPick1 = [...remaining].map(m => ({ map:m, ...oppData[m] })).sort((a,b) => b.oppPickRate - a.oppPickRate)[0];
        if (oppPick1) remaining.splice(remaining.indexOf(oppPick1.map), 1);
        // Step 4: OUR pick (pick2)
        const safeScoreFn = aggressive
          ? (m) => pickScore(m)
          : (m) => { const opp = oppData[m]; return mapScores[m].effectiveWR * 0.8 - opp.oppBanRate * 60 - opp.oppPickRate * 20; };
        const pick2 = [...remaining].map(m => ({ map:m, score: safeScoreFn(m), ...mapScores[m], ...oppData[m] })).sort((a,b) => b.score - a.score)[0];
        if (pick2) { picks.push({ map: pick2.map, action:"pick", reason: `Our WR ${pick2.rawWR != null ? Math.round(pick2.rawWR)+"%" : "no data"}, opp ban rate low (${Math.round(pick2.oppBanRate*100)}%)` }); remaining.splice(remaining.indexOf(pick2.map), 1); }
        // Step 5: Opp ban (estimate)
        const oppBan2 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan2) remaining.splice(remaining.indexOf(oppBan2), 1);
        // Step 6: OUR ban (ban4)
        const ban4 = [...remaining].map(m => ({ map:m, ...mapScores[m], ...oppData[m] })).sort((a,b) => b.banScore - a.banScore)[0];
        if (ban4) { bans2.push({ map: ban4.map, action:"ban", reason: `Second ban — opp pick rate ${Math.round(ban4.oppPickRate*100)}%, our WR ${ban4.rawWR != null ? Math.round(ban4.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban4.map), 1); }
      }

      return { bans1, picks, bans2, decider: remaining[0] || null };
    };

    const buildSafe = () => {
      const remaining = [...MAPS];
      const bans1 = [], picks = [], bans2 = [];
      const oppBanOrder = [...ranked].sort((a,b) => b.oppBanRate - a.oppBanRate).map(c => c.map);
      const safeScore = (m) => { const opp = oppData[m]; return mapScores[m].effectiveWR * 0.8 - opp.oppBanRate * 60 - opp.oppPickRate * 20; };

      if (ourSide === "A") {
        const ban1 = [...ranked].sort((a,b) => b.banScore - a.banScore).find(c => remaining.includes(c.map));
        if (ban1) { bans1.push({ map: ban1.map, action:"ban", reason: `Opp picks frequently (${Math.round(ban1.oppPickRate*100)}% rate), our WR ${ban1.rawWR != null ? Math.round(ban1.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban1.map), 1); }
        const oppBan1 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan1) remaining.splice(remaining.indexOf(oppBan1), 1);
        const pick1 = [...remaining].map(m => ({ map:m, score: safeScore(m), ...mapScores[m], ...oppData[m] })).sort((a,b) => b.score - a.score)[0];
        if (pick1) { picks.push({ map: pick1.map, action:"pick", reason: `Our WR ${pick1.rawWR != null ? Math.round(pick1.rawWR)+"%" : "no data"}, low opp interest` }); remaining.splice(remaining.indexOf(pick1.map), 1); }
        const oppPick1 = [...remaining].map(m => ({ map:m, ...oppData[m] })).sort((a,b) => b.oppPickRate - a.oppPickRate)[0];
        if (oppPick1) remaining.splice(remaining.indexOf(oppPick1.map), 1);
        const ban3 = [...remaining].map(m => ({ map:m, ...mapScores[m], ...oppData[m] })).sort((a,b) => b.banScore - a.banScore)[0];
        if (ban3) { bans2.push({ map: ban3.map, action:"ban", reason: `Second ban — opp pick rate ${Math.round(ban3.oppPickRate*100)}%, our WR ${ban3.rawWR != null ? Math.round(ban3.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban3.map), 1); }
        const oppBan2 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan2) remaining.splice(remaining.indexOf(oppBan2), 1);
      } else {
        const oppBan1 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan1) remaining.splice(remaining.indexOf(oppBan1), 1);
        const ban2 = [...ranked].sort((a,b) => b.banScore - a.banScore).find(c => remaining.includes(c.map));
        if (ban2) { bans1.push({ map: ban2.map, action:"ban", reason: `Opp picks frequently (${Math.round(ban2.oppPickRate*100)}% rate), our WR ${ban2.rawWR != null ? Math.round(ban2.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban2.map), 1); }
        const oppPick1 = [...remaining].map(m => ({ map:m, ...oppData[m] })).sort((a,b) => b.oppPickRate - a.oppPickRate)[0];
        if (oppPick1) remaining.splice(remaining.indexOf(oppPick1.map), 1);
        const pick2 = [...remaining].map(m => ({ map:m, score: safeScore(m), ...mapScores[m], ...oppData[m] })).sort((a,b) => b.score - a.score)[0];
        if (pick2) { picks.push({ map: pick2.map, action:"pick", reason: `Our WR ${pick2.rawWR != null ? Math.round(pick2.rawWR)+"%" : "no data"}, low opp interest` }); remaining.splice(remaining.indexOf(pick2.map), 1); }
        const oppBan2 = oppBanOrder.find(m => remaining.includes(m));
        if (oppBan2) remaining.splice(remaining.indexOf(oppBan2), 1);
        const ban4 = [...remaining].map(m => ({ map:m, ...mapScores[m], ...oppData[m] })).sort((a,b) => b.banScore - a.banScore)[0];
        if (ban4) { bans2.push({ map: ban4.map, action:"ban", reason: `Second ban — opp pick rate ${Math.round(ban4.oppPickRate*100)}%, our WR ${ban4.rawWR != null ? Math.round(ban4.rawWR)+"%" : "no data"}` }); remaining.splice(remaining.indexOf(ban4.map), 1); }
      }

      return { bans1, picks, bans2, decider: remaining[0] || null };
    };

    const optionA = buildDraft(true);
    const optionB = buildSafe();

    res.json({
      optionA: { label:"Aggressive", desc:"Maximises your strongest maps", ...optionA },
      optionB: { label:"Safe",       desc:"Avoids maps opp knows well",    ...optionB },
      mapScores,
      hasScrimData: scrims.length > 0,
      totalScrims: scrims.length,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Vercel serverless export — wrap with DB init
module.exports = async (req, res) => {
  await initDB();
  return app(req, res);
};

// Local / Fly.io server
if (require.main === module) {
  const PORT = process.env.PORT || 8080;
  initDB().then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  });
}

// ── RAW RIOT JSON IMPORT ─────────────────────────────────
const AGENT_MAP = {
  // Verified April 2026 against Riot match data + community sources
  // Killjoy
  "1e58de9c-4950-5125-93e9-a0aee9f98746":"Killjoy",
  // Skye
  "6f2a04ca-43e0-be17-7f36-b3908627744d":"Skye",
  // Cypher
  "117ed9e3-49f3-6512-3ccf-0cada7e3823b":"Cypher",
  // Sova (two variants — playable + NPE)
  "320b2a48-4d9b-a075-30f1-1f93a9b638fa":"Sova",
  "ded3520f-4264-bfed-162d-b080e2abccf9":"Sova",
  // Breach
  "5f8d3a7f-467b-97f3-062c-13acf203c006":"Breach",
  // Raze (two variants)
  "6eeb8f1b-4f5d-0045-0178-c5a3fd36bfd8":"Raze",
  "f94c3b30-42be-e959-889c-5aa313dba261":"Raze",
  // Reyna
  "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc":"Reyna",
  // Brimstone
  "9f0d8ba9-4140-b941-57d3-a7ad57c6b417":"Brimstone",
  // Yoru (two variants)
  "7f94d92c-4234-0a36-9646-3a87eb8b5eef":"Yoru",
  "7f94d92c-4234-0a36-9646-3a87eb8b5c89":"Yoru",
  // Phoenix (two variants)
  "eb93336a-449b-9c1e-0ac7-dc338614f4db":"Phoenix",
  "eb93336a-449b-9c1b-0a54-a891f7921d69":"Phoenix",
  // Astra
  "41fb69c1-4189-7b37-f117-bcaf1e96f1bf":"Astra",
  // Omen
  "8e253930-4c05-31dd-1b6c-968525494517":"Omen",
  // Fade
  "dade69b4-4f5a-8528-247b-219e5a1facd6":"Fade",
  // Chamber
  "22697a3d-45bf-8dd7-4fec-84a9e28c69d7":"Chamber",
  // Neon
  "bb2a4828-46eb-8cd1-e765-15848195d751":"Neon",
  // KAYO
  "601dbbe7-43ce-be57-2a40-4abd24953621":"KAY/O",
  // Harbor
  "95b78ed7-4637-86d9-7e41-71ba8c293152":"Harbor",
  // Gekko
  "e370fa57-4757-3604-3648-499e1f642d3f":"Gekko",
  // Deadlock
  "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235":"Deadlock",
  // Clove
  "1dbf2edd-4729-0984-3115-daa5eed44993":"Clove",
  // Sage
  "569fdd95-4d10-43ab-ca70-79becc718b46":"Sage",
  // Viper
  "707eab51-4836-f488-046a-cda6bf494859":"Viper",
  // Tejo
  "b444168c-4e35-8076-db47-ef9bf368f384":"Tejo",
  // Waylay
  "df1cb487-4902-002e-5c17-d28e83e78588":"Waylay",
  // Vyse
  "efba5359-4016-a1e5-7626-b1ae76895940":"Vyse",
  // Jett
  "add6443a-41bd-e414-f6ad-e58d267f4e95":"Jett",
  // Iso
  "0e38b510-41a8-5780-5e8f-568b2a4f2d6c":"Iso",
  // Killjoy (extra variant)
  "1dbf2edd-4729-0984-3115-daa5eed44993":"Killjoy",
  // Miks
  "7c8a4701-4de6-9355-b254-e09bc2a34b72":"Miks",
  // Veto
  "92eeef5d-43b5-1d4a-8d03-b3927a09034b":"Veto",
  // Phoenix extra variant
  "eb93336a-449b-9c1b-0a54-a891f7921d69":"Phoenix",
};

// MAP_DATA: mapUrl (from Riot matchInfo.mapId) → minimap image + coordinate transform scalars
// Fetched once at startup from valorant-api.com so the heatmap can overlay dots on the real minimap
const MAP_DATA = {};
(async () => {
  try {
    const r = await fetch("https://valorant-api.com/v1/maps");
    if (!r.ok) return;
    const { data } = await r.json();
    for (const m of (data || [])) {
      if (m.mapUrl) {
        MAP_DATA[m.mapUrl] = {
          name:    m.displayName,
          icon:    m.displayIcon,       // overhead minimap image URL
          xMult:   m.xMultiplier,       // Riot game coord → 0-1 normalised
          yMult:   m.yMultiplier,
          xScalar: m.xScalarToAdd,
          yScalar: m.yScalarToAdd,
        };
      }
    }
    console.log(`[MAP_DATA] Loaded ${Object.keys(MAP_DATA).length} maps from valorant-api.com`);
    // Backfill map_meta for any scrims that were imported before MAP_DATA was ready
    try {
      const { rows: noMeta } = await pool.query(`SELECT id, map FROM scrims WHERE map_meta IS NULL`);
      for (const row of noMeta) {
        const entry = Object.values(MAP_DATA).find(m => m.name === row.map);
        if (entry) await pool.query(`UPDATE scrims SET map_meta = $1 WHERE id = $2`, [JSON.stringify(entry), row.id]);
      }
      if (noMeta.length > 0) console.log(`[backfill] map_meta set for ${noMeta.length} scrims`);
    } catch {}
  } catch (e) {
    console.warn("[MAP_DATA] fetch failed:", e.message);
  }
})();

function resolvePlayerName(player) {
  // Cover all known Riot API field variants:
  //   v1/v2 in-game API:   player.gameName / player.tagLine
  //   identity nested:     player.identity.gameName / player.identity.tagLine
  //   newer in-game API:   player.riotIdGameName / player.riotIdTagline
  //   Henrik v4:           player.name / player.tag
  const gn = player?.gameName
    || player?.identity?.gameName
    || player?.riotIdGameName
    || player?.name
    || "";
  const tl = player?.tagLine
    || player?.identity?.tagLine
    || player?.riotIdTagline
    || player?.riotIdTagLine
    || player?.tag
    || "";
  if (gn) return tl ? `${gn}#${tl}` : gn;
  return player?.subject?.slice(0, 8) || "?";
}

// Resolve PUUIDs → gameName#tagLine via Henrik API (best-effort, silent on failure)
async function resolveNamesViaHenrik(puuids) {
  const nameMap = {};
  if (!puuids || puuids.length === 0) return nameMap;
  try {
    const { rows } = await pool.query("SELECT value FROM settings WHERE key='henrik_api_key'");
    const apiKey = rows[0]?.value || "";
    if (!apiKey) return nameMap;
    // Henrik v1 account-by-puuid endpoint
    await Promise.all(puuids.map(async (puuid) => {
      try {
        const r = await fetch(`https://api.henrikdev.xyz/valorant/v1/by-puuid/account/${puuid}`, {
          headers: { Authorization: apiKey }
        });
        if (!r.ok) return;
        const d = await r.json();
        const gn = d?.data?.name || d?.data?.gameName || "";
        const tl = d?.data?.tag  || d?.data?.tagLine  || "";
        if (gn) nameMap[puuid] = tl ? `${gn}#${tl}` : gn;
      } catch { /* silent */ }
    }));
  } catch { /* silent */ }
  return nameMap;
}

async function parseRiotMatch(matchData, myTeamId) {
  const info = matchData.matchInfo;
  const players = (matchData.players || []).filter(p => !p.isObserver);

  // If any player is missing a name (only has subject/PUUID), resolve via Henrik API
  const missingNames = players.filter(p => !resolvePlayerName(p).includes("#") && !p.gameName && !p.riotIdGameName && !p.name && !p.identity?.gameName);
  const puuidNameMap = missingNames.length > 0
    ? await resolveNamesViaHenrik(missingNames.map(p => p.subject))
    : {};
  // Patch resolved names back onto player objects
  if (Object.keys(puuidNameMap).length > 0) {
    players.forEach(p => {
      if (puuidNameMap[p.subject]) {
        const [gn, tl] = puuidNameMap[p.subject].split("#");
        p.gameName = gn;
        p.tagLine  = tl || "";
      }
    });
  }
  const teams = matchData.teams || [];
  const rounds = matchData.roundResults || [];
  const allKills = matchData.kills || []; // may be empty for in-game API format

  // Map name
  const mapParts = (info.mapId || "").split("/").filter(Boolean);
  const mapRaw = mapParts[mapParts.length - 2] || mapParts[mapParts.length - 1] || "Unknown";
  const MAP_DISPLAY = { Duality:"Bind", Bonsai:"Split", Canyon:"Fracture", Foxtrot:"Breeze",
    Port:"Icebox", Triad:"Haven", Pitt:"Pearl", Jam:"Lotus", Juliett:"Sunset",
    Infinity:"Abyss", Ascent:"Ascent" };
  const map = MAP_DISPLAY[mapRaw] || mapRaw;

  // Date
  const date = new Date(info.gameStartMillis).toISOString().split("T")[0];

  // Teams
  const blueTeam = teams.find(t => t.teamId === "Blue") || {};
  const redTeam  = teams.find(t => t.teamId === "Red")  || {};
  const ourTeamId = myTeamId || "Blue";
  const ourTeam   = ourTeamId === "Blue" ? blueTeam : redTeam;
  const theirTeam = ourTeamId === "Blue" ? redTeam  : blueTeam;
  const ourScore   = ourTeam.roundsWon   || 0;
  const theirScore = theirTeam.roundsWon || 0;
  const result = ourTeam.won ? "win" : "loss";

  // Round history for round pips
  const roundPips = rounds.map(r => r.winningTeam === ourTeamId ? "w" : "l");

  // Round detail (site, outcome, firstBlood, planterTeam, winnerIsOurs, xvy)
  const roundDetail = rounds.map((r, roundIdx) => {
    // Collect all kills this round — prefer top-level kills array (Henrik format),
    // fall back to nested roundResults[].playerStats[].kills[] (in-game API format)
    let roundKills;
    if (allKills.length > 0) {
      roundKills = allKills
        .filter(k => k.round === roundIdx)
        .sort((a,b) => a.roundTime - b.roundTime)
        .map(k => ({ killer: k.killer, victim: k.victim, roundTime: k.roundTime, finishingDamage: k.finishingDamage, assistants: k.assistants || [] }));
    } else {
      roundKills = [];
      (r.playerStats || []).forEach(ps => {
        (ps.kills || []).forEach(k => {
          roundKills.push({ killer: ps.subject, victim: k.victim, roundTime: k.roundTime, finishingDamage: k.finishingDamage, assistants: k.assistants || [] });
        });
      });
      roundKills.sort((a,b) => a.roundTime - b.roundTime);
    }

    // First blood: first kill of the round
    let firstBlood = null;
    if (roundKills.length > 0) {
      const fk = roundKills[0];
      const killer = players.find(p => p.subject === fk.killer);
      const victim = players.find(p => p.subject === fk.victim);
      firstBlood = {
        killerName:  killer ? resolvePlayerName(killer).split("#")[0] : killer?.subject?.slice(0,8) || "?",
        killerAgent: getAgentName(killer?.characterId),
        killerTeam:  killer?.teamId || null,
        victimName:  victim ? resolvePlayerName(victim).split("#")[0] : victim?.subject?.slice(0,8) || "?",
        victimAgent: getAgentName(victim?.characterId),
        victimTeam:  victim?.teamId || null,
      };
    }

    // XvY: alive counts at end of round (before round ends)
    // Count how many of each team were NOT killed during this round
    const killedPuuids = new Set(roundKills.map(k => k.victim));
    const ourAlive   = players.filter(p => p.teamId === ourTeamId  && !killedPuuids.has(p.subject)).length;
    const theirAlive = players.filter(p => p.teamId !== ourTeamId  && !killedPuuids.has(p.subject)).length;
    const xvy = `${ourAlive}v${theirAlive}`;

    const planterPuuid = r.bombPlanter || null;
    const planterPlayer = planterPuuid ? players.find(p => p.subject === planterPuuid) : null;
    const planterTeam = planterPlayer?.teamId || null;
    const winnerIsOurs = r.winningTeam === ourTeamId;

    // Ult status: collect orb count per player for this round
    // Riot API v1: roundResults[].playerStats[].economy.ultimateStatus = orbs charged
    // Riot API v2/Henrik: roundResults[].playerStats[].ultimateStatus = orbs charged
    const ultStatus = {};
    (r.playerStats || []).forEach(ps => {
      const puuid = ps.subject;
      const orbs = ps.economy?.ultimateStatus ?? ps.ultimateStatus ?? null;
      const maxOrbs = ps.economy?.ultimateMaxOrbs ?? ps.ultimateMaxOrbs ?? null;
      if (puuid) {
        const player = players.find(p => p.subject === puuid);
        ultStatus[puuid] = {
          name: player ? resolvePlayerName(player) : puuid.slice(0,8),
          agent: getAgentName(player?.characterId),
          side: player?.teamId === ourTeamId ? "blue" : "red",
          orbs: orbs,
          maxOrbs: maxOrbs,
          ready: (maxOrbs !== null && orbs !== null) ? orbs >= maxOrbs : null,
        };
      }
    });

    return {
      roundNum: roundIdx,
      site:        r.plantSite || null,
      outcome:     r.roundResultCode === "Defuse" ? "Defuse" : r.roundResultCode === "Detonate" ? "Detonate" : null,
      winner:      r.winningTeam,
      winnerIsOurs,
      planted:     !!planterPuuid,
      planterTeam,
      firstBlood,
      xvy,
      ultStatus,
      kills:       roundKills.map(k => ({
        killerName: (() => { const p = players.find(p=>p.subject===k.killer); return p ? resolvePlayerName(p) : k.killer?.slice(0,8); })(),
        victimName: (() => { const p = players.find(p=>p.subject===k.victim); return p ? resolvePlayerName(p) : k.victim?.slice(0,8); })(),
        killerTeam: players.find(p=>p.subject===k.killer)?.teamId || null,
        victimTeam: players.find(p=>p.subject===k.victim)?.teamId || null,
        weapon: k.finishingDamage?.damageItem || null,
        time: k.roundTime,
        assistants: (k.assistants || []).map(aid => {
          const ap = players.find(p => p.subject === aid);
          return ap ? resolvePlayerName(ap) : aid;
        }),
      })),
    };
  });

  // Per-player stats
  function getAgentName(charId) {
    if (!charId) return "Unknown";
    return AGENT_MAP[charId] || AGENT_MAP[charId.toLowerCase()] || charId.slice(0,8) || "Unknown";
  }

  function computePlayerStats(player) {
    const puuid = player.subject;
    const s = player.stats || {};
    const rp = s.roundsPlayed || 1;
    const acs = Math.round((s.score || 0) / rp);
    const kills = s.kills || 0;
    const deaths = s.deaths || 0;
    const assists = s.assists || 0;
    const kd = deaths > 0 ? Math.round((kills / deaths) * 100) / 100 : kills;

    // Headshots and total damage from round damage
    let hs = 0, bs = 0, ls = 0, totalDamage = 0;
    rounds.forEach(r => {
      const ps = (r.playerStats || []).find(p => p.subject === puuid);
      if (!ps) return;
      (ps.damage || []).forEach(d => { hs += d.headshots || 0; bs += d.bodyshots || 0; ls += d.legshots || 0; totalDamage += d.damage || 0; });
    });
    const totalShots = hs + bs + ls;
    const hsRate = totalShots > 0 ? Math.round((hs / totalShots) * 100) : 0;
    const adr = Math.round(totalDamage / rp);

    // First bloods and first deaths
    let firstBloods = 0, firstDeaths = 0;
    rounds.forEach(r => {
      const killsInRound = [];
      (r.playerStats || []).forEach(ps => (ps.kills || []).forEach(k => killsInRound.push(k)));
      killsInRound.sort((a, b) => a.roundTime - b.roundTime);
      if (killsInRound.length > 0) {
        if (killsInRound[0].killer === puuid) firstBloods++;
        if (killsInRound[0].victim === puuid) firstDeaths++;
      }
    });

    // Plants and defuses
    let plants = 0, defuses = 0;
    rounds.forEach(r => { if (r.bombPlanter === puuid) plants++; if (r.bombDefuser === puuid) defuses++; });

    // Multi-kills (2K, 3K, 4K, 5K per round)
    let mk2 = 0, mk3 = 0, mk4 = 0, mk5 = 0;
    rounds.forEach(r => {
      const ps = (r.playerStats || []).find(p => p.subject === puuid);
      const k = (ps?.kills || []).length;
      if (k === 2) mk2++; else if (k === 3) mk3++; else if (k === 4) mk4++; else if (k >= 5) mk5++;
    });

    // Clutches: rounds where player was last alive on team and won
    let clutchWon = 0;
    rounds.forEach(r => {
      const winTeam = r.winningTeam;
      if (winTeam !== player.teamId) return; // only count won rounds
      // Find how many alive at some point in round on player's team
      const teamPuuids = players.filter(p => p.teamId === player.teamId).map(p => p.subject);
      const deadOnTeam = new Set();
      const killsInRound = [];
      (r.playerStats || []).forEach(ps => (ps.kills || []).forEach(k => killsInRound.push(k)));
      killsInRound.sort((a, b) => a.roundTime - b.roundTime);
      // Check if player was ever the last alive
      for (const k of killsInRound) {
        if (teamPuuids.includes(k.victim) && k.victim !== puuid) deadOnTeam.add(k.victim);
        // At this moment, if all teammates dead and player alive → clutch situation
        if (deadOnTeam.size === teamPuuids.length - 1 && !deadOnTeam.has(puuid)) {
          // Player survived → clutch won (round was won by player's team)
          clutchWon++;
          break;
        }
      }
    });

    // Retakes: our team won a round where bomb was planted (on defense)
    let retakes = 0;
    if (player.teamId === ourTeamId) {
      rounds.forEach(r => {
        if (r.bombPlanter && r.winningTeam === ourTeamId) {
          // Our team won after plant — retake on defense
          const ourSide = roundDetail[r.roundNum]?.winner === ourTeamId ? "won" : "lost";
          if (r.winningTeam === ourTeamId && r.bombPlanter) retakes++;
        }
      });
    }

    // Post-plant: rounds where bomb planted and our team won on attack
    let postPlantWon = 0;
    if (player.teamId === ourTeamId) {
      rounds.forEach(r => {
        if (r.bombPlanter && r.winningTeam === ourTeamId && r.roundResultCode === "Detonate") postPlantWon++;
      });
    }

    return {
      name: resolvePlayerName(player),
      agent: getAgentName(player.characterId),
      side: player.teamId === ourTeamId ? "blue" : "red",
      team: player.teamId,
      acs, kills, deaths, assists,
      kd: Math.round(kd * 100) / 100,
      adr, hsRate, firstBloods, firstDeaths, plants, defuses,
      mk2, mk3, mk4, mk5, clutchWon, retakes, postPlantWon,
      roundsPlayed: rp,
    };
  }

  const playerStats = players.map(computePlayerStats);
  const ourPlayers = playerStats.filter(p => p.side === "blue");
  const comp = JSON.stringify(ourPlayers.slice(0,5).map(p => p.agent));

  // Team-level retake and post-plant stats
  const teamRetakes = rounds.filter(r => r.bombPlanter && r.winningTeam === ourTeamId).length;
  const teamPostPlantWon = rounds.filter(r => r.bombPlanter && r.winningTeam === ourTeamId && r.roundResultCode === "Detonate").length;
  const teamPostPlantLost = rounds.filter(r => r.bombPlanter && r.winningTeam !== ourTeamId && r.roundResultCode === "Detonate").length;

  const opp = players.filter(p => p.teamId !== ourTeamId)[0];
  const oppName = opp ? resolvePlayerName(opp).split("#")[0] : "Opponent";

  // Kill positions for heatmap (victim locations per team)
  // The in-game API (match-details/v1) does NOT have a top-level kills array —
  // kills are nested in roundResults[].playerStats[].kills[].
  // Build a flat kills list from that structure; fall back to matchData.kills
  // if it exists (e.g. Henrik API format).
  const flatKills = [];
  if (Array.isArray(matchData.kills) && matchData.kills.length > 0) {
    // Henrik / public Riot API format: top-level kills array
    matchData.kills.forEach(k => flatKills.push({
      killerPuuid: k.killer,
      victimPuuid: k.victim,
      x: k.victimLocation?.x ?? 0,
      y: k.victimLocation?.y ?? 0,
      round: k.round,
      roundTime: k.roundTime,
    }));
  } else {
    // In-game API format: kills nested per player per round
    rounds.forEach((r, roundIdx) => {
      (r.playerStats || []).forEach(ps => {
        (ps.kills || []).forEach(k => {
          flatKills.push({
            killerPuuid: ps.subject,          // the player whose stat block this is = killer
            victimPuuid: k.victim,
            x: k.victimLocation?.x ?? 0,
            y: k.victimLocation?.y ?? 0,
            round: roundIdx,
            roundTime: k.roundTime,
          });
        });
      });
    });
  }

  const killPositions = flatKills.map(k => {
    const killerPlayer = players.find(p => p.subject === k.killerPuuid);
    const victimPlayer = players.find(p => p.subject === k.victimPuuid);
    return {
      x: k.x,
      y: k.y,
      round: k.round,
      roundTime: k.roundTime,
      killerTeam: killerPlayer?.teamId || null,
      victimTeam: victimPlayer?.teamId || null,
      isOurKill:  killerPlayer?.teamId === ourTeamId,
      isOurDeath: victimPlayer?.teamId === ourTeamId,
    };
  }).filter(k => k.x !== 0 || k.y !== 0); // drop kills with no location data

  // map_meta: minimap image + coordinate transform for heatmap overlay
  // Use MAP_DATA if already loaded; if not yet loaded (race condition), fetch synchronously.
  let mapMeta = MAP_DATA[info.mapId] || null;
  if (!mapMeta) {
    try {
      const r = await fetch("https://valorant-api.com/v1/maps");
      if (r.ok) {
        const { data } = await r.json();
        for (const m of (data || [])) {
          if (m.mapUrl) {
            MAP_DATA[m.mapUrl] = { name:m.displayName, icon:m.displayIcon, xMult:m.xMultiplier, yMult:m.yMultiplier, xScalar:m.xScalarToAdd, yScalar:m.yScalarToAdd };
          }
        }
        mapMeta = MAP_DATA[info.mapId] || null;
      }
    } catch {}
  }

  // Determine which team attacked in H1 by finding the first bomb plant.
  // The planting team is always ATK. Search rounds 0-11 for the first plant.
  // Fall back to Blue=ATK (standard ranked) only if no plants found in H1.
  let atkTeamId = null;
  for (let i = 0; i < Math.min(12, rounds.length); i++) {
    const planterPuuid = rounds[i].bombPlanter;
    if (planterPuuid) {
      const planterPlayer = players.find(p => p.subject === planterPuuid);
      if (planterPlayer?.teamId) { atkTeamId = planterPlayer.teamId; break; }
    }
  }
  // If no plant found in H1 (e.g. all eco rounds), try H2 and flip
  if (!atkTeamId) {
    for (let i = 12; i < Math.min(24, rounds.length); i++) {
      const planterPuuid = rounds[i].bombPlanter;
      if (planterPuuid) {
        const planterPlayer = players.find(p => p.subject === planterPuuid);
        // H2 planter is DEF in H1 (sides flip), so ATK in H1 is the other team
        if (planterPlayer?.teamId) { atkTeamId = planterPlayer.teamId === "Blue" ? "Red" : "Blue"; break; }
      }
    }
  }
  // Final fallback: Blue attacks first (standard Valorant default)
  if (!atkTeamId) atkTeamId = "Blue";
  const atkFirst = atkTeamId === ourTeamId;

  return {
    date, map,
    opp: oppName,
    comp,
    score: `${ourScore}-${theirScore}`,
    res: result,
    rounds: JSON.stringify(roundPips),
    player_stats: JSON.stringify(playerStats),
    round_detail: JSON.stringify(roundDetail),
    kill_positions: JSON.stringify(killPositions),
    map_meta: mapMeta ? JSON.stringify(mapMeta) : null,
    atk_first: atkFirst,
    source: "riot_raw",
    _meta: { teamRetakes, teamPostPlantWon, teamPostPlantLost }
  };
}

// Parse-only: returns parsed data without inserting into DB
app.post("/api/scrims/parse-raw", requireAuth, async (req, res) => {
  try {
    const { matchData, myTeamId = "Blue" } = req.body;
    if (!matchData?.matchInfo) return res.status(400).json({ error: "matchData with matchInfo required" });
    const parsed = await parseRiotMatch(matchData, myTeamId);
    res.json({ ...parsed, _meta: parsed._meta });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/scrims/import-raw", requireAuth, async (req, res) => {
  try {
    const { matchData, myTeamId = "Blue" } = req.body;
    if (!matchData?.matchInfo) return res.status(400).json({ error: "matchData with matchInfo required" });
    const parsed = await parseRiotMatch(matchData, myTeamId);
    const { rows } = await pool.query(
      "INSERT INTO scrims (date,map,opp,comp,score,res,rounds,player_stats,round_detail,kill_positions,map_meta,atk_first,source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
      [parsed.date, parsed.map, parsed.opp, parsed.comp, parsed.score, parsed.res, parsed.rounds, parsed.player_stats, parsed.round_detail, parsed.kill_positions||'[]', parsed.map_meta||null, parsed.atk_first, parsed.source]
    );
    res.json({ ...rows[0], _meta: parsed._meta });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── VLR.GG MAP VETO SCRAPER ──────────────────────────────────────────────────
// Proxy scrape VLR.GG server-side to avoid CORS restrictions in the browser.
// ── VLR.GG MAP VETO SCRAPER ──────────────────────────────────────────────────
// Correct URLs (from vlrdevapi.pages.dev docs):
//   Search:           https://www.vlr.gg/search/?q=<q>&type=teams
//   Team info:        https://www.vlr.gg/team/<id>
//   Completed matches:https://www.vlr.gg/team/matches/<id>?group=completed
//   Match page:       https://www.vlr.gg/<matchId>/

const ALL_MAPS_VETO = ["Abyss","Ascent","Bind","Breeze","Corrode","Fracture","Haven","Icebox","Lotus","Pearl","Split","Sunset"];

async function vlrFetch(path) {
  const target = `https://www.vlr.gg${path}`;
  const proxies = [
    async () => {
      const r = await fetch(target, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Referer": "https://www.vlr.gg/",
        },
      });
      if (!r.ok) throw new Error(`direct ${r.status}`);
      const text = await r.text();
      if (text.includes("cf-browser-verification") || text.includes("Just a moment") || text.includes("Enable JavaScript"))
        throw new Error("direct: Cloudflare challenge");
      return text;
    },
    async () => {
      const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`);
      if (!r.ok) throw new Error(`allorigins ${r.status}`);
      const j = await r.json();
      if (!j.contents) throw new Error("allorigins: no contents");
      if (j.contents.includes("cf-browser-verification") || j.contents.includes("Just a moment"))
        throw new Error("allorigins: Cloudflare challenge");
      return j.contents;
    },
    async () => {
      const r = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`);
      if (!r.ok) throw new Error(`codetabs ${r.status}`);
      const text = await r.text();
      if (text.includes("cf-browser-verification") || text.includes("Just a moment"))
        throw new Error("codetabs: Cloudflare challenge");
      return text;
    },
  ];
  let lastErr;
  for (const tryProxy of proxies) {
    try { return await tryProxy(); } catch (e) { lastErr = e; }
  }
  throw new Error(`All VLR proxies failed: ${lastErr?.message}`);
}

// Lightweight HTML utilities — no cheerio/jsdom needed
function extractBetween(str, start, end, fromIdx = 0) {
  const s = str.indexOf(start, fromIdx);
  if (s === -1) return null;
  const e = str.indexOf(end, s + start.length);
  if (e === -1) return null;
  return str.slice(s + start.length, e).trim();
}
function extractAll(str, start, end) {
  const results = [];
  let idx = 0;
  while (true) {
    const s = str.indexOf(start, idx);
    if (s === -1) break;
    const e = str.indexOf(end, s + start.length);
    if (e === -1) break;
    results.push(str.slice(s + start.length, e).trim());
    idx = e + end.length;
  }
  return results;
}
function stripHtml(s) {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ── IMAGE PROXY (bypasses owcdn hotlink protection) ─────────────────────────
app.get("/api/img-proxy", requireAuth, async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing url" });
    // Only allow owcdn and vlr image domains
    const allowed = ["owcdn.net", "vlr.gg", "img.vlr.gg"];
    const hostname = new URL(url).hostname;
    if (!allowed.some(d => hostname.endsWith(d))) return res.status(403).json({ error: "Domain not allowed" });
    const r = await fetch(url, {
      headers: {
        "Referer": "https://www.vlr.gg/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      }
    });
    if (!r.ok) return res.status(r.status).end();
    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    r.body.pipe(res);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SEARCH ──────────────────────────────────────────────────────────────────
app.get("/api/veto/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);
    const html = await vlrFetch(`/search/?q=${encodeURIComponent(q)}&type=teams`);

    const teams = [];
    const seen = new Set();
    // VLR search results: <a href="/team/<id>/<slug>" ...>
    const teamRegex = /href="\/team\/(\d+)\/([^"]+)"/g;
    let m;
    while ((m = teamRegex.exec(html)) !== null) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);
      // Grab team name from nearby text
      const snippet = html.slice(Math.max(0, m.index - 20), m.index + 300);
      const nameMatch = /class="[^"]*search-item-name[^"]*"[^>]*>([^<]+)</.exec(snippet)
                     || /class="[^"]*name[^"]*"[^>]*>([^<]+)</.exec(snippet);
      const name = nameMatch ? nameMatch[1].trim() : m[2].replace(/-/g, " ");
      teams.push({ id, name, slug: m[2] });
      if (teams.length >= 10) break;
    }
    res.json(teams);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── TEAM VETO DATA ───────────────────────────────────────────────────────────
app.get("/api/veto/team/:id", requireAuth, async (req, res) => {
  try {
    const teamId = req.params.id;

    // 1. Get team name + logo from team page
    const teamHtml = await vlrFetch(`/team/${teamId}`);
    let teamName = "Unknown";
    const tnMatch = /<h1[^>]*class="[^"]*wf-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(teamHtml)
                 || /property="og:title"[^>]*content="([^"]+)"/.exec(teamHtml);
    if (tnMatch) teamName = stripHtml(tnMatch[1]).split("|")[0].trim();

    let teamLogo = null;
    const logoMatch = /class="[^"]*team-header-logo[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/.exec(teamHtml)
                   || /class="[^"]*wf-avatar[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/.exec(teamHtml)
                   || /<img[^>]+class="[^"]*logo[^"]*"[^>]+src="([^"]+)"/.exec(teamHtml)
                   || /property="og:image"[^>]*content="([^"]+)"/.exec(teamHtml);
    if (logoMatch) teamLogo = logoMatch[1].startsWith("//") ? "https:" + logoMatch[1] : logoMatch[1];

    // 2. Fetch completed matches — correct URL is /team/matches/<id>?group=completed
    const matchesHtml = await vlrFetch(`/team/matches/${teamId}?group=completed`);

    // Match IDs are 5-6 digit numbers in href="/<id>/<slug>"
    // The slug always contains at least one dash (team-a-vs-team-b-event)
    const matchIds = [];
    const seenIds = new Set();
    const matchLinkRegex = /href="\/(\d{5,8})\/([^"]+)"/g;
    let ml;
    while ((ml = matchLinkRegex.exec(matchesHtml)) !== null) {
      const mid = ml[1];
      const slug = ml[2];
      // Slugs for match pages always contain "vs" — skip non-match links
      if (!slug.includes("-vs-") && !slug.includes("vs")) continue;
      if (!seenIds.has(mid)) { seenIds.add(mid); matchIds.push(mid); }
    }

    // 3. Fetch veto + scores for up to 30 recent matches in parallel
    const recent = matchIds.slice(0, 30);
    const matchResults = await Promise.allSettled(
      recent.map(id => fetchMatchVeto(id, teamId, teamName))
    );

    const series = matchResults
      .filter(r => r.status === "fulfilled" && r.value)
      .map(r => r.value);

    // 4. Build patterns table
    const mapStats = {};
    ALL_MAPS_VETO.forEach(m => {
      mapStats[m] = { ourBans: 0, oppBans: 0, ourPicks: 0, oppPicks: 0, played: 0,
                      ourWins: 0, atkWins: 0, atkRounds: 0, defWins: 0, defRounds: 0 };
    });

    series.forEach(s => {
      s.veto.forEach(v => {
        const map = v.map;
        if (!mapStats[map]) mapStats[map] = { ourBans:0, oppBans:0, ourPicks:0, oppPicks:0, played:0,
                                               ourWins:0, atkWins:0, atkRounds:0, defWins:0, defRounds:0 };
        const ms = mapStats[map];
        const isOurs = v.teamId === teamId;
        if (v.action === "ban")  { isOurs ? ms.ourBans++  : ms.oppBans++;  }
        if (v.action === "pick") { isOurs ? ms.ourPicks++ : ms.oppPicks++; }
      });
      (s.maps || []).forEach(mg => {
        const ms = mapStats[mg.map];
        if (!ms) return;
        ms.played++;
        if (mg.ourScore > mg.theirScore) ms.ourWins++;
        if (mg.atkWins  != null) { ms.atkWins  += mg.atkWins;  ms.atkRounds  += (mg.atkRounds  || 12); }
        if (mg.defWins  != null) { ms.defWins  += mg.defWins;  ms.defRounds  += (mg.defRounds  || 12); }
      });
    });

    // 5. Scrape /team/stats/<id>/ for authoritative ATK/DEF round winrates per map
    const vlrMapStats = {}; // map name → { atkWR, defWR, winRate, played, wins, losses }
    try {
      const statsHtml = await vlrFetch(`/team/stats/${teamId}/`);
      // Each map row looks like:
      // "Bind (16) ... 63% ... 10 ... 6 ... 10 ... 6 ... 53% ... 100 ... 89 ... 49% ..."
      // We extract rows by finding each map name, then pulling the numbers after it
      const rowRegex = new RegExp(
        `(${ALL_MAPS_VETO.join("|")})\\s*\\((\\d+)\\)[\\s\\S]*?` + // map name + (games)
        `(\\d+)%[\\s\\S]*?`  +  // WIN%
        `(\\d+)[\\s\\S]*?`   +  // W
        `(\\d+)[\\s\\S]*?`   +  // L
        `\\d+[\\s\\S]*?`     +  // ATK 1st (skip)
        `\\d+[\\s\\S]*?`     +  // DEF 1st (skip)
        `(\\d+)%[\\s\\S]*?`  +  // ATK RWin%
        `\\d+[\\s\\S]*?`     +  // ATK RW (skip)
        `\\d+[\\s\\S]*?`     +  // ATK RL (skip)
        `(\\d+)%`,              // DEF RWin%
        "gi"
      );
      // Simpler: strip HTML and parse the text table
      const statsText = stripHtml(statsHtml);
      // Find each map block: "MapName (N)" followed by stats
      ALL_MAPS_VETO.forEach(mapName => {
        // Regex: "MapName (N)  WIN%  W  L  atkFirst  defFirst  ATKRWin%  atkRW  atkRL  DEFRWin%"
        const rx = new RegExp(
          mapName + `\\s*\\((\\d+)\\)\\s+` + // map + games
          `(\\d+)%\\s+`     +  // WIN%
          `(\\d+)\\s+`      +  // W
          `(\\d+)\\s+`      +  // L
          `(\\d+)\\s+`      +  // ATK 1st
          `(\\d+)\\s+`      +  // DEF 1st
          `(\\d+)%\\s+`     +  // ATK RWin%
          `(\\d+)\\s+`      +  // ATK RW
          `(\\d+)\\s+`      +  // ATK RL
          `(\\d+)%`,           // DEF RWin%
          "i"
        );
        const m = rx.exec(statsText);
        if (m) {
          vlrMapStats[mapName] = {
            played:  parseInt(m[1]),
            winRate: parseInt(m[2]),
            wins:    parseInt(m[3]),
            losses:  parseInt(m[4]),
            atkWR:   parseInt(m[7]),
            defWR:   parseInt(m[10]),
          };
        }
      });
    } catch (e) {
      // Stats page failed — not fatal, just use whatever we computed from match data
    }

    const totalSeries = series.length;
    const patterns = ALL_MAPS_VETO.map(map => {
      const s = mapStats[map] || {};
      const vlr = vlrMapStats[map] || null;
      return {
        map,
        ourBanRate:  totalSeries > 0 ? Math.round((s.ourBans  / totalSeries) * 100) : 0,
        oppBanRate:  totalSeries > 0 ? Math.round((s.oppBans  / totalSeries) * 100) : 0,
        ourPickRate: totalSeries > 0 ? Math.round((s.ourPicks / totalSeries) * 100) : 0,
        oppPickRate: totalSeries > 0 ? Math.round((s.oppPicks / totalSeries) * 100) : 0,
        ourBans: s.ourBans || 0, oppBans: s.oppBans || 0,
        ourPicks: s.ourPicks || 0, oppPicks: s.oppPicks || 0,
        // Use VLR's authoritative stats page data when available, fall back to match-derived
        played:  vlr ? vlr.played  : (s.played  || 0),
        wins:    vlr ? vlr.wins    : (s.ourWins  || 0),
        losses:  vlr ? vlr.losses  : ((s.played - s.ourWins) || 0),
        winRate: vlr ? vlr.winRate : (s.played > 0 ? Math.round((s.ourWins / s.played) * 100) : null),
        atkWR:   vlr ? vlr.atkWR   : (s.atkRounds > 0 ? Math.round((s.atkWins / s.atkRounds) * 100) : null),
        defWR:   vlr ? vlr.defWR   : (s.defRounds > 0 ? Math.round((s.defWins / s.defRounds) * 100) : null),
      };
    }).sort((a, b) => (b.ourBans + b.oppBans + b.ourPicks + b.oppPicks) - (a.ourBans + a.oppBans + a.ourPicks + a.oppPicks));

    res.json({ teamId, teamName, teamLogo, totalSeries, series, patterns });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FETCH SINGLE MATCH ───────────────────────────────────────────────────────
async function fetchMatchVeto(matchId, ourTeamId, ourTeamName) {
  try {
    const html = await vlrFetch(`/${matchId}/`);

    // ── Teams ──
    // Match header has two team links: /team/<id>/<slug>
    const teamLinks = [];
    const teamRegex = /href="\/team\/(\d+)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
    let tm;
    while ((tm = teamRegex.exec(html)) !== null) {
      const name = stripHtml(tm[2]);
      if (name && name.length > 0 && !teamLinks.find(t => t.id === tm[1])) {
        teamLinks.push({ id: tm[1], name });
      }
      if (teamLinks.length >= 2) break;
    }
    const teamA = teamLinks[0] || { id: ourTeamId, name: ourTeamName };
    const teamB = teamLinks[1] || { id: "opp", name: "Opponent" };

    // ── Event ──
    const eventEl = extractBetween(html, 'class="match-header-event-series">', "</");
    const event = eventEl ? stripHtml(eventEl) : "";

    // ── Date ──
    const dateMatch = /data-utc-ts="(\d{4}-\d{2}-\d{2})/.exec(html);
    const date = dateMatch ? dateMatch[1] : null;

    // ── Series score — two numbers inside match-header-vs-score ──
    let scoreA = 0, scoreB = 0;
    const vsSection = extractBetween(html, 'class="match-header-vs"', 'class="match-header-note"')
                   || extractBetween(html, 'class="match-header-vs"', 'class="match-streams"');
    if (vsSection) {
      // The score is the largest standalone numbers (not part of longer strings)
      const scoreNums = vsSection.match(/>\s*(\d)\s*</g);
      if (scoreNums && scoreNums.length >= 2) {
        scoreA = parseInt(scoreNums[0].replace(/\D/g, "")) || 0;
        scoreB = parseInt(scoreNums[scoreNums.length - 1].replace(/\D/g, "")) || 0;
      }
    }

    // ── Veto ──
    // VLR veto HTML (current format):
    // <div class="match-header-note">
    //   <span>TEAM banned MAP</span> / <span>TEAM picked MAP</span> ...
    // OR a dedicated veto section with items like:
    //   <div class="...">
    //     <div class="ge-text-light">ban</div>
    //     <img ...> MAP
    //     <a href="/team/...">TEAM</a>
    //   </div>
    const veto = parseVeto(html, teamA, teamB, ourTeamId);

    // ── Per-map results ──
    const maps = parseMapResults(html, teamA, teamB, ourTeamId);

    const won = teamA.id === ourTeamId ? scoreA > scoreB : scoreB > scoreA;

    return {
      matchId, date, event,
      teamAId: teamA.id, teamAName: teamA.name,
      teamBId: teamB.id, teamBName: teamB.name,
      scoreA, scoreB,
      ourScore:   teamA.id === ourTeamId ? scoreA : scoreB,
      theirScore: teamA.id === ourTeamId ? scoreB : scoreA,
      won,
      veto, maps,
      hasVeto: veto.length > 0,
    };
  } catch (e) {
    return null;
  }
}

// ── VETO PARSER ──────────────────────────────────────────────────────────────
function resolveVetoTeam(teamText, teamA, teamB) {
  if (!teamText) return null;
  const t = teamText.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').trim();
  if (!t) return null; // empty after stripping — don't false-match
  const a = teamA.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const b = teamB.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  // Exact / substring — only allow a.includes(t) if t is at least 4 chars to avoid short false matches
  if (t.includes(a)) return teamA.id;
  if (t.includes(b)) return teamB.id;
  if (t.length >= 4 && a.includes(t)) return teamA.id;
  if (t.length >= 4 && b.includes(t)) return teamB.id;
  // Word match — each word must be >= 4 chars
  const wordsA = a.split(/\s+/).filter(w => w.length >= 4);
  const wordsB = b.split(/\s+/).filter(w => w.length >= 4);
  if (wordsA.some(w => t.includes(w))) return teamA.id;
  if (wordsB.some(w => t.includes(w))) return teamB.id;
  return null;
}

function parseVeto(html, teamA, teamB, ourTeamId) {
  const veto = [];

  // Strategy A: match-header-note — "TEAMNAME banned/picked MAPNAME" plain text
  const noteSection = extractBetween(html, 'class="match-header-note"', 'class="match-streams"')
                   || extractBetween(html, 'class="match-header-note"', 'class="match-vods"')
                   || extractBetween(html, 'class="match-header-note"', 'class="vm-stats"')
                   || extractBetween(html, 'match-header-note', 'match-header-vs-note');

  if (noteSection) {
    const text = stripHtml(noteSection);
    // VLR uses "; " or " / " or " · " between steps
    const parts = text.split(/\s*[;/·•|]\s*|\n/).map(s => s.trim()).filter(Boolean);
    parts.forEach(part => {
      const mapFound = ALL_MAPS_VETO.find(m => part.toLowerCase().includes(m.toLowerCase()));
      if (!mapFound) return;

      let action = null, teamText = null;
      const banRx  = /^(.+?)\s+bann?e?d?\s+/i.exec(part);
      const pickRx = /^(.+?)\s+pick(?:s|ed)?\s+/i.exec(part);
      const decRx  = /decider/i.test(part);

      if (banRx)       { action = "ban";     teamText = banRx[1].trim(); }
      else if (pickRx) { action = "pick";    teamText = pickRx[1].trim(); }
      else if (decRx)  { action = "decider"; }
      if (!action) return;

      let vetoTeamId = resolveVetoTeam(teamText, teamA, teamB);
      // If still unresolved, use alternating pattern (VLR veto always alternates teams, starting with teamA)
      if (vetoTeamId == null) {
        vetoTeamId = veto.length % 2 === 0 ? teamA.id : teamB.id;
      }
      veto.push({
        action, map: mapFound,
        teamId: vetoTeamId,
        teamName: vetoTeamId === teamA.id ? teamA.name : teamB.name,
      });
    });
  }

  // Strategy B: structured veto div items — also run if Strategy A produced only picks (missing bans)
  const hasBans  = veto.some(v => v.action === "ban");
  const hasPicks = veto.some(v => v.action === "pick");
  const needsStrategyB = veto.length === 0 || (hasPicks && !hasBans);

  if (needsStrategyB) {
    const vetoBlock = extractBetween(html, 'class="match-veto', '</section>')
                   || extractBetween(html, 'match-veto-picks', 'class="vm-stats"')
                   || extractBetween(html, 'match-veto-bans',  'class="vm-stats"');
    if (vetoBlock) {
      const itemRegex = /<div[^>]*>([\s\S]*?)<\/div>/gi;
      let m;
      while ((m = itemRegex.exec(vetoBlock)) !== null) {
        const chunk = m[1];
        const text  = stripHtml(chunk).toLowerCase();
        const mapName = ALL_MAPS_VETO.find(mp => text.includes(mp.toLowerCase()));
        if (!mapName) continue;

        const isBan  = /\bban\b/.test(text);
        const isPick = /\bpick\b|\bchose\b/.test(text);
        const isDec  = /decider|left.?over/.test(text);
        if (!isBan && !isPick && !isDec) continue;

        const action = isBan ? "ban" : isPick ? "pick" : "decider";
        // Skip duplicates already found by Strategy A
        if (veto.some(v => v.map === mapName && v.action === action)) continue;

        let vetoTeamId = null;
        if (chunk.includes(`/team/${teamA.id}`)) vetoTeamId = teamA.id;
        else if (chunk.includes(`/team/${teamB.id}`)) vetoTeamId = teamB.id;
        else vetoTeamId = resolveVetoTeam(stripHtml(chunk), teamA, teamB);
        // If still unresolved, alternate
        if (vetoTeamId == null) {
          vetoTeamId = veto.length % 2 === 0 ? teamA.id : teamB.id;
        }
        veto.push({
          action, map: mapName,
          teamId: vetoTeamId,
          teamName: vetoTeamId === teamA.id ? teamA.name : teamB.name,
        });
      }
    }
  }

  return veto;
}

// ── MAP RESULTS PARSER ───────────────────────────────────────────────────────
function parseMapResults(html, teamA, teamB, ourTeamId) {
  const maps = [];
  const seenMaps = new Set();

  // Single-pass scan for all vm-stats-game sections — avoids duplicates from running
  // extractAll multiple times with different class name variants and concatenating results.
  const allSections = [];
  const gameSectionRegex = /class="vm-stats-game[^"]*"/g;
  let gm;
  while ((gm = gameSectionRegex.exec(html)) !== null) {
    const startIdx = html.lastIndexOf('<', gm.index);
    const endMarker = 'class="vm-stats-game-footer"';
    const endIdx = html.indexOf(endMarker, gm.index);
    if (endIdx === -1) continue;
    const footerClose = html.indexOf('</div>', endIdx);
    const section = html.slice(startIdx, footerClose !== -1 ? footerClose + 6 : endIdx + endMarker.length);
    allSections.push(section);
  }

  allSections.forEach(section => {
    // Map name
    const mapNameRaw = extractBetween(section, 'class="map-name">', '</')
                    || extractBetween(section, 'class="vm-stats-game-header-map-name">', '</');
    const mapName = mapNameRaw ? stripHtml(mapNameRaw).trim() : null;
    if (!mapName || mapName === "All Maps" || mapName === "TBD" || seenMaps.has(mapName)) return;
    seenMaps.add(mapName);

    // Series score — two big score numbers in the header
    // VLR: <div class="...score..."><span>13</span> : <span>7</span></div>
    const scoreSection = extractBetween(section, 'class="vm-stats-game-header-team"', 'class="vm-stats-game-header-map"')
                      || extractBetween(section, 'match-header-vs-score', '<div class="vm-stats');
    const scoreNums = (section.match(/class="[^"]*score[^"]*"[^>]*>([\s\S]*?)<\/div>/));
    let ourScore = null, theirScore = null;
    if (scoreNums) {
      const nums = scoreNums[1].match(/\d+/g);
      if (nums && nums.length >= 2) {
        const sA = parseInt(nums[0]), sB = parseInt(nums[nums.length - 1]);
        ourScore   = teamA.id === ourTeamId ? sA : sB;
        theirScore = teamA.id === ourTeamId ? sB : sA;
      }
    }

    // ATK/DEF half-scores
    // VLR: mod-t = first half (usually ATK), mod-ct = second half (usually DEF)
    // Each team has two halves; grab first team's halves
    const atkMatches = [...section.matchAll(/mod-(?:t\b|atk)[^>]*>(\d+)</g)].map(m => parseInt(m[1]));
    const defMatches = [...section.matchAll(/mod-(?:ct\b|def)[^>]*>(\d+)</g)].map(m => parseInt(m[1]));
    // atkMatches[0] = teamA's ATK half, defMatches[0] = teamA's DEF half
    const atkWins = atkMatches.length > 0 ? atkMatches[0] : null;
    const defWins = defMatches.length > 0 ? defMatches[0] : null;

    maps.push({
      map: mapName,
      played: true,
      ourScore,
      theirScore,
      atkWins,
      atkRounds: atkWins != null ? (atkWins + (defMatches[1] ?? 0)) : null,
      defWins,
      defRounds: defWins != null ? (defWins + (atkMatches[1] ?? 0)) : null,
    });
  });

  return maps;
}

