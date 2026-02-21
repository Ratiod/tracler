const express = require("express");
const cors    = require("cors");
const Database = require("better-sqlite3");
const path    = require("path");
const fs      = require("fs");

const app  = express();
const PORT = process.env.PORT || 3001;

// DB stored in /data on Render (persistent disk), else locally
const DB_DIR  = process.env.RENDER ? "/data" : path.join(__dirname, "data");
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(path.join(DB_DIR, "ticra.db"));

// ── Schema ──────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ign  TEXT,
    role TEXT,
    av   TEXT
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id  INTEGER NOT NULL,
    title      TEXT NOT NULL,
    desc       TEXT,
    due        TEXT,
    labels     TEXT DEFAULT '[]',
    done       INTEGER DEFAULT 0,
    FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS labels (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS strats (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    map  TEXT,
    side TEXT,
    cat  TEXT,
    desc TEXT
  );
`);

app.use(cors());
app.use(express.json());

// Serve built frontend in production
const DIST = path.join(__dirname, "../client/dist");
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
}

// ── Players ─────────────────────────────────────────────
app.get("/api/players", (req, res) => {
  res.json(db.prepare("SELECT * FROM players").all());
});

app.post("/api/players", (req, res) => {
  const { name, ign="", role="", av="" } = req.body;
  const r = db.prepare("INSERT INTO players (name,ign,role,av) VALUES (?,?,?,?)").run(name, ign, role, av);
  res.json({ id:r.lastInsertRowid, name, ign, role, av });
});

app.delete("/api/players/:id", (req, res) => {
  db.prepare("DELETE FROM players WHERE id=?").run(req.params.id);
  db.prepare("DELETE FROM tasks WHERE player_id=?").run(req.params.id);
  res.json({ ok:true });
});

// ── Tasks ────────────────────────────────────────────────
app.get("/api/tasks", (req, res) => {
  res.json(db.prepare("SELECT * FROM tasks").all());
});

app.post("/api/tasks", (req, res) => {
  const { player_id, title, desc="", due="", labels="[]", done=0 } = req.body;
  const r = db.prepare("INSERT INTO tasks (player_id,title,desc,due,labels,done) VALUES (?,?,?,?,?,?)").run(player_id, title, desc, due, labels, done?1:0);
  res.json({ id:r.lastInsertRowid, player_id, title, desc, due, labels, done:!!done });
});

app.put("/api/tasks/:id", (req, res) => {
  const { done } = req.body;
  db.prepare("UPDATE tasks SET done=? WHERE id=?").run(done?1:0, req.params.id);
  res.json({ ok:true });
});

app.delete("/api/tasks/:id", (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});

// ── Labels ───────────────────────────────────────────────
app.get("/api/labels", (req, res) => {
  res.json(db.prepare("SELECT * FROM labels").all());
});

app.post("/api/labels", (req, res) => {
  const { name, color } = req.body;
  try {
    const r = db.prepare("INSERT INTO labels (name,color) VALUES (?,?)").run(name, color);
    res.json({ id:r.lastInsertRowid, name, color });
  } catch(e) {
    res.status(400).json({ error:"Label already exists" });
  }
});

app.delete("/api/labels/:name", (req, res) => {
  db.prepare("DELETE FROM labels WHERE name=?").run(decodeURIComponent(req.params.name));
  res.json({ ok:true });
});

// ── Strats ───────────────────────────────────────────────
app.get("/api/strats", (req, res) => {
  res.json(db.prepare("SELECT * FROM strats").all());
});

app.post("/api/strats", (req, res) => {
  const { name, map="Ascent", side="atk", cat="Default", desc="" } = req.body;
  const r = db.prepare("INSERT INTO strats (name,map,side,cat,desc) VALUES (?,?,?,?,?)").run(name, map, side, cat, desc);
  res.json({ id:r.lastInsertRowid, name, map, side, cat, desc });
});

app.delete("/api/strats/:id", (req, res) => {
  db.prepare("DELETE FROM strats WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});

// ── Catch-all → frontend ─────────────────────────────────
app.get("*", (req, res) => {
  const index = path.join(DIST, "index.html");
  if (fs.existsSync(index)) res.sendFile(index);
  else res.send("API running");
});

app.listen(PORT, () => console.log(`Ticra server running on :${PORT}`));
