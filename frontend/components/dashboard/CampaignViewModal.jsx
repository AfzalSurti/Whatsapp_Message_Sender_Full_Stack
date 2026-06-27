'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { X, Loader2, Clock, Users, FileText } from 'lucide-react';
import { scheduledAPI } from '@/lib/api';
import { formatCampaignDate, getCampaignStatusBadge, getRecurrenceLabel } from '@/lib/scheduledCampaign';
import { formatPhoneNumber } from '@/lib/phone';

export default function CampaignViewModal({ campaignId, open, onClose }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !campaignId) {
      setCampaign(null);
      return;
    }

    const loadCampaign = async () => {
      setLoading(true);
      try {
        const res = await scheduledAPI.getCampaign(campaignId);
        setCampaign(res.data.campaign);
      } catch {
        toast.error('Failed to load campaign details');
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [campaignId, onClose, open]);

  if (!open) return null;

  const badge = campaign ? getCampaignStatusBadge(campaign.status) : null;
  const recipients = campaign?.individualNumbers || [];
  const recipientCount =
    campaign?.totalNumbers ||
    campaign?.totalRecipients ||
    recipients.length ||
    0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h3 className="font-bold text-lg">Campaign Details</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-[#25D366]" />
            </div>
          ) : campaign ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-xl font-semibold">{campaign.name}</h4>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${badge.bg} ${badge.border} ${badge.text}`}
                >
                  {badge.label}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                  <div className="text-gray-500 text-xs mb-1 flex items-center gap-1.5">
                    <Clock size={12} /> Scheduled
                  </div>
                  <div>{formatCampaignDate(campaign.scheduledAt)}</div>
                </div>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
                  <div className="text-gray-500 text-xs mb-1 flex items-center gap-1.5">
                    <Users size={12} /> Recipients
                  </div>
                  <div>{recipientCount} contact{recipientCount !== 1 ? 's' : ''}</div>
                </div>
              </div>

              {campaign.templateId && (
                <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                  <FileText size={12} />
                  {typeof campaign.templateId === 'object' ? campaign.templateId.name : 'Template'}
                </div>
              )}

              <div>
                <div className="text-xs text-gray-500 mb-2">Message</div>
                <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 text-sm text-gray-200 whitespace-pre-wrap">
                  {campaign.message}
                </div>
              </div>

              {campaign.templateVariables && Object.keys(campaign.templateVariables).length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Template variables</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(campaign.templateVariables).map(([key, value]) => (
                      <span
                        key={key}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {campaign.recurrencePattern && campaign.recurrencePattern !== 'none' && (
                <div className="text-sm text-gray-400">
                  Repeats: {getRecurrenceLabel(campaign.recurrencePattern, campaign.scheduledAt)}
                </div>
              )}

              {campaign.sendingSpeed && (
                <div className="text-sm text-gray-400 capitalize">
                  Sending speed: {campaign.sendingSpeed}
                </div>
              )}

              {campaign.status === 'completed' && (
                <div className="text-sm text-gray-400">
                  Sent: {campaign.sent || 0} · Failed: {campaign.failed || 0}
                </div>
              )}

              {campaign.status === 'failed' && campaign.failReason && (
                <div className="text-sm text-red-400">Error: {campaign.failReason}</div>
              )}

              {recipients.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-2">Recipient list</div>
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-[#0a0a0a] border border-white/10 rounded-xl p-3">
                    {recipients.map((recipient) => (
                      <div key={recipient.phone} className="text-sm flex justify-between gap-3 py-1">
                        <span className="truncate">{recipient.name || 'Unknown'}</span>
                        <span className="text-gray-500 shrink-0">
                          {formatPhoneNumber(recipient.phone) || recipient.phone}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
