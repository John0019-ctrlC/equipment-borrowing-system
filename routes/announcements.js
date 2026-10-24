// FR-03: officers post announcements; members view them in one place.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  const items = db
    .filter('announcements', (a) => u.role === 'admin' || a.orgId === u.orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({ ...a, author: (db.byId('users', a.authorId) || {}).name || 'Unknown' }));
  res.render('announcements', { title: 'Announcements', items, active: 'Announcements' });
});

router.post('/', requireRole('officer', 'admin'), (req, res) => {
  const gaps = missing(req.body, [['title', 'Title'], ['message', 'Message']]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}.`);
    return res.redirect('/announcements');
  }
  db.insert('announcements', {
    orgId: req.user.orgId,
    title: req.body.title.trim(),
    message: req.body.message.trim(),
    audience: req.body.audience || 'All members',
    authorId: req.user.id,
  });
  req.flash('success', 'Announcement posted.');
  res.redirect('/announcements');
});

router.post('/:id/delete', requireRole('officer', 'admin'), (req, res) => {
  const a = db.byId('announcements', req.params.id);
  if (a && (req.user.role === 'admin' || a.orgId === req.user.orgId)) db.remove('announcements', a.id);
  res.redirect('/announcements');
});

module.exports = router;
