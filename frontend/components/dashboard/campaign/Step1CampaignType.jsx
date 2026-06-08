'use client';

import TemplateCard from '@/components/dashboard/TemplateCard';
import { CAMPAIGN_TYPES, TEMPLATE_CATEGORIES } from '@/lib/scheduledCampaign';
import { Loader2 } from 'lucide-react';

export default function Step1CampaignType({
  campaignType,
  setCampaignType,
  messageSource,
  setMessageSource,
  templates,
  loadingTemplates,
  selectedTemplateId,
  onSelectTemplate,
  manualDetails,
  setManualDetails
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">What type of campaign?</h2>
        <p className="text-sm text-gray-500 mt-1">Choose a category that best fits your outreach goal.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAMPAIGN_TYPES.map((type) => {
          const active = campaignType === type.id;
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setCampaignType(type.id);
                setManualDetails((prev) => ({ ...prev, category: type.category }));
              }}
              className={`text-left p-4 rounded-2xl border transition-all ${
                active
                  ? 'border-[#25D366]/50 bg-[#25D366]/10 ring-1 ring-[#25D366]/30'
                  : 'border-white/10 bg-[#0a0f0d] hover:border-white/20'
              }`}
            >
              <span className="text-2xl">{type.icon}</span>
              <p className="font-semibold text-white mt-3">{type.label}</p>
              <p className="text-xs text-gray-500 mt-1">{type.subtitle}</p>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Message source</h3>
        <div className="inline-flex p-1 rounded-xl bg-[#0a0f0d] border border-white/10 gap-1">
          <button
            type="button"
            onClick={() => setMessageSource('template')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              messageSource === 'template' ? 'bg-[#25D366] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Use Template
          </button>
          <button
            type="button"
            onClick={() => setMessageSource('manual')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              messageSource === 'manual' ? 'bg-[#25D366] text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            Write Manually
          </button>
        </div>
      </div>

      {messageSource === 'template' ? (
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">Select a template</h3>
          {loadingTemplates ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-[#25D366]" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet. Switch to Write Manually or create templates first.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {templates.map((template) => (
                <TemplateCard
                  key={template._id}
                  template={template}
                  selectable
                  selected={selectedTemplateId === template._id}
                  onUse={() => onSelectTemplate(template)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 bg-[#0a0f0d] border border-white/10 rounded-2xl p-5">
          <div>
            <h3 className="text-sm font-medium text-gray-300">Campaign details</h3>
            <p className="text-xs text-gray-500 mt-1">
              Same details as template creation — you will write the message in the next steps.
            </p>
          </div>

          <div className="grid grid-cols-[80px_1fr] gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Icon</label>
              <input
                type="text"
                value={manualDetails.icon}
                onChange={(e) => setManualDetails((prev) => ({ ...prev, icon: e.target.value }))}
                maxLength={4}
                className="w-full px-3 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-center text-xl"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">Campaign / Template Name</label>
              <input
                type="text"
                value={manualDetails.name}
                onChange={(e) => setManualDetails((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Eid Mubarak Offer"
                className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Description</label>
            <input
              type="text"
              value={manualDetails.description}
              onChange={(e) => setManualDetails((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Short summary for this campaign"
              className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Category</label>
              <select
                value={manualDetails.category}
                onChange={(e) => setManualDetails((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
              >
                {TEMPLATE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">Tags</label>
              <input
                type="text"
                value={manualDetails.tagsInput}
                onChange={(e) => setManualDetails((prev) => ({ ...prev, tagsInput: e.target.value }))}
                placeholder="Promo, VIP"
                className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-2">Languages</label>
            <input
              type="text"
              value={manualDetails.languagesInput}
              onChange={(e) => setManualDetails((prev) => ({ ...prev, languagesInput: e.target.value }))}
              placeholder="English, Hindi"
              className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
