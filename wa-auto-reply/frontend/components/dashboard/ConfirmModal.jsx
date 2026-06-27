'use client';

import { Loader2, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  confirming = false
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/5 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="text-gray-500 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="flex-1 bg-red-500 hover:bg-red-400 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {confirming ? <Loader2 size={16} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onClose}
            className="flex-1 border border-white/10 hover:border-white/20 disabled:opacity-60 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
