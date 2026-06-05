'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import TemplatesPageContent from './TemplatesPageContent';

export default function TemplatesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
          <Loader2 className="animate-spin text-[#25D366]" size={32} />
        </div>
      }
    >
      <TemplatesPageContent />
    </Suspense>
  );
}
