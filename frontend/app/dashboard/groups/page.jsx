'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import CreateTagModal from '@/components/dashboard/CreateTagModal';
import EditContactModal from '@/components/dashboard/EditContactModal';
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  normalizePhoneNumber
} from '@/lib/phone';
import {
  TAG_CATEGORIES,
  getInitials,
  getTagStyle,
  parseCsvContacts
} from '@/lib/segmentTags';
import {
  Loader2,
  Plus,
  Search,
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

  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagCategory, setNewTagCategory] = useState('custom');
  const [newTagColor, setNewTagColor] = useState('#25D366');
  const [creatingTag, setCreatingTag] = useState(false);

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

  const tagsByCategory = useMemo(() => {
    const map = {};
    TAG_CATEGORIES.forEach((cat) => {
      map[cat.id] = tagLibrary.filter((tag) => tag.category === cat.id);
    });
    return map;
  }, [tagLibrary]);

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

  const toggleFilterTag = (tagName) => {
    setActiveTagFilters((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const toggleAddTag = (tagName) => {
    setAddTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const toggleEditTag = (tagName) => {
    setEditTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Enter a tag name');
      return;
    }

    setCreatingTag(true);
    try {
      const res = await groupsAPI.createTag({
        name: newTagName.trim(),
        category: newTagCategory,
        color: newTagColor
      });
      setTagLibrary((prev) => [...prev, res.data.tag].sort((a, b) => a.name.localeCompare(b.name)));
      const createdName = res.data.tag.name;
      if (showAddModal) {
        setAddTags((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      }
      if (showEditModal) {
        setEditTags((prev) => (prev.includes(createdName) ? prev : [...prev, createdName]));
      }
      setShowTagModal(false);
      setNewTagName('');
      setNewTagCategory('custom');
      setNewTagColor('#25D366');
      toast.success('Tag created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create tag');
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
          <div className="lg:col-span-1 bg-[#111] border border-white/10 rounded-2xl p-5 space-y-5 h-fit">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Filter Segments</h2>
              <button
                type="button"
                onClick={() => setShowTagModal(true)}
                className="text-xs text-[#25D366] inline-flex items-center gap-1"
              >
                <Plus size={14} /> New tag
              </button>
            </div>

            {TAG_CATEGORIES.map((category) => {
              const tags = tagsByCategory[category.id] || [];
              if (tags.length === 0) return null;

              return (
                <div key={category.id}>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                    {category.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const active = activeTagFilters.includes(tag.name);
                      const style = getTagStyle(tag.name, tagLibrary);
                      return (
                        <button
                          key={tag._id}
                          type="button"
                          onClick={() => toggleFilterTag(tag.name)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            active ? 'ring-1 ring-white/25' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={active ? style : { borderColor: 'rgba(255,255,255,0.12)', color: '#d1d5db' }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {activeTagFilters.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTagFilters([])}
                className="text-xs text-gray-400 hover:text-white"
              >
                Clear filters
              </button>
            )}
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

                      <button
                        type="button"
                        onClick={() => openEdit(contact)}
                        className="text-sm px-4 py-2 rounded-lg border border-white/10 hover:border-[#25D366]/40 shrink-0"
                      >
                        Edit
                      </button>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">Segment tags</p>
                  <button
                    type="button"
                    onClick={() => setShowTagModal(true)}
                    className="text-xs text-[#25D366] inline-flex items-center gap-1"
                  >
                    <Plus size={14} /> New tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tagLibrary.map((tag) => {
                    const active = addTags.includes(tag.name);
                    const style = getTagStyle(tag.name, tagLibrary);
                    return (
                      <button
                        key={tag._id}
                        type="button"
                        onClick={() => toggleAddTag(tag.name)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${
                          active ? 'ring-1 ring-white/25' : 'opacity-70'
                        }`}
                        style={active ? style : { borderColor: 'rgba(255,255,255,0.12)', color: '#9ca3af' }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

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
        toggleTag={toggleEditTag}
        onCreateTag={() => setShowTagModal(true)}
        saving={savingEdit}
        onSave={handleSaveEdit}
      />

      <CreateTagModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        name={newTagName}
        setName={setNewTagName}
        category={newTagCategory}
        setCategory={setNewTagCategory}
        color={newTagColor}
        setColor={setNewTagColor}
        saving={creatingTag}
        onSubmit={handleCreateTag}
      />
    </div>
  );
}
