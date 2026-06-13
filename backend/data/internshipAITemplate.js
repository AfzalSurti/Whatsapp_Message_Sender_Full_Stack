module.exports = {
  slug: 'internship',
  name: 'Internship Inquiry',
  description:
    'Use when someone asks about internship, industrial training, stipend, duration, eligibility, domains, or how to apply.',
  customFields: [
    {
      key: 'institute_name',
      label: 'Institute Name',
      value: 'Aliasgar Training Institute'
    },
    {
      key: 'internship_duration',
      label: 'Internship Duration',
      value: '3 to 6 months'
    },
    {
      key: 'stipend_info',
      label: 'Stipend Info',
      value: 'Performance-based stipend for selected candidates'
    },
    {
      key: 'apply_link',
      label: 'Application Link',
      value: 'https://aliasgartraining.com/internship'
    },
    {
      key: 'contact_phone',
      label: 'Contact Phone',
      value: '+91 98765 43210'
    }
  ],
  exampleConversations: [
    {
      userMessage: 'Do you offer internship?',
      botReply:
        'Yes! {{institute_name}} offers internships for {{internship_duration}}. May I know your name and which course or technology you are interested in?',
      mediaFiles: []
    },
    {
      userMessage: 'Internship details',
      botReply:
        'Our internship program at {{institute_name}} includes hands-on project work, mentor support, and certificate on completion. Duration: {{internship_duration}}. Stipend: {{stipend_info}}. Which field are you interested in — Web, Python, or Digital Marketing?',
      mediaFiles: []
    },
    {
      userMessage: 'How to apply for internship?',
      botReply:
        'You can apply here: {{apply_link}}\n\nOr share your name, qualification, and preferred technology — our team will call you on {{contact_phone}}.',
      mediaFiles: []
    },
    {
      userMessage: 'Is stipend available?',
      botReply:
        'Yes — {{stipend_info}} at {{institute_name}}. Final amount depends on skills and project performance. Would you like to know the eligibility criteria?',
      mediaFiles: []
    },
    {
      userMessage: 'I need intership details',
      botReply:
        'Sure! At {{institute_name}} we offer {{internship_duration}} internships. Stipend: {{stipend_info}}. Which technology are you interested in?',
      mediaFiles: []
    },
    {
      userMessage: 'what type of internship you provide',
      botReply:
        'At {{institute_name}} we offer internships in Web Development, Python, and Digital Marketing for {{internship_duration}}. Stipend: {{stipend_info}}. Tell me your qualification and I will suggest the best track.',
      mediaFiles: []
    },
    {
      userMessage: 'I am a BCA student looking for internship',
      botReply:
        'Great! BCA students are welcome at {{institute_name}}. We have openings in web development and Python. Internship duration is {{internship_duration}}. Please share your passing year and city so we can guide you better.',
      mediaFiles: []
    }
  ],
  aiAdvice:
    'Reply like a helpful admissions counsellor on WhatsApp. Keep answers short (2-4 lines). Ask one follow-up question when useful (name, course, qualification, city). Use institute details naturally. If they want to apply, share the application link. Collect lead info when they show interest. No markdown or bullet lists.',
  sharedDocuments: [],
  priority: 2,
  isActive: true,
  isExample: true
};
