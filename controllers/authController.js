// Signup, login and logout logic.

const bcrypt = require('bcrypt');
const User = require('../models/userModel');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- SIGNUP ----------

exports.showSignup = (req, res) => {
  res.render('signup', { error: null, success: null });
};

exports.signup = async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirmPassword = req.body.confirmPassword || '';

  const fail = (message) => res.status(400).render('signup', { error: message, success: null });

  // Validate before saving
  if (!name || !email || !password || !confirmPassword) return fail('Please fill in all fields.');
  if (name.length < 2 || name.length > 100) return fail('Full name must be 2 to 100 characters.');
  if (!EMAIL_PATTERN.test(email) || email.length > 100) return fail('Please enter a valid email address.');
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (password !== confirmPassword) return fail('Passwords do not match.');

  try {
    if (await User.findByEmail(email)) return fail('That email is already registered.');

    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ fullName: name, email, passwordHash });

    // Saved in the database. Send the user to login.
    return res.redirect('/login?registered=1');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return fail('That email is already registered.');
    console.error('Signup error:', err);
    return res.status(500).render('signup', {
      error: 'Something went wrong. Please try again.',
      success: null,
    });
  }
};

// ---------- LOGIN ----------

exports.showLogin = (req, res) => {
  const success = req.query.registered ? 'Account created! You can now log in.' : null;
  res.render('login', { error: null, success });
};

exports.login = async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const fail = (message, status = 401) =>
    res.status(status).render('login', { error: message, success: null });

  if (!email || !password) return fail('Please enter your email and password.', 400);

  try {
    const user = await User.findByEmail(email);
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

    // Same message for wrong email and wrong password, so nobody can guess which emails exist.
    if (!user || !passwordMatches) return fail('Incorrect email or password.');

    // New session id on login (prevents session fixation)
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session error:', err);
        return fail('Something went wrong. Please try again.', 500);
      }
      req.session.user = {
        id: user.user_id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      };
      req.session.save(() => {
        res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
      });
    });
  } catch (err) {
    console.error('Login error:', err);
    return fail('Something went wrong. Please try again.', 500);
  }
};

// ---------- LOGOUT ----------

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};
