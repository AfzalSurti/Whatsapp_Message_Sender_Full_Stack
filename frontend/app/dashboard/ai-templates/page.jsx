'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  GripVertical,
  Layers,
  Loader2,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiTemplateAPI } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

const emptyStep = (step) => ({
  step,
  instruction: '',
  collectField: '',
  isLastStep: false
});

const emptyForm = {
  name: '',
  description: '',
  intentDescription: '',
  triggerExamples: '',
  initialMessage: '',
  aiInstructions: '',
  knowledgeBase: '',
  escalationRules: '',
  priority: 1,
  isActive: true,
  leadFields: [],
  workflowSteps: [emptyStep(1)]
};

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export default function AITemplatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [leadTemplateFilter, setLeadTemplateFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [leadFieldInput, setLeadFieldInput] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetail, setConversationDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const res = await aiTemplateAPI.getTemplates();
    setTemplates(res.data.templates || []);
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await aiTemplateAPI.getConversations({
      search: search.trim() || undefined,
      limit: 50
    });
    setConversations(res.data.conversations || []);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    const res = await aiTemplateAPI.getLeads({
      templateId: leadTemplateFilter || undefined
    });
    setLeads(res.data.leads || []);
  }, [leadTemplateFilter]);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      await Promise.all([fetchTemplates(), fetchConversations(), fetchLeads()]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load AI templates data');
    } finally {
      setLoadingData(false);
    }
  }, [fetchTemplates, fetchConversations, fetchLeads]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (user && activeTab === 'conversations') fetchConversations();
  }, [user, activeTab, search, fetchConversations]);

  useEffect(() => {
    if (user && activeTab === 'leads') fetchLeads();
  }, [user, activeTab, leadTemplateFilter, fetchLeads]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setLeadFieldInput('');
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingId(template._id);
    setForm({
      name: template.name || '',
      description: template.description || '',
      intentDescription: template.intentDescription || '',
      triggerExamples: (template.triggerExamples || []).join('\n'),
      initialMessage: template.initialMessage || '',
      aiInstructions: template.aiInstructions || '',
      knowledgeBase: template.knowledgeBase || '',
      escalationRules: template.escalationRules || '',
      priority: template.priority || 1,
      isActive: template.isActive !== false,
      leadFields: template.leadFields || [],
      workflowSteps:
        template.workflowSteps?.length > 0
          ? template.workflowSteps
          : [emptyStep(1)]
    });
    setLeadFieldInput('');
    setShowModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!form.name.trim() || !form.intentDescription.trim()) {
      toast.error('Name and intent description are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        triggerExamples: form.triggerExamples
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        workflowSteps: form.workflowSteps.map((step, index) => ({
          ...step,
          step: index + 1
        }))
      };

      if (editingId) {
        await aiTemplateAPI.updateTemplate(editingId, payload);
        toast.success('Template updated');
      } else {
        await aiTemplateAPI.createTemplate(payload);
        toast.success('Template created');
      }

      setShowModal(false);
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (template) => {
    try {
      await aiTemplateAPI.toggleTemplate(template._id);
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle template');
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Delete template "${template.name}"?`)) return;

    try {
      await aiTemplateAPI.deleteTemplate(template._id);
      toast.success('Template deleted');
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete template');
    }
  };

  const openConversation = async (conversation) => {
    setSelectedConversation(conversation);
    setDetailLoading(true);
    try {
      const res = await aiTemplateAPI.getConversation(conversation._id);
      setConversationDetail(res.data.conversation);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load conversation');
    } finally {
      setDetailLoading(false);
    }
  };

  const exportLeadsCsv = () => {
    if (leads.length === 0) {
      toast.error('No leads to export');
      return;
    }

    const rows = leads.map((lead) => {
      const fields = Object.entries(lead.collectedInfo || {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');

      return [
        lead.contactName || '',
        lead.contactPhone || '',
        lead.activeTemplateId?.name || '',
        fields,
        lead.isCompleted ? 'Completed' : 'In Progress',
        lead.lastMessageAt ? formatDate(lead.lastMessageAt) : ''
      ];
    });

    const csv = [
      ['Contact Name', 'Phone', 'Template', 'Collected Fields', 'Status', 'Last Message'],
      ...rows
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-template-leads.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredTemplates = useMemo(() => templates, [templates]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Layers className="text-[#25D366]" size={28} />
              <h1 className="text-3xl font-bold">AI Templates</h1>
            </div>
            <p className="text-gray-400 mt-2">
              Intent detection, workflow steps, and lead collection for auto-reply
            </p>
          </div>

          {activeTab === 'templates' && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 bg-[#25D366] text-black px-5 py-3 rounded-xl font-semibold hover:bg-[#1fb855] transition-colors"
            >
              <Plus size={18} />
              Create Template
            </button>
          )}

          {activeTab === 'leads' && (
            <button
              type="button"
              onClick={exportLeadsCsv}
              className="inline-flex items-center gap-2 border border-white/10 px-5 py-3 rounded-xl hover:bg-white/5 transition-colors"
            >
              <Download size={18} />
              Export CSV
            </button>
          )}
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#111] border border-white/10 gap-1">
          {[
            { id: 'templates', label: 'Templates' },
            { id: 'conversations', label: 'Conversations' },
            { id: 'leads', label: 'Leads' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#25D366] text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full border border-dashed border-white/10 rounded-2xl p-12 text-center text-gray-400">
                No templates yet. Create your first AI template to get started.
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template._id}
                  className="border border-white/10 rounded-2xl p-5 bg-[#111] space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                        {template.intentDescription}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border ${
                        template.isActive
                          ? 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366]'
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}
                    >
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                      {template.workflowSteps?.length || 0} steps
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                      Priority {template.priority || 1}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(template)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(template)}
                      className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5"
                    >
                      {template.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className="px-3 py-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by phone or name"
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm"
              />
            </div>

            <div className="border border-white/10 rounded-2xl overflow-hidden">
              {conversations.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No conversations yet</div>
              ) : (
                conversations.map((conversation) => {
                  const templateName = conversation.activeTemplateId?.name || 'No Template';
                  const totalSteps = conversation.activeTemplateId?.workflowSteps?.length || 0;

                  return (
                    <div
                      key={conversation._id}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border-b border-white/10 last:border-b-0"
                    >
                      <div>
                        <div className="font-medium">
                          {conversation.contactName || 'Unknown'}{' '}
                          <span className="text-gray-500 text-sm">
                            {formatPhoneNumber(conversation.contactPhone) ||
                              conversation.contactPhone}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 text-xs">
                          <span className="px-2.5 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                            {templateName}
                          </span>
                          {totalSteps > 0 && (
                            <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                              Step {Math.min(conversation.currentStep + 1, totalSteps)}/{totalSteps}
                            </span>
                          )}
                          {conversation.isCompleted && (
                            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                              Completed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {conversation.lastMessageAt
                            ? formatDate(conversation.lastMessageAt)
                            : 'No activity'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openConversation(conversation)}
                          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="space-y-4">
            <select
              value={leadTemplateFilter}
              onChange={(e) => setLeadTemplateFilter(e.target.value)}
              className="bg-[#111] border border-white/10 rounded-xl px-4 py-3 text-sm"
            >
              <option value="">All templates</option>
              {templates.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>

            <div className="overflow-x-auto border border-white/10 rounded-2xl">
              <table className="min-w-full text-sm">
                <thead className="bg-[#111] text-gray-400">
                  <tr>
                    <th className="text-left px-4 py-3">Contact</th>
                    <th className="text-left px-4 py-3">Template</th>
                    <th className="text-left px-4 py-3">Collected Fields</th>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-left px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        No leads collected yet
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr key={lead._id} className="border-t border-white/10">
                        <td className="px-4 py-4">
                          <div className="font-medium">{lead.contactName || 'Unknown'}</div>
                          <div className="text-gray-500 text-xs mt-1">
                            {formatPhoneNumber(lead.contactPhone) || lead.contactPhone}
                          </div>
                        </td>
                        <td className="px-4 py-4">{lead.activeTemplateId?.name || '—'}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(lead.collectedInfo || {}).map(([key, value]) => (
                              <span
                                key={key}
                                className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-xs"
                              >
                                {key}: {String(value)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-400">
                          {lead.lastMessageAt ? formatDate(lead.lastMessageAt) : '—'}
                        </td>
                        <td className="px-4 py-4">
                          {lead.isCompleted ? 'Completed' : 'In Progress'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-4 md:p-8">
            <div className="w-full max-w-4xl bg-[#111] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <h2 className="text-xl font-semibold">
                  {editingId ? 'Edit Template' : 'Create Template'}
                </h2>
                <button type="button" onClick={() => setShowModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-8 max-h-[75vh] overflow-y-auto">
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Info</h3>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Template name"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                  <textarea
                    value={form.intentDescription}
                    onChange={(e) => setForm({ ...form, intentDescription: e.target.value })}
                    placeholder="Describe what kind of messages trigger this template"
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                  <textarea
                    value={form.triggerExamples}
                    onChange={(e) => setForm({ ...form, triggerExamples: e.target.value })}
                    placeholder="Example messages (one per line)"
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 1 })}
                    placeholder="Priority"
                    className="w-full md:w-48 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-semibold">AI Behavior</h3>
                  <textarea
                    value={form.initialMessage}
                    onChange={(e) => setForm({ ...form, initialMessage: e.target.value })}
                    placeholder="First message to send when template activates"
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                  <textarea
                    value={form.aiInstructions}
                    onChange={(e) => setForm({ ...form, aiInstructions: e.target.value })}
                    placeholder="How should AI behave in this template?"
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-semibold">Knowledge Base</h3>
                  <textarea
                    value={form.knowledgeBase}
                    onChange={(e) => setForm({ ...form, knowledgeBase: e.target.value })}
                    placeholder="Paste your business information, FAQs, pricing, etc."
                    rows={6}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Workflow Steps</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          workflowSteps: [
                            ...form.workflowSteps,
                            emptyStep(form.workflowSteps.length + 1)
                          ]
                        })
                      }
                      className="inline-flex items-center gap-2 text-sm text-[#25D366]"
                    >
                      <Plus size={16} />
                      Add Step
                    </button>
                  </div>

                  {form.workflowSteps.map((step, index) => (
                    <div
                      key={`step-${index}`}
                      className="border border-white/10 rounded-xl p-4 space-y-3 bg-[#0a0a0a]"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-gray-500" />
                          <span className="text-sm font-medium">Step {index + 1}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const next = [...form.workflowSteps];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              setForm({ ...form, workflowSteps: next });
                            }}
                            className="p-2 rounded-lg border border-white/10 disabled:opacity-30"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={index === form.workflowSteps.length - 1}
                            onClick={() => {
                              const next = [...form.workflowSteps];
                              [next[index + 1], next[index]] = [next[index], next[index + 1]];
                              setForm({ ...form, workflowSteps: next });
                            }}
                            className="p-2 rounded-lg border border-white/10 disabled:opacity-30"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                workflowSteps: form.workflowSteps.filter((_, i) => i !== index)
                              })
                            }
                            className="p-2 rounded-lg border border-red-500/20 text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={step.instruction}
                        onChange={(e) => {
                          const next = [...form.workflowSteps];
                          next[index] = { ...next[index], instruction: e.target.value };
                          setForm({ ...form, workflowSteps: next });
                        }}
                        placeholder="What should AI do at this step?"
                        rows={3}
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />

                      <input
                        value={step.collectField}
                        onChange={(e) => {
                          const next = [...form.workflowSteps];
                          next[index] = { ...next[index], collectField: e.target.value };
                          setForm({ ...form, workflowSteps: next });
                        }}
                        placeholder="Field to collect (optional): name, email, domain..."
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />

                      <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={step.isLastStep}
                          onChange={(e) => {
                            const next = [...form.workflowSteps];
                            next[index] = { ...next[index], isLastStep: e.target.checked };
                            setForm({ ...form, workflowSteps: next });
                          }}
                        />
                        Is last step
                      </label>
                    </div>
                  ))}
                </section>

                <section className="space-y-4">
                  <h3 className="text-lg font-semibold">Lead Collection</h3>
                  <div className="flex flex-wrap gap-2">
                    {form.leadFields.map((field) => (
                      <span
                        key={field}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm"
                      >
                        {field}
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              leadFields: form.leadFields.filter((item) => item !== field)
                            })
                          }
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={leadFieldInput}
                      onChange={(e) => setLeadFieldInput(e.target.value)}
                      placeholder="Add field: name, email, phone..."
                      className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const value = leadFieldInput.trim();
                        if (!value || form.leadFields.includes(value)) return;
                        setForm({ ...form, leadFields: [...form.leadFields, value] });
                        setLeadFieldInput('');
                      }}
                      className="px-4 py-3 rounded-xl bg-white/5 border border-white/10"
                    >
                      Add
                    </button>
                  </div>
                </section>
              </div>

              <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-xl border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveTemplate}
                  className="px-5 py-3 rounded-xl bg-[#25D366] text-black font-semibold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedConversation && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-[#111] border border-white/10 rounded-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedConversation.contactName || 'Conversation'}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {formatPhoneNumber(selectedConversation.contactPhone) ||
                    selectedConversation.contactPhone}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedConversation(null)}>
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center p-10">
                <Loader2 className="animate-spin text-[#25D366]" size={28} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_280px]">
                <div className="p-5 space-y-3 border-b lg:border-b-0 lg:border-r border-white/10">
                  {(conversationDetail?.conversationHistory || []).map((entry, index) => (
                    <div
                      key={`${entry.timestamp}-${index}`}
                      className={`flex ${entry.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                          entry.role === 'assistant'
                            ? 'bg-[#25D366]/15 border border-[#25D366]/20 text-[#d7ffe4]'
                            : 'bg-white/5 border border-white/10 text-gray-200'
                        }`}
                      >
                        {entry.content}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Template</div>
                    <div className="mt-1 font-medium">
                      {conversationDetail?.activeTemplateId?.name || 'No Template'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">Step</div>
                    <div className="mt-1">
                      Step {(conversationDetail?.currentStep || 0) + 1}
                      {conversationDetail?.activeTemplateId?.workflowSteps?.length
                        ? ` / ${conversationDetail.activeTemplateId.workflowSteps.length}`
                        : ''}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Collected Info
                    </div>
                    <div className="mt-2 space-y-2">
                      {Object.entries(conversationDetail?.collectedInfo || {}).length === 0 ? (
                        <div className="text-sm text-gray-500">Nothing collected yet</div>
                      ) : (
                        Object.entries(conversationDetail.collectedInfo).map(([key, value]) => (
                          <div
                            key={key}
                            className="text-sm px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                          >
                            <span className="text-gray-400">{key}:</span> {String(value)}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
