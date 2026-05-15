const MessageLog = require('../models/MessageLog');
const Campaign = require('../models/Campaign');

// ─── SEND MESSAGES ────────────────────────────────────────────
// client — WhatsApp client for this user
// userId — for logging to MongoDB
// numbers — array of phone numbers
// message — message to send
// onProgress — callback to send live updates to frontend
const sendMessages = async (client, userId, numbers, message, onProgress) => {

  // Create campaign record in MongoDB
  const campaign = await Campaign.create({
    userId,
    message,
    totalNumbers: numbers.length,
    status: 'running'
  });

  const results = { sent: 0, failed: 0, skipped: 0 };

  for (let i = 0; i < numbers.length; i++) {
    const rawNumber = numbers[i];

    try {
      // Clean number — remove all non-digits
      const cleanNumber = rawNumber.replace(/\D/g, '');

      // Validate length
      if (cleanNumber.length < 10) {
        results.skipped++;
        await logMessage(userId, campaign._id, rawNumber, message, 'skipped', 'Invalid number');
        continue;
      }

      const whatsappId = `${cleanNumber}@c.us`;

      // Check if number is on WhatsApp
      const isRegistered = await client.isRegisteredUser(whatsappId);
      if (!isRegistered) {
        results.skipped++;
        await logMessage(userId, campaign._id, rawNumber, message, 'skipped', 'Not on WhatsApp');
        continue;
      }

      // Make message unique per number
      const uniqueMessage = message + '\u200B'.repeat(i + 1);

      // Send message
      await client.sendMessage(whatsappId, uniqueMessage);
      results.sent++;
      await logMessage(userId, campaign._id, rawNumber, message, 'sent', null);

    } catch (err) {
      results.failed++;
      await logMessage(userId, campaign._id, rawNumber, message, 'failed', err.message);
    }

    // Send live progress to frontend via WebSocket
    onProgress({
      current: i + 1,
      total: numbers.length,
      sent: results.sent,
      failed: results.failed,
      skipped: results.skipped,
      currentNumber: rawNumber
    });

    // Random delay between messages
    const delay = Math.floor(Math.random() * 3000) + 5000;
    await sleep(delay);
  }

  // Update campaign as completed
  await Campaign.findByIdAndUpdate(campaign._id, {
    ...results,
    status: 'completed'
  });

  return results;
};

// ─── LOG MESSAGE TO MONGODB ───────────────────────────────────
const logMessage = async (userId, campaignId, number, message, status, failReason) => {
  await MessageLog.create({
    userId,
    campaignId,
    number,
    message,
    status,
    failReason
  });
};

// ─── SLEEP ────────────────────────────────────────────────────
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { sendMessages };