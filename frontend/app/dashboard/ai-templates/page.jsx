'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Download,
  Edit3,
  FileUp,
  Layers,
  Loader2,
  MessageSquarePlus,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiTemplateAPI } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

const emptyCustomField = () => ({ key: '', label: '', value: '' });

const emptyConversation = () => ({
  userMessage: '',
  botReply: '',
  mediaFiles: []
});

const emptySharedDocument = () => ({
  name: '',
  keywords: '',
  mimeType: '',
  dataUrl: '',
  caption: ''
});

const emptyForm = {
  name: '',
  description: '',
  customFields: [emptyCustomField()],
  exampleConversations: [emptyConversation()],
  aiAdvice: '',
  sharedDocuments: [],
  priority: 1,
  isActive: true
};

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataUrl: reader.result
      });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function AITemplatesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [starterTemplates, setStarterTemplates] = useState([]);
  const [addingStarter, setAddingStarter] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversationDetail, setConversationDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const res = await aiTemplateAPI.getTemplates();
    setTemplates(res.data.templates || []);
  }, []);

  const fetchStarterTemplates = useCallback(async () => {
    const res = await aiTemplateAPI.getStarterTemplates();
    setStarterTemplates(res.data.starters || []);
  }, []);

  const fetchConversations = useCallback(async () => {
    const res = await aiTemplateAPI.getConversations({
      search: search.trim() || undefined,
      limit: 50
    });
    setConversations(res.data.conversations || []);
  }, [search]);

  const fetchLeads = useCallback(async () => {
    const res = await aiTemplateAPI.getLeads();
    setLeads(res.data.leads || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      await Promise.all([fetchTemplates(), fetchStarterTemplates(), fetchConversations(), fetchLeads()]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load AI templates');
    } finally {
      setLoadingData(false);
    }
  }, [fetchTemplates, fetchStarterTemplates, fetchConversations, fetchLeads]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  useEffect(() => {
    if (user && activeTab === 'conversations') fetchConversations();
  }, [user, activeTab, search, fetchConversations]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (template) => {
    setEditingId(template._id);
    setForm({
      name: template.name || '',
      description: template.description || '',
      customFields:
        template.customFields?.length > 0 ? template.customFields : [emptyCustomField()],
      exampleConversations:
        template.exampleConversations?.length > 0
          ? template.exampleConversations
          : [emptyConversation()],
      aiAdvice: template.aiAdvice || '',
      sharedDocuments: (template.sharedDocuments || []).map((doc) => ({
        ...doc,
        keywords: Array.isArray(doc.keywords) ? doc.keywords.join(', ') : doc.keywords || ''
      })),
      priority: template.priority || 1,
      isActive: template.isActive !== false
    });
    setShowModal(true);
  };

  const loadExampleTemplate = async (slug = 'welcome') => {
    try {
      const res = await aiTemplateAPI.getExampleTemplate(slug);
      const example = res.data.template;
      setEditingId(null);
      setForm({
        ...example,
        customFields: example.customFields || [emptyCustomField()],
        exampleConversations: example.exampleConversations || [emptyConversation()],
        sharedDocuments: []
      });
      setShowModal(true);
      toast.success('Example loaded — edit and save');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load example');
    }
  };

  const handleAddStarter = async (slug) => {
    setAddingStarter(slug);
    try {
      await aiTemplateAPI.addStarterTemplate(slug);
      toast.success('Template added to your list');
      await fetchTemplates();
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to add template';
      toast.error(message);
      if (err.response?.status === 409) {
        await fetchTemplates();
      }
    } finally {
      setAddingStarter(null);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim()) {
      toast.error('Template name and description are required');
      return;
    }

    const payload = {
      ...form,
      customFields: form.customFields.filter((field) => field.label.trim() || field.key.trim()),
      exampleConversations: form.exampleConversations.filter(
        (item) => item.userMessage.trim() || item.botReply.trim()
      ),
      sharedDocuments: form.sharedDocuments.map((doc) => ({
        ...doc,
        keywords: String(doc.keywords || '')
          .split(',')
          .map((kw) => kw.trim())
          .filter(Boolean)
      }))
    };

    setSaving(true);
    try {
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
    if (!window.confirm(`Delete "${template.name}"?`)) return;
    try {
      await aiTemplateAPI.deleteTemplate(template._id);
      toast.success('Template deleted');
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleConversationFile = async (conversationIndex, fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    try {
      const uploaded = await Promise.all(files.map(readFileAsDataUrl));
      setForm((prev) => {
        const next = [...prev.exampleConversations];
        next[conversationIndex] = {
          ...next[conversationIndex],
          mediaFiles: [...(next[conversationIndex].mediaFiles || []), ...uploaded]
        };
        return { ...prev, exampleConversations: next };
      });
    } catch {
      toast.error('Failed to read file');
    }
  };

  const handleSharedDocumentFile = async (docIndex, file) => {
    if (!file) return;
    try {
      const uploaded = await readFileAsDataUrl(file);
      setForm((prev) => {
        const next = [...prev.sharedDocuments];
        next[docIndex] = {
          ...next[docIndex],
          name: next[docIndex].name || uploaded.name,
          mimeType: uploaded.mimeType,
          dataUrl: uploaded.dataUrl
        };
        return { ...prev, sharedDocuments: next };
      });
    } catch {
      toast.error('Failed to read file');
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

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-8">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Layers className="text-[#25D366]" size={28} />
              <h1 className="text-3xl font-bold">AI Templates</h1>
            </div>
            <p className="text-gray-400 mt-2">
              Teach the bot with real user/bot examples, business details, and files to share
            </p>
          </div>
          {activeTab === 'templates' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => loadExampleTemplate('welcome')}
                className="inline-flex items-center gap-2 border border-white/10 px-4 py-3 rounded-xl hover:bg-white/5"
              >
                <BookOpen size={18} />
                Load Example
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 bg-[#25D366] text-black px-5 py-3 rounded-xl font-semibold"
              >
                <Plus size={18} />
                Create Template
              </button>
            </div>
          )}
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#111] border border-white/10 gap-1">
          {['templates', 'conversations', 'leads'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium capitalize ${
                activeTab === tab ? 'bg-[#25D366] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'templates' && (
          <div className="space-y-6">
            {starterTemplates.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                  Starter templates
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {starterTemplates.map((starter) => {
                    const alreadyAdded = templates.some((t) => t.name === starter.name);
                    const isInternship = starter.slug === 'internship';

                    return (
                      <div
                        key={starter.slug}
                        className={`border rounded-2xl p-5 bg-[#111] space-y-3 ${
                          isInternship
                            ? 'border-[#25D366]/30 bg-gradient-to-br from-[#111] to-[#0d1a14]'
                            : 'border-white/10'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">{starter.name}</h3>
                            <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                              {starter.description}
                            </p>
                          </div>
                          {isInternship && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddStarter(starter.slug)}
                            disabled={alreadyAdded || addingStarter === starter.slug}
                            className="flex-1 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black text-sm font-semibold inline-flex items-center justify-center gap-2"
                          >
                            {addingStarter === starter.slug ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Plus size={16} />
                            )}
                            {alreadyAdded ? 'Added' : 'Add template'}
                          </button>
                          <button
                            type="button"
                            onClick={() => loadExampleTemplate(starter.slug)}
                            className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm"
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                Your templates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full border border-dashed border-white/10 rounded-2xl p-12 text-center text-gray-400">
                No templates yet. Add the <strong>Internship Inquiry</strong> starter above or click{' '}
                <strong>Load Example</strong>.
              </div>
            ) : (
              templates.map((template) => (
                <div key={template._id} className="border border-white/10 rounded-2xl p-5 bg-[#111] space-y-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{template.name}</h3>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">{template.description}</p>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full h-fit ${
                        template.isActive
                          ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20'
                          : 'bg-white/5 text-gray-400 border border-white/10'
                      }`}
                    >
                      {template.isActive ? 'Active' : 'Off'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                      {template.exampleConversations?.length || 0} examples
                    </span>
                    <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                      {template.sharedDocuments?.length || 0} files
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(template)}
                      className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 inline-flex items-center justify-center gap-2"
                    >
                      <Edit3 size={16} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(template)}
                      className="px-3 py-2 rounded-lg border border-white/10"
                    >
                      {template.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      className="px-3 py-2 rounded-lg border border-red-500/20 text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conversations' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone or name"
                className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm"
              />
            </div>
            <div className="border border-white/10 rounded-2xl overflow-hidden">
              {conversations.length === 0 ? (
                <div className="p-10 text-center text-gray-400">No conversations yet</div>
              ) : (
                conversations.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-4 border-b border-white/10 last:border-0"
                  >
                    <div>
                      <div className="font-medium">
                        {item.contactName || 'Unknown'}{' '}
                        <span className="text-gray-500 text-sm">
                          {formatPhoneNumber(item.contactPhone) || item.contactPhone}
                        </span>
                      </div>
                      <div className="text-xs text-[#25D366] mt-1">
                        {item.activeTemplateId?.name || 'No template'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openConversation(item)}
                      className="px-4 py-2 rounded-lg bg-white/5 border border-white/10"
                    >
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="overflow-x-auto border border-white/10 rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-[#111] text-gray-400">
                <tr>
                  <th className="text-left px-4 py-3">Contact</th>
                  <th className="text-left px-4 py-3">Template</th>
                  <th className="text-left px-4 py-3">Info</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                      No leads yet
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead._id} className="border-t border-white/10">
                      <td className="px-4 py-4">{lead.contactName || lead.contactPhone}</td>
                      <td className="px-4 py-4">{lead.activeTemplateId?.name || '—'}</td>
                      <td className="px-4 py-4">
                        {Object.entries(lead.collectedInfo || {}).map(([k, v]) => (
                          <span key={k} className="inline-block mr-2 mb-1 px-2 py-1 rounded-full bg-white/5 text-xs">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-4 text-gray-400">
                        {lead.lastMessageAt ? formatDate(lead.lastMessageAt) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                <section className="space-y-3">
                  <h3 className="font-semibold text-lg">1. Template basics</h3>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Template name e.g. Welcome Greeting"
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What is this template about? When should AI use it? (passed to AI)"
                    rows={3}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">2. Your business details</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          customFields: [...form.customFields, emptyCustomField()]
                        })
                      }
                      className="text-sm text-[#25D366] inline-flex items-center gap-1"
                    >
                      <Plus size={16} /> Add field
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Use {'{{field_key}}'} in bot replies. Example: {'{{business_name}}'}
                  </p>
                  {form.customFields.map((field, index) => (
                    <div key={`field-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        value={field.label}
                        onChange={(e) => {
                          const next = [...form.customFields];
                          const label = e.target.value;
                          next[index] = {
                            ...next[index],
                            label,
                            key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
                          };
                          setForm({ ...form, customFields: next });
                        }}
                        placeholder="Label e.g. Business Name"
                        className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                      />
                      <input
                        value={field.value}
                        onChange={(e) => {
                          const next = [...form.customFields];
                          next[index] = { ...next[index], value: e.target.value };
                          setForm({ ...form, customFields: next });
                        }}
                        placeholder="Value e.g. Aliasgar Training"
                        className="bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 md:col-span-2"
                      />
                    </div>
                  ))}
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">3. Example conversations</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          exampleConversations: [...form.exampleConversations, emptyConversation()]
                        })
                      }
                      className="text-sm text-[#25D366] inline-flex items-center gap-1"
                    >
                      <MessageSquarePlus size={16} /> Add conversation
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Show AI how user messages and bot replies should look. Example: User says &quot;Hi&quot; → Bot
                    welcomes them.
                  </p>
                  {form.exampleConversations.map((conversation, index) => (
                    <div
                      key={`conv-${index}`}
                      className="border border-white/10 rounded-xl p-4 bg-[#0a0a0a] space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Conversation {index + 1}</span>
                        {form.exampleConversations.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                exampleConversations: form.exampleConversations.filter((_, i) => i !== index)
                              })
                            }
                            className="text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <input
                        value={conversation.userMessage}
                        onChange={(e) => {
                          const next = [...form.exampleConversations];
                          next[index] = { ...next[index], userMessage: e.target.value };
                          setForm({ ...form, exampleConversations: next });
                        }}
                        placeholder='User says e.g. "Hi"'
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />
                      <textarea
                        value={conversation.botReply}
                        onChange={(e) => {
                          const next = [...form.exampleConversations];
                          next[index] = { ...next[index], botReply: e.target.value };
                          setForm({ ...form, exampleConversations: next });
                        }}
                        placeholder='Bot replies e.g. "Hello! Thank you for reaching out to {{business_name}}..."'
                        rows={3}
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />
                      <label className="inline-flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <FileUp size={16} />
                        Upload file/photo for this reply
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            handleConversationFile(index, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {(conversation.mediaFiles || []).map((file, fileIndex) => (
                        <div key={`${file.name}-${fileIndex}`} className="text-xs text-gray-400">
                          Attached: {file.name}
                        </div>
                      ))}
                    </div>
                  ))}
                </section>

                <section className="space-y-3">
                  <h3 className="font-semibold text-lg">4. Advice to AI</h3>
                  <textarea
                    value={form.aiAdvice}
                    onChange={(e) => setForm({ ...form, aiAdvice: e.target.value })}
                    placeholder="How should AI behave? Tone, length, when to ask questions, when to share files..."
                    rows={4}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3"
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">5. Keyword files (auto-send)</h3>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          sharedDocuments: [...form.sharedDocuments, emptySharedDocument()]
                        })
                      }
                      className="text-sm text-[#25D366] inline-flex items-center gap-1"
                    >
                      <Plus size={16} /> Add file rule
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    When user message contains a keyword (brochure, fees, syllabus), AI sends that file.
                  </p>
                  {form.sharedDocuments.map((doc, index) => (
                    <div key={`doc-${index}`} className="border border-white/10 rounded-xl p-4 bg-[#0a0a0a] space-y-2">
                      <input
                        value={doc.name}
                        onChange={(e) => {
                          const next = [...form.sharedDocuments];
                          next[index] = { ...next[index], name: e.target.value };
                          setForm({ ...form, sharedDocuments: next });
                        }}
                        placeholder="File name e.g. Course Brochure"
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />
                      <input
                        value={doc.keywords}
                        onChange={(e) => {
                          const next = [...form.sharedDocuments];
                          next[index] = { ...next[index], keywords: e.target.value };
                          setForm({ ...form, sharedDocuments: next });
                        }}
                        placeholder="Keywords: brochure, syllabus, pdf"
                        className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-3"
                      />
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <FileUp size={16} /> Upload file
                        <input
                          type="file"
                          accept="image/*,.pdf,.doc,.docx"
                          className="hidden"
                          onChange={(e) => {
                            handleSharedDocumentFile(index, e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {doc.dataUrl && <p className="text-xs text-gray-500">File attached</p>}
                    </div>
                  ))}
                </section>
              </div>

              <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-3 rounded-xl border border-white/10">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
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
          <div className="w-full max-w-3xl bg-[#111] border border-white/10 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between p-5 border-b border-white/10">
              <h2 className="text-xl font-semibold">Conversation</h2>
              <button type="button" onClick={() => setSelectedConversation(null)}>
                <X size={20} />
              </button>
            </div>
            {detailLoading ? (
              <div className="p-10 flex justify-center">
                <Loader2 className="animate-spin text-[#25D366]" />
              </div>
            ) : (
              <div className="p-5 overflow-y-auto space-y-3">
                {(conversationDetail?.conversationHistory || []).map((entry, index) => (
                  <div
                    key={index}
                    className={`flex ${entry.role === 'assistant' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        entry.role === 'assistant'
                          ? 'bg-[#25D366]/15 border border-[#25D366]/20'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      {entry.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
