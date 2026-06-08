'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { templatesAPI } from '@/lib/api';
import TemplateCard from '@/components/dashboard/TemplateCard';
import CreateTemplateModal from '@/components/dashboard/CreateTemplateModal';

export default function TemplatesPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [templates, setTemplates] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [startWithAi, setStartWithAi] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setFetching(true);
      const res = await templatesAPI.getTemplates();
      setTemplates(res.data.templates || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load templates');
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) fetchTemplates();
  }, [user, fetchTemplates]);

  useEffect(() => {
    if (searchParams.get('create') === 'ai') {
      setStartWithAi(true);
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const handleUseTemplate = (template) => {
    router.push(`/dashboard/scheduled/create?template=${template._id}`);
  };

  const handleDeleteTemplate = async (template) => {
    if (!confirm(`Delete template "${template.name}"?`)) return;

    try {
      await templatesAPI.deleteTemplate(template._id);
      toast.success('Template deleted');
      await fetchTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete template');
    }
  };

  const openCreateModal = (withAi = false) => {
    setEditingTemplate(null);
    setStartWithAi(withAi);
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Message Templates</h1>
            <p className="text-sm text-gray-500 mt-1">
              Reusable message layouts for campaigns and scheduled sends.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreateModal(false)}
            className="bg-[#25D366] hover:bg-[#1ebe5d] text-black text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer self-start"
          >
            <Plus size={16} /> Create Template
          </button>
        </div>

        {fetching ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#25D366]" size={28} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                onUse={() => handleUseTemplate(template)}
                onEdit={() => {
                  setEditingTemplate(template);
                  setStartWithAi(false);
                  setShowCreateModal(true);
                }}
                onDelete={() => handleDeleteTemplate(template)}
              />
            ))}

            <button
              type="button"
              onClick={() => openCreateModal(true)}
              className="bg-[#111814] border border-dashed border-white/15 hover:border-violet-400/40 rounded-2xl p-5 text-left transition-all h-full cursor-pointer"
            >
              <div className="text-[28px] leading-none mb-3">✨</div>
              <h3 className="text-base font-semibold text-white mb-2">Create with AI</h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">
                Describe your campaign and let AI generate the perfect template for your brand.
              </p>
              <span className="inline-flex text-[10px] font-medium px-2 py-1 rounded-full border bg-violet-500/10 text-violet-300 border-violet-500/20">
                🤖 AI Builder
              </span>
            </button>
          </div>
        )}
      </div>

      <CreateTemplateModal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTemplate(null);
          setStartWithAi(false);
        }}
        onSaved={fetchTemplates}
        initialTemplate={editingTemplate}
        startWithAi={startWithAi}
      />
    </div>
  );
}
