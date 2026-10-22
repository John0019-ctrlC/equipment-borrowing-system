
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Configure EJS as the view engine
app.set('view engine', 'ejs');
app.set('Views', path.join(__dirname, 'Views'));

// Serve CSS, JavaScript, and other static files
app.use(express.static(path.join(__dirname, 'Public')));

// Allow Express to read form data
app.use(express.urlencoded({ extended: false }));

// Redirect the homepage to the login page
app.get('/', (req, res) => {
    res.redirect('/login');
});

// Display the login page
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Display the signup page
app.get('/signup', (req, res) => {
    res.render('signup', {
        error: null,
        success: null
    });
});

// Temporary login handler for testing the form
app.post('/login', (req, res) => {
    res.render('login', {
        error: 'Login authentication has not been implemented yet.'
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
