const fs = require('fs');
const path = require('path');
const FixedMongoStore = require('../config/fixedMongoStore');
const mongoose = require('mongoose');

const AUTH_DATA_PATH = FixedMongoStore.AUTH_DATA_PATH;

const getRemoteSessionName = (userId) => `RemoteAuth-${userId.toString()}`;

const getMongoStore = () => new FixedMongoStore({ mongoose, authDataPath: AUTH_DATA_PATH });

const hasLocalAuthSession = (userId) => {
  const sessionDir = path.join(AUTH_DATA_PATH, getRemoteSessionName(userId));
  return fs.existsSync(sessionDir);
};

const hasStoredRemoteSession = async (userId) => {
  try {
    const store = getMongoStore();
    return store.sessionExists({ session: getRemoteSessionName(userId) });
  } catch (err) {
    console.error(`Failed to check stored WhatsApp session: ${err.message}`);
    return false;
  }
};

const canRecoverSession = async (userId) => {
  if (hasLocalAuthSession(userId)) return true;
  return hasStoredRemoteSession(userId);
};

const deleteStoredRemoteSession = async (userId) => {
  try {
    const store = getMongoStore();
    await store.delete({ session: getRemoteSessionName(userId) });
  } catch (err) {
    console.error(`Failed to delete stored WhatsApp session: ${err.message}`);
  }

  const sessionDir = path.join(AUTH_DATA_PATH, getRemoteSessionName(userId));
  const zipPath = path.join(AUTH_DATA_PATH, `${getRemoteSessionName(userId)}.zip`);

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    console.warn(`Failed to remove local auth files: ${err.message}`);
  }
};

module.exports = {
  AUTH_DATA_PATH,
  getRemoteSessionName,
  hasLocalAuthSession,
  hasStoredRemoteSession,
  canRecoverSession,
  deleteStoredRemoteSession,
  getMongoStore
};
