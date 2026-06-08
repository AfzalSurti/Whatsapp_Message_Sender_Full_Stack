'use client';

import { Bot, Loader2, Sparkles } from 'lucide-react';
import {
  extractVariables,
  getTemplateDefaultVariables,
  variableLabel,
  SCHEDULE_REQUIRED_VARIABLES
} from '@/lib/template';

export default function Step3Message({
  message,
  setMessage,
  messageSource,
  selectedTemplate,
  templateVariables,
  setTemplateVariables,
  aiSectionOpen,
  setAiSectionOpen,
  aiPrompt,
  setAiPrompt,
  aiLoading,
  onGenerateAi
}) {
  const variables = extractVariables(message);
  const defaultVariableFields = getTemplateDefaultVariables(message);
  const readOnly = messageSource === 'template' && Boolean(selectedTemplate);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Craft your message</h2>
        <p className="text-sm text-gray-500 mt-1">
          {readOnly
            ? 'Message loaded from your selected template. Go back to change template.'
            : 'Write manually or generate with AI. Use {{name}} for personalization.'}
        </p>
      </div>

      {selectedTemplate && messageSource === 'template' && (
        <div className="text-sm px-4 py-3 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-200">
          Using template: {selectedTemplate.icon} {selectedTemplate.name}
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        readOnly={readOnly}
        rows={10}
        placeholder="Hi {{name}}, wishing you and your family a wonderful occasion!"
        className={`w-full px-4 py-4 bg-[#0a0f0d] border border-white/10 rounded-2xl text-sm font-mono text-[#f5e6a8] placeholder-gray-600 focus:outline-none focus:border-[#25D366] resize-none ${
          readOnly ? 'opacity-90 cursor-default' : ''
        }`}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAiSectionOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#25D366]/30 text-[#25D366] text-sm hover:bg-[#25D366]/10"
        >
          <Sparkles size={14} /> Generate with AI
        </button>
      </div>

      {aiSectionOpen && (
        <div className="bg-[#0a0f0d] border border-white/10 rounded-2xl p-4 space-y-3">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            placeholder='Describe your message, e.g. "Friendly Eid greeting with offer code"'
            className="w-full px-4 py-3 bg-[#111814] border border-white/10 rounded-xl text-sm resize-none"
          />
          <button
            type="button"
            disabled={aiLoading}
            onClick={onGenerateAi}
            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2 rounded-xl text-sm"
          >
            {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} />}
            {aiLoading ? 'Generating...' : 'Generate Message'}
          </button>
        </div>
      )}

      {defaultVariableFields.length > 0 && (
        <div className="bg-[#0a0f0d] border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-medium text-amber-300">Variable values for this campaign</p>
          {defaultVariableFields.map((variable) => (
            <div key={variable}>
              <label className="text-xs text-gray-400 block mb-1.5">
                {variableLabel(variable)} ({`{{${variable}}}`})
                {SCHEDULE_REQUIRED_VARIABLES.includes(variable) && (
                  <span className="text-red-400"> *</span>
                )}
              </label>
              <input
                type="text"
                value={templateVariables[variable] || ''}
                onChange={(e) =>
                  setTemplateVariables((prev) => ({ ...prev, [variable]: e.target.value }))
                }
                className="w-full px-4 py-2.5 bg-[#111814] border border-white/10 rounded-xl text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {variables.length > 0 && (
        <p className="text-xs text-gray-500">
          Variables detected: {variables.map((v) => `{{${v}}}`).join(', ')}
        </p>
      )}
    </div>
  );
}
