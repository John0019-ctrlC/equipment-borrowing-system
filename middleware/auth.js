const db = require('../data/db');
const { navFor } = require('../config/nav');

// Makes `user`, `nav`, `flash`, `currentPath` available to every view.
function attachLocals(req, res, next) {
  const user = req.session.userId ? db.byId('users', req.session.userId) : null;
  req.user = user && user.active ? user : null;
  res.locals.user = req.user;
  res.locals.nav = req.user ? navFor(req.user.role) : [];
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.isStaff = !!req.user && ['admin', 'officer', 'adviser'].includes(req.user.role);
  req.flash = (type, text) => (req.session.flash = { type, text });
  next();
}

function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('error', { title: 'Forbidden', message: 'You do not have access to this page.' });
    }
    next();
  };
}

module.exports = { attachLocals, requireLogin, requireRole };
