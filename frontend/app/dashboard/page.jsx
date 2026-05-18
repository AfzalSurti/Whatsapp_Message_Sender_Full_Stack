'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { whatsappAPI, aiAPI, contactsAPI } from '@/lib/api';
import useWebSocket from '@/hooks/useWebSocket';
import toast from 'react-hot-toast';
import {
  MessageSquare, LogOut, Wifi, WifiOff, Upload, X,
  Send, Bot, History, Loader2, CheckCircle, XCircle,
  SkipForward, User, ChevronRight, Phone, Edit2, Trash2, Plus, Key, Clock
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // WhatsApp state
  const [waStatus, setWaStatus] = useState('disconnected'); // disconnected | pending | connected
  const [qrImage, setQrImage] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrStatusText, setQrStatusText] = useState('Waiting for QR code...');
  const [connectError, setConnectError] = useState('');
  const [connectionNotice, setConnectionNotice] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);

  // Message state
  const [numbers, setNumbers] = useState([]);
  const [numberInput, setNumberInput] = useState('');
  const [message, setMessage] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [messageMode, setMessageMode] = useState('manual'); // manual | ai

  // Sending state
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);

  // Contacts state
  const [savedContacts, setSavedContacts] = useState([]);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showAddContactForm, setShowAddContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading]);

  // Fetch WhatsApp status on load
  useEffect(() => {
    if (user) {
      setSessionLoading(true);  // Reset loading state for new user
      fetchStatus();
    }
  }, [user]);

  // Fetch contacts on load
  useEffect(() => {
    if (user) fetchContacts();
  }, [user]);

  useEffect(() => {
    if (waStatus === 'connected' && showQR) {
      setShowQR(false);
      setQrImage(null);
      setQrStatusText('WhatsApp connected successfully.');
      setConnectionNotice('Yes, WhatsApp connected.');
      setConnectError('');
      toast.success('Yes, WhatsApp connected successfully!');
    }
  }, [waStatus, showQR]);

  useEffect(() => {
    if (!showQR || waStatus !== 'pending') {
      return;
    }

    const intervalId = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [showQR, waStatus]);

  const fetchStatus = async () => {
    try {
      const res = await whatsappAPI.getStatus();
      const nextStatus = res.data.status === 'connected' ? 'connected' : 'disconnected';
      setWaStatus(nextStatus);

      if (nextStatus === 'connected') {
        setShowQR(false);
        setQrImage(null);
        setQrStatusText('WhatsApp connected successfully.');
        setConnectionNotice('Yes, WhatsApp connected.');
        setConnectError('');
      }
    } catch {} finally {
      setSessionLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const res = await contactsAPI.getContacts();
      setSavedContacts(res.data.contacts || []);
    } catch {
      toast.error('Failed to load contacts');
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      toast.error('Enter name and phone number');
      return;
    }

    try {
      if (editingContact) {
        await contactsAPI.updateContact(editingContact._id, {
          name: newContactName,
          phoneNumber: newContactPhone
        });
        toast.success('Contact updated');
      } else {
        await contactsAPI.createContact({
          name: newContactName,
          phoneNumber: newContactPhone
        });
        toast.success('Contact saved');
      }
      setNewContactName('');
      setNewContactPhone('');
      setEditingContact(null);
      setShowAddContactForm(false);
      await fetchContacts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id) => {
    try {
      await contactsAPI.deleteContact(id);
      toast.success('Contact deleted');
      await fetchContacts();
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  const handleEditContact = (contact) => {
    setEditingContact(contact);
    setNewContactName(contact.name);
    setNewContactPhone(contact.phoneNumber);
    setShowAddContactForm(true);
  };

  const handleSelectContact = (contact) => {
    if (!numbers.includes(contact.phoneNumber)) {
      setNumbers([...numbers, contact.phoneNumber]);
      toast.success(`Added ${contact.name}`);
    } else {
      toast.error('Number already added');
    }
  };

  // WebSocket message handler
  const handleWsMessage = useCallback((data) => {
    if (data.type === 'qr') {
      setQrImage(data.qr);
      setShowQR(true);
      setWaStatus('pending');
      setQrStatusText('Scan the QR code in WhatsApp to finish connecting.');
      setConnectError('');
    }
    if (data.type === 'ready') {
      setWaStatus('connected');
      setShowQR(false);
      setQrImage(null);
      setQrStatusText('WhatsApp connected successfully.');
      setConnectionNotice('Yes, WhatsApp connected.');
      setConnectError('');
      setSending(false);
      setProgress(null);
      toast.success('WhatsApp connected!');
    }
    if (data.type === 'disconnected') {
      setWaStatus('disconnected');
      setShowQR(false);
      setQrImage(null);
      setQrStatusText('Connection closed. Click Connect to start again.');
      setConnectionNotice('');
      setSending(false);
      toast.error('WhatsApp disconnected');
    }
    if (data.type === 'progress') {
      setProgress(data);
      if (data.lastError) {
        setConnectError(data.lastError);
      }
    }
    if (data.type === 'sendingComplete') {
      setSending(false);
      toast.success('All messages sent!');
    }
    if (data.type === 'sendingError') {
      setSending(false);
      toast.error(`Sending failed: ${data.error}`);
    }
  }, []);

  useWebSocket(handleWsMessage);

  // Connect WhatsApp
  const handleConnect = async (options = {}) => {
    try {
      setShowQR(true);
      setQrImage(null);
      setConnectError('');
      setQrStatusText('Starting WhatsApp connection...');
      setConnectionNotice('');
      setWaStatus('pending');

      await whatsappAPI.connect();
      if (!options.silent) {
        toast('Scan the QR code to connect', { icon: '📱' });
      }
    } catch (err) {
      setConnectError(err.response?.data?.error || 'Connection failed');
      setQrStatusText('Could not start the connection.');
      toast.error(err.response?.data?.error || 'Connection failed');
    }
  };

  const handleRegenerateQr = async () => {
    try {
      setQrStatusText('Restarting WhatsApp connection...');
      await whatsappAPI.disconnect();
      setWaStatus('disconnected');
      setQrImage(null);
      setConnectionNotice('');
      await handleConnect({ silent: true });
    } catch (err) {
      setConnectError(err.response?.data?.error || 'Could not regenerate QR');
      toast.error(err.response?.data?.error || 'Could not regenerate QR');
    }
  };

  const handleCloseQrPopup = () => {
    setShowQR(false);
    setConnectError('');
  };

  // Disconnect WhatsApp
  const handleDisconnect = async () => {
    try {
      await whatsappAPI.disconnect();
      setWaStatus('disconnected');
      setShowQR(false);
      setQrImage(null);
      setQrStatusText('Connection closed.');
      setConnectError('');
      setConnectionNotice('');
      toast.success('WhatsApp disconnected');
    } catch (err) {
      toast.error('Disconnect failed');
    }
  };

  // Add number chip
  const addNumber = (num) => {
    const clean = num.trim();
    if (!clean) return;
    if (numbers.includes(clean)) {
      toast.error('Number already added');
      return;
    }
    setNumbers([...numbers, clean]);
    setNumberInput('');
  };

  // Remove number chip
  const removeNumber = (num) => {
    setNumbers(numbers.filter(n => n !== num));
  };

  // CSV import
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n');
      const newNums = [];
      lines.forEach((line, i) => {
        if (i === 0 && line.toLowerCase().includes('number')) return; // skip header
        const num = line.split(',')[0].trim();
        if (num && !numbers.includes(num)) newNums.push(num);
      });
      setNumbers(prev => [...prev, ...newNums]);
      toast.success(`${newNums.length} numbers imported`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Generate AI message
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Enter a prompt first');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiAPI.generate(aiPrompt);
      setMessage(res.data.message);
      setMessageMode('manual'); // show in textarea
      toast.success('Message generated!');
    } catch (err) {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Send messages
  const handleSend = async () => {
    if (waStatus !== 'connected') {
      toast.error('Connect WhatsApp first');
      return;
    }
    if (numbers.length === 0) {
      toast.error('Add at least one number');
      return;
    }
    if (!message.trim()) {
      toast.error('Enter a message');
      return;
    }
    setSending(true);
    setProgress({ sent: 0, failed: 0, skipped: 0, current: 0, total: numbers.length });
    try {
      await whatsappAPI.send({ numbers, message });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  const progressPct = progress?.total > 0
    ? Math.round(((progress.sent + progress.failed + progress.skipped) / progress.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* NAVBAR */}
      <nav className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={15} className="text-black" />
          </div>
          <span className="font-bold text-base">WA Sender</span>
        </div>

        <div className="flex items-center gap-4">
          {/* Session Loading Message */}
          {sessionLoading && (
            <div className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Loader2 size={13} className="animate-spin" />
              Retrieving your session...
            </div>
          )}

          {/* WA Status Badge */}
          <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${
            waStatus === 'connected'
              ? 'bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]'
              : waStatus === 'pending'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              waStatus === 'connected' ? 'bg-[#25D366]' :
              waStatus === 'pending' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
            {waStatus === 'connected' ? 'Connected' : waStatus === 'pending' ? 'Scanning...' : 'Disconnected'}
          </div>

          <Link href="/dashboard/groups" className="text-gray-400 hover:text-white transition-colors" title="Contact Groups">
            <Phone size={18} />
          </Link>

          <Link href="/dashboard/scheduled" className="text-gray-400 hover:text-white transition-colors" title="Scheduled Campaigns">
            <Clock size={18} />
          </Link>

          <Link href="/dashboard/history" className="text-gray-400 hover:text-white transition-colors" title="History">
            <History size={18} />
          </Link>

          <Link href="/dashboard/api-keys" className="text-gray-400 hover:text-[#25D366] transition-colors" title="API Keys">
            <Key size={18} />
          </Link>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User size={15} />
            <span className="hidden md:inline">{user?.name}</span>
          </div>

          <button onClick={logout} className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer">
            <LogOut size={17} />
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* QR MODAL */}
        {showQR && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 text-center max-w-sm w-full">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="text-left">
                  <h3 className="font-bold text-lg mb-1">Connect WhatsApp</h3>
                  <p className="text-gray-400 text-sm">Open WhatsApp → Linked Devices → Link a Device</p>
                </div>
                <button
                  onClick={handleCloseQrPopup}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="Close QR popup"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 mb-5 min-h-[17rem] flex flex-col items-center justify-center">
                {qrImage ? (
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    <img src={qrImage} alt="QR Code" className="w-48 h-48" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Loader2 size={28} className="animate-spin text-[#25D366] mb-3" />
                    <p className="text-white font-medium">Waiting for QR code...</p>
                    <p className="text-gray-500 text-sm mt-1">This usually takes a few seconds.</p>
                  </div>
                )}

                <div className="mt-2 text-sm text-gray-300">
                  {qrStatusText}
                </div>

                {connectError && (
                  <div className="mt-3 text-sm text-red-400">{connectError}</div>
                )}

                {connectionNotice && !connectError && (
                  <div className="mt-3 text-sm text-[#25D366] font-medium">
                    {connectionNotice}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRegenerateQr}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Re-generate QR
                </button>
                <button
                  onClick={handleCloseQrPopup}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                >
                  Close
                </button>
              </div>

              {waStatus === 'pending' && !qrImage && (
                <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm mt-4">
                  <Loader2 size={14} className="animate-spin" />
                  Waiting for scan...
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTACTS MODAL */}
        {showContactsModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 text-center max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between gap-4 mb-6">
                <h3 className="font-bold text-lg">Saved Contacts</h3>
                <button
                  onClick={() => {
                    setShowContactsModal(false);
                    setShowAddContactForm(false);
                    setEditingContact(null);
                    setNewContactName('');
                    setNewContactPhone('');
                  }}
                  className="text-gray-500 hover:text-white transition-colors cursor-pointer"
                  aria-label="Close contacts modal"
                >
                  <X size={20} />
                </button>
              </div>

              {!showAddContactForm ? (
                <div className="space-y-3">
                  {savedContacts.length > 0 ? (
                    <>
                      {savedContacts.map((contact) => (
                        <div
                          key={contact._id}
                          className="flex items-center justify-between bg-[#0a0a0a] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
                        >
                          <div className="text-left">
                            <p className="text-sm font-medium text-white">{contact.name}</p>
                            <p className="text-xs text-gray-500">{contact.phoneNumber}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSelectContact(contact)}
                              className="bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => handleEditContact(contact)}
                              className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                              aria-label="Edit contact"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteContact(contact._id)}
                              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                              aria-label="Delete contact"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-center text-gray-500 text-sm py-8">No saved contacts yet</p>
                  )}

                  <button
                    onClick={() => setShowAddContactForm(true)}
                    className="w-full bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer mt-4"
                  >
                    <Plus size={16} /> Add New Contact
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Contact name (e.g., Mom, Office)"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Phone number (e.g., +1234567890)"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleAddContact}
                      className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                    >
                      {editingContact ? 'Update' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setShowAddContactForm(false);
                        setEditingContact(null);
                        setNewContactName('');
                        setNewContactPhone('');
                      }}
                      className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONNECT WHATSAPP CARD */}
        {waStatus !== 'connected' && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <WifiOff size={18} className="text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-sm">WhatsApp Not Connected</p>
                <p className="text-gray-500 text-xs mt-0.5">Scan QR to start sending messages</p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm flex items-center gap-2 cursor-pointer"
            >
              <Wifi size={15} /> Connect
            </button>
          </div>
        )}

        {/* CONNECTED BANNER */}
        {waStatus === 'connected' && (
          <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-[#25D366]" />
              <span className="text-sm font-medium text-[#25D366]">Yes, WhatsApp connected. Ready to send.</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT — NUMBERS */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Phone Numbers</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{numbers.length} added</span>
                <button
                  onClick={() => setShowContactsModal(true)}
                  className="text-xs text-[#25D366] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Phone size={12} /> Saved
                </button>
              </div>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="+91XXXXXXXXXX"
                value={numberInput}
                onChange={(e) => setNumberInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNumber(numberInput)}
                className="flex-1 px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors"
              />
              <button
                onClick={() => addNumber(numberInput)}
                className="bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* CSV Import */}
            <label className="flex items-center gap-2 text-xs text-[#25D366] cursor-pointer hover:underline w-fit">
              <Upload size={13} />
              Import CSV
              <input type="file" accept=".csv" onChange={handleCSV} className="hidden" />
            </label>

            {/* Chips */}
            {numbers.length > 0 && (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {numbers.map((num, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/10 rounded-full px-3 py-1 text-xs text-gray-300">
                    {num}
                    <button onClick={() => removeNumber(num)} className="text-gray-600 hover:text-red-400 transition-colors cursor-pointer">
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {numbers.length === 0 && (
              <div className="text-center py-8 text-gray-600 text-xs">
                Add numbers manually or import a CSV
              </div>
            )}
          </div>

          {/* RIGHT — MESSAGE */}
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-sm">Message</h2>

            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setMessageMode('manual')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  messageMode === 'manual'
                    ? 'bg-[#25D366] text-black'
                    : 'bg-[#0a0a0a] text-gray-400 border border-white/10'
                }`}
              >
                ✍️ Write Manually
              </button>
              <button
                onClick={() => setMessageMode('ai')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  messageMode === 'ai'
                    ? 'bg-[#25D366] text-black'
                    : 'bg-[#0a0a0a] text-gray-400 border border-white/10'
                }`}
              >
                🤖 Generate with AI
              </button>
            </div>

            {/* Manual */}
            {messageMode === 'manual' && (
              <textarea
                placeholder="Type your WhatsApp message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
              />
            )}

            {/* AI */}
            {messageMode === 'ai' && (
              <div className="space-y-3">
                <textarea
                  placeholder='Describe your message... e.g. "Diwali offer, casual friendly tone"'
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366] transition-colors resize-none"
                />
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
                  {aiLoading ? 'Generating...' : 'Generate Message'}
                </button>
                {message && (
                  <div className="bg-[#0a0a0a] border border-[#25D366]/20 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Generated message:</p>
                    <p className="text-sm text-white">{message}</p>
                    <button
                      onClick={() => { setMessage(''); setAiPrompt(''); }}
                      className="text-xs text-gray-600 hover:text-red-400 mt-2"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Char count */}
            {message && (
              <p className="text-xs text-gray-600 text-right">{message.length} characters</p>
            )}
          </div>
        </div>

        {/* SEND BUTTON */}
        <button
          onClick={handleSend}
          disabled={sending || waStatus !== 'connected' || numbers.length === 0 || !message.trim()}
          className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base cursor-pointer"
        >
          {sending ? (
            <><Loader2 size={18} className="animate-spin" /> Sending...</>
          ) : (
            <><Send size={18} /> Send to {numbers.length} {numbers.length === 1 ? 'number' : 'numbers'}</>
          )}
        </button>

        {/* PROGRESS */}
        {progress && (
          <div className="bg-[#111] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Progress</span>
              <span className="text-gray-400">{progress.current || 0} / {progress.total}</span>
            </div>

            {/* Bar */}
            <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#25D366] rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-[#25D366] text-lg font-bold">
                  <CheckCircle size={16} /> {progress.sent || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Sent</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-red-400 text-lg font-bold">
                  <XCircle size={16} /> {progress.failed || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Failed</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-yellow-400 text-lg font-bold">
                  <SkipForward size={16} /> {progress.skipped || 0}
                </div>
                <p className="text-xs text-gray-500 mt-1">Skipped</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}