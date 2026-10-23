// MySQL connection pool (XAMPP / phpMyAdmin database)
// Use in other files:  const db = require('../config/db');
//   const [rows] = await db.query('SELECT * FROM equipment');

require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'equipment_borrowing_system_db',
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
