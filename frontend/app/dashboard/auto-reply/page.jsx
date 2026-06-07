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
  XCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { autoReplyAPI, whatsappAPI } from '@/lib/api';

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
  const router = useRouter();

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
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [waConnected, setWaConnected] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  const [logs, setLogs] = useState([]);
  const [logContacts, setLogContacts] = useState([]);
  const [contactFilter, setContactFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const fetchWhatsAppContacts = useCallback(async () => {
    setContactsLoading(true);
    setContactsError('');

    try {
      const statusRes = await whatsappAPI.getStatus();
      const connected = statusRes.data.status === 'connected' && statusRes.data.clientReady;
      setWaConnected(connected);

      if (!connected) {
        setContactsError('Connect WhatsApp first, then click Refresh.');
        setWhatsappContacts([]);
        return;
      }

      const res = await autoReplyAPI.getWhatsAppContacts();
      setWhatsappContacts(res.data.contacts || []);
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load WhatsApp contacts';
      setContactsError(message);
      setWhatsappContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

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
  }, [user, fetchConfig, fetchLogContacts]);

  useEffect(() => {
    if (!user) return;

    const syncStatus = async () => {
      try {
        const res = await whatsappAPI.getStatus();
        setWaConnected(res.data.status === 'connected' && res.data.clientReady);
      } catch {
        setWaConnected(false);
      }
    };

    syncStatus();
    const intervalId = setInterval(syncStatus, 5000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    if (!user || mode !== 'selected' || !waConnected) return;
    fetchWhatsAppContacts();
  }, [user, mode, waConnected, fetchWhatsAppContacts]);

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

  const filteredWhatsAppContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return whatsappContacts;

    return whatsappContacts.filter((contact) => {
      const name = String(contact.name || '').toLowerCase();
      const phone = String(contact.phoneNumber || '').toLowerCase();
      const chatId = String(contact.chatId || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || chatId.includes(query);
    });
  }, [contactSearch, whatsappContacts]);

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
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search WhatsApp contacts..."
                    className="w-full bg-[#111] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm outline-none focus:border-[#25D366]/40"
                  />
                </div>
                <button
                  type="button"
                  onClick={fetchWhatsAppContacts}
                  disabled={contactsLoading}
                  className="text-xs border border-white/10 hover:border-[#25D366]/40 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {contactsLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {contactsLoading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 size={18} className="animate-spin text-[#25D366]" />
                  </div>
                ) : contactsError ? (
                  <p className="text-xs text-amber-400">{contactsError}</p>
                ) : !waConnected ? (
                  <p className="text-xs text-gray-500">
                    Connect WhatsApp from the header, then click Refresh.
                  </p>
                ) : filteredWhatsAppContacts.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    No WhatsApp contacts found. Connect WhatsApp and click Refresh.
                  </p>
                ) : (
                  filteredWhatsAppContacts.map((contact) => (
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
                        <div className="text-xs text-gray-400">{contact.phoneNumber}</div>
                      </div>
                    </label>
                  ))
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
              <p className="text-sm text-gray-400 mt-1">Incoming messages and AI replies.</p>
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

          <div>
            <label className="text-xs text-gray-500 mb-2 block">Filter by contact</label>
            <select
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
              className="w-full sm:w-72 bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#25D366]/40"
            >
              <option value="">All contacts</option>
              {logContacts.map((contact) => (
                <option key={contact.contactPhone} value={contact.contactPhone}>
                  {contact.contactName || contact.contactPhone} ({contact.contactPhone})
                </option>
              ))}
            </select>
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
