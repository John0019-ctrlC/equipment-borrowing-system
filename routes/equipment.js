// Equipment module: admin inventory (CRUD) + member catalog by category.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');

const router = express.Router();
// Categories now come from the `categories` table instead of a hard-coded list.
const getCategories = () => db.all('categories').map((c) => c.name);

router.get('/', requireLogin, (req, res) => {
  const CATEGORIES = getCategories();
  const items = db.all('equipment');
  const counts = CATEGORIES.map((c) => ({
    name: c,
    items: items.filter((i) => i.category === c).length,
    available: items.filter((i) => i.category === c).reduce((s, i) => s + i.available, 0),
  }));

  if (req.user.role === 'admin') {
    return res.render('inventory', { title: 'Equipments Inventory', items, counts, categories: CATEGORIES, active: 'Equipments Inventory' });
  }

  const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const q = (req.query.q || '').toLowerCase();
  const list = items.filter((i) => (!category || i.category === category) && (!q || i.name.toLowerCase().includes(q)));
  const activeBorrow = db.filter('borrowings', (b) => b.userId === req.user.id && b.status === 'approved').length;
  res.render('catalog', {
    title: 'Equipments',
    list,
    counts,
    category,
    q,
    totals: { total: items.length, ready: items.filter((i) => i.available > 0).length, activeBorrow },
    active: 'Equipments',
  });
});

router.post('/', requireRole('admin'), (req, res) => {
  const CATEGORIES = getCategories();
  const gaps = missing(req.body, [['name', 'Item name'], ['category', 'Category']]);
  const qty = Number(req.body.quantity);
  if (gaps.length || !CATEGORIES.includes(req.body.category) || !(qty >= 1)) {
    req.flash('error', 'Item name, a valid category and quantity of at least 1 are required.');
    return res.redirect('/equipment');
  }
  db.insert('equipment', {
    name: req.body.name.trim(),
    category: req.body.category,
    total: qty,
    available: qty,
    spec: (req.body.spec || '').trim(),
    maxDays: 7,
  });
  req.flash('success', 'Equipment added.');
  res.redirect('/equipment');
});

router.post('/:id/edit', requireRole('admin'), (req, res) => {
  const CATEGORIES = getCategories();
  const item = db.byId('equipment', req.params.id);
  const total = Number(req.body.total);
  if (!item || !(total >= 0) || !CATEGORIES.includes(req.body.category)) return res.redirect('/equipment');
  const out = item.total - item.available; // units currently borrowed
  if (total < out) {
    req.flash('error', `Cannot set total below the ${out} unit(s) currently borrowed.`);
    return res.redirect('/equipment');
  }
  db.update('equipment', item.id, {
    name: (req.body.name || item.name).trim(),
    category: req.body.category,
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
