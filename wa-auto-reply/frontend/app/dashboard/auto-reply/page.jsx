'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bot,
  Layers,
  Loader2,
  Search,
  SkipForward,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { aiTemplateAPI, autoReplyAPI, groupsAPI } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import { cachedRequest } from '@/lib/requestCache';
import { useDashboardShell } from '../DashboardShellContext';

const statusConfig = {
  sent: {
    label: 'Sent',
    className: 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366]'
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/10 border-red-500/20 text-red-400'
  },
  skipped: {
    label: 'Skipped',
    className: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
  }
};

const formatDate = (date) =>
  new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

export default function AutoReplyPage() {
  const { user, loading } = useAuth();
  const { waStatus } = useDashboardShell();
  const router = useRouter();
  const waConnected = waStatus === 'connected';

  const [configLoading, setConfigLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [isEnabled, setIsEnabled] = useState(false);
  const [mode, setMode] = useState('smart');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [aiTemplates, setAiTemplates] = useState([]);
  const [enabledTemplateIds, setEnabledTemplateIds] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  const [whatsappContacts, setWhatsappContacts] = useState([]);
  const whatsappFetchInFlightRef = useRef(false);
  const [savedContacts, setSavedContacts] = useState([]);
  const [savedContactsLoading, setSavedContactsLoading] = useState(false);
  const [contactSource, setContactSource] = useState('whatsapp');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const [logs, setLogs] = useState([]);
  const [logContacts, setLogContacts] = useState([]);
  const [contactFilter, setContactFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingContactPhone, setDeletingContactPhone] = useState('');

  const latestLogIdRef = useRef(null);
  const pollInitializedRef = useRef(false);
  const initLoadedRef = useRef(false);
  const whatsappLoadedRef = useRef(false);

  const fetchAiTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await aiTemplateAPI.getTemplates();
      setAiTemplates(res.data.templates || []);
    } catch {
      setAiTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await autoReplyAPI.getConfig();
      const config = res.data.config;
      setIsEnabled(Boolean(config.isEnabled));
      setMode(config.mode === 'all' || config.mode === 'selected' ? 'smart' : config.mode || 'smart');
      setSelectedContacts(config.selectedContacts || []);
      setEnabledTemplateIds((config.enabledTemplateIds || []).map((id) => String(id)));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load auto-reply settings');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const fetchSavedContacts = useCallback(async () => {
    setSavedContactsLoading(true);
    try {
      const res = await groupsAPI.getGroups();
      const groups = res.data.groups || [];
      const flattened = [];
      const seenPhones = new Set();

      for (const group of groups) {
        for (const entry of group.numbers || []) {
          const phone = String(entry.phone || '').trim();
          if (!phone || seenPhones.has(phone)) continue;
          seenPhones.add(phone);
          flattened.push({
            id: `${group._id}-${phone}`,
            name: entry.name?.trim() || phone,
            phoneNumber: phone,
            groupName: group.name,
            source: 'saved'
          });
        }
      }

      flattened.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setSavedContacts(flattened);
    } catch {
      // Non-blocking; saved contacts are optional fallback
    } finally {
      setSavedContactsLoading(false);
    }
  }, []);

  const fetchWhatsAppContacts = useCallback(async ({ force = false } = {}) => {
    if (!waConnected) {
      setContactsError('Connect WhatsApp from the header, then click Refresh.');
      setWhatsappContacts([]);
      return;
    }

    if (whatsappFetchInFlightRef.current) return;

    whatsappFetchInFlightRef.current = true;
    setContactsLoading(true);
    setContactsError('');

    try {
      const contacts = await cachedRequest(
        'whatsapp-picker-contacts',
        async () => {
          const res = await autoReplyAPI.getWhatsAppContacts({ force });
          return res.data.contacts || [];
        },
        { force, ttlMs: 60000 }
      );
      setWhatsappContacts(contacts);
      whatsappLoadedRef.current = true;
    } catch (err) {
      const message = err.code === 'ECONNABORTED'
        ? 'Loading contacts is taking longer than usual. Please wait and try Refresh again.'
        : (err.response?.data?.error || err.message || 'Failed to load WhatsApp contacts');
      setContactsError(message);
      setWhatsappContacts([]);
    } finally {
      whatsappFetchInFlightRef.current = false;
      setContactsLoading(false);
    }
  }, [waConnected]);

  const fetchLogContacts = useCallback(async () => {
    try {
      const res = await autoReplyAPI.getContacts();
      setLogContacts(res.data.contacts || []);
    } catch {
      // Non-blocking for the page
    }
  }, []);

  const fetchLogs = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLogsLoading(true);

      try {
        const params = { page: 1, limit: 20 };
        if (contactFilter) params.contactPhone = contactFilter;

        const res = await autoReplyAPI.getLogs(params);
        const incomingLogs = res.data.logs || [];

        setLogs(incomingLogs);
        setPage(1);
        setTotalPages(res.data.pages || 1);

        if (incomingLogs.length > 0) {
          const newestId = incomingLogs[0]._id;

          if (pollInitializedRef.current && latestLogIdRef.current && newestId !== latestLogIdRef.current) {
            toast.success('New message');
          }

          latestLogIdRef.current = newestId;
          pollInitializedRef.current = true;
        }
      } catch (err) {
        if (!silent) {
          toast.error(err.response?.data?.error || 'Failed to load conversation logs');
        }
      } finally {
        setLogsLoading(false);
      }
    },
    [contactFilter]
  );

  const loadMoreLogs = async () => {
    if (page >= totalPages) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = { page: nextPage, limit: 20 };
      if (contactFilter) params.contactPhone = contactFilter;

      const res = await autoReplyAPI.getLogs(params);
      setLogs((prev) => [...prev, ...(res.data.logs || [])]);
      setPage(nextPage);
      setTotalPages(res.data.pages || 1);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load more logs');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || initLoadedRef.current) return;
    initLoadedRef.current = true;

    fetchConfig();
    fetchAiTemplates();
    fetchLogContacts();
    fetchSavedContacts();
  }, [user, fetchConfig, fetchAiTemplates, fetchLogContacts, fetchSavedContacts]);

  const activeAiTemplates = useMemo(
    () => aiTemplates.filter((template) => template.isActive !== false),
    [aiTemplates]
  );

  useEffect(() => {
    if (templatesLoading || configLoading) return;
    if (enabledTemplateIds.length > 0) return;
    if (activeAiTemplates.length === 0) return;

    setEnabledTemplateIds(activeAiTemplates.map((template) => String(template._id)));
  }, [templatesLoading, configLoading, enabledTemplateIds.length, activeAiTemplates]);

  useEffect(() => {
    if (!user || contactSource !== 'whatsapp' || !waConnected || whatsappLoadedRef.current) return;
    fetchWhatsAppContacts();
  }, [user, contactSource, waConnected, fetchWhatsAppContacts]);

  useEffect(() => {
    if (!user) return;
    pollInitializedRef.current = false;
    latestLogIdRef.current = null;
    fetchLogs();
  }, [user, contactFilter, fetchLogs]);

  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      fetchLogs({ silent: true });
    }, 45000);

    return () => clearInterval(intervalId);
  }, [user, fetchLogs]);

  const getContactSelectionValue = (contact) => {
    const phone = String(contact.phoneNumber || '').trim();
    if (phone && !phone.includes('@')) return phone;
    return contact.chatId || phone;
  };

  const activeContacts = contactSource === 'saved' ? savedContacts : whatsappContacts;

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return activeContacts;

    return activeContacts.filter((contact) => {
      const name = String(contact.name || '').toLowerCase();
      const phone = String(contact.phoneNumber || '').toLowerCase();
      const chatId = String(contact.chatId || '').toLowerCase();
      const groupName = String(contact.groupName || '').toLowerCase();
      return (
        name.includes(query) ||
        phone.includes(query) ||
        chatId.includes(query) ||
        groupName.includes(query)
      );
    });
  }, [activeContacts, contactSearch]);

  const isContactChecked = (contact) => {
    const value = getContactSelectionValue(contact);
    const chatId = contact.chatId;
    return selectedContacts.includes(value) || (chatId && selectedContacts.includes(chatId));
  };

  const toggleContact = (contact) => {
    const value = getContactSelectionValue(contact);
    const chatId = contact.chatId;
    const keys = [...new Set([value, chatId].filter(Boolean))];

    setSelectedContacts((prev) => {
      const isSelected = keys.some((key) => prev.includes(key));
      if (isSelected) {
        return prev.filter((item) => !keys.includes(item));
      }
      return [...prev, ...keys.filter((key) => !prev.includes(key))];
    });
  };

  const removeSelectedContact = (value) => {
    setSelectedContacts((prev) => prev.filter((item) => item !== value));
  };

  const selectedContactDetails = useMemo(() => {
    return selectedContacts.map((value) => {
      const saved = savedContacts.find(
        (contact) => contact.phoneNumber === value || contact.chatId === value
      );
      const whatsapp = whatsappContacts.find(
        (contact) => contact.phoneNumber === value || contact.chatId === value
      );
      const fromLog = logContacts.find((contact) => contact.contactPhone === value);

      return {
        value,
        name: saved?.name || whatsapp?.name || fromLog?.contactName || value,
        subtitle:
          value.includes('@') || value === saved?.name || value === whatsapp?.name
            ? ''
            : value
      };
    });
  }, [selectedContacts, savedContacts, whatsappContacts, logContacts]);

  const toggleTemplateSelection = (templateId) => {
    const id = String(templateId);
    setEnabledTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (activeAiTemplates.length > 0 && enabledTemplateIds.length === 0) {
      toast.error('Select at least one AI template for auto-reply');
      return;
    }

    setSaving(true);
    try {
      const res = await autoReplyAPI.updateConfig({
        isEnabled,
        mode: 'smart',
        selectedContacts,
        enabledTemplateIds
      });
      const config = res.data.config;
      setIsEnabled(Boolean(config.isEnabled));
      setMode(config.mode === 'all' || config.mode === 'selected' ? 'smart' : config.mode || 'smart');
      setSelectedContacts(config.selectedContacts || []);
      setEnabledTemplateIds((config.enabledTemplateIds || []).map((id) => String(id)));
      toast.success('Auto-reply settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLog = async (id) => {
    try {
      await autoReplyAPI.deleteLog(id);
      setLogs((prev) => prev.filter((log) => log._id !== id));
      toast.success('Log deleted');
      fetchLogContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete log');
    }
  };

  const handleDeleteContactLogs = async (contactPhone) => {
    const label =
      logContacts.find((contact) => contact.contactPhone === contactPhone)?.contactName ||
      contactPhone;

    if (!window.confirm(`Delete all conversation history for ${label}?`)) return;

    setDeletingContactPhone(contactPhone);
    try {
      await autoReplyAPI.deleteContactLogs(contactPhone);
      setLogs((prev) => prev.filter((log) => log.contactPhone !== contactPhone));
      if (contactFilter === contactPhone) setContactFilter('');
      toast.success('Contact history deleted');
      fetchLogContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete contact history');
    } finally {
      setDeletingContactPhone('');
    }
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await autoReplyAPI.clearLogs();
      setLogs([]);
      setLogContacts([]);
      latestLogIdRef.current = null;
      pollInitializedRef.current = false;
      toast.success('Conversation history cleared');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  if (loading || configLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  const formatContactPhone = (phone) => {
    if (!phone || String(phone).includes('@')) return phone;
    return formatPhoneNumber(phone) || phone;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Auto Reply</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure AI replies and review incoming WhatsApp conversations.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT PANEL — Configuration */}
        <div className="xl:col-span-2 bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#25D366]/10">
                  <Bot size={20} className="text-[#25D366]" />
                </div>
                <h2 className="text-lg font-bold">Bot Settings</h2>
              </div>
              <p className="text-sm text-gray-400 mt-2">Turn the bot on and choose who gets automatic replies.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled((prev) => !prev)}
              className={`relative w-14 h-8 rounded-full transition-colors shrink-0 ${isEnabled ? 'bg-[#25D366]' : 'bg-zinc-700'}`}
              aria-label="Toggle auto-reply bot"
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${isEnabled ? 'left-7' : 'left-1'}`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2.5 text-sm font-medium">
            <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-[#25D366]' : 'bg-red-500'}`} />
            <span className={isEnabled ? 'text-[#25D366]' : 'text-red-400'}>
              {isEnabled ? 'Bot is Active' : 'Bot is Off'}
            </span>
          </div>

          <div className="rounded-xl border border-[#25D366]/20 bg-[#25D366]/5 p-4 space-y-2">
            <div className="text-sm font-semibold text-[#25D366]">Who gets auto-replies</div>
            <ul className="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-white">New numbers</strong> — anyone not in your Contacts page gets
                replies using <strong className="text-white">all active AI templates</strong>
              </li>
              <li>
                <strong className="text-white">Selected chats</strong> — WhatsApp chats you pick below also get
                auto-reply (uses templates you enable)
              </li>
              <li>
                Saved contacts are skipped unless you add them from WhatsApp Chats
              </li>
            </ul>
          </div>

          <div className="space-y-4 border border-white/10 rounded-2xl p-4 bg-[#0a0a0a]">
            <div className="text-sm font-semibold text-gray-200">Also reply to these chats</div>
            <p className="text-xs text-gray-500">
              Pick WhatsApp chats to include even if they are already in your Contacts list.
            </p>

            <div className="inline-flex w-full p-1 rounded-xl bg-[#111] border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => setContactSource('saved')}
                className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                  contactSource === 'saved'
                    ? 'bg-[#25D366] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Saved Contacts
              </button>
              <button
                type="button"
                onClick={() => {
                  setContactSource('whatsapp');
                  if (waConnected && !whatsappLoadedRef.current) {
                    fetchWhatsAppContacts();
                  }
                }}
                className={`flex-1 text-sm py-2.5 rounded-lg font-medium transition-colors ${
                  contactSource === 'whatsapp'
                    ? 'bg-[#25D366] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                WhatsApp Chats
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  placeholder={
                    contactSource === 'saved'
                      ? 'Search saved contacts...'
                      : 'Search WhatsApp chats...'
                  }
                  className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-[#25D366]/40"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (contactSource === 'saved') {
                    fetchSavedContacts();
                    return;
                  }
                  fetchWhatsAppContacts({ force: true });
                }}
                disabled={contactSource === 'saved' ? savedContactsLoading : contactsLoading}
                className="text-sm border border-white/10 hover:border-[#25D366]/40 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
              >
                {contactSource === 'saved'
                  ? savedContactsLoading
                    ? 'Loading...'
                    : 'Refresh'
                  : contactsLoading
                    ? 'Loading...'
                    : 'Refresh'}
              </button>
            </div>

            {contactSource === 'saved' && (
              <p className="text-sm text-gray-500">
                Add saved contacts here if you want the bot to reply to them too.
              </p>
            )}

            {contactSource === 'whatsapp' && !waConnected && (
              <p className="text-sm text-amber-400">
                Connect WhatsApp from the header, then click Refresh.
              </p>
            )}

            <div className="max-h-52 overflow-y-auto space-y-1">
                {contactSource === 'saved' ? (
                  savedContactsLoading ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 size={18} className="animate-spin text-[#25D366]" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">
                      No saved contacts yet.{' '}
                      <Link href="/dashboard/contacts" className="text-[#25D366] hover:underline">
                        Add numbers on the Contacts page
                      </Link>{' '}
                      first.
                    </p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <label
                        key={contact.id || contact.chatId || contact.phoneNumber}
                        className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={isContactChecked(contact)}
                          onChange={() => toggleContact(contact)}
                          className="mt-0.5 accent-[#25D366] w-4 h-4"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{contact.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{formatContactPhone(contact.phoneNumber)}</div>
                          {contact.groupName && (
                            <div className="text-xs text-gray-500 mt-1">{contact.groupName}</div>
                          )}
                        </div>
                      </label>
                    ))
                  )
                ) : contactsLoading ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 size={22} className="animate-spin text-[#25D366]" />
                  </div>
                ) : contactsError ? (
                  <p className="text-sm text-amber-400 py-2">{contactsError}</p>
                ) : filteredContacts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">
                    No WhatsApp chats found. Click Refresh after connecting.
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact.chatId || contact.phoneNumber}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={isContactChecked(contact)}
                        onChange={() => toggleContact(contact)}
                        className="mt-0.5 accent-[#25D366] w-4 h-4"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{contact.name}</div>
                        {contact.phoneNumber ? (
                          <div className="text-xs text-gray-400 mt-0.5">{formatContactPhone(contact.phoneNumber)}</div>
                        ) : null}
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-200">
                    Added numbers ({selectedContacts.length})
                  </span>
                  {selectedContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedContacts([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {selectedContacts.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No numbers added yet. Check contacts above, then save settings.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {selectedContactDetails.map((item) => (
                      <div
                        key={item.value}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#111] border border-white/10"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{item.name}</div>
                          {item.subtitle ? (
                            <div className="text-xs text-gray-500 truncate mt-0.5">{formatContactPhone(item.subtitle)}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelectedContact(item.value)}
                          className="shrink-0 text-gray-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-500/10"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          <div className="space-y-3 border border-white/10 rounded-2xl p-4 bg-[#0a0a0a]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
                  <Layers size={16} className="text-[#25D366]" />
                  AI Templates for Auto Reply
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  New numbers use every active template. Selected chats use the templates you check below.
                  If none match, AI Personality is used.
                </p>
              </div>
              <Link
                href="/dashboard/ai-templates"
                className="text-xs text-[#25D366] hover:underline shrink-0"
              >
                Manage
              </Link>
            </div>

            {templatesLoading ? (
              <div className="py-4 flex justify-center">
                <Loader2 size={18} className="animate-spin text-[#25D366]" />
              </div>
            ) : activeAiTemplates.length === 0 ? (
              <p className="text-sm text-gray-500">
                No active templates yet.{' '}
                <Link href="/dashboard/ai-templates" className="text-[#25D366] hover:underline">
                  Create one
                </Link>{' '}
                and turn it on.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {enabledTemplateIds.length} of {activeAiTemplates.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEnabledTemplateIds(activeAiTemplates.map((t) => String(t._id)))
                    }
                    className="text-[#25D366] hover:underline"
                  >
                    Select all
                  </button>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {activeAiTemplates.map((template) => {
                    const checked = enabledTemplateIds.includes(String(template._id));
                    return (
                      <label
                        key={template._id}
                        className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
                          checked
                            ? 'bg-[#25D366]/10 border-[#25D366]/20'
                            : 'bg-[#111] border-white/10 hover:border-white/20'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplateSelection(template._id)}
                          className="accent-[#25D366] mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                            {template.description}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            {aiTemplates.some((template) => template.isActive === false) && (
              <p className="text-xs text-gray-500">
                Turned-off templates are hidden. Enable them on the AI Templates page.
              </p>
            )}

            <p className="text-xs text-gray-500">
              AI personality and response delay are configured in{' '}
              <Link href="/dashboard/settings" className="text-[#25D366] hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Save Settings
          </button>
        </div>

        {/* RIGHT PANEL — Conversation Logs */}
        <div className="xl:col-span-3 bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Conversation History</h2>
              <p className="text-sm text-gray-400 mt-1">
                Incoming messages and AI replies
                {logContacts.length > 0 && (
                  <span className="text-gray-500">
                    {' '}
                    · {logContacts.length} contact{logContacts.length === 1 ? '' : 's'}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearLogs}
              disabled={clearing || logs.length === 0}
              className="text-sm border border-white/10 hover:border-red-400/40 hover:text-red-400 disabled:opacity-40 px-4 py-2.5 rounded-xl transition-colors shrink-0"
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          </div>

          {logContacts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-200">Filter by contact</span>
                {contactFilter && (
                  <button
                    type="button"
                    onClick={() => setContactFilter('')}
                    className="text-xs text-[#25D366] hover:underline font-medium"
                  >
                    Show all
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setContactFilter('')}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    !contactFilter
                      ? 'bg-[#25D366] text-black border-[#25D366]'
                      : 'bg-[#0a0a0a] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  All ({logContacts.reduce((sum, c) => sum + (c.messageCount || 0), 0)})
                </button>
                {logContacts.map((contact) => {
                  const isActive = contactFilter === contact.contactPhone;
                  return (
                    <button
                      key={contact.contactPhone}
                      type="button"
                      onClick={() => setContactFilter(contact.contactPhone)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                        isActive
                          ? 'bg-[#25D366] text-black border-[#25D366]'
                          : 'bg-[#0a0a0a] border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                      }`}
                    >
                      {contact.contactName || 'Unknown'} ({contact.messageCount || 0})
                    </button>
                  );
                })}
              </div>

              <div className="border border-white/10 rounded-2xl bg-[#0a0a0a] divide-y divide-white/5">
                {logContacts.map((contact) => {
                  const isActive = contactFilter === contact.contactPhone;
                  const isDeleting = deletingContactPhone === contact.contactPhone;

                  return (
                    <div
                      key={contact.contactPhone}
                      className={`flex items-center justify-between gap-3 p-4 ${isActive ? 'bg-[#25D366]/5' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => setContactFilter(contact.contactPhone)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="text-sm font-semibold truncate">
                          {contact.contactName || 'Unknown contact'}
                        </div>
                        <div className="text-xs text-gray-400 truncate mt-1">
                          {formatContactPhone(contact.contactPhone)}
                          {contact.messageCount
                            ? ` · ${contact.messageCount} message${contact.messageCount === 1 ? '' : 's'}`
                            : ''}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContactLogs(contact.contactPhone)}
                        disabled={isDeleting}
                        className="shrink-0 flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
                        aria-label={`Delete history for ${contact.contactName || contact.contactPhone}`}
                      >
                        {isDeleting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <Trash2 size={15} />
                            Delete
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {logsLoading ? (
            <div className="py-20 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#25D366]" size={32} />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
              <Bot size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No conversations yet. Enable the bot to start.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const status = statusConfig[log.status] || statusConfig.skipped;

                return (
                  <div key={log._id} className="border border-white/10 rounded-2xl p-5 bg-[#0a0a0a] space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-base font-semibold">
                          {log.contactName || 'Unknown contact'}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">{formatContactPhone(log.contactPhone)}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatDate(log.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${status.className}`}>
                          {status.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log._id)}
                          className="text-gray-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10"
                          aria-label="Delete log entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="max-w-[85%] bg-zinc-800 border border-white/5 rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed">
                        {log.incomingMessage}
                      </div>

                      {log.aiReply ? (
                        <div className="max-w-[85%] ml-auto bg-[#25D366]/15 border border-[#25D366]/20 rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed">
                          {log.aiReply}
                        </div>
                      ) : log.status === 'failed' ? (
                        <div className="max-w-[85%] ml-auto text-sm text-red-400 flex items-center gap-1.5">
                          <XCircle size={15} />
                          {log.failReason || 'Reply failed'}
                        </div>
                      ) : (
                        <div className="max-w-[85%] ml-auto text-sm text-yellow-400 flex items-center gap-1.5">
                          <SkipForward size={15} />
                          No reply sent
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {page < totalPages && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMoreLogs}
                disabled={loadingMore}
                className="text-sm border border-white/10 hover:border-[#25D366]/40 hover:text-[#25D366] px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 font-medium"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading...
                  </span>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
