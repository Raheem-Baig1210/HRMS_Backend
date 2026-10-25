// Central permission registry. Every protected route checks one of these keys.
// Roles (stored in MongoDB) are just named sets of these keys.

export const PERMISSION_GROUPS = [
  {
    module: 'Dashboard',
    permissions: [{ key: 'dashboard:view', label: 'View dashboard' }],
  },
  {
    module: 'Employees',
    permissions: [
      { key: 'employee:read', label: 'View employee directory' },
      { key: 'employee:create', label: 'Create employees' },
      { key: 'employee:update', label: 'Edit employees (incl. salary & bank details)' },
      { key: 'employee:delete', label: 'Delete employees' },
    ],
  },
  {
    module: 'Departments & Designations',
    permissions: [
      { key: 'department:read', label: 'View departments & designations' },
      { key: 'department:manage', label: 'Manage departments & designations' },
    ],
  },
  {
    module: 'Attendance',
    permissions: [
      { key: 'attendance:mark', label: 'Check in / check out' },
      { key: 'attendance:read:own', label: 'View own attendance' },
      { key: 'attendance:read:team', label: 'View team attendance' },
      { key: 'attendance:read:all', label: 'View all attendance' },
      { key: 'attendance:manage', label: 'Create / correct attendance records' },
    ],
  },
  {
    module: 'Leave',
    permissions: [
      { key: 'leave:apply', label: 'Apply for leave' },
      { key: 'leave:read:team', label: 'View team leave requests' },
      { key: 'leave:read:all', label: 'View all leave requests' },
      { key: 'leave:approve', label: 'Approve / reject leave (within visible scope)' },
      { key: 'leavetype:manage', label: 'Manage leave types' },
    ],
  },
  {
    module: 'Payroll',
    permissions: [
      { key: 'payroll:read:own', label: 'View own payslips' },
      { key: 'payroll:read:all', label: 'View all payroll' },
      { key: 'payroll:manage', label: 'Generate, edit & pay payroll' },
    ],
  },
  {
    module: 'Holidays',
    permissions: [
      { key: 'holiday:read', label: 'View holidays' },
      { key: 'holiday:manage', label: 'Manage holidays' },
    ],
  },
  {
    module: 'Announcements',
    permissions: [
      { key: 'announcement:read', label: 'View announcements' },
      { key: 'announcement:manage', label: 'Manage announcements' },
    ],
  },
  {
    module: 'Roles & Access',
    permissions: [
      { key: 'role:read', label: 'View roles & permissions' },
      { key: 'role:manage', label: 'Create / edit / delete roles' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

const EMPLOYEE_BASE = [
  'dashboard:view',
  'department:read',
  'attendance:mark',
  'attendance:read:own',
  'leave:apply',
  'payroll:read:own',
  'holiday:read',
  'announcement:read',
];

export const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    description: 'Full, unrestricted access to everything. Always has every permission.',
    isSystem: true,
    isSuperAdmin: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'HR Manager',
    description: 'Manages employees, attendance, leave, payroll and company content.',
    isSystem: true,
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'role:manage'),
  },
  {
    name: 'Manager',
    description: 'Team lead: sees the directory, team attendance and approves team leave.',
    isSystem: true,
    permissions: [...EMPLOYEE_BASE, 'employee:read', 'attendance:read:team', 'leave:read:team', 'leave:approve'],
  },
  {
    name: 'Employee',
    description: 'Self-service: attendance, leave, payslips, holidays and announcements.',
    isSystem: true,
    permissions: EMPLOYEE_BASE,
  },
];
