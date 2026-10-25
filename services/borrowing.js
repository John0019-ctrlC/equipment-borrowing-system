// Shared borrowing logic used by routes/borrowing.js and routes/dashboard.js.
const db = require('../data/db');

const todayStr = () => new Date().toISOString().slice(0, 10);

function isOverdue(b) {
  return b.status === 'approved' && b.returnDate < todayStr();
}

// Display status shown in tables/badges.
function displayStatus(b) {
  if (isOverdue(b)) return 'overdue';
  return b.status; // pending | approved | rejected | returned
}

function availableFor(equipmentId) {
  const item = db.byId('equipment', equipmentId);
  return item ? item.available : 0;
}

function reserveStock(equipmentId, qty) {
  const item = db.byId('equipment', equipmentId);
  if (!item || item.available < qty) return false;
  db.update('equipment', item.id, { available: item.available - qty });
  return true;
}

function releaseStock(equipmentId, qty) {
  const item = db.byId('equipment', equipmentId);
  if (!item) return;
  db.update('equipment', item.id, { available: Math.min(item.total, item.available + qty) });
}

module.exports = { isOverdue, displayStatus, availableFor, reserveStock, releaseStock, todayStr };
