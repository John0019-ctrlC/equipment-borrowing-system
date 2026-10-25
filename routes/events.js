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
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const visibleEvents = db
    .filter('events', (e) => u.role === 'admin' || e.orgId == null || e.orgId === u.orgId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => decorate(e, u.id));

  if (u.role === 'admin') {
    const q = String(req.query.q || '').trim().toLowerCase();
    const status = ['open', 'completed', 'cancelled'].includes(req.query.status)
      ? req.query.status
      : 'all';
    const events = visibleEvents.filter((event) => {
      const statusMatches = status === 'all' || event.status === status;
      const searchMatches = !q || [event.title, event.date, event.time, event.venue, event.description, event.status]
        .some((value) => String(value || '').toLowerCase().includes(q));
      return statusMatches && searchMatches;
    });
    const stats = {
      total: visibleEvents.length,
      upcoming: visibleEvents.filter((event) => event.date >= today && event.status === 'open').length,
      registrations: visibleEvents.reduce((count, event) => count + event.registered, 0),
      completed: visibleEvents.filter((event) => event.status === 'completed').length,
    };
    return res.render('event-management', {
      title: 'Events',
      events,
      stats,
      filters: { q: req.query.q || '', status },
      active: 'Events',
    });
  }

  const filter = req.query.filter || 'all';
  const q = String(req.query.q || '').trim();
  let events = visibleEvents;
  if (filter === 'upcoming') events = events.filter((e) => e.date >= today && !['completed', 'cancelled'].includes(e.status));
  if (filter === 'completed') events = events.filter((e) => e.status === 'completed');
  if (filter === 'mine') events = events.filter((e) => e.isRegistered);
  if (filter === 'attended') {
    const attendedIds = new Set(
      db.filter('attendance', (record) => record.userId === u.id).map((record) => record.eventId)
    );
    events = events.filter((e) => attendedIds.has(e.id));
  }
  if (q) {
    const search = q.toLowerCase();
    events = events.filter((e) => [e.title, e.date, e.venue, e.status].some((value) => String(value || '').toLowerCase().includes(search)));
  }
  res.render('events', { title: 'Events', events, filter, q, active: 'Events' });
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

router.get('/:id/edit', requireRole('admin'), (req, res) => {
  const event = db.byId('events', req.params.id);
  if (!event) return res.status(404).render('error', { title: 'Not found', message: 'Event not found.' });
  res.render('event-edit', { title: 'Edit event', event, active: 'Events' });
});

router.post('/:id/edit', requireRole('admin'), (req, res) => {
  const event = db.byId('events', req.params.id);
  if (!event) return res.status(404).render('error', { title: 'Not found', message: 'Event not found.' });

  const gaps = missing(req.body, [['title', 'Title'], ['date', 'Date'], ['time', 'Time'], ['venue', 'Venue']]);
  const limit = Number(req.body.limit);
  if (gaps.length || !Number.isFinite(limit) || limit < 0 || !['open', 'completed', 'cancelled'].includes(req.body.status)) {
    req.flash('error', gaps.length ? `Please fill in: ${gaps.join(', ')}.` : 'Enter a valid participant limit and event status.');
    return res.redirect(`/events/${event.id}/edit`);
  }

  db.update('events', event.id, {
    title: req.body.title.trim(),
    date: req.body.date,
    time: req.body.time,
    venue: req.body.venue.trim(),
    description: (req.body.description || '').trim(),
    limit,
    status: req.body.status,
  });
  req.flash('success', 'Event updated.');
  res.redirect('/events');
});

router.post('/:id/delete', requireRole('admin'), (req, res) => {
  const event = db.byId('events', req.params.id);
  if (!event) {
    req.flash('error', 'Event not found.');
    return res.redirect('/events');
  }
  db.filter('registrations', (registration) => registration.eventId === event.id)
    .forEach((registration) => db.remove('registrations', registration.id));
  db.filter('attendance', (record) => record.eventId === event.id)
    .forEach((record) => db.remove('attendance', record.id));
  db.remove('events', event.id);
  req.flash('success', 'Event deleted.');
  res.redirect('/events');
});

router.get('/:id', requireLogin, (req, res) => {
  const e = db.byId('events', req.params.id);
  if (!e) return res.status(404).render('error', { title: 'Not found', message: 'Event not found.' });
  if (req.user.role !== 'admin' && e.orgId != null && e.orgId !== req.user.orgId) {
    return res.status(404).render('error', { title: 'Not found', message: 'Event not found.' });
  }
  res.render('event-detail', { title: e.title, event: decorate(e, req.user.id), active: 'Events' });
});

// Use Case 1 main + exception flows
router.post('/:id/register', requireRole('member', 'officer'), (req, res) => {
  const e = db.byId('events', req.params.id);
  if (!e) return res.redirect('/events');
  if (e.orgId != null && e.orgId !== req.user.orgId) return res.redirect('/events');
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

router.post('/:id/cancel', requireRole('member', 'officer'), (req, res) => {
  const event = db.byId('events', req.params.id);
  if (!event || (event.orgId != null && event.orgId !== req.user.orgId)) return res.redirect('/events');
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
