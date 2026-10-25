import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: { type: String, enum: ['public', 'optional'], default: 'public' },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1 });

export default mongoose.model('Holiday', holidaySchema);
