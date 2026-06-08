export const TAG_CATEGORIES = [
  { id: 'religion', label: 'Religion' },
  { id: 'relationship', label: 'Relationship' },
  { id: 'gender', label: 'Gender' },
  { id: 'custom', label: 'Custom' }
];

export const getTagStyle = (tag, tagLibrary = []) => {
  const match = tagLibrary.find((item) => item.name === tag);
  const color = match?.color || '#25D366';
  return {
    color,
    borderColor: `${color}55`,
    backgroundColor: `${color}18`
  };
};

export const getInitials = (name = '', phone = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-2) || '?';
};

export const parseCsvContacts = (text) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const rows = [];
  const startIndex = lines[0].toLowerCase().includes('phone') ? 1 : 0;

  for (let i = startIndex; i < lines.length; i += 1) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < 2) continue;

    const [name, phone, ...tagParts] = parts;
    rows.push({
      name,
      phone,
      tags: tagParts.length > 0 ? tagParts.join(',').split(/[|;]/).map((t) => t.trim()).filter(Boolean) : []
    });
  }

  return rows;
};
