const fs = require('fs');
const path = require('path');
const FixedMongoStore = require('../config/fixedMongoStore');
const mongoose = require('mongoose');

const AUTH_DATA_PATH = FixedMongoStore.AUTH_DATA_PATH;

const getRemoteSessionName = (userId) => `RemoteAuth-${userId.toString()}`;

const getMongoStore = () => new FixedMongoStore({ mongoose, authDataPath: AUTH_DATA_PATH });

const getLocalAuthPaths = (userId) => {
  const sessionName = getRemoteSessionName(userId);
  return {
    sessionDir: path.join(AUTH_DATA_PATH, sessionName),
    zipPath: path.join(AUTH_DATA_PATH, `${sessionName}.zip`)
  };
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

// Recovery uses MongoDB only — not leftover temp files.
const canRecoverSession = async (userId) => hasStoredRemoteSession(userId);

const cleanupLocalAuthArtifacts = (userId) => {
  const { sessionDir, zipPath } = getLocalAuthPaths(userId);

  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    console.warn(`Failed to remove temp WhatsApp auth files: ${err.message}`);
  }
};

const deleteStoredRemoteSession = async (userId) => {
  try {
    const store = getMongoStore();
    await store.delete({ session: getRemoteSessionName(userId) });
  } catch (err) {
    console.error(`Failed to delete stored WhatsApp session: ${err.message}`);
  }

  cleanupLocalAuthArtifacts(userId);
};

module.exports = {
  AUTH_DATA_PATH,
  getRemoteSessionName,
  hasStoredRemoteSession,
  canRecoverSession,
  cleanupLocalAuthArtifacts,
  deleteStoredRemoteSession,
  getMongoStore
};
