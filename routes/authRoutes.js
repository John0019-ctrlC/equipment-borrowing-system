const express = require('express');
const auth = require('../controllers/authController');
const { redirectIfLoggedIn } = require('../middleware/auth');

const router = express.Router();

router.get('/signup', redirectIfLoggedIn, auth.showSignup);
router.post('/signup', redirectIfLoggedIn, auth.signup);

router.get('/login', redirectIfLoggedIn, auth.showLogin);
router.post('/login', redirectIfLoggedIn, auth.login);

router.post('/logout', auth.logout);

module.exports = router;
