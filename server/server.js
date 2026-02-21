import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'ticra-dev-secret-change-in-prod';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

app.use(cors());
app.use(express.json());

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ─── DB INIT ──────────────────────────────────────────────────────────────────
async function initDatabase() {
  await db.execute(`CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT NOT NULL, ign TEXT NOT NULL, role TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, player_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, due_date TEXT, labels TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS labels (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS strategies (id TEXT PRIMARY KEY, name TEXT NOT NULL, map TEXT NOT NULL, side TEXT NOT NULL, agent_setup TEXT, key_util TEXT, win_cond TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS playbooks (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS gameplans (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS compositions (id TEXT PRIMARY KEY, map TEXT NOT NULL, roles TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS lineups (id TEXT PRIMARY KEY, map TEXT NOT NULL, agent TEXT NOT NULL, lineup_type TEXT NOT NULL, location TEXT NOT NULL, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  await db.execute(`CREATE TABLE IF NOT EXISTS scrims (id TEXT PRIMARY KEY, opponent TEXT NOT NULL, date TEXT NOT NULL, result TEXT, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

  // Users table
  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'player', is_banned INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME)`);

  // Seed admin if empty
  const existing = await db.execute('SELECT COUNT(*) as count FROM users');
  if (Number(existing.rows[0].count) === 0) {
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPass, 12);
    await db.execute({ sql: `INSERT INTO users (id, username, password_hash, role) VALUES (?,?,?,?)`, args: ['admin-1', 'admin', hash, 'admin'] });
    console.log(`✅ Admin seeded — username: admin  password: ${adminPass}`);
  }
  console.log('✅ Database initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const r = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username.trim().toLowerCase()] });
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    if (user.is_banned) return res.status(403).json({ error: 'Your account has been suspended. Contact your coach.' });
    if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: 'Invalid username or password' });
    await db.execute({ sql: 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', args: [user.id] });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Verify token
app.get('/auth/me', requireAuth, async (req, res) => {
  try {
    const r = await db.execute({ sql: 'SELECT id, username, role, is_banned FROM users WHERE id = ?', args: [req.user.id] });
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });
    res.json({ id: user.id, username: user.username, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List users (admin)
app.get('/auth/users', requireAdmin, async (req, res) => {
  try {
    const r = await db.execute('SELECT id, username, role, is_banned, created_at, last_login FROM users ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create user (admin)
app.post('/auth/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (!['admin','player'].includes(role)) return res.status(400).json({ error: 'Role must be admin or player' });
    const clean = username.trim().toLowerCase();
    const hash = await bcrypt.hash(password, 12);
    const id = `user-${Date.now()}`;
    await db.execute({ sql: 'INSERT INTO users (id, username, password_hash, role) VALUES (?,?,?,?)', args: [id, clean, hash, role] });
    res.json({ success: true, id, username: clean });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Username already taken' });
    res.status(500).json({ error: err.message });
  }
});

// Reset password (admin)
app.post('/auth/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
    const hash = await bcrypt.hash(password, 12);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ban (admin)
app.post('/auth/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const t = await db.execute({ sql: 'SELECT role FROM users WHERE id = ?', args: [req.params.id] });
    if (t.rows[0]?.role === 'admin') return res.status(403).json({ error: 'Cannot ban an admin' });
    await db.execute({ sql: 'UPDATE users SET is_banned = 1 WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Unban (admin)
app.post('/auth/users/:id/unban', requireAdmin, async (req, res) => {
  try {
    await db.execute({ sql: 'UPDATE users SET is_banned = 0 WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user (admin)
app.delete('/auth/users/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/players', async (req, res) => { try { res.json((await db.execute('SELECT * FROM players ORDER BY created_at ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/players', async (req, res) => { try { const { id, name, ign, role } = req.body; await db.execute({ sql: 'INSERT INTO players (id, name, ign, role) VALUES (?,?,?,?)', args: [id, name, ign, role] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/players/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM players WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/tasks', async (req, res) => { try { res.json((await db.execute('SELECT * FROM tasks ORDER BY created_at ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/tasks', async (req, res) => { try { const { id, player_id, title, description, due_date, labels } = req.body; await db.execute({ sql: 'INSERT INTO tasks (id,player_id,title,description,due_date,labels) VALUES (?,?,?,?,?,?)', args: [id, player_id, title, description||'', due_date||'', JSON.stringify(labels||[])] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/tasks/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM tasks WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/tasks/:id', async (req, res) => { try { const { player_id, title, description, due_date, labels } = req.body; await db.execute({ sql: 'UPDATE tasks SET player_id=?,title=?,description=?,due_date=?,labels=? WHERE id=?', args: [player_id, title, description||'', due_date||'', JSON.stringify(labels||[]), req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/labels', async (req, res) => { try { res.json((await db.execute('SELECT * FROM labels ORDER BY created_at ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/labels', async (req, res) => { try { const { id, name, color } = req.body; await db.execute({ sql: 'INSERT INTO labels (id,name,color) VALUES (?,?,?)', args: [id, name, color] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/labels/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM labels WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/strategies', async (req, res) => { try { res.json((await db.execute('SELECT * FROM strategies ORDER BY created_at ASC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/strategies', async (req, res) => { try { const { id, name, map, side, agent_setup, key_util, win_cond, notes } = req.body; await db.execute({ sql: 'INSERT INTO strategies (id,name,map,side,agent_setup,key_util,win_cond,notes) VALUES (?,?,?,?,?,?,?,?)', args: [id, name, map, side, agent_setup||'', key_util||'', win_cond||'', notes||''] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/strategies/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM strategies WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/strategies/:id', async (req, res) => { try { const { name, map, side, agent_setup, key_util, win_cond, notes } = req.body; await db.execute({ sql: 'UPDATE strategies SET name=?,map=?,side=?,agent_setup=?,key_util=?,win_cond=?,notes=? WHERE id=?', args: [name, map, side, agent_setup||'', key_util||'', win_cond||'', notes||'', req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/playbooks', async (req, res) => { try { res.json((await db.execute('SELECT * FROM playbooks ORDER BY created_at DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/playbooks', async (req, res) => { try { const { id, title, content } = req.body; await db.execute({ sql: 'INSERT INTO playbooks (id,title,content) VALUES (?,?,?)', args: [id, title, content||''] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/playbooks/:id', async (req, res) => { try { const { title, content } = req.body; await db.execute({ sql: 'UPDATE playbooks SET title=?,content=? WHERE id=?', args: [title, content||'', req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/playbooks/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM playbooks WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/gameplans', async (req, res) => { try { res.json((await db.execute('SELECT * FROM gameplans ORDER BY created_at DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/gameplans', async (req, res) => { try { const { id, title, content } = req.body; await db.execute({ sql: 'INSERT INTO gameplans (id,title,content) VALUES (?,?,?)', args: [id, title, content||''] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/gameplans/:id', async (req, res) => { try { const { title, content } = req.body; await db.execute({ sql: 'UPDATE gameplans SET title=?,content=? WHERE id=?', args: [title, content||'', req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/gameplans/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM gameplans WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/compositions', async (req, res) => { try { res.json((await db.execute('SELECT * FROM compositions ORDER BY created_at DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/compositions', async (req, res) => { try { const { id, map, roles } = req.body; await db.execute({ sql: 'INSERT INTO compositions (id,map,roles) VALUES (?,?,?)', args: [id, map, JSON.stringify(roles)] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/compositions/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM compositions WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/lineups', async (req, res) => { try { res.json((await db.execute('SELECT * FROM lineups ORDER BY created_at DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/lineups', async (req, res) => { try { const { id, map, agent, lineup_type, location, notes } = req.body; await db.execute({ sql: 'INSERT INTO lineups (id,map,agent,lineup_type,location,notes) VALUES (?,?,?,?,?,?)', args: [id, map, agent, lineup_type, location, notes||''] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/lineups/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM lineups WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/api/scrims', async (req, res) => { try { res.json((await db.execute('SELECT * FROM scrims ORDER BY date DESC')).rows); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/scrims', async (req, res) => { try { const { id, opponent, date, result, notes } = req.body; await db.execute({ sql: 'INSERT INTO scrims (id,opponent,date,result,notes) VALUES (?,?,?,?,?)', args: [id, opponent, date, result||'', notes||''] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.delete('/api/scrims/:id', async (req, res) => { try { await db.execute({ sql: 'DELETE FROM scrims WHERE id = ?', args: [req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });
app.put('/api/scrims/:id', async (req, res) => { try { const { opponent, date, result, notes } = req.body; await db.execute({ sql: 'UPDATE scrims SET opponent=?,date=?,result=?,notes=? WHERE id=?', args: [opponent, date, result||'', notes||'', req.params.id] }); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); } });

app.get('/health', (req, res) => res.json({ status: 'ok' }));

initDatabase()
  .then(() => app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`)))
  .catch(err => { console.error('Failed to start:', err); process.exit(1); });
