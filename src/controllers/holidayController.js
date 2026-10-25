import Holiday from '../models/Holiday.js';
import ApiError from '../utils/ApiError.js';

export async function listHolidays(req, res) {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const items = await Holiday.find({
    date: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) },
  }).sort({ date: 1 });
  res.json(items);
}

export async function createHoliday(req, res) {
  const { name, date, type, description } = req.body;
  res.status(201).json(await Holiday.create({ name, date, type, description }));
}

export async function updateHoliday(req, res) {
  const item = await Holiday.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Holiday not found');
  const { name, date, type, description } = req.body;
  item.set({ name, date, type, description });
  await item.save();
  res.json(item);
}

export async function deleteHoliday(req, res) {
  const item = await Holiday.findByIdAndDelete(req.params.id);
  if (!item) throw new ApiError(404, 'Holiday not found');
  res.json({ message: 'Holiday deleted' });
}
