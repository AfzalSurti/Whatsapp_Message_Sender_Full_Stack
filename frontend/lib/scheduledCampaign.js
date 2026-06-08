export const formatCampaignDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return (
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ` at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
  );
};

export const getCampaignStatusBadge = (status) => {
  const badges = {
    pending: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Pending' },
    running: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Running' },
    completed: { bg: 'bg-[#25D366]/10', border: 'border-[#25D366]/30', text: 'text-[#25D366]', label: 'Completed' },
    failed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Failed' },
    cancelled: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Cancelled' }
  };
  return badges[status] || badges.pending;
};

export const AI_TONES = [
  'Friendly', 'Formal', 'Persuasive', 'Urgent', 'Promotional',
  'Informative', 'Conversational', 'Professional', 'Casual', 'Other'
];

export const AI_LANGUAGES = [
  'English', 'Hindi', 'Gujarati', 'Urdu', 'Spanish',
  'Tamil', 'Telugu', 'English + Urdu', 'Other'
];

export const AI_FESTIVALS = [
  'General', 'Diwali', 'Eid al-Fitr', 'New Year', 'Holi',
  'Christmas', 'Ramadan', 'Black Friday', 'Other'
];

export const AI_AUDIENCES = [
  'Customers', 'VIP Clients', 'Leads', 'Referral', 'Lapsed Customers',
  'New Subscribers', 'Local Shoppers', 'Other'
];

export const AI_PRESETS = [
  {
    value: 'best',
    label: 'Best Overall',
    description: 'Balanced, high-converting copy for promos, reminders, updates, follow-ups, and support.'
  },
  {
    value: 'sales',
    label: 'Sales / Promo',
    description: 'Sharper offer-first messaging for promotions and conversions.'
  },
  {
    value: 'reminder',
    label: 'Reminder',
    description: 'Cleaner, direct messaging for bookings, payments, and follow-ups.'
  },
  {
    value: 'support',
    label: 'Support / Update',
    description: 'Helpful, calm messaging for service notices and customer care.'
  }
];
