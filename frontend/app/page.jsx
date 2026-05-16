'use client';
import Link from 'next/link';
import { MessageSquare, Zap, Shield, Users, BarChart2, Bot, ArrowRight, Check } from 'lucide-react';

const features = [
  { icon: <Zap size={22} />, title: 'Bulk Sending', desc: 'Send to hundreds of contacts at once with smart delays.' },
  { icon: <Bot size={22} />, title: 'AI Messages', desc: 'Describe your message — AI writes it for you instantly.' },
  { icon: <Shield size={22} />, title: 'Anti-Ban Built In', desc: 'Random delays and unique messages keep your account safe.' },
  { icon: <BarChart2 size={22} />, title: 'Live Progress', desc: 'Watch sent, failed, and skipped update in real time.' },
  { icon: <Users size={22} />, title: 'Multi-User', desc: 'Each user has their own WhatsApp session and history.' },
  { icon: <MessageSquare size={22} />, title: 'Full History', desc: 'Every message logged — filter by status, export anytime.' },
];

const steps = [
  { num: '01', title: 'Sign Up', desc: 'Create your account in seconds.' },
  { num: '02', title: 'Connect WhatsApp', desc: 'Scan QR once — session saved forever.' },
  { num: '03', title: 'Send Messages', desc: 'Upload numbers, write or AI-generate message, send.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={16} className="text-black" />
          </div>
          <span className="font-bold text-lg tracking-tight">WA Sender</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2">
            Login
          </Link>
          <Link href="/signup" className="text-sm bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2 rounded-xl transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-40 pb-24 px-6 md:px-16 text-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#25D366]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="inline-block text-xs font-semibold text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/20 px-4 py-1.5 rounded-full mb-6 tracking-wider uppercase">
            No API Required
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            Bulk WhatsApp Messaging
            <span className="block text-[#25D366]">Powered by AI</span>
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Send thousands of WhatsApp messages without the official API.
            Let AI write your messages. Watch progress live.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/signup" className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-8 py-4 rounded-xl transition-all text-base">
              Start for Free <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-white px-8 py-4 rounded-xl transition-all text-base">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6 md:px-16 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need</h2>
          <p className="text-gray-400">Built for real businesses. Production ready.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-[#25D366]/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-4 group-hover:bg-[#25D366]/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 md:px-16 max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-gray-400">Up and running in under 2 minutes.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl font-black text-[#25D366]/20 mb-4">{s.num}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-gray-400 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 md:px-16 text-center">
        <div className="max-w-2xl mx-auto bg-[#111] border border-[#25D366]/20 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#25D366]/5 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4">Ready to start sending?</h2>
            <p className="text-gray-400 mb-8">Free to use. No credit card required.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-10 py-4 rounded-xl transition-all text-base">
              Create Free Account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-8 px-6 md:px-16 text-center text-gray-500 text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={10} className="text-black" />
          </div>
          <span className="font-semibold text-white">WA Sender</span>
        </div>
        <p>© 2026 WA Sender. Built with Node.js, Next.js & whatsapp-web.js</p>
      </footer>

    </div>
  );
}