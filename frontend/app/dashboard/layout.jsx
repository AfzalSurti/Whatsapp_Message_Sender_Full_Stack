'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/dashboard/ConfirmModal';
import { Activity, BarChart3, ClipboardList, History, Key, Loader2, LogOut, MessageSquare, Send, Settings2, Users, Wifi, WifiOff, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getToken } from '@/lib/auth';
import { whatsappAPI } from '@/lib/api';
import useWebSocket from '@/hooks/useWebSocket';
import { DashboardShellProvider } from './DashboardShellContext';

const mainNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/dashboard/live-feed', label: 'Live Feed', icon: Activity },
  { href: '/dashboard/groups', label: 'Contacts & Segments', icon: Users },
  { href: '/dashboard/scheduled', label: 'Scheduler', icon: Send },
  { href: '/dashboard/templates', label: 'Templates', icon: ClipboardList },
  { href: '/dashboard/history', label: 'History', icon: History },
];

const manageNavItems = [
  { href: '/dashboard/api-keys', label: 'API Keys', icon: Key },
];

const settingsNavItem = { href: '/dashboard/settings', label: 'Settings', icon: Settings2 };

const navItems = [...mainNavItems, ...manageNavItems, settingsNavItem];

export default function DashboardLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrImage, setQrImage] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrStatusText, setQrStatusText] = useState('Waiting for QR code...');
  const [connectError, setConnectError] = useState('');
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const statusInitRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await whatsappAPI.getStatus();
      const status = res.data.status;

      if (res.data.qr) {
        setQrImage(res.data.qr);
        setShowQR(true);
        setQrStatusText('Scan the QR code in WhatsApp to finish connecting.');
        setConnectError('');
      }

      if (status === 'connected') {
        setWaStatus('connected');
        setShowQR(false);
        setQrImage(null);
      } else if (status === 'pending') {
        setWaStatus('pending');
        if (res.data.restoring) {
          setQrStatusText('Restoring WhatsApp session...');
        }
      } else {
        setWaStatus('disconnected');
      }

      return res.data;
    } catch {
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user && !getToken()) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || statusInitRef.current) return;
    statusInitRef.current = true;
    fetchStatus();
  }, [fetchStatus, user]);

  useEffect(() => {
    if (waStatus !== 'pending') return;
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [fetchStatus, waStatus]);

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
      setConnectError('');
      setSending(false);
      setProgress(null);
      toast.success('WhatsApp connected!');
    }
    if (data.type === 'disconnected') {
      setConnectError(data.reason || 'WhatsApp disconnected');
      setQrStatusText('Connection failed. Try again or use Re-generate QR.');
      setSending(false);
      setWaStatus((status) => (status === 'pending' ? 'pending' : 'disconnected'));
      toast.error(data.reason || 'WhatsApp disconnected');
    }
    if (data.type === 'progress') setProgress(data);
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

  const handleConnect = async (options = {}) => {
    const { silent = false, restoreOnly = false } = options;

    try {
      if (restoreOnly) {
        setWaStatus('pending');
        setQrStatusText('Restoring WhatsApp session...');
      } else {
        setShowQR(true);
        setQrImage(null);
        setConnectError('');
        setQrStatusText('Starting WhatsApp connection...');
        setWaStatus('pending');
      }

      const res = await whatsappAPI.connect({ fresh: false });

      if (res.data.status === 'connected') {
        setWaStatus('connected');
        setShowQR(false);
        setQrImage(null);
        setQrStatusText('WhatsApp connected successfully.');
        if (!silent) toast.success('WhatsApp connected!');
        return;
      }

      if (res.data.qr) {
        setQrImage(res.data.qr);
        setShowQR(true);
        setQrStatusText('Scan the QR code in WhatsApp to finish connecting.');
      } else if (res.data.hasStoredSession || restoreOnly) {
        setWaStatus('pending');
        await fetchStatus();
      } else {
        await fetchStatus();
      }

      if (!silent && !restoreOnly) {
        toast('Scan the QR code to connect', { icon: 'QR' });
      }
    } catch (err) {
      setConnectError(err.response?.data?.error || 'Connection failed');
      setQrStatusText('Could not start the connection.');
      if (!silent) toast.error(err.response?.data?.error || 'Connection failed');
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappAPI.disconnect();
      setWaStatus('disconnected');
      setShowQR(false);
      setQrImage(null);
      setQrStatusText('Connection closed.');
      setConnectError('');
      toast.success('WhatsApp disconnected');
    } catch {
      toast.error('Disconnect failed');
    }
  };

  const handleRegenerateQr = async () => {
    try {
      setShowQR(true);
      setQrImage(null);
      setConnectError('');
      setQrStatusText('Clearing old session and generating new QR...');
      setWaStatus('pending');
      await whatsappAPI.connect({ fresh: true });

      await fetchStatus();
    } catch (err) {
      setConnectError(err.response?.data?.error || 'Could not regenerate QR');
      setQrStatusText('Could not regenerate QR.');
      toast.error(err.response?.data?.error || 'Could not regenerate QR');
    }
  };

  const shellValue = useMemo(() => ({
    waStatus,
    sending,
    progress,
    setSending,
    setProgress,
  }), [progress, sending, waStatus]);

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardShellProvider value={shellValue}>
      <div className="min-h-screen bg-[#0a0a0a] text-white lg:flex">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-64 border-r border-[#1f1f1f] bg-[#111] flex flex-col">
          <div className="h-16 px-5 flex items-center gap-3 border-b border-white/5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center"><MessageSquare size={17} className="text-black" /></div>
            <div>
              <div className="font-bold leading-none">WA Sender</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">Campaigns</div>
            </div>
          </div>

          <nav className="p-3 flex-1 overflow-y-auto">
            <div className="text-xs text-gray-500 px-3 mb-2 mt-2">MAIN</div>
            <div className="space-y-1">
              {mainNavItems.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href ||
                  (href === '/dashboard/scheduled' && pathname.startsWith('/dashboard/scheduled'));
                return (
                  <Link key={href} href={href} className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[#25D366] text-black font-semibold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    <Icon size={17} /> {label}
                  </Link>
                );
              })}
            </div>

            <div className="text-xs text-gray-500 px-3 my-3">MANAGE</div>
            <div className="space-y-1">
              {manageNavItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link key={href} href={href} className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? 'bg-[#25D366] text-black font-semibold' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
                    <Icon size={17} /> {label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="px-3 pb-3 border-t border-white/5 pt-3">
            <Link
              href={settingsNavItem.href}
              className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${
                pathname === settingsNavItem.href
                  ? 'bg-[#25D366] text-black font-semibold'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Settings2 size={17} /> {settingsNavItem.label}
            </Link>
          </div>

          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-white">{user?.name?.split(' ').map(n=>n[0]).slice(0,2).join('') || 'U'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{user?.name}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
              </div>
              <button onClick={() => setShowLogoutConfirm(true)} className="text-gray-400 hover:text-red-400 ml-2" aria-label="Logout"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 h-16 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur px-4 md:px-8 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-gray-500">{navItems.find(item => item.href === pathname)?.label || 'Dashboard'}</div>
              <div className="truncate text-base font-semibold">{navItems.find(item => item.href === pathname)?.label || 'Dashboard'}</div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              {sessionLoading && <span className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400"><Loader2 size={13} className="animate-spin" /> Syncing</span>}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-white/5">
                  <span className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-[#25D366]' : 'bg-red-500'}`} />
                  {waStatus === 'connected' ? 'Connected' : waStatus === 'pending' ? 'Restoring...' : 'Disconnected'}
                </span>
                {waStatus === 'connected' ? (
                  <button onClick={handleDisconnect} className="hidden sm:flex items-center gap-2 text-xs border border-white/10 hover:border-red-400/40 hover:text-red-400 px-3 py-2 rounded-xl transition-colors"><WifiOff size={14} /> Disconnect</button>
                ) : (
                  <button onClick={() => handleConnect()} className="flex items-center gap-2 text-xs bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-3 py-2 rounded-xl transition-colors"><Wifi size={14} /> Connect</button>
                )}
              </div>
            </div>
          </header>

          <main>{children}</main>
        </div>

        <ConfirmModal
          open={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          title="Are you sure you want to logout?"
          message="Your current dashboard session will close and you will need to sign in again."
          confirmLabel="Yes, Logout"
          onConfirm={async () => {
            setShowLogoutConfirm(false);
            await logout();
          }}
        />

        {showQR && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] border border-white/5 rounded-2xl p-8 text-center max-w-sm w-full">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="text-left">
                  <h3 className="font-bold text-lg mb-1">Connect WhatsApp</h3>
                  <p className="text-gray-400 text-sm">Open WhatsApp, Linked Devices, then Link a Device.</p>
                </div>
                <button onClick={() => setShowQR(false)} className="text-gray-500 hover:text-white transition-colors" aria-label="Close QR popup"><X size={18} /></button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5 mb-5 min-h-[17rem] flex flex-col items-center justify-center">
                {qrImage ? (
                  <div className="bg-white p-4 rounded-xl inline-block mb-4"><Image src={qrImage} alt="QR Code" width={192} height={192} unoptimized className="w-48 h-48" /></div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center"><Loader2 size={28} className="animate-spin text-[#25D366] mb-3" /><p className="text-white font-medium">Waiting for QR code...</p><p className="text-gray-500 text-sm mt-1">This usually takes a few seconds.</p></div>
                )}
                <div className="mt-2 text-sm text-gray-300">{qrStatusText}</div>
                {connectError && <div className="mt-3 text-sm text-red-400">{connectError}</div>}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleRegenerateQr} className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">Re-generate QR</button>
                <button onClick={() => setShowQR(false)} className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm">Close</button>
              </div>
              {waStatus === 'pending' && !qrImage && <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm mt-4"><Loader2 size={14} className="animate-spin" /> Waiting for scan...</div>}
            </div>
          </div>
        )}
      </div>
    </DashboardShellProvider>
  );
}
