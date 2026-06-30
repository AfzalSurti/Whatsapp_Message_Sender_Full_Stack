"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  History,
  Key,
  Layers,
  Loader2,
  Pencil,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/auth";
import { whatsappAPI } from "@/lib/api";
import useWebSocket from "@/hooks/useWebSocket";
import { DashboardShellProvider } from "./DashboardShellContext";
import DashboardNav from "../components/DashboardNav";
import { mainNavItems, manageNavItems, settingsNavItem } from "@/lib/dashRoutes";
import ConfirmModal from "@/components/dashboard/ConfirmModal";
import { formatPhoneNumber } from "@/lib/phone";


const navItems = [...mainNavItems, ...manageNavItems, settingsNavItem];

export default function DashboardLayout({ children }) {
  const { user, loading, logout, updateProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [waStatus, setWaStatus] = useState('disconnected');
  const [connectedPhone, setConnectedPhone] = useState(null);
  const [schedulerAlertPhone, setSchedulerAlertPhone] = useState(null);
  const [editingAlertPhone, setEditingAlertPhone] = useState(false);
  const [alertPhoneDraft, setAlertPhoneDraft] = useState('');
  const [savingAlertPhone, setSavingAlertPhone] = useState(false);
  const [qrImage, setQrImage] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrStatusText, setQrStatusText] = useState("Waiting for QR code...");
  const [connectError, setConnectError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const statusInitRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await whatsappAPI.getStatus();
      const status = res.data.status;

      if (res.data.qr) {
        setQrImage(res.data.qr);
        // setShowQR(true);
        setQrStatusText("Scan the QR code in WhatsApp to finish connecting.");
        setConnectError("");
      }

      if (status === "connected") {
        setWaStatus("connected");
        setShowQR(false);
        setQrImage(null);
        if (res.data.phoneNumber) {
          setConnectedPhone(res.data.phoneNumber);
        }
        if (res.data.schedulerAlertPhone) {
          setSchedulerAlertPhone(res.data.schedulerAlertPhone);
        }
      } else if (status === 'pending') {
        setWaStatus('pending');
        if (res.data.restoring) {
          setQrStatusText("Restoring WhatsApp session...");
        }
      } else {
        setWaStatus('disconnected');
        setConnectedPhone(null);
        setSchedulerAlertPhone(null);
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
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!user || statusInitRef.current) return;
    statusInitRef.current = true;
    fetchStatus();
  }, [fetchStatus, user]);

  useEffect(() => {
    if (waStatus !== "pending") return;
    const id = setInterval(fetchStatus, 2000);
    return () => clearInterval(id);
  }, [fetchStatus, waStatus]);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "qr") {
      setQrImage(data.qr);
      // setShowQR(true);
      setWaStatus("pending");
      setQrStatusText("Scan the QR code in WhatsApp to finish connecting.");
      setConnectError("");
    }
    if (data.type === "ready") {
      setWaStatus("connected");
      setShowQR(false);
      setQrImage(null);
      setQrStatusText("WhatsApp connected successfully.");
      setConnectError("");
      setSending(false);
      setProgress(null);
      if (data.phoneNumber) {
        setConnectedPhone(data.phoneNumber);
      }
      fetchStatus();
      toast.success('WhatsApp connected!');
    }
    if (data.type === "disconnected") {
      setConnectError(data.reason || "WhatsApp disconnected");
      setQrStatusText("Connection failed. Try again or use Re-generate QR.");
      setSending(false);
      setConnectedPhone(null);
      setWaStatus((status) => (status === 'pending' ? 'pending' : 'disconnected'));
      toast.error(data.reason || 'WhatsApp disconnected');
    }
    if (data.type === "progress") setProgress(data);
    if (data.type === "sendingComplete") {
      setSending(false);
      toast.success("All messages sent!");
    }
    if (data.type === "sendingError") {
      setSending(false);
      toast.error(`Sending failed: ${data.error}`);
    }
  }, [fetchStatus]);

  const handleSaveAlertPhone = async () => {
    const normalized = normalizePhoneNumber(alertPhoneDraft);
    if (!normalized?.e164) {
      toast.error('Enter a valid alert phone number');
      return;
    }

    setSavingAlertPhone(true);
    try {
      await updateProfile({ schedulerAlertPhone: normalized.e164 });
      setSchedulerAlertPhone(normalized.e164);
      setEditingAlertPhone(false);
      toast.success('Scheduler alert number updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update alert number');
    } finally {
      setSavingAlertPhone(false);
    }
  };

  const displayAlertPhone = schedulerAlertPhone || connectedPhone;

  const wsEnabled = mounted && Boolean(user) && Boolean(getToken());
  useWebSocket(handleWsMessage, wsEnabled);

  const handleConnect = async (options = {}) => {
    const { silent = false, restoreOnly = false } = options;

    try {
      if (restoreOnly) {
        setWaStatus("pending");
        setQrStatusText("Restoring WhatsApp session...");
      } else {
        setShowQR(true);
        setQrImage(null);
        setConnectError("");
        setQrStatusText("Starting WhatsApp connection...");
        setWaStatus("pending");
      }

      const res = await whatsappAPI.connect({ fresh: false });

      if (res.data.status === "connected") {
        setWaStatus("connected");
        setShowQR(false);
        setQrImage(null);
        setQrStatusText('WhatsApp connected successfully.');
        if (res.data.phoneNumber) {
          setConnectedPhone(res.data.phoneNumber);
        }
        if (!silent) toast.success('WhatsApp connected!');
        return;
      }

      if (res.data.qr) {
        setQrImage(res.data.qr);
        setShowQR(true);
        setQrStatusText("Scan the QR code in WhatsApp to finish connecting.");
      } else if (res.data.hasStoredSession || restoreOnly) {
        setWaStatus("pending");
        await fetchStatus();
      } else {
        await fetchStatus();
      }

      if (!silent && !restoreOnly) {
        toast("Scan the QR code to connect", { icon: "QR" });
      }
    } catch (err) {
      setConnectError(err.response?.data?.error || "Connection failed");
      setQrStatusText("Could not start the connection.");
      if (!silent)
        toast.error(err.response?.data?.error || "Connection failed");
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappAPI.disconnect();
      setWaStatus('disconnected');
      setConnectedPhone(null);
      setShowQR(false);
      setQrImage(null);
      setQrStatusText("Connection closed.");
      setConnectError("");
      toast.success("WhatsApp disconnected");
    } catch {
      toast.error("Disconnect failed");
    }
  };

  const handleRegenerateQr = async () => {
    try {
      setShowQR(true);
      setQrImage(null);
      setConnectError("");
      setQrStatusText("Clearing old session and generating new QR...");
      setWaStatus("pending");
      await whatsappAPI.connect({ fresh: true });

      await fetchStatus();
    } catch (err) {
      setConnectError(err.response?.data?.error || "Could not regenerate QR");
      setQrStatusText("Could not regenerate QR.");
      toast.error(err.response?.data?.error || "Could not regenerate QR");
    }
  };

  const shellValue = useMemo(
    () => ({
      waStatus,
      sending,
      progress,
      setSending,
      setProgress,
    }),
    [progress, sending, waStatus],
  );

  if (!mounted || loading || !user) {
    if (mounted && !loading && !user && !getToken()) {
      return null;
    }

    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
        <p className="text-sm text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <DashboardShellProvider value={shellValue}>
      <div className="min-h-screen bg-[#0a0a0a] text-white lg:flex">
        <DashboardNav />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 h-16 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur px-4 md:px-8 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">
                {navItems.find((item) => item.href === pathname)?.label ||
                  "Dashboard"}
              </div>
               <div className="text-sm text-gray-500">
                {navItems.find((item) => item.href === pathname)?.description ||
                  "Dashboard"}
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              {sessionLoading && <span className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400"><Loader2 size={13} className="animate-spin" /> Syncing</span>}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-white/5">
                  <span className={`w-2 h-2 rounded-full ${waStatus === 'connected' ? 'bg-[#25D366]' : 'bg-red-500'}`} />
                  <span>
                    {waStatus === 'connected'
                      ? (connectedPhone ? `Connected · ${formatPhoneNumber(connectedPhone)}` : 'Connected')
                      : waStatus === 'pending'
                        ? 'Restoring...'
                        : 'Disconnected'}
                  </span>
                </span>

                {waStatus === 'connected' && displayAlertPhone && !editingAlertPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlertPhoneDraft(displayAlertPhone);
                      setEditingAlertPhone(true);
                    }}
                    className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-200 hover:border-amber-400/40 transition-colors"
                    title="Number that receives scheduler reminders"
                  >
                    <Bell size={12} />
                    Alerts · {formatPhoneNumber(displayAlertPhone)}
                    <Pencil size={11} className="opacity-70" />
                  </button>
                )}

                {editingAlertPhone && (
                  <div className="flex items-center gap-2">
                    <input
                      type="tel"
                      value={alertPhoneDraft}
                      onChange={(e) => setAlertPhoneDraft(e.target.value)}
                      className="w-36 sm:w-44 px-3 py-1.5 rounded-xl bg-[#111] border border-white/10 text-xs"
                      placeholder="+91XXXXXXXXXX"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAlertPhone}
                      disabled={savingAlertPhone}
                      className="text-xs px-3 py-1.5 rounded-xl bg-[#25D366] text-black font-semibold disabled:opacity-50"
                    >
                      {savingAlertPhone ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAlertPhone(false)}
                      className="text-xs px-2 py-1.5 text-gray-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {waStatus === 'connected' ? (
                  <button onClick={handleDisconnect} className="hidden sm:flex items-center gap-2 text-xs border border-white/10 hover:border-red-400/40 hover:text-red-400 px-3 py-2 rounded-xl transition-colors"><WifiOff size={14} /> Disconnect</button>
                ) : (
                  <button
                    onClick={() => handleConnect()}
                    className="flex items-center gap-2 text-xs bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-3 py-2 rounded-xl transition-colors"
                  >
                    <Wifi size={14} /> Connect
                  </button>
                )}
              </div>
            </div>
          </header>
          {/* <DashboardHead/> */}

          <main>{children}</main>
        </div>

        <ConfirmModal
          open={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          title="Are you sure you want to logout?"
          message="Your dashboard session will close. WhatsApp stays connected on the server so scheduled campaigns can still send."
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
                  <p className="text-gray-400 text-sm">
                    Open WhatsApp, Linked Devices, then Link a Device.
                  </p>
                </div>
                <button
                  onClick={() => setShowQR(false)}
                  className="text-gray-500 hover:text-white transition-colors"
                  aria-label="Close QR popup"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-5 mb-5 min-h-[17rem] flex flex-col items-center justify-center">
                {qrImage ? (
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    <Image
                      src={qrImage}
                      alt="QR Code"
                      width={192}
                      height={192}
                      unoptimized
                      className="w-48 h-48"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Loader2
                      size={28}
                      className="animate-spin text-[#25D366] mb-3"
                    />
                    <p className="text-white font-medium">
                      Waiting for QR code...
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      This usually takes a few seconds.
                    </p>
                  </div>
                )}
                <div className="mt-2 text-sm text-gray-300">{qrStatusText}</div>
                {connectError && (
                  <div className="mt-3 text-sm text-red-400">
                    {connectError}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRegenerateQr}
                  className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
                >
                  Re-generate QR
                </button>
                <button
                  onClick={() => setShowQR(false)}
                  className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
                >
                  Close
                </button>
              </div>
              {waStatus === "pending" && !qrImage && (
                <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm mt-4">
                  <Loader2 size={14} className="animate-spin" /> Waiting for
                  scan...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShellProvider>
  );
}
