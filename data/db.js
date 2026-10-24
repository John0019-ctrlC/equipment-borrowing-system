// MySQL/MariaDB data layer.
//
// Same API the routes always used (all/find/byId/filter/insert/update/remove/nextCode),
// so no route had to change. Design:
//   - load()  reads every table from MySQL into memory once at startup.
//   - reads   are served from memory (fast, synchronous).
//   - writes  update memory immediately AND are queued to MySQL in order (write-through).
// MySQL is the permanent store. Memory is only a cache of it.
require('dotenv').config();
const mysql = require('mysql2/promise');
const schema = require('./schema');

const COLLECTIONS = Object.keys(schema);
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'equipment_borrowing_system_db',
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,     // DATE/TIMESTAMP come back as strings, not JS Date objects
  decimalNumbers: true,  // DECIMAL columns come back as numbers
});
// Keep every connection in UTC so timestamps read/write consistently.
pool.on('connection', (c) => c.query("SET time_zone = '+00:00'"));

let data = {};
const nextIds = {};
let chain = Promise.resolve();
let writeErrors = 0;

// ---------- value conversion (MySQL <-> app) ----------
const toIso = (v) => (v instanceof Date ? v.toISOString() : new Date(String(v).replace(' ', 'T') + 'Z').toISOString());
const toSqlTs = (v) => new Date(v).toISOString().slice(0, 19).replace('T', ' ');
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();

function fromSql(type, v) {
  if (v === null || v === undefined) return null;
  switch (type) {
    case 'id': return String(v);
    case 'num': return Number(v);
    case 'bool': return !!Number(v);
    case 'date': return String(v).slice(0, 10);
    case 'ts': return toIso(v);
    case 'enumCap': return String(v).toLowerCase();
    case 'category': {
      const c = (data.categories || []).find((x) => x.id === String(v));
      return c ? c.name : null;
    }
    default: return v;
  }
}

function toSql(type, v) {
  if (v === null || v === undefined || v === '') return type === 'str' && v === '' ? '' : null;
  switch (type) {
    case 'id': return Number(v);
    case 'bool': return v ? 1 : 0;
    case 'ts': return toSqlTs(v);
    case 'enumCap': return cap(v);
    case 'category': {
      const c = data.categories.find((x) => x.name === v);
      return c ? Number(c.id) : null;
    }
    default: return v;
  }
}

function rowToRec(def, row) {
  const rec = { id: String(row[def.pk]) };
  for (const [field, [col, type]] of Object.entries(def.fields)) rec[field] = fromSql(type, row[col]);
  return rec;
}

// Columns/values to write for the given fields of a record.
function toColumns(def, rec, fieldNames) {
  const cols = {};
  for (const f of fieldNames) {
    if (!def.fields[f]) continue; // cache-only field (e.g. createdAt on categories)
    const [col, type] = def.fields[f];
    cols[col] = toSql(type, rec[f]);
  }
  if (def.extra) Object.assign(cols, def.extra(rec));
  return cols;
}

// ---------- ordered write queue ----------
function enqueue(sql, params) {
  chain = chain
    .then(() => pool.query(sql, params))
    .catch((err) => {
      writeErrors++;
      console.error('[db] WRITE FAILED:', err.message, '\n  SQL:', sql);
    });
}

const q = (id) => `\`${id}\``;

// ---------- public API ----------
async function load() {
  data = {};
  for (const c of COLLECTIONS) {
    const def = schema[c];
    const [rows] = await pool.query(`SELECT * FROM ${q(def.table)}`);
    data[c] = rows.map((r) => rowToRec(def, r));
    nextIds[c] = rows.reduce((m, r) => Math.max(m, Number(r[def.pk])), 0) + 1;
  }
}

const flush = () => chain;
const failures = () => writeErrors;
const close = async () => { await chain; await pool.end(); };

module.exports = {
  load, flush, failures, close,
  all: (c) => data[c],
  find: (c, fn) => data[c].find(fn),
  byId: (c, id) => data[c].find((r) => r.id === id),
  filter: (c, fn) => data[c].filter(fn),

  insert(c, obj) {
    const def = schema[c];
    const rec = { id: String(nextIds[c]++), createdAt: new Date().toISOString(), ...obj };
    data[c].push(rec);
    const cols = toColumns(def, rec, Object.keys(rec).filter((k) => k !== 'id'));
    cols[def.pk] = Number(rec.id);
    const names = Object.keys(cols);
    enqueue(
      `INSERT INTO ${q(def.table)} (${names.map(q).join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      names.map((n) => cols[n])
    );
    return rec;
  },

  update(c, id, patch) {
    const def = schema[c];
    const rec = data[c].find((r) => r.id === id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    const cols = toColumns(def, rec, [...Object.keys(patch), 'updatedAt']);
    const names = Object.keys(cols);
    enqueue(
      `UPDATE ${q(def.table)} SET ${names.map((n) => `${q(n)} = ?`).join(', ')} WHERE ${q(def.pk)} = ?`,
      [...names.map((n) => cols[n]), Number(id)]
    );
    return rec;
  },

  remove(c, id) {
    const def = schema[c];
    const i = data[c].findIndex((r) => r.id === id);
    if (i === -1) return false;
    data[c].splice(i, 1);
    enqueue(`DELETE FROM ${q(def.table)} WHERE ${q(def.pk)} = ?`, [Number(id)]);
    // MySQL cascades deletes; mirror that in the cache so both stay identical.
    for (const [child, field] of def.cascade || []) data[child] = data[child].filter((r) => r[field] !== id);
    return true;
  },

  // Next unused code like BR-0007. Uses the highest existing number (not the row count),
  // so codes are never reused even after rows are deleted.
  nextCode(c, prefix, field = 'code') {
    const max = data[c].reduce((m, r) => Math.max(m, parseInt(String(r[field] || '').split('-')[1], 10) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, '0')}`;
  },
};
