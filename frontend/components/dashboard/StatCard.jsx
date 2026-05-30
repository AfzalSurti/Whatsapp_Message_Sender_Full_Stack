import React from 'react';

export default function StatCard({ icon, title, value }) {
  return (
    <div className="bg-[#111] border rounded-xl border-[#1f1f1f] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#0b0b0b] flex items-center justify-center text-[#25D366]">{icon}</div>
        <div>
          <div className="text-xs text-gray-400">{title}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </div>
    </div>
  );
}
