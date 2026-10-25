import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewComment: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

leaveSchema.index({ user: 1, startDate: 1 });
leaveSchema.index({ status: 1 });

export default mongoose.model('Leave', leaveSchema);
