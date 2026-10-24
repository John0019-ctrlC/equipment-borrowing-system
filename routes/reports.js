// FR-05: officers submit event reports after an activity is completed.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  if (u.role === 'member') return res.status(403).render('error', { title: 'Forbidden', message: 'Officers, advisers and admins only.' });
  const reports = db
    .filter('reports', (r) => u.role === 'admin' || r.orgId === u.orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r, event: db.byId('events', r.eventId) || {}, author: (db.byId('users', r.authorId) || {}).name }));
  const reportedIds = new Set(db.all('reports').map((r) => r.eventId));
  const reportable = db.filter(
    'events',
    (e) => e.orgId === u.orgId && e.status === 'completed' && !reportedIds.has(e.id)
  );
  res.render('reports', { title: 'Event Reports', reports, reportable, active: 'Reports' });
});

router.post('/', requireRole('officer'), (req, res) => {
  const gaps = missing(req.body, [['eventId', 'Event'], ['summary', 'Summary'], ['outcome', 'Outcome']]);
  const event = db.byId('events', req.body.eventId);
  if (gaps.length || !event || event.orgId !== req.user.orgId || event.status !== 'completed') {
    req.flash('error', gaps.length ? `Please fill in: ${gaps.join(', ')}.` : 'Choose a completed event from your organization.');
    return res.redirect('/reports');
  }
  const attended = db.filter('attendance', (a) => a.eventId === event.id).length;
  db.insert('reports', {
    orgId: req.user.orgId,
    eventId: event.id,
    summary: req.body.summary.trim(),
    outcome: req.body.outcome.trim(),
    budgetSpent: Number(req.body.budgetSpent) || 0,
    attendeeCount: attended,
    authorId: req.user.id,
  });
  req.flash('success', 'Event report submitted.');
  res.redirect('/reports');
});

module.exports = router;
