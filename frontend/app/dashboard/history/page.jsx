'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { logsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { 
  MessageSquare, CheckCircle, XCircle, 
  SkipForward, Loader2, Filter, Download
} from 'lucide-react';

const statusConfig = {
  sent:    { icon: <CheckCircle size={13} />,  color: 'text-[#25D366]', bg: 'bg-[#25D366]/10 border-[#25D366]/20', label: 'Sent' },
  failed:  { icon: <XCircle size={13} />,      color: 'text-red-400',   bg: 'bg-red-500/10 border-red-500/20',     label: 'Failed' },
  skipped: { icon: <SkipForward size={13} />,  color: 'text-yellow-400',bg: 'bg-yellow-500/10 border-yellow-500/20',label: 'Skipped' },
};

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState('all'); // all | sent | failed | skipped
  const [tab, setTab] = useState('logs'); // logs | campaigns
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(async () => {
    setFetching(true);
    try {
      const params = { page, limit: 50 };
      if (filter !== 'all') params.status = filter;
      const res = await logsAPI.getLogs(params);
      setLogs(res.data.logs);
      setTotalPages(res.data.pages);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load message history');
    } finally {
      setFetching(false);
    }
  }, [filter, page]);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await logsAPI.getCampaigns();
      setCampaigns(res.data.campaigns);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load campaigns');
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchLogs();
      fetchCampaigns();
    }
  }, [user, fetchLogs, fetchCampaigns]);

  // Export logs as CSV
  const exportCSV = () => {
    const headers = 'Number,Message,Status,Reason,Date\n';
    const rows = logs.map(l =>
      `${l.number},"${l.message?.replace(/"/g, '""')}",${l.status},${l.failReason || ''},${new Date(l.createdAt).toLocaleString()}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wa-sender-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getCampaignStatusClass = (status) => {
    if (status === 'completed') return 'bg-[#25D366]/10 border-[#25D366]/20 text-[#25D366]';
    if (status === 'running') return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
    if (status === 'failed') return 'bg-red-500/10 border-red-500/20 text-red-400';
    if (status === 'cancelled') return 'bg-gray-500/10 border-gray-500/20 text-gray-400';
    return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className=" px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">History</h1>
            <p className="text-sm text-gray-400 mt-1">Browse delivery logs and campaign performance in one place.</p>
          </div>
          <button
            onClick={exportCSV}
            disabled={logs.length === 0}
            className="flex items-center gap-2 text-xs text-white hover:text-white border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} /> Export CSV
          </button>
        </div>

        {/* TABS */}
        <div className="flex gap-2">
          {['logs', 'campaigns'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-[#25D366] text-black'
                  : 'bg-[#111] border border-white/5 text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── LOGS TAB ── */}
        {tab === 'logs' && (
          <div className="space-y-4">

            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-gray-500" />
              {['all', 'sent', 'failed', 'skipped'].map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize border transition-colors ${
                    filter === f
                      ? 'bg-[#25D366] text-black border-[#25D366]'
                      : 'bg-[#111] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
              {fetching ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="animate-spin text-[#25D366]" size={24} />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16 text-gray-600">
                  <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm table-fixed">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[38%]" />
                      <col className="w-[22%]" />
                      <col className="w-[18%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-white/5 text-left">
                        <th className="px-5 py-3 text-xs text-gray-500 font-medium">Number</th>
                        <th className="px-5 py-3 text-xs text-gray-500 font-medium">Message</th>
                        <th className="px-5 py-3 text-xs text-gray-500 font-medium">Status</th>
                        <th className="px-5 py-3 text-xs text-gray-500 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, i) => {
                        const s = statusConfig[log.status] || statusConfig.skipped;
                        return (
                          <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="px-5 py-3 text-gray-300 font-mono text-xs whitespace-nowrap">{log.number}</td>
                            <td className="px-5 py-3 text-gray-400 text-xs truncate" title={log.message || ''}>{log.message}</td>
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${s.bg} ${s.color}`}>
                                {s.icon} {s.label}
                              </span>
                              {log.failReason && (
                                <p className="text-xs text-gray-600 mt-0.5">{log.failReason}</p>
                              )}
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 text-xs bg-[#111] border border-white/10 rounded-xl disabled:opacity-30 hover:border-white/20 transition-colors"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-400">Page {page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 text-xs bg-[#111] border border-white/10 rounded-xl disabled:opacity-30 hover:border-white/20 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CAMPAIGNS TAB ── */}
        {tab === 'campaigns' && (
          <div className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="bg-[#111] border border-white/5 rounded-2xl text-center py-16 text-gray-600">
                <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No campaigns yet</p>
              </div>
            ) : (
              campaigns.map((c, i) => (
                <div key={i} className="bg-[#111] border border-white/5 rounded-2xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{formatDate(c.createdAt)}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${getCampaignStatusClass(c.status)}`}>
                      {c.status}
                    </span>
                  </div>

                  <p className="text-gray-400 text-xs mb-4 line-clamp-2">{c.message}</p>

                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      { label: 'Total',   val: c.totalNumbers, color: 'text-white' },
                      { label: 'Sent',    val: c.sent,         color: 'text-[#25D366]' },
                      { label: 'Failed',  val: c.failed,       color: 'text-red-400' },
                      { label: 'Skipped', val: c.skipped,      color: 'text-yellow-400' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-[#0a0a0a] rounded-xl py-2">
                        <p className={`font-bold text-base ${stat.color}`}>{stat.val}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                      <span>Sent Progress</span>
                      <span>
                        {Math.round(((c.sent || 0) / Math.max(1, c.totalNumbers || 0)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#0a0a0a] rounded-full overflow-hidden border border-white/5">
                      <div
                        className="h-full bg-[#25D366]"
                        style={{ width: `${Math.min(100, Math.round(((c.sent || 0) / Math.max(1, c.totalNumbers || 0)) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
