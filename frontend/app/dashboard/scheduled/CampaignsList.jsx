'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { scheduledAPI } from '@/lib/api';
import ConfirmModal from '@/components/dashboard/ConfirmModal';
import CampaignViewModal from '@/components/dashboard/CampaignViewModal';
import { formatCampaignDate, getCampaignStatusBadge } from '@/lib/scheduledCampaign';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';

export default function CampaignsList() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState('upcoming');
  const [campaigns, setCampaigns] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [campaignToDelete, setCampaignToDelete] = useState(null);
  const [campaignToCancel, setCampaignToCancel] = useState(null);
  const [viewCampaignId, setViewCampaignId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setFetching(true);
      const res = await scheduledAPI.getCampaigns();
      setCampaigns(res.data.campaigns || []);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) fetchCampaigns();
  }, [user, fetchCampaigns]);

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;

    setActionLoading(true);
    try {
      await scheduledAPI.deleteCampaign(campaignToDelete._id);
      toast.success('Campaign deleted');
      setCampaignToDelete(null);
      await fetchCampaigns();
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCampaign = async () => {
    if (!campaignToCancel) return;

    setActionLoading(true);
    try {
      await scheduledAPI.cancelCampaign(campaignToCancel._id);
      toast.success('Campaign cancelled');
      setCampaignToCancel(null);
      await fetchCampaigns();
    } catch {
      toast.error('Failed to cancel campaign');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (tab === 'upcoming') return campaign.status === 'pending';
    if (tab === 'completed') return campaign.status === 'completed';
    return true;
  });

  const tabEmptyText = {
    upcoming: 'No upcoming campaigns yet.',
    completed: 'No completed campaigns yet.',
    all: 'No campaigns found.'
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="inline-flex p-1 rounded-xl bg-[#111] border border-white/10 gap-1">
          {['upcoming', 'completed', 'all'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors capitalize ${
                tab === item
                  ? 'bg-[#25D366] text-black'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <Link
          href="/dashboard/scheduled/create"
          className="bg-[#25D366] hover:bg-[#1ebe5d] text-black text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Create Campaign
        </Link>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-[#25D366]" size={28} />
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-10 text-center">
          <Clock size={34} className="mx-auto text-gray-500" />
          <p className="text-gray-300 mt-4">{tabEmptyText[tab]}</p>
          <Link
            href="/dashboard/scheduled/create"
            className="inline-flex mt-5 text-sm text-[#25D366] hover:underline"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCampaigns.map((campaign) => {
            const badge = getCampaignStatusBadge(campaign.status);
            const recipientCount =
              campaign.totalNumbers ||
              campaign.totalRecipients ||
              campaign.recipientCount ||
              campaign.individualNumbers?.length ||
              (campaign.sent || 0) + (campaign.failed || 0);

            return (
              <div
                key={campaign._id}
                className="bg-[#111] border border-white/5 rounded-2xl p-5 flex items-start justify-between hover:border-white/20 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{campaign.name}</h3>
                    <div
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}
                    >
                      {badge.label}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-2">
                    <Clock size={12} /> {formatCampaignDate(campaign.scheduledAt)}
                  </p>

                  <p className="text-sm text-gray-300 line-clamp-2 mb-3">{campaign.message}</p>

                  {campaign.templateId && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 mb-3">
                      <FileText size={11} />
                      {typeof campaign.templateId === 'object' ? campaign.templateId.name : 'Template'}
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10">
                      {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {campaign.status === 'completed' && (
                    <div className="flex gap-4 text-xs text-gray-400 mt-2">
                      <span className="flex items-center gap-1">
                        <CheckCircle size={12} className="text-[#25D366]" /> {campaign.sent} sent
                      </span>
                      {campaign.failed > 0 && (
                        <span className="flex items-center gap-1">
                          <AlertCircle size={12} className="text-red-400" /> {campaign.failed} failed
                        </span>
                      )}
                    </div>
                  )}

                  {campaign.status === 'failed' && campaign.failReason && (
                    <p className="text-xs text-red-400 mt-2">Error: {campaign.failReason}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewCampaignId(campaign._id)}
                    className="px-3 py-1.5 text-xs border border-white/10 hover:border-[#25D366]/40 rounded transition-colors flex items-center gap-1.5"
                  >
                    <Eye size={12} /> View
                  </button>
                  {campaign.status === 'pending' && (
                    <>
                      <Link
                        href={`/dashboard/scheduled/create?edit=${campaign._id}`}
                        className="px-3 py-1.5 text-xs border border-white/10 hover:border-[#25D366]/40 rounded transition-colors flex items-center gap-1.5"
                      >
                        <Pencil size={12} /> Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setCampaignToCancel(campaign)}
                        className="px-3 py-1.5 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {['completed', 'cancelled', 'failed'].includes(campaign.status) && (
                    <button
                      type="button"
                      onClick={() => setCampaignToDelete(campaign)}
                      className="p-2 hover:bg-red-500/20 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CampaignViewModal
        open={Boolean(viewCampaignId)}
        campaignId={viewCampaignId}
        onClose={() => setViewCampaignId(null)}
      />

      <ConfirmModal
        open={Boolean(campaignToDelete)}
        onClose={() => setCampaignToDelete(null)}
        title="Are you sure you want to delete this campaign?"
        message={`"${campaignToDelete?.name || 'This campaign'}" will be permanently removed.`}
        confirmLabel="Yes, Delete"
        onConfirm={handleDeleteCampaign}
        confirming={actionLoading}
      />

      <ConfirmModal
        open={Boolean(campaignToCancel)}
        onClose={() => setCampaignToCancel(null)}
        title="Are you sure you want to cancel this campaign?"
        message={`"${campaignToCancel?.name || 'This campaign'}" will be cancelled and will not be sent.`}
        confirmLabel="Yes, Cancel"
        onConfirm={handleCancelCampaign}
        confirming={actionLoading}
      />
    </>
  );
}
