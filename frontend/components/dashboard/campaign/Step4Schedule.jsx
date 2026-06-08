'use client';

import { Calendar, RefreshCw, Send } from 'lucide-react';
import { SCHEDULE_MODES, SENDING_SPEEDS } from '@/lib/scheduledCampaign';

const MODE_ICONS = {
  send: Send,
  calendar: Calendar,
  repeat: RefreshCw
};

export default function Step4Schedule({
  scheduleMode,
  setScheduleMode,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  sendingSpeed,
  setSendingSpeed
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Schedule & Sending Options</h2>
        <p className="text-sm text-gray-500 mt-1">Choose when to send and how fast messages go out.</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">When to send</p>
        <div className="space-y-3">
          {SCHEDULE_MODES.map((mode) => {
            const Icon = MODE_ICONS[mode.icon];
            const active = scheduleMode === mode.id;
            const disabled = mode.id === 'recurring';

            return (
              <button
                key={mode.id}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setScheduleMode(mode.id)}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-colors ${
                  disabled
                    ? 'border-white/5 bg-[#0a0f0d]/50 opacity-50 cursor-not-allowed'
                    : active
                      ? 'border-[#25D366]/50 bg-[#25D366]/10'
                      : 'border-white/10 bg-[#0a0f0d] hover:border-white/20'
                }`}
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    active ? 'border-[#25D366]' : 'border-white/20'
                  }`}
                >
                  {active && <div className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={active ? 'text-[#25D366]' : 'text-gray-400'} />
                    <span className="font-medium text-white">{mode.label}</span>
                    {disabled && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">Soon</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{mode.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {scheduleMode === 'later' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5">
          <div>
            <label className="text-xs text-gray-400 block mb-2">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-2">Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm"
            />
          </div>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Sending speed</p>
        <select
          value={sendingSpeed}
          onChange={(e) => setSendingSpeed(e.target.value)}
          className="w-full px-4 py-3 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm"
        >
          {SENDING_SPEEDS.map((speed) => (
            <option key={speed.id} value={speed.id}>
              {speed.label}
            </option>
          ))}
        </select>
        <div className="mt-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-200/90">
          {SENDING_SPEEDS.find((s) => s.id === sendingSpeed)?.description}
        </div>
      </div>
    </div>
  );
}
