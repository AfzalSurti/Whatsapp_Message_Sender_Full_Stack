'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Activity, Clock3, Loader2, MessageSquareText, Radar, RotateCw, Search, Send, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { logsAPI } from '@/lib/api';
import { useDashboardShell } from '../DashboardShellContext';

const statusStyles = {
  sent: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  skipped: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  running: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  completed: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  pending: 'bg-violet-500/10 text-violet-400 border-violet-500/20'
};

const statusDot = {
  sent: 'bg-[#25D366]',
  failed: 'bg-orange-400',
  skipped: 'bg-violet-400',
  running: 'bg-[#25D366]',
  completed: 'bg-cyan-400',
  pending: 'bg-violet-400'
};

export default function LiveFeedPage() {
  const { user, loading } = useAuth();
  const { progress, sending } = useDashboardShell();
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [liveFeed, setLiveFeed] = useState([]);
  const [campaignProgress, setCampaignProgress] = useState([]);
  const [summary, setSummary] = useState({ totalCampaigns: 0, runningCampaigns: 0, completedCampaigns: 0, recentActivity: 0 });
  const [lastSynced, setLastSynced] = useState(null);

  const fetchLiveFeed = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
    }
    try {
      const res = await logsAPI.getLiveFeed();
      setLiveFeed(res.data.liveFeed || []);
      setCampaignProgress(res.data.campaignProgress || []);
      setSummary(res.data.summary || { totalCampaigns: 0, runningCampaigns: 0, completedCampaigns: 0, recentActivity: 0 });
      setLastSynced(new Date());
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load live feed');
    } finally {
      setLoadingFeed(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      fetchLiveFeed();
    }
  }, [fetchLiveFeed, loading, user]);

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchLiveFeed(true);
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchLiveFeed, user]);

  useEffect(() => {
    if (!user) return;
    if (!progress) return;

    fetchLiveFeed(true);
  }, [fetchLiveFeed, progress?.current, progress?.failed, progress?.skipped, progress?.sent, progress?.total, user]);

  const filteredFeed = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return liveFeed;

    return liveFeed.filter((item) => (
      `${item.title} ${item.subtitle} ${item.statusLabel || ''}`.toLowerCase().includes(query)
    ));
  }, [liveFeed, search]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campaignProgress;

    return campaignProgress.filter((item) => (
      `${item.name} ${item.statusLabel}`.toLowerCase().includes(query)
    ));
  }, [campaignProgress, search]);

  const syncLabel = lastSynced
    ? lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Waiting for sync';

  if (loading || loadingFeed) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-[#25D366]">
          <Loader2 className="animate-spin" size={24} />
          <span className="text-sm font-medium text-white/80">Loading live feed...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-[#25D366]">
              <Activity size={12} /> Live Activity Feed
            </div>
            <h1 className="mt-2 text-3xl font-bold text-white">Live Feed</h1>
            <p className="mt-1 text-sm text-gray-400">Real-time campaign events and message activity sourced from your database.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-[#111] px-4 py-3 text-sm text-gray-400 shadow-sm">
              <Search size={16} className="text-[#25D366]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns or events"
                className="w-56 bg-transparent outline-none placeholder:text-gray-600"
              />
            </div>

            <button
              type="button"
              onClick={() => fetchLiveFeed()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white transition-colors hover:border-[#25D366]/40 hover:text-[#25D366]"
            >
              <RotateCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>

            <div className="inline-flex items-center gap-2 rounded-2xl border border-[#25D366]/20 bg-[#0f1a14] px-4 py-3 text-sm text-[#25D366]">
              <span className="h-2 w-2 rounded-full bg-[#25D366]" />
              {sending ? 'Streaming' : 'Synced'}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/5 bg-[#111] p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Recent activity</div>
            <div className="mt-3 text-3xl font-bold text-white">{summary.recentActivity}</div>
            <div className="mt-1 text-sm text-gray-400">Latest event count from the live feed</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#111] p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Active campaigns</div>
            <div className="mt-3 text-3xl font-bold text-white">{summary.runningCampaigns}</div>
            <div className="mt-1 text-sm text-gray-400">Campaigns currently running</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#111] p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Completed</div>
            <div className="mt-3 text-3xl font-bold text-white">{summary.completedCampaigns}</div>
            <div className="mt-1 text-sm text-gray-400">Completed campaign records</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-[#111] p-5 shadow-sm">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">Last sync</div>
            <div className="mt-3 text-3xl font-bold text-white">{syncLabel}</div>
            <div className="mt-1 text-sm text-gray-400">Pulled from backend and database</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border border-white/5 bg-[#111] p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#25D366]" /> Real-time Message Events
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">From message logs and campaign updates</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/20 bg-[#0f1a14] px-3 py-1 text-xs text-[#25D366]">
                <Radar size={12} /> Live
              </div>
            </div>

            <div className="space-y-1">
              {filteredFeed.length > 0 ? filteredFeed.map((item) => (
                <div key={item.id} className="flex items-start gap-3 border-b border-white/5 py-4 last:border-b-0 last:pb-0">
                  <span className={`mt-2 h-2.5 w-2.5 rounded-full ${statusDot[item.type] || 'bg-[#25D366]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                      {item.statusLabel && (
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusStyles[item.type] || 'bg-white/5 text-white/60 border-white/10'}`}>
                          {item.statusLabel}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{item.subtitle}</p>
                  </div>
                  <div className="shrink-0 text-xs text-gray-500">{item.timeLabel}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-10 text-center text-sm text-gray-500">
                  No live activity matches your search yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#111] p-5 shadow-sm md:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Send size={14} className="text-[#25D366]" /> Campaign Progress
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-500">Derived from campaign records</div>
              </div>
            </div>

            <div className="space-y-5">
              {filteredCampaigns.length > 0 ? filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="space-y-2 rounded-2xl border border-white/5 bg-[#0a0a0a] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{campaign.name}</div>
                      <div className="mt-1 text-xs text-gray-500">{campaign.statusLabel}</div>
                    </div>
                    <div className="shrink-0 text-right text-sm font-semibold" style={{ color: campaign.color }}>
                      {campaign.sentLabel} / {campaign.totalLabel}
                    </div>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${campaign.progress}%`, background: campaign.color }} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{campaign.progress}% complete</span>
                    <span>{campaign.failed} failed · {campaign.skipped} skipped</span>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-[#0a0a0a] px-5 py-10 text-center text-sm text-gray-500">
                  No campaigns found for the current filter.
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-[#25D366]/15 bg-[#0f1a14] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#25D366]/10 p-2 text-[#25D366]">
                  <MessageSquareText size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Synchronized source</div>
                  <div className="mt-1 text-sm text-gray-400">
                    This panel is built from live backend data in MongoDB, and it refreshes as your sending activity updates.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <Clock3 size={12} /> Auto-refresh every 20 seconds and on live send progress.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}