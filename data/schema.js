// Maps each app collection to a MySQL table.
//   field name used by the routes  ->  [column name, type]
// Types: id | str | num | bool | date | ts | enumCap | category
// Order matters: parents are loaded before children (categories before equipment).
module.exports = {
  categories: { table: 'categories', pk: 'category_id', fields: { name: ['category_name', 'str'] } },

  orgs: {
    table: 'orgs', pk: 'org_id',
    fields: { name: ['name', 'str'], fullName: ['full_name', 'str'], createdAt: ['created_at', 'ts'] },
  },

  users: {
    table: 'users', pk: 'user_id',
    fields: {
      name: ['full_name', 'str'], schoolId: ['student_id', 'str'], email: ['email', 'str'],
      passwordHash: ['password', 'str'], role: ['role', 'str'], course: ['course', 'str'],
      orgId: ['org_id', 'id'], active: ['active', 'bool'],
      createdAt: ['created_at', 'ts'], updatedAt: ['updated_at', 'ts'],
    },
  },

  equipment: {
    table: 'equipment', pk: 'equipment_id',
    fields: {
      name: ['equipment_name', 'str'], spec: ['description', 'str'], category: ['category_id', 'category'],
      total: ['total', 'num'], available: ['available', 'num'], maxDays: ['max_days', 'num'],
      createdAt: ['created_at', 'ts'], updatedAt: ['updated_at', 'ts'],
    },
    // `status` is derived from stock so it stays correct for anyone reading the table directly.
    extra: (r) => ({ status: r.available > 0 ? 'Available' : 'Unavailable' }),
    cascade: [['borrowings', 'equipmentId']],
  },

  borrowings: {
    table: 'borrow_requests', pk: 'request_id',
    fields: {
      code: ['code', 'str'], userId: ['user_id', 'id'], equipmentId: ['equipment_id', 'id'],
      quantity: ['quantity', 'num'], dateNeeded: ['date_needed', 'date'], returnDate: ['due_date', 'date'],
      purpose: ['purpose', 'str'], notes: ['notes', 'str'], status: ['status', 'enumCap'],
      extensionRequested: ['extension_requested', 'bool'], adminComment: ['admin_comment', 'str'],
      decidedBy: ['decided_by', 'id'], actualReturn: ['return_date', 'date'],
      createdAt: ['request_date', 'ts'], updatedAt: ['updated_at', 'ts'],
    },
  },

  announcements: {
    table: 'announcements', pk: 'announcement_id',
    fields: {
      orgId: ['org_id', 'id'], title: ['title', 'str'], message: ['message', 'str'],
      audience: ['audience', 'str'], authorId: ['author_id', 'id'], createdAt: ['created_at', 'ts'],
    },
  },

  events: {
    table: 'events', pk: 'event_id',
    fields: {
      orgId: ['org_id', 'id'], title: ['title', 'str'], date: ['event_date', 'date'], time: ['event_time', 'str'],
      venue: ['venue', 'str'], description: ['description', 'str'], limit: ['participant_limit', 'num'],
      status: ['status', 'str'], createdBy: ['created_by', 'id'],
      createdAt: ['created_at', 'ts'], updatedAt: ['updated_at', 'ts'],
    },
  },

  registrations: {
    table: 'registrations', pk: 'registration_id',
    fields: { eventId: ['event_id', 'id'], userId: ['user_id', 'id'], createdAt: ['created_at', 'ts'] },
  },

  attendance: {
    table: 'attendance', pk: 'attendance_id',
    fields: {
      eventId: ['event_id', 'id'], userId: ['user_id', 'id'], method: ['method', 'str'],
      checkedBy: ['checked_by', 'id'], createdAt: ['created_at', 'ts'],
    },
  },

  reports: {
    table: 'reports', pk: 'report_id',
    fields: {
      orgId: ['org_id', 'id'], eventId: ['event_id', 'id'], summary: ['summary', 'str'], outcome: ['outcome', 'str'],
      budgetSpent: ['budget_spent', 'num'], attendeeCount: ['attendee_count', 'num'],
      authorId: ['author_id', 'id'], createdAt: ['created_at', 'ts'],
    },
  },

  approvals: {
    table: 'approvals', pk: 'approval_id',
    fields: {
      orgId: ['org_id', 'id'], type: ['type', 'str'], title: ['title', 'str'], details: ['details', 'str'],
      amount: ['amount', 'num'], status: ['status', 'str'], submittedBy: ['submitted_by', 'id'],
      reviewedBy: ['reviewed_by', 'id'], reviewNote: ['review_note', 'str'],
      createdAt: ['created_at', 'ts'], updatedAt: ['updated_at', 'ts'],
    },
  },
};
