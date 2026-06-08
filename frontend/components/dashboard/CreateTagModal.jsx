'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { TAG_CATEGORIES } from '@/lib/segmentTags';

export default function CreateTagModal({
  open,
  onClose,
  name,
  setName,
  category,
  setCategory,
  color,
  setColor,
  saving,
  onSubmit
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Create Tag</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tag name e.g. VIP"
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm"
          >
            {TAG_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 rounded cursor-pointer bg-transparent"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="w-full bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 text-black font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Create Tag
          </button>
        </div>
      </div>
    </div>
  );
}
