import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hasPermission, teamMemberIds } from '../middleware/auth.js';
import { toDateKey } from '../utils/dates.js';

const round2 = (n) => Math.round(n * 100) / 100;

function isLate(date) {
  const [h, m] = (process.env.OFFICE_START_TIME || '09:30').split(':').map(Number);
  const cutoff = new Date(date);
  cutoff.setHours(h, m, 0, 0);
  return date > cutoff;
}

function monthPrefix(query) {
  const now = new Date();
  const month = parseInt(query.month, 10) || now.getMonth() + 1;
  const year = parseInt(query.year, 10) || now.getFullYear();
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function today(req, res) {
  const record = await Attendance.findOne({ user: req.user._id, date: toDateKey() });
  res.json(record);
}

export async function checkIn(req, res) {
  const now = new Date();
  const date = toDateKey(now);
  const existing = await Attendance.findOne({ user: req.user._id, date });
  if (existing?.checkIn) throw new ApiError(400, 'Already checked in today');
  if (existing?.status === 'on-leave') throw new ApiError(400, 'You are on approved leave today');

  const record = existing || new Attendance({ user: req.user._id, date });
  record.checkIn = now;
  record.status = isLate(now) ? 'late' : 'present';
  await record.save();
  res.status(201).json(record);
}

export async function checkOut(req, res) {
  const now = new Date();
  const record = await Attendance.findOne({ user: req.user._id, date: toDateKey(now) });
  if (!record?.checkIn) throw new ApiError(400, 'You have not checked in today');
  if (record.checkOut) throw new ApiError(400, 'Already checked out today');

  record.checkOut = now;
  record.workHours = round2((now - record.checkIn) / 36e5);
  const halfDay = Number(process.env.HALF_DAY_HOURS || 4);
  if (record.workHours < halfDay) record.status = 'half-day';
  await record.save();
  res.json(record);
}

export async function myAttendance(req, res) {
  const prefix = monthPrefix(req.query);
  const records = await Attendance.find({ user: req.user._id, date: { $regex: `^${prefix}` } }).sort({ date: 1 });
  res.json(records);
}

// All / team attendance for a single date or month, scoped by permission.
export async function listAttendance(req, res) {
  const { date, user, department, status } = req.query;
  const filter = {};
  if (date) filter.date = date;
  else filter.date = { $regex: `^${monthPrefix(req.query)}` };
  if (status) filter.status = status;

  let allowedUsers = null; // null = no restriction
  if (!hasPermission(req, 'attendance:read:all')) {
    allowedUsers = await teamMemberIds(req);
  }
  if (department) {
    const deptUsers = await User.find({ department }).select('_id').lean();
    const ids = deptUsers.map((u) => String(u._id));
    allowedUsers = allowedUsers ? allowedUsers.filter((id) => ids.includes(String(id))) : ids;
  }
  if (user) {
    if (allowedUsers && !allowedUsers.map(String).includes(String(user))) {
      return res.json([]);
    }
    filter.user = user;
  } else if (allowedUsers) {
    filter.user = { $in: allowedUsers };
  }

  const records = await Attendance.find(filter)
    .populate({
      path: 'user',
      select: 'firstName lastName employeeId department',
      populate: { path: 'department', select: 'name' },
    })
    .sort({ date: -1, checkIn: 1 })
    .limit(1000);
  res.json(records);
}

// Admin create/correct a record (upsert by user + date).
export async function upsertAttendance(req, res) {
  const { user, date, status, checkIn, checkOut, note } = req.body;
  if (!user || !date) throw new ApiError(400, 'User and date are required');
  if (!(await User.exists({ _id: user }))) throw new ApiError(404, 'Employee not found');

  const record = (await Attendance.findOne({ user, date })) || new Attendance({ user, date });
  record.status = status || record.status;
  record.checkIn = checkIn ? new Date(checkIn) : undefined;
  record.checkOut = checkOut ? new Date(checkOut) : undefined;
  record.workHours =
    record.checkIn && record.checkOut ? round2(Math.max(record.checkOut - record.checkIn, 0) / 36e5) : 0;
  if (note !== undefined) record.note = note;
  await record.save();
  await record.populate('user', 'firstName lastName employeeId');
  res.json(record);
}

export async function deleteAttendance(req, res) {
  const record = await Attendance.findByIdAndDelete(req.params.id);
  if (!record) throw new ApiError(404, 'Record not found');
  res.json({ message: 'Attendance record deleted' });
}
