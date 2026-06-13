const normalizeFooter = (footer) => String(footer || '').trim();

const messageEndsWithFooter = (message, footer) => {
  const body = String(message || '').trimEnd();
  const foot = normalizeFooter(footer);
  if (!body || !foot) return false;
  return body.endsWith(foot) || body.endsWith(`\n\n${foot}`);
};

const appendMessageFooter = (message, footer) => {
  const body = String(message || '').trimEnd();
  const foot = normalizeFooter(footer);

  if (!foot) return body;
  if (!body) return foot;
  if (messageEndsWithFooter(body, foot)) return body;

  return `${body}\n\n${foot}`;
};

module.exports = {
  appendMessageFooter,
  normalizeFooter,
  messageEndsWithFooter
};
