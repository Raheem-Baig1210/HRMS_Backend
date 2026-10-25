import mongoose from 'mongoose';
import { ALL_PERMISSIONS } from '../config/permissions.js';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: (perms) => perms.every((p) => ALL_PERMISSIONS.includes(p)),
        message: 'Unknown permission in list',
      },
    },
    // System roles cannot be deleted; the super admin role cannot be edited
    // and is always granted every permission at runtime.
    isSystem: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roleSchema.methods.effectivePermissions = function effectivePermissions() {
  return this.isSuperAdmin ? ALL_PERMISSIONS : this.permissions;
};

export default mongoose.model('Role', roleSchema);
