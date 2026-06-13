const {
  normalizeFooter,
  stripFooterFromBody,
  formatMessageForLog
} = require('./messageFooter');

const sendMessageWithFooter = async (client, chatId, message, footer, options = {}) => {
  const foot = normalizeFooter(footer);
  const body = stripFooterFromBody(message, foot);
  const text = foot ? formatMessageForLog(body, foot) : body;

  return client.sendMessage(chatId, text, options);
};

const replyWithFooter = async (msg, message, footer, chatId, options = {}) => {
  const foot = normalizeFooter(footer);
  const body = stripFooterFromBody(message, foot);
  const text = foot ? formatMessageForLog(body, foot) : body;

  return msg.reply(text, chatId, options);
};

module.exports = {
  sendMessageWithFooter,
  replyWithFooter
};
