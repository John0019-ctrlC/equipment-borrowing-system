const express = require('express');
const db = require('../data/db');
const { requireLogin } = require('../middleware/auth');
const { isOverdue } = require('../services/borrowing');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  const today = new Date().toISOString().slice(0, 10);
  const scope = (r) => u.role === 'admin' || r.orgId === u.orgId;

  const upcoming = db
    .filter('events', (e) => scope(e) && e.date >= today && e.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  const announcements = db
    .filter('announcements', scope)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  const stats = {};
  if (u.role === 'member') {
    stats.registered = db.filter('registrations', (r) => r.userId === u.id).length;
    stats.attended = db.filter('attendance', (a) => a.userId === u.id).length;
    stats.activeBorrow = db.filter('borrowings', (b) => b.userId === u.id && b.status === 'approved').length;
  } else {
    stats.members = db.filter('users', (x) => x.role === 'member' && (u.role === 'admin' || x.orgId === u.orgId)).length;
    stats.events = db.filter('events', scope).length;
    stats.pendingApprovals = db.filter('approvals', (a) => a.status === 'pending' && scope(a)).length;
    stats.pendingBorrow = db.filter('borrowings', (b) => b.status === 'pending').length;
    stats.overdue = db.filter('borrowings', isOverdue).length;
  }
  res.render('dashboard', { title: 'Dashboard', upcoming, announcements, stats, active: 'Dashboard' });
});

module.exports = router;
