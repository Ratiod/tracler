import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Turso client
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

app.use(cors());
app.use(express.json());

// Initialize database tables
async function initDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ign TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        labels TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS labels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS strategies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        map TEXT NOT NULL,
        side TEXT NOT NULL,
        agent_setup TEXT,
        key_util TEXT,
        win_cond TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS playbooks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS gameplans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS compositions (
        id TEXT PRIMARY KEY,
        map TEXT NOT NULL,
        roles TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS lineups (
        id TEXT PRIMARY KEY,
        map TEXT NOT NULL,
        agent TEXT NOT NULL,
        lineup_type TEXT NOT NULL,
        location TEXT NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS scrims (
        id TEXT PRIMARY KEY,
        opponent TEXT NOT NULL,
        date TEXT NOT NULL,
        result TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Players endpoints
app.get('/api/players', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM players ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const { id, name, ign, role } = req.body;
    await db.execute({
      sql: 'INSERT INTO players (id, name, ign, role) VALUES (?, ?, ?, ?)',
      args: [id, name, ign, role]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM players WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tasks endpoints
app.get('/api/tasks', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM tasks ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { id, player_id, title, description, due_date, labels } = req.body;
    await db.execute({
      sql: 'INSERT INTO tasks (id, player_id, title, description, due_date, labels) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, player_id, title, description || '', due_date || '', JSON.stringify(labels || [])]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM tasks WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { player_id, title, description, due_date, labels } = req.body;
    await db.execute({
      sql: 'UPDATE tasks SET player_id = ?, title = ?, description = ?, due_date = ?, labels = ? WHERE id = ?',
      args: [player_id, title, description || '', due_date || '', JSON.stringify(labels || []), req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Labels endpoints
app.get('/api/labels', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM labels ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/labels', async (req, res) => {
  try {
    const { id, name, color } = req.body;
    await db.execute({
      sql: 'INSERT INTO labels (id, name, color) VALUES (?, ?, ?)',
      args: [id, name, color]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/labels/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM labels WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Strategies endpoints
app.get('/api/strategies', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM strategies ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/strategies', async (req, res) => {
  try {
    const { id, name, map, side, agent_setup, key_util, win_cond, notes } = req.body;
    await db.execute({
      sql: 'INSERT INTO strategies (id, name, map, side, agent_setup, key_util, win_cond, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [id, name, map, side, agent_setup || '', key_util || '', win_cond || '', notes || '']
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/strategies/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM strategies WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/strategies/:id', async (req, res) => {
  try {
    const { name, map, side, agent_setup, key_util, win_cond, notes } = req.body;
    await db.execute({
      sql: 'UPDATE strategies SET name = ?, map = ?, side = ?, agent_setup = ?, key_util = ?, win_cond = ?, notes = ? WHERE id = ?',
      args: [name, map, side, agent_setup || '', key_util || '', win_cond || '', notes || '', req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Playbooks endpoints
app.get('/api/playbooks', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM playbooks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/playbooks', async (req, res) => {
  try {
    const { id, title, content } = req.body;
    await db.execute({
      sql: 'INSERT INTO playbooks (id, title, content) VALUES (?, ?, ?)',
      args: [id, title, content || '']
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/playbooks/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.execute({
      sql: 'UPDATE playbooks SET title = ?, content = ? WHERE id = ?',
      args: [title, content || '', req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/playbooks/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM playbooks WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Game plans endpoints
app.get('/api/gameplans', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM gameplans ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gameplans', async (req, res) => {
  try {
    const { id, title, content } = req.body;
    await db.execute({
      sql: 'INSERT INTO gameplans (id, title, content) VALUES (?, ?, ?)',
      args: [id, title, content || '']
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/gameplans/:id', async (req, res) => {
  try {
    const { title, content } = req.body;
    await db.execute({
      sql: 'UPDATE gameplans SET title = ?, content = ? WHERE id = ?',
      args: [title, content || '', req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/gameplans/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM gameplans WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compositions endpoints
app.get('/api/compositions', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM compositions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/compositions', async (req, res) => {
  try {
    const { id, map, roles } = req.body;
    await db.execute({
      sql: 'INSERT INTO compositions (id, map, roles) VALUES (?, ?, ?)',
      args: [id, map, JSON.stringify(roles)]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/compositions/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM compositions WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lineups endpoints
app.get('/api/lineups', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM lineups ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lineups', async (req, res) => {
  try {
    const { id, map, agent, lineup_type, location, notes } = req.body;
    await db.execute({
      sql: 'INSERT INTO lineups (id, map, agent, lineup_type, location, notes) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, map, agent, lineup_type, location, notes || '']
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/lineups/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM lineups WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scrims endpoints
app.get('/api/scrims', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM scrims ORDER BY date DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scrims', async (req, res) => {
  try {
    const { id, opponent, date, result, notes } = req.body;
    await db.execute({
      sql: 'INSERT INTO scrims (id, opponent, date, result, notes) VALUES (?, ?, ?, ?, ?)',
      args: [id, opponent, date, result || '', notes || '']
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/scrims/:id', async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM scrims WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scrims/:id', async (req, res) => {
  try {
    const { opponent, date, result, notes } = req.body;
    await db.execute({
      sql: 'UPDATE scrims SET opponent = ?, date = ?, result = ?, notes = ? WHERE id = ?',
      args: [opponent, date, result || '', notes || '', req.params.id]
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
