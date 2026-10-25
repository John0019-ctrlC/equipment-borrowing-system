// Equipment module: admin inventory (CRUD) + member catalog by category.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();
const DEFAULT_CATEGORIES = ['Audio & Visual', 'Computer & Accessories', 'Sports & Recreation', 'Event Supplies', 'Tools & Maintenance'];

function getCategories(items) {
  return [...new Set(DEFAULT_CATEGORIES.concat(items.map((item) => item.category).filter(Boolean)))]
    .sort((a, b) => a.localeCompare(b));
}

router.get('/', requireLogin, (req, res) => {
  const allItems = db.all('equipment');
  const categories = getCategories(allItems);
  const counts = categories.map((c) => ({
    name: c,
    items: allItems.filter((i) => i.category === c).length,
    available: allItems.filter((i) => i.category === c).reduce((s, i) => s + i.available, 0),
  }));

  if (req.user.role === 'admin') {
    const category = categories.includes(req.query.category) ? req.query.category : null;
    const items = category ? allItems.filter((item) => item.category === category) : allItems;
    return res.render('inventory', {
      title: 'Equipments Inventory',
      items,
      counts,
      categories,
      category,
      active: 'Equipments Inventory',
    });
  }

  const category = categories.includes(req.query.category) ? req.query.category : null;
  const q = String(req.query.q || '').trim().toLowerCase();
  const list = category
    ? allItems.filter((item) => item.category === category
      && (!q || [item.name, item.spec].some((value) => String(value || '').toLowerCase().includes(q))))
    : [];
  const activeBorrow = db
    .filter('borrowings', (borrowing) => borrowing.userId === req.user.id && borrowing.status === 'approved')
    .reduce((total, borrowing) => total + (Number(borrowing.quantity) || 0), 0);
  const borrowItem = req.query.borrow ? db.byId('equipment', req.query.borrow) : null;
  const catalogTotals = {
    total: allItems.reduce((total, item) => total + (Number(item.total) || 0), 0),
    ready: allItems.reduce((total, item) => total + (Number(item.available) || 0), 0),
    activeBorrow,
  };
  res.render('catalog', {
    title: 'Equipments',
    list,
    counts,
    category,
    q,
    totals: catalogTotals,
    borrowItem,
    active: 'Equipments',
  });
});

router.post('/', requireRole('admin'), (req, res) => {
  const gaps = missing(req.body, [['name', 'Item name'], ['category', 'Category']]);
  const qty = Number(req.body.quantity);
  if (gaps.length || !Number.isFinite(qty) || qty < 1) {
    req.flash('error', 'Item name, category and quantity of at least 1 are required.');
    return res.redirect('/equipment');
  }
  db.insert('equipment', {
    name: req.body.name.trim(),
    category: req.body.category.trim(),
    total: qty,
    available: qty,
    spec: (req.body.spec || '').trim(),
    maxDays: 7,
  });
  req.flash('success', 'Equipment added.');
  res.redirect('/equipment');
});

router.post('/:id/edit', requireRole('admin'), (req, res) => {
  const item = db.byId('equipment', req.params.id);
  const total = Number(req.body.total);
  const name = String(req.body.name || '').trim();
  const category = String(req.body.category || '').trim();
  if (!item || !Number.isFinite(total) || total < 0 || !name || !category) {
    req.flash('error', 'Item name, category and a valid quantity are required.');
    return res.redirect('/equipment');
  }
  const out = item.total - item.available; // units currently borrowed
  if (total < out) {
    req.flash('error', `Cannot set total below the ${out} unit(s) currently borrowed.`);
    return res.redirect('/equipment');
  }
  db.update('equipment', item.id, {
    name,
    category,
    total,
    available: total - out,
  });
  res.redirect('/equipment');
});

router.post('/:id/delete', requireRole('admin'), (req, res) => {
  const item = db.byId('equipment', req.params.id);
  if (item && item.total === item.available) db.remove('equipment', item.id);
  else req.flash('error', 'Cannot delete equipment that is currently borrowed.');
  res.redirect('/equipment');
});

module.exports = router;
