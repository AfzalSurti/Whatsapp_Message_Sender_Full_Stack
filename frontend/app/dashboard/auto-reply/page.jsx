'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Bot,
  Loader2,
  Search,
  SkipForward,
  Trash2,
  X,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { autoReplyAPI, groupsAPI } from '@/lib/api';
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
  const [mode, setMode] = useState('all');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a helpful WhatsApp assistant. Reply naturally and concisely.'
  );
  const [delay, setDelay] = useState(2000);

  const [whatsappContacts, setWhatsappContacts] = useState([]);
  const [savedContacts, setSavedContacts] = useState([]);
  const [savedContactsLoading, setSavedContactsLoading] = useState(false);
  const [contactSource, setContactSource] = useState('saved');
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

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await autoReplyAPI.getConfig();
      const config = res.data.config;
      setIsEnabled(Boolean(config.isEnabled));
      setMode(config.mode || 'all');
      setSelectedContacts(config.selectedContacts || []);
      setSystemPrompt(
        config.systemPrompt ||
          'You are a helpful WhatsApp assistant. Reply naturally and concisely.'
      );
      setDelay(config.delay || 2000);
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

  const fetchWhatsAppContacts = useCallback(async () => {
    if (!waConnected) {
      setContactsError('Connect WhatsApp from the header, then click Refresh.');
      setWhatsappContacts([]);
      return;
    }

    setContactsLoading(true);
    setContactsError('');

    try {
      const res = await autoReplyAPI.getWhatsAppContacts();
      setWhatsappContacts(res.data.contacts || []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load WhatsApp contacts';
      setContactsError(message);
      setWhatsappContacts([]);
    } finally {
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
    if (!user) return;
    fetchConfig();
    fetchLogContacts();
    fetchSavedContacts();
  }, [user, fetchConfig, fetchLogContacts, fetchSavedContacts]);

  useEffect(() => {
    if (!user || mode !== 'selected' || contactSource !== 'whatsapp' || !waConnected) return;
    fetchWhatsAppContacts();
  }, [user, mode, contactSource, waConnected, fetchWhatsAppContacts]);

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
      fetchLogContacts();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [user, fetchLogs, fetchLogContacts]);

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

    setSelectedContacts((prev) => {
      const isSelected = prev.includes(value) || (chatId && prev.includes(chatId));
      if (isSelected) {
        return prev.filter((item) => item !== value && item !== chatId);
      }
      return [...prev, value];
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await autoReplyAPI.updateConfig({
        isEnabled,
        mode,
        selectedContacts,
        systemPrompt,
        delay
      });
      const config = res.data.config;
      setIsEnabled(Boolean(config.isEnabled));
      setMode(config.mode || 'all');
      setSelectedContacts(config.selectedContacts || []);
      setSystemPrompt(config.systemPrompt || systemPrompt);
      setDelay(config.delay || delay);
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT PANEL — Configuration */}
        <div className="xl:col-span-1 bg-[#111] border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-[#25D366]" />
                <h1 className="text-xl font-bold">Auto-Reply Bot</h1>
              </div>
              <p className="text-sm text-gray-400 mt-1">Configure AI replies for incoming WhatsApp messages.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsEnabled((prev) => !prev)}
              className={`relative w-12 h-7 rounded-full transition-colors ${isEnabled ? 'bg-[#25D366]' : 'bg-zinc-700'}`}
              aria-label="Toggle auto-reply bot"
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${isEnabled ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${isEnabled ? 'bg-[#25D366]' : 'bg-red-500'}`} />
            <span className={isEnabled ? 'text-[#25D366]' : 'text-red-400'}>
              {isEnabled ? 'Bot is Active' : 'Bot is Off'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-300">Reply Mode</div>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'all'}
                onChange={() => setMode('all')}
                className="accent-[#25D366]"
              />
              All Messages
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="radio"
                name="mode"
                checked={mode === 'selected'}
                onChange={() => setMode('selected')}
                className="accent-[#25D366]"
              />
              Selected Contacts
            </label>
          </div>

          {mode === 'selected' && (
            <div className="space-y-3 border border-white/5 rounded-xl p-3 bg-[#0a0a0a]">
              <div className="flex gap-1 p-1 bg-[#111] rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setContactSource('saved')}
                  className={`flex-1 text-xs py-2 rounded-lg transition-colors ${
                    contactSource === 'saved'
                      ? 'bg-[#25D366] text-black font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Saved Contacts
                </button>
                <button
                  type="button"
                  onClick={() => setContactSource('whatsapp')}
                  className={`flex-1 text-xs py-2 rounded-lg transition-colors ${
                    contactSource === 'whatsapp'
                      ? 'bg-[#25D366] text-black font-semibold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  WhatsApp Chats
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder={
                      contactSource === 'saved'
                        ? 'Search saved contacts...'
                        : 'Search WhatsApp chats...'
                    }
                    className="w-full bg-[#111] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#25D366]/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={
                    contactSource === 'saved' ? fetchSavedContacts : fetchWhatsAppContacts
                  }
                  disabled={contactSource === 'saved' ? savedContactsLoading : contactsLoading}
                  className="text-xs border border-white/10 hover:border-[#25D366]/40 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
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
                <p className="text-xs text-gray-500">
                  Numbers from your Contacts page. No WhatsApp connection required.
                </p>
              )}

              {contactSource === 'whatsapp' && !waConnected && (
                <p className="text-xs text-amber-400">
                  Connect WhatsApp from the header, then click Refresh.
                </p>
              )}

              <div className="max-h-48 overflow-y-auto space-y-2">
                {contactSource === 'saved' ? (
                  savedContactsLoading ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 size={18} className="animate-spin text-[#25D366]" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No saved contacts yet. Add numbers on the Contacts page first.
                    </p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <label
                        key={contact.id || contact.chatId || contact.phoneNumber}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isContactChecked(contact)}
                          onChange={() => toggleContact(contact)}
                          className="mt-1 accent-[#25D366]"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{contact.name}</div>
                          <div className="text-xs text-gray-400">{contact.phoneNumber}</div>
                          {contact.groupName && (
                            <div className="text-[10px] text-gray-500 mt-0.5">{contact.groupName}</div>
                          )}
                        </div>
                      </label>
                    ))
                  )
                ) : contactsLoading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 size={18} className="animate-spin text-[#25D366]" />
                  </div>
                ) : contactsError ? (
                  <p className="text-xs text-amber-400">{contactsError}</p>
                ) : filteredContacts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No WhatsApp chats found. Click Refresh after connecting.
                  </p>
                ) : (
                  filteredContacts.map((contact) => (
                    <label
                      key={contact.chatId || contact.phoneNumber}
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isContactChecked(contact)}
                        onChange={() => toggleContact(contact)}
                        className="mt-1 accent-[#25D366]"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{contact.name}</div>
                        {contact.phoneNumber ? (
                          <div className="text-xs text-gray-400">{contact.phoneNumber}</div>
                        ) : null}
                      </div>
                    </label>
                  ))
                )}
              </div>

              {selectedContacts.length > 0 && (
                <p className="text-xs text-gray-500">
                  {selectedContacts.length} contact{selectedContacts.length === 1 ? '' : 's'} selected
                </p>
              )}

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-300">
                    Added numbers ({selectedContacts.length})
                  </span>
                  {selectedContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedContacts([])}
                      className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {selectedContacts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No numbers added yet. Check contacts above, then save settings.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {selectedContactDetails.map((item) => (
                      <div
                        key={item.value}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#111] border border-white/5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-medium truncate">{item.name}</div>
                          {item.subtitle ? (
                            <div className="text-[10px] text-gray-500 truncate">{item.subtitle}</div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelectedContact(item.value)}
                          className="shrink-0 text-gray-500 hover:text-red-400 transition-colors p-1"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">AI Personality</label>
            <p className="text-xs text-gray-500">How should AI behave?</p>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={5}
              placeholder="You are a helpful assistant..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#25D366]/40 resize-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-300">Response Delay</span>
              <span className="text-[#25D366]">{(delay / 1000).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min={1000}
              max={10000}
              step={500}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full accent-[#25D366]"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1s</span>
              <span>10s</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Settings
          </button>
        </div>

        {/* RIGHT PANEL — Conversation Logs */}
        <div className="xl:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Conversation History</h2>
              <p className="text-sm text-gray-400 mt-1">
                Incoming messages and AI replies.
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
              className="text-xs border border-white/10 hover:border-red-400/40 hover:text-red-400 disabled:opacity-40 px-3 py-2 rounded-xl transition-colors"
            >
              {clearing ? 'Clearing...' : 'Clear All'}
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-gray-500">Filter by contact</label>
              {contactFilter && (
                <button
                  type="button"
                  onClick={() => setContactFilter('')}
                  className="text-[10px] text-gray-400 hover:text-white transition-colors"
                >
                  Show all
                </button>
              )}
            </div>
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              className="w-full sm:w-72 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#25D366]/40"
            >
              <option value="">All contacts ({logContacts.length})</option>
              {logContacts.map((contact) => (
                <option key={contact.contactPhone} value={contact.contactPhone}>
                  {contact.contactName || contact.contactPhone} ({contact.messageCount || 0} msgs)
                </option>
              ))}
            </select>

            {logContacts.length > 0 && (
              <div className="border border-white/5 rounded-xl bg-[#0a0a0a] p-3 space-y-2">
                <div className="text-xs font-medium text-gray-300">
                  Contacts in history ({logContacts.length})
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {logContacts.map((contact) => {
                    const isActive = contactFilter === contact.contactPhone;
                    const isDeleting = deletingContactPhone === contact.contactPhone;

                    return (
                      <div
                        key={contact.contactPhone}
                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
                          isActive
                            ? 'border-[#25D366]/30 bg-[#25D366]/5'
                            : 'border-white/5 bg-[#111]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setContactFilter(contact.contactPhone)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="text-xs font-medium truncate">
                            {contact.contactName || 'Unknown contact'}
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {contact.contactPhone}
                            {contact.messageCount ? ` · ${contact.messageCount} message${contact.messageCount === 1 ? '' : 's'}` : ''}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteContactLogs(contact.contactPhone)}
                          disabled={isDeleting}
                          className="shrink-0 text-gray-500 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                          aria-label={`Delete history for ${contact.contactName || contact.contactPhone}`}
                        >
                          {isDeleting ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {logsLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#25D366]" size={28} />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm border border-dashed border-white/10 rounded-xl">
              No conversations yet. Enable the bot to start.
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const status = statusConfig[log.status] || statusConfig.skipped;

                return (
                  <div key={log._id} className="border border-white/5 rounded-xl p-4 bg-[#0a0a0a] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          {log.contactName || 'Unknown contact'}
                        </div>
                        <div className="text-xs text-gray-400">{log.contactPhone}</div>
                        <div className="text-xs text-gray-500 mt-1">{formatDate(log.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full border ${status.className}`}>
                          {status.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log._id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                          aria-label="Delete log entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="max-w-[85%] bg-zinc-800 border border-white/5 rounded-2xl rounded-tl-sm px-3 py-2 text-sm">
                        {log.incomingMessage}
                      </div>

                      {log.aiReply ? (
                        <div className="max-w-[85%] ml-auto bg-[#25D366]/15 border border-[#25D366]/20 rounded-2xl rounded-tr-sm px-3 py-2 text-sm">
                          {log.aiReply}
                        </div>
                      ) : log.status === 'failed' ? (
                        <div className="max-w-[85%] ml-auto text-xs text-red-400 flex items-center gap-1">
                          <XCircle size={13} />
                          {log.failReason || 'Reply failed'}
                        </div>
                      ) : (
                        <div className="max-w-[85%] ml-auto text-xs text-yellow-400 flex items-center gap-1">
                          <SkipForward size={13} />
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
                className="text-sm border border-white/10 hover:border-[#25D366]/40 hover:text-[#25D366] px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Loading...
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
  );
}
