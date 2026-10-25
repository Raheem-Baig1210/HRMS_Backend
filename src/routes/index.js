import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect, authorize } from '../middleware/auth.js';

import * as auth from '../controllers/authController.js';
import * as employees from '../controllers/employeeController.js';
import * as org from '../controllers/departmentController.js';
import * as attendance from '../controllers/attendanceController.js';
import * as leave from '../controllers/leaveController.js';
import * as payroll from '../controllers/payrollController.js';
import * as holidays from '../controllers/holidayController.js';
import * as announcements from '../controllers/announcementController.js';
import * as roles from '../controllers/roleController.js';
import { getDashboard } from '../controllers/dashboardController.js';

const router = Router();

/* ---------- Auth ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
router.post('/auth/login', loginLimiter, auth.login);

// Everything below requires a valid session.
router.use(protect);

router.get('/auth/me', auth.me);
router.put('/auth/profile', auth.updateProfile);
router.put('/auth/password', auth.changePassword);

/* ---------- Dashboard ---------- */
router.get('/dashboard', authorize('dashboard:view'), getDashboard);

/* ---------- Employees ---------- */
router.get('/employees/options', authorize('employee:read', 'payroll:manage', 'attendance:manage', 'department:manage'), employees.employeeOptions);
router.get('/employees', authorize('employee:read'), employees.listEmployees);
router.get('/employees/:id', authorize('employee:read'), employees.getEmployee);
router.post('/employees', authorize('employee:create'), employees.createEmployee);
router.put('/employees/:id', authorize('employee:update'), employees.updateEmployee);
router.delete('/employees/:id', authorize('employee:delete'), employees.deleteEmployee);

/* ---------- Departments & designations ---------- */
router.get('/departments', authorize('department:read', 'department:manage'), org.listDepartments);
router.post('/departments', authorize('department:manage'), org.createDepartment);
router.put('/departments/:id', authorize('department:manage'), org.updateDepartment);
router.delete('/departments/:id', authorize('department:manage'), org.deleteDepartment);

router.get('/designations', authorize('department:read', 'department:manage'), org.listDesignations);
router.post('/designations', authorize('department:manage'), org.createDesignation);
router.put('/designations/:id', authorize('department:manage'), org.updateDesignation);
router.delete('/designations/:id', authorize('department:manage'), org.deleteDesignation);

/* ---------- Attendance ---------- */
router.get('/attendance/today', authorize('attendance:mark', 'attendance:read:own'), attendance.today);
router.post('/attendance/check-in', authorize('attendance:mark'), attendance.checkIn);
router.post('/attendance/check-out', authorize('attendance:mark'), attendance.checkOut);
router.get('/attendance/me', authorize('attendance:read:own'), attendance.myAttendance);
router.get('/attendance', authorize('attendance:read:all', 'attendance:read:team'), attendance.listAttendance);
router.post('/attendance', authorize('attendance:manage'), attendance.upsertAttendance);
router.delete('/attendance/:id', authorize('attendance:manage'), attendance.deleteAttendance);

/* ---------- Leave ---------- */
router.get('/leave-types', leave.listLeaveTypes);
router.post('/leave-types', authorize('leavetype:manage'), leave.createLeaveType);
router.put('/leave-types/:id', authorize('leavetype:manage'), leave.updateLeaveType);
router.delete('/leave-types/:id', authorize('leavetype:manage'), leave.deleteLeaveType);

router.get('/leaves/balance', authorize('leave:apply'), leave.myBalance);
router.get('/leaves/me', authorize('leave:apply'), leave.myLeaves);
router.post('/leaves', authorize('leave:apply'), leave.applyLeave);
router.get('/leaves', authorize('leave:read:all', 'leave:read:team'), leave.listLeaves);
router.patch('/leaves/:id/review', authorize('leave:approve'), leave.reviewLeave);
router.patch('/leaves/:id/cancel', authorize('leave:apply'), leave.cancelLeave);

/* ---------- Payroll ---------- */
router.post('/payroll/generate', authorize('payroll:manage'), payroll.generatePayroll);
router.post('/payroll/bulk-status', authorize('payroll:manage'), payroll.bulkStatus);
router.get('/payroll/me', authorize('payroll:read:own'), payroll.myPayroll);
router.get('/payroll', authorize('payroll:read:all'), payroll.listPayroll);
router.get('/payroll/:id', authorize('payroll:read:all', 'payroll:read:own'), payroll.getPayslip);
router.put('/payroll/:id', authorize('payroll:manage'), payroll.updatePayslip);
router.patch('/payroll/:id/status', authorize('payroll:manage'), payroll.setStatus);
router.delete('/payroll/:id', authorize('payroll:manage'), payroll.deletePayslip);

/* ---------- Holidays ---------- */
router.get('/holidays', authorize('holiday:read', 'holiday:manage'), holidays.listHolidays);
router.post('/holidays', authorize('holiday:manage'), holidays.createHoliday);
router.put('/holidays/:id', authorize('holiday:manage'), holidays.updateHoliday);
router.delete('/holidays/:id', authorize('holiday:manage'), holidays.deleteHoliday);

/* ---------- Announcements ---------- */
router.get('/announcements', authorize('announcement:read', 'announcement:manage'), announcements.listAnnouncements);
router.post('/announcements', authorize('announcement:manage'), announcements.createAnnouncement);
router.put('/announcements/:id', authorize('announcement:manage'), announcements.updateAnnouncement);
router.delete('/announcements/:id', authorize('announcement:manage'), announcements.deleteAnnouncement);

/* ---------- Roles & permissions ---------- */
router.get('/roles/permissions', authorize('role:read', 'role:manage'), roles.listPermissions);
router.get('/roles', authorize('role:read', 'role:manage', 'employee:create', 'employee:update'), roles.listRoles);
router.post('/roles', authorize('role:manage'), roles.createRole);
router.put('/roles/:id', authorize('role:manage'), roles.updateRole);
router.delete('/roles/:id', authorize('role:manage'), roles.deleteRole);

export default router;
