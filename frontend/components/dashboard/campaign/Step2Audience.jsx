'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/phone';
import { getTagStyle } from '@/lib/segmentTags';

export default function Step2Audience({
  tagLibrary,
  allContacts,
  loadingContacts,
  expandedTag,
  setExpandedTag,
  selectedContactPhones,
  toggleContactSelection,
  selectAllInTag,
  deselectAllInTag
}) {
  const tagsWithContacts = tagLibrary
    .map((tag) => ({
      ...tag,
      contacts: allContacts.filter((contact) => contact.tags?.includes(tag.name))
    }))
    .filter((tag) => tag.contacts.length > 0);

  const getTagSelectedCount = (tagName, contacts) => {
    if (tagName === '__all__') {
      return allContacts.filter((c) => selectedContactPhones.includes(c.phone.replace(/\D/g, ''))).length;
    }
    return contacts.filter((c) => selectedContactPhones.includes(c.phone.replace(/\D/g, ''))).length;
  };

  const isTagFullySelected = (contacts) =>
    contacts.length > 0 &&
    contacts.every((c) => selectedContactPhones.includes(c.phone.replace(/\D/g, '')));

  const renderContactList = (contacts) => (
    <div className="border-t border-white/5 divide-y divide-white/5">
      {contacts.map((contact) => {
        const clean = contact.phone.replace(/\D/g, '');
        const checked = selectedContactPhones.includes(clean);

        return (
          <label
            key={contact.phone}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
              checked ? 'bg-[#25D366]/5' : 'hover:bg-white/[0.02]'
            }`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggleContactSelection(contact.phone)}
              className="cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{contact.name || 'Unknown'}</p>
              <p className="text-xs text-gray-500 truncate">
                {formatPhoneNumber(contact.phone) || contact.phone}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );

  const renderTagSection = (tagKey, label, contacts, tagMeta = null) => {
    const expanded = expandedTag === tagKey;
    const selectedCount = getTagSelectedCount(tagKey, contacts);
    const style = tagMeta ? getTagStyle(tagMeta.name, tagLibrary) : null;

    return (
      <div
        key={tagKey}
        className="rounded-xl border border-white/10 bg-[#0a0f0d] overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setExpandedTag(expanded ? null : tagKey)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors"
        >
          {expanded ? (
            <ChevronDown size={16} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gray-400 shrink-0" />
          )}

          {tagMeta ? (
            <span
              className="text-xs px-3 py-1 rounded-full border shrink-0"
              style={style}
            >
              {label}
            </span>
          ) : (
            <span className="text-sm font-medium text-white">{label}</span>
          )}

          <span className="flex-1" />

          {selectedCount > 0 && (
            <span className="text-xs text-[#25D366] font-medium">{selectedCount} selected</span>
          )}
          <span className="text-xs text-gray-500">{contacts.length}</span>
        </button>

        {expanded && (
          <div>
            <div className="px-4 py-2 border-t border-white/5 flex justify-end gap-3">
              {isTagFullySelected(contacts) ? (
                <button
                  type="button"
                  onClick={() => deselectAllInTag(contacts)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Deselect all
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => selectAllInTag(contacts)}
                  className="text-xs text-[#25D366] hover:underline"
                >
                  Select all
                </button>
              )}
            </div>
            {renderContactList(contacts)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Select target audience</h2>
        <p className="text-sm text-gray-500 mt-1">
          Click a tag to view contacts, then select who should receive this campaign.
        </p>
      </div>

      {loadingContacts ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#25D366]" />
        </div>
      ) : allContacts.length === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">
          No contacts yet.{' '}
          <Link href="/dashboard/groups" className="text-[#25D366] hover:underline">
            Add contacts
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {renderTagSection('__all__', 'All Contacts', allContacts)}

          {tagsWithContacts.map((tag) =>
            renderTagSection(tag._id, tag.name, tag.contacts, tag)
          )}

          {tagsWithContacts.length === 0 && allContacts.length > 0 && (
            <p className="text-xs text-gray-500 text-center py-2">
              No tagged contacts yet. Use All Contacts or add tags on the Contacts page.
            </p>
          )}
        </div>
      )}

      {selectedContactPhones.length > 0 && (
        <div className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-3">
          <p className="text-sm font-medium text-[#25D366]">
            {selectedContactPhones.length} contact{selectedContactPhones.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}
