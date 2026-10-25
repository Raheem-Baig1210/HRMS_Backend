import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

async function profilePayload(userId) {
  const user = await User.findById(userId)
    .populate('role')
    .populate('department', 'name code')
    .populate('designation', 'title')
    .populate('manager', 'firstName lastName email employeeId');
  return {
    user: user.toJSON(),
    permissions: user.role.effectivePermissions(),
  };
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw new ApiError(400, 'Email and password are required');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.status !== 'active') throw new ApiError(403, 'Account is not active');

  res.json({ token: signToken(user._id), ...(await profilePayload(user._id)) });
}

export async function me(req, res) {
  res.json(await profilePayload(req.user._id));
}

// Self-service profile edit: only personal contact fields.
export async function updateProfile(req, res) {
  const { phone, address, emergencyContact, dateOfBirth, gender } = req.body;
  const user = req.user;
  if (phone !== undefined) user.phone = phone;
  if (address !== undefined) user.address = address;
  if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || undefined;
  if (gender !== undefined) user.gender = gender;
  if (emergencyContact) user.emergencyContact = { ...user.emergencyContact?.toObject?.(), ...emergencyContact };
  await user.save();
  res.json(await profilePayload(user._id));
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new ApiError(400, 'Both passwords are required');
  if (newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated' });
}
