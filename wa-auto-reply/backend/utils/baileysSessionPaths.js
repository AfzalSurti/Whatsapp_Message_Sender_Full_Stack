const fs = require('fs');
const path = require('path');

const AUTH_DATA_PATH = process.env.WHATSAPP_AUTH_PATH
  || path.join(__dirname, '..', '.baileys_auth');

const ensureAuthDir = () => {
  if (!fs.existsSync(AUTH_DATA_PATH)) {
    fs.mkdirSync(AUTH_DATA_PATH, { recursive: true });
  }
};

ensureAuthDir();

const getLegacyLocalSessionDir = (userId) =>
  path.join(AUTH_DATA_PATH, `session-${userId.toString()}`);

module.exports = {
  AUTH_DATA_PATH,
  getLegacyLocalSessionDir,
  ensureAuthDir
};
