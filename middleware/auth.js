// Access control: protects pages from people who are not allowed in.

// Must be logged in
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Must have a specific role, e.g. requireRole('admin')
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.role !== role) {
      return res.status(403).send('403 Forbidden: you are not allowed to open this page.');
    }
    next();
  };
}

// For /login and /signup: if already logged in, go to the right dashboard
function redirectIfLoggedIn(req, res, next) {
  const user = req.session.user;
  if (user) return res.redirect(user.role === 'admin' ? '/admin' : '/dashboard');
  next();
}

module.exports = { requireLogin, requireRole, redirectIfLoggedIn };
