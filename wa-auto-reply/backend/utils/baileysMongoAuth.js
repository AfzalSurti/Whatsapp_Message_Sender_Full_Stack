const fs = require('fs');
const path = require('path');
const { Mutex } = require('async-mutex');
const { proto } = require('@whiskeysockets/baileys/WAProto');
const { initAuthCreds } = require('@whiskeysockets/baileys/lib/Utils/auth-utils');
const { BufferJSON } = require('@whiskeysockets/baileys/lib/Utils/generics');
const BaileysAuthKey = require('../models/BaileysAuthKey');

const keyLocks = new Map();

const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

const getKeyLock = (lockKey) => {
  let mutex = keyLocks.get(lockKey);
  if (!mutex) {
    mutex = new Mutex();
    keyLocks.set(lockKey, mutex);
  }
  return mutex;
};

const serializeAuthData = (data) => JSON.parse(JSON.stringify(data, BufferJSON.replacer));

const deserializeAuthData = (data) => JSON.parse(JSON.stringify(data), BufferJSON.reviver);

const useMongoDBAuthState = async (userId) => {
  const userIdStr = userId.toString();

  const writeData = async (data, file) => {
    const fileKey = fixFileName(file);
    const lockKey = `${userIdStr}:${fileKey}`;
    const mutex = getKeyLock(lockKey);

    return mutex.runExclusive(async () => {
      await BaileysAuthKey.findOneAndUpdate(
        { userId: userIdStr, fileKey },
        { data: serializeAuthData(data) },
        { upsert: true, setDefaultsOnInsert: true }
      );
    });
  };

  const readData = async (file) => {
    const fileKey = fixFileName(file);
    const doc = await BaileysAuthKey.findOne({ userId: userIdStr, fileKey }).lean();
    if (!doc?.data) return null;
    return deserializeAuthData(doc.data);
  };

  const removeData = async (file) => {
    const fileKey = fixFileName(file);
    await BaileysAuthKey.deleteOne({ userId: userIdStr, fileKey });
  };

  const creds = (await readData('creds.json')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}.json`);
              if (type === 'app-state-sync-key' && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const file = `${category}-${id}.json`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        }
      }
    },
    saveCreds: async () => writeData(creds, 'creds.json')
  };
};

const hasMongoAuthSession = async (userId) => {
  const userIdStr = userId.toString();
  const doc = await BaileysAuthKey.findOne({ userId: userIdStr, fileKey: 'creds.json' })
    .select('_id')
    .lean();
  return Boolean(doc);
};

const listMongoAuthUserIds = async () => {
  const userIds = await BaileysAuthKey.distinct('userId', { fileKey: 'creds.json' });
  return userIds.map(String);
};

const deleteMongoAuthSession = async (userId) => {
  const userIdStr = userId.toString();
  const result = await BaileysAuthKey.deleteMany({ userId: userIdStr });
  return result.deletedCount || 0;
};

const countMongoAuthKeys = async (userId) => {
  return BaileysAuthKey.countDocuments({ userId: userId.toString() });
};

const migrateLocalSessionToMongo = async (userId, localSessionDir) => {
  const userIdStr = userId.toString();

  if (await hasMongoAuthSession(userIdStr)) {
    return false;
  }

  if (!localSessionDir || !fs.existsSync(localSessionDir)) {
    return false;
  }

  const files = fs
    .readdirSync(localSessionDir)
    .filter((name) => name.endsWith('.json') && name !== 'picker-contacts.json');

  if (files.length === 0) {
    return false;
  }

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(localSessionDir, file), 'utf8');
      const data = JSON.parse(raw, BufferJSON.reviver);
      await BaileysAuthKey.findOneAndUpdate(
        { userId: userIdStr, fileKey: file },
        { data: serializeAuthData(data) },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn(`Skipped Baileys auth file ${file} during Mongo migration: ${err.message}`);
    }
  }

  console.log(
    `Migrated ${files.length} Baileys auth file(s) from disk to MongoDB for user ${userIdStr}`
  );
  return true;
};

module.exports = {
  useMongoDBAuthState,
  hasMongoAuthSession,
  listMongoAuthUserIds,
  deleteMongoAuthSession,
  countMongoAuthKeys,
  migrateLocalSessionToMongo
};
