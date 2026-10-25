// FR-01 (generate/export attendance logs) and FR-02 (QR check-in).
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { makeToken, verifyToken, toDataUrl } = require('../services/qr');
const { toCsv } = require('../services/csv');

const router = express.Router();

function canManage(user, event) {
  return event && (user.role === 'admin' || (user.role === 'officer' && event.orgId === user.orgId));
}

function logFor(eventId) {
  return db
    .filter('attendance', (a) => a.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((a) => {
      const u = db.byId('users', a.userId) || {};
      return { ...a, name: u.name, schoolId: u.schoolId, course: u.course };
    });
}

// Member's own QR for an event (they must be registered).
router.get('/my-qr/:eventId', requireLogin, async (req, res) => {
  const event = db.byId('events', req.params.eventId);
  const reg = db.find('registrations', (r) => r.eventId === req.params.eventId && r.userId === req.user.id);
  if (!event || !reg) return res.status(404).render('error', { title: 'Not found', message: 'Register for the event first.' });
  const token = makeToken(event.id, req.user.id);
  res.render('my-qr', { title: 'My QR', event, token, qr: await toDataUrl(token), active: 'Events' });
});

// Officer scanner + live log
router.get('/:eventId', requireRole('officer', 'admin'), (req, res) => {
  const event = db.byId('events', req.params.eventId);
  if (!canManage(req.user, event)) return res.status(403).render('error', { title: 'Forbidden', message: 'Not your event.' });
  res.render('attendance', { title: 'Attendance', event, log: logFor(event.id), active: 'Events' });
});

// Check-in by QR token OR by school ID (fallback). Returns JSON so the scanner stays on screen.
router.post('/:eventId/checkin', requireRole('officer', 'admin'), (req, res) => {
  const event = db.byId('events', req.params.eventId);
  if (!canManage(req.user, event)) return res.status(403).json({ ok: false, message: 'Not your event.' });

  let userId = null;
  if (req.body.token) {
    const parsed = verifyToken(req.body.token);
    if (!parsed || parsed.eventId !== event.id) return res.status(400).json({ ok: false, message: 'Invalid QR code.' });
    userId = parsed.userId;
  } else if (req.body.schoolId) {
    const u = db.find('users', (x) => x.schoolId === String(req.body.schoolId).trim());
    if (!u) return res.status(404).json({ ok: false, message: 'No member with that School ID.' });
    userId = u.id;
  } else {
    return res.status(400).json({ ok: false, message: 'Scan a QR code or enter a School ID.' });
  }

  const user = db.byId('users', userId);
  if (!user) return res.status(404).json({ ok: false, message: 'Member not found.' });
  if (db.find('attendance', (a) => a.eventId === event.id && a.userId === userId))
    return res.json({ ok: false, message: `${user.name} is already checked in.` });

  db.insert('attendance', { eventId: event.id, userId, method: req.body.token ? 'qr' : 'manual', checkedBy: req.user.id });
  res.json({ ok: true, message: `Checked in: ${user.name}`, count: logFor(event.id).length });
});

// FR-01 export
router.get('/:eventId/export.csv', requireRole('officer', 'admin'), (req, res) => {
  const event = db.byId('events', req.params.eventId);
  if (!canManage(req.user, event)) return res.status(403).send('Forbidden');
  const rows = logFor(event.id).map((a) => [a.schoolId, a.name, a.course, a.method, a.createdAt]);
  const csv = toCsv(['School ID', 'Name', 'Course', 'Method', 'Checked in at'], rows);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-${event.title.replace(/\W+/g, '-')}.csv"`);
  res.send(csv);
});

module.exports = router;
