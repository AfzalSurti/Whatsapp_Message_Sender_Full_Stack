const MessageLog = require('../models/MessageLog');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { appendMessageFooter } = require('../utils/messageFooter');

// ─── SEND MESSAGES ────────────────────────────────────────────
// client — WhatsApp client for this user
// userId — for logging to MongoDB
// numbers — array of phone numbers
// message — message to send
// onProgress — callback to send live updates to frontend
const normalizeRecipients = (numbersOrRecipients, message) => {
  if (
    Array.isArray(numbersOrRecipients) &&
    numbersOrRecipients.length > 0 &&
    typeof numbersOrRecipients[0] === 'object' &&
    numbersOrRecipients[0]?.phone
  ) {
    return numbersOrRecipients.map((item) => ({
      phone: item.phone,
      message: item.message || message
    }));
  }

  return numbersOrRecipients.map((phone) => ({
    phone,
    message
  }));
};

const sendMessages = async (client, userId, numbersOrRecipients, message, onProgress) => {
  const recipients = normalizeRecipients(numbersOrRecipients, message);
  const baseMessage = recipients[0]?.message || message || '';

  const user = await User.findById(userId).select('messageFooter name').lean();
  const messageFooter = user?.messageFooter?.trim() || user?.name?.trim() || '';

  // Create campaign record in MongoDB
  const campaign = await Campaign.create({
    userId,
    message: baseMessage,
    totalNumbers: recipients.length,
    status: 'running'
  });

  const results = { sent: 0, failed: 0, skipped: 0 };

  // Wait a moment to ensure client is fully ready
  await sleep(1000);

  for (let i = 0; i < recipients.length; i++) {
    const { phone: rawNumber, message: recipientMessage } = recipients[i];
    const messageWithFooter = appendMessageFooter(recipientMessage, messageFooter);

    try {
      // Clean number — remove all non-digits
      const cleanNumber = rawNumber.replace(/\D/g, '');

      // Validate length
      if (cleanNumber.length < 10) {
        results.skipped++;
        await logMessage(userId, campaign._id, rawNumber, recipientMessage, 'skipped', 'Invalid number');
        continue;
      }

      const whatsappId = `${cleanNumber}@c.us`;

      // Make message unique per number (to avoid WhatsApp duplicate detection)
      const uniqueMessage = messageWithFooter + '\u200B'.repeat(i + 1);

      // Send message with retry logic
      let retries = 0;
      const maxRetries = 2;
      let sent = false;

      while (retries <= maxRetries && !sent) {
        try {
          await client.sendMessage(whatsappId, uniqueMessage);
          sent = true;
          results.sent++;
          await logMessage(userId, campaign._id, rawNumber, messageWithFooter, 'sent', null);
          console.log(`✅ Message sent to ${rawNumber}`);
        } catch (err) {
          retries++;
          console.error(`❌ Failed to send to ${rawNumber} (attempt ${retries}/${maxRetries + 1}):`, err.message);
          if (retries > maxRetries) {
            throw err;
          }
          console.warn(`Retrying in 2 seconds...`);
          await sleep(2000); // Wait before retry
        }
      }

    } catch (err) {
      results.failed++;
      await logMessage(userId, campaign._id, rawNumber, messageWithFooter, 'failed', err.message);
    }

    // Send live progress to frontend via WebSocket
    onProgress({
      current: i + 1,
      total: recipients.length,
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