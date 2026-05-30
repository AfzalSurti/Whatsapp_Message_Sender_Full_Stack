import React from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import InternationalPhoneInput from '@/components/InternationalPhoneInput';

export default function AddContactModal({
  open,
  onClose,
  contactName,
  setContactName,
  contactCountry,
  setContactCountry,
  contactPhone,
  setContactPhone,
  selectedGroupIds,
  toggleGroupSelection,
  sortedGroups,
  inlineGroupName,
  setInlineGroupName,
  inlineGroupColor,
  setInlineGroupColor,
  addingContact,
  handleAddContact,
  resetAddContactForm,
  GROUP_COLORS
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/5 rounded-2xl p-7 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-5">
          <h3 className="font-bold text-lg">Add Contact</h3>
          <button
            onClick={resetAddContactForm}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Contact name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
          />

          <InternationalPhoneInput
            value={contactPhone}
            defaultCountry={contactCountry}
            onChange={(phone, meta) => {
              setContactPhone(phone);
              setContactCountry(meta?.country?.iso2?.toUpperCase() || contactCountry);
            }}
            onCountryChange={setContactCountry}
            placeholder="Phone number"
          />

          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">Select existing group(s)</p>
            {sortedGroups.length === 0 ? (
              <p className="text-xs text-gray-500">No groups available yet. Create one below.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto border border-white/10 rounded-xl p-2 space-y-1">
                {sortedGroups.map((group) => (
                  <label
                    key={group._id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group._id)}
                      onChange={() => toggleGroupSelection(group._id)}
                      className="accent-[#25D366]"
                    />
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: group.color || '#25D366' }}
                    />
                    <span className="text-sm text-gray-200">{group.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border border-dashed border-white/15 rounded-xl p-3 space-y-3">
            <p className="text-sm font-medium text-gray-300">Or create a new group for this contact</p>
            <input
              type="text"
              placeholder="New group name"
              value={inlineGroupName}
              onChange={(e) => setInlineGroupName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#25D366]"
            />

            <div className="flex gap-2">
              {GROUP_COLORS.map((color) => (
                <button
                  key={`inline-${color}`}
                  onClick={() => setInlineGroupColor(color)}
                  className={`w-7 h-7 rounded-full border-2 ${inlineGroupColor === color ? 'border-white' : 'border-transparent'} cursor-pointer`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleAddContact}
              disabled={addingContact}
              className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl transition-colors text-sm cursor-pointer flex items-center justify-center gap-2"
            >
              {addingContact ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {addingContact ? 'Saving...' : 'Save Contact'}
            </button>
            <button
              onClick={resetAddContactForm}
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
