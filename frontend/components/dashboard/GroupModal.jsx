import React from 'react';
import { X } from 'lucide-react';

const DEFAULT_COLORS = ['#25D366', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function GroupModal({ open, onClose, name, setName, color, setColor, creating, onSubmit, editMode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/5 rounded-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">{editMode ? 'Edit Group' : 'Create Group'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-white/10 transition-colors" aria-label="Close"><X size={16} /></button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
          />

          <div>
            <p className="text-xs text-gray-400 mb-2">Color</p>
            <div className="grid grid-cols-6 gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-9 rounded-lg border-2 ${color === c ? 'border-white' : 'border-transparent'} cursor-pointer`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onSubmit}
              disabled={creating}
              className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
            >
              {creating ? (editMode ? 'Saving...' : 'Creating...') : (editMode ? 'Save' : 'Create')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
