const fs = require('fs');
const path = require('path');
const { Mutex } = require('async-mutex');
const {
  useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const { proto } = require('@whiskeysockets/baileys/WAProto');
const {
  initAuthCreds: initAuthCredsUtil,
  makeCacheableSignalKeyStore,
  addTransactionCapability
} = require('@whiskeysockets/baileys/lib/Utils/auth-utils');
const { BufferJSON } = require('@whiskeysockets/baileys/lib/Utils/generics');
const BaileysAuthKey = require('../models/BaileysAuthKey');
const { getLegacyLocalSessionDir } = require('./baileysSessionPaths');

const keyLocks = new Map();
const credsSaveChains = new Map();

const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

const parseAuthJson = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return null;

  try {
    return JSON.parse(text, BufferJSON.reviver);
  } catch {
    let depth = 0;
    let end = -1;

    for (let i = 0; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}') {
        depth -= 1;
        if (depth === 0) end = i;
      }
    }

    if (end > 0) {
      return JSON.parse(text.slice(0, end + 1), BufferJSON.reviver);
    }

    throw new Error('Could not repair auth JSON');
  }
};

const serializeAuthData = (data) => JSON.parse(JSON.stringify(data, BufferJSON.replacer));

const deserializeAuthData = (data) => JSON.parse(JSON.stringify(data), BufferJSON.reviver);

const getKeyLock = (lockKey) => {
  let mutex = keyLocks.get(lockKey);
  if (!mutex) {
    mutex = new Mutex();
    keyLocks.set(lockKey, mutex);
  }
  return mutex;
};

const queueCredsSave = (userIdStr, saveCreds) => {
  const previous = credsSaveChains.get(userIdStr) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(() => saveCreds());

  credsSaveChains.set(userIdStr, current);
  return current;
};

const buildKeyStore = (rawStore, logger) =>
  makeCacheableSignalKeyStore(
    addTransactionCapability(rawStore, logger, {
      maxCommitRetries: 5,
      delayBetweenTriesMs: 250
    }),
    logger
  );

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

  const creds = (await readData('creds.json')) || initAuthCredsUtil();

  const rawKeys = {
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
      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const file = `${category}-${id}.json`;
          if (value) await writeData(value, file);
          else await removeData(file);
        }
      }
    }
  };

  const saveCreds = async () => writeData(creds, 'creds.json');

  return {
    state: {
      creds,
      keys: rawKeys
    },
    saveCreds: () => queueCredsSave(userIdStr, saveCreds)
  };
};

const repairLocalAuthDirectory = async (sessionDir) => {
  if (!sessionDir || !fs.existsSync(sessionDir)) return 0;

  let repaired = 0;

  for (const file of fs.readdirSync(sessionDir)) {
    if (!file.endsWith('.json') || file === 'picker-contacts.json') continue;

    const filePath = path.join(sessionDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = parseAuthJson(raw);
      const normalized = JSON.stringify(parsed, BufferJSON.replacer);
      if (normalized !== raw.trim()) {
        fs.writeFileSync(filePath, normalized);
        repaired += 1;
      }
    } catch (err) {
      console.warn(`Could not repair local auth file ${file}: ${err.message}`);
    }
  }

  if (repaired > 0) {
    console.log(`Repaired ${repaired} local Baileys auth file(s) in ${sessionDir}`);
  }

  return repaired;
};

const countLocalAuthFiles = (sessionDir) => {
  if (!sessionDir || !fs.existsSync(sessionDir)) return 0;
  return fs
    .readdirSync(sessionDir)
    .filter((name) => name.endsWith('.json') && name !== 'picker-contacts.json').length;
};

const importLocalSessionToMongo = async (userId, localSessionDir, { force = false } = {}) => {
  const userIdStr = userId.toString();

  if (!localSessionDir || !fs.existsSync(localSessionDir)) {
    return 0;
  }

  const localCount = countLocalAuthFiles(localSessionDir);
  const mongoCount = await BaileysAuthKey.countDocuments({ userId: userIdStr });

  if (!force && mongoCount >= localCount && mongoCount > 0) {
    return 0;
  }

  if (force && mongoCount > 0) {
    await BaileysAuthKey.deleteMany({ userId: userIdStr });
  }

  let imported = 0;
  const files = fs
    .readdirSync(localSessionDir)
    .filter((name) => name.endsWith('.json') && name !== 'picker-contacts.json');

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(localSessionDir, file), 'utf8');
      const data = parseAuthJson(raw);
      await BaileysAuthKey.findOneAndUpdate(
        { userId: userIdStr, fileKey: file },
        { data: serializeAuthData(data) },
        { upsert: true, setDefaultsOnInsert: true }
      );
      imported += 1;
    } catch (err) {
      console.warn(`Skipped Baileys auth file ${file} during Mongo import: ${err.message}`);
    }
  }

  if (imported > 0) {
    console.log(
      `Imported ${imported} Baileys auth file(s) from disk to MongoDB for user ${userIdStr}`
    );
  }

  return imported;
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

const countMongoAuthKeys = async (userId) =>
  BaileysAuthKey.countDocuments({ userId: userId.toString() });

const migrateLocalSessionToMongo = async (userId, localSessionDir) =>
  importLocalSessionToMongo(userId, localSessionDir, { force: false });

const createBaileysAuthState = async (userId, logger) => {
  const userIdStr = userId.toString();
  const legacySessionDir = getLegacyLocalSessionDir(userId);
  const authStore = String(process.env.WHATSAPP_AUTH_STORE || 'disk').toLowerCase();

  if (authStore === 'mongo') {
    await repairLocalAuthDirectory(legacySessionDir);
    await importLocalSessionToMongo(userId, legacySessionDir, {
      force: process.env.WHATSAPP_AUTH_REPAIR === 'true'
    });

    const { state, saveCreds } = await useMongoDBAuthState(userId);
    console.log(`Using Baileys MongoDB session storage for user ${userIdStr}`);

    return {
      auth: {
        creds: state.creds,
        keys: buildKeyStore(state.keys, logger)
      },
      saveCreds
    };
  }

  await repairLocalAuthDirectory(legacySessionDir);
  fs.mkdirSync(legacySessionDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(legacySessionDir);
  console.log(`Using Baileys disk session storage for user ${userIdStr}`);

  return {
    auth: {
      creds: state.creds,
      keys: buildKeyStore(state.keys, logger)
    },
    saveCreds: () => queueCredsSave(userIdStr, saveCreds)
  };
};

module.exports = {
  createBaileysAuthState,
  useMongoDBAuthState,
  hasMongoAuthSession,
  listMongoAuthUserIds,
  deleteMongoAuthSession,
  countMongoAuthKeys,
  migrateLocalSessionToMongo,
  importLocalSessionToMongo,
  repairLocalAuthDirectory,
  parseAuthJson
};
