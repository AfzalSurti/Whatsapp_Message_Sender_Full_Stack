const fs = require('fs');
const path = require('path');
const { getLocalSessionDir } = require('./whatsappSession');

const CACHE_ROOT = path.join(__dirname, '..', '.picker_cache');
const getStableCachePath = (userId) => path.join(CACHE_ROOT, `picker-contacts-${userId}.json`);
const getLegacyCachePath = (userId) => path.join(getLocalSessionDir(userId), 'picker-contacts.json');

const readContactsFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.contacts) ? parsed.contacts : [];
  } catch {
    return [];
  }
};

const writeContactsFile = (filePath, contacts = []) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify({ contacts, savedAt: new Date().toISOString() }, null, 0)
  );
};

const loadPickerContactCache = (userId) => {
  const stablePath = getStableCachePath(userId);
  const legacyPath = getLegacyCachePath(userId);

  const stableContacts = readContactsFile(stablePath);
  const legacyContacts = readContactsFile(legacyPath);

  // Prefer the larger snapshot to avoid regressing to recent-only lists.
  if (legacyContacts.length > stableContacts.length) {
    try {
      writeContactsFile(stablePath, legacyContacts);
    } catch {
      // ignore cache migration write failures
    }
    return legacyContacts;
  }

  return stableContacts;
};

const savePickerContactCache = (userId, contacts = []) => {
  if (!Array.isArray(contacts) || contacts.length < 20) return;

  try {
    const stablePath = getStableCachePath(userId);
    const existing = readContactsFile(stablePath);
    const next = contacts.length >= existing.length ? contacts : existing;
    writeContactsFile(stablePath, next);
  } catch (err) {
    console.warn(`Picker contact cache save failed: ${err.message}`);
  }
};

module.exports = {
  loadPickerContactCache,
  savePickerContactCache
};
