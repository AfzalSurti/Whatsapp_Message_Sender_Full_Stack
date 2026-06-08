'use client';

import Link from 'next/link';
import { Loader2 } from 'lucide-react';

export default function Step2Audience({
  tagLibrary,
  allContacts,
  loadingContacts,
  selectedAudienceTags,
  toggleAudienceTag
}) {
  const allCount = allContacts.length;

  const tagCounts = tagLibrary.map((tag) => ({
    ...tag,
    count: allContacts.filter((contact) => contact.tags?.includes(tag.name)).length
  }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Select target audience</h2>
        <p className="text-sm text-gray-500 mt-1">Choose one or more contact segments to reach.</p>
      </div>

      {loadingContacts ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#25D366]" />
        </div>
      ) : allCount === 0 ? (
        <div className="text-center py-10 text-sm text-gray-500">
          No contacts yet.{' '}
          <Link href="/dashboard/groups" className="text-[#25D366] hover:underline">
            Add contacts
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
              selectedAudienceTags.includes('__all__')
                ? 'border-[#25D366]/40 bg-[#25D366]/5'
                : 'border-white/10 bg-[#0a0f0d] hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedAudienceTags.includes('__all__')}
              onChange={() => toggleAudienceTag('__all__')}
              className="cursor-pointer"
            />
            <span className="flex-1 text-sm text-white">All Contacts</span>
            <span className="text-xs text-gray-500">{allCount.toLocaleString()}</span>
          </label>

          {tagCounts.map((tag) => (
            <label
              key={tag._id}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                selectedAudienceTags.includes(tag.name)
                  ? 'border-[#25D366]/40 bg-[#25D366]/5'
                  : 'border-white/10 bg-[#0a0f0d] hover:border-white/20'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAudienceTags.includes(tag.name)}
                onChange={() => toggleAudienceTag(tag.name)}
                className="cursor-pointer"
              />
              <span className="flex-1 text-sm text-white">{tag.name}</span>
              <span className="text-xs text-gray-500">{tag.count.toLocaleString()}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
