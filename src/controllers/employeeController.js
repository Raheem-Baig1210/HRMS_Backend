import User from '../models/User.js';
import Role from '../models/Role.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Payroll from '../models/Payroll.js';
import ApiError from '../utils/ApiError.js';
import { hasPermission, isSuperAdmin } from '../middleware/auth.js';
import { escapeRegex, paginate } from '../utils/query.js';

const EDITABLE_FIELDS = [
  'firstName', 'lastName', 'email', 'role', 'department', 'designation', 'manager',
  'phone', 'dateOfBirth', 'gender', 'address', 'joiningDate', 'employmentType', 'status',
  'salary', 'bankDetails', 'emergencyContact',
];

const POPULATE = [
  { path: 'role', select: 'name isSuperAdmin' },
  { path: 'department', select: 'name code' },
  { path: 'designation', select: 'title' },
  { path: 'manager', select: 'firstName lastName employeeId' },
];

// Salary and bank details are only visible to people who can edit employees,
// or to the employee themselves.
function sanitize(req, user) {
  const obj = user.toJSON();
  const self = String(obj._id) === String(req.user._id);
  if (!self && !hasPermission(req, 'employee:update')) {
    delete obj.salary;
    delete obj.bankDetails;
  }
  return obj;
}

function pick(body) {
  const data = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key] === '' ? undefined : body[key];
  }
  return data;
}

// Prevent privilege escalation: only a super admin may grant the super admin
// role or modify an existing super admin account.
async function assertRoleAssignable(req, roleId) {
  if (!roleId) return;
  const role = await Role.findById(roleId);
  if (!role) throw new ApiError(400, 'Role not found');
  if (role.isSuperAdmin && !isSuperAdmin(req)) {
    throw new ApiError(403, 'Only a Super Admin can assign the Super Admin role');
  }
}

async function loadTarget(req, id) {
  const user = await User.findById(id).populate('role', 'isSuperAdmin');
  if (!user) throw new ApiError(404, 'Employee not found');
  if (user.role?.isSuperAdmin && !isSuperAdmin(req)) {
    throw new ApiError(403, 'Only a Super Admin can modify a Super Admin account');
  }
  return user;
}

export async function listEmployees(req, res) {
  const { search, department, status, role, manager } = req.query;
  const { page, limit, skip } = paginate(req.query);

  const filter = {};
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { employeeId: rx }];
  }
  if (department) filter.department = department;
  if (status) filter.status = status;
  if (role) filter.role = role;
  if (manager) filter.manager = manager;

  const [items, total] = await Promise.all([
    User.find(filter).populate(POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    items: items.map((u) => sanitize(req, u)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}

// Lightweight list for dropdowns (manager pickers, payroll selection, etc.)
export async function employeeOptions(_req, res) {
  const users = await User.find({ status: 'active' })
    .select('firstName lastName employeeId department')
    .sort({ firstName: 1 });
  res.json(users.map((u) => ({ _id: u._id, name: u.fullName, employeeId: u.employeeId, department: u.department })));
}

export async function getEmployee(req, res) {
  const user = await User.findById(req.params.id).populate(POPULATE);
  if (!user) throw new ApiError(404, 'Employee not found');
  res.json(sanitize(req, user));
}

export async function createEmployee(req, res) {
  const data = pick(req.body);
  if (!req.body.password) throw new ApiError(400, 'Initial password is required');
  if (!data.role) {
    const fallback = await Role.findOne({ name: 'Employee' });
    data.role = fallback?._id;
  }
  await assertRoleAssignable(req, data.role);

  const user = await User.create({ ...data, password: req.body.password });
  await user.populate(POPULATE);
  res.status(201).json(sanitize(req, user));
}

export async function updateEmployee(req, res) {
  const user = await loadTarget(req, req.params.id);
  const data = pick(req.body);

  if (data.role && String(data.role) !== String(user.role._id)) {
    await assertRoleAssignable(req, data.role);
    if (String(user._id) === String(req.user._id)) {
      throw new ApiError(400, 'You cannot change your own role');
    }
  }
  if (data.manager && String(data.manager) === String(user._id)) {
    throw new ApiError(400, 'An employee cannot be their own manager');
  }
  if (String(user._id) === String(req.user._id) && data.status && data.status !== 'active') {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  user.set(data);
  if (req.body.password) user.password = req.body.password;
  await user.save();
  await user.populate(POPULATE);
  res.json(sanitize(req, user));
}

export async function deleteEmployee(req, res) {
  if (String(req.params.id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }
  const user = await loadTarget(req, req.params.id);

  await Promise.all([
    Attendance.deleteMany({ user: user._id }),
    Leave.deleteMany({ user: user._id }),
    Payroll.deleteMany({ user: user._id }),
    User.updateMany({ manager: user._id }, { $unset: { manager: 1 } }),
  ]);
  await user.deleteOne();
  res.json({ message: 'Employee deleted' });
}
