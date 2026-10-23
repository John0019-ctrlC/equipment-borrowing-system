require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');

const authRoutes = require('./routes/authRoutes');
const { requireLogin, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'Views'));

// Serve CSS, JavaScript, and other static files
app.use(express.static(path.join(__dirname, 'Public')));

// Allow Express to read form data
app.use(express.urlencoded({ extended: false }));

// Remember who is logged in (session)
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'dev-only-secret',
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 2 } // 2 hours
    })
);

// Redirect the homepage to the login page
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Login, signup and logout (saves and reads users from the database)
app.use('/', authRoutes);

// TEMPORARY pages, only to show that login and roles work.
// Replace these with the real dashboard pages.
app.get('/dashboard', requireLogin, (req, res) => {
    res.send(`Student dashboard. Hello, ${req.session.user.name}!
        <form method="POST" action="/logout"><button>Logout</button></form>`);
});

app.get('/admin', requireRole('admin'), (req, res) => {
    res.send(`Admin dashboard. Hello, ${req.session.user.name}!
        <form method="POST" action="/logout"><button>Logout</button></form>`);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
