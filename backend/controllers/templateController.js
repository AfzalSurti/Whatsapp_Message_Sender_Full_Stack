const { validationResult } = require('express-validator');
const AITemplate = require('../models/AITemplate');
const ConversationState = require('../models/ConversationState');
const exampleAITemplate = require('../data/exampleAITemplate');
const {
  normalizeCustomFields,
  normalizeExampleConversations,
  normalizeSharedDocuments
} = require('../utils/aiTemplateHelpers');

const serializeTemplate = (template) => template.toObject ? template.toObject() : template;

const getTemplates = async (req, res) => {
  try {
    const templates = await AITemplate.find({ userId: req.user._id }).sort({
      priority: 1,
      createdAt: -1
    });

    res.json({ templates: templates.map(serializeTemplate) });
  } catch (err) {
    console.error('Get AI templates failed:', err.message);
    res.status(500).json({ error: 'Failed to load templates' });
  }
};

const getExampleTemplate = async (req, res) => {
  res.json({ template: exampleAITemplate });
};

const createTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, customFields, exampleConversations, aiAdvice, sharedDocuments, priority, isActive } =
      req.body;

    const normalizedFields = normalizeCustomFields(customFields);
    const missingValues = normalizedFields.filter((field) => !field.value);
    if (missingValues.length > 0) {
      return res.status(400).json({
        error: `Fill in values for: ${missingValues.map((field) => field.label).join(', ')}`
      });
    }

    const template = await AITemplate.create({
      userId: req.user._id,
      name: String(name).trim(),
      description: String(description).trim(),
      customFields: normalizedFields,
      exampleConversations: normalizeExampleConversations(exampleConversations),
      aiAdvice: String(aiAdvice || '').trim(),
      sharedDocuments: normalizeSharedDocuments(sharedDocuments),
      priority: Number(priority) || 1,
      isActive: isActive !== false
    });

    res.status(201).json({ template: serializeTemplate(template) });
  } catch (err) {
    console.error('Create AI template failed:', err.message);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = { ...req.body };

    if (updates.customFields !== undefined) {
      updates.customFields = normalizeCustomFields(updates.customFields);
      const missingValues = updates.customFields.filter((field) => !field.value);
      if (missingValues.length > 0) {
        return res.status(400).json({
          error: `Fill in values for: ${missingValues.map((field) => field.label).join(', ')}`
        });
      }
    }

    if (updates.exampleConversations !== undefined) {
      updates.exampleConversations = normalizeExampleConversations(updates.exampleConversations);
    }

    if (updates.sharedDocuments !== undefined) {
      updates.sharedDocuments = normalizeSharedDocuments(updates.sharedDocuments);
    }

    const template = await AITemplate.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: serializeTemplate(template) });
  } catch (err) {
    console.error('Update AI template failed:', err.message);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const template = await AITemplate.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await ConversationState.updateMany(
      { userId: req.user._id, activeTemplateId: template._id },
      { $set: { activeTemplateId: null, currentStep: 0, isCompleted: false } }
    );

    res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete AI template failed:', err.message);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

const toggleTemplate = async (req, res) => {
  try {
    const template = await AITemplate.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    template.isActive = !template.isActive;
    await template.save();

    res.json({ template: serializeTemplate(template) });
  } catch (err) {
    console.error('Toggle AI template failed:', err.message);
    res.status(500).json({ error: 'Failed to toggle template' });
  }
};

const getConversations = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const filter = { userId: req.user._id };

    if (req.query.search) {
      const search = String(req.query.search).trim();
      filter.$or = [
        { contactPhone: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } }
      ];
    }

    const [conversations, total] = await Promise.all([
      ConversationState.find(filter)
        .populate('activeTemplateId', 'name description')
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      ConversationState.countDocuments(filter)
    ]);

    res.json({
      conversations,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error('Get conversations failed:', err.message);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
};

const getConversation = async (req, res) => {
  try {
    const conversation = await ConversationState.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('activeTemplateId');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ conversation });
  } catch (err) {
    console.error('Get conversation failed:', err.message);
    res.status(500).json({ error: 'Failed to load conversation' });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const conversation = await ConversationState.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ message: 'Conversation deleted' });
  } catch (err) {
    console.error('Delete conversation failed:', err.message);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

const getLeads = async (req, res) => {
  try {
    const filter = {
      userId: req.user._id,
      collectedInfo: { $exists: true, $ne: {} }
    };

    if (req.query.templateId) {
      filter.activeTemplateId = req.query.templateId;
    }

    const leads = await ConversationState.find(filter)
      .populate('activeTemplateId', 'name')
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(500);

    const rows = leads.filter((lead) => Object.keys(lead.collectedInfo || {}).length > 0);

    res.json({ leads: rows, total: rows.length });
  } catch (err) {
    console.error('Get leads failed:', err.message);
    res.status(500).json({ error: 'Failed to load leads' });
  }
};

module.exports = {
  getTemplates,
  getExampleTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  toggleTemplate,
  getConversations,
  getConversation,
  deleteConversation,
  getLeads
};
