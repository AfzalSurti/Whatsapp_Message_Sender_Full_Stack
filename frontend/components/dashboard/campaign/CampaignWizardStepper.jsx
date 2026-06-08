'use client';

import { Check } from 'lucide-react';
import { WIZARD_STEPS } from '@/lib/scheduledCampaign';

export default function CampaignWizardStepper({ step }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((item, index) => {
        const done = step > item.id;
        const active = step === item.id;

        return (
          <div key={item.id} className="flex items-center shrink-0">
            <div className="flex flex-col items-center min-w-[88px]">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  done
                    ? 'bg-[#25D366] border-[#25D366] text-black'
                    : active
                      ? 'bg-[#25D366]/15 border-[#25D366] text-[#25D366]'
                      : 'bg-transparent border-white/15 text-gray-500'
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} /> : item.id}
              </div>
              <p
                className={`text-[11px] mt-2 text-center max-w-[88px] ${
                  active ? 'text-[#25D366] font-medium' : done ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                {item.label}
              </p>
            </div>
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={`h-0.5 w-10 sm:w-16 mb-5 mx-1 ${
                  step > item.id ? 'bg-[#25D366]' : 'bg-white/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
