module.exports = {
  name: 'Welcome & Business Intro',
  description:
    'Use when someone sends a greeting like Hi, Hello, or Hey. Introduce the business warmly and ask how you can help.',
  customFields: [
    {
      key: 'business_name',
      label: 'Business Name',
      value: 'Aliasgar Training Institute'
    }
  ],
  exampleConversations: [
    {
      userMessage: 'Hi',
      botReply:
        'Hello! Thank you for reaching out to {{business_name}}. How can I help you today?',
      mediaFiles: []
    },
    {
      userMessage: 'Hello',
      botReply:
        'Hi there! Welcome to {{business_name}}. Are you looking for course details, fees, or admission help?',
      mediaFiles: []
    },
    {
      userMessage: 'Send brochure',
      botReply:
        'Sure! Here is our brochure for {{business_name}}. Let me know if you want help choosing a program.',
      mediaFiles: []
    }
  ],
  aiAdvice:
    'Reply like a real human on WhatsApp. Keep messages short (1-3 lines). Be warm and helpful. Use the business name naturally. If the user asks for brochure, details, or syllabus, share the matching document when available. Do not use markdown or bullet lists.',
  sharedDocuments: [],
  priority: 1,
  isActive: true,
  isExample: true
};
