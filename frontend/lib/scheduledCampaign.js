export const WIZARD_STEPS = [
  { id: 1, label: 'Message Source' },
  { id: 2, label: 'Audience' },
  { id: 3, label: 'Message' },
  { id: 4, label: 'Schedule' },
  { id: 5, label: 'Review' }
];

export const CAMPAIGN_TYPES = [
  { id: 'festival', label: 'Festival Wishes', subtitle: 'Eid, Diwali, Christmas', icon: '⭐', category: 'eid' },
  { id: 'birthday', label: 'Birthday Campaign', subtitle: 'Auto-personalized greetings', icon: '🎂', category: 'birthday' },
  { id: 'promo', label: 'Promotional Blast', subtitle: 'Offers & announcements', icon: '⚡', category: 'promo' },
  { id: 'followup', label: 'Follow-up Series', subtitle: 'Lead nurturing sequences', icon: '💬', category: 'custom' },
  { id: 'reminder', label: 'Reminder', subtitle: 'Payments, appointments', icon: '⏰', category: 'reminder' },
  { id: 'reengagement', label: 'Re-engagement', subtitle: 'Win back inactive contacts', icon: '🎯', category: 'custom' }
];

export const TEMPLATE_CATEGORIES = [
  { value: 'custom', label: 'Custom' },
  { value: 'eid', label: 'Eid' },
  { value: 'diwali', label: 'Diwali' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'promo', label: 'Promo' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'ai', label: 'AI Generated' }
];

export const SCHEDULE_MODES = [
  { id: 'now', label: 'Send Now', subtitle: 'Start immediately after launch', icon: 'send' },
  { id: 'later', label: 'Schedule for Later', subtitle: 'Pick a specific date and time', icon: 'calendar' }
];

export const getMinScheduleDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getMinScheduleTime = (scheduleDate) => {
  if (scheduleDate !== getMinScheduleDate()) return '';

  const minTime = new Date(Date.now() + 2 * 60 * 1000);
  const hours = String(minTime.getHours()).padStart(2, '0');
  const minutes = String(minTime.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

export const getRecurrenceOptions = (anchorDate) => {
  const d = anchorDate ? new Date(`${anchorDate}T12:00:00`) : new Date();
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = d.getDate();
  const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return [
    { id: 'none', label: 'Does not repeat' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: `Weekly on ${dayName}` },
    { id: 'monthly', label: `Monthly on day ${dayNum}` },
    { id: 'annually', label: `Annually on ${monthDay}` },
    { id: 'custom', label: 'Custom' }
  ];
};

export const getRecurrenceLabel = (pattern, anchorDate) => {
  if (!pattern || pattern === 'none') return null;
  const options = getRecurrenceOptions(anchorDate);
  return options.find((o) => o.id === pattern)?.label || pattern;
};

export const SENDING_SPEEDS = [
  { id: 'safe', label: 'Safe (30–60s delay)', description: 'Safe mode uses randomized 30–60s delays to protect your WhatsApp account.' },
  { id: 'normal', label: 'Normal (15–30s delay)', description: 'Balanced speed with moderate delays between messages.' },
  { id: 'fast', label: 'Fast (5–15s delay)', description: 'Faster delivery with shorter delays. Use with caution.' }
];

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
