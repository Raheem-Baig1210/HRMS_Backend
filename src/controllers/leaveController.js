import Leave from '../models/Leave.js';
import LeaveType from '../models/LeaveType.js';
import Holiday from '../models/Holiday.js';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hasPermission, teamMemberIds } from '../middleware/auth.js';
import { businessDays, startOfDay, toDateKey } from '../utils/dates.js';

const POPULATE = [
  {
    path: 'user',
    select: 'firstName lastName employeeId department manager',
    populate: { path: 'department', select: 'name' },
  },
  { path: 'leaveType', select: 'name code isPaid' },
  { path: 'reviewedBy', select: 'firstName lastName' },
];

async function holidayKeys(start, end) {
  const holidays = await Holiday.find({ date: { $gte: startOfDay(start), $lte: end }, type: 'public' });
  return new Set(holidays.map((h) => toDateKey(h.date)));
}

async function computeBalance(userId, year = new Date().getFullYear()) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const [types, usage] = await Promise.all([
    LeaveType.find({ active: true }).sort({ name: 1 }),
    Leave.aggregate([
      {
        $match: {
          user: userId,
          status: { $in: ['approved', 'pending'] },
          startDate: { $gte: yearStart, $lte: yearEnd },
        },
      },
      { $group: { _id: { type: '$leaveType', status: '$status' }, days: { $sum: '$days' } } },
    ]),
  ]);

  return types.map((t) => {
    const used = usage.find((u) => String(u._id.type) === String(t._id) && u._id.status === 'approved')?.days || 0;
    const pending = usage.find((u) => String(u._id.type) === String(t._id) && u._id.status === 'pending')?.days || 0;
    return {
      leaveType: { _id: t._id, name: t.name, code: t.code, isPaid: t.isPaid },
      allocated: t.daysPerYear,
      used,
      pending,
      remaining: Math.max(t.daysPerYear - used, 0),
      available: Math.max(t.daysPerYear - used - pending, 0),
    };
  });
}

/* ---------- Leave types ---------- */

export async function listLeaveTypes(req, res) {
  const filter = hasPermission(req, 'leavetype:manage') ? {} : { active: true };
  res.json(await LeaveType.find(filter).sort({ name: 1 }));
}

export async function createLeaveType(req, res) {
  const { name, code, daysPerYear, isPaid, description, active } = req.body;
  res.status(201).json(await LeaveType.create({ name, code, daysPerYear, isPaid, description, active }));
}

export async function updateLeaveType(req, res) {
  const type = await LeaveType.findById(req.params.id);
  if (!type) throw new ApiError(404, 'Leave type not found');
  const { name, code, daysPerYear, isPaid, description, active } = req.body;
  type.set({ name, code, daysPerYear, isPaid, description, active });
  await type.save();
  res.json(type);
}

export async function deleteLeaveType(req, res) {
  if (await Leave.exists({ leaveType: req.params.id })) {
    throw new ApiError(400, 'Leave type is in use; deactivate it instead');
  }
  const type = await LeaveType.findByIdAndDelete(req.params.id);
  if (!type) throw new ApiError(404, 'Leave type not found');
  res.json({ message: 'Leave type deleted' });
}

/* ---------- Leave requests ---------- */

export async function myBalance(req, res) {
  res.json(await computeBalance(req.user._id, parseInt(req.query.year, 10) || undefined));
}

export async function myLeaves(req, res) {
  const leaves = await Leave.find({ user: req.user._id }).populate(POPULATE).sort({ createdAt: -1 });
  res.json(leaves);
}

export async function applyLeave(req, res) {
  const { leaveType, startDate, endDate, reason } = req.body;
  if (!leaveType || !startDate || !endDate || !reason) {
    throw new ApiError(400, 'Leave type, dates and reason are required');
  }
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ApiError(400, 'Invalid dates');
  if (end < start) throw new ApiError(400, 'End date must be on or after start date');
  if (start.getFullYear() !== end.getFullYear()) {
    throw new ApiError(400, 'A leave request cannot span two calendar years; split it into two requests');
  }

  const type = await LeaveType.findOne({ _id: leaveType, active: true });
  if (!type) throw new ApiError(400, 'Invalid leave type');

  const days = businessDays(start, end, await holidayKeys(start, end)).length;
  if (days === 0) throw new ApiError(400, 'Selected range contains no working days');

  const overlap = await Leave.exists({
    user: req.user._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) throw new ApiError(400, 'You already have a leave request overlapping these dates');

  const balance = (await computeBalance(req.user._id, start.getFullYear())).find(
    (b) => String(b.leaveType._id) === String(type._id)
  );
  if (!balance || days > balance.available) {
    throw new ApiError(400, `Insufficient ${type.name} balance (${balance?.available ?? 0} day(s) available)`);
  }

  const leave = await Leave.create({ user: req.user._id, leaveType, startDate: start, endDate: end, days, reason });
  await leave.populate(POPULATE);
  res.status(201).json(leave);
}

export async function listLeaves(req, res) {
  const { status, user } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (!hasPermission(req, 'leave:read:all')) {
    const team = await teamMemberIds(req);
    filter.user = { $in: team };
    if (user && team.map(String).includes(String(user))) filter.user = user;
  } else if (user) {
    filter.user = user;
  }
  const leaves = await Leave.find(filter).populate(POPULATE).sort({ createdAt: -1 }).limit(500);
  res.json(leaves);
}

export async function reviewLeave(req, res) {
  const { status, comment } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw new ApiError(400, 'Status must be approved or rejected');

  const leave = await Leave.findById(req.params.id);
  if (!leave) throw new ApiError(404, 'Leave request not found');
  if (String(leave.user) === String(req.user._id)) throw new ApiError(403, 'You cannot review your own leave');
  if (!hasPermission(req, 'leave:read:all')) {
    const owner = await User.findById(leave.user).select('manager');
    if (String(owner?.manager) !== String(req.user._id)) {
      throw new ApiError(403, 'You can only review leave for your direct reports');
    }
  }
  if (leave.status !== 'pending') throw new ApiError(400, `Leave is already ${leave.status}`);

  leave.status = status;
  leave.reviewComment = comment || '';
  leave.reviewedBy = req.user._id;
  leave.reviewedAt = new Date();
  await leave.save();

  // Approved leave days show up as "on-leave" in attendance.
  if (status === 'approved') {
    const days = businessDays(leave.startDate, leave.endDate, await holidayKeys(leave.startDate, leave.endDate));
    await Attendance.bulkWrite(
      days.map((d) => ({
        updateOne: {
          filter: { user: leave.user, date: toDateKey(d) },
          update: { $set: { status: 'on-leave', note: 'Approved leave' } },
          upsert: true,
        },
      }))
    );
  }

  await leave.populate(POPULATE);
  res.json(leave);
}

export async function cancelLeave(req, res) {
  const leave = await Leave.findOne({ _id: req.params.id, user: req.user._id });
  if (!leave) throw new ApiError(404, 'Leave request not found');
  const futureApproved = leave.status === 'approved' && leave.startDate > new Date();
  if (leave.status !== 'pending' && !futureApproved) {
    throw new ApiError(400, 'Only pending or upcoming approved leave can be cancelled');
  }

  if (leave.status === 'approved') {
    const keys = businessDays(leave.startDate, leave.endDate).map((d) => toDateKey(d));
    await Attendance.deleteMany({ user: leave.user, date: { $in: keys }, status: 'on-leave' });
  }
  leave.status = 'cancelled';
  await leave.save();
  await leave.populate(POPULATE);
  res.json(leave);
}
