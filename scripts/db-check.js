// Run with: npm run db:check
// Confirms MySQL is reachable and every table the app needs exists. Changes nothing.
require('dotenv').config();
const mysql = require('mysql2/promise');
const schema = require('../data/schema');

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'equipment_borrowing_system_db',
    });
    console.log(`OK  connected to "${process.env.DB_NAME || 'equipment_borrowing_system_db'}"`);
  } catch (e) {
    console.error('FAIL cannot connect:', e.message);
    process.exit(1);
  }
  let bad = 0;
  for (const [name, def] of Object.entries(schema)) {
    try {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${def.table}\``);
      // also confirm every mapped column exists
      const cols = [def.pk, ...Object.values(def.fields).map(([c]) => c)].map((c) => `\`${c}\``).join(', ');
      await conn.query(`SELECT ${cols} FROM \`${def.table}\` LIMIT 1`);
      console.log(`OK  ${def.table.padEnd(15)} ${String(n).padStart(4)} row(s)   (app collection: ${name})`);
    } catch (e) {
      bad++;
      console.error(`FAIL ${def.table}: ${e.message}`);
    }
  }
  await conn.end();
  console.log(bad ? `\n${bad} problem(s). Re-check the migration step.` : '\nAll checks passed. You can run: npm start');
  process.exit(bad ? 1 : 0);
})();
