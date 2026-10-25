import Announcement from '../models/Announcement.js';
import ApiError from '../utils/ApiError.js';
import { hasPermission } from '../middleware/auth.js';

const POPULATE = [
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'departments', select: 'name' },
];

export async function listAnnouncements(req, res) {
  // Managers of announcements see everything; others see company-wide posts
  // plus those targeted at their own department.
  const filter = hasPermission(req, 'announcement:manage')
    ? {}
    : {
        $or: [
          { departments: { $size: 0 } },
          ...(req.user.department ? [{ departments: req.user.department }] : []),
        ],
      };
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
  const items = await Announcement.find(filter).populate(POPULATE).sort({ pinned: -1, createdAt: -1 }).limit(limit);
  res.json(items);
}

export async function createAnnouncement(req, res) {
  const { title, content, priority, departments, pinned } = req.body;
  const item = await Announcement.create({
    title, content, priority, departments: departments || [], pinned, createdBy: req.user._id,
  });
  await item.populate(POPULATE);
  res.status(201).json(item);
}

export async function updateAnnouncement(req, res) {
  const item = await Announcement.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Announcement not found');
  const { title, content, priority, departments, pinned } = req.body;
  item.set({ title, content, priority, departments: departments || [], pinned });
  await item.save();
  await item.populate(POPULATE);
  res.json(item);
}

export async function deleteAnnouncement(req, res) {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Announcement not found');
  res.json({ message: 'Announcement deleted' });
}
