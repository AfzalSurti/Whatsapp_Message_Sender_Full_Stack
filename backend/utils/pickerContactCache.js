const fs = require('fs');
const path = require('path');
const { getLocalSessionDir } = require('./whatsappSession');

const getCachePath = (userId) => path.join(getLocalSessionDir(userId), 'picker-contacts.json');

const loadPickerContactCache = (userId) => {
  try {
    const filePath = getCachePath(userId);
    if (!fs.existsSync(filePath)) return [];

    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed?.contacts) ? parsed.contacts : [];
  } catch {
    return [];
  }
};

const savePickerContactCache = (userId, contacts = []) => {
  if (!Array.isArray(contacts) || contacts.length < 20) return;

  try {
    const filePath = getCachePath(userId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({ contacts, savedAt: new Date().toISOString() }, null, 0)
    );
  } catch (err) {
    console.warn(`Picker contact cache save failed: ${err.message}`);
  }
};

module.exports = {
  loadPickerContactCache,
  savePickerContactCache
};
