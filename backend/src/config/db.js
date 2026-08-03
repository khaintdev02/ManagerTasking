const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const DB_PATH = process.env.DB_PATH || './data/tasking.db';

let db = null; // SQLite db instance
let pgPool = null; // PostgreSQL pool instance
let isPg = !!DATABASE_URL;
let lastInsertedId = null;

function convertSql(sql) {
  if (!isPg) return sql;
  // Convert datetime('now') to CURRENT_TIMESTAMP
  let converted = sql.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
  // If we are comparing dueTime to CURRENT_TIMESTAMP, cast dueTime to TIMESTAMPTZ
  converted = converted.replace(/dueTime\s*<\s*CURRENT_TIMESTAMP/gi, 'CAST(dueTime AS TIMESTAMPTZ) < CURRENT_TIMESTAMP');
  // Convert SQLite placeholders (?) to PostgreSQL ($1, $2, ...)
  let index = 1;
  return converted.replace(/\?/g, () => `$${index++}`);
}

async function getDb() {
  if (isPg) {
    if (pgPool) return pgPool;
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('sslmode=') ? undefined : { rejectUnauthorized: false }
    });

    // Create tables in PostgreSQL
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        pushSubscription TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        dueTime TEXT NOT NULL,
        isDone INTEGER NOT NULL DEFAULT 0,
        lastNotifiedAt TEXT,
        notifyTypes TEXT NOT NULL DEFAULT '[]',
        recipients TEXT NOT NULL DEFAULT '[]',
        notifyCycle TEXT NOT NULL DEFAULT 'none',
        notificationHistory TEXT NOT NULL DEFAULT '[]',
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS debts (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        person TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        dueDate TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        settledAt TEXT,
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await run(`ALTER TABLE tasks ADD COLUMN notifyCycle TEXT DEFAULT 'none'`);
      console.log('[DB] Added notifyCycle column to tasks table (Postgres)');
    } catch (e) {
      // Ignore if column already exists
    }

    try {
      await run(`ALTER TABLE tasks ADD COLUMN notificationHistory TEXT DEFAULT '[]'`);
      console.log('[DB] Added notificationHistory column to tasks table (Postgres)');
    } catch (e) {
      // Ignore if column already exists
    }

    console.log('[DB] Connected and initialized PostgreSQL database via Neon');

    // Reset/Sync sequence counters for Postgres tables to prevent duplicate key errors after data import/seed
    const tables = ['users', 'tasks', 'transactions', 'debts'];
    for (const table of tables) {
      try {
        await pgPool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
      } catch (seqErr) {
        console.error(`[DB] Failed to sync sequence for ${table}:`, seqErr);
      }
    }

    // Ensure default admin account exists
    const adminEmail = 'khainguyenthe203@gmail.com';
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('Thekhai02!', 10);
    const adminUser = await get('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (!adminUser) {
      await run(
        'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
        [adminEmail, hashedPassword, 'admin']
      );
      console.log('[DB] Seeded default admin account in Postgres: khainguyenthe203@gmail.com / Thekhai02!');
    } else {
      await run(
        'UPDATE users SET password = ?, role = ? WHERE email = ?',
        [hashedPassword, 'admin', adminEmail]
      );
      console.log('[DB] Ensured default admin account in Postgres: khainguyenthe203@gmail.com / Thekhai02!');
    }

    return pgPool;
  } else {
    if (db) return db;
    const SQL = await initSqlJs();

    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load from file if exists, else create new
    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(filebuffer);
    } else {
      db = new SQL.Database();
    }

    // Create tables in SQLite
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        pushSubscription TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        dueTime TEXT NOT NULL,
        isDone INTEGER NOT NULL DEFAULT 0,
        lastNotifiedAt TEXT,
        notifyTypes TEXT NOT NULL DEFAULT '[]',
        recipients TEXT NOT NULL DEFAULT '[]',
        notifyCycle TEXT NOT NULL DEFAULT 'none',
        notificationHistory TEXT NOT NULL DEFAULT '[]',
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS debts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        person TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        dueDate TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        settledAt TEXT,
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    try {
      db.run(`ALTER TABLE tasks ADD COLUMN notifyCycle TEXT DEFAULT 'none'`);
      console.log('[DB] Added notifyCycle column to tasks table (SQLite)');
    } catch (e) {
      // Ignore if column already exists
    }

    try {
      db.run(`ALTER TABLE tasks ADD COLUMN notificationHistory TEXT DEFAULT '[]'`);
      console.log('[DB] Added notificationHistory column to tasks table (SQLite)');
    } catch (e) {
      // Ignore if column already exists
    }

    persist();
    console.log('[DB] SQLite (sql.js) initialized at', DB_PATH);

    // Seed/Ensure default admin account exists
    const adminEmail = 'khainguyenthe203@gmail.com';
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('Thekhai02!', 10);
    const adminUser = await get('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (!adminUser) {
      await run(
        'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
        [adminEmail, hashedPassword, 'admin']
      );
      console.log('[DB] Seeded default admin account: khainguyenthe203@gmail.com / Thekhai02!');
    } else {
      await run(
        'UPDATE users SET password = ?, role = ? WHERE email = ?',
        [hashedPassword, 'admin', adminEmail]
      );
      console.log('[DB] Ensured default admin account: khainguyenthe203@gmail.com / Thekhai02!');
    }

    return db;
  }
}

// Save DB to file (SQLite only)
function persist() {
  if (isPg || !db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[DB] Failed to persist:', err);
  }
}

// Execute SQL and persist
async function run(sql, params = []) {
  if (isPg) {
    let query = convertSql(sql);
    if (query.trim().toUpperCase().startsWith('INSERT')) {
      query += ' RETURNING id';
      const res = await pgPool.query(query, params);
      lastInsertedId = res.rows[0]?.id || null;
    } else {
      await pgPool.query(query, params);
    }
  } else {
    db.run(sql, params);
    persist();
  }
}

function normalizeKeys(row) {
  if (!row) return null;
  const mapped = { ...row };
  if ('duetime' in mapped) { mapped.dueTime = mapped.duetime; delete mapped.duetime; }
  if ('isdone' in mapped) { mapped.isDone = mapped.isdone; delete mapped.isdone; }
  if ('lastnotifiedat' in mapped) { mapped.lastNotifiedAt = mapped.lastnotifiedat; delete mapped.lastnotifiedat; }
  if ('notifytypes' in mapped) { mapped.notifyTypes = mapped.notifytypes; delete mapped.notifytypes; }
  if ('notifycycle' in mapped) { mapped.notifyCycle = mapped.notifycycle; delete mapped.notifycycle; }
  if ('notificationhistory' in mapped) { mapped.notificationHistory = mapped.notificationhistory; delete mapped.notificationhistory; }
  if ('userid' in mapped) { mapped.userId = mapped.userid; delete mapped.userid; }
  if ('createdat' in mapped) { mapped.createdAt = mapped.createdat; delete mapped.createdat; }
  if ('updatedat' in mapped) { mapped.updatedAt = mapped.updatedat; delete mapped.updatedat; }
  if ('pushsubscription' in mapped) { mapped.pushSubscription = mapped.pushsubscription; delete mapped.pushsubscription; }
  if ('useremail' in mapped) { mapped.userEmail = mapped.useremail; delete mapped.useremail; }
  if ('paymentmethod' in mapped) { mapped.paymentMethod = mapped.paymentmethod; delete mapped.paymentmethod; }
  if ('duedate' in mapped) { mapped.dueDate = mapped.duedate; delete mapped.duedate; }
  if ('settledat' in mapped) { mapped.settledAt = mapped.settledat; delete mapped.settledat; }
  return mapped;
}

// Query all rows
async function all(sql, params = []) {
  if (isPg) {
    const query = convertSql(sql);
    const res = await pgPool.query(query, params);
    return res.rows.map(normalizeKeys);
  } else {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }
}

// Query one row
async function get(sql, params = []) {
  const results = await all(sql, params);
  return results[0] || null;
}

// Get last inserted ID
function lastInsertRowid() {
  if (isPg) {
    return lastInsertedId;
  } else {
    const stmt = db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    return row ? row.id : null;
  }
}

module.exports = { getDb, run, all, get, lastInsertRowid, persist, isPg };
