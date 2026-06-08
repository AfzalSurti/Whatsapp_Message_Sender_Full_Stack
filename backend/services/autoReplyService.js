const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const AutoReplyConfig = require('../models/AutoReplyConfig');
const AutoReplyLog = require('../models/AutoReplyLog');
const AITemplate = require('../models/AITemplate');
const ConversationState = require('../models/ConversationState');
const {
  isAutoReplyEligibleMessage,
  resolveMessageContact,
  isContactSelected
} = require('../utils/whatsappChat');
const {
  buildPlaceholderMap,
  applyPlaceholders,
  formatExampleConversations,
  formatCustomFields,
  matchSharedDocuments,
  parseDataUrl
} = require('../utils/aiTemplateHelpers');

const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp assistant. Reply naturally and concisely.';

const MAX_HISTORY = 40;

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

const callOpenRouter = async (userPrompt, { systemPrompt = 'You are a helpful assistant.', maxTokens = 300 } = {}) => {
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
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens
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

const formatHistoryLines = (history = [], limit = 10) =>
  history
    .slice(-limit)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`)
    .join('\n');

const detectIntent = async (message, history, templates) => {
  if (!templates.length) return null;

  const templateList = templates
    .map((template) => {
      const userExamples = (template.exampleConversations || [])
        .map((item) => item.userMessage)
        .filter(Boolean)
        .join(', ');
      return `- ${template.name}: ${template.description}\n  User examples: ${userExamples || 'none'}`;
    })
    .join('\n');

  const prompt = `You are an intent detection system.
Pick the best matching template for this WhatsApp message, using template name, description, and user examples.

Message: ${message}

Recent history:
${formatHistoryLines(history, 3) || 'No prior messages'}

Templates:
${templateList}

Return ONLY the exact template name or 'none'.`;

  const response = await callOpenRouter(prompt, {
    systemPrompt: 'You classify user intent into predefined template names. Return only the template name or none.',
    maxTokens: 60
  });

  const normalized = response.trim().replace(/^["']|["']$/g, '');
  if (!normalized || normalized.toLowerCase() === 'none') {
    return null;
  }

  const matched = templates.find(
    (template) => template.name.trim().toLowerCase() === normalized.toLowerCase()
  );

  return matched || null;
};

const findExampleMatch = (message, examples = []) => {
  const normalized = String(message || '').trim().toLowerCase();
  if (!normalized) return null;

  const exact = examples.find(
    (item) => String(item.userMessage || '').trim().toLowerCase() === normalized
  );
  if (exact) return exact;

  return (
    examples.find((item) => {
      const sample = String(item.userMessage || '').trim().toLowerCase();
      return sample && (normalized.includes(sample) || sample.includes(normalized));
    }) || null
  );
};

const sendMediaFiles = async (client, chatId, files = [], placeholderMap = {}) => {
  for (const file of files) {
    const parsed = parseDataUrl(file.dataUrl);
    if (!parsed) continue;

    try {
      const media = new MessageMedia(parsed.mimeType, parsed.base64, file.name || 'file');
      const caption = applyPlaceholders(file.caption || '', placeholderMap);
      await client.sendMessage(chatId, media, caption ? { caption } : undefined);
    } catch (err) {
      console.warn(`Failed to send media ${file.name}: ${err.message}`);
    }
  }
};

const collectMediaToSend = (message, template, exampleMatch = null) => {
  const files = [];
  const seen = new Set();

  const addFile = (file) => {
    if (!file?.dataUrl || seen.has(file.dataUrl)) return;
    seen.add(file.dataUrl);
    files.push(file);
  };

  if (exampleMatch?.mediaFiles?.length) {
    exampleMatch.mediaFiles.forEach(addFile);
  }

  matchSharedDocuments(message, template.sharedDocuments || []).forEach((doc) => {
    addFile({
      name: doc.name,
      mimeType: doc.mimeType,
      dataUrl: doc.dataUrl,
      caption: doc.caption
    });
  });

  return files;
};

const generateTemplateResponse = async (message, state, template) => {
  const placeholderMap = {
    ...buildPlaceholderMap(template),
    ...(state.collectedInfo || {})
  };

  const exampleMatch = findExampleMatch(message, template.exampleConversations || []);
  if (exampleMatch?.botReply) {
    return applyPlaceholders(exampleMatch.botReply, placeholderMap);
  }

  const prompt = `You are a WhatsApp assistant for a business.

Template name: ${template.name}
What this template is for: ${template.description}

Business details:
${formatCustomFields(template.customFields || [])}

Advice for how you should reply:
${template.aiAdvice || 'Be helpful, warm, and concise.'}

Example conversations to follow:
${formatExampleConversations(template.exampleConversations || [], placeholderMap) || 'No examples provided.'}

Shared files you may send when user asks (keywords):
${(template.sharedDocuments || [])
  .map((doc) => `- ${doc.name}: keywords ${(doc.keywords || []).join(', ')}`)
  .join('\n') || 'None'}

Current conversation:
${formatHistoryLines(state.conversationHistory, 12)}

User just said: ${message}

Write the next bot reply only.
Keep it WhatsApp-friendly, 1-3 short lines, no markdown.
Use placeholders only if their values are already known.`;

  const reply = await callOpenRouter(prompt, {
    systemPrompt: 'You handle WhatsApp customer conversations using the provided template.',
    maxTokens: 300
  });

  return applyPlaceholders(reply, placeholderMap);
};

const generatePersonalityResponse = async (message, state, config) => {
  const systemPrompt = resolveSystemPrompt(config);
  const historyMessages = state.conversationHistory
    .slice(-10)
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' : 'user',
      content: entry.content
    }));

  historyMessages.push({ role: 'user', content: message });

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.MODEL_NAME,
      messages: [{ role: 'system', content: systemPrompt }, ...historyMessages],
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

const trimHistory = (history = []) => history.slice(-MAX_HISTORY);

const handleIncomingMessage = async (client, userId, msg) => {
  let contactPhone = '';
  let contactName = '';
  let chatId = '';
  let sourceMessageId = '';

  try {
    if (!isAutoReplyEligibleMessage(msg)) return;

    const incomingMessage = String(msg.body || '').trim();
    if (!incomingMessage) return;

    sourceMessageId = getMessageId(msg);
    if (await isMessageAlreadyHandled(userId, sourceMessageId)) {
      return;
    }

    const config = await AutoReplyConfig.findOne({ userId });
    if (!config?.isEnabled) return;

    const resolved = await resolveMessageContact(msg);
    chatId = resolved.chatId;
    contactName = resolved.contactName;
    contactPhone = resolved.contactPhone || chatId;
    if (!chatId) return;

    if (config.mode === 'selected') {
      const allowed = isContactSelected(config.selectedContacts, chatId, contactPhone);
      if (!allowed) {
        await AutoReplyLog.create({
          userId,
          contactPhone,
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

    let state = await ConversationState.findOne({ userId, contactPhone: chatId });
    if (!state) {
      state = new ConversationState({
        userId,
        contactPhone: chatId,
        contactName,
        conversationHistory: [],
        collectedInfo: {}
      });
    }

    if (contactName && state.contactName !== contactName) {
      state.contactName = contactName;
    }

    const now = new Date();
    state.conversationHistory.push({ role: 'user', content: incomingMessage, timestamp: now });
    state.conversationHistory = trimHistory(state.conversationHistory);

    if (state.isCompleted) {
      state.activeTemplateId = null;
      state.currentStep = 0;
      state.collectedInfo = {};
      state.isCompleted = false;
      state.intentDetectedAt = null;
    }

    let newlyActivatedTemplate = null;

    if (!state.activeTemplateId) {
      const templates = await AITemplate.find({ userId, isActive: true }).sort({ priority: 1 });
      if (templates.length > 0) {
        newlyActivatedTemplate = await detectIntent(
          incomingMessage,
          state.conversationHistory,
          templates
        );

        if (newlyActivatedTemplate) {
          state.activeTemplateId = newlyActivatedTemplate._id;
          state.currentStep = 0;
          state.isCompleted = false;
          state.collectedInfo = {};
          state.intentDetectedAt = now;
        }
      }
    }

    let reply = '';
    let mediaFiles = [];

    console.log(
      `Auto-reply processing message from ${contactName || contactPhone}: "${incomingMessage.slice(0, 80)}"`
    );

    try {
      if (state.activeTemplateId) {
        const template = newlyActivatedTemplate || (await AITemplate.findById(state.activeTemplateId));

        if (!template) {
          state.activeTemplateId = null;
          reply = await generatePersonalityResponse(incomingMessage, state, config);
        } else {
          const placeholderMap = buildPlaceholderMap(template);
          const exampleMatch = findExampleMatch(incomingMessage, template.exampleConversations || []);
          reply = await generateTemplateResponse(incomingMessage, state, template);
          mediaFiles = collectMediaToSend(incomingMessage, template, exampleMatch);
          state.collectedInfo = { ...placeholderMap, ...(state.collectedInfo || {}) };
        }
      } else {
        reply = await generatePersonalityResponse(incomingMessage, state, config);
      }
    } catch (err) {
      console.error(`Auto-reply AI failed for user ${userId}:`, err.message);
      await AutoReplyLog.create({
        userId,
        contactPhone,
        contactName,
        incomingMessage,
        aiReply: '',
        status: 'failed',
        sourceMessageId,
        failReason: err.message,
        conversationHistory: state.conversationHistory
      });
      return;
    }

    await sleep(config.delay || 2000);

    try {
      await sendWhatsAppReply(client, msg, chatId, reply);

      if (state.activeTemplateId && mediaFiles.length > 0) {
        const template = await AITemplate.findById(state.activeTemplateId);
        const placeholderMap = {
          ...buildPlaceholderMap(template || {}),
          ...(state.collectedInfo || {})
        };
        await sendMediaFiles(client, chatId, mediaFiles, placeholderMap);
      }

      console.log(`Auto-reply sent to ${contactPhone}`);
    } catch (err) {
      console.error(`Auto-reply send failed for user ${userId}:`, err.message);
      await AutoReplyLog.create({
        userId,
        contactPhone,
        contactName,
        incomingMessage,
        aiReply: reply,
        status: 'failed',
        sourceMessageId,
        failReason: err.message,
        conversationHistory: state.conversationHistory
      });
      return;
    }

    state.conversationHistory.push({ role: 'assistant', content: reply, timestamp: new Date() });
    state.conversationHistory = trimHistory(state.conversationHistory);
    state.lastMessageAt = new Date();
    await state.save();

    await AutoReplyLog.create({
      userId,
      contactPhone,
      contactName,
      incomingMessage,
      aiReply: reply,
      status: 'sent',
      sourceMessageId,
      conversationHistory: state.conversationHistory
    });
  } catch (err) {
    console.error(`Auto-reply handler error for user ${userId}:`, err.message);
  }
};

module.exports = {
  handleIncomingMessage
};
