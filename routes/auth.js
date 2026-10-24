const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { missing } = require('../services/validate');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('login', { title: 'Sign in', error: null, form: {} });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.find('users', (u) => u.email.toLowerCase() === email);
  if (!user || !user.active || !bcrypt.compareSync(req.body.password || '', user.passwordHash)) {
    return res.status(401).render('login', { title: 'Sign in', error: 'Invalid email or password.', form: { email } });
  }
  req.session.userId = user.id;
  res.redirect('/');
});

router.get('/signup', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('signup', { title: 'Create account', error: null, form: {}, orgs: db.all('orgs') });
});

// IR-04/IR-05: only collect what's needed. No sex/gender field.
router.post('/signup', (req, res) => {
  const form = req.body;
  const gaps = missing(form, [
    ['name', 'Full name'],
    ['schoolId', 'School ID'],
    ['course', 'Department / Course'],
    ['email', 'Email'],
    ['password', 'Password'],
    ['orgId', 'Organization'],
  ]);
  const fail = (error) =>
    res.status(400).render('signup', { title: 'Create account', error, form, orgs: db.all('orgs') });

  if (gaps.length) return fail(`Please fill in: ${gaps.join(', ')}.`);
  if (form.password.length < 8) return fail('Password must be at least 8 characters.');
  if (db.find('users', (u) => u.email.toLowerCase() === form.email.trim().toLowerCase()))
    return fail('That email is already registered.');
  if (db.find('users', (u) => u.schoolId === form.schoolId.trim())) return fail('That School ID is already registered.');

  const user = db.insert('users', {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    schoolId: form.schoolId.trim(),
    course: form.course.trim(),
    orgId: form.orgId,
    role: 'member', // officers/advisers are promoted by an admin or officer
    passwordHash: bcrypt.hashSync(form.password, 10),
    active: true,
  });
  req.session.userId = user.id;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
