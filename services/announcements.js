function audienceGroup(audience) {
  if (audience === 'Students' || audience === 'Students only') return 'students';
  if (audience === 'Faculty' || audience === 'Faculty / Staff Only' || audience === 'Officers only') return 'faculty';
  return 'all';
}

function isPublished(announcement, now = new Date()) {
  if (announcement.status === 'archived' || announcement.status === 'draft') return false;
  if (announcement.publishAt && new Date(announcement.publishAt) > now) return false;
  return true;
}

function canView(announcement, user, now = new Date()) {
  if (user.role === 'admin') return true;
  if (!isPublished(announcement, now)) return false;
  if (announcement.orgId != null && announcement.orgId !== user.orgId) return false;

  const audience = audienceGroup(announcement.audience);
  if (audience === 'students') return user.role === 'member';
  if (audience === 'faculty') return ['officer', 'adviser'].includes(user.role);
  return true;
}

function displayStatus(announcement, now = new Date()) {
  if (announcement.status === 'archived') return 'Archived';
  if (announcement.status === 'draft') return 'Draft';
  if (announcement.publishAt && new Date(announcement.publishAt) > now) return 'Scheduled';
  return 'Live';
}

module.exports = { audienceGroup, isPublished, canView, displayStatus };
