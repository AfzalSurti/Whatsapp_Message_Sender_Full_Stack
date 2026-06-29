'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { keysAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  Copy, Eye, Trash2, Plus, Loader2, X, Check,
  Key, Code, TrendingUp, Zap
} from 'lucide-react';
import axios from 'axios';

export default function ApiKeysPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [keys, setKeys] = useState([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revealedKeyId, setRevealedKeyId] = useState(null);
  const [revealedKey, setRevealedKey] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [selectedKeyStats, setSelectedKeyStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(null);

  const fetchKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const res = await keysAPI.getKeys();
      setKeys(res.data.keys || []);
    } catch (err) {
      toast.error('Failed to load API keys');
    } finally {
      setLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user, fetchKeys]);

  const handleGenerateKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Enter a name for the key');
      return;
    }
    setGeneratingKey(true);
    try {
      const res = await keysAPI.generateKey(newKeyName);
      setRevealedKeyId(res.data.name);
      setRevealedKey(res.data.key);
      setShowGenerateModal(false);
      setNewKeyName('');
      await fetchKeys();
      toast.success('API key generated! Copy it now as you won\'t see it again.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate key');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevealKey = async (keyId) => {
    setLoadingStats(keyId);
    try {
      const res = await keysAPI.getFullKey(keyId);
      setRevealedKeyId(keyId);
      setRevealedKey(res.data.key);
    } catch (err) {
      toast.error('Failed to reveal key');
    } finally {
      setLoadingStats(null);
    }
  };

  const handleCopyKey = async () => {
    if (revealedKey) {
      await navigator.clipboard.writeText(revealedKey);
      setCopiedKeyId(revealedKey);
      toast.success('Key copied to clipboard');
      setTimeout(() => setCopiedKeyId(null), 2000);
    }
  };

  const handleViewStats = async (keyId) => {
    setLoadingStats(keyId);
    try {
      const res = await keysAPI.getKeyStats(keyId);
      setSelectedKeyStats({ keyId, ...res.data });
    } catch (err) {
      toast.error('Failed to load stats');
    } finally {
      setLoadingStats(null);
    }
  };

  const handleDeleteKey = async (keyId) => {
    if (!confirm('This action cannot be undone. Continue?')) return;
    try {
      await keysAPI.deleteKey(keyId);
      toast.success('API key deleted');
      await fetchKeys();
      setRevealedKeyId(null);
      setRevealedKey(null);
    } catch (err) {
      toast.error('Failed to delete key');
    }
  };

 const handleSendMessage = async () => {
  try {
    const response = await axios.post(
      "http://localhost:6001/api/whatsapp/send-via-api",
      {
        numbers: ["+917359813419"],
        message: "Hello from API",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "wsa_live_1da615e2332a563d56b132074ef6879a", // Replace with your actual API key
        },
      }
    );
    console.log("Message sent:", response.data);
  } catch (error) {
    console.error(
      "Failed to send message:",
      error.response?.data || error.message
    );
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
      {/* MAIN */}
      <div className=" px-6 py-8 space-y-6">

        {/* GENERATE MODAL */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8 max-w-sm w-full">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="font-bold text-lg">Generate New API Key</h3>
                <button
                  onClick={() => {
                    setShowGenerateModal(false);
                    setNewKeyName('');
                  }}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Key name (e.g., Production, Testing)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateKey()}
                />

                <p className="text-xs text-gray-400">
                  You can create up to 5 API keys per account.
                </p>
                <p className="text-xs text-yellow-300/90 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  Keep keys private. Anyone with this key can send messages using your account.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleGenerateKey}
                    disabled={generatingKey}
                    className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {generatingKey ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    {generatingKey ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setNewKeyName('');
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

        {/* REVEALED KEY MODAL */}
        {revealedKeyId && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8 max-w-lg w-full">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="font-bold text-lg">API Key</h3>
                <button
                  onClick={() => {
                    setRevealedKeyId(null);
                    setRevealedKey(null);
                  }}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  ⚠️ Copy this key now. You won&apos;t be able to see this exact value again.
                </p>

                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                  <code className="text-xs text-green-400 font-mono break-all">{revealedKey}</code>
                </div>

                <button
                  onClick={handleCopyKey}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  {copiedKeyId === revealedKey ? (
                    <><Check size={14} /> Copied!</>
                  ) : (
                    <><Copy size={14} /> Copy Key</>
                  )}
                </button>

                <p className="text-[11px] text-yellow-300/90 text-center">
                  Warning: copy now, full key won&apos;t be shown again after closing.
                </p>

                <button
                  onClick={() => {
                    setRevealedKeyId(null);
                    setRevealedKey(null);
                  }}
                  className="w-full border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATS MODAL */}
        {selectedKeyStats && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8 max-w-sm w-full">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h3 className="font-bold text-lg">Usage Statistics</h3>
                <button
                  onClick={() => setSelectedKeyStats(null)}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-yellow-400" />
                    <p className="text-xs text-gray-400">Monthly Usage</p>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-white">
                      {selectedKeyStats.monthlyUsage}
                    </span>
                    <span className="text-sm text-gray-500 mb-1">
                      / {selectedKeyStats.monthlyLimit}
                    </span>
                  </div>
                  <div className="mt-3 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#25D366] transition-all"
                      style={{
                        width: `${Math.min(
                          (selectedKeyStats.monthlyUsage / selectedKeyStats.monthlyLimit) * 100,
                          100
                        )}%`
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 -mt-1">
                  {Math.min(100, Math.round((selectedKeyStats.monthlyUsage / Math.max(1, selectedKeyStats.monthlyLimit)) * 100))}% of monthly quota used.
                </p>

                <div className="bg-[#0a0a0a] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} className="text-[#25D366]" />
                    <p className="text-xs text-gray-400">Total Usage</p>
                  </div>
                  <span className="text-2xl font-bold text-white">
                    {selectedKeyStats.usageCount}
                  </span>
                </div>

                {selectedKeyStats.lastUsed && (
                  <div className="bg-[#0a0a0a] rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">Last Used</p>
                    <p className="text-sm text-white">
                      {new Date(selectedKeyStats.lastUsed).toLocaleString()}
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setSelectedKeyStats(null)}
                  className="w-full border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">API Keys</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage your API keys to send messages programmatically
            </p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus size={15} /> Generate Key
          </button>
        </div>

        {/* EMPTY STATE */}
        {!loadingKeys && keys.length === 0 && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center mx-auto">
              <Key size={20} className="text-[#25D366]" />
            </div>
            <div>
              <h2 className="font-semibold text-base mb-1">No API Keys Yet</h2>
              <p className="text-gray-500 text-sm">
                Generate your first API key to start sending messages via API
              </p>
            </div>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} /> Generate First Key
            </button>
          </div>
        )}

        {/* KEYS LIST */}
        {!loadingKeys && keys.length > 0 && (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key.id}
                className="bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Code size={14} className="text-[#25D366] flex-shrink-0" />
                      <h3 className="font-semibold text-base truncate">{key.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${key.isActive ? 'bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {key.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="bg-[#0a0a0a] rounded-xl p-3 mb-3 truncate">
                      <code className="text-xs text-gray-400 font-mono">
                        {key.maskedKey}
                      </code>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Usage This Month</p>
                        <p className="text-sm font-semibold text-[#25D366]">
                          {key.monthlyUsage} / {key.monthlyLimit}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Usage</p>
                        <p className="text-sm font-semibold text-white">{key.usageCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Created</p>
                        <p className="text-sm font-semibold text-gray-400">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Last Used</p>
                        <p className="text-sm font-semibold text-gray-400">
                          {key.lastUsed
                            ? new Date(key.lastUsed).toLocaleDateString()
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                        <span>Usage Progress</span>
                        <span>{Math.min(100, Math.round((key.monthlyUsage / Math.max(1, key.monthlyLimit)) * 100))}%</span>
                      </div>
                      <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/10">
                        <div
                          className="h-full bg-[#25D366]"
                          style={{ width: `${Math.min(100, Math.round((key.monthlyUsage / Math.max(1, key.monthlyLimit)) * 100))}%` }}
                        />
                      </div>
                    </div>

                    {key.isActive && key.monthlyUsage >= key.monthlyLimit && (
                      <div className="text-xs text-red-400 mb-2">
                        ⚠️ Monthly limit reached. Usage will be blocked until next month.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleRevealKey(key.id)}
                      disabled={loadingStats === key.id}
                      className="flex items-center gap-1.5 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 text-blue-400 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      {loadingStats === key.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Eye size={12} />
                      )}
                      View
                    </button>

                    <button
                      onClick={() => handleViewStats(key.id)}
                      disabled={loadingStats === key.id}
                      className="flex items-center gap-1.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 disabled:opacity-50 text-[#25D366] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                    >
                      {loadingStats === key.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <TrendingUp size={12} />
                      )}
                      Stats
                    </button>

                    {key.isActive && (
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {loadingKeys && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[#25D366]" size={24} />
          </div>
        )}

        {/* USAGE INSTRUCTIONS */}
        {keys.length > 0 && (
          <div className="bg-[#111] border border-[#25D366]/20 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Code size={16} className="text-[#25D366]" />
              How to Use Your API Key <button onClick={handleSendMessage}>check api key</button>
            </h3>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Endpoint</p>
                <div className="bg-[#0a0a0a] rounded-xl p-3 overflow-x-auto">
                  <code className="text-xs text-green-400 font-mono">
                    POST {process.env.NEXT_PUBLIC_API_URL}/api/whatsapp/send-via-api
                  </code>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Headers</p>
                <div className="bg-[#0a0a0a] rounded-xl p-3 overflow-x-auto">
                  <code className="text-xs text-green-400 font-mono">
                    x-api-key: {'<your_api_key>'}<br />
                    Content-Type: application/json
                  </code>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">Request Body</p>
                <div className="bg-[#0a0a0a] rounded-xl p-3 overflow-x-auto">
                  <code className="text-xs text-green-400 font-mono">
                    {`{\n  "numbers": ["+1234567890", "+9876543210"],\n  "message": "Hello from API"\n}`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
