// All database queries for the users table.
// "?" placeholders keep the queries safe from SQL injection.

const db = require('../config/db');

async function findByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function create({ fullName, email, passwordHash }) {
  // role is always 'student' for self-registration. Admins are added in the database only.
  const [result] = await db.query(
    "INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, 'student')",
    [fullName, email, passwordHash]
  );
  return result.insertId;
}

module.exports = { findByEmail, create };
