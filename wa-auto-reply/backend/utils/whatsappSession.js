const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  hasMongoAuthSession,
  listMongoAuthUserIds,
  deleteMongoAuthSession
} = require('./baileysMongoAuth');
const {
  AUTH_DATA_PATH,
  getLegacyLocalSessionDir,
  ensureAuthDir
} = require('./baileysSessionPaths');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getLocalSessionDir = (userId) =>
  path.join(os.tmpdir(), 'wa-picker-cache', userId.toString());

const hasStoredLocalSession = (userId) => {
  try {
    const sessionDir = getLegacyLocalSessionDir(userId);
    if (!fs.existsSync(sessionDir)) return false;

    const credsPath = path.join(sessionDir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      const raw = fs.readFileSync(credsPath, 'utf8');
      return raw.trim().length > 2;
    }

    return fs.readdirSync(sessionDir).some((name) => name.endsWith('.json'));
  } catch {
    return false;
  }
};

const canRecoverSession = async (userId) => {
  if (await hasMongoAuthSession(userId)) return true;
  return hasStoredLocalSession(userId);
};

const listLocalSessionUserIds = () => {
  try {
    if (!fs.existsSync(AUTH_DATA_PATH)) return [];

    return fs
      .readdirSync(AUTH_DATA_PATH, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('session-'))
      .map((entry) => entry.name.replace(/^session-/, ''))
      .filter((userId) => hasStoredLocalSession(userId));
  } catch {
    return [];
  }
};

const listStoredSessionUserIds = async () => {
  const mongoUserIds = await listMongoAuthUserIds();
  const localUserIds = listLocalSessionUserIds();
  return [...new Set([...mongoUserIds, ...localUserIds])];
};

const cleanupLocalAuthArtifacts = async (userId, { maxAttempts = 6 } = {}) => {
  const sessionDir = getLegacyLocalSessionDir(userId);
  if (!fs.existsSync(sessionDir)) return true;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.rmSync(sessionDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 500
      });
      console.log(`Deleted legacy Baileys session folder: ${sessionDir}`);
      return true;
    } catch (err) {
      const retriable = ['EBUSY', 'EPERM', 'EACCES'].includes(err.code);
      if (!retriable || attempt === maxAttempts) {
        console.warn(`Failed to remove legacy Baileys session: ${err.message}`);
        return false;
      }
      await sleep(750 * attempt);
    }
  }

  return false;
};

const deleteStoredRemoteSession = async (userId) => {
  const deletedKeys = await deleteMongoAuthSession(userId);
  if (deletedKeys > 0) {
    console.log(`Deleted ${deletedKeys} Baileys auth key(s) from MongoDB for user ${userId}`);
  }
  await cleanupLocalAuthArtifacts(userId);
};

const purgeAllLocalSessions = async () => {
  ensureAuthDir();

  const entries = fs.readdirSync(AUTH_DATA_PATH, { withFileTypes: true });
  let removed = 0;

  for (const entry of entries) {
    const targetPath = path.join(AUTH_DATA_PATH, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
      } else {
        fs.unlinkSync(targetPath);
      }
      removed += 1;
      console.log(`Removed WhatsApp auth artifact: ${entry.name}`);
    } catch (err) {
      console.warn(`Could not remove ${entry.name}: ${err.message}`);
    }
  }

  console.log(`Purged ${removed} legacy item(s) from ${AUTH_DATA_PATH}`);
  return removed;
};

module.exports = {
  AUTH_DATA_PATH,
  getLegacyLocalSessionDir,
  getLocalSessionDir,
  hasStoredLocalSession,
  listLocalSessionUserIds,
  listStoredSessionUserIds,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  deleteStoredRemoteSession,
  purgeAllLocalSessions
};
