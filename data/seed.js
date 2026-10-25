// Idempotent seed: safe to run on every start. It only fills in what is missing,
// so it never overwrites or duplicates data that is already in the database.
const bcrypt = require('bcryptjs');
const db = require('./db');

const OLD_CATEGORIES = ['Audio & Visual', 'Computer & Accessories', 'Sports & Recreation', 'Event Supplies', 'Tools & Maintenance'];

module.exports = async function seed() {
  // ----- Organizations -----
  if (!db.all('orgs').length) {
    db.insert('orgs', { name: 'JPCS', fullName: 'Junior Philippine Computer Society' });
    db.insert('orgs', { name: 'CCS Student Council', fullName: 'CCS Student Council' });
  }
  const jpcs = db.find('orgs', (o) => o.name === 'JPCS') || db.all('orgs')[0];

  // ----- Demo accounts (only the ones that don't exist yet) -----
  const pw = bcrypt.hashSync('password123', 10);
  const mk = (name, email, role, schoolId, course, orgId) => {
    if (db.find('users', (u) => u.email === email || u.schoolId === schoolId)) return;
    db.insert('users', { name, email, role, schoolId, course, orgId, passwordHash: pw, active: true });
  };
  // roles: admin | adviser | officer | member
  mk('Admin User', 'admin@ccs.edu', 'admin', 'ADM-0001', 'CCS Office', null);
  mk('Faculty Adviser', 'adviser@ccs.edu', 'adviser', 'FAC-0001', 'CCS Faculty', jpcs.id);
  mk('Jake Roi Eloreta', 'officer@ccs.edu', 'officer', '12230001', 'BSIT', jpcs.id);
  mk('Mona Lisa', 'member@ccs.edu', 'member', '12239942', 'BSIT', jpcs.id);

  // Non-admin users that came from the original SQL dump have no organization yet.
  db.filter('users', (u) => u.role !== 'admin' && !u.orgId).forEach((u) => db.update('users', u.id, { orgId: jpcs.id }));

  // ----- Equipment: only seed demo stock into an EMPTY equipment table -----
  if (!db.all('equipment').length) {
    OLD_CATEGORIES.forEach((n) => !db.find('categories', (c) => c.name === n) && db.insert('categories', { name: n }));
    const eq = (name, category, total, spec) =>
      db.insert('equipment', { name, category, total, available: total, spec: spec || '', maxDays: 7 });
    eq('Multimedia Projector', OLD_CATEGORIES[0], 5, 'Epson EB-X49 - HDMI / VGA');
    eq('Handheld Microphone', OLD_CATEGORIES[0], 5, 'Wireless - Qty 1');
    eq('Portable PA Speaker', OLD_CATEGORIES[0], 3, 'Rechargeable');
    eq('Soccer Ball', OLD_CATEGORIES[2], 5, 'Size 5');
    eq('Monobloc Chair Set', OLD_CATEGORIES[3], 20, 'Pack of 10');
    eq('Screwdriver Kit', OLD_CATEGORIES[4], 4, '12 pieces');
    eq('USB Extension Cord', OLD_CATEGORIES[1], 6, '5 meters');
  }

  // ----- Demo announcement + events (only when none exist) -----
  const officer = db.find('users', (u) => u.role === 'officer');
  const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
  if (!db.all('announcements').length) {
    db.insert('announcements', {
      orgId: jpcs.id, title: 'CCS Week Kickoff',
      message: 'Join us for the opening program at the gym. Bring your ID.',
      audience: 'All members', authorId: officer.id,
    });
  }
  if (!db.all('events').length) {
    db.insert('events', {
      orgId: jpcs.id, title: 'CCS Week Kickoff', date: inDays(4), time: '09:00', venue: 'Gym',
      description: 'Opening program for CCS Week.', limit: 120, status: 'open', createdBy: officer.id,
    });
    db.insert('events', {
      orgId: jpcs.id, title: 'Web Dev Workshop', date: inDays(10), time: '13:00', venue: 'Lab 2',
      description: 'Hands-on workshop.', limit: 40, status: 'open', createdBy: officer.id,
    });
  }

  await db.flush(); // make sure seed data is really in MySQL before the server starts
};
