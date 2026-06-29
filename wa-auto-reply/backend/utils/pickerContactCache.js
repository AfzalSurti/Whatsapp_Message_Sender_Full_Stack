const fs = require('fs');
const path = require('path');
const PickerContactSnapshot = require('../models/PickerContactSnapshot');
const { getLegacyLocalSessionDir } = require('./baileysSessionPaths');

const getLegacyPickerCachePath = (userId) =>
  path.join(getLegacyLocalSessionDir(userId), 'picker-contacts.json');

const readLegacyPickerCacheFile = (userId) => {
  try {
    const filePath = getLegacyPickerCachePath(userId);
    if (!fs.existsSync(filePath)) return [];

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.contacts) ? parsed.contacts : [];
  } catch {
    return [];
  }
};

const loadPickerContactCache = async (userId) => {
  const userIdStr = userId.toString();

  try {
    const doc = await PickerContactSnapshot.findOne({ userId: userIdStr }).lean();
    if (doc?.contacts?.length) {
      return doc.contacts;
    }
  } catch (err) {
    console.warn(`Picker Mongo cache read failed: ${err.message}`);
  }

  const legacy = readLegacyPickerCacheFile(userIdStr);
  if (legacy.length > 0) {
    await savePickerContactCache(userIdStr, legacy);
    console.log(`Imported ${legacy.length} picker contacts from legacy disk cache for ${userIdStr}`);
    return legacy;
  }

  return [];
};

const savePickerContactCache = async (userId, contacts = []) => {
  if (!Array.isArray(contacts) || contacts.length < 20) return;

  const userIdStr = userId.toString();

  try {
    await PickerContactSnapshot.findOneAndUpdate(
      { userId: userIdStr },
      {
        contacts,
        contactCount: contacts.length
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    console.warn(`Picker Mongo cache save failed: ${err.message}`);
  }
};

const getPickerCacheMinExpected = async (userId, fallback = 50) => {
  const cached = await loadPickerContactCache(userId);
  if (cached.length >= 80) {
    return Math.min(500, Math.max(fallback, Math.floor(cached.length * 0.85)));
  }
  return fallback;
};

module.exports = {
  loadPickerContactCache,
  savePickerContactCache,
  getPickerCacheMinExpected,
  readLegacyPickerCacheFile
};
