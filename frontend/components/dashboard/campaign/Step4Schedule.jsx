'use client';

import { useMemo } from 'react';
import { Calendar, Send } from 'lucide-react';
import {
  getMinScheduleDate,
  getMinScheduleTime,
  getRecurrenceOptions,
  SCHEDULE_MODES,
  SENDING_SPEEDS
} from '@/lib/scheduledCampaign';

const MODE_ICONS = {
  send: Send,
  calendar: Calendar
};

export default function Step4Schedule({
  scheduleMode,
  setScheduleMode,
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  recurrencePattern,
  setRecurrencePattern,
  recurrenceStartDate,
  setRecurrenceStartDate,
  recurrenceEndDate,
  setRecurrenceEndDate,
  sendingSpeed,
  setSendingSpeed
}) {
  const minDate = useMemo(() => getMinScheduleDate(), []);
  const minTime = useMemo(() => getMinScheduleTime(scheduleDate), [scheduleDate]);

  const recurrenceOptions = useMemo(
    () => getRecurrenceOptions(scheduleDate || recurrenceStartDate),
    [scheduleDate, recurrenceStartDate]
  );

  const showRecurrencePeriod = recurrencePattern && recurrencePattern !== 'none';

  const handleDateChange = (value) => {
    setScheduleDate(value);
    if (value === minDate && scheduleTime && scheduleTime < minTime) {
      setScheduleTime(minTime);
    }
    if (!recurrenceStartDate || recurrenceStartDate < value) {
      setRecurrenceStartDate(value);
    }
  };

  const openPicker = (event) => {
    event.currentTarget.showPicker?.();
  };

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

            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => setScheduleMode(mode.id)}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-colors ${
                  active
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
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{mode.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {scheduleMode === 'later' && (
        <div className="space-y-4 p-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-2">Date</label>
              <input
                type="date"
                value={scheduleDate}
                min={minDate}
                onChange={(e) => handleDateChange(e.target.value)}
                onClick={openPicker}
                onFocus={openPicker}
                className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-2">Time</label>
              <input
                type="time"
                value={scheduleTime}
                min={scheduleDate === minDate ? minTime : undefined}
                onChange={(e) => setScheduleTime(e.target.value)}
                onClick={openPicker}
                onFocus={openPicker}
                className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer [color-scheme:dark]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-2">Repeat</label>
            <select
              value={recurrencePattern}
              onChange={(e) => setRecurrencePattern(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer [color-scheme:dark]"
            >
              {recurrenceOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {showRecurrencePeriod && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-gray-400 block mb-2">Start date</label>
                <input
                  type="date"
                  value={recurrenceStartDate}
                  min={minDate}
                  onChange={(e) => setRecurrenceStartDate(e.target.value)}
                  onClick={openPicker}
                  onFocus={openPicker}
                  className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-2">End date</label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  min={recurrenceStartDate || minDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  onClick={openPicker}
                  onFocus={openPicker}
                  className="w-full px-4 py-2.5 bg-[#0a0f0d] border border-white/10 rounded-xl text-sm cursor-pointer [color-scheme:dark]"
                />
              </div>
              <p className="sm:col-span-2 text-[11px] text-gray-500">
                Campaign will repeat during this period using the schedule above.
              </p>
            </div>
          )}
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
