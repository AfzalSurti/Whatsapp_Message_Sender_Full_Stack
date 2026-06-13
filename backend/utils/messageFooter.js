const normalizeFooter = (footer) => String(footer || '').trim();

const messageEndsWithFooter = (message, footer) => {
  const body = String(message || '').trimEnd();
  const foot = normalizeFooter(footer);
  if (!body || !foot) return false;
  return (
    body.endsWith(foot) ||
    body.endsWith(`\n\n${foot}`) ||
    body.endsWith(`\n\n_${foot}_`)
  );
};

const stripFooterFromBody = (message, footer) => {
  const body = String(message || '').trimEnd();
  const foot = normalizeFooter(footer);
  if (!foot || !body) return body;

  if (body.endsWith(`\n\n_${foot}_`)) {
    return body.slice(0, -(foot.length + 5)).trimEnd();
  }

  if (body.endsWith(`\n\n${foot}`)) {
    return body.slice(0, -(foot.length + 2)).trimEnd();
  }

  if (body.endsWith(foot)) {
    return body.slice(0, -foot.length).trimEnd();
  }

  return body;
};

const formatMessageForLog = (message, footer) => {
  const body = stripFooterFromBody(message, footer);
  const foot = normalizeFooter(footer);

  if (!foot) return body;
  if (!body) return foot;

  return `${body}\n\n${foot}`;
};

const getFooterSendOptions = (footer, baseOptions = {}) => {
  const foot = normalizeFooter(footer);
  if (!foot) return baseOptions;

  return {
    ...baseOptions,
    extra: {
      ...(baseOptions.extra || {}),
      footer: foot
    }
  };
};

const appendMessageFooter = (message, footer) => formatMessageForLog(message, footer);

const DEFAULT_FOOTER_SEPARATOR = '───────────────';

const resolveFooterBlock = (profile) => {
  if (!profile?.footerEnabled) return '';

  const footerText = String(profile?.footerText || profile?.businessName || '').trim();
  if (!footerText) return '';

  const separator =
    String(profile?.footerSeparator || DEFAULT_FOOTER_SEPARATOR).trim() ||
    DEFAULT_FOOTER_SEPARATOR;

  return `${separator}\n${footerText}`;
};

const resolveMessageFooter = resolveFooterBlock;

module.exports = {
  appendMessageFooter,
  formatMessageForLog,
  getFooterSendOptions,
  normalizeFooter,
  messageEndsWithFooter,
  stripFooterFromBody,
  resolveMessageFooter,
  resolveFooterBlock,
  DEFAULT_FOOTER_SEPARATOR
};
