'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { autoReplyAPI } from '@/lib/api';
import { formatPhoneNumber } from '@/lib/phone';

export default function WhatsAppChatPicker({
  waConnected,
  onSelect,
  selectedPhone = ''
}) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const fetchInFlightRef = useRef(false);

  const fetchContacts = useCallback(async () => {
    if (fetchInFlightRef.current) return;

    fetchInFlightRef.current = true;
    setLoading(true);
    setError('');

    try {
      const res = await autoReplyAPI.getWhatsAppContacts();
      setContacts(res.data.contacts || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load WhatsApp chats');
      setContacts([]);
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (waConnected) {
      fetchContacts();
    }
  }, [fetchContacts, waConnected]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) => {
      const name = String(contact.name || '').toLowerCase();
      const phone = String(contact.phoneNumber || '').replace(/\D/g, '');
      const queryDigits = query.replace(/\D/g, '');
      return name.includes(query) || (queryDigits && phone.includes(queryDigits));
    });
  }, [contacts, search]);

  const formatContactPhone = (phone) => {
    if (!phone || String(phone).includes('@')) return phone;
    return formatPhoneNumber(phone) || phone;
  };

  const normalizedSelected = String(selectedPhone || '').replace(/\D/g, '');

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WhatsApp chats..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#25D366]/40"
          />
        </div>
        <button
          type="button"
          onClick={fetchContacts}
          disabled={loading}
          className="text-sm border border-white/10 hover:border-[#25D366]/40 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shrink-0"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {!waConnected && (
        <p className="text-sm text-amber-400">
          Connect WhatsApp from the header, then click Refresh.
        </p>
      )}

      <div className="max-h-52 overflow-y-auto space-y-1 border border-white/10 rounded-xl p-2 bg-[#0a0a0a]">
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loader2 size={22} className="animate-spin text-[#25D366]" />
          </div>
        ) : error ? (
          <p className="text-sm text-amber-400 py-2 px-2">{error}</p>
        ) : filteredContacts.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No WhatsApp chats found. Click Refresh after connecting.
          </p>
        ) : (
          filteredContacts.map((contact) => {
            const phone = contact.phoneNumber || '';
            const phoneDigits = String(phone).replace(/\D/g, '');
            const isSelected = normalizedSelected && phoneDigits === normalizedSelected;

            return (
              <button
                key={contact.chatId || phone}
                type="button"
                onClick={() => onSelect({
                  name: contact.name || formatContactPhone(phone),
                  phone
                })}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors border ${
                  isSelected
                    ? 'bg-[#25D366]/10 border-[#25D366]/30'
                    : 'border-transparent hover:bg-white/5 hover:border-white/5'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{contact.name || 'Unknown'}</div>
                  {phone ? (
                    <div className="text-xs text-gray-400 mt-0.5">{formatContactPhone(phone)}</div>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
