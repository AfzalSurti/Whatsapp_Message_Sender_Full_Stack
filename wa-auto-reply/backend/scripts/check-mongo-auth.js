require('dotenv').config();
const mongoose = require('mongoose');
const BaileysAuthKey = require('../models/BaileysAuthKey');
const {
  hasMongoAuthSession,
  listMongoAuthUserIds,
  countMongoAuthKeys
} = require('../utils/baileysMongoAuth');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const userIds = await listMongoAuthUserIds();

  console.log(`MongoDB Baileys sessions found: ${userIds.length}`);

  for (const userId of userIds) {
    const keyCount = await countMongoAuthKeys(userId);
    const hasCreds = await hasMongoAuthSession(userId);
    console.log(`- user ${userId}: creds=${hasCreds}, keys=${keyCount}`);
  }

  const totalKeys = await BaileysAuthKey.countDocuments();
  console.log(`Total auth documents: ${totalKeys}`);

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
