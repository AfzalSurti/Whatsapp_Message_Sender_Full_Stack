require('dotenv').config();
const mongoose = require('mongoose');
const { migrateLocalSessionToMongo } = require('../utils/baileysMongoAuth');
const { getLegacyLocalSessionDir } = require('../utils/whatsappSession');

const userId = process.argv[2];

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  if (!userId) {
    console.error('Usage: node scripts/migrate-local-auth-to-mongo.js <userId>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const legacyDir = getLegacyLocalSessionDir(userId);
  const migrated = await migrateLocalSessionToMongo(userId, legacyDir);

  console.log(
    migrated
      ? `Migration complete for user ${userId}`
      : `Nothing to migrate for user ${userId} (already in MongoDB or no local folder)`
  );

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
