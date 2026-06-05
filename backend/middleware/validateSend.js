const { normalizePhoneList } = require('../utils/phone');

const MAX_MESSAGE_LENGTH = 4096;

const validateSendPayload = (req, res, next) => {
  const { numbers, message } = req.body;

  const phoneResult = normalizePhoneList(numbers);
  if (!phoneResult.valid) {
    return res.status(400).json({ error: phoneResult.error });
  }

  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` });
  }

  req.body.numbers = phoneResult.numbers;
  req.body.message = trimmedMessage;
  next();
};

module.exports = { validateSendPayload, MAX_MESSAGE_LENGTH };
