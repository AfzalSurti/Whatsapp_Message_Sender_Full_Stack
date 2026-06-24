 'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Zap,
  Shield,
  Users,
  BarChart2,
  Bot,
  ArrowRight,
  Check,
  Sparkles,
  Send,
  Clock3,
  BadgeCheck,
  PlayCircle,
  TrendingUp,
} from 'lucide-react';
import { AuthRedirectGate } from '@/hooks/useRedirectIfAuthenticated';

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

const stats = [
  { value: '2 min', label: 'to go live' },
  { value: 'Live', label: 'delivery tracking' },
  { value: 'AI', label: 'message generation' },
];

const highlights = [
  {
    title: 'Campaign control room',
    desc: 'See drafts, delivery status, and recent activity in one place.',
    icon: <TrendingUp size={18} />,
  },
  {
    title: 'Safer sending flow',
    desc: 'Built-in pacing and unique message variation help reduce risk.',
    icon: <Shield size={18} />,
  },
  {
    title: 'AI composer',
    desc: 'Turn a short prompt into a ready-to-send WhatsApp message.',
    icon: <Sparkles size={18} />,
  },
];

const testimonials = [
  {
    quote: 'It feels like a real product now, not just a demo page.',
    name: 'Product lead',
    role: 'Ops and growth',
  },
  {
    quote: 'The hero and preview card do the selling before the copy even starts.',
    name: 'Frontend designer',
    role: 'UI and conversion',
  },
];

export default function LandingPage() {
  useEffect(() => {
    const els = document.querySelectorAll('.pop-up');
    if (!els || els.length === 0) return;

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });

    els.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <AuthRedirectGate>
    <div className="min-h-screen bg-[#070b09] text-white font-sans">

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-16 py-4 bg-[#070b09]/78 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#25D366] flex items-center justify-center shadow-[0_0_30px_rgba(37,211,102,0.35)]">
            <MessageSquare size={18} className="text-black" />
          </div>
          <div>
            <span className="block font-bold text-base tracking-tight leading-none">WA Sender</span>
            <span className="block text-[11px] uppercase tracking-[0.3em] text-white/40 mt-1">AI bulk campaigns</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2 rounded-full">
            Login
          </Link>
          <Link href="/signup" className="text-sm bg-[#25D366] hover:bg-[#1ebe5d] text-black font-semibold px-5 py-2.5 rounded-full transition-colors shadow-[0_0_24px_rgba(37,211,102,0.22)]">
            Get Started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6 md:px-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[820px] h-[520px] bg-[#25D366]/12 rounded-full blur-[130px]" />
          <div className="absolute bottom-0 right-[-8rem] w-[24rem] h-[24rem] bg-[#25D366]/8 rounded-full blur-[140px]" />
        </div>

          <div className="relative z-10 max-w-7xl mx-auto grid gap-14 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/20 px-4 py-2 rounded-full mb-6 tracking-[0.28em] uppercase">
              <Sparkles size={14} /> No API Required
            </span>
            <h1 className="text-6xl md:text-8xl font-black leading-[0.92] tracking-tight mb-6">
              Bulk WhatsApp
              <span className="block text-white">Messaging that feels</span>
              <span className="block text-[#25D366]">built for growth</span>
            </h1>
            <p className="text-lg md:text-xl text-white/65 mb-8 max-w-xl leading-relaxed">
              Write campaigns faster with AI, send them safely with smart pacing, and watch every delivery update live from one clean dashboard.
            </p>

            <div className="flex flex-wrap gap-3 mb-8 pop-up">
              {stats.map((item) => (
                <div key={item.label} className="min-w-[150px] rounded-2xl border border-white/8 bg-white/4 px-4 py-3 backdrop-blur-sm">
                  <div className="text-2xl font-black text-white">{item.value}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45 mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 flex-wrap pop-up">
              <Link href="/signup" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-7 py-4 rounded-full transition-all text-base shadow-[0_0_24px_rgba(37,211,102,0.22)]">
                Start for Free <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 border border-white/12 hover:border-white/24 bg-white/0 hover:bg-white/5 text-white px-7 py-4 rounded-full transition-all text-base">
                <PlayCircle size={18} /> Sign In
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/50 pop-up">
              <div className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-[#25D366]" /> Saved sessions
              </div>
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-[#25D366]" /> Live progress
              </div>
              <div className="flex items-center gap-2">
                <Send size={16} className="text-[#25D366]" /> Campaign ready in minutes
              </div>
            </div>
          </div>

          <div className="relative pop-up">
            <div className="absolute inset-0 bg-[#25D366]/10 blur-3xl rounded-full -z-10" />
            <div className="rounded-[32px] border border-white/8 bg-[#0c120f]/90 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-white/3">
                <div>
                  <div className="text-sm font-semibold text-white">Campaign dashboard</div>
                  <div className="text-xs text-white/45">Diwali festive offer</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#25D366]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] animate-pulse" /> Live
                </div>
              </div>

              <div className="grid gap-4 p-6">
                <div className="rounded-3xl border border-white/8 bg-[#0f1713] p-5 pop-up">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/40 mb-1">AI composer</p>
                      <p className="text-lg font-semibold">Prompt to message</p>
                    </div>
                    <Bot size={18} className="text-[#25D366]" />
                  </div>
                  <div className="rounded-2xl bg-black/30 border border-white/8 p-4 text-sm text-white/70 leading-relaxed">
                    Diwali festival offer, casual friendly tone
                  </div>
                  <div className="mt-4 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 p-4 text-sm text-white/90 leading-relaxed">
                    Hey! Happy Diwali. We have a special festive offer just for you. Grab it before it ends.
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pop-up">
                  {[
                    { label: 'Sent', value: '248' },
                    { label: 'Queued', value: '36' },
                    { label: 'Failed', value: '2' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-white/40">{item.label}</div>
                      <div className="text-2xl font-black mt-2">{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-white/8 bg-[#0f1713] p-5 pop-up">
                  <div className="flex items-center justify-between mb-3 text-sm">
                    <span className="text-white/70">Delivery progress</span>
                    <span className="text-[#25D366]">92%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/8 overflow-hidden">
                    <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[#25D366] to-[#1ebe5d]" />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3 pop-up">
                  {highlights.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                      <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-3">
                        {item.icon}
                      </div>
                      <div className="font-semibold text-sm mb-1">{item.title}</div>
                      <div className="text-xs text-white/45 leading-relaxed">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES - condensed 2x3 grid */}
      <section className="py-20 px-6 md:px-16 max-w-7xl mx-auto pop-up">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-[#25D366] mb-3">Features</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight">Everything you need to scale.</h2>
          </div>
          <p className="text-white/55 max-w-xl leading-relaxed">
            A focused feature grid highlights core capabilities at a glance.
          </p>
        </div>

        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-white/8 bg-white/4 p-6 hover:border-[#25D366]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-3">
                {feature.icon}
              </div>
              <div className="font-semibold mb-1">{feature.title}</div>
              <div className="text-sm text-white/60 leading-relaxed">{feature.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 md:px-16 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-[0.3em] text-[#25D366] mb-3">Process</p>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">How it works</h2>
          <p className="text-white/55">Up and running in under 2 minutes, with a cleaner visual story.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step, index) => (
            <div key={step.num} className="relative rounded-[28px] border border-white/8 bg-white/4 p-7 overflow-hidden">
              <div className="absolute top-0 right-0 px-5 py-3 text-[#25D366]/15 text-6xl font-black">{step.num}</div>
              <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center mb-5">
                {index === 0 ? <Users size={18} /> : index === 1 ? <BadgeCheck size={18} /> : <Send size={18} />}
              </div>
              <h3 className="font-bold text-xl mb-3">{step.title}</h3>
              <p className="text-white/55 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-8 px-6 md:px-16 max-w-6xl mx-auto">
        <div className="rounded-[32px] border border-white/8 bg-[#0d120f] p-6 md:p-8 grid gap-4 md:grid-cols-2 pop-up">
          {testimonials.map((item) => (
            <div key={item.name} className="rounded-3xl border border-white/8 bg-white/4 p-5">
              <p className="text-white/80 leading-relaxed mb-4">&ldquo;{item.quote}&rdquo;</p>
              <div className="text-sm text-white/55">
                <span className="font-semibold text-white">{item.name}</span> - {item.role}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 md:px-16 text-center">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-[#0f1713] to-[#09100c] border border-[#25D366]/20 rounded-[36px] p-10 md:p-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#25D366]/6 pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Ready to launch a better landing flow?</h2>
            <p className="text-white/60 mb-8 max-w-2xl mx-auto leading-relaxed">This version gives you a real product narrative: proof, preview, features, and a stronger call to action.</p>
            <Link href="/signup" className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-black font-bold px-9 py-4 rounded-full transition-all text-base shadow-[0_0_24px_rgba(37,211,102,0.22)]">
              Create Free Account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10 px-6 md:px-16 text-center text-white/45 text-sm">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-[#25D366] flex items-center justify-center">
            <MessageSquare size={11} className="text-black" />
          </div>
          <span className="font-semibold text-white">WA Sender</span>
        </div>
        <p>Built with Next.js, Node.js, Tailwind CSS, and whatsapp-web.js</p>
      </footer>

    </div>
    </AuthRedirectGate>
  );
}