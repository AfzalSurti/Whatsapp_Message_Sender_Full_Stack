const axios = require('axios');
const AutoReplyConfig = require('../models/AutoReplyConfig');
const AutoReplyLog = require('../models/AutoReplyLog');
const { normalizePhoneNumber } = require('../utils/phone');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const extractPhoneFromJid = (jid) => String(jid || '').split('@')[0].replace(/\D/g, '');

const phonesMatch = (jid, storedPhone) => {
  const jidDigits = extractPhoneFromJid(jid);
  const storedDigits = String(storedPhone || '').replace(/\D/g, '');

  if (!jidDigits || !storedDigits) return false;

  return (
    jidDigits === storedDigits ||
    jidDigits.endsWith(storedDigits) ||
    storedDigits.endsWith(jidDigits)
  );
};

const resolveContactPhone = (jid) => {
  const digits = extractPhoneFromJid(jid);
  if (!digits) return digits;

  const normalized = normalizePhoneNumber(digits.startsWith('+') ? digits : `+${digits}`);
  return normalized?.e164 || `+${digits}`;
};

const requestAIReply = async ({ systemPrompt, messages }) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured');
  }

  if (!process.env.MODEL_NAME) {
    throw new Error('AI model name is not configured');
  }

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.MODEL_NAME,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 300
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned an empty response');
  }

  return content.trim();
};

const buildConversationMessages = (recentLogs, incomingMessage) => {
  const historyMessages = [];

  for (const log of recentLogs) {
    if (log.incomingMessage) {
      historyMessages.push({ role: 'user', content: log.incomingMessage });
    }
    if (log.aiReply && log.status === 'sent') {
      historyMessages.push({ role: 'assistant', content: log.aiReply });
    }
  }

  historyMessages.push({ role: 'user', content: incomingMessage });
  return historyMessages;
};

const buildStoredHistory = (recentLogs, incomingMessage, aiReply) => {
  const latestLog = recentLogs[recentLogs.length - 1];
  const previousHistory = latestLog?.conversationHistory || [];

  return [
    ...previousHistory,
    { role: 'user', content: incomingMessage, timestamp: new Date() },
    { role: 'assistant', content: aiReply, timestamp: new Date() }
  ].slice(-40);
};

const saveAutoReplyLog = async ({
  userId,
  contactPhone,
  contactName,
  incomingMessage,
  aiReply,
  status,
  failReason = '',
  conversationHistory = []
}) => {
  return AutoReplyLog.create({
    userId,
    contactPhone,
    contactName,
    incomingMessage,
    aiReply,
    status,
    failReason,
    conversationHistory
  });
};

const handleIncomingMessage = async (client, userId, msg) => {
  try {
    if (msg.fromMe) return;
    if (msg.isGroupMsg) return;

    const incomingMessage = String(msg.body || '').trim();
    if (!incomingMessage) return;

    const config = await AutoReplyConfig.findOne({ userId });
    if (!config || !config.isEnabled) return;

    const contactPhone = resolveContactPhone(msg.from);
    if (!contactPhone) return;

    if (config.mode === 'selected') {
      const isSelected = (config.selectedContacts || []).some((phone) =>
        phonesMatch(msg.from, phone)
      );

      if (!isSelected) return;
    }

    let contactName = '';
    try {
      const contact = await msg.getContact();
      contactName = contact.pushname || contact.name || contact.shortName || '';
    } catch (err) {
      console.warn(`Could not resolve contact name for auto-reply: ${err.message}`);
    }

    const recentLogs = await AutoReplyLog.find({
      userId,
      contactPhone
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    recentLogs.reverse();

    const aiMessages = buildConversationMessages(recentLogs, incomingMessage);
    let aiReply = '';

    try {
      aiReply = await requestAIReply({
        systemPrompt: config.systemPrompt,
        messages: aiMessages
      });
    } catch (err) {
      console.error(`Auto-reply AI failed for user ${userId}:`, err.message);
      await saveAutoReplyLog({
        userId,
        contactPhone,
        contactName,
        incomingMessage,
        aiReply: '',
        status: 'failed',
        failReason: err.message,
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, '')
      });
      return;
    }

    await sleep(config.delay || 2000);

    try {
      await client.sendMessage(msg.from, aiReply);

      await saveAutoReplyLog({
        userId,
        contactPhone,
        contactName,
        incomingMessage,
        aiReply,
        status: 'sent',
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, aiReply)
      });
    } catch (err) {
      console.error(`Auto-reply send failed for user ${userId}:`, err.message);
      await saveAutoReplyLog({
        userId,
        contactPhone,
        contactName,
        incomingMessage,
        aiReply,
        status: 'failed',
        failReason: err.message,
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, aiReply)
      });
    }
  } catch (err) {
    console.error(`Auto-reply handler error for user ${userId}:`, err.message);
  }
};

module.exports = {
  handleIncomingMessage,
  extractPhoneFromJid,
  phonesMatch,
  resolveContactPhone
};
