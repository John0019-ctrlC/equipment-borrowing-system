// Sidebar items per role. Admin/officer/adviser use the navy theme, members the light theme.
const MEMBER = [
  { label: 'Dashboard', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Events', href: '/events' },
  { label: 'Equipments', href: '/equipment' },
  { label: 'My Borrowings', href: '/borrowing/mine' },
];

const OFFICER = [
  { label: 'Dashboard', href: '/' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Events', href: '/events' },
  { label: 'Members', href: '/members' },
  { label: 'Reports', href: '/reports' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Equipments', href: '/equipment' },
  { label: 'My Borrowings', href: '/borrowing/mine' },
];

const ADVISER = [
  { label: 'Dashboard', href: '/' },
  { label: 'Approvals', href: '/approvals' },
  { label: 'Reports', href: '/reports' },
  { label: 'Events', href: '/events' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Compliance', href: '/compliance' },
];

const ADMIN = [
  { label: 'Dashboard', href: '/' },
  { label: 'Compliance', href: '/compliance' },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Events', href: '/events' },
  { label: 'Reports', href: '/reports' },
  { label: 'Members', href: '/members' },
  { label: 'Borrowing Request', href: '/borrowing/requests' },
  { label: 'Equipments Inventory', href: '/equipment' },
  { label: 'Borrowing Records', href: '/borrowing/records' },
];

function navFor(role) {
  return { admin: ADMIN, adviser: ADVISER, officer: OFFICER, member: MEMBER }[role] || MEMBER;
}

module.exports = { navFor };
