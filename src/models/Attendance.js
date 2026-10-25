import mongoose from 'mongoose';

export const ATTENDANCE_STATUSES = ['present', 'late', 'half-day', 'absent', 'on-leave'];

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    checkIn: Date,
    checkOut: Date,
    workHours: { type: Number, default: 0 },
    status: { type: String, enum: ATTENDANCE_STATUSES, default: 'present' },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

export default mongoose.model('Attendance', attendanceSchema);
