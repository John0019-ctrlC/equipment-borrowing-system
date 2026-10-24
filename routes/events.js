// FR-04 (schedule/post events) and Use Case 1 (student registers for an activity).
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();

function decorate(e, userId) {
  const regs = db.filter('registrations', (r) => r.eventId === e.id);
  const limit = Number(e.limit) || 0;
  return {
    ...e,
    registered: regs.length,
    isFull: limit > 0 && regs.length >= limit,
    isRegistered: regs.some((r) => r.userId === userId),
  };
}

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  const filter = req.query.filter || 'all';
  const today = new Date().toISOString().slice(0, 10);
  let events = db
    .filter('events', (e) => u.role === 'admin' || e.orgId === u.orgId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => decorate(e, u.id));
  if (filter === 'upcoming') events = events.filter((e) => e.date >= today && e.status !== 'completed');
  if (filter === 'completed') events = events.filter((e) => e.status === 'completed');
  if (filter === 'mine') events = events.filter((e) => e.isRegistered);
  res.render('events', { title: 'Events', events, filter, active: 'Events' });
});

router.post('/', requireRole('officer', 'admin'), (req, res) => {
  const gaps = missing(req.body, [
    ['title', 'Title'],
    ['date', 'Date'],
    ['time', 'Time'],
    ['venue', 'Venue'],
  ]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}.`);
    return res.redirect('/events');
  }
  db.insert('events', {
    orgId: req.user.orgId,
    title: req.body.title.trim(),
    date: req.body.date,
    time: req.body.time,
    venue: req.body.venue.trim(),
    description: (req.body.description || '').trim(),
    limit: Number(req.body.limit) || 0,
    status: 'open',
    createdBy: req.user.id,
  });
  req.flash('success', 'Event posted.');
  res.redirect('/events');
});

router.get('/:id', requireLogin, (req, res) => {
  const e = db.byId('events', req.params.id);
  if (!e) return res.status(404).render('error', { title: 'Not found', message: 'Event not found.' });
  res.render('event-detail', { title: e.title, event: decorate(e, req.user.id), active: 'Events' });
});

// Use Case 1 main + exception flows
router.post('/:id/register', requireRole('member', 'officer'), (req, res) => {
  const e = db.byId('events', req.params.id);
  if (!e) return res.redirect('/events');
  const ev = decorate(e, req.user.id);
  const back = `/events/${e.id}`;
  if (e.status !== 'open') {
    req.flash('error', 'This activity is not open for registration.');
    return res.redirect(back);
  }
  if (ev.isRegistered) {
    req.flash('error', 'You are already registered.');
    return res.redirect(back);
  }
  if (ev.isFull) {
    req.flash('error', 'Registration is unavailable: the participant limit has been reached.');
    return res.redirect(back);
  }
  const u = req.user;
  const gaps = missing(u, [['name', 'name'], ['schoolId', 'School ID'], ['course', 'course']]);
  if (gaps.length) {
    req.flash('error', `Your profile is missing: ${gaps.join(', ')}.`);
    return res.redirect(back);
  }
  db.insert('registrations', { eventId: e.id, userId: u.id });
  req.flash('success', `You're registered for ${e.title}.`);
  res.redirect(back);
});

router.post('/:id/cancel', requireLogin, (req, res) => {
  const r = db.find('registrations', (x) => x.eventId === req.params.id && x.userId === req.user.id);
  if (r) db.remove('registrations', r.id);
  res.redirect(`/events/${req.params.id}`);
});

router.post('/:id/complete', requireRole('officer', 'admin'), (req, res) => {
  const e = db.byId('events', req.params.id);
  if (e && (req.user.role === 'admin' || e.orgId === req.user.orgId)) db.update('events', e.id, { status: 'completed' });
  res.redirect(`/events/${req.params.id}`);
});

module.exports = router;
