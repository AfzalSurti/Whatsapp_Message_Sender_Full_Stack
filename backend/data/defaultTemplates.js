module.exports = [
  {
    name: 'Eid Mubarak',
    description: 'Warm celebratory Eid greeting with offer integration. Available in English, Arabic & Urdu.',
    icon: '🌙',
    body: '🌙 Eid Mubarak, {{name}}!\n\nWishing you and your family a blessed and joyous Eid al-Adha filled with love, laughter, and prosperity.\n\nAs our cherished customer, we have a special Eid gift for you — {{offer_code}} for 25% off your next purchase! 🎁\n\nWith warm wishes,\nTeam BulkWA',
    tags: ['🕌 Eid', '3 Languages', 'Emojis'],
    category: 'eid',
    languages: ['English', 'Arabic', 'Urdu'],
    isSystem: true
  },
  {
    name: 'Diwali Celebration',
    description: 'Festival of lights greeting with discount offer. Hindi and English variants available.',
    icon: '🪔',
    body: '🪔 Happy Diwali, {{name}}!\n\nMay this festival of lights bring joy, prosperity, and success to you and your loved ones.\n\nCelebrate with our exclusive Diwali offer — use code {{offer_code}} for a special discount! ✨\n\nWarm regards,\nTeam BulkWA',
    tags: ['🪔 Diwali', '2 Languages'],
    category: 'diwali',
    languages: ['English', 'Hindi'],
    isSystem: true
  },
  {
    name: 'Birthday Wishes',
    description: 'Personalized birthday message with dynamic name. Ideal for contact birthday campaigns.',
    icon: '🎂',
    body: '🎂 Happy Birthday, {{name}}!\n\nWishing you a wonderful day filled with happiness and celebration. Thank you for being a valued part of our community.\n\nEnjoy your special day!\n\nBest wishes,\nTeam BulkWA',
    tags: ['🎉 Birthday', 'Auto', '{{name}}'],
    category: 'birthday',
    languages: ['English'],
    isSystem: true
  },
  {
    name: 'Flash Sale Alert',
    description: 'Urgent promotional message with countdown timer text and exclusive offer code.',
    icon: '⚡',
    body: '⚡ Flash Sale Alert, {{name}}!\n\nOur biggest sale ends soon — don\'t miss out on exclusive deals just for you.\n\nUse code {{offer_code}} before time runs out! 🛍️\n\nShop now,\nTeam BulkWA',
    tags: ['🛍️ Promo', 'Urgent'],
    category: 'promo',
    languages: ['English'],
    isSystem: true
  },
  {
    name: 'Payment Reminder',
    description: 'Polite invoice reminder with due date variable and payment link integration.',
    icon: '🔔',
    body: '🔔 Payment Reminder for {{name}}\n\nThis is a friendly reminder that your payment is due on {{due_date}}.\n\nPlease complete your payment at your earliest convenience. Reply to this message if you need assistance.\n\nThank you,\nTeam BulkWA',
    tags: ['⚠️ Reminder', '{{due_date}}'],
    category: 'reminder',
    languages: ['English'],
    isSystem: true
  }
];
