// FR-03: officers post announcements; members view them in one place.
const express = require('express');
const db = require('../data/db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { missing } = require('../services/validate');
const { audienceGroup, canView, displayStatus } = require('../services/announcements');

const router = express.Router();

function formatAnnouncementMessage(message) {
  const escapeHtml = (text) => text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

  function formatInline(text) {
    return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part) => {
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link) {
        let safeUrl;
        try {
          const parsed = new URL(link[2]);
          if (!['http:', 'https:'].includes(parsed.protocol)) return escapeHtml(part);
          safeUrl = escapeHtml(parsed.href);
        } catch (error) {
          return escapeHtml(part);
        }
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(link[1])}</a>`;
      }
      return escapeHtml(part)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>');
    }).join('');
  }

  const lines = String(message || '').split(/\r?\n/);
  const output = [];
  let listType = null;
  function closeList() {
    if (listType) output.push(`</${listType}>`);
    listType = null;
  }

  lines.forEach((line) => {
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const item = unordered || ordered;
    if (item) {
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${formatInline(item[1])}</li>`);
    } else {
      closeList();
      if (line.trim()) output.push(`<p>${formatInline(line)}</p>`);
    }
  });
  closeList();
  return output.join('');
}

function managementItem(announcement, now) {
  const createdAt = typeof announcement.createdAt === 'string' ? announcement.createdAt : '';
  return {
    ...announcement,
    title: String(announcement.title || 'Untitled announcement'),
    message: String(announcement.message || ''),
    audience: String(announcement.audience || 'All members'),
    createdAt,
    author: (db.byId('users', announcement.authorId) || {}).name || 'Unknown',
    displayStatus: displayStatus(announcement, now),
    targetGroup: audienceGroup(announcement.audience),
  };
}

router.get('/', requireLogin, (req, res) => {
  const u = req.user;
  const now = new Date();
  const allItems = db.all('announcements')
    .map((announcement) => managementItem(announcement, now))
    .sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true)
      || b.createdAt.localeCompare(a.createdAt));

  if (u.role === 'admin') {
    const q = String(req.query.q || '').trim().toLowerCase();
    const status = ['live', 'draft'].includes(req.query.status) ? req.query.status : 'all';
    const target = ['students', 'faculty'].includes(req.query.target) ? req.query.target : 'all';
    const items = allItems.filter((item) => {
      const statusMatches = status === 'all'
        || (status === 'live' && item.displayStatus === 'Live')
        || (status === 'draft' && ['Draft', 'Scheduled'].includes(item.displayStatus));
      const targetMatches = target === 'all' || item.targetGroup === target;
      const searchMatches = !q || [item.title, item.message, item.author, item.audience]
        .some((value) => String(value || '').toLowerCase().includes(q));
      return statusMatches && targetMatches && searchMatches;
    });
    const activeItems = allItems.filter((item) => item.displayStatus !== 'Archived');
    const stats = {
      total: activeItems.length,
      published: activeItems.filter((item) => item.displayStatus === 'Live').length,
      drafts: activeItems.filter((item) => ['Draft', 'Scheduled'].includes(item.displayStatus)).length,
      priority: activeItems.filter((item) => item.pinned || item.priority === 'urgent').length,
    };
    return res.render('announcement-management', {
      title: 'Announcements',
      items,
      stats,
      filters: { q: req.query.q || '', status, target },
      active: 'Announcements',
    });
  }

  const q = String(req.query.q || '').trim().toLowerCase();
  const items = allItems
    .filter((announcement) => canView(announcement, u, now))
    .filter((announcement) => announcement.audience !== 'Officers only'
      || ['officer', 'adviser'].includes(u.role))
    .filter((announcement) => !q || [
      announcement.title,
      announcement.message,
      announcement.author,
      announcement.audience,
    ].some((value) => String(value || '').toLowerCase().includes(q)));
  res.render('announcements', { title: 'Announcements', items, q: req.query.q || '', active: 'Announcements' });
});

router.post('/', requireRole('officer', 'admin'), (req, res) => {
  const gaps = missing(req.body, [['title', 'Title'], ['message', 'Message']]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}.`);
    return res.redirect('/announcements');
  }
  db.insert('announcements', {
    orgId: req.user.orgId,
    title: req.body.title.trim(),
    message: req.body.message.trim(),
    audience: req.body.audience || 'All members',
    authorId: req.user.id,
    status: 'live',
    priority: 'normal',
    pinned: false,
  });
  req.flash('success', 'Announcement posted.');
  res.redirect('/announcements');
});

router.post('/manage', requireRole('admin'), (req, res) => {
  const gaps = missing(req.body, [['title', 'Title'], ['message', 'Content']]);
  const allowedAudiences = ['All Users', 'Students', 'Faculty'];
  const allowedPriorities = ['normal', 'important', 'urgent'];
  const publishAt = req.body.publishAt ? new Date(req.body.publishAt) : null;
  const state = req.body.state === 'live' ? 'live' : 'draft';
  const attachmentUrl = String(req.body.attachmentUrl || '').trim();

  if (gaps.length || !allowedAudiences.includes(req.body.audience)
    || !allowedPriorities.includes(req.body.priority)
    || (req.body.publishAt && Number.isNaN(publishAt.getTime()))
    || (attachmentUrl && !isSafeUrl(attachmentUrl))) {
    req.flash('error', gaps.length
      ? `Please fill in: ${gaps.join(', ')}.`
      : 'Check the audience, priority, publish date, and attachment URL.');
    return res.redirect('/announcements');
  }
  db.insert('announcements', {
    orgId: null,
    title: req.body.title.trim(),
    message: req.body.message.trim(),
    audience: req.body.audience,
    priority: req.body.priority,
    pinned: req.body.pinned === 'on',
    status: state,
    publishAt: publishAt ? publishAt.toISOString() : null,
    attachmentUrl,
    authorId: req.user.id,
  });
  req.flash('success', state === 'live' ? 'Announcement published.' : 'Announcement saved as a draft.');
  res.redirect('/announcements');
});

function isSafeUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch (error) {
    return false;
  }
}

router.post('/manage/:id', requireRole('admin'), (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) {
    req.flash('error', 'Announcement not found.');
    return res.redirect('/announcements');
  }
  const gaps = missing(req.body, [['title', 'Title'], ['message', 'Content']]);
  const allowedAudiences = ['All Users', 'Students', 'Faculty'];
  const allowedPriorities = ['normal', 'important', 'urgent'];
  const publishAt = req.body.publishAt ? new Date(req.body.publishAt) : null;
  const state = req.body.state === 'live' ? 'live' : 'draft';
  const attachmentUrl = String(req.body.attachmentUrl || '').trim();
  if (gaps.length || !allowedAudiences.includes(req.body.audience)
    || !allowedPriorities.includes(req.body.priority)
    || (req.body.publishAt && Number.isNaN(publishAt.getTime()))
    || (attachmentUrl && !isSafeUrl(attachmentUrl))) {
    req.flash('error', gaps.length
      ? `Please fill in: ${gaps.join(', ')}.`
      : 'Check the audience, priority, publish date, and attachment URL.');
    return res.redirect('/announcements');
  }
  db.update('announcements', announcement.id, {
    title: req.body.title.trim(),
    message: req.body.message.trim(),
    audience: req.body.audience,
    priority: req.body.priority,
    pinned: req.body.pinned === 'on',
    status: state,
    publishAt: publishAt ? publishAt.toISOString() : null,
    attachmentUrl,
  });
  req.flash('success', state === 'live' ? 'Announcement published.' : 'Announcement saved as a draft.');
  res.redirect('/announcements');
});

router.post('/:id/pin', requireRole('admin'), (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) {
    req.flash('error', 'Announcement not found.');
  } else {
    db.update('announcements', announcement.id, { pinned: announcement.pinned !== true });
    req.flash('success', announcement.pinned === true ? 'Announcement unpinned.' : 'Announcement pinned.');
  }
  res.redirect('/announcements');
});

router.post('/:id/archive', requireRole('admin'), (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) {
    req.flash('error', 'Announcement not found.');
  } else {
    db.update('announcements', announcement.id, { status: 'archived', archivedAt: new Date().toISOString() });
    req.flash('success', 'Announcement archived.');
  }
  res.redirect('/announcements');
});

router.get('/:id/edit', requireRole('admin'), (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) return res.status(404).render('error', { title: 'Not found', message: 'Announcement not found.' });
  res.render('announcement-edit', { title: 'Edit announcement', announcement, active: 'Announcements' });
});

router.post('/:id/edit', requireRole('admin'), (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) return res.status(404).render('error', { title: 'Not found', message: 'Announcement not found.' });

  const gaps = missing(req.body, [['title', 'Title'], ['message', 'Message']]);
  if (gaps.length) {
    req.flash('error', `Please fill in: ${gaps.join(', ')}.`);
    return res.redirect(`/announcements/${announcement.id}/edit`);
  }
  db.update('announcements', announcement.id, {
    title: req.body.title.trim(),
    message: req.body.message.trim(),
    audience: req.body.audience || 'All members',
  });
  req.flash('success', 'Announcement updated.');
  res.redirect('/announcements');
});

router.get('/:id', requireLogin, (req, res) => {
  const announcement = db.byId('announcements', req.params.id);
  if (!announcement) return res.status(404).render('error', { title: 'Not found', message: 'Announcement not found.' });
  if (!canView(announcement, req.user)) {
    return res.status(404).render('error', { title: 'Not found', message: 'Announcement not found.' });
  }
  res.render('announcement-detail', {
    title: announcement.title,
    announcement: {
      ...managementItem(announcement, new Date()),
      contentHtml: formatAnnouncementMessage(announcement.message),
    },
    active: 'Announcements',
  });
});

router.post('/:id/delete', requireRole('officer', 'admin'), (req, res) => {
  const a = db.byId('announcements', req.params.id);
  if (a && (req.user.role === 'admin' || a.orgId === req.user.orgId)) db.remove('announcements', a.id);
  res.redirect('/announcements');
});

module.exports = router;
