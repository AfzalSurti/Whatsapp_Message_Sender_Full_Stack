require('dotenv').config();
const mongoose = require('mongoose');
const {
  repairLocalAuthDirectory,
  importLocalSessionToMongo
} = require('../utils/baileysMongoAuth');
const { getLegacyLocalSessionDir } = require('./baileysSessionPaths');

const userId = process.argv[2];

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  if (!userId) {
    console.error('Usage: node scripts/repair-whatsapp-auth.js <userId>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const legacyDir = getLegacyLocalSessionDir(userId);
  const repaired = await repairLocalAuthDirectory(legacyDir);
  const imported = await importLocalSessionToMongo(userId, legacyDir, { force: true });

  console.log(`Repaired local files: ${repaired}`);
  console.log(`Imported to MongoDB: ${imported}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
