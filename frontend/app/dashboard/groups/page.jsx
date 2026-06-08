'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import SegmentTagPicker from '@/components/dashboard/SegmentTagPicker';
import EditContactModal from '@/components/dashboard/EditContactModal';
import ConfirmModal from '@/components/dashboard/ConfirmModal';
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  normalizePhoneNumber
} from '@/lib/phone';
import {
  getInitials,
  getTagStyle,
  parseCsvContacts
} from '@/lib/segmentTags';
import {
  Loader2,
  Search,
  Trash2,
  Upload,
  UserPlus,
  X
} from 'lucide-react';

const AVATAR_COLORS = ['#25D366', '#3B82F6', '#8B5CF6', '#F97316', '#EC4899', '#14B8A6'];

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [contacts, setContacts] = useState([]);
  const [tagLibrary, setTagLibrary] = useState([]);
  const [groups, setGroups] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [search, setSearch] = useState('');
  const [activeTagFilters, setActiveTagFilters] = useState([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactCountry, setContactCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [addTags, setAddTags] = useState([]);
  const [addingContact, setAddingContact] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const [creatingTag, setCreatingTag] = useState(false);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [deletingPhone, setDeletingPhone] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setFetching(true);
      const res = await groupsAPI.getOverview();
      setContacts(res.data.contacts || []);
      setTagLibrary(res.data.tags || []);
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

  const filteredContacts = useMemo(() => {
    let list = contacts;

    if (activeTagFilters.length > 0) {
      list = list.filter((contact) =>
        activeTagFilters.every((tag) => contact.tags?.includes(tag))
      );
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (contact) =>
          String(contact.name || '').toLowerCase().includes(query) ||
          String(contact.phone || '').includes(query.replace(/\D/g, ''))
      );
    }

    return list;
  }, [contacts, activeTagFilters, search]);

  const generalGroupId = useMemo(
    () => groups.find((g) => g.name === 'General')?._id || groups[0]?._id,
    [groups]
  );

  const handleCreateTag = async (name, target) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a tag name');
      return false;
    }

    setCreatingTag(true);
    try {
      const res = await groupsAPI.createTag({
        name: trimmed,
        category: 'custom',
        color: '#25D366'
      });
      setTagLibrary((prev) => [...prev, res.data.tag].sort((a, b) => a.name.localeCompare(b.name)));
      const createdName = res.data.tag.name;

      if (target === 'add') {
        setAddTags((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      }
      if (target === 'edit') {
        setEditTags((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      }
      if (target === 'filter') {
        setActiveTagFilters((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      }

      toast.success('Tag created');
      return true;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create tag');
      return false;
    } finally {
      setCreatingTag(false);
    }
  };

  const handleAddContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error('Enter name and phone');
      return;
    }

    const normalized = normalizePhoneNumber(contactPhone, contactCountry);
    if (!normalized) {
      toast.error('Enter a valid phone number');
      return;
    }

    if (!generalGroupId) {
      toast.error('No contact group available');
      return;
    }

    setAddingContact(true);
    try {
      await groupsAPI.addNumber(generalGroupId, {
        name: contactName.trim(),
        phone: normalized.e164,
        tags: addTags
      });
      toast.success('Contact added');
      setShowAddModal(false);
      setContactName('');
      setContactPhone('');
      setAddTags([]);
      await fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to add contact');
    } finally {
      setAddingContact(false);
    }
  };

  const openEdit = (contact) => {
    setEditPhone(contact.phone);
    setEditName(contact.name || '');
    setEditTags(contact.tags || []);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      await groupsAPI.updateContact({
        phone: editPhone,
        name: editName.trim(),
        tags: editTags
      });
      toast.success('Contact updated');
      setShowEditModal(false);
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
      if (editPhone === contactToDelete.phone) {
        setShowEditModal(false);
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

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsvContacts(text);
      if (rows.length === 0) {
        toast.error('No valid rows found in CSV');
        return;
      }

      const res = await groupsAPI.importContacts(rows);
      toast.success(`Imported ${res.data.stats.added} contact(s)`);
      await fetchOverview();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contacts & Segments</h1>
            <p className="text-sm text-gray-400 mt-1">
              {contacts.length.toLocaleString()} contacts · Smart tag-based segmentation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportCsv}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border border-white/10 hover:border-white/20 text-white rounded-xl text-sm font-semibold px-4 py-2 flex items-center gap-2"
            >
              <Upload size={16} /> Import CSV
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="bg-[#25D366] hover:bg-[#1ebe5d] text-black text-sm font-semibold px-4 py-2 rounded-xl flex items-center gap-2"
            >
              <UserPlus size={16} /> Add Contact
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filter sidebar */}
          <div className="lg:col-span-1 bg-[#111] border border-white/10 rounded-2xl p-5 h-fit">
            <h2 className="font-semibold mb-4">Filter Segments</h2>
            <SegmentTagPicker
              tagLibrary={tagLibrary}
              selectedTags={activeTagFilters}
              onSelectedChange={setActiveTagFilters}
              onCreateTag={(name) => handleCreateTag(name, 'filter')}
              creatingTag={creatingTag}
              label="Active filters"
            />
          </div>

          {/* Contact list */}
          <div className="lg:col-span-3 bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-400">
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''} shown
              </p>
              <div className="relative max-w-sm w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm"
                />
              </div>
            </div>

            {fetching ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="animate-spin text-[#25D366]" size={28} />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="py-20 text-center text-gray-500 text-sm">
                No contacts match your filters.
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
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(contact.tags || []).map((tag) => {
                            const style = getTagStyle(tag, tagLibrary);
                            return (
                              <span
                                key={`${contact.phone}-${tag}`}
                                className="text-[11px] px-2 py-0.5 rounded-full border"
                                style={style}
                              >
                                {tag}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(contact)}
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
        </div>
      </div>

      {/* Add contact modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Add Contact</h3>
              <button type="button" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full name"
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm"
              />
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

              <SegmentTagPicker
                tagLibrary={tagLibrary}
                selectedTags={addTags}
                onSelectedChange={setAddTags}
                onCreateTag={(name) => handleCreateTag(name, 'add')}
                creatingTag={creatingTag}
              />

              <button
                type="button"
                disabled={addingContact}
                onClick={handleAddContact}
                className="w-full bg-[#25D366] text-black font-semibold py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {addingContact ? <Loader2 size={16} className="animate-spin" /> : null}
                Save Contact
              </button>
            </div>
          </div>
        </div>
      )}

      <EditContactModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        phone={editPhone}
        name={editName}
        setName={setEditName}
        tagLibrary={tagLibrary}
        selectedTags={editTags}
        onSelectedTagsChange={setEditTags}
        onCreateTag={(name) => handleCreateTag(name, 'edit')}
        creatingTag={creatingTag}
        saving={savingEdit}
        onSave={handleSaveEdit}
      />

      <ConfirmModal
        open={Boolean(contactToDelete)}
        onClose={() => setContactToDelete(null)}
        title="Are you sure you want to delete this contact?"
        message={`"${deleteContactLabel}" will be permanently removed from your contacts. This action cannot be undone.`}
        confirmLabel="Yes, Delete"
        onConfirm={handleDeleteContact}
        confirming={Boolean(deletingPhone)}
      />
    </div>
  );
}
