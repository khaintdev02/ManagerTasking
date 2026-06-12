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
        userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('[DB] Connected and initialized PostgreSQL database via Neon');

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
        userId INTEGER NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

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

// Query all rows
async function all(sql, params = []) {
  if (isPg) {
    const query = convertSql(sql);
    const res = await pgPool.query(query, params);
    return res.rows;
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
