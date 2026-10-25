import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    daysPerYear: { type: Number, required: true, min: 0 },
    isPaid: { type: Boolean, default: true },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('LeaveType', leaveTypeSchema);
