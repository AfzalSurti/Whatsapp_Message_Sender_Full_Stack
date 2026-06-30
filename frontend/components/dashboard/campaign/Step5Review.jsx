'use client';

import { Send, Shield } from 'lucide-react';
import {
  formatCampaignDate,
  getRecurrenceLabel,
  REMINDER_MINUTES_OPTIONS,
  SENDING_SPEEDS
} from '@/lib/scheduledCampaign';
import { formatPhoneNumber } from '@/lib/phone';

export default function Step5Review({
  campaignName,
  messageSource,
  recipientCount,
  scheduleMode,
  scheduleDate,
  scheduleTime,
  recurrencePattern,
  recurrenceStartDate,
  recurrenceEndDate,
  sendingSpeed,
  message,
  reminderEnabled,
  reminderMinutesBefore,
  reminderPhone,
  defaultAlertPhone
}) {
  const scheduleLabel =
    scheduleMode === 'now'
      ? 'Send immediately'
      : scheduleMode === 'later' && scheduleDate && scheduleTime
        ? formatCampaignDate(new Date(`${scheduleDate}T${scheduleTime}`).toISOString())
        : 'Schedule for later';

  const recurrenceLabel = getRecurrenceLabel(recurrencePattern, scheduleDate || recurrenceStartDate);

  const speedLabel = SENDING_SPEEDS.find((s) => s.id === sendingSpeed)?.label || 'Safe';

  const rows = [
    { label: 'Campaign Name', value: campaignName || 'Untitled Campaign' },
    { label: 'Message Source', value: messageSource === 'template' ? 'Template' : 'Manual' },
    { label: 'Recipients', value: `${recipientCount.toLocaleString()} contact${recipientCount !== 1 ? 's' : ''} selected` },
    { label: 'Schedule', value: scheduleLabel },
    ...(recurrenceLabel
      ? [
          { label: 'Repeat', value: recurrenceLabel },
          ...(recurrenceStartDate && recurrenceEndDate
            ? [
                {
                  label: 'Repeat period',
                  value: `${new Date(`${recurrenceStartDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${new Date(`${recurrenceEndDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                }
              ]
            : [])
        ]
      : []),
    { label: 'Sending Speed', value: speedLabel },
    ...(scheduleMode === 'later' && reminderEnabled
      ? [{
          label: 'Reminder',
          value: `${REMINDER_MINUTES_OPTIONS.find((item) => item.value === reminderMinutesBefore)?.label || `${reminderMinutesBefore} min before`} → ${formatPhoneNumber(reminderPhone || defaultAlertPhone) || 'default alert number'}`
        }]
      : [])
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Review & Launch</h2>
        <p className="text-sm text-gray-500 mt-1">Confirm everything before launching your campaign.</p>
      </div>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-5 py-4 text-sm ${
              index > 0 ? 'border-t border-white/5' : ''
            }`}
          >
            <span className="text-gray-500">{row.label}</span>
            <span className="text-white font-medium text-right max-w-[60%] truncate">{row.value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 p-4">
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Message Preview</p>
        <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-6 font-mono">{message || '—'}</p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10">
        <Shield size={18} className="text-[#25D366] shrink-0 mt-0.5" />
        <p className="text-sm text-[#25D366]/90">
          All messages will be queued with smart delays. Delivery progress will be tracked in real-time.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Send size={14} />
        <span>Ready to launch when you click Launch Campaign below.</span>
      </div>
    </div>
  );
}
