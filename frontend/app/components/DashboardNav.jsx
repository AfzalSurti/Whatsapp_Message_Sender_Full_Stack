import ConfirmModal from "@/components/dashboard/ConfirmModal";
import { useAuth } from "@/context/AuthContext";
import { mainNavItems, manageNavItems, settingsNavItem } from "@/lib/dashRoutes";
import {
  Activity,
  BarChart3,
  Bot,
  ClipboardList,
  History,
  Key,
  Layers,
  LogOut,
  MessageSquare,
  Send,
  Settings2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";



const DashboardNav = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  return (
    <div>
      <div className="lg:w-72"></div>
      <aside className="fixed  lg:h-screen lg:w-72 border-r border-[#1f1f1f] bg-[#111] flex flex-col flex-1">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={17} className="text-black" />
          </div>
          <div>
            <div className="font-bold leading-none">WA Sender</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mt-1">
              Campaigns
            </div>
          </div>
        </div>

        <nav className="p-3 flex-1 overflow-y-auto">
          <div className="text-xs text-gray-500 px-3 mb-2 mt-2">MAIN</div>
          <div className="space-y-1">
            {mainNavItems.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href ||
                (href === "/dashboard/scheduled" &&
                  pathname.startsWith("/dashboard/scheduled"));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-[#25D366] text-black font-semibold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                >
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
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm transition-colors ${active ? "bg-[#25D366] text-black font-semibold" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                >
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
                ? "bg-[#25D366] text-black font-semibold"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Settings2 size={17} /> {settingsNavItem.label}
          </Link>
        </div>

        <div className="px-4 py-3 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-semibold text-white">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("") || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name}</div>
              <div className="text-xs text-gray-400">{user?.email}</div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="text-gray-400 hover:text-red-400 ml-2"
              aria-label="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

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
    </div>
  );
};

export default DashboardNav;
