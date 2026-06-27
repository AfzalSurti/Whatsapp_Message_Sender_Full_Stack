import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import CreateCampaignForm from '../CreateCampaignForm';

export default function CreateScheduledCampaignPage() {
  return (
    <Suspense
      fallback={(
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-[#25D366]" size={32} />
        </div>
      )}
    >
      <CreateCampaignForm />
    </Suspense>
  );
}
