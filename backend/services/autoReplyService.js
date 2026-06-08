const axios = require('axios');
const AutoReplyConfig = require('../models/AutoReplyConfig');
const AutoReplyLog = require('../models/AutoReplyLog');
const AITemplate = require('../models/AITemplate');
const ConversationState = require('../models/ConversationState');
const {
  isAutoReplyEligibleMessage,
  resolveMessageContact,
  isContactSelected
} = require('../utils/whatsappChat');

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
    .map(
      (template) =>
        `- ${template.name}: ${template.intentDescription}\n  Examples: ${(template.triggerExamples || []).join(', ') || 'none'}`
    )
    .join('\n');

  const prompt = `You are an intent detection system.
Analyze this message and conversation history.
Choose the most appropriate template or return 'none'.

Message: ${message}

Recent history:
${formatHistoryLines(history, 3) || 'No prior messages'}

Available templates:
${templateList}

Return ONLY the exact template name or 'none'.
No explanation.`;

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

const extractFieldValue = async (message, fieldName) => {
  if (!fieldName) return null;

  const prompt = `Extract the value for "${fieldName}" from this WhatsApp message.
Return ONLY the extracted value with no explanation.
If not present, return "none".

Message: ${message}`;

  const value = await callOpenRouter(prompt, {
    systemPrompt: 'You extract structured data from messages.',
    maxTokens: 80
  });

  const cleaned = value.trim().replace(/^["']|["']$/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'none') {
    return null;
  }

  return cleaned;
};

const advanceWorkflowStep = (state, template) => {
  const steps = template.workflowSteps || [];
  if (steps.length === 0) {
    state.isCompleted = true;
    return;
  }

  const currentStepData = steps[state.currentStep];
  if (currentStepData?.isLastStep || state.currentStep >= steps.length - 1) {
    state.isCompleted = true;
    return;
  }

  state.currentStep += 1;
};

const generateTemplateResponse = async (message, state, template) => {
  const steps = template.workflowSteps || [];
  const currentStepData = steps[state.currentStep] || steps[steps.length - 1] || null;
  const documentsText = (template.attachedDocuments || [])
    .map((doc) => `${doc.name}: ${doc.content}`)
    .join('\n');

  const prompt = `You are an AI assistant for a business.

Business Instructions: ${template.aiInstructions || 'Be helpful and professional.'}

Knowledge Base:
${template.knowledgeBase || 'No additional knowledge provided.'}

Attached Documents:
${documentsText || 'None'}

Escalation Rules:
${template.escalationRules || 'None'}

Current workflow step ${state.currentStep + 1}${currentStepData ? `: ${currentStepData.instruction}` : ''}

Field to collect at this step: ${currentStepData?.collectField || 'none'}

Collected information so far: ${JSON.stringify(state.collectedInfo || {})}

Conversation history:
${formatHistoryLines(state.conversationHistory, 10)}

User just said: ${message}

Generate a natural response following the workflow step.
If the user provides information for the requested field, acknowledge it naturally.
Keep the response concise and WhatsApp-friendly.
Do not use markdown formatting.`;

  const reply = await callOpenRouter(prompt, {
    systemPrompt: 'You follow business workflow steps in WhatsApp conversations.',
    maxTokens: 300
  });

  if (currentStepData?.collectField) {
    const extracted = await extractFieldValue(message, currentStepData.collectField);
    if (extracted) {
      state.collectedInfo = {
        ...(state.collectedInfo || {}),
        [currentStepData.collectField]: extracted
      };
    }
  }

  advanceWorkflowStep(state, template);
  return reply;
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

    console.log(
      `Auto-reply processing message from ${contactName || contactPhone}: "${incomingMessage.slice(0, 80)}"`
    );

    try {
      if (state.activeTemplateId) {
        const template = newlyActivatedTemplate || (await AITemplate.findById(state.activeTemplateId));

        if (!template) {
          state.activeTemplateId = null;
          reply = await generatePersonalityResponse(incomingMessage, state, config);
        } else if (newlyActivatedTemplate && template.initialMessage) {
          reply = template.initialMessage;
          if ((template.workflowSteps || []).length > 0) {
            advanceWorkflowStep(state, template);
          } else {
            state.isCompleted = true;
          }
        } else {
          reply = await generateTemplateResponse(incomingMessage, state, template);
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
