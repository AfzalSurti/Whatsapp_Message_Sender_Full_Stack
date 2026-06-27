'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Settings2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { businessProfileAPI } from '@/lib/api';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [businessName, setBusinessName] = useState('');

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await businessProfileAPI.getProfile();
      const profile = res.data.profile;
      setBusinessName(profile.businessName || user?.name || '');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load business profile');
    } finally {
      setProfileLoading(false);
    }
  }, [user?.name]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, fetchProfile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await businessProfileAPI.updateProfile({
        businessName,
        footerEnabled: false
      });
      const profile = res.data.profile;
      setBusinessName(profile.businessName || '');
      toast.success('Business profile saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save business profile');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading || profileLoading) {
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
              Business profile and account preferences
            </p>
          </div>
        </div>
      </div>

      <section className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Business Profile</h2>
          <p className="text-sm text-gray-400 mt-1">
            Your business or display name used in the app.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-200">Business Name</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            maxLength={120}
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#25D366]/40"
            placeholder="Your business name"
          />
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
    </div>
  );
}
