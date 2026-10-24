// Use Case 2: officer manages organization members (add / update / remove).
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();
const ROLES = ['member', 'officer', 'adviser']; // roles by function, never by gender (IR-01)

function scoped(user) {
  return db.filter('users', (u) => u.role !== 'admin' && (user.role === 'admin' || u.orgId === user.orgId));
}

router.get('/', requireRole('officer', 'admin'), (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const members = scoped(req.user).filter(
    (m) => !q || [m.name, m.schoolId, m.course, m.email].some((v) => String(v || '').toLowerCase().includes(q))
  );
  res.render('members', { title: 'Members', members, q, roles: ROLES, orgs: db.all('orgs'), active: 'Members' });
});

router.post('/', requireRole('officer', 'admin'), (req, res) => {
  const gaps = missing(req.body, [['name', 'Name'], ['schoolId', 'School ID'], ['course', 'Course'], ['email', 'Email']]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}. Record not saved.`);
    return res.redirect('/members');
  }
  const email = req.body.email.trim().toLowerCase();
  if (db.find('users', (u) => u.email === email || u.schoolId === req.body.schoolId.trim())) {
    req.flash('error', 'Email or School ID already exists.');
    return res.redirect('/members');
  }
  db.insert('users', {
    name: req.body.name.trim(),
    email,
    schoolId: req.body.schoolId.trim(),
    course: req.body.course.trim(),
    role: ROLES.includes(req.body.role) ? req.body.role : 'member',
    orgId: req.user.role === 'admin' ? req.body.orgId || null : req.user.orgId,
    passwordHash: bcrypt.hashSync('changeme123', 10), // member must change on first login
    active: true,
  });
  req.flash('success', 'Member added. Temporary password: changeme123');
  res.redirect('/members');
});

router.post('/:id/update', requireRole('officer', 'admin'), (req, res) => {
  const m = scoped(req.user).find((x) => x.id === req.params.id);
  if (!m) return res.redirect('/members');
  const gaps = missing(req.body, [['name', 'Name'], ['course', 'Course']]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}. Record not saved.`);
    return res.redirect('/members');
  }
  db.update('users', m.id, {
    name: req.body.name.trim(),
    course: req.body.course.trim(),
    role: ROLES.includes(req.body.role) ? req.body.role : m.role,
  });
  req.flash('success', 'Member updated.');
  res.redirect('/members');
});

// Soft-remove keeps attendance history intact (NFR-03 record retention).
router.post('/:id/remove', requireRole('officer', 'admin'), (req, res) => {
  const m = scoped(req.user).find((x) => x.id === req.params.id);
  if (m && m.id !== req.user.id) db.update('users', m.id, { active: false });
  req.flash('success', 'Member removed.');
  res.redirect('/members');
});

module.exports = router;
