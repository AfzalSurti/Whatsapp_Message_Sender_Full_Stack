'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Plus, Trash2, Edit2, X, Loader2,
  ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import Link from 'next/link';

const COLORS = [
  '#25D366',
  '#3B82F6',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899'
];

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#25D366');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [bulkGroupId, setBulkGroupId] = useState(null);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [numberName, setNumberName] = useState('');
  const [numberPhone, setNumberPhone] = useState('');
  const [addingNumber, setAddingNumber] = useState(false);

  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      setFetching(true);
      const res = await groupsAPI.getGroups();
      setGroups(res.data.groups || []);
    } catch (err) {
      toast.error('Failed to load groups');
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

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Enter a group name');
      return;
    }

    setCreatingGroup(true);
    try {
      await groupsAPI.createGroup({
        name: newGroupName,
        color: newGroupColor
      });
      toast.success('Group created!');
      setNewGroupName('');
      setNewGroupColor('#25D366');
      setShowNewGroupModal(false);
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Delete this group?')) return;

    try {
      await groupsAPI.deleteGroup(id);
      toast.success('Group deleted');
      await fetchGroups();
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  const handleEditGroup = async (group) => {
    setSelectedGroup(group);
    setEditName(group.name);
    setEditColor(group.color);
    setEditingGroupId(group._id);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast.error('Enter a name');
      return;
    }

    setEditingLoading(true);
    try {
      await groupsAPI.updateGroup(editingGroupId, {
        name: editName,
        color: editColor
      });
      toast.success('Group updated');
      setEditingGroupId(null);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (err) {
      toast.error('Failed to update group');
    } finally {
      setEditingLoading(false);
    }
  };

  const handleAddNumber = async () => {
    if (!numberPhone.trim()) {
      toast.error('Enter a phone number');
      return;
    }

    setAddingNumber(true);
    try {
      await groupsAPI.addNumber(selectedGroup._id, {
        name: numberName,
        phone: numberPhone
      });
      toast.success('Number added');
      setNumberName('');
      setNumberPhone('');
      await fetchGroups();
      const updated = await groupsAPI.getGroup(selectedGroup._id);
      setSelectedGroup(updated.data.group);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add number');
    } finally {
      setAddingNumber(false);
    }
  };

  const handleRemoveNumber = async (phone) => {
    try {
      await groupsAPI.removeNumber(selectedGroup._id, phone);
      toast.success('Number removed');
      await fetchGroups();
      const updated = await groupsAPI.getGroup(selectedGroup._id);
      setSelectedGroup(updated.data.group);
    } catch (err) {
      toast.error('Failed to remove number');
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkInput.trim()) {
      toast.error('Paste numbers first');
      return;
    }

    const lines = bulkInput.split('\n').map(l => l.trim()).filter(l => l);
    const numbers = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        phone: parts[0],
        name: parts[1] || ''
      };
    });

    setBulkLoading(true);
    try {
      const res = await groupsAPI.bulkAdd(bulkGroupId, { numbers });
      toast.success(`Added ${res.data.stats.added}, skipped ${res.data.stats.skipped}`);
      setBulkInput('');
      setShowBulkAddModal(false);
      setBulkGroupId(null);
      await fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk add failed');
    } finally {
      setBulkLoading(false);
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
      {/* NAVBAR */}
      <nav className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-70 transition-opacity">
          <ChevronLeft size={20} />
          <span className="font-semibold">Contact Groups</span>
        </Link>
        <button
          onClick={() => setShowNewGroupModal(true)}
          className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2 rounded-xl transition-colors text-sm flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> New Group
        </button>
      </nav>

      {/* MAIN */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-[#25D366]" size={28} />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No groups yet. Create one to get started.</p>
            <button
              onClick={() => setShowNewGroupModal(true)}
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={16} /> Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <div key={group._id} className="border border-white/10 rounded-xl overflow-hidden">
                {/* Card Header */}
                <div
                  className="h-1 transition-all"
                  style={{ backgroundColor: group.color }}
                />
                <div className="bg-[#111] p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{group.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{group.count} contacts</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditGroup(group)}
                        className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 size={14} className="text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group._id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* Expand/Collapse */}
                  <button
                    onClick={() => {
                      if (expandedGroupId === group._id) {
                        setExpandedGroupId(null);
                      } else {
                        setExpandedGroupId(group._id);
                        setSelectedGroup(group);
                      }
                    }}
                    className="w-full text-left text-xs text-[#25D366] hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    {expandedGroupId === group._id ? (
                      <><ChevronUp size={14} /> Hide numbers</>
                    ) : (
                      <><ChevronDown size={14} /> View numbers</>
                    )}
                  </button>

                  {/* Expanded Content */}
                  {expandedGroupId === group._id && selectedGroup && (
                    <div className="border-t border-white/5 pt-4 space-y-3">
                      {/* Numbers List */}
                      {selectedGroup.numbers.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedGroup.numbers.map((num, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-[#0a0a0a] border border-white/5 rounded-lg p-2.5 text-xs"
                            >
                              <div className="flex-1 min-w-0">
                                {num.name && (
                                  <p className="text-white truncate">{num.name}</p>
                                )}
                                <p className="text-gray-500 truncate">{num.phone}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveNumber(num.phone)}
                                className="ml-2 p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer flex-shrink-0"
                                title="Remove"
                              >
                                <X size={12} className="text-red-400" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Number Form */}
                      <div className="space-y-2 bg-[#0a0a0a] border border-white/5 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-400">Add Number</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Name (optional)"
                            value={numberName}
                            onChange={(e) => setNumberName(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-[#111] border border-white/10 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                          />
                          <input
                            type="text"
                            placeholder="Phone"
                            value={numberPhone}
                            onChange={(e) => setNumberPhone(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 bg-[#111] border border-white/10 rounded text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                          />
                        </div>
                        <button
                          onClick={handleAddNumber}
                          disabled={addingNumber}
                          className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-3 py-1.5 rounded text-xs cursor-pointer transition-colors"
                        >
                          {addingNumber ? 'Adding...' : 'Add'}
                        </button>
                      </div>

                      {/* Bulk Add Button */}
                      <button
                        onClick={() => {
                          setBulkGroupId(selectedGroup._id);
                          setShowBulkAddModal(true);
                        }}
                        className="w-full text-xs text-[#25D366] hover:bg-[#25D366]/10 px-3 py-2 rounded transition-colors cursor-pointer"
                      >
                        Bulk Add
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NEW GROUP MODAL */}
      {showNewGroupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-6">Create New Group</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
              />

              <div>
                <p className="text-xs text-gray-400 mb-2">Color</p>
                <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewGroupColor(color)}
                      className={`w-full h-10 rounded-lg border-2 transition-all cursor-pointer ${
                        newGroupColor === color
                          ? 'border-white'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateGroup}
                  disabled={creatingGroup}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {creatingGroup ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowNewGroupModal(false);
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

      {/* EDIT GROUP MODAL */}
      {editingGroupId && selectedGroup && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-sm">
            <h3 className="font-bold text-lg mb-6">Edit Group</h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Group name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
              />

              <div>
                <p className="text-xs text-gray-400 mb-2">Color</p>
                <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-full h-10 rounded-lg border-2 transition-all cursor-pointer ${
                        editColor === color
                          ? 'border-white'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={editingLoading}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {editingLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => {
                    setEditingGroupId(null);
                    setSelectedGroup(null);
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

      {/* BULK ADD MODAL */}
      {showBulkAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 w-full max-w-2xl">
            <h3 className="font-bold text-lg mb-2">Bulk Add Numbers</h3>
            <p className="text-xs text-gray-400 mb-4">One per line or CSV format (phone,name)</p>

            <textarea
              placeholder="Enter numbers&#10;Or: +91XXXXXXXXXX,Name&#10;One per line"
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              rows={10}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
            />

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleBulkAdd}
                disabled={bulkLoading}
                className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
              >
                {bulkLoading ? 'Adding...' : 'Add All'}
              </button>
              <button
                onClick={() => {
                  setShowBulkAddModal(false);
                  setBulkInput('');
                  setBulkGroupId(null);
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
