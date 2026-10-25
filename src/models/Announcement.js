import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    // Empty list = visible to everyone.
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    pinned: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
