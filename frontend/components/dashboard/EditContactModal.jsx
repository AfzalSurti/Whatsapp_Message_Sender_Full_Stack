'use client';

import { Loader2, X } from 'lucide-react';
import SegmentTagPicker from '@/components/dashboard/SegmentTagPicker';

export default function EditContactModal({
  open,
  onClose,
  phone,
  name,
  setName,
  tagLibrary,
  selectedTags,
  onSelectedTagsChange,
  onCreateTag,
  creatingTag,
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

          <SegmentTagPicker
            tagLibrary={tagLibrary}
            selectedTags={selectedTags}
            onSelectedChange={onSelectedTagsChange}
            onCreateTag={onCreateTag}
            creatingTag={creatingTag}
            label="Segment Tags"
          />

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
