'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Loader2, Sparkles, X } from 'lucide-react';
import { aiAPI, templatesAPI } from '@/lib/api';
import { extractVariables, getMissingTemplateDefaults, getTemplateDefaultVariables, variableLabel } from '@/lib/template';

const CATEGORIES = [
  { value: 'custom', label: 'Custom' },
  { value: 'eid', label: 'Eid' },
  { value: 'diwali', label: 'Diwali' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'promo', label: 'Promo' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'ai', label: 'AI Generated' }
];

export default function CreateTemplateModal({
  open,
  onClose,
  onSaved,
  initialTemplate = null,
  startWithAi = false
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📋');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [category, setCategory] = useState('custom');
  const [languagesInput, setLanguagesInput] = useState('English');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(startWithAi);
  const [defaultVariables, setDefaultVariables] = useState({});

  useEffect(() => {
    if (!open) return;

    if (initialTemplate) {
      setName(initialTemplate.name || '');
      setDescription(initialTemplate.description || '');
      setIcon(initialTemplate.icon || '📋');
      setBody(initialTemplate.body || '');
      setTagsInput((initialTemplate.tags || []).join(', '));
      setCategory(initialTemplate.category || 'custom');
      setLanguagesInput((initialTemplate.languages || ['English']).join(', '));
      setDefaultVariables(initialTemplate.defaultVariables || {});
      setShowAiPanel(false);
    } else {
      setName('');
      setDescription('');
      setIcon('📋');
      setBody('');
      setTagsInput('');
      setCategory(startWithAi ? 'ai' : 'custom');
      setLanguagesInput('English');
      setAiPrompt('');
      setDefaultVariables({});
      setShowAiPanel(startWithAi);
    }
  }, [open, initialTemplate, startWithAi]);

  if (!open) return null;

  const variables = extractVariables(body);
  const defaultVariableFields = getTemplateDefaultVariables(body);
  const missingDefaults = getMissingTemplateDefaults(body, defaultVariables);

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Describe the template you want to create');
      return;
    }

    setAiLoading(true);
    try {
      const res = await aiAPI.generate({
        preset: 'best',
        prompt: aiPrompt,
        tone: 'Friendly',
        language: languagesInput.split(',')[0]?.trim() || 'English',
        festival: 'General',
        audience: 'Customers',
        guidance: 'Create a reusable WhatsApp template. You may include {{name}}, {{offer_code}}, {{due_date}}, or {{link}} when useful.'
      });

      setBody(res.data.message);
      if (!name.trim()) {
        setName('AI Template');
      }
      setCategory('ai');
      if (!tagsInput.trim()) {
        setTagsInput('AI Builder');
      }
      toast.success('Template draft generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Enter a template name');
      return;
    }
    if (!body.trim()) {
      toast.error('Enter template message');
      return;
    }

    if (missingDefaults.length > 0) {
      toast.error(
        `Set default values for: ${missingDefaults.map((v) => `{{${v}}}`).join(', ')}`
      );
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim() || '📋',
      body: body.trim(),
      tags: tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean),
      category,
      languages: languagesInput.split(',').map((lang) => lang.trim()).filter(Boolean),
      defaultVariables
    };

    setSaving(true);
    try {
      const res = initialTemplate
        ? await templatesAPI.updateTemplate(initialTemplate._id, payload)
        : await templatesAPI.createTemplate(payload);

      toast.success(initialTemplate ? 'Template updated' : 'Template created');
      onSaved?.(res.data.template);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111814] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#111814] z-10">
          <div>
            <h3 className="font-bold text-lg text-white">
              {initialTemplate ? 'Edit Template' : 'Create Template'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Allowed variables: {'{{name}}'}, {'{{phone}}'}, {'{{segment}}'}, {'{{due_date}}'}, {'{{offer_code}}'}, {'{{city}}'}, {'{{link}}'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors cursor-pointer" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Icon</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={4}
                className="w-full px-3 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-center text-xl text-white focus:outline-none focus:border-[#25D366]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Template Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Eid Mubarak Offer"
                className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary for your template library"
              className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Tags</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Promo, Emojis, VIP"
                className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Languages</label>
            <input
              type="text"
              value={languagesInput}
              onChange={(e) => setLanguagesInput(e.target.value)}
              placeholder="English, Hindi"
              className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
            />
          </div>

          <div className="bg-[#0a0f0d] border border-white/10 rounded-xl p-4">
            <button
              type="button"
              onClick={() => setShowAiPanel((prev) => !prev)}
              className="w-full flex items-center justify-between text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-violet-400" />
                <span className="text-sm font-medium text-gray-200">Generate with AI</span>
              </div>
              <span className="text-xs text-[#25D366]">{showAiPanel ? 'Hide' : 'Show'}</span>
            </button>

            {showAiPanel && (
              <div className="space-y-3 mt-4">
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  placeholder='Describe your template, e.g. "Friendly Eid greeting with offer code placeholder"'
                  className="w-full px-4 py-3 bg-[#111814] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] resize-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateAi}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 text-violet-200 font-semibold py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  {aiLoading ? 'Generating...' : 'Generate Template Draft'}
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Write your reusable message template..."
              className="w-full px-4 py-3 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">{body.length} characters</p>
              {variables.length > 0 && (
                <p className="text-xs text-violet-300">
                  Variables: {variables.map((v) => `{{${v}}}`).join(', ')}
                </p>
              )}
            </div>
          </div>

          {defaultVariableFields.length > 0 && (
            <div className="bg-[#0a0f0d] border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-amber-300">Default variable values</p>
                <p className="text-xs text-gray-500 mt-1">
                  Set these now. They will auto-fill when you use this template in campaigns.
                </p>
              </div>
              {defaultVariableFields.map((variable) => (
                <div key={variable}>
                  <label className="text-xs text-gray-400 block mb-1.5">
                    {variableLabel(variable)} ({`{{${variable}}}`}) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={defaultVariables[variable] || ''}
                    onChange={(e) =>
                      setDefaultVariables((prev) => ({
                        ...prev,
                        [variable]: e.target.value
                      }))
                    }
                    placeholder={`Enter default ${variableLabel(variable).toLowerCase()}`}
                    className={`w-full px-4 py-2.5 bg-[#111814] border rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] ${
                      !(defaultVariables[variable] || '').trim()
                        ? 'border-amber-500/40'
                        : 'border-white/10'
                    }`}
                  />
                </div>
              ))}
            </div>
          )}

          {variables.includes('name') && (
            <p className="text-xs text-amber-400/90">
              {'{{name}}'} is filled automatically from each contact when sending. You do not need to set it here.
            </p>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
          >
            {saving ? 'Saving...' : initialTemplate ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
