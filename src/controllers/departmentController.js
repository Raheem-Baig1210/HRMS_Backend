import Department from '../models/Department.js';
import Designation from '../models/Designation.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

export async function listDepartments(_req, res) {
  const [departments, counts] = await Promise.all([
    Department.find().populate('head', 'firstName lastName employeeId').sort({ name: 1 }),
    User.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json(departments.map((d) => ({ ...d.toObject(), employeeCount: countMap.get(String(d._id)) || 0 })));
}

export async function createDepartment(req, res) {
  const { name, code, description, head } = req.body;
  const dept = await Department.create({ name, code, description, head: head || undefined });
  res.status(201).json(dept);
}

export async function updateDepartment(req, res) {
  const { name, code, description, head } = req.body;
  const dept = await Department.findById(req.params.id);
  if (!dept) throw new ApiError(404, 'Department not found');
  dept.set({ name, code, description, head: head || undefined });
  await dept.save();
  res.json(dept);
}

export async function deleteDepartment(req, res) {
  const inUse = await User.exists({ department: req.params.id });
  if (inUse) throw new ApiError(400, 'Department has employees; reassign them first');
  const dept = await Department.findByIdAndDelete(req.params.id);
  if (!dept) throw new ApiError(404, 'Department not found');
  await Designation.deleteMany({ department: dept._id });
  res.json({ message: 'Department deleted' });
}

export async function listDesignations(req, res) {
  const filter = req.query.department ? { department: req.query.department } : {};
  const items = await Designation.find(filter).populate('department', 'name code').sort({ title: 1 });
  res.json(items);
}

export async function createDesignation(req, res) {
  const { title, department, description } = req.body;
  const item = await Designation.create({ title, department, description });
  await item.populate('department', 'name code');
  res.status(201).json(item);
}

export async function updateDesignation(req, res) {
  const { title, department, description } = req.body;
  const item = await Designation.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Designation not found');
  item.set({ title, department, description });
  await item.save();
  await item.populate('department', 'name code');
  res.json(item);
}

export async function deleteDesignation(req, res) {
  const inUse = await User.exists({ designation: req.params.id });
  if (inUse) throw new ApiError(400, 'Designation is assigned to employees');
  const item = await Designation.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Designation not found');
  res.json({ message: 'Designation deleted' });
}
