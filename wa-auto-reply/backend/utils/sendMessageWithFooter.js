const sendMessageWithFooter = async (client, chatId, message, _footer, options = {}) =>
  client.sendMessage(chatId, message, options);

const replyWithFooter = async (msg, message, _footer, chatId, options = {}) =>
  msg.reply(message, chatId, options);

module.exports = {
  sendMessageWithFooter,
  replyWithFooter
};
