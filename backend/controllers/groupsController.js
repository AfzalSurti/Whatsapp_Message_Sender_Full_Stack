const { validationResult } = require('express-validator');
const ContactGroup = require('../models/ContactGroup');

const stripNumber = (num) => num.replace(/\D/g, '');

const validatePhone = (phone) => {
  const cleaned = stripNumber(phone);
  return cleaned.length >= 10;
};

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))];
  }

  return [...new Set(String(tags || '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean))];
};

const createGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, color } = req.body;

    const group = await ContactGroup.create({
      userId: req.user._id,
      name,
      color: color || '#25D366'
    });

    res.status(201).json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroups = async (req, res) => {
  try {
    const groups = await ContactGroup.find({ userId: req.user._id }).sort({ createdAt: -1 });

    const groupsWithCounts = groups.map(group => ({
      ...group.toObject(),
      count: group.numbers.length
    }));

    res.json({ groups: groupsWithCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await ContactGroup.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateGroup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, color } = req.body;

    const group = await ContactGroup.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { ...(name && { name }), ...(color && { color }) },
      { new: true, runValidators: true }
    );

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const group = await ContactGroup.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addNumber = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phone, tags } = req.body;

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Phone number must have at least 10 digits' });
    }

    const cleanPhone = stripNumber(phone);

    const group = await ContactGroup.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const exists = group.numbers.some(n => stripNumber(n.phone) === cleanPhone);
    if (exists) {
      return res.status(400).json({ error: 'Number already exists in this group' });
    }

    group.numbers.push({ name: name || '', phone: cleanPhone, tags: normalizeTags(tags) });
    await group.save();

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeNumber = async (req, res) => {
  try {
    const { id, phone } = req.params;
    const cleanPhone = stripNumber(phone);

    const group = await ContactGroup.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    group.numbers = group.numbers.filter(n => stripNumber(n.phone) !== cleanPhone);
    await group.save();

    res.json({ group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const bulkAddNumbers = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { numbers } = req.body;

    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ error: 'Numbers array is required and must not be empty' });
    }

    const group = await ContactGroup.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const existingPhones = new Set(group.numbers.map(n => stripNumber(n.phone)));
    let added = 0;
    let skipped = 0;

    numbers.forEach(item => {
      const phone = typeof item === 'string' ? item : item.phone;
      const name = typeof item === 'object' ? (item.name || '') : '';
      const tags = typeof item === 'object' ? normalizeTags(item.tags) : [];

      if (!validatePhone(phone)) {
        skipped++;
        return;
      }

      const cleanPhone = stripNumber(phone);
      if (existingPhones.has(cleanPhone)) {
        skipped++;
        return;
      }

      group.numbers.push({ name, phone: cleanPhone, tags });
      existingPhones.add(cleanPhone);
      added++;
    });

    await group.save();

    res.json({
      group,
      stats: { added, skipped, total: numbers.length }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addNumber,
  removeNumber,
  bulkAddNumbers
};
