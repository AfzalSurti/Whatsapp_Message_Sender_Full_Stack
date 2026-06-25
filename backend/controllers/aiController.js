const axios = require('axios');
const { validationResult } = require('express-validator');

const LANGUAGE_RANGES = {
  Gujarati: /[\u0A80-\u0AFF]/,
  Hindi: /[\u0900-\u097F]/,
};

const hasRequiredLanguageScript = (message, language) => {
  const range = LANGUAGE_RANGES[language];
  if (!range) return true;
  return range.test(message);
};

const PRESET_GUIDANCE = {
  best: {
    label: 'Best Overall',
    description: 'Balanced, high-converting WhatsApp copy for promotions, reminders, follow-ups, updates, and support.',
    instruction: 'Optimise for clarity, warmth, trust, and conversion. Write a message that feels human, specific, and useful even when the campaign goal is broad or underspecified. Prefer one strong hook, one clear benefit, and one direct call to action. Keep it concise and easy to scan on mobile.'
  },
  sales: {
    label: 'Sales / Promo',
    description: 'Focused on offers, urgency, and conversion.',
    instruction: 'Optimise for response and conversion. Highlight the offer early, keep urgency natural, and end with a clear call to action.'
  },
  reminder: {
    label: 'Reminder',
    description: 'Useful for bookings, payments, and follow-ups.',
    instruction: 'Optimise for clarity and action. Be polite, direct, and include exactly what the user needs to do next.'
  },
  support: {
    label: 'Support / Update',
    description: 'Good for service updates and customer care.',
    instruction: 'Optimise for reassurance and clarity. Keep the tone calm, helpful, and specific. Avoid sales language unless requested.'
  },
  festival: {
    label: 'Festival / Event',
    description: 'Good for greetings, seasonal offers, and event announcements.',
    instruction: 'Optimise for a warm, celebratory tone while still including a practical reason to act or reply.'
  }
};

const buildUserPrompt = ({
  preset,
  prompt,
  tone,
  language,
  festival,
  audience,
  guidance,
  mode,
  currentMessage
}) => {
  const selectedPreset = PRESET_GUIDANCE[preset] || PRESET_GUIDANCE.best;

  const languageInstruction = (() => {
    if (!language) return null;
    if (language === 'Gujarati') {
      return 'Output language rule: Write the final message in Gujarati script only. Do not write the message in English or English transliteration. Keep placeholders like {{name}} unchanged.';
    }
    if (language === 'Hindi') {
      return 'Output language rule: Write the final message in Hindi using Devanagari script only. Do not write the message in English or English transliteration. Keep placeholders like {{name}} unchanged.';
    }
    if (language === 'English + Urdu') {
      return 'Output language rule: Write the final message in a natural English + Urdu mix. Keep placeholders like {{name}} unchanged.';
    }
    return `Output language rule: Write the final message in ${language}. Keep placeholders like {{name}} unchanged.`;
  })();

  const contextLines = [
    `Preset: ${selectedPreset.label}`,
    selectedPreset.description,
    selectedPreset.instruction,
    prompt ? `Message goal: ${prompt}` : 'Message goal: Generate a useful WhatsApp campaign message from the selected preset fields. Include a clear call to action.',
    tone ? `Tone: ${tone}` : null,
    language ? `Selected language: ${language}` : null,
    languageInstruction,
    festival ? `Festival/context: ${festival}` : null,
    audience ? `Audience: ${audience}` : null,
    guidance ? `Extra user guidance: ${guidance}` : null,
  ].filter(Boolean).join('\n');

  if (mode === 'rewrite') {
    return `Rewrite this WhatsApp message using the context below.\n\nCurrent message:\n${currentMessage}\n\nContext:\n${contextLines}`;
  }

  if (mode === 'shorten') {
    return `Shorten this WhatsApp message while keeping the main meaning and call to action.\n\nCurrent message:\n${currentMessage}\n\nContext:\n${contextLines}`;
  }

  if (mode === 'translate') {
    return `Translate/adapt this WhatsApp message to ${language || 'the selected language'} while keeping it natural.\n\nCurrent message:\n${currentMessage}\n\nContext:\n${contextLines}`;
  }

  return `Generate one WhatsApp message only.\n\n${contextLines}`;
};

const requestAIMessage = async ({ systemPrompt, userPrompt }) => {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 220
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );
  console.log(response?.data)

  return response.data.choices[0].message.content.trim();
};

const generateAIMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      preset = 'best',
      prompt,
      tone,
      language,
      festival,
      audience,
      guidance,
      mode = 'generate',
      currentMessage
    } = req.body;

    if (mode !== 'generate' && !currentMessage) {
      return res.status(400).json({ error: 'Current message is required' });
    }

    const systemPrompt = `You are a WhatsApp message writer.
Write short, natural, conversational WhatsApp messages.
No long paragraphs. No stiff formal language unless the requested tone is formal.
Max 3-4 lines per message. Direct and friendly tone.
Support festival-specific personalization, multi-tone writing, and multi-language output.
Optimise for broad-purpose WhatsApp campaigns by default: promotions, reminders, follow-ups, announcements, reactivation, support, and event messages.
Always make the result sound human, useful, and action-oriented.
Follow the selected output language exactly. This is mandatory.
If Gujarati is selected, the message must be in Gujarati script, not English transliteration.
If Hindi is selected, the message must be in Devanagari script, not English.
Use variables like {{name}}, {{business_name}}, {{shop}}, or {{city}} only when helpful.
Return only the requested message content. No explanation, no quotes.`;

    const userPrompt = buildUserPrompt({
      preset,
      prompt,
      tone,
      language,
      festival,
      audience,
      guidance,
      mode,
      currentMessage
    });

    let message = await requestAIMessage({ systemPrompt, userPrompt });

    if (!hasRequiredLanguageScript(message, language)) {
      message = await requestAIMessage({
        systemPrompt,
        userPrompt: `The previous answer used the wrong language/script.\n\nRewrite the message below in ${language} only.\nDo not use English words except unchanged placeholders like {{name}} or brand names.\nReturn one WhatsApp message only.\n\nWrong message:\n${message}\n\nOriginal request:\n${userPrompt}`
      });
    }

    if (!hasRequiredLanguageScript(message, language)) {
      return res.status(502).json({
        error: `AI did not return ${language} text. Please try again.`
      });
    }

    res.json({ message });
  } catch (err) {
    console.error('AI generation failed:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  generateAIMessage,
  buildUserPrompt,
  hasRequiredLanguageScript
};
