import Role from '../models/Role.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { PERMISSION_GROUPS, ALL_PERMISSIONS } from '../config/permissions.js';

export function listPermissions(_req, res) {
  res.json(PERMISSION_GROUPS);
}

export async function listRoles(_req, res) {
  const [roles, counts] = await Promise.all([
    Role.find().sort({ isSuperAdmin: -1, isSystem: -1, name: 1 }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json(
    roles.map((r) => ({
      ...r.toObject(),
      permissions: r.effectivePermissions(),
      userCount: countMap.get(String(r._id)) || 0,
    }))
  );
}

function cleanPermissions(perms) {
  if (!Array.isArray(perms)) return [];
  return [...new Set(perms.filter((p) => ALL_PERMISSIONS.includes(p)))];
}

export async function createRole(req, res) {
  const { name, description, permissions } = req.body;
  const role = await Role.create({ name, description, permissions: cleanPermissions(permissions) });
  res.status(201).json({ ...role.toObject(), userCount: 0 });
}

export async function updateRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found');
  if (role.isSuperAdmin) throw new ApiError(400, 'The Super Admin role cannot be modified');
  if (String(req.user.role._id) === String(role._id)) {
    throw new ApiError(400, 'You cannot modify the role you are currently assigned');
  }

  const { name, description, permissions } = req.body;
  if (name !== undefined && !role.isSystem) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions !== undefined) role.permissions = cleanPermissions(permissions);
  await role.save();
  res.json(role);
}

export async function deleteRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) throw new ApiError(404, 'Role not found');
  if (role.isSystem) throw new ApiError(400, 'System roles cannot be deleted');
  if (await User.exists({ role: role._id })) throw new ApiError(400, 'Role is assigned to users; reassign them first');
  await role.deleteOne();
  res.json({ message: 'Role deleted' });
}
