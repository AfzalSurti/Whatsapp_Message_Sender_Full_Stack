// or import { useUser } from '@supabase/auth-helpers-react'; // If using Supabase

import { Fragment } from "react";
import {
  ChevronDown,
  User,
  LogOut,
  Settings,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getToken } from "@/lib/auth";

const Navigation = () => {
  // Option 1: Using NextAuth
  const { user } = useAuth();
  const token = getToken();
  const hasSession = Boolean(user || (token && cachedUser));

  // Option 2: Using Supabase
  // const { user } = useUser();
  // const isLoggedIn = !!user;

  // Option 3: Using custom auth context
  // const { user, isLoggedIn } = useAuth();

  return (
    // <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#070b09]/78 backdrop-blur-xl border-b border-white/5">
    //   {/* Logo - unchanged */}
    //   <div className="flex items-center gap-3">
    //     <div className="w-10 h-10 rounded-2xl bg-[#25D366] flex items-center justify-center shadow-[0_0_30px_rgba(37,211,102,0.35)]">
    //       <MessageSquare size={18} className="text-black" />
    //     </div>
    //     <div>
    //       <span className="block font-bold text-base tracking-tight leading-none">
    //         WA Sender
    //       </span>
    //       <span className="block text-[11px] uppercase tracking-[0.3em] text-white/40 mt-1">
    //         AI bulk campaigns
    //       </span>
    //     </div>
    //   </div>

    //   {/* Right section - conditional rendering */}
    //   <div className="flex items-center gap-2 md:gap-3">
    //     {isLoggedIn ? (
    //       // User is logged in - show profile dropdown
    //       <Menu as="div" className="relative">
    //         <Menu.Button className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-white/5 transition-colors">
    //           <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-semibold text-sm">
    //             {user?.name?.[0] || user?.email?.[0] || "U"}
    //           </div>
    //           <ChevronDown size={16} className="text-white/60" />
    //         </Menu.Button>

    //         <Transition
    //           as={Fragment}
    //           enter="transition ease-out duration-200"
    //           enterFrom="transform opacity-0 scale-95"
    //           enterTo="transform opacity-100 scale-100"
    //           leave="transition ease-in duration-75"
    //           leaveFrom="transform opacity-100 scale-100"
    //           leaveTo="transform opacity-0 scale-95"
    //         >
    //           <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-[#0f1411] border border-white/10 rounded-2xl shadow-2xl py-1 focus:outline-none">
    //             <div className="px-4 py-3 border-b border-white/5">
    //               <p className="text-sm font-medium text-white">
    //                 {user?.name || "User"}
    //               </p>
    //               <p className="text-xs text-white/40 truncate">
    //                 {user?.email}
    //               </p>
    //             </div>
    //             <Menu.Item>
    //               {({ active }) => (
    //                 <a
    //                   href="/profile"
    //                   className={`${
    //                     active ? "bg-white/5" : ""
    //                   } flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 transition-colors`}
    //                 >
    //                   <User size={16} />
    //                   My Profile
    //                 </a>
    //               )}
    //             </Menu.Item>
    //             <Menu.Item>
    //               {({ active }) => (
    //                 <a
    //                   href="/settings"
    //                   className={`${
    //                     active ? "bg-white/5" : ""
    //                   } flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 transition-colors`}
    //                 >
    //                   <Settings size={16} />
    //                   Settings
    //                 </a>
    //               )}
    //             </Menu.Item>
    //             <Menu.Item>
    //               {({ active }) => (
    //                 <button
    //                   onClick={() => signOut()}
    //                   className={`${
    //                     active ? "bg-white/5" : ""
    //                   } flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 w-full transition-colors`}
    //                 >
    //                   <LogOut size={16} />
    //                   Sign Out
    //                 </button>
    //               )}
    //             </Menu.Item>
    //           </Menu.Items>
    //         </Transition>
    //       </Menu>
    //     ) : (
    //       // User is not logged in - show login/signup buttons
    //       <>
    //         <Link
    //           href="/login"
    //           className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-full"
    //         >
    //           Login
    //         </Link>
    //         <Link
    //           href="/signup"
    //           className="text-sm bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-full transition-colors shadow-[0_0_24px_rgba(37,211,102,0.22)]"
    //         >
    //           Get Started
    //         </Link>
    //       </>
    //     )}
    //   </div>
    // </nav>
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#070b09]/78 backdrop-blur-xl border-b border-white/5">
      {/* Logo */}
      <div className="flex items-center gap-3">{/* ... logo code ... */}</div>

      {/* Right section */}
      <div className="flex items-center gap-2 md:gap-3">
        {hasSession ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/5 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366] font-semibold text-sm">
              {user?.name?.[0] || user?.email?.[0] || "U"}
            </div>
            <span className="text-sm text-white/80 hidden sm:block">
              {user?.name || "User"}
            </span>
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-full"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-full transition-colors shadow-[0_0_24px_rgba(37,211,102,0.22)]"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
