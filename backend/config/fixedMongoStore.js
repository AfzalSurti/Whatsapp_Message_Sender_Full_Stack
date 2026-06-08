const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoStore } = require('wwebjs-mongo');

// Runtime-only temp folder for Puppeteer while a client is active.
// Persistent WhatsApp auth is stored in MongoDB via FixedMongoStore — not here.
const AUTH_DATA_PATH = process.env.WHATSAPP_AUTH_TEMP_PATH
  || path.join(os.tmpdir(), 'wa-sender-whatsapp-auth');

const saveChains = new Map();

const ensureAuthTempDir = () => {
  if (!fs.existsSync(AUTH_DATA_PATH)) {
    fs.mkdirSync(AUTH_DATA_PATH, { recursive: true });
  }
};

ensureAuthTempDir();

const isMissingGridFsFileError = (err) =>
  /file not found/i.test(String(err?.message || '')) || err?.code === 'ENOENT';

class FixedMongoStore extends MongoStore {
  constructor({ mongoose, authDataPath = AUTH_DATA_PATH } = {}) {
    super({ mongoose });
    this.authDataPath = authDataPath;
  }

  getZipPath(sessionName) {
    return path.join(this.authDataPath, `${sessionName}.zip`);
  }

  async save(options) {
    const session = options.session;
    const previous = saveChains.get(session) || Promise.resolve();

    const current = previous
      .catch(() => {})
      .then(() => this._saveInternal(options));

    saveChains.set(session, current);

    try {
      await current;
    } finally {
      if (saveChains.get(session) === current) {
        saveChains.delete(session);
      }
    }
  }

  async _saveInternal(options) {
    const zipPath = this.getZipPath(options.session);

    if (!fs.existsSync(zipPath)) {
      throw new Error(`Session zip not found at ${zipPath}`);
    }

    const bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
      bucketName: `whatsapp-${options.session}`
    });

    await new Promise((resolve, reject) => {
      fs.createReadStream(zipPath)
        .pipe(bucket.openUploadStream(`${options.session}.zip`))
        .on('error', (err) => reject(err))
        .on('close', () => resolve());
    });

    try {
      const documents = await bucket.find({
        filename: `${options.session}.zip`
      }).toArray();

      if (documents.length <= 1) return;

      const sorted = documents.sort(
        (a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)
      );
      const staleDocuments = sorted.slice(1);

      for (const doc of staleDocuments) {
        try {
          await bucket.delete(doc._id);
        } catch (err) {
          if (!isMissingGridFsFileError(err)) {
            console.warn(
              `Could not delete old WhatsApp session file ${doc._id}: ${err.message}`
            );
          }
        }
      }
    } catch (err) {
      console.warn(`Could not prune old WhatsApp session files: ${err.message}`);
    }
  }
}

module.exports = FixedMongoStore;
module.exports.AUTH_DATA_PATH = AUTH_DATA_PATH;
module.exports.ensureAuthTempDir = ensureAuthTempDir;
