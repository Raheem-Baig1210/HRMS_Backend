import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

// Verifies the JWT and loads the user with its role. Permissions are re-read
// from the database on every request, so role changes take effect immediately.
export async function protect(req, _res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw new ApiError(401, 'Not authenticated');

  const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).populate('role');
  if (!user) throw new ApiError(401, 'User no longer exists');
  if (user.status !== 'active') throw new ApiError(403, 'Account is not active');
  if (!user.role) throw new ApiError(403, 'No role assigned');

  req.user = user;
  req.permissions = new Set(user.role.effectivePermissions());
  next();
}

export const hasPermission = (req, perm) => req.permissions?.has(perm);

export const isSuperAdmin = (req) => Boolean(req.user?.role?.isSuperAdmin);

// Passes if the user holds ANY of the listed permissions.
export function authorize(...perms) {
  return (req, _res, next) => {
    if (perms.some((p) => req.permissions.has(p))) return next();
    throw new ApiError(403, 'You do not have permission to perform this action');
  };
}

// IDs of users who report directly to the current user.
export async function teamMemberIds(req) {
  const members = await User.find({ manager: req.user._id }).select('_id').lean();
  return members.map((m) => m._id);
}
