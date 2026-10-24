// Borrowing flow: member requests -> admin approves/rejects -> admin marks returned.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');
const { displayStatus, isOverdue, reserveStock, releaseStock } = require('../services/borrowing');

const router = express.Router();

const withDetails = (b) => {
  const u = db.byId('users', b.userId) || {};
  const item = db.byId('equipment', b.equipmentId) || {};
  return { ...b, status2: displayStatus(b), borrower: u.name, schoolId: u.schoolId, course: u.course, equipment: item.name, item };
};

// ---------- Member side ----------
router.get('/mine', requireLogin, (req, res) => {
  const tab = req.query.tab || 'active';
  const all = db.filter('borrowings', (b) => b.userId === req.user.id).map(withDetails);
  const lists = {
    active: all.filter((b) => b.status === 'approved' && b.status2 !== 'overdue'),
    pending: all.filter((b) => b.status === 'pending'),
    returned: all.filter((b) => b.status === 'returned'),
    overdue: all.filter((b) => b.status2 === 'overdue'),
  };
  const dueSoon = lists.active.concat(lists.overdue).sort((a, b) => a.returnDate.localeCompare(b.returnDate))[0];
  res.render('my-borrowings', {
    title: 'My Borrowings',
    lists,
    tab: lists[tab] ? tab : 'active',
    dueSoon,
    active: 'My Borrowings',
  });
});

router.get('/new/:equipmentId', requireLogin, (req, res) => {
  const item = db.byId('equipment', req.params.equipmentId);
  if (!item) return res.redirect('/equipment');
  res.render('borrow-form', { title: 'Borrow Equipment', item, form: {}, error: null, active: 'Equipments' });
});

router.post('/new/:equipmentId', requireLogin, (req, res) => {
  const item = db.byId('equipment', req.params.equipmentId);
  if (!item) return res.redirect('/equipment');
  const fail = (error) => res.status(400).render('borrow-form', { title: 'Borrow Equipment', item, form: req.body, error, active: 'Equipments' });

  const gaps = missing(req.body, [['dateNeeded', 'Date needed'], ['returnDate', 'Expected date return'], ['purpose', 'Purpose of borrowing']]);
  if (gaps.length) return fail(`Please fill in: ${gaps.join(', ')}.`);
  if (!req.body.agree) return fail('You must acknowledge the borrowing rules and regulations.');
  const qty = Number(req.body.quantity) || 1;
  if (qty < 1 || qty > item.available) return fail(`Only ${item.available} unit(s) available.`);
  if (req.body.returnDate < req.body.dateNeeded) return fail('Return date cannot be before the date needed.');
  const days = (new Date(req.body.returnDate) - new Date(req.body.dateNeeded)) / 86400000;
  if (days > item.maxDays) return fail(`This item can be borrowed for up to ${item.maxDays} days.`);

  db.insert('borrowings', {
    code: db.nextCode('borrowings', 'BR'),
    userId: req.user.id,
    equipmentId: item.id,
    quantity: qty,
    dateNeeded: req.body.dateNeeded,
    returnDate: req.body.returnDate,
    purpose: req.body.purpose.trim(),
    notes: (req.body.notes || '').trim(),
    status: 'pending',
  });
  req.flash('success', 'Borrowing request submitted. Waiting for approval.');
  res.redirect('/borrowing/mine?tab=pending');
});

router.post('/:id/extension', requireLogin, (req, res) => {
  const b = db.byId('borrowings', req.params.id);
  if (b && b.userId === req.user.id && b.status === 'approved') {
    db.update('borrowings', b.id, { extensionRequested: true });
    req.flash('success', 'Extension requested.');
  }
  res.redirect('/borrowing/mine');
});

// ---------- Admin side ----------
router.get('/requests', requireRole('admin'), (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const all = db.all('borrowings').map(withDetails);
  const list = all
    .filter((b) => ['pending', 'approved', 'rejected'].includes(b.status) || b.status2 === 'overdue')
    .filter((b) => !q || [b.code, b.borrower, b.equipment].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    pending: all.filter((b) => b.status === 'pending').length,
    approvedToday: all.filter((b) => b.status === 'approved' && (b.updatedAt || '').slice(0, 10) === today).length,
    borrowed: all.filter((b) => b.status === 'approved').reduce((s, b) => s + b.quantity, 0),
    overdue: all.filter((b) => b.status2 === 'overdue').length,
  };
  const overdue = all.filter((b) => b.status2 === 'overdue');
  res.render('borrow-requests', { title: 'Borrowing Requests', list, overdue, stats, q, active: 'Borrowing Request' });
});

router.get('/requests/:id', requireRole('admin'), (req, res) => {
  const b = db.byId('borrowings', req.params.id);
  if (!b) return res.redirect('/borrowing/requests');
  res.render('request-detail', { title: b.code, b: withDetails(b), active: 'Borrowing Request' });
});

router.post('/requests/:id/decision', requireRole('admin'), (req, res) => {
  const b = db.byId('borrowings', req.params.id);
  if (!b || b.status !== 'pending') return res.redirect('/borrowing/requests');
  if (req.body.decision === 'approve') {
    if (!reserveStock(b.equipmentId, b.quantity)) {
      req.flash('error', 'Not enough stock to approve this request.');
      return res.redirect(`/borrowing/requests/${b.id}`);
    }
    db.update('borrowings', b.id, { status: 'approved', adminComment: (req.body.comment || '').trim(), decidedBy: req.user.id });
    req.flash('success', `${b.code} approved.`);
  } else {
    db.update('borrowings', b.id, { status: 'rejected', adminComment: (req.body.comment || '').trim(), decidedBy: req.user.id });
    req.flash('success', `${b.code} rejected.`);
  }
  res.redirect('/borrowing/requests');
});

router.post('/requests/:id/returned', requireRole('admin'), (req, res) => {
  const b = db.byId('borrowings', req.params.id);
  if (b && b.status === 'approved') {
    releaseStock(b.equipmentId, b.quantity);
    db.update('borrowings', b.id, { status: 'returned', actualReturn: new Date().toISOString().slice(0, 10) });
    req.flash('success', `${b.code} marked as returned.`);
  }
  res.redirect('/borrowing/requests');
});

router.get('/records', requireRole('admin'), (req, res) => {
  const records = db
    .filter('borrowings', (b) => b.status === 'returned' || isOverdue(b) || b.status === 'rejected')
    .map(withDetails)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.render('borrow-records', { title: 'Borrowing Records', records, active: 'Borrowing Records' });
});

module.exports = router;
