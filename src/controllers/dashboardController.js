import User from '../models/User.js';
import Department from '../models/Department.js';
import Attendance from '../models/Attendance.js';
import Leave from '../models/Leave.js';
import Holiday from '../models/Holiday.js';
import Announcement from '../models/Announcement.js';
import Payroll from '../models/Payroll.js';
import { hasPermission, teamMemberIds } from '../middleware/auth.js';
import { startOfDay, toDateKey } from '../utils/dates.js';

// One endpoint, sections included according to the caller's permissions.
export async function getDashboard(req, res) {
  const todayKey = toDateKey();
  const result = {};

  // --- Personal section (everyone) ---
  const [myToday, myPendingLeaves, upcomingHolidays, announcements] = await Promise.all([
    Attendance.findOne({ user: req.user._id, date: todayKey }),
    Leave.countDocuments({ user: req.user._id, status: 'pending' }),
    Holiday.find({ date: { $gte: startOfDay(new Date()) } }).sort({ date: 1 }).limit(5),
    Announcement.find({
      $or: [
        { departments: { $size: 0 } },
        ...(req.user.department ? [{ departments: req.user.department }] : []),
      ],
    })
      .populate('createdBy', 'firstName lastName')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(5),
  ]);
  result.me = { today: myToday, pendingLeaves: myPendingLeaves };
  result.upcomingHolidays = upcomingHolidays;
  result.announcements = announcements;

  // --- Organisation / team section ---
  const seesAll = hasPermission(req, 'attendance:read:all') || hasPermission(req, 'employee:create');
  const seesTeam = hasPermission(req, 'attendance:read:team') || hasPermission(req, 'leave:read:team');

  if (seesAll || seesTeam) {
    const scopeIds = seesAll ? null : await teamMemberIds(req);
    const userMatch = scopeIds ? { _id: { $in: scopeIds } } : {};
    const attMatch = scopeIds ? { user: { $in: scopeIds } } : {};

    const last7 = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7.push(toDateKey(d));
    }

    const [totalEmployees, activeEmployees, todayStats, trend, pendingLeaves] = await Promise.all([
      User.countDocuments(userMatch),
      User.countDocuments({ ...userMatch, status: 'active' }),
      Attendance.aggregate([
        { $match: { ...attMatch, date: todayKey } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { ...attMatch, date: { $in: last7 } } },
        { $group: { _id: { date: '$date', status: '$status' }, count: { $sum: 1 } } },
      ]),
      Leave.countDocuments({ ...(scopeIds ? { user: { $in: scopeIds } } : {}), status: 'pending' }),
    ]);

    const today = Object.fromEntries(todayStats.map((s) => [s._id, s.count]));
    const presentToday = (today.present || 0) + (today.late || 0) + (today['half-day'] || 0);

    result.org = {
      scope: seesAll ? 'organisation' : 'team',
      totalEmployees,
      activeEmployees,
      presentToday,
      lateToday: today.late || 0,
      onLeaveToday: today['on-leave'] || 0,
      notMarkedToday: Math.max(activeEmployees - presentToday - (today['on-leave'] || 0) - (today.absent || 0), 0),
      pendingLeaves,
      attendanceTrend: last7.map((date) => {
        const row = { date };
        for (const s of ['present', 'late', 'half-day', 'absent', 'on-leave']) {
          row[s] = trend.find((t) => t._id.date === date && t._id.status === s)?.count || 0;
        }
        return row;
      }),
    };

    if (seesAll) {
      const [departments, deptCounts] = await Promise.all([
        Department.find().select('name'),
        User.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$department', count: { $sum: 1 } } }]),
      ]);
      result.org.departmentCount = departments.length;
      result.org.byDepartment = departments.map((d) => ({
        name: d.name,
        count: deptCounts.find((c) => String(c._id) === String(d._id))?.count || 0,
      }));
    }
  }

  if (hasPermission(req, 'payroll:read:all')) {
    const now = new Date();
    const [agg] = await Payroll.aggregate([
      { $match: { month: now.getMonth() + 1, year: now.getFullYear() } },
      { $group: { _id: null, total: { $sum: '$netSalary' }, count: { $sum: 1 }, paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } } } },
    ]);
    result.payroll = { month: now.getMonth() + 1, year: now.getFullYear(), totalNet: agg?.total || 0, slips: agg?.count || 0, paid: agg?.paid || 0 };
  }

  res.json(result);
}
