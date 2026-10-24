// FR-07: administrators view org compliance status across organizations.
const express = require('express');
const db = require('../data/db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('admin', 'adviser'), (req, res) => {
  const orgs = db
    .all('orgs')
    .filter((o) => req.user.role === 'admin' || o.id === req.user.orgId)
    .map((o) => {
      const members = db.filter('users', (u) => u.orgId === o.id && u.active && u.role !== 'admin');
      const events = db.filter('events', (e) => e.orgId === o.id);
      const completed = events.filter((e) => e.status === 'completed');
      const reported = completed.filter((e) => db.find('reports', (r) => r.eventId === e.id));
      const approvals = db.filter('approvals', (a) => a.orgId === o.id);
      const pending = approvals.filter((a) => a.status === 'pending').length;
      const missingReports = completed.length - reported.length;
      return {
        ...o,
        activeMembers: members.length,
        events: events.length,
        completed: completed.length,
        reports: reported.length,
        missingReports,
        pending,
        compliant: missingReports === 0 && pending === 0,
      };
    });
  res.render('compliance', { title: 'Compliance', orgs, active: 'Compliance' });
});

module.exports = router;
