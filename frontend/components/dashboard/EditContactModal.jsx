'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { getTagStyle } from '@/lib/segmentTags';

export default function EditContactModal({
  open,
  onClose,
  phone,
  name,
  setName,
  tagLibrary,
  selectedTags,
  toggleTag,
  onCreateTag,
  saving,
  onSave
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-lg">Edit Contact</h3>
            <p className="text-xs text-gray-500 mt-1">{phone}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-2">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Segment Tags</label>
              <button
                type="button"
                onClick={onCreateTag}
                className="text-xs text-[#25D366] inline-flex items-center gap-1"
              >
                <Plus size={14} /> New tag
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagLibrary.map((tag) => {
                const active = selectedTags.includes(tag.name);
                const style = getTagStyle(tag.name, tagLibrary);
                return (
                  <button
                    key={tag._id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      active ? 'ring-1 ring-white/30' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={active ? style : { borderColor: 'rgba(255,255,255,0.12)', color: '#9ca3af' }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            Save Contact
          </button>
        </div>
      </div>
    </div>
  );
}
