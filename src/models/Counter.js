import mongoose from 'mongoose';

// Atomic sequence generator (used for employee IDs like EMP0001).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(name) {
  const doc = await this.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

export default mongoose.model('Counter', counterSchema);
