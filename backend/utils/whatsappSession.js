const fs = require('fs');
const path = require('path');

const AUTH_DATA_PATH = process.env.WHATSAPP_AUTH_PATH
  || path.join(__dirname, '..', '.wwebjs_auth');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureAuthDir = () => {
  if (!fs.existsSync(AUTH_DATA_PATH)) {
    fs.mkdirSync(AUTH_DATA_PATH, { recursive: true });
  }
};

ensureAuthDir();

const getLocalSessionDir = (userId) =>
  path.join(AUTH_DATA_PATH, `session-${userId.toString()}`);

const hasStoredLocalSession = (userId) => {
  try {
    const sessionDir = getLocalSessionDir(userId);
    if (!fs.existsSync(sessionDir)) return false;

    const defaultDir = path.join(sessionDir, 'Default');
    if (fs.existsSync(defaultDir)) {
      return fs.readdirSync(defaultDir).length > 0;
    }

    return fs.readdirSync(sessionDir).length > 0;
  } catch {
    return false;
  }
};

const canRecoverSession = async (userId) => hasStoredLocalSession(userId);

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

const cleanupLocalAuthArtifacts = async (userId, { maxAttempts = 6 } = {}) => {
  const sessionDir = getLocalSessionDir(userId);
  if (!fs.existsSync(sessionDir)) return true;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fs.rmSync(sessionDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 500
      });
      console.log(`🗑️  Deleted local WhatsApp session folder: ${sessionDir}`);
      return true;
    } catch (err) {
      const retriable = ['EBUSY', 'EPERM', 'EACCES'].includes(err.code);
      if (!retriable || attempt === maxAttempts) {
        console.warn(`Failed to remove local WhatsApp session: ${err.message}`);
        return false;
      }
      await sleep(750 * attempt);
    }
  }

  return false;
};

const deleteStoredRemoteSession = async (userId) => {
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
      console.log(`🗑️  Removed WhatsApp auth artifact: ${entry.name}`);
    } catch (err) {
      console.warn(`Could not remove ${entry.name}: ${err.message}`);
    }
  }

  console.log(`🧹 Purged ${removed} item(s) from ${AUTH_DATA_PATH}`);
  return removed;
};

module.exports = {
  AUTH_DATA_PATH,
  getLocalSessionDir,
  hasStoredLocalSession,
  listLocalSessionUserIds,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  deleteStoredRemoteSession,
  purgeAllLocalSessions
};
