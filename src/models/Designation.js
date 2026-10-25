import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

designationSchema.index({ title: 1, department: 1 }, { unique: true });

export default mongoose.model('Designation', designationSchema);
