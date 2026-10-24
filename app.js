require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const db = require('./data/db');

const { attachLocals } = require('./middleware/auth');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'Public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'ccs-orghub-dev-secret', // set SESSION_SECRET in .env for real use
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);
app.use(attachLocals);

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/dashboard'));
app.use('/announcements', require('./routes/announcements'));
app.use('/events', require('./routes/events'));
app.use('/attendance', require('./routes/attendance'));
app.use('/reports', require('./routes/reports'));
app.use('/approvals', require('./routes/approvals'));
app.use('/compliance', require('./routes/compliance'));
app.use('/members', require('./routes/members'));
app.use('/equipment', require('./routes/equipment'));
app.use('/borrowing', require('./routes/borrowing'));

app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'Page not found.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'Error', message: 'Something went wrong.' });
});

// Start only after MySQL is reachable and data is loaded.
const PORT = process.env.PORT || 3000;
(async () => {
  try {
    await db.load();
    console.log('[db] Connected to MySQL and loaded data.');
    await require('./data/seed')();
  } catch (err) {
    console.error('[db] Could not start. Check MySQL is running and your .env settings.\n ', err.message);
    process.exit(1);
  }
  const server = app.listen(PORT, () => console.log(`CCS OrgHub running on http://localhost:${PORT}`));
  const shutdown = async () => {
    server.close();
    await db.close(); // finish pending writes before exiting
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
