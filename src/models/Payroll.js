import mongoose from 'mongoose';

const round2 = (n) => Math.round(n * 100) / 100;

const payrollSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    basic: { type: Number, default: 0, min: 0 },
    allowances: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 }, // percent of gross

    workingDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },

    // Computed by calculate()
    gross: { type: Number, default: 0 },
    unpaidLeaveDeduction: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },

    status: { type: String, enum: ['draft', 'processed', 'paid'], default: 'draft' },
    paidAt: Date,
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

payrollSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

payrollSchema.methods.calculate = function calculate() {
  const perDay = this.workingDays > 0 ? this.basic / this.workingDays : 0;
  this.unpaidLeaveDeduction = round2(perDay * this.unpaidLeaveDays);
  this.gross = round2(this.basic + this.allowances + this.bonus);
  this.tax = round2((this.gross * this.taxRate) / 100);
  this.netSalary = round2(
    Math.max(this.gross - this.deductions - this.tax - this.unpaidLeaveDeduction, 0)
  );
  return this;
};

export default mongoose.model('Payroll', payrollSchema);
