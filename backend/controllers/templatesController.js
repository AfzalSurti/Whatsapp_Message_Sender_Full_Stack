const { validationResult } = require('express-validator');
const MessageTemplate = require('../models/MessageTemplate');
const defaultTemplates = require('../data/defaultTemplates');
const { extractVariables, validateTemplateBody } = require('../utils/template');

const ensureSystemTemplates = async () => {
  for (const template of defaultTemplates) {
    await MessageTemplate.findOneAndUpdate(
      { isSystem: true, name: template.name },
      { $setOnInsert: { ...template, userId: null } },
      { upsert: true, new: true }
    );
  }
};

const serializeTemplate = (template) => ({
  ...template.toObject(),
  variables: extractVariables(template.body)
});

const getTemplates = async (req, res) => {
  try {
    await ensureSystemTemplates();

    const [systemTemplates, userTemplates] = await Promise.all([
      MessageTemplate.find({ isSystem: true }).sort({ createdAt: 1 }),
      MessageTemplate.find({ userId: req.user._id, isSystem: false }).sort({ updatedAt: -1 })
    ]);

    res.json({
      templates: [...systemTemplates, ...userTemplates].map(serializeTemplate)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await MessageTemplate.findOne({
      _id: id,
      $or: [{ isSystem: true }, { userId: req.user._id }]
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template: serializeTemplate(template) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, icon, body, tags, category, languages } = req.body;
    const bodyCheck = validateTemplateBody(body);
    if (!bodyCheck.valid) {
      return res.status(400).json({ error: bodyCheck.error });
    }

    const template = await MessageTemplate.create({
      userId: req.user._id,
      name: name.trim(),
      description: (description || '').trim(),
      icon: icon || '📋',
      body: body.trim(),
      tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      category: category || 'custom',
      languages: Array.isArray(languages) ? languages.map((lang) => String(lang).trim()).filter(Boolean) : [],
      isSystem: false
    });

    res.status(201).json({ template: serializeTemplate(template) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const template = await MessageTemplate.findOne({
      _id: id,
      userId: req.user._id,
      isSystem: false
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or cannot be edited' });
    }

    const { name, description, icon, body, tags, category, languages } = req.body;

    if (body !== undefined) {
      const bodyCheck = validateTemplateBody(body);
      if (!bodyCheck.valid) {
        return res.status(400).json({ error: bodyCheck.error });
      }
      template.body = body.trim();
    }

    if (name !== undefined) template.name = name.trim();
    if (description !== undefined) template.description = description.trim();
    if (icon !== undefined) template.icon = icon || '📋';
    if (tags !== undefined) {
      template.tags = Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
    }
    if (category !== undefined) template.category = category;
    if (languages !== undefined) {
      template.languages = Array.isArray(languages) ? languages.map((lang) => String(lang).trim()).filter(Boolean) : [];
    }

    await template.save();
    res.json({ template: serializeTemplate(template) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await MessageTemplate.findOne({
      _id: id,
      userId: req.user._id,
      isSystem: false
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    }

    await MessageTemplate.findByIdAndDelete(id);
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
