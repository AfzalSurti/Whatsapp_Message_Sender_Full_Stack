const { validationResult } = require('express-validator');
const ContactGroup = require('../models/ContactGroup');
const ContactTag = require('../models/ContactTag');
const { normalizePhoneNumber } = require('../utils/phone');
const {
  seedDefaultTags,
  ensureDefaultGroup,
  flattenContacts,
  updateContactInGroups,
  deleteContactFromGroups,
  normalizeTags
} = require('../utils/contactSegments');
const { normalizeGroupNumbers } = require('../models/ContactGroup');

const getOverview = async (req, res) => {
  try {
    const userId = req.user._id;
    await seedDefaultTags(userId);
    await ensureDefaultGroup(userId);

    const [groups, tags] = await Promise.all([
      ContactGroup.find({ userId }).sort({ name: 1 }),
      ContactTag.find({ userId }).sort({ category: 1, name: 1 })
    ]);

    const contacts = flattenContacts(groups);

    res.json({
      contacts,
      tags,
      groups: groups.map((g) => ({
        _id: g._id,
        name: g.name,
        color: g.color,
        count: g.numbers?.length || 0
      })),
      totalContacts: contacts.length
    });
  } catch (err) {
    console.error('Get contacts overview failed:', err.message);
    res.status(500).json({ error: 'Failed to load contacts' });
  }
};

const getTags = async (req, res) => {
  try {
    const userId = req.user._id;
    await seedDefaultTags(userId);
    const tags = await ContactTag.find({ userId }).sort({ category: 1, name: 1 });
    res.json({ tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createTag = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, category, color } = req.body;
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const existing = await ContactTag.findOne({ userId: req.user._id, name: trimmed });
    if (existing) {
      return res.status(400).json({ error: 'Tag already exists' });
    }

    const tag = await ContactTag.create({
      userId: req.user._id,
      name: trimmed,
      category: category || 'custom',
      color: color || '#25D366'
    });

    res.status(201).json({ tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTag = async (req, res) => {
  try {
    const tag = await ContactTag.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    const groups = await ContactGroup.find({ userId: req.user._id });
    for (const group of groups) {
      let changed = false;
      group.numbers.forEach((entry) => {
        const next = (entry.tags || []).filter((t) => t !== tag.name);
        if (next.length !== (entry.tags || []).length) {
          entry.tags = next;
          changed = true;
        }
      });
      if (changed) await group.save();
    }

    res.json({ message: 'Tag deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const { phone, name, tags } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    await updateContactInGroups(req.user._id, phone, { name, tags });

    const groups = await ContactGroup.find({ userId: req.user._id });
    const contacts = flattenContacts(groups);
    const normalized = normalizePhoneNumber(phone);
    const contact = contacts.find((c) => c.phone === normalized?.e164);

    res.json({ contact });
  } catch (err) {
    const message = err.message || 'Failed to update contact';
    const status = /not found|valid international/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }

    await deleteContactFromGroups(req.user._id, phone);
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    const message = err.message || 'Failed to delete contact';
    const status = /not found|valid international/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  }
};

const importContacts = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No rows to import' });
    }

    await seedDefaultTags(req.user._id);
    const generalGroup = await ensureDefaultGroup(req.user._id);

    generalGroup.numbers = normalizeGroupNumbers(generalGroup.numbers, { skipInvalid: true });
    const existingPhones = new Set(generalGroup.numbers.map((n) => n.phone));

    let added = 0;
    let skipped = 0;

    for (const row of rows) {
      const normalized = normalizePhoneNumber(row.phone);
      if (!normalized?.e164) {
        skipped++;
        continue;
      }

      if (existingPhones.has(normalized.e164)) {
        skipped++;
        continue;
      }

      generalGroup.numbers.push({
        name: String(row.name || '').trim(),
        phone: normalized.e164,
        tags: normalizeTags(row.tags)
      });
      existingPhones.add(normalized.e164);
      added++;
    }

    await generalGroup.save();

    res.json({ stats: { added, skipped, total: rows.length } });
  } catch (err) {
    console.error('Import contacts failed:', err.message);
    res.status(500).json({ error: err.message || 'Import failed' });
  }
};

module.exports = {
  getOverview,
  getTags,
  createTag,
  deleteTag,
  updateContact,
  deleteContact,
  importContacts
};
