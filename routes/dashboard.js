const express = require('express');
const db = require('../data/db');
const { requireLogin } = require('../middleware/auth');
const { isOverdue } = require('../services/borrowing');
const { canView } = require('../services/announcements');

const router = express.Router();

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  const now = new Date();
  const localDateKey = (date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const scope = (r) => u.role === 'admin' || r.orgId == null || r.orgId === u.orgId;

  const upcoming = db
    .filter('events', (e) => scope(e) && e.date >= today && e.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((event) => {
      const registered = db.filter('registrations', (registration) => registration.eventId === event.id).length;
      const limit = Number(event.limit) || 0;
      return { ...event, isFull: limit > 0 && registered >= limit };
    })
    .slice(0, 5);
  const announcements = db
    .filter('announcements', (announcement) => canView(announcement, u, now))
    .sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)
      || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  const stats = {};
  if (u.role === 'member') {
    const visibleEventIds = new Set(
      db.filter('events', scope).map((event) => event.id)
    );
    const registeredEventIds = new Set(
      db.filter('registrations', (r) => r.userId === u.id && visibleEventIds.has(r.eventId)).map((r) => r.eventId)
    );
    stats.registered = registeredEventIds.size;
    stats.attended = new Set(
      db.filter('attendance', (a) => a.userId === u.id && visibleEventIds.has(a.eventId)).map((a) => a.eventId)
    ).size;
    stats.activeBorrow = db.filter(
      'borrowings',
      (b) => b.userId === u.id && b.status === 'approved' && !isOverdue(b)
    ).length;
  } else {
    stats.members = db.filter(
      'users',
      (x) => x.role === 'member' && x.active !== false && (u.role === 'admin' || x.orgId === u.orgId)
    ).length;
    stats.events = db.filter('events', scope).length;
    stats.pendingApprovals = db.filter('approvals', (a) => a.status === 'pending' && scope(a)).length;
    if (u.role === 'admin') {
      stats.pendingBorrow = db.filter('borrowings', (b) => b.status === 'pending').length;
      stats.overdue = db.filter('borrowings', isOverdue).length;
      const todayKey = localDateKey(now);
      stats.approvedBorrowToday = db.filter('borrowings', (b) => (
        b.status === 'approved'
        && b.updatedAt
        && localDateKey(new Date(b.updatedAt)) === todayKey
      )).length;
    }
  }
  res.render('dashboard', { title: 'Dashboard', upcoming, announcements, stats, active: 'Dashboard' });
});

module.exports = router;
