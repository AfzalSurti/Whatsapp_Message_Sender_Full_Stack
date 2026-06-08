'use client';

import {
  extractVariables,
  SCHEDULE_REQUIRED_VARIABLES,
  variableLabel
} from '@/lib/template';

const badgeStyles = {
  purple: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  orange: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
  red: 'bg-red-500/10 text-red-300 border-red-500/20',
  gray: 'bg-white/5 text-gray-300 border-white/10'
};

const pickBadgeStyle = (tag = '') => {
  const value = tag.toLowerCase();
  if (value.includes('{{') || value.includes('name') || value.includes('due')) return badgeStyles.purple;
  if (value.includes('language') || value.includes('auto') || value.includes('emoji')) return badgeStyles.green;
  if (value.includes('birthday') || value.includes('reminder')) return badgeStyles.blue;
  if (value.includes('promo') || value.includes('diwali') || value.includes('urgent')) return badgeStyles.orange;
  if (value.includes('eid')) return badgeStyles.purple;
  return badgeStyles.gray;
};

export default function TemplateCard({
  template,
  onUse,
  onEdit,
  onDelete,
  selectable = false,
  selected = false
}) {
  const variables = template.variables || extractVariables(template.body);
  const isSystem = template.isSystem;

  return (
    <div
      className={`bg-[#111814] border rounded-2xl p-5 transition-all h-full flex flex-col ${
        selectable
          ? selected
            ? 'border-[#25D366] shadow-[0_0_0_1px_rgba(37,211,102,0.35)]'
            : 'border-white/8 hover:border-white/20 cursor-pointer'
          : 'border-white/8 hover:border-white/15'
      }`}
      onClick={selectable ? onUse : undefined}
      role={selectable ? 'button' : undefined}
    >
      <div className="text-[28px] leading-none mb-3">{template.icon || '📋'}</div>
      <h3 className="text-base font-semibold text-white mb-2">{template.name}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-4 flex-1">
        {template.description || 'Custom message template'}
      </p>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {(template.tags || []).slice(0, 4).map((tag) => (
          <span
            key={tag}
            className={`text-[10px] font-medium px-2 py-1 rounded-full border ${pickBadgeStyle(tag)}`}
          >
            {tag}
          </span>
        ))}
        {variables.slice(0, 2).map((variable) => (
          <span
            key={variable}
            className="text-[10px] font-medium px-2 py-1 rounded-full border bg-violet-500/10 text-violet-300 border-violet-500/20"
          >
            {`{{${variable}}}`}
          </span>
        ))}
      </div>

      {!selectable && (
        <div className="flex items-center gap-2 mt-auto">
          <button
            type="button"
            onClick={onUse}
            className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-black transition-colors cursor-pointer"
          >
            Use Template
          </button>
          {!isSystem && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="text-xs px-3 py-2 rounded-xl border border-white/10 hover:border-white/20 text-gray-300 transition-colors cursor-pointer"
            >
              Edit
            </button>
          )}
          {!isSystem && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-xs px-3 py-2 rounded-xl border border-red-500/20 hover:bg-red-500/10 text-red-400 transition-colors cursor-pointer"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {selectable && selected && (
        <div className="text-xs text-[#25D366] font-medium mt-auto">Selected</div>
      )}

      {variables.some((variable) => SCHEDULE_REQUIRED_VARIABLES.includes(variable)) && (
        <p className="text-[11px] text-amber-400/90 mt-3">
          Requires: {variables.filter((v) => SCHEDULE_REQUIRED_VARIABLES.includes(v)).map((v) => variableLabel(v)).join(', ')}
        </p>
      )}
    </div>
  );
}
