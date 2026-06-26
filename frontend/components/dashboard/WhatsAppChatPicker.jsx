'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { whatsappAPI } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';
import { cachedRequest } from '@/lib/requestCache';

export default function WhatsAppChatPicker({
  waConnected,
  onSelect,
  onQuickAdd,
  selectedPhone = '',
  active = true,
  autoLoad = true
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [addingPhone, setAddingPhone] = useState('');
  const fetchInFlightRef = useRef(false);
  const loadedRef = useRef(false);

  const fetchContacts = useCallback(async ({ force = false } = {}) => {
    if (!waConnected) {
      setError('Connect WhatsApp using the Connect button at the top of the page.');
      setContacts([]);
      return;
    }

    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    setLoading(true);
    setError('');

    try {
      const nextContacts = await cachedRequest(
        'whatsapp-picker-contacts',
        async () => {
          const res = await whatsappAPI.getWhatsAppContacts({ force });
          return res.data.contacts || [];
        },
        { force, ttlMs: 60000 }
      );
      setContacts(nextContacts);
      loadedRef.current = true;
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load WhatsApp chats');
      setContacts([]);
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [waConnected]);

  useEffect(() => {
    if (!active || !autoLoad || !waConnected) return;
    if (!loadedRef.current && !loading) {
      fetchContacts();
    }
  }, [active, autoLoad, waConnected, fetchContacts, loading]);

  const filteredContacts = contacts.filter((contact) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    const name = String(contact.name || '').toLowerCase();
    const phone = String(contact.phoneNumber || '').replace(/\D/g, '');
    const queryDigits = query.replace(/\D/g, '');
    return name.includes(query) || (queryDigits && phone.includes(queryDigits));
  });

  const formatContactPhone = (phone) => {
    if (!phone || String(phone).includes('@')) return phone;
    return formatPhoneNumber(phone) || phone;
  };

  const normalizedSelected = String(selectedPhone || '').replace(/\D/g, '');

  const handleContactAction = async (contact) => {
    const payload = {
      name: contact.name || formatContactPhone(contact.phoneNumber),
      phone: contact.phoneNumber
    };

    if (onQuickAdd) {
      const phoneKey = String(contact.phoneNumber || '').replace(/\D/g, '');
      setAddingPhone(phoneKey);
      try {
        await onQuickAdd(payload);
      } finally {
        setAddingPhone('');
      }
      return;
    }

    onSelect?.(payload);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or number..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#25D366]/40"
          />
        </div>
        <button
          type="button"
          onClick={() => fetchContacts({ force: true })}
          disabled={loading || !waConnected}
          className="text-sm border border-white/10 hover:border-[#25D366]/40 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!waConnected ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          WhatsApp is not connected. Click <strong>Connect</strong> in the top bar, scan the QR code, then come back here.
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          {onQuickAdd
            ? 'Tap a chat below to add it instantly to your contacts.'
            : 'Select a chat to fill the form below.'}
          {contacts.length > 0 ? ` · ${contacts.length} chats loaded` : ''}
        </p>
      )}

      <div className="max-h-64 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2 bg-[#0a0a0a]">
        {loading ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 size={22} className="animate-spin text-[#25D366]" />
            <span className="text-sm">Loading your WhatsApp chats...</span>
          </div>
        ) : error ? (
          <div className="py-4 px-2 space-y-2">
            <p className="text-sm text-amber-400">{error}</p>
            <button
              type="button"
              onClick={() => fetchContacts({ force: true })}
              className="text-sm text-[#25D366] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : filteredContacts.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center px-4">
            {loadedRef.current
              ? 'No chats match your search. Try a different name or number.'
              : waConnected
                ? 'Loading chats...'
                : 'Connect WhatsApp first to see your chats here.'}
          </p>
        ) : (
          filteredContacts.map((contact) => {
            const phone = contact.phoneNumber || '';
            const phoneDigits = String(phone).replace(/\D/g, '');
            const isSelected = normalizedSelected && phoneDigits === normalizedSelected;
            const isAdding = addingPhone && phoneDigits === addingPhone;

            return (
              <button
                key={contact.chatId || phone}
                type="button"
                disabled={Boolean(addingPhone)}
                onClick={() => handleContactAction(contact)}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl text-left transition-colors border ${
                  isSelected
                    ? 'bg-[#25D366]/10 border-[#25D366]/30'
                    : 'border-transparent hover:bg-white/5 hover:border-white/5'
                } disabled:opacity-60`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{contact.name || 'Unknown'}</div>
                  {phone ? (
                    <div className="text-xs text-gray-400 mt-0.5">{formatContactPhone(phone)}</div>
                  ) : null}
                </div>
                {onQuickAdd ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-[#25D366] bg-[#25D366]/10 px-2.5 py-1 rounded-lg">
                    {isAdding ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <UserPlus size={12} />
                    )}
                    Add
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
