// Resets the database and loads demo data.  Usage: npm run seed
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { DEFAULT_ROLES } from './config/permissions.js';
import Role from './models/Role.js';
import User from './models/User.js';
import Department from './models/Department.js';
import Designation from './models/Designation.js';
import LeaveType from './models/LeaveType.js';
import Leave from './models/Leave.js';
import Holiday from './models/Holiday.js';
import Attendance from './models/Attendance.js';
import Announcement from './models/Announcement.js';
import Payroll from './models/Payroll.js';
import Counter from './models/Counter.js';
import { isWeekend, toDateKey } from './utils/dates.js';

const PASSWORD = 'Password@123';

async function seed() {
  await connectDB();
  await mongoose.connection.dropDatabase();
  await Promise.all([Role, User, Department, Designation, LeaveType, Leave, Holiday, Attendance, Announcement, Payroll, Counter].map((m) => m.syncIndexes()));

  const roles = Object.fromEntries((await Role.insertMany(DEFAULT_ROLES)).map((r) => [r.name, r]));

  const depts = Object.fromEntries(
    (
      await Department.insertMany([
        { name: 'Human Resources', code: 'HR', description: 'People operations' },
        { name: 'Engineering', code: 'ENG', description: 'Product engineering' },
        { name: 'Finance', code: 'FIN', description: 'Accounts and payroll' },
        { name: 'Sales', code: 'SAL', description: 'Sales and business development' },
      ])
    ).map((d) => [d.code, d])
  );

  const desig = Object.fromEntries(
    (
      await Designation.insertMany([
        { title: 'HR Manager', department: depts.HR._id },
        { title: 'HR Executive', department: depts.HR._id },
        { title: 'Engineering Manager', department: depts.ENG._id },
        { title: 'Senior Software Engineer', department: depts.ENG._id },
        { title: 'Software Engineer', department: depts.ENG._id },
        { title: 'Accountant', department: depts.FIN._id },
        { title: 'Sales Executive', department: depts.SAL._id },
        { title: 'Chief Executive Officer', department: depts.HR._id },
      ])
    ).map((d) => [d.title, d])
  );

  // Users are created one by one so the pre-save hooks run (ID + password hash).
  const mk = (data) => User.create({ password: PASSWORD, joiningDate: new Date(2023, 0, 10), ...data });

  const admin = await mk({
    firstName: 'Alice', lastName: 'Admin', email: 'admin@hrms.com', role: roles['Super Admin']._id,
    department: depts.HR._id, designation: desig['Chief Executive Officer']._id, gender: 'female',
    salary: { basic: 150000, allowances: 30000, deductions: 2000 },
  });
  const hr = await mk({
    firstName: 'Henry', lastName: 'Ross', email: 'hr@hrms.com', role: roles['HR Manager']._id,
    department: depts.HR._id, designation: desig['HR Manager']._id, manager: admin._id, gender: 'male',
    salary: { basic: 90000, allowances: 15000, deductions: 1500 },
  });
  const manager = await mk({
    firstName: 'Maya', lastName: 'Patel', email: 'manager@hrms.com', role: roles.Manager._id,
    department: depts.ENG._id, designation: desig['Engineering Manager']._id, manager: admin._id, gender: 'female',
    salary: { basic: 110000, allowances: 20000, deductions: 1500 },
  });
  const employees = [
    await mk({
      firstName: 'Ethan', lastName: 'Clark', email: 'employee@hrms.com', role: roles.Employee._id,
      department: depts.ENG._id, designation: desig['Software Engineer']._id, manager: manager._id, gender: 'male',
      phone: '+1 555 0101', salary: { basic: 60000, allowances: 8000, deductions: 1000 },
      bankDetails: { bankName: 'First Bank', accountName: 'Ethan Clark', accountNumber: '1234567890', ifsc: 'FBK0001' },
    }),
    await mk({
      firstName: 'Sofia', lastName: 'Nguyen', email: 'sofia@hrms.com', role: roles.Employee._id,
      department: depts.ENG._id, designation: desig['Senior Software Engineer']._id, manager: manager._id, gender: 'female',
      salary: { basic: 80000, allowances: 10000, deductions: 1000 },
    }),
    await mk({
      firstName: 'Liam', lastName: 'Brown', email: 'liam@hrms.com', role: roles.Employee._id,
      department: depts.FIN._id, designation: desig.Accountant._id, manager: hr._id, gender: 'male',
      salary: { basic: 55000, allowances: 6000, deductions: 800 },
    }),
    await mk({
      firstName: 'Olivia', lastName: 'Garcia', email: 'olivia@hrms.com', role: roles.Employee._id,
      department: depts.SAL._id, designation: desig['Sales Executive']._id, manager: hr._id, gender: 'female',
      employmentType: 'contract', salary: { basic: 45000, allowances: 9000, deductions: 500 },
    }),
  ];

  await Department.updateOne({ _id: depts.HR._id }, { head: hr._id });
  await Department.updateOne({ _id: depts.ENG._id }, { head: manager._id });

  const leaveTypes = await LeaveType.insertMany([
    { name: 'Annual Leave', code: 'AL', daysPerYear: 18, isPaid: true, description: 'Planned vacation' },
    { name: 'Sick Leave', code: 'SL', daysPerYear: 10, isPaid: true, description: 'Illness or medical' },
    { name: 'Casual Leave', code: 'CL', daysPerYear: 6, isPaid: true, description: 'Short personal matters' },
    { name: 'Unpaid Leave', code: 'UL', daysPerYear: 30, isPaid: false, description: 'Leave without pay' },
  ]);

  const year = new Date().getFullYear();
  await Holiday.insertMany([
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: 'Labour Day', date: new Date(year, 4, 1) },
    { name: 'Independence Day', date: new Date(year, 7, 15) },
    { name: 'Company Foundation Day', date: new Date(year, 9, 5), type: 'optional' },
    { name: 'Christmas Day', date: new Date(year, 11, 25) },
    { name: "New Year's Day", date: new Date(year + 1, 0, 1) },
  ]);

  // Attendance for the last 14 days (excluding today and weekends).
  const everyone = [admin, hr, manager, ...employees];
  const records = [];
  for (let i = 14; i >= 1; i -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    if (isWeekend(day)) continue;
    for (const user of everyone) {
      const roll = Math.random();
      if (roll < 0.05) {
        records.push({ user: user._id, date: toDateKey(day), status: 'absent' });
        continue;
      }
      const late = roll < 0.2;
      const checkIn = new Date(day);
      checkIn.setHours(late ? 10 : 9, Math.floor(Math.random() * 30), 0, 0);
      const checkOut = new Date(day);
      checkOut.setHours(18, Math.floor(Math.random() * 45), 0, 0);
      records.push({
        user: user._id, date: toDateKey(day), checkIn, checkOut,
        workHours: Math.round(((checkOut - checkIn) / 36e5) * 100) / 100,
        status: late ? 'late' : 'present',
      });
    }
  }
  await Attendance.insertMany(records);

  // A couple of leave requests in different states.
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  while (isWeekend(nextWeek)) nextWeek.setDate(nextWeek.getDate() + 1);
  const nextWeekEnd = new Date(nextWeek);
  nextWeekEnd.setDate(nextWeekEnd.getDate() + 1);
  while (isWeekend(nextWeekEnd)) nextWeekEnd.setDate(nextWeekEnd.getDate() + 1);

  await Leave.insertMany([
    {
      user: employees[0]._id, leaveType: leaveTypes[0]._id, startDate: nextWeek, endDate: nextWeekEnd,
      days: 2, reason: 'Family trip', status: 'pending',
    },
    {
      user: employees[1]._id, leaveType: leaveTypes[1]._id, startDate: nextWeek, endDate: nextWeek,
      days: 1, reason: 'Doctor appointment', status: 'pending',
    },
    {
      user: employees[2]._id, leaveType: leaveTypes[2]._id, startDate: nextWeek, endDate: nextWeek,
      days: 1, reason: 'Personal errand', status: 'approved', reviewedBy: hr._id, reviewedAt: new Date(),
    },
  ]);

  await Announcement.insertMany([
    {
      title: 'Welcome to the new HRMS', pinned: true, priority: 'high', createdBy: hr._id,
      content: 'All attendance, leave and payslips now live here. Please check in daily and keep your profile up to date.',
    },
    {
      title: 'Sprint demo on Friday', priority: 'normal', createdBy: manager._id, departments: [depts.ENG._id],
      content: 'Engineering sprint demo this Friday at 4 PM in the main conference room.',
    },
  ]);

  console.log('\nSeed complete. All accounts use password:', PASSWORD);
  console.table(everyone.map((u) => ({ email: u.email, name: u.fullName, employeeId: u.employeeId })));
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
