import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';

export default function GroupCard({ group, onEdit, onDelete }) {
  return (
    <div className="bg-[#111] border border-white/6 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ backgroundColor: group.color || '#25D366' }} />
        <div>
          <div className="text-sm font-semibold">{group.name}</div>
          <div className="text-xs text-gray-400">{(group.numbers || []).length} contacts</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onEdit(group)} className="p-2 rounded-md hover:bg-white/5 transition-colors"><Edit2 size={16} /></button>
        <button onClick={() => onDelete(group._id)} className="p-2 rounded-md hover:bg-white/5 transition-colors text-red-400"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}
