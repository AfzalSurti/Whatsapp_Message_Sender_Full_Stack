'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import { scheduledAPI, groupsAPI, aiAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Plus, Trash2, X, Loader2, Clock,
  CheckCircle, AlertCircle, Zap, Bot, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { DEFAULT_PHONE_COUNTRY, formatPhoneNumber, normalizePhoneNumber } from '@/lib/phone';

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
           ` at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
};

const getStatusBadge = (status) => {
  const badges = {
    pending: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Pending' },
    running: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Running' },
    completed: { bg: 'bg-[#25D366]/10', border: 'border-[#25D366]/30', text: 'text-[#25D366]', label: 'Completed' },
    failed: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Failed' },
    cancelled: { bg: 'bg-gray-500/10', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Cancelled' }
  };
  return badges[status] || badges.pending;
};

const AI_TONES = [
  'Friendly',
  'Formal',
  'Persuasive',
  'Urgent',
  'Promotional',
  'Informative',
  'Conversational',
  'Professional',
  'Casual',
  'Other'
];

const AI_LANGUAGES = [
  'English',
  'Hindi',
  'Gujarati',
  'Urdu',
  'Spanish',
  'Tamil',
  'Telugu',
  'English + Urdu',
  'Other'
];

const AI_FESTIVALS = [
  'General',
  'Diwali',
  'Eid al-Fitr',
  'New Year',
  'Holi',
  'Christmas',
  'Ramadan',
  'Black Friday',
  'Other'
];

const AI_AUDIENCES = [
  'Customers',
  'VIP Clients',
  'Leads',
  'Referral',
  'Lapsed Customers',
  'New Subscribers',
  'Local Shoppers',
  'Other'
];

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

export default function ScheduledPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('upcoming'); // upcoming, completed, all
  const [campaigns, setCampaigns] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [step, setStep] = useState(1); // 1, 2, 3

  const [allGroups, setAllGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Step 1 state
  const [campaignName, setCampaignName] = useState('');
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
  const [aiLoading, setAiLoading] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Step 2 state
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedGroupContacts, setSelectedGroupContacts] = useState([]);
  const [individualPhone, setIndividualPhone] = useState('');
  const [individualPhoneCountry, setIndividualPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [selectedIndividuals, setSelectedIndividuals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  // Step 3 & submission
  const [submitting, setSubmitting] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setFetching(true);
      const res = await scheduledAPI.getCampaigns();
      setCampaigns(res.data.campaigns || []);
    } catch (err) {
      toast.error('Failed to load campaigns');
    } finally {
      setFetching(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      const res = await groupsAPI.getGroups();
      setAllGroups(res.data.groups || []);
    } catch (err) {
      toast.error('Failed to load groups');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchGroups();
    }
  }, [user, fetchCampaigns, fetchGroups]);

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
      toast.success('Message generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const getTotalContactsCount = () => {
    let count = 0;
    const phoneSet = new Set();

    selectedGroupIds.forEach(groupId => {
      const group = allGroups.find(g => g._id === groupId);
      if (group) {
        group.numbers.forEach(num => {
          if (!phoneSet.has(num.phone)) {
            phoneSet.add(num.phone);
            count++;
          }
        });
      }
    });

    selectedGroupContacts.forEach(num => {
      const clean = num.replace(/\D/g, '');
      if (!phoneSet.has(clean)) {
        phoneSet.add(clean);
        count++;
      }
    });

    selectedIndividuals.forEach(num => {
      const clean = num.replace(/\D/g, '');
      if (!phoneSet.has(clean)) {
        phoneSet.add(clean);
        count++;
      }
    });

    return count;
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = [];
    allGroups.forEach(group => {
      group.numbers.forEach(num => {
        if (
          num.phone.includes(query) ||
          num.name.toLowerCase().includes(query.toLowerCase())
        ) {
          results.push({ phone: num.phone, name: num.name });
        }
      });
    });

    setSearchResults(results.slice(0, 10));
  };

  const handleAddIndividual = (phone, name) => {
    const clean = phone.replace(/\D/g, '');
    if (selectedIndividuals.some(n => n.replace(/\D/g, '') === clean)) {
      toast.error('Already added');
      return;
    }
    setSelectedIndividuals([...selectedIndividuals, clean]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddManualNumber = () => {
    const normalized = normalizePhoneNumber(individualPhone, individualPhoneCountry);

    if (!normalized) {
      toast.error('Enter a valid international phone number');
      return;
    }

    const clean = normalized.e164.replace(/\D/g, '');
    if (selectedIndividuals.some(number => number.replace(/\D/g, '') === clean)) {
      toast.error('Already added');
      return;
    }

    setSelectedIndividuals([...selectedIndividuals, clean]);
    setIndividualPhone('');
    setIndividualPhoneCountry(normalized.country || individualPhoneCountry);
  };

  const toggleGroupContact = (phone) => {
    const clean = phone.replace(/\D/g, '');
    setSelectedGroupContacts(prev =>
      prev.includes(clean) ? prev.filter(item => item !== clean) : [...prev, clean]
    );
  };

  const handleRemoveIndividual = (phone) => {
    setSelectedIndividuals(selectedIndividuals.filter(n => n !== phone));
  };

  const handleSchedule = async () => {
    if (!campaignName.trim()) {
      toast.error('Enter campaign name');
      return;
    }
    if (!message.trim()) {
      toast.error('Enter message');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toast.error('Select date and time');
      return;
    }
    if (selectedGroupIds.length === 0 && selectedIndividuals.length === 0) {
      toast.error('Select at least one group or number');
      return;
    }

    setSubmitting(true);
    try {
      const dateTime = new Date(`${scheduleDate}T${scheduleTime}`);

      await scheduledAPI.createCampaign({
        name: campaignName,
        message,
        scheduledAt: dateTime.toISOString(),
        timezone: 'Asia/Kolkata',
        groupIds: selectedGroupIds,
        individualNumbers: [...selectedGroupContacts, ...selectedIndividuals].map(phone => ({ phone }))
      });

      toast.success('Campaign scheduled!');
      setShowScheduleForm(false);
      resetForm();
      await fetchCampaigns();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setCampaignName('');
    setMessage('');
    setAiPreset('best');
    setAiPrompt('');
    setAiGuidance('');
    setScheduleDate('');
    setScheduleTime('');
    setSelectedGroupIds([]);
    setSelectedGroupContacts([]);
    setIndividualPhone('');
    setIndividualPhoneCountry(DEFAULT_PHONE_COUNTRY);
    setSelectedIndividuals([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleDeleteCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;

    try {
      await scheduledAPI.deleteCampaign(id);
      toast.success('Campaign deleted');
      await fetchCampaigns();
    } catch (err) {
      toast.error('Failed to delete campaign');
    }
  };

  const handleCancelCampaign = async (id) => {
    if (!confirm('Cancel this campaign?')) return;

    try {
      await scheduledAPI.cancelCampaign(id);
      toast.success('Campaign cancelled');
      await fetchCampaigns();
    } catch (err) {
      toast.error('Failed to cancel campaign');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  const filteredCampaigns = campaigns.filter(c => {
    if (tab === 'upcoming') return c.status === 'pending';
    if (tab === 'completed') return c.status === 'completed';
    return true;
  });

  const totalContacts = getTotalContactsCount();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* NAVBAR */}

      {/* TABS */}
      <div className="border-b border-white/5 px-6 md:px-10 flex gap-8">
        {['upcoming', 'completed', 'all'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors cursor-pointer ${
              tab === t
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-400'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[#25D366]" size={28} />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No campaigns in this category</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map(campaign => {
              const badge = getStatusBadge(campaign.status);
              return (
                <div key={campaign._id} className="bg-[#111] border border-white/5 rounded-xl p-5 flex items-start justify-between hover:border-white/10 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">{campaign.name}</h3>
                      <div className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}>
                        {badge.label}
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
                      <Clock size={12} /> {formatDate(campaign.scheduledAt)}
                    </p>

                    <p className="text-sm text-gray-300 line-clamp-2 mb-3">
                      {campaign.message}
                    </p>

                    <div className="text-xs text-gray-500">
                      {campaign.groupIds?.length > 0 && (
                        <span>{campaign.groupIds.length} group{campaign.groupIds.length !== 1 ? 's' : ''}</span>
                      )}
                      {campaign.groupIds?.length > 0 && campaign.individualNumbers?.length > 0 && (
                        <span> + </span>
                      )}
                      {campaign.individualNumbers?.length > 0 && (
                        <span>{campaign.individualNumbers.length} individual{campaign.individualNumbers.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {campaign.status === 'completed' && (
                      <div className="flex gap-4 text-xs text-gray-400 mt-2">
                        <span className="flex items-center gap-1">
                          <CheckCircle size={12} className="text-[#25D366]" /> {campaign.sent} sent
                        </span>
                        {campaign.failed > 0 && (
                          <span className="flex items-center gap-1">
                            <AlertCircle size={12} className="text-red-400" /> {campaign.failed} failed
                          </span>
                        )}
                      </div>
                    )}

                    {campaign.status === 'failed' && campaign.failReason && (
                      <p className="text-xs text-red-400 mt-2">
                        Error: {campaign.failReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {campaign.status === 'pending' && (
                      <button
                        onClick={() => handleCancelCampaign(campaign._id)}
                        className="px-3 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                    {['completed', 'cancelled', 'failed'].includes(campaign.status) && (
                      <button
                        onClick={() => handleDeleteCampaign(campaign._id)}
                        className="p-2 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SCHEDULE FORM MODAL */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-[#111]">
              <h3 className="font-bold text-lg">
                Schedule Campaign
                <span className="text-xs text-gray-500 font-normal ml-2">(Step {step}/3)</span>
              </h3>
              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2">Campaign Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Diwali Promotion"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 block mb-2">Message</label>
                    <textarea
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                    />
                    {message && (
                      <p className="text-xs text-gray-600 text-right mt-1">{message.length} characters</p>
                    )}
                  </div>

                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-gray-400">Or Generate with AI</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        The default preset is tuned for the strongest all-purpose WhatsApp copy.
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-2">Preset</label>
                      <select
                        value={aiPreset}
                        onChange={(e) => setAiPreset(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
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
                      <select
                        value={aiTone}
                        onChange={(e) => setAiTone(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
                      >
                        {AI_TONES.map(item => <option key={item}>{item}</option>)}
                      </select>
                      <select
                        value={aiLanguage}
                        onChange={(e) => setAiLanguage(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
                      >
                        {AI_LANGUAGES.map(item => <option key={item}>{item}</option>)}
                      </select>
                      <select
                        value={aiFestival}
                        onChange={(e) => setAiFestival(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
                      >
                        {AI_FESTIVALS.map(item => <option key={item}>{item}</option>)}
                      </select>
                      <select
                        value={aiAudience}
                        onChange={(e) => setAiAudience(e.target.value)}
                        className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
                      >
                        {AI_AUDIENCES.map(item => <option key={item}>{item}</option>)}
                      </select>
                    </div>
                    {(aiTone === 'Other' || aiLanguage === 'Other' || aiFestival === 'Other' || aiAudience === 'Other') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {aiTone === 'Other' && (
                          <input
                            type="text"
                            placeholder="Custom tone"
                            value={customAiTone}
                            onChange={(e) => setCustomAiTone(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                          />
                        )}
                        {aiLanguage === 'Other' && (
                          <input
                            type="text"
                            placeholder="Custom language"
                            value={customAiLanguage}
                            onChange={(e) => setCustomAiLanguage(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                          />
                        )}
                        {aiFestival === 'Other' && (
                          <input
                            type="text"
                            placeholder="Custom festival or context"
                            value={customAiFestival}
                            onChange={(e) => setCustomAiFestival(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                          />
                        )}
                        {aiAudience === 'Other' && (
                          <input
                            type="text"
                            placeholder="Custom audience"
                            value={customAiAudience}
                            onChange={(e) => setCustomAiAudience(e.target.value)}
                            className="w-full px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                          />
                        )}
                      </div>
                    )}
                    <textarea
                      placeholder='Optional campaign prompt, e.g. "Friendly message about Diwali sale"'
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                    />
                    <textarea
                      placeholder='Optional AI guidance, e.g. "Use {{name}}, keep it premium, add urgency"'
                      value={aiGuidance}
                      onChange={(e) => setAiGuidance(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                    />
                    <button
                      onClick={handleAIGenerate}
                      disabled={aiLoading}
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold py-2 rounded-lg transition-colors text-sm cursor-pointer"
                    >
                      {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                      {aiLoading ? 'Generating...' : 'Generate'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-300 block mb-2">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        onClick={(e) => e.currentTarget.showPicker?.()}
                        onFocus={(e) => e.currentTarget.showPicker?.()}
                        className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366] transition-colors cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-300 block mb-2">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#25D366] transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-3">Select Groups</p>
                    {loadingGroups ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={16} className="animate-spin text-[#25D366]" />
                      </div>
                    ) : allGroups.length === 0 ? (
                      <p className="text-xs text-gray-500">No groups yet. <Link href="/dashboard/groups" className="text-[#25D366] hover:underline">Create one</Link></p>
                    ) : (
                      <div className="space-y-2">
                        {allGroups.map(group => (
                          <div key={group._id} className="p-3 bg-[#0a0a0a] border border-white/10 rounded-lg space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedGroupIds.includes(group._id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGroupIds([...selectedGroupIds, group._id]);
                                    setSelectedGroupContacts(selectedGroupContacts.filter(phone =>
                                      !(group.numbers || []).some(num => num.phone.replace(/\D/g, '') === phone)
                                    ));
                                  } else {
                                    setSelectedGroupIds(selectedGroupIds.filter(id => id !== group._id));
                                  }
                                }}
                                className="cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className="text-sm text-white">{group.name}</p>
                                <p className="text-xs text-gray-500">{group.count} contacts</p>
                              </div>
                            </label>

                            {!selectedGroupIds.includes(group._id) && (group.numbers || []).length > 0 && (
                              <div className="pl-6 space-y-2 max-h-40 overflow-y-auto">
                                {group.numbers.map((num, idx) => {
                                  const clean = num.phone.replace(/\D/g, '');
                                  return (
                                    <label key={`${clean}-${idx}`} className="flex items-start gap-2 text-xs cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectedGroupContacts.includes(clean)}
                                        onChange={() => toggleGroupContact(clean)}
                                        className="mt-0.5 cursor-pointer"
                                      />
                                      <span className="min-w-0">
                                        <span className="block text-white truncate">{num.name || 'Unnamed'}</span>
                                        <span className="block text-gray-500 truncate">{num.phone}</span>
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <p className="text-sm font-medium text-gray-300 mb-3">Add Individual Numbers</p>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-2">Search saved contacts</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search by name or number"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                          />
                          {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-white/10 rounded-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                              {searchResults.map((result, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleAddIndividual(result.phone, result.name)}
                                  className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm border-b border-white/5 last:border-0 transition-colors cursor-pointer"
                                >
                                  {result.name && <p className="text-white">{result.name}</p>}
                                  <p className="text-xs text-gray-500">{result.phone}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 block mb-2">Add manual number</label>
                        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 items-start">
                          <InternationalPhoneInput
                            value={individualPhone}
                            defaultCountry={individualPhoneCountry}
                            onChange={(phone, meta) => {
                              setIndividualPhone(phone);
                              setIndividualPhoneCountry(meta?.country?.iso2?.toUpperCase() || individualPhoneCountry);
                            }}
                            onCountryChange={setIndividualPhoneCountry}
                            placeholder="Phone number"
                            label={null}
                          />
                          <button
                            onClick={handleAddManualNumber}
                            className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {selectedIndividuals.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedIndividuals.map((phone, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-[#25D366]/10 border border-[#25D366]/30 rounded-full px-3 py-1 text-xs text-[#25D366]">
                              {formatPhoneNumber(phone)}
                              <button
                                onClick={() => handleRemoveIndividual(phone)}
                                className="hover:text-red-400 transition-colors cursor-pointer"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#0a0a0a] border border-[#25D366]/30 rounded-lg p-3">
                    <p className="text-sm font-medium text-[#25D366]">
                      {totalContacts} contacts selected
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Campaign Name</p>
                      <p className="text-white font-medium mt-1">{campaignName}</p>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</p>
                      <p className="text-white font-medium mt-1">
                        {formatDate(new Date(`${scheduleDate}T${scheduleTime}`).toISOString())}
                      </p>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Message Preview</p>
                      <p className="text-white font-medium mt-1 line-clamp-3">{message}</p>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Recipients</p>
                      <p className="text-white font-medium mt-1">{totalContacts} contacts</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 p-6 flex gap-3 sticky bottom-0 bg-[#111]">
              {step > 1 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Back
                </button>
              )}

              {step < 3 && (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    (step === 1 && (!campaignName.trim() || !message.trim() || !scheduleDate || !scheduleTime)) ||
                    (step === 2 && totalContacts === 0)
                  }
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  Next <ChevronRight size={16} />
                </button>
              )}

              {step === 3 && (
                <button
                  onClick={handleSchedule}
                  disabled={submitting}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  {submitting ? 'Scheduling...' : 'Schedule'}
                </button>
              )}

              <button
                onClick={() => {
                  setShowScheduleForm(false);
                  resetForm();
                }}
                className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
