'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, PlusCircle } from 'lucide-react';

const SCHEDULER_TABS = [
  {
    href: '/dashboard/scheduled',
    label: 'All Campaigns',
    icon: CalendarDays,
    match: (pathname) => pathname === '/dashboard/scheduled'
  },
  {
    href: '/dashboard/scheduled/create',
    label: 'Create Campaign',
    icon: PlusCircle,
    match: (pathname) => pathname.startsWith('/dashboard/scheduled/create')
  }
];

export default function ScheduledLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scheduler</h1>
          <p className="text-sm text-gray-400 mt-1">
            View scheduled campaigns or create a new one with segment tags and contacts.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#111] border border-white/10 gap-1">
          {SCHEDULER_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                  active
                    ? 'bg-[#25D366] text-black'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
