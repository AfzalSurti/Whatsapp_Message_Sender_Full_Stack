const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g;

const slugifyKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeCustomFields = (fields = []) => {
  if (!Array.isArray(fields)) return [];

  return fields
    .map((field) => {
      const label = String(field.label || field.key || '').trim();
      const key = slugifyKey(field.key || label);
      return {
        key,
        label: label || key,
        value: String(field.value || '').trim()
      };
    })
    .filter((field) => field.key);
};

const normalizeExampleConversations = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      userMessage: String(item.userMessage || '').trim(),
      botReply: String(item.botReply || '').trim(),
      mediaFiles: Array.isArray(item.mediaFiles)
        ? item.mediaFiles.map((file) => ({
            name: String(file.name || '').trim(),
            mimeType: String(file.mimeType || '').trim(),
            dataUrl: String(file.dataUrl || ''),
            caption: String(file.caption || '').trim()
          }))
        : []
    }))
    .filter((item) => item.userMessage || item.botReply);
};

const normalizeSharedDocuments = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: String(item.name || '').trim(),
      keywords: Array.isArray(item.keywords)
        ? item.keywords.map((kw) => String(kw).trim().toLowerCase()).filter(Boolean)
        : String(item.keywords || '')
            .split(',')
            .map((kw) => kw.trim().toLowerCase())
            .filter(Boolean),
      mimeType: String(item.mimeType || '').trim(),
      dataUrl: String(item.dataUrl || ''),
      caption: String(item.caption || '').trim()
    }))
    .filter((item) => item.name && item.dataUrl);
};

const buildPlaceholderMap = (template = {}) => {
  const map = {};

  for (const field of template.customFields || []) {
    if (field.key) {
      map[field.key] = field.value || '';
    }
  }

  return map;
};

const applyPlaceholders = (text = '', placeholderMap = {}) =>
  String(text).replace(PLACEHOLDER_REGEX, (match, key) => {
    const value = placeholderMap[key];
    return value !== undefined && value !== '' ? value : match;
  });

const formatExampleConversations = (examples = [], placeholderMap = {}) =>
  examples
    .map((example, index) => {
      const userLine = applyPlaceholders(example.userMessage, placeholderMap);
      const botLine = applyPlaceholders(example.botReply, placeholderMap);
      const mediaNote =
        example.mediaFiles?.length > 0
          ? ` (bot may also send: ${example.mediaFiles.map((f) => f.name).join(', ')})`
          : '';
      return `Example ${index + 1}:\nUser: ${userLine}\nBot: ${botLine}${mediaNote}`;
    })
    .join('\n\n');

const formatCustomFields = (fields = []) =>
  fields.length === 0
    ? 'None'
    : fields.map((field) => `- ${field.label || field.key}: ${field.value || '(not set)'}`).join('\n');

const matchSharedDocuments = (message = '', documents = []) => {
  const lower = String(message).toLowerCase();
  return (documents || []).filter((doc) =>
    (doc.keywords || []).some((keyword) => keyword && lower.includes(keyword))
  );
};

const parseDataUrl = (dataUrl = '') => {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeMessageForMatching = (message = '') =>
  String(message)
    .trim()
    .toLowerCase()
    .replace(/\bintership\b/g, 'internship');

const findExampleMatch = (message, examples = []) => {
  const normalized = normalizeMessageForMatching(message);
  if (!normalized) return null;

  const exact = examples.find(
    (item) => String(item.userMessage || '').trim().toLowerCase() === normalized
  );
  if (exact) return exact;

  return (
    examples.find((item) => {
      const sample = String(item.userMessage || '').trim().toLowerCase();
      if (!sample) return false;

      if (sample.length <= 5) {
        return new RegExp(`\\b${escapeRegex(sample)}\\b`, 'i').test(normalized);
      }

      if (normalized.includes(sample)) return true;
      if (sample.length >= 12 && sample.includes(normalized)) return true;

      return false;
    }) || null
  );
};

const extractTemplateTerms = (template) => {
  const terms = new Set();

  String(template.name || '')
    .toLowerCase()
    .match(/\b[a-z]{4,}\b/g)
    ?.forEach((word) => terms.add(word));

  String(template.description || '')
    .toLowerCase()
    .match(/\b[a-z]{4,}\b/g)
    ?.forEach((word) => terms.add(word));

  for (const example of template.exampleConversations || []) {
    const userMessage = String(example.userMessage || '').trim().toLowerCase();
    if (userMessage.length >= 4) terms.add(userMessage);
    userMessage
      .match(/\b[a-z]{4,}\b/g)
      ?.forEach((word) => terms.add(word));
  }

  return Array.from(terms);
};

const matchTemplateLocally = (message, templates = []) => {
  const text = normalizeMessageForMatching(message);
  if (!text || !templates.length) return null;

  let best = null;
  let bestScore = 0;

  for (const template of templates) {
    let score = 0;

    for (const example of template.exampleConversations || []) {
      const sample = String(example.userMessage || '').trim().toLowerCase();
      if (!sample) continue;
      if (text === sample) return template;
      if (sample.length >= 6 && text.includes(sample)) score += sample.length * 2;
      if (sample.length >= 6 && sample.includes(text)) score += text.length * 2;
    }

    for (const term of extractTemplateTerms(template)) {
      if (term.length < 4) continue;
      if (text.includes(term)) score += term.length;
      if (term.length >= 6 && new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(text)) {
        score += term.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return bestScore >= 8 ? best : null;
};

module.exports = {
  normalizeCustomFields,
  normalizeExampleConversations,
  normalizeSharedDocuments,
  buildPlaceholderMap,
  applyPlaceholders,
  formatExampleConversations,
  formatCustomFields,
  matchSharedDocuments,
  parseDataUrl,
  findExampleMatch,
  matchTemplateLocally,
  slugifyKey
};
