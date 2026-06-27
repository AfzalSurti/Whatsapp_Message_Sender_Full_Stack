'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import WhatsAppChatPicker from '@/components/dashboard/WhatsAppChatPicker';
import ConfirmModal from '@/components/dashboard/ConfirmModal';
import { useDashboardShell } from '../DashboardShellContext';
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  normalizePhoneNumber
} from '@/lib/phone';

const AVATAR_COLORS = ['#25D366', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6'];

const getInitials = (name, phone) => {
  const trimmed = String(name || '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return trimmed.slice(0, 2).toUpperCase();
  }
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.slice(-2) || '?';
};

export default function ContactsPage() {
  const { user, loading } = useAuth();
  const { waStatus } = useDashboardShell();
  const router = useRouter();

  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addContactMode, setAddContactMode] = useState('manual');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactCountry, setContactCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [addingContact, setAddingContact] = useState(false);

  const [editContact, setEditContact] = useState(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [contactToDelete, setContactToDelete] = useState(null);
  const [deletingPhone, setDeletingPhone] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setFetching(true);
      const res = await groupsAPI.getOverview();
      setContacts(res.data.contacts || []);
      setGroups(res.data.groups || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load contacts');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) fetchOverview();
  }, [user, fetchOverview]);

  const generalGroupId = useMemo(
    () => groups.find((g) => g.name === 'General')?._id || groups[0]?._id,
    [groups]
  );

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter(
      (contact) =>
        String(contact.name || '').toLowerCase().includes(query) ||
        String(contact.phone || '').includes(query.replace(/\D/g, ''))
    );
  }, [contacts, search]);

  const resetAddForm = () => {
    setContactName('');
    setContactPhone('');
    setAddContactMode(waStatus === 'connected' ? 'whatsapp' : 'manual');
  };

  const openAddModal = () => {
    setAddContactMode(waStatus === 'connected' ? 'whatsapp' : 'manual');
    setShowAddModal(true);
  };

  const saveContact = async ({ name, phone, country = contactCountry }) => {
    if (!name?.trim() || !phone?.trim()) {
      toast.error('Enter name and phone');
      return false;
    }

    const normalized = normalizePhoneNumber(phone, country);
    if (!normalized) {
      toast.error('Enter a valid phone number');
      return false;
    }

    if (!generalGroupId) {
      toast.error('No contact group available');
      return false;
    }

    await groupsAPI.addNumber(generalGroupId, {
      name: name.trim(),
      phone: normalized.e164
    });
    return true;
  };

  const handleQuickAddFromWhatsApp = async ({ name, phone }) => {
    try {
      const saved = await saveContact({ name, phone });
      if (!saved) return;

      toast.success(`${name} added to contacts`);
      setShowAddModal(false);
      resetAddForm();
      await fetchOverview();
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to add contact';
      toast.error(/already exists/i.test(message) ? 'This contact is already in your list' : message);
    }
  };

  const handleAddContact = async () => {
    setAddingContact(true);
    try {
      const saved = await saveContact({
        name: contactName,
        phone: contactPhone,
        country: contactCountry
      });
      if (!saved) return;

      toast.success('Contact added');
      setShowAddModal(false);
      resetAddForm();
      await fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContact) return;

    setSavingEdit(true);
    try {
      await groupsAPI.updateContact({
        phone: editContact.phone,
        name: editName.trim()
      });
      toast.success('Contact updated');
      setEditContact(null);
      await fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update contact');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!contactToDelete) return;

    setDeletingPhone(contactToDelete.phone);
    try {
      await groupsAPI.deleteContact(contactToDelete.phone);
      toast.success('Contact deleted');
      if (editContact?.phone === contactToDelete.phone) {
        setEditContact(null);
      }
      setContactToDelete(null);
      await fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete contact');
    } finally {
      setDeletingPhone(null);
    }
  };

  const deleteContactLabel =
    contactToDelete?.name ||
    formatPhoneNumber(contactToDelete?.phone) ||
    contactToDelete?.phone ||
    'this contact';

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-gray-400 mt-1">
            Saved numbers used by auto-reply rules. Unknown WhatsApp chats are replied to automatically;
            saved contacts are skipped unless you add them in{' '}
            <Link href="/dashboard/auto-reply" className="text-[#25D366] hover:underline">
              Auto Reply
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="bg-[#25D366] hover:bg-[#1ebe5d] text-black text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shrink-0"
        >
          <UserPlus size={16} /> Add Contact
        </button>
      </div>

      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-gray-400">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} saved
          </p>
          <div className="relative max-w-sm w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#25D366]/40"
            />
          </div>
        </div>

        {fetching ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-[#25D366]" size={28} />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <p className="text-gray-400 text-sm">
              {contacts.length === 0
                ? 'No contacts yet. Add numbers here so auto-reply knows who is saved.'
                : 'No contacts match your search.'}
            </p>
            {contacts.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 text-sm text-[#25D366] hover:underline"
              >
                <UserPlus size={14} /> Add your first contact
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredContacts.map((contact, index) => {
              const initials = getInitials(contact.name, contact.phone);
              const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];

              return (
                <div
                  key={contact.phone}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02]"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
                    style={{ backgroundColor: `${avatarColor}22`, color: avatarColor }}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {formatPhoneNumber(contact.phone) || contact.phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditContact(contact);
                        setEditName(contact.name || '');
                      }}
                      className="text-sm px-4 py-2 rounded-lg border border-white/10 hover:border-[#25D366]/40"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={deletingPhone === contact.phone}
                      onClick={() => setContactToDelete(contact)}
                      className="p-2 rounded-lg border border-white/10 hover:border-red-500/40 text-red-400 disabled:opacity-50"
                      title="Delete contact"
                    >
                      {deletingPhone === contact.phone ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-lg">Add Contact</h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  resetAddForm();
                }}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              {addContactMode === 'whatsapp'
                ? 'Pick someone from your WhatsApp chats — one tap to add.'
                : 'Enter contact details manually.'}
            </p>

            <div className="inline-flex p-1 rounded-xl bg-[#0a0a0a] border border-white/10 gap-1 mb-5 w-full">
              {[
                { id: 'whatsapp', label: 'From WhatsApp' },
                { id: 'manual', label: 'Type manually' }
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAddContactMode(item.id)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    addContactMode === item.id
                      ? 'bg-[#25D366] text-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {addContactMode === 'whatsapp' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      waStatus === 'connected' ? 'bg-[#25D366]' : 'bg-red-500'
                    }`}
                  />
                  <span className={waStatus === 'connected' ? 'text-gray-300' : 'text-amber-400'}>
                    {waStatus === 'connected'
                      ? 'WhatsApp connected — your chats will load automatically'
                      : 'Connect WhatsApp from the top bar first'}
                  </span>
                </div>

                <WhatsAppChatPicker
                  active={showAddModal && addContactMode === 'whatsapp'}
                  waConnected={waStatus === 'connected'}
                  onQuickAdd={handleQuickAddFromWhatsApp}
                />

                <button
                  type="button"
                  onClick={() => setAddContactMode('manual')}
                  className="w-full text-sm text-gray-400 hover:text-white py-2"
                >
                  Or type the number manually instead
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Name</label>
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm outline-none focus:border-[#25D366]/40"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-1.5">Phone number</label>
                  <InternationalPhoneInput
                    value={contactPhone}
                    defaultCountry={contactCountry}
                    onChange={(phone, meta) => {
                      setContactPhone(phone);
                      setContactCountry(meta?.country?.iso2?.toUpperCase() || contactCountry);
                    }}
                    onCountryChange={setContactCountry}
                    placeholder="Phone number"
                  />
                </div>

                <button
                  type="button"
                  disabled={addingContact}
                  onClick={handleAddContact}
                  className="w-full bg-[#25D366] text-black font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {addingContact ? <Loader2 size={16} className="animate-spin" /> : null}
                  Save Contact
                </button>

                {waStatus === 'connected' ? (
                  <button
                    type="button"
                    onClick={() => setAddContactMode('whatsapp')}
                    className="w-full text-sm text-gray-400 hover:text-white py-2"
                  >
                    Pick from WhatsApp chats instead
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {editContact && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Edit Contact</h3>
              <button
                type="button"
                onClick={() => setEditContact(null)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {formatPhoneNumber(editContact.phone) || editContact.phone}
            </p>
            <label className="block text-sm font-medium text-gray-200 mb-1.5">Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm outline-none focus:border-[#25D366]/40 mb-4"
            />
            <button
              type="button"
              disabled={savingEdit}
              onClick={handleSaveEdit}
              className="w-full bg-[#25D366] text-black font-semibold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {savingEdit ? <Loader2 size={16} className="animate-spin" /> : null}
              Save Changes
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(contactToDelete)}
        onClose={() => setContactToDelete(null)}
        title="Delete this contact?"
        message={`"${deleteContactLabel}" will be removed from your saved contacts.`}
        confirmLabel="Yes, Delete"
        onConfirm={handleDeleteContact}
        confirming={Boolean(deletingPhone)}
      />
    </div>
  );
}
