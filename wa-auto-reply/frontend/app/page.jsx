'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Layers, MessageSquare, Sparkles, Wifi } from 'lucide-react';
import { AuthRedirectGate } from '@/hooks/useRedirectIfAuthenticated';

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      router.replace('/dashboard/auto-reply');
    }
  }, [router]);

  return (
    <AuthRedirectGate>
      <div className="min-h-screen bg-[#070b09] text-white font-sans">
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#070b09]/78 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366] flex items-center justify-center">
              <MessageSquare size={18} className="text-black" />
            </div>
            <div>
              <span className="block font-bold text-base tracking-tight leading-none">WA Auto Reply</span>
              <span className="block text-[11px] uppercase tracking-[0.3em] text-white/40 mt-1">AI assistant</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-full">
              Login
            </Link>
            <Link href="/signup" className="text-sm bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-full transition-colors">
              Get Started
            </Link>
          </div>
        </nav>

        <section className="pt-32 pb-20 px-6 md:px-16 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[520px] bg-[#25D366]/12 rounded-full blur-[130px]" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/20 px-4 py-2 rounded-full mb-6 tracking-[0.28em] uppercase">
              <Sparkles size={14} /> Standalone App
            </span>
            <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6">
              WhatsApp Auto Reply
              <span className="block text-[#25D366]">+ AI Templates</span>
            </h1>
            <p className="text-lg md:text-xl text-white/65 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect WhatsApp via QR, set up smart auto replies, and build AI conversation templates — without bulk sending or campaigns.
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap mb-14">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-7 py-4 rounded-full transition-all text-base">
                Start for Free <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 border border-white/12 hover:border-white/24 text-white px-7 py-4 rounded-full transition-all text-base">
                Sign In
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-3 max-w-3xl mx-auto">
              {[
                { icon: <Wifi size={22} />, title: 'QR Connect', desc: 'Scan once and keep your WhatsApp session saved.' },
                { icon: <Bot size={22} />, title: 'Auto Reply', desc: 'Smart replies with AI personality and contact rules.' },
                { icon: <Layers size={22} />, title: 'AI Templates', desc: 'Intent-based workflows and lead capture flows.' },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/8 bg-white/4 p-6 text-left">
                  <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-3">
                    {item.icon}
                  </div>
                  <div className="font-semibold mb-1">{item.title}</div>
                  <div className="text-sm text-white/60 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-white/5 py-10 px-6 text-center text-white/45 text-sm">
          <p>WA Auto Reply — separate from WA Sender bulk messaging</p>
        </footer>
      </div>
    </AuthRedirectGate>
  );
}
