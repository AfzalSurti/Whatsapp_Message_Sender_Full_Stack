import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getToken } from "@/lib/auth";

const Navigation = () => {
  // Option 1: Using NextAuth
  const { user } = useAuth();
  const token = getToken();
  const hasSession = Boolean(user || (token && cachedUser));

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#070b09]/78 backdrop-blur-xl border-b border-white/5">
      <div className="flex items-center gap-3">
        <div>
         <img src="/assets/images/Asset 10.png" alt="Logo" width={40} />
        </div>
        <div>
          <span className="block font-bold text-base tracking-tight leading-none text-[20px]">
            WhatsApp Auto
          </span>
          <span className="block text-[10px] uppercase tracking-[0.1em] text-white/50 mt-1">
            Product by <a className="text-primary text-bold">GoMindz</a>
          </span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 md:gap-3">
        {hasSession ? (
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 px-3 py-2 rounded-full bg-white/5 transition-all duration-300 border border-transparent hover:border-white/5"
          >
            {/* Avatar with status indicator */}
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#25D366]/30 to-[#25D366]/10 flex items-center justify-center text-[#25D366] font-semibold text-sm ring-2 ring-[#25D366]/20 group-hover:ring-[#25D366]/40 transition-all">
                {user?.name?.[0] || user?.email?.[0] || "U"}
              </div>
              {/* Online status dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#070b09]">
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75"></div>
              </div>
            </div>

            {/* User info */}
            <div className="flex items-start hidden sm:block">
              <div className="text-sm font-medium text-white/90 group-hover:text-white transition-colors leading-none">
                {user?.name || "User"}
              </div>
              <div className="text-[11px] text-white/40 group-hover:text-white/60 transition-colors leading-none mt-1">
                {user?.email}
              </div>
            </div>
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
