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
  slugifyKey
};
