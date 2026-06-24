'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/lib/auth';
import { whatsappAPI, aiAPI, contactsAPI, logsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import { useDashboardShell } from './DashboardShellContext';
import {
  DEFAULT_PHONE_COUNTRY,
  digitsOnly,
  normalizePhoneNumber,
  formatPhoneNumber
} from '@/lib/phone';
import {
  Upload, X, Send, Bot, Loader2, CheckCircle, XCircle,
  SkipForward, Phone, Edit2, Trash2, Plus, BarChart3, Wifi,
  TrendingUp, MessageCircle, Zap
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';

const AI_TONES = ['Friendly', 'Formal', 'Festive', 'Urgent', 'Other'];
const AI_LANGUAGES = ['English', 'Hindi', 'Gujarati', 'English + Urdu', 'Other'];
const AI_FESTIVALS = ['General', 'Diwali', 'Eid al-Fitr', 'New Year', 'Holi', 'Other'];
const AI_AUDIENCES = ['Customers', 'VIP Clients', 'Leads', 'Local Shoppers', 'Other'];
const AI_PRESETS = [
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
const DEFAULT_COUNTRY = DEFAULT_PHONE_COUNTRY;

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { waStatus, sending, setSending, progress, setProgress } = useDashboardShell();

  // Dashboard stats
  const [campaigns, setCampaigns] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Message state
  const [numbers, setNumbers] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY);
  const [numberInput, setNumberInput] = useState('');
  const [message, setMessage] = useState('');
  const [aiPreset, setAiPreset] = useState('best');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState('Friendly');
  const [aiLanguage, setAiLanguage] = useState('English');
  const [aiFestival, setAiFestival] = useState('General');
  const [aiAudience, setAiAudience] = useState('Customers');
  const [customAiTone, setCustomAiTone] = useState('');
  const [customAiLanguage, setCustomAiLanguage] = useState('');
  const [customAiFestival, setCustomAiFestival] = useState('');
  const [customAiAudience, setCustomAiAudience] = useState('');
  const [aiGuidance, setAiGuidance] = useState('');
  const [aiRefineLoading, setAiRefineLoading] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [messageMode, setMessageMode] = useState('manual'); // manual | ai
  // Contacts state
  const [savedContacts, setSavedContacts] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactCountry, setNewContactCountry] = useState(DEFAULT_COUNTRY);
  const [newContactPhone, setNewContactPhone] = useState('');

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    setStatsLoading(true);
    try {
      const [campaignsRes, logsRes] = await Promise.all([
        logsAPI.getCampaigns().catch(() => ({ data: { campaigns: [] } })),
        logsAPI.getLogs({ limit: 5 }).catch(() => ({ data: { logs: [] } }))
      ]);
      setCampaigns(campaignsRes.data.campaigns || []);
      setActivityLogs(logsRes.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await contactsAPI.getContacts();
      setSavedContacts(res.data.contacts || []);
    } catch {
      toast.error('Failed to load contacts');
    }
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user && !getToken()) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Fetch contacts and dashboard data on load
  useEffect(() => {
    if (user) {
      fetchContacts();
      fetchDashboardData();
    }
  }, [user, fetchContacts, fetchDashboardData]);

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast.error('Enter name and phone number');
      return;
    }

    const normalized = normalizePhoneNumber(newContactPhone, newContactCountry);
    if (!normalized) {
      toast.error('Enter a valid international phone number');
      return;
    }

    try {
      if (editingContact) {
        await contactsAPI.updateContact(editingContact._id, {
          name: newContactName,
          phoneNumber: normalized.e164
        });
        toast.success('Contact updated');
      } else {
        await contactsAPI.createContact({
          name: newContactName,
          phoneNumber: normalized.e164
        });
        toast.success('Contact saved');
      }
      setNewContactName('');
      setNewContactCountry(DEFAULT_COUNTRY);
      setNewContactPhone('');
      setEditingContact(null);
      setShowAddContactForm(false);
      await fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      await contactsAPI.deleteContact(id);
      toast.success('Contact deleted');
      await fetchContacts();
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  const handleEditContact = (contact) => {
    const normalized = normalizePhoneNumber(contact.phoneNumber, DEFAULT_COUNTRY);
    setEditingContact(contact);
    setNewContactName(contact.name);
    setNewContactCountry(normalized?.country || DEFAULT_COUNTRY);
    setNewContactPhone(normalized?.e164 || contact.phoneNumber);
    setShowAddContactForm(true);
  };

  const handleSelectContact = (contact) => {
    const normalized = normalizePhoneNumber(contact.phoneNumber, selectedCountry);
    if (!normalized) {
      toast.error('Saved contact has an invalid phone number');
      return;
    }

    if (!numbers.includes(normalized.e164)) {
      setNumbers([...numbers, normalized.e164]);
      toast.success(`Added ${contact.name}`);
    } else {
      toast.error('Number already added');
    }
  };

  // Add number chip
  const addNumber = (num, country = selectedCountry) => {
    const normalized = normalizePhoneNumber(num, country);
    if (!normalized) {
      toast.error('Enter a valid international phone number');
      return;
    }

    if (numbers.includes(normalized.e164)) {
      toast.error('Number already added');
      return;
    }
    setNumbers([...numbers, normalized.e164]);
    setNumberInput('');
  };

  // derived validity for the input (used by Add button)
  const isNumberValid = Boolean(normalizePhoneNumber(numberInput, selectedCountry));

  // Remove number chip
  const removeNumber = (num) => {
    setNumbers(numbers.filter(n => n !== num));
  };

  // CSV import
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n');
      const newNums = [];
      lines.forEach((line, i) => {
        if (i === 0 && line.toLowerCase().includes('number')) return; // skip header
        const normalized = normalizePhoneNumber(line.split(',')[0], selectedCountry);
        if (normalized && !numbers.includes(normalized.e164) && !newNums.includes(normalized.e164)) {
          newNums.push(normalized.e164);
        }
      });
      setNumbers(prev => [...prev, ...newNums]);
      toast.success(`${newNums.length} numbers imported`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate AI message
  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await aiAPI.generate({
        preset: aiPreset,
        prompt: aiPrompt,
        tone: aiTone === 'Other' ? customAiTone : aiTone,
        language: aiLanguage === 'Other' ? customAiLanguage : aiLanguage,
        festival: aiFestival === 'Other' ? customAiFestival : aiFestival,
        audience: aiAudience === 'Other' ? customAiAudience : aiAudience,
        guidance: aiGuidance
      });
      setMessage(res.data.message);
      toast.success('AI message generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIRefine = async (mode) => {
    const currentMessage = message;
    if (!currentMessage?.trim()) {
      toast.error('Generate or write a message first');
      return;
    }

    setAiRefineLoading(mode);
    try {
      const res = await aiAPI.generate({
        preset: aiPreset,
        prompt: aiPrompt || 'Improve this WhatsApp campaign message',
        tone: aiTone === 'Other' ? customAiTone : aiTone,
        language: aiLanguage === 'Other' ? customAiLanguage : aiLanguage,
        festival: aiFestival === 'Other' ? customAiFestival : aiFestival,
        audience: aiAudience === 'Other' ? customAiAudience : aiAudience,
        guidance: aiGuidance,
        mode,
        currentMessage
      });
      setMessage(res.data.message);
      toast.success('Message updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI refinement failed');
    } finally {
      setAiRefineLoading('');
    }
  };

  const handleUseAIMessage = () => {
    if (!message.trim()) {
      toast.error('Generate a message first');
      return;
    }
    setMessageMode('manual');
    toast.success('Message added to campaign');
  };

  // Send messages
  const handleSend = async () => {
    if (waStatus !== 'connected') {
      toast.error('Connect WhatsApp first');
      return;
    }
    if (numbers.length === 0) {
      toast.error('Add at least one number');
      return;
    }
    if (!message.trim()) {
      toast.error('Enter a message');
      return;
    }
    setSending(true);
    setProgress({ sent: 0, failed: 0, skipped: 0, current: 0, total: numbers.length });
    try {
      await whatsappAPI.send({ numbers, message });
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.error || data?.errors?.[0]?.msg || 'Send failed');
      setSending(false);
    }
  };

  if (loading && !user) {
    return null;
  }

  const progressPct = progress?.total > 0
    ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100)
    : 0;

  // Calculate stats from campaigns and logs
  const totalMessagesSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
  const totalAttempted = campaigns.reduce(
    (sum, c) => sum + (c.sent || 0) + (c.failed || 0) + (c.skipped || 0),
    0
  );
  const successRate =
    totalAttempted > 0 ? Math.round((totalMessagesSent / totalAttempted) * 100) : 0;
  const activeCampaignsCount = campaigns.filter(
    (c) => c.status === 'running' || c.status === 'pending'
  ).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ═══ GREETING ═══ */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Good morning, {user?.name?.split(' ')[0] || 'Admin'} 👋</h1>
          <p className="text-sm text-gray-500">Here's what's happening with your campaigns today.</p>
        </div>

        {/* ═══ STATS ROW (4 CARDS) ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Messages Sent */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#25D366]/10">
                <BarChart3 className="text-[#25D366]" size={20} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {totalMessagesSent > 0 ? `${(totalMessagesSent / 1000).toFixed(1)}k` : '0'}
            </div>
            <p className="text-xs text-gray-500 mb-2">Messages Sent</p>
            <p className="text-xs text-gray-500">From completed campaigns</p>
          </div>

          {/* Delivery Rate */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#25D366]/10">
                <CheckCircle className="text-[#25D366]" size={20} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{successRate}%</div>
            <p className="text-xs text-gray-500 mb-2">Success Rate</p>
            <p className="text-xs text-gray-500">Sent vs failed/skipped</p>
          </div>

          {/* Active Campaigns */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-[#8b5cf6]/10">
                <Zap className="text-[#8b5cf6]" size={20} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{activeCampaignsCount}</div>
            <p className="text-xs text-gray-500 mb-2">Active Campaigns</p>
            <p className="text-xs text-gray-500">Pending or running now</p>
          </div>

          {/* WhatsApp Status */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${waStatus === 'connected' ? 'bg-[#25D366]/10' : 'bg-red-500/10'}`}>
                <Wifi className={waStatus === 'connected' ? 'text-[#25D366]' : 'text-red-500'} size={20} />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1 capitalize">{waStatus === 'connected' ? 'Connected' : 'Disconnected'}</div>
            <p className="text-xs text-gray-500 mb-2">WhatsApp Status</p>
            <p className={`text-xs ${waStatus === 'connected' ? 'text-[#25D366]' : 'text-red-500'}`}>
              {waStatus === 'connected' ? '✓ Ready' : '✗ Offline'}
            </p>
          </div>
        </div>

        {/* ═══ MAIN GRID (Phone Numbers + Message) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CONTACTS MODAL */}
          {showContactsModal && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <h3 className="font-bold text-lg">Saved Contacts</h3>
                  <button
                    onClick={() => {
                      setShowContactsModal(false);
                      setShowAddContactForm(false);
                      setEditingContact(null);
                      setNewContactName('');
                      setNewContactPhone('');
                    }}
                    className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close contacts modal"
                  >
                    <X size={20} />
                  </button>
                </div>

                {!showAddContactForm ? (
                  <div className="space-y-3">
                    {savedContacts.length > 0 ? (
                      <>
                        {savedContacts.map((contact) => (
                          <div
                            key={contact._id}
                            className="flex items-center justify-between bg-[#0a0a0a] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                          >
                            <div className="text-left">
                              <p className="text-sm font-medium text-white">{contact.name}</p>
                              <p className="text-xs text-gray-500">{formatPhoneNumber(contact.phoneNumber)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleSelectContact(contact)}
                                className="bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => handleEditContact(contact)}
                                className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                                aria-label="Edit contact"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteContact(contact._id)}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                                aria-label="Delete contact"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-center text-gray-500 text-sm py-8">No saved contacts yet</p>
                    )}

                    <button
                      onClick={() => {
                        setEditingContact(null);
                        setNewContactName('');
                        setNewContactCountry(DEFAULT_COUNTRY);
                        setNewContactPhone('');
                        setShowAddContactForm(true);
                      }}
                      className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
                    >
                      <Plus size={16} /> Add New Contact
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Contact name (e.g., Mom, Office)"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2">
                      <InternationalPhoneInput
                        value={newContactPhone}
                        defaultCountry={newContactCountry}
                        onChange={(phone, meta) => {
                          setNewContactPhone(phone);
                          setNewContactCountry(meta?.country?.iso2?.toUpperCase() || newContactCountry);
                        }}
                        onCountryChange={setNewContactCountry}
                        placeholder="Phone number"
                        label={null}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAddContact}
                        className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                      >
                        {editingContact ? 'Update' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setShowAddContactForm(false);
                          setEditingContact(null);
                          setNewContactName('');
                          setNewContactCountry(DEFAULT_COUNTRY);
                          setNewContactPhone('');
                        }}
                        className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* LEFT — NUMBERS */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-[#0a0a0a]"><Phone size={18} className="text-[#25D366]" /></div>
                <h2 className="font-semibold text-sm">Phone Numbers</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{numbers.length} added</span>
                <button
                  onClick={() => setShowContactsModal(true)}
                  className="text-xs text-[#25D366] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Phone size={12} /> Saved
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-center">
              <InternationalPhoneInput
                value={numberInput}
                defaultCountry={selectedCountry}
                onChange={(phone, meta) => {
                  setNumberInput(phone);
                  setSelectedCountry(meta?.country?.iso2?.toUpperCase() || selectedCountry);
                }}
                onCountryChange={setSelectedCountry}
                placeholder="Phone number"
                label={null}
              />
              <button
                onClick={() => addNumber(numberInput)}
                aria-label="Add phone number"
                title="Add phone number"
                disabled={!isNumberValid}
                className={`inline-flex items-center justify-center bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold rounded-xl px-3 py-1.5 transition-colors text-xs ${!isNumberValid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="ml-1">Add</span>
              </button>
            </div>

            {/* CSV Import */}
            <label className="flex items-center gap-2 text-xs text-[#25D366] cursor-pointer hover:underline w-fit">
              <Upload size={13} />
              Import CSV
              <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
            </label>

            {/* Chips */}
            {numbers.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {numbers.map((num, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-full px-3 py-1 text-xs text-gray-300">
                    {num}
                    <button onClick={() => removeNumber(num)} className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {numbers.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-xs">
                Add numbers manually or import a CSV
              </div>
            )}
          </div>

          {/* RIGHT — MESSAGE */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-8 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-[#0a0a0a]"><Bot size={18} className="text-[#25D366]" /></div>
              <h2 className="font-semibold text-sm">Message</h2>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMessageMode('manual')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  messageMode === 'manual'
                    ? 'bg-[#25D366] text-black'
                    : 'bg-[#0a0a0a] text-gray-400 border border-white/10'
                }`}
              >
                ✍️ Write Manually
              </button>
              <button
                onClick={() => setMessageMode('ai')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  messageMode === 'ai'
                    ? 'bg-[#25D366] text-black'
                    : 'bg-[#0a0a0a] text-gray-400 border border-white/10'
                }`}
              >
                🤖 Generate with AI
              </button>
            </div>

            {/* Manual */}
            {messageMode === 'manual' && (
              <textarea
                placeholder="Type your WhatsApp message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
              />
            )}

            {/* AI */}
            {messageMode === 'ai' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Preset</label>
                  <select
                    value={aiPreset}
                    onChange={(e) => setAiPreset(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
                  >
                    {AI_PRESETS.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {AI_PRESETS.find(item => item.value === aiPreset)?.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Tone</label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
                    >
                      {AI_TONES.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Language</label>
                    <select
                      value={aiLanguage}
                      onChange={(e) => setAiLanguage(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
                    >
                      {AI_LANGUAGES.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Festival</label>
                    <select
                      value={aiFestival}
                      onChange={(e) => setAiFestival(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
                    >
                      {AI_FESTIVALS.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Audience</label>
                    <select
                      value={aiAudience}
                      onChange={(e) => setAiAudience(e.target.value)}
                      className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366]"
                    >
                      {AI_AUDIENCES.map(item => <option key={item}>{item}</option>)}
                    </select>
                  </div>
                </div>

                {(aiTone === 'Other' || aiLanguage === 'Other' || aiFestival === 'Other' || aiAudience === 'Other') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiTone === 'Other' && (
                      <input
                        type="text"
                        placeholder="Custom tone"
                        value={customAiTone}
                        onChange={(e) => setCustomAiTone(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                      />
                    )}
                    {aiLanguage === 'Other' && (
                      <input
                        type="text"
                        placeholder="Custom language"
                        value={customAiLanguage}
                        onChange={(e) => setCustomAiLanguage(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                      />
                    )}
                    {aiFestival === 'Other' && (
                      <input
                        type="text"
                        placeholder="Custom festival or context"
                        value={customAiFestival}
                        onChange={(e) => setCustomAiFestival(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                      />
                    )}
                    {aiAudience === 'Other' && (
                      <input
                        type="text"
                        placeholder="Custom audience"
                        value={customAiAudience}
                        onChange={(e) => setCustomAiAudience(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">Campaign prompt optional</label>
                  <textarea
                    placeholder='e.g. "Festive offer for salon customers with {{name}} placeholder"'
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">AI guidance optional</label>
                  <textarea
                    placeholder='e.g. "Keep it premium, add urgency, include a clear CTA"'
                    value={aiGuidance}
                    onChange={(e) => setAiGuidance(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  {aiLoading ? 'Generating...' : 'Generate'}
                </button>

                {message && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#25D366]/20 bg-[#0a0a0a] p-3">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">Generated message</p>
                      <p className="text-sm text-white whitespace-pre-wrap">{message}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleUseAIMessage}
                        className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-3 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                      >
                        Use This
                      </button>
                      <button
                        onClick={() => handleAIRefine('rewrite')}
                        disabled={!!aiRefineLoading}
                        className="border border-white/10 hover:border-white/20 text-white font-semibold px-3 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
                      >
                        {aiRefineLoading === 'rewrite' ? 'Rewriting...' : 'Rewrite'}
                      </button>
                      <button
                        onClick={() => handleAIRefine('translate')}
                        disabled={!!aiRefineLoading}
                        className="border border-white/10 hover:border-white/20 text-white font-semibold px-3 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
                      >
                        {aiRefineLoading === 'translate' ? 'Translating...' : 'Translate'}
                      </button>
                      <button
                        onClick={() => handleAIRefine('shorten')}
                        disabled={!!aiRefineLoading}
                        className="border border-white/10 hover:border-white/20 text-white font-semibold px-3 py-2.5 rounded-xl transition-colors text-sm cursor-pointer disabled:opacity-50"
                      >
                        {aiRefineLoading === 'shorten' ? 'Shortening...' : 'Shorten'}
                      </button>
                    </div>

                    <button
                      onClick={() => { setMessage(''); setAiPreset('best'); setAiPrompt(''); setAiGuidance(''); }}
                      className="text-xs text-gray-600 hover:text-red-400"
                    >
                      Clear AI draft
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Char count */}
            {message && (
              <p className="text-xs text-gray-600 text-right">{message.length} characters</p>
            )}
          </div>
        </div>

        {/* SEND BUTTON */}
        <div className="mt-6">
          <button
            onClick={handleSend}
            disabled={sending || waStatus !== 'connected' || numbers.length === 0 || !message.trim()}
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-lg cursor-pointer"
          >
            {sending ? (
              <><Loader2 size={18} className="animate-spin" /> Sending...</>
            ) : (
              <><Send size={18} /> Send to {numbers.length} {numbers.length === 1 ? 'number' : 'numbers'}</>
            )}
          </button>
        </div>

        {/* PROGRESS */}
        {progress && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Progress</span>
              <span className="text-gray-400">{progress.current || 0} / {progress.total}</span>
            </div>

            {/* Bar */}
            <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#25D366] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#25D366] text-lg font-bold">
                  <CheckCircle size={16} /> {progress.sent || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Sent</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-red-400 text-lg font-bold">
                  <XCircle size={16} /> {progress.failed || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Failed</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-400 text-lg font-bold">
                  <SkipForward size={16} /> {progress.skipped || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Skipped</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ BOTTOM SECTION (Recent Campaigns + AI Activity) ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT - RECENT CAMPAIGNS TABLE */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Recent Campaigns</h3>
              <a href="/dashboard/history" className="text-xs text-[#25D366] hover:underline cursor-pointer">View All</a>
            </div>

            {campaigns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3">Campaign</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3">Status</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3">Progress</th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8">
                    {campaigns.slice(0, 4).map((camp, idx) => {
                      let statusColor = 'bg-green-500/20 text-green-400';
                      let statusLabel = 'Running';
                      if (camp.status === 'completed') {
                        statusColor = 'bg-green-500/20 text-green-400';
                        statusLabel = 'Completed';
                      } else if (camp.status === 'failed') {
                        statusColor = 'bg-red-500/20 text-red-400';
                        statusLabel = 'Failed';
                      } else if (camp.status === 'pending') {
                        statusColor = 'bg-blue-500/20 text-blue-400';
                        statusLabel = 'Pending';
                      } else if (camp.status === 'running') {
                        statusColor = 'bg-[#25D366]/20 text-[#25D366]';
                        statusLabel = 'Running';
                      }

                      const processed = (camp.sent || 0) + (camp.failed || 0) + (camp.skipped || 0);
                      const progress =
                        camp.totalNumbers > 0
                          ? Math.round((processed / camp.totalNumbers) * 100)
                          : 0;

                      return (
                        <tr key={camp._id || idx} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 text-white font-medium truncate">{camp.name || `Campaign ${idx + 1}`}</td>
                          <td className="py-3">
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="py-3">
                            <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#25D366] rounded-full"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3 text-right text-[#25D366] font-medium">
                            {(camp.sent || 0).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No campaigns yet</p>
                <a href="/dashboard" className="text-xs text-[#25D366] hover:underline cursor-pointer mt-2 inline-block">
                  Send your first campaign
                </a>
              </div>
            )}
          </div>

          {/* RIGHT - AI ACTIVITY LOG */}
          <div className="bg-[#0f1a14] border border-white/8 rounded-2xl p-6 hover:border-white/12 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">AI Activity Log</h3>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-xs text-[#25D366]">
                  <span className="w-2 h-2 bg-[#25D366] rounded-full animate-pulse"></span> Live
                </span>
              </div>
            </div>

            {activityLogs.length > 0 ? (
              <div className="space-y-4">
                {activityLogs.slice(0, 5).map((log, idx) => {
                  let dotColor = 'bg-[#25D366]';
                  const status = String(log.status || '').toLowerCase();

                  if (status === 'failed') {
                    dotColor = 'bg-red-500';
                  } else if (status === 'skipped') {
                    dotColor = 'bg-orange-500';
                  }

                  const timestamp = log.createdAt ? new Date(log.createdAt) : new Date();
                  const now = new Date();
                  const diffMs = now - timestamp;
                  const diffMins = Math.floor(diffMs / 60000);
                  const diffHours = Math.floor(diffMs / 3600000);

                  let timeStr = 'just now';
                  if (diffMins < 60) timeStr = `${diffMins}m ago`;
                  else if (diffHours < 24) timeStr = `${diffHours}h ago`;
                  else timeStr = `${Math.floor(diffHours / 24)}d ago`;

                  return (
                    <div key={log._id || idx} className="flex gap-3 pb-4 border-b border-white/8 last:pb-0 last:border-b-0">
                      <div className={`w-3 h-3 ${dotColor} rounded-full mt-1 flex-shrink-0`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">
                          {log.message || `Message to ${log.number || 'contact'}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {log.number || log.failReason || status || 'No details'}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 flex-shrink-0">{timeStr}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 text-sm">No activity yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
