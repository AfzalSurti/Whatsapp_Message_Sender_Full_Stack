const axios = require('axios');

// ─── GENERATE AI MESSAGE ──────────────────────────────────────
const generateAIMessage = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // System prompt — forces AI to write natural WhatsApp messages
    const systemPrompt = `You are a WhatsApp message writer.
Write short, natural, conversational WhatsApp messages.
No long paragraphs. No formal language.
Max 3-4 lines. Direct and friendly tone.
Understand the mood — festive, urgent, emotional, professional — match it naturally.
Return only the message — no explanation, no quotes.`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: process.env.MODEL_NAME,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const message = response.data.choices[0].message.content.trim();
    res.json({ message });

  } catch (err) {
    console.error('AI generation failed:', err.message);
    res.status(500).json({ error: 'AI generation failed. Try again.' });
  }
};

module.exports = { generateAIMessage };