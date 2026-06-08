const ContactGroup = require('../models/ContactGroup');
const ContactTag = require('../models/ContactTag');
const defaultContactTags = require('../data/defaultContactTags');
const { normalizePhoneNumber } = require('./phone');

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  }
  return [...new Set(String(tags || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean))];
};

const seedDefaultTags = async (userId) => {
  const existing = await ContactTag.countDocuments({ userId });
  if (existing > 0) return;

  await ContactTag.insertMany(
    defaultContactTags.map((tag) => ({
      userId,
      name: tag.name,
      category: tag.category,
      color: tag.color
    }))
  );
};

const ensureDefaultGroup = async (userId) => {
  let group = await ContactGroup.findOne({ userId, name: 'General' });
  if (!group) {
    group = await ContactGroup.create({
      userId,
      name: 'General',
      color: '#25D366',
      numbers: []
    });
  }
  return group;
};

const flattenContacts = (groups) => {
  const byPhone = new Map();

  groups.forEach((group) => {
    (group.numbers || []).forEach((entry) => {
      const phone = entry.phone;
      if (!phone) return;

      if (!byPhone.has(phone)) {
        byPhone.set(phone, {
          phone,
          name: entry.name || '',
          tags: [],
          groups: []
        });
      }

      const contact = byPhone.get(phone);
      if (entry.name && !contact.name) contact.name = entry.name;

      normalizeTags(entry.tags).forEach((tag) => {
        if (!contact.tags.includes(tag)) contact.tags.push(tag);
      });

      if (!contact.groups.some((g) => g.id === String(group._id))) {
        contact.groups.push({
          id: String(group._id),
          name: group.name,
          color: group.color || '#25D366'
        });
      }
    });
  });

  return Array.from(byPhone.values()).sort((a, b) =>
    (a.name || a.phone).localeCompare(b.name || b.phone, undefined, { sensitivity: 'base' })
  );
};

const updateContactInGroups = async (userId, phone, { name, tags }) => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized?.e164) {
    throw new Error('Enter a valid international phone number');
  }

  const cleanPhone = normalized.e164;
  const groups = await ContactGroup.find({ userId, 'numbers.phone': cleanPhone });

  if (groups.length === 0) {
    throw new Error('Contact not found');
  }

  for (const group of groups) {
    let changed = false;
    group.numbers.forEach((entry) => {
      if (entry.phone === cleanPhone) {
        if (name !== undefined) entry.name = String(name).trim();
        if (tags !== undefined) entry.tags = normalizeTags(tags);
        changed = true;
      }
    });
    if (changed) await group.save();
  }

  return cleanPhone;
};

const collectContactsByTags = (groups, segmentTags = [], { matchAll = false } = {}) => {
  const wanted = normalizeTags(segmentTags);
  if (wanted.length === 0) return [];

  const phoneSet = new Set();
  const results = [];

  groups.forEach((group) => {
    (group.numbers || []).forEach((entry) => {
      const entryTags = normalizeTags(entry.tags);
      const matches = matchAll
        ? wanted.every((tag) => entryTags.includes(tag))
        : wanted.some((tag) => entryTags.includes(tag));

      if (!matches || phoneSet.has(entry.phone)) return;

      phoneSet.add(entry.phone);
      results.push({
        name: entry.name || '',
        phone: entry.phone.replace(/\D/g, ''),
        groupId: group._id,
        segment: entryTags.length > 0 ? entryTags.join(', ') : group.name
      });
    });
  });

  return results;
};

module.exports = {
  normalizeTags,
  seedDefaultTags,
  ensureDefaultGroup,
  flattenContacts,
  updateContactInGroups,
  collectContactsByTags
};
