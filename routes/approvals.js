// FR-06: advisers view and approve plans, financial reports, or activity submissions.
const express = require('express');
const db = require('../data/db');
const { requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();
const TYPES = ['Activity plan', 'Financial report', 'Activity submission'];

router.get('/', requireRole('officer', 'adviser', 'admin'), (req, res) => {
  const u = req.user;
  const items = db
    .filter('approvals', (a) => u.role === 'admin' || a.orgId === u.orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({ ...a, submitter: (db.byId('users', a.submittedBy) || {}).name }));
  res.render('approvals', { title: 'Approvals', items, types: TYPES, active: 'Approvals' });
});

router.post('/', requireRole('officer'), (req, res) => {
  const gaps = missing(req.body, [['type', 'Type'], ['title', 'Title'], ['details', 'Details']]);
  if (gaps.length || !TYPES.includes(req.body.type)) {
    req.flash('error', gaps.length ? `Please fill in: ${gaps.join(', ')}.` : 'Invalid submission type.');
    return res.redirect('/approvals');
  }
  db.insert('approvals', {
    orgId: req.user.orgId,
    type: req.body.type,
    title: req.body.title.trim(),
    details: req.body.details.trim(),
    amount: Number(req.body.amount) || 0,
    status: 'pending',
    submittedBy: req.user.id,
  });
  req.flash('success', 'Submitted for adviser review.');
  res.redirect('/approvals');
});

router.post('/:id/decision', requireRole('adviser'), (req, res) => {
  const a = db.byId('approvals', req.params.id);
  const decision = req.body.decision;
  if (!a || a.orgId !== req.user.orgId || !['approved', 'rejected'].includes(decision)) return res.redirect('/approvals');
  db.update('approvals', a.id, {
    status: decision,
    reviewedBy: req.user.id,
    reviewNote: (req.body.note || '').trim(),
  });
  req.flash('success', `Submission ${decision}.`);
  res.redirect('/approvals');
});

module.exports = router;
