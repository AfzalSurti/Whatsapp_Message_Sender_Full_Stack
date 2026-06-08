const axios = require('axios');
const AutoReplyConfig = require('../models/AutoReplyConfig');
const AutoReplyLog = require('../models/AutoReplyLog');
const {
  isAutoReplyEligibleMessage,
  resolveMessageContact,
  isContactSelected
} = require('../utils/whatsappChat');

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp assistant. Reply naturally and concisely.';

const resolveSystemPrompt = (config) => {
  const prompt = String(config?.systemPrompt || '').trim();
  return prompt || DEFAULT_SYSTEM_PROMPT;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getMessageId = (msg) => String(msg?.id?._serialized || msg?.id?.id || '').trim();

const isMessageAlreadyHandled = async (userId, sourceMessageId) => {
  if (!sourceMessageId) return false;
  const existing = await AutoReplyLog.findOne({ userId, sourceMessageId }).lean();
  return Boolean(existing);
};

const sendWhatsAppReply = async (client, msg, chatId, aiReply) => {
  try {
    const sentMsg = await msg.reply(aiReply);
    if (sentMsg?.id?._serialized) return sentMsg;
  } catch (err) {
    console.warn(`msg.reply failed, trying sendMessage: ${err.message}`);
  }

  const sentMsg = await client.sendMessage(chatId, aiReply);
  if (!sentMsg?.id?._serialized) {
    throw new Error('WhatsApp did not confirm the message was sent');
  }

  return sentMsg;
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
  sourceMessageId = '',
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
    sourceMessageId,
    conversationHistory
  });
};

const findRecentLogs = async (userId, contactPhone, chatId) => {
  const keys = [...new Set([contactPhone, chatId].filter(Boolean))];

  return AutoReplyLog.find({
    userId,
    contactPhone: { $in: keys }
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
};

const handleIncomingMessage = async (client, userId, msg) => {
  try {
    if (!isAutoReplyEligibleMessage(msg)) return;

    const incomingMessage = String(msg.body || '').trim();
    if (!incomingMessage) return;

    const sourceMessageId = getMessageId(msg);
    if (await isMessageAlreadyHandled(userId, sourceMessageId)) {
      return;
    }

    const config = await AutoReplyConfig.findOne({ userId });
    if (!config || !config.isEnabled) {
      return;
    }

    const { chatId, contactName, contactPhone } = await resolveMessageContact(msg);
    if (!chatId) return;

    if (config.mode === 'selected') {
      const allowed = isContactSelected(config.selectedContacts, chatId, contactPhone);
      if (!allowed) {
        console.log(
          `Auto-reply skipped (not selected): chatId=${chatId} phone=${contactPhone} selected=${JSON.stringify(config.selectedContacts || [])}`
        );
        await saveAutoReplyLog({
          userId,
          contactPhone: contactPhone || chatId,
          contactName,
          incomingMessage,
          aiReply: '',
          status: 'skipped',
          sourceMessageId,
          failReason: 'Contact not in your selected list. Add this number or switch to All Messages.'
        });
        return;
      }
    }

    const recentLogs = await findRecentLogs(userId, contactPhone, chatId);
    recentLogs.reverse();

    const systemPrompt = resolveSystemPrompt(config);
    const aiMessages = buildConversationMessages(recentLogs, incomingMessage);
    let aiReply = '';

    console.log(
      `Auto-reply processing message from ${contactName || contactPhone || chatId}: "${incomingMessage.slice(0, 80)}"`
    );

    try {
      aiReply = await requestAIReply({
        systemPrompt,
        messages: aiMessages
      });
    } catch (err) {
      console.error(`Auto-reply AI failed for user ${userId}:`, err.message);
      await saveAutoReplyLog({
        userId,
        contactPhone: contactPhone || chatId,
        contactName,
        incomingMessage,
        aiReply: '',
        status: 'failed',
        sourceMessageId,
        failReason: err.message,
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, '')
      });
      return;
    }

    await sleep(config.delay || 2000);

    try {
      await sendWhatsAppReply(client, msg, chatId, aiReply);

      console.log(`Auto-reply sent to ${contactPhone || chatId}`);

      await saveAutoReplyLog({
        userId,
        contactPhone: contactPhone || chatId,
        contactName,
        incomingMessage,
        aiReply,
        status: 'sent',
        sourceMessageId,
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, aiReply)
      });
    } catch (err) {
      console.error(`Auto-reply send failed for user ${userId}:`, err.message);
      await saveAutoReplyLog({
        userId,
        contactPhone: contactPhone || chatId,
        contactName,
        incomingMessage,
        aiReply,
        status: 'failed',
        sourceMessageId,
        failReason: err.message,
        conversationHistory: buildStoredHistory(recentLogs, incomingMessage, aiReply)
      });
    }
  } catch (err) {
    console.error(`Auto-reply handler error for user ${userId}:`, err.message);
  }
};

module.exports = {
  handleIncomingMessage
};
