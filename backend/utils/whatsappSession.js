const { MongoStore } = require('wwebjs-mongo');
const mongoose = require('mongoose');

const getRemoteSessionName = (userId) => `RemoteAuth-${userId.toString()}`;

const getMongoStore = () => new MongoStore({ mongoose });

const hasStoredRemoteSession = async (userId) => {
  try {
    const store = getMongoStore();
    return store.sessionExists({ session: getRemoteSessionName(userId) });
  } catch (err) {
    console.error(`Failed to check stored WhatsApp session: ${err.message}`);
    return false;
  }
};

const deleteStoredRemoteSession = async (userId) => {
  try {
    const store = getMongoStore();
    await store.delete({ session: getRemoteSessionName(userId) });
  } catch (err) {
    console.error(`Failed to delete stored WhatsApp session: ${err.message}`);
  }
};

module.exports = {
  getRemoteSessionName,
  hasStoredRemoteSession,
  deleteStoredRemoteSession
};
