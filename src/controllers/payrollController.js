import Payroll from '../models/Payroll.js';
import User from '../models/User.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import ApiError from '../utils/ApiError.js';
import { hasPermission } from '../middleware/auth.js';
import { businessDays, monthRange, toDateKey } from '../utils/dates.js';

const POPULATE = {
  path: 'user',
  select: 'firstName lastName employeeId email department designation bankDetails joiningDate',
  populate: [
    { path: 'department', select: 'name' },
    { path: 'designation', select: 'title' },
  ],
};

function parsePeriod(body) {
  const month = parseInt(body.month, 10);
  const year = parseInt(body.year, 10);
  if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
    throw new ApiError(400, 'Valid month (1-12) and year are required');
  }
  return { month, year };
}

// Generates (or regenerates) draft payslips for a month. Paid/processed slips are left untouched.
export async function generatePayroll(req, res) {
  const { month, year } = parsePeriod(req.body);
  const taxRate = req.body.taxRate !== undefined ? Number(req.body.taxRate) : 10;
  if (!(taxRate >= 0 && taxRate <= 100)) throw new ApiError(400, 'Tax rate must be between 0 and 100');

  const { start, end } = monthRange(month, year);
  const holidays = await Holiday.find({ date: { $gte: start, $lte: end }, type: 'public' });
  const holidaySet = new Set(holidays.map((h) => toDateKey(h.date)));
  const workingDays = businessDays(start, end, holidaySet).length;

  const userFilter = { status: 'active' };
  if (Array.isArray(req.body.userIds) && req.body.userIds.length) userFilter._id = { $in: req.body.userIds };
  const users = await User.find(userFilter);

  // Unpaid leave days that fall inside this month, per user.
  const unpaidLeaves = await Leave.find({
    user: { $in: users.map((u) => u._id) },
    status: 'approved',
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).populate('leaveType', 'isPaid');

  const unpaidDaysByUser = new Map();
  for (const leave of unpaidLeaves) {
    if (leave.leaveType?.isPaid) continue;
    const from = leave.startDate > start ? leave.startDate : start;
    const to = leave.endDate < end ? leave.endDate : end;
    const n = businessDays(from, to, holidaySet).length;
    unpaidDaysByUser.set(String(leave.user), (unpaidDaysByUser.get(String(leave.user)) || 0) + n);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    let slip = await Payroll.findOne({ user: user._id, month, year });
    if (slip && slip.status !== 'draft') {
      skipped += 1;
      continue;
    }
    if (slip) updated += 1;
    else {
      slip = new Payroll({ user: user._id, month, year });
      created += 1;
    }
    slip.set({
      basic: user.salary?.basic || 0,
      allowances: user.salary?.allowances || 0,
      deductions: user.salary?.deductions || 0,
      taxRate,
      workingDays,
      unpaidLeaveDays: unpaidDaysByUser.get(String(user._id)) || 0,
    });
    slip.calculate();
    await slip.save();
  }

  res.json({ message: `Payroll generated: ${created} created, ${updated} updated, ${skipped} skipped (already processed/paid)`, created, updated, skipped });
}

export async function listPayroll(req, res) {
  const filter = {};
  if (req.query.month) filter.month = parseInt(req.query.month, 10);
  if (req.query.year) filter.year = parseInt(req.query.year, 10);
  if (req.query.status) filter.status = req.query.status;
  if (req.query.user) filter.user = req.query.user;
  const items = await Payroll.find(filter).populate(POPULATE).sort({ year: -1, month: -1, createdAt: -1 });
  res.json(items);
}

export async function myPayroll(req, res) {
  // Employees only see slips that have been finalised.
  const items = await Payroll.find({ user: req.user._id, status: { $in: ['processed', 'paid'] } })
    .populate(POPULATE)
    .sort({ year: -1, month: -1 });
  res.json(items);
}

export async function getPayslip(req, res) {
  const slip = await Payroll.findById(req.params.id).populate(POPULATE);
  if (!slip) throw new ApiError(404, 'Payslip not found');
  const own = String(slip.user?._id) === String(req.user._id);
  if (!hasPermission(req, 'payroll:read:all') && !(own && slip.status !== 'draft')) {
    throw new ApiError(403, 'You cannot view this payslip');
  }
  res.json(slip);
}

export async function updatePayslip(req, res) {
  const slip = await Payroll.findById(req.params.id);
  if (!slip) throw new ApiError(404, 'Payslip not found');
  if (slip.status === 'paid') throw new ApiError(400, 'Paid payslips cannot be edited');

  for (const key of ['basic', 'allowances', 'bonus', 'deductions', 'taxRate', 'unpaidLeaveDays', 'note']) {
    if (req.body[key] !== undefined) slip[key] = req.body[key];
  }
  if (req.body.status && ['draft', 'processed'].includes(req.body.status)) slip.status = req.body.status;
  slip.calculate();
  await slip.save();
  await slip.populate(POPULATE);
  res.json(slip);
}

export async function setStatus(req, res) {
  const { status } = req.body;
  if (!['processed', 'paid'].includes(status)) throw new ApiError(400, 'Status must be processed or paid');
  const slip = await Payroll.findById(req.params.id);
  if (!slip) throw new ApiError(404, 'Payslip not found');
  if (slip.status === 'paid') throw new ApiError(400, 'Payslip is already paid');
  slip.status = status;
  if (status === 'paid') slip.paidAt = new Date();
  await slip.save();
  await slip.populate(POPULATE);
  res.json(slip);
}

export async function bulkStatus(req, res) {
  const { month, year } = parsePeriod(req.body);
  const { status } = req.body;
  if (!['processed', 'paid'].includes(status)) throw new ApiError(400, 'Status must be processed or paid');
  const from = status === 'paid' ? ['draft', 'processed'] : ['draft'];
  const update = status === 'paid' ? { status, paidAt: new Date() } : { status };
  const result = await Payroll.updateMany({ month, year, status: { $in: from } }, update);
  res.json({ message: `${result.modifiedCount} payslip(s) marked ${status}` });
}

export async function deletePayslip(req, res) {
  const slip = await Payroll.findById(req.params.id);
  if (!slip) throw new ApiError(404, 'Payslip not found');
  if (slip.status === 'paid') throw new ApiError(400, 'Paid payslips cannot be deleted');
  await slip.deleteOne();
  res.json({ message: 'Payslip deleted' });
}
