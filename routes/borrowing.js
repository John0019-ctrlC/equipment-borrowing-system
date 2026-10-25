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
  const returnToItem = (error) => {
    req.flash('error', error);
    res.redirect(`/equipment?category=${encodeURIComponent(item.category)}&borrow=${encodeURIComponent(item.id)}`);
  };

  const gaps = missing(req.body, [['dateNeeded', 'Date needed'], ['returnDate', 'Expected date return'], ['purpose', 'Purpose of borrowing']]);
  if (gaps.length) return returnToItem(`Please fill in: ${gaps.join(', ')}.`);
  if (!req.body.agree) return returnToItem('You must acknowledge the borrowing rules and regulations.');
  const qty = Number(req.body.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > item.available) {
    return returnToItem(`Enter a quantity from 1 to ${item.available}.`);
  }
  if (req.body.returnDate < req.body.dateNeeded) return returnToItem('Return date cannot be before the date needed.');
  const days = (new Date(req.body.returnDate) - new Date(req.body.dateNeeded)) / 86400000;
  if (days > item.maxDays) return returnToItem(`This item can be borrowed for up to ${item.maxDays} days.`);

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
  res.redirect(`/equipment?category=${encodeURIComponent(item.category)}`);
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
  const q = String(req.query.q || '').trim().toLowerCase();
  const status = ['pending', 'overdue', 'approved-today'].includes(req.query.status)
    ? req.query.status
    : '';
  const all = db.all('borrowings').map(withDetails);
  const today = new Date();
  const todayKey = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const approvedToday = (b) => {
    if (b.status !== 'approved' || !b.updatedAt) return false;
    const updatedAt = new Date(b.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return false;
    const updatedDateKey = [
      updatedAt.getFullYear(),
      String(updatedAt.getMonth() + 1).padStart(2, '0'),
      String(updatedAt.getDate()).padStart(2, '0'),
    ].join('-');
    return updatedDateKey === todayKey;
  };
  const list = all
    .filter((b) => !status
      || (status === 'overdue' ? b.status2 === 'overdue'
        : status === 'approved-today' ? approvedToday(b)
          : b.status === status))
    .filter((b) => !q || [b.code, b.borrower, b.equipment].some((v) => String(v || '').toLowerCase().includes(q)))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const stats = {
    total: all.length,
    pending: all.filter((b) => b.status === 'pending').length,
    approvedToday: all.filter(approvedToday).length,
    overdue: all.filter((b) => b.status2 === 'overdue').length,
  };
  res.render('borrow-requests', {
    title: 'Borrowing Requests',
    list,
    stats,
    q: req.query.q || '',
    status,
    active: 'Borrowing Request',
  });
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
      return res.redirect('/borrowing/requests');
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
