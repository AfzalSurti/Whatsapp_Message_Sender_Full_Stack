'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Settings2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { autoReplyAPI, businessProfileAPI } from '@/lib/api';

const DEFAULT_SEPARATOR = '───────────────';
const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful WhatsApp assistant. Reply naturally and concisely.';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profileLoading, setProfileLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAi, setSavingAi] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [footerText, setFooterText] = useState('');
  const [footerSeparator, setFooterSeparator] = useState(DEFAULT_SEPARATOR);
  const [footerEnabled, setFooterEnabled] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [delay, setDelay] = useState(2000);

  const previewMessage = useMemo(() => {
    const body = 'Your message here...';
    if (!footerEnabled) return body;

    const text = footerText.trim() || businessName.trim();
    if (!text) return body;

    const separator = footerSeparator.trim() || DEFAULT_SEPARATOR;
    return `${body}\n\n${separator}\n${text}`;
  }, [businessName, footerEnabled, footerSeparator, footerText]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await businessProfileAPI.getProfile();
      const profile = res.data.profile;
      setBusinessName(profile.businessName || user?.name || '');
      setFooterText(profile.footerText || '');
      setFooterSeparator(profile.footerSeparator || DEFAULT_SEPARATOR);
      setFooterEnabled(Boolean(profile.footerEnabled));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load business profile');
    } finally {
      setProfileLoading(false);
    }
  }, [user?.name]);

  const fetchAiSettings = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await autoReplyAPI.getConfig();
      const config = res.data.config;
      setSystemPrompt(config.systemPrompt || DEFAULT_SYSTEM_PROMPT);
      setDelay(config.delay || 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load AI settings');
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAiSettings();
    }
  }, [user, fetchProfile, fetchAiSettings]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await businessProfileAPI.updateProfile({
        businessName,
        footerText,
        footerSeparator,
        footerEnabled
      });
      const profile = res.data.profile;
      setBusinessName(profile.businessName || '');
      setFooterText(profile.footerText || '');
      setFooterSeparator(profile.footerSeparator || DEFAULT_SEPARATOR);
      setFooterEnabled(Boolean(profile.footerEnabled));
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save business profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      const res = await autoReplyAPI.updateConfig({
        systemPrompt,
        delay
      });
      const config = res.data.config;
      setSystemPrompt(config.systemPrompt || systemPrompt);
      setDelay(config.delay || delay);
      toast.success('AI personality saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save AI settings');
    } finally {
      setSavingAi(false);
    }
  };

  if (loading || profileLoading || aiLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center">
            <Settings2 size={18} className="text-[#25D366]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Business profile, message footer, and AI personality
            </p>
          </div>
        </div>
      </div>

      <section className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Business Profile</h2>
          <p className="text-sm text-gray-400 mt-1">
            Optional footer appended to bulk, scheduled, auto-reply, and API messages.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              maxLength={120}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#25D366]/40"
              placeholder="Jain Collections"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200">Footer Text</label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              maxLength={200}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#25D366]/40"
              placeholder="Your Business | City"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200">Footer Separator</label>
            <input
              type="text"
              value={footerSeparator}
              onChange={(e) => setFooterSeparator(e.target.value)}
              maxLength={40}
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#25D366]/40 font-mono"
              placeholder="───────────────"
            />
          </div>

          <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 cursor-pointer">
            <div>
              <div className="text-sm font-medium text-gray-200">Enable Footer</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {footerEnabled ? 'Active — footer is added to outgoing messages' : 'Inactive — messages send without footer'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={footerEnabled}
              onClick={() => setFooterEnabled((prev) => !prev)}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                footerEnabled ? 'bg-[#25D366]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                  footerEnabled ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </label>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-200">Live Preview</label>
            <div className="rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {previewMessage}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {savingProfile ? <Loader2 size={18} className="animate-spin" /> : null}
          Save Business Profile
        </button>
      </section>

      <section className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">AI Personality</h2>
          <p className="text-sm text-gray-400 mt-1">
            Used by auto-reply when no AI template matches, or no templates are selected.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-200">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={6}
            placeholder="You are a helpful assistant..."
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm leading-relaxed outline-none focus:border-[#25D366]/40 resize-none"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-200">Response Delay</span>
            <span className="text-[#25D366] font-semibold">{(delay / 1000).toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={1000}
            max={10000}
            step={500}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
            className="w-full accent-[#25D366]"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>1s</span>
            <span>10s</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveAi}
          disabled={savingAi}
          className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {savingAi ? <Loader2 size={18} className="animate-spin" /> : null}
          Save AI Personality
        </button>
      </section>
    </div>
  );
}
