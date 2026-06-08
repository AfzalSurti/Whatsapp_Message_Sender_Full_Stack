'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { getTagStyle } from '@/lib/segmentTags';

export default function SegmentTagPicker({
  tagLibrary = [],
  selectedTags = [],
  onSelectedChange,
  onCreateTag,
  creatingTag = false,
  label = 'Segment tags'
}) {
  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineName, setInlineName] = useState('');

  const addTag = (tagName) => {
    if (selectedTags.includes(tagName)) return;
    onSelectedChange([...selectedTags, tagName]);
  };

  const removeTag = (tagName) => {
    onSelectedChange(selectedTags.filter((tag) => tag !== tagName));
  };

  const handleCreateInline = async () => {
    const trimmed = inlineName.trim();
    if (!trimmed || creatingTag) return;

    const created = await onCreateTag(trimmed);
    if (created) {
      setInlineName('');
      setShowInlineInput(false);
    }
  };

  const handleInlineKeyDown = async (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      await handleCreateInline();
    }
    if (event.key === 'Escape') {
      setShowInlineInput(false);
      setInlineName('');
    }
  };

  const availableTags = tagLibrary.filter((tag) => !selectedTags.includes(tag.name));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500">{label}</p>
        <button
          type="button"
          onClick={() => setShowInlineInput((prev) => !prev)}
          className="text-xs text-[#25D366] inline-flex items-center gap-1"
        >
          <Plus size={14} /> New tag
        </button>
      </div>

      {showInlineInput && (
        <div className="mb-3">
          <input
            autoFocus
            value={inlineName}
            onChange={(e) => setInlineName(e.target.value)}
            onKeyDown={handleInlineKeyDown}
            placeholder="Enter tag name and press Enter"
            disabled={creatingTag}
            className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#25D366]/40 rounded-xl text-sm placeholder-gray-600 disabled:opacity-60"
          />
        </div>
      )}

      {selectedTags.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Selected</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tagName) => {
              const style = getTagStyle(tagName, tagLibrary);
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border"
                  style={style}
                >
                  {tagName}
                  <button
                    type="button"
                    onClick={() => removeTag(tagName)}
                    className="hover:text-red-400 transition-colors"
                    aria-label={`Remove ${tagName}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {availableTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag._id}
              type="button"
              onClick={() => addTag(tag.name)}
              className="text-xs px-3 py-1.5 rounded-full border border-white/12 text-gray-400 opacity-80 hover:opacity-100 hover:border-white/25 hover:text-gray-200 transition-colors"
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : (
        !showInlineInput &&
        selectedTags.length === tagLibrary.length &&
        tagLibrary.length > 0 && (
          <p className="text-xs text-gray-500">All tags selected.</p>
        )
      )}

      {creatingTag && (
        <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Creating tag...
        </p>
      )}
    </div>
  );
}
