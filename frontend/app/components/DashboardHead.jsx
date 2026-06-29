import { useAuth } from "@/context/AuthContext";
import useWebSocket from "@/hooks/useWebSocket";
import { whatsappAPI } from "@/lib/api";
import {
  mainNavItems,
  manageNavItems,
  settingsNavItem,
} from "@/lib/dashRoutes";
import { Loader2, Wifi, WifiOff, X } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const DashboardHead = () => {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [waStatus, setWaStatus] = useState("disconnected");
  const [qrImage, setQrImage] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrStatusText, setQrStatusText] = useState("Waiting for QR code...");
  const [connectError, setConnectError] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(null);
  const statusInitRef = useRef(false);

  const navItems = [...mainNavItems, ...manageNavItems, settingsNavItem];

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
      } else if (status === "pending") {
        setWaStatus("pending");
        if (res.data.restoring) {
          setQrStatusText("Restoring WhatsApp session...");
        }
      } else {
        setWaStatus("disconnected");
      }

      return res.data;
    } catch {
      return null;
    } finally {
      setSessionLoading(false);
    }
  }, []);

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
      toast.success("WhatsApp connected!");
    }
    if (data.type === "disconnected") {
      setConnectError(data.reason || "WhatsApp disconnected");
      setQrStatusText("Connection failed. Try again or use Re-generate QR.");
      setSending(false);
      setWaStatus((status) =>
        status === "pending" ? "pending" : "disconnected",
      );
      toast.error(data.reason || "WhatsApp disconnected");
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
  }, []);

  useWebSocket(handleWsMessage);

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
        setQrStatusText("WhatsApp connected successfully.");
        if (!silent) toast.success("WhatsApp connected!");
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
        console.log(err)
      setConnectError(err.response?.data?.error || "Connection failed");
      setQrStatusText("Could not start the connection.");
      if (!silent)
        toast.error(err.response?.data?.error || "Connection failed");
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappAPI.disconnect();
      setWaStatus("disconnected");
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

  return (
    <>
      <header className="sticky top-0 z-40 h-16 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur px-4 md:px-8 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-gray-500">
            {navItems.find((item) => item.href === pathname)?.label ||
              "Dashboard"}
          </div>
          <div className="truncate text-base font-semibold">
            {navItems.find((item) => item.href === pathname)?.label ||
              "Dashboard"}
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          {sessionLoading && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <Loader2 size={13} className="animate-spin" /> Syncing
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-white/5">
              <span
                className={`w-2 h-2 rounded-full ${waStatus === "connected" ? "bg-[#25D366]" : "bg-red-500"}`}
              />
              {waStatus === "connected"
                ? "Connected"
                : waStatus === "pending"
                  ? "Restoring..."
                  : "Disconnected"}
            </span>
            {waStatus === "connected" ? (
              <button
                onClick={handleDisconnect}
                className="hidden sm:flex items-center gap-2 text-xs border border-white/10 hover:border-red-400/40 hover:text-red-400 px-3 py-2 rounded-xl transition-colors"
              >
                <WifiOff size={14} /> Disconnect
              </button>
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
                <div className="mt-3 text-sm text-red-400">{connectError}</div>
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
    </>
  );
};

export default DashboardHead;
