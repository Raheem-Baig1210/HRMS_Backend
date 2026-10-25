import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Counter from './Counter.js';

// A User is both the login account and the employee record.
const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },

    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    phone: { type: String, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    address: { type: String, trim: true },
    joiningDate: { type: Date, default: Date.now },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'intern'],
      default: 'full-time',
    },
    status: { type: String, enum: ['active', 'inactive', 'terminated'], default: 'active' },

    salary: {
      basic: { type: Number, default: 0, min: 0 },
      allowances: { type: Number, default: 0, min: 0 },
      deductions: { type: Number, default: 0, min: 0 },
    },
    bankDetails: {
      bankName: { type: String, trim: true },
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relation: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.pre('validate', async function assignEmployeeId() {
  if (!this.employeeId) {
    const seq = await Counter.next('employeeId');
    this.employeeId = `EMP${String(seq).padStart(4, '0')}`;
  }
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.id;
    return ret;
  },
});

export default mongoose.model('User', userSchema);
