'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';
import {
  DEFAULT_PHONE_COUNTRY,
  formatPhoneNumber,
  normalizePhoneNumber
} from '@/lib/phone';
import {
  Loader2,
  Plus,
  X,
  Filter,
  UserPlus,
  Tags,
  Edit2,
  Trash2,
  Users
} from 'lucide-react';

const DEFAULT_COUNTRY = DEFAULT_PHONE_COUNTRY;
const GROUP_COLORS = ['#25D366', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState([]);
  const [fetching, setFetching] = useState(true);

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#25D366');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editGroupId, setEditGroupId] = useState(null);

  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactCountry, setContactCountry] = useState(DEFAULT_COUNTRY);
  const [contactPhone, setContactPhone] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [inlineGroupName, setInlineGroupName] = useState('');
  const [inlineGroupColor, setInlineGroupColor] = useState('#25D366');
  const [addingContact, setAddingContact] = useState(false);

  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');

  const fetchGroups = useCallback(async () => {
    try {
      setFetching(true);
      const res = await groupsAPI.getGroups();
      setGroups(res.data.groups || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchGroups();
  }, [user, fetchGroups]);

  const createGroup = async ({ name, color }) => {
    const res = await groupsAPI.createGroup({ name: name.trim(), color });
    return res.data.group;
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Enter a group name');
      return;
    }

    setCreatingGroup(true);
    try {
      if (editGroupId) {
        await groupsAPI.updateGroup(editGroupId, { name: newGroupName, color: newGroupColor });
        toast.success('Group updated');
      } else {
        await createGroup({ name: newGroupName, color: newGroupColor });
        toast.success('Group created');
      }
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupColor('#25D366');
      setEditGroupId(null);
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleOpenEditGroup = (group) => {
    setEditGroupId(group._id);
    setNewGroupName(group.name || '');
    setNewGroupColor(group.color || '#25D366');
    setShowCreateGroupModal(true);
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group? This will remove its contacts from the group.')) return;
    try {
      await groupsAPI.deleteGroup(groupId);
      toast.success('Group deleted');
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete group');
    }
  };

  const groupedContacts = useMemo(() => {
    const byPhone = new Map();

    groups.forEach((group) => {
      (group.numbers || []).forEach((entry) => {
        const phoneKey = String(entry.phone || '').replace(/\D/g, '');
        if (!phoneKey) return;

        if (!byPhone.has(phoneKey)) {
          byPhone.set(phoneKey, {
            id: phoneKey,
            name: entry.name || '',
            phone: phoneKey,
            groups: []
          });
        }

        const contact = byPhone.get(phoneKey);
        if (!contact.name && entry.name) {
          contact.name = entry.name;
        }

        const alreadyInGroup = contact.groups.some((item) => item.id === group._id);
        if (!alreadyInGroup) {
          contact.groups.push({
            id: group._id,
            name: group.name,
            color: group.color || '#25D366'
          });
        }
      });
    });

    return Array.from(byPhone.values());
  }, [groups]);

  const filteredAndSortedContacts = useMemo(() => {
    const filtered = groupFilter === 'all'
      ? groupedContacts
      : groupedContacts.filter((contact) => contact.groups.some((g) => g.id === groupFilter));

    const sorted = [...filtered].sort((a, b) => {
      const firstGroupA = [...a.groups].sort((x, y) => x.name.localeCompare(y.name))[0]?.name || '';
      const firstGroupB = [...b.groups].sort((x, y) => x.name.localeCompare(y.name))[0]?.name || '';

      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'group-asc') return firstGroupA.localeCompare(firstGroupB);
      if (sortBy === 'group-desc') return firstGroupB.localeCompare(firstGroupA);
      return 0;
    });

    return sorted;
  }, [groupFilter, groupedContacts, sortBy]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.name.localeCompare(b.name)),
    [groups]
  );

  const toggleGroupSelection = (groupId) => {
    setSelectedGroupIds((prev) => (
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    ));
  };

  const resetAddContactForm = () => {
    setContactName('');
    setContactCountry(DEFAULT_COUNTRY);
    setContactPhone('');
    setSelectedGroupIds([]);
    setInlineGroupName('');
    setInlineGroupColor('#25D366');
    setShowAddContactModal(false);
  };

  const handleAddContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error('Enter contact name and phone number');
      return;
    }

    const normalized = normalizePhoneNumber(contactPhone, contactCountry);
    if (!normalized) {
      toast.error('Enter a valid international phone number');
      return;
    }

    setAddingContact(true);
    try {
      const targetGroupIds = [...selectedGroupIds];

      if (inlineGroupName.trim()) {
        const createdGroup = await createGroup({
          name: inlineGroupName,
          color: inlineGroupColor
        });
        targetGroupIds.push(createdGroup._id);
      }

      const uniqueTargetGroupIds = [...new Set(targetGroupIds)];
      if (uniqueTargetGroupIds.length === 0) {
        toast.error('Select at least one group or create a new one');
        return;
      }

      const addResults = await Promise.allSettled(
        uniqueTargetGroupIds.map((groupId) => groupsAPI.addNumber(groupId, {
          name: contactName,
          phone: normalized.e164,
          tags: []
        }))
      );

      const successful = addResults.filter((item) => item.status === 'fulfilled').length;
      const failed = addResults.length - successful;

      if (successful === 0) {
        const firstError = addResults.find((item) => item.status === 'rejected');
        toast.error(firstError?.reason?.response?.data?.error || 'Failed to add contact');
        return;
      }

      if (failed > 0) {
        toast.success(`Added to ${successful} group(s), skipped ${failed}`);
      } else {
        toast.success(`Contact added to ${successful} group(s)`);
      }

      resetAddContactForm();
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact');
    } finally {
      setAddingContact(false);
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

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Contacts</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your contact groups and numbers — organize, add, and edit contacts quickly.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="border border-white/12 hover:border-white/30 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Tags size={16} /> Create Group
            </button>
            <button
              onClick={() => setShowAddContactModal(true)}
              className="bg-[#25D366] hover:bg-[#1ebe5d] text-black text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <UserPlus size={16} /> Add Contact
            </button>
          </div>
        </div>

        {/* Groups cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedGroups.map((group) => (
            <div key={group._id} className="bg-[#111] border border-white/6 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: group.color || '#25D366' }} />
                <div>
                  <div className="text-sm font-semibold">{group.name}</div>
                  <div className="text-xs text-gray-400">{(group.numbers || []).length} contacts</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleOpenEditGroup(group)} className="p-2 rounded-md hover:bg-white/5 transition-colors"><Edit2 size={16} /></button>
                <button onClick={() => handleDeleteGroup(group._id)} className="p-2 rounded-md hover:bg-white/5 transition-colors text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Filter size={14} />
            <span>Filter</span>
          </div>
          <div className="flex gap-2">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
            >
              <option value="all">All groups</option>
              {sortedGroups.map((group) => (
                <option key={group._id} value={group._id}>{group.name}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-[#111] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-[#25D366]"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="group-asc">Group A-Z</option>
              <option value="group-desc">Group Z-A</option>
            </select>
          </div>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#25D366]" size={30} />
          </div>
        ) : filteredAndSortedContacts.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Users size={48} className="mx-auto text-gray-500" />
              <h3 className="text-lg font-semibold mt-4 text-white">No contacts yet</h3>
              <p className="text-sm text-gray-400 mt-2">Add your first contact to get started — assign them to one or more groups.</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button onClick={() => setShowAddContactModal(true)} className="bg-[#25D366] px-4 py-2 rounded-lg text-black font-semibold">Add Contact</button>
                <button onClick={() => setShowCreateGroupModal(true)} className="border border-white/10 px-4 py-2 rounded-lg text-white">Create Group</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-white/5 text-gray-300">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Name</th>
                    <th className="text-left font-semibold px-4 py-3">Phone</th>
                    <th className="text-left font-semibold px-4 py-3">Groups</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedContacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-white/5 odd:bg-white/5">
                        <td className="px-4 py-3 text-white">{contact.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-300">{formatPhoneNumber(contact.phone)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {[...contact.groups]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((group) => (
                                <span
                                  key={`${contact.id}-${group.id}`}
                                  className="text-xs px-2.5 py-1 rounded-full border"
                                  style={{ borderColor: `${group.color}66`, color: group.color }}
                                >
                                  {group.name}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-5">Create Group</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
              />

              <div>
                <p className="text-xs text-gray-400 mb-2">Color</p>
                <div className="grid grid-cols-6 gap-2">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewGroupColor(color)}
                      className={`h-9 rounded-lg border-2 ${newGroupColor === color ? 'border-white' : 'border-transparent'} cursor-pointer`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateGroup}
                  disabled={creatingGroup}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {creatingGroup ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                    setNewGroupColor('#25D366');
                  }}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddContactModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 mb-5">
              <h3 className="font-bold text-lg">Add Contact</h3>
              <button
                onClick={resetAddContactForm}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Contact name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
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
                <p className="text-sm font-medium text-gray-300 mb-2">Select existing group(s)</p>
                {sortedGroups.length === 0 ? (
                  <p className="text-xs text-gray-500">No groups available yet. Create one below.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-white/10 rounded-xl p-2 space-y-1">
                    {sortedGroups.map((group) => (
                      <label
                        key={group._id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.includes(group._id)}
                          onChange={() => toggleGroupSelection(group._id)}
                          className="accent-[#25D366]"
                        />
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: group.color || '#25D366' }}
                        />
                        <span className="text-sm text-gray-200">{group.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-dashed border-white/15 rounded-xl p-3 space-y-3">
                <p className="text-sm font-medium text-gray-300">Or create a new group for this contact</p>
                <input
                  type="text"
                  placeholder="New group name"
                  value={inlineGroupName}
                  onChange={(e) => setInlineGroupName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
                />

                <div className="flex gap-2">
                  {GROUP_COLORS.map((color) => (
                    <button
                      key={`inline-${color}`}
                      onClick={() => setInlineGroupColor(color)}
                      className={`w-7 h-7 rounded-full border-2 ${inlineGroupColor === color ? 'border-white' : 'border-transparent'} cursor-pointer`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddContact}
                  disabled={addingContact}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {addingContact ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {addingContact ? 'Saving...' : 'Save Contact'}
                </button>
                <button
                  onClick={resetAddContactForm}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
