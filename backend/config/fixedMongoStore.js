const fs = require('fs');
const path = require('path');
const { MongoStore } = require('wwebjs-mongo');

const AUTH_DATA_PATH = path.join(__dirname, '..', '.wwebjs_auth');

class FixedMongoStore extends MongoStore {
  constructor({ mongoose, authDataPath = AUTH_DATA_PATH } = {}) {
    super({ mongoose });
    this.authDataPath = authDataPath;
  }

  getZipPath(sessionName) {
    return path.join(this.authDataPath, `${sessionName}.zip`);
  }

  async save(options) {
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

    const documents = await bucket.find({
      filename: `${options.session}.zip`
    }).toArray();

    if (documents.length > 1) {
      const oldSession = documents.reduce((a, b) =>
        a.uploadDate < b.uploadDate ? a : b
      );
      await bucket.delete(oldSession._id);
    }
  }
}

module.exports = FixedMongoStore;
module.exports.AUTH_DATA_PATH = AUTH_DATA_PATH;
