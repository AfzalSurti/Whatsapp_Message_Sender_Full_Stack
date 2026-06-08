'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { scheduledAPI, groupsAPI, aiAPI, templatesAPI } from '@/lib/api';
import CampaignWizardStepper from '@/components/dashboard/campaign/CampaignWizardStepper';
import Step1CampaignType from '@/components/dashboard/campaign/Step1CampaignType';
import Step2Audience from '@/components/dashboard/campaign/Step2Audience';
import Step3Message from '@/components/dashboard/campaign/Step3Message';
import Step4Schedule from '@/components/dashboard/campaign/Step4Schedule';
import Step5Review from '@/components/dashboard/campaign/Step5Review';
import {
  CAMPAIGN_TYPES,
  WIZARD_STEPS
} from '@/lib/scheduledCampaign';
import {
  getMissingScheduleVariables,
  validateScheduleOnClient,
  variableLabel
} from '@/lib/template';
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';

const DEFAULT_MANUAL_DETAILS = {
  name: '',
  description: '',
  icon: '📋',
  category: 'custom',
  tagsInput: '',
  languagesInput: 'English'
};

export default function CreateCampaignForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const handledTemplateQueryRef = useRef(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [allContacts, setAllContacts] = useState([]);
  const [tagLibrary, setTagLibrary] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [campaignType, setCampaignType] = useState('');
  const [messageSource, setMessageSource] = useState('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [manualDetails, setManualDetails] = useState(DEFAULT_MANUAL_DETAILS);

  const [selectedAudienceTags, setSelectedAudienceTags] = useState([]);
  const [message, setMessage] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});

  const [scheduleMode, setScheduleMode] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sendingSpeed, setSendingSpeed] = useState('safe');

  const [aiSectionOpen, setAiSectionOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchContactsOverview = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const res = await groupsAPI.getOverview();
      setAllContacts(res.data.contacts || []);
      setTagLibrary(res.data.tags || []);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await templatesAPI.getTemplates();
      setTemplates(res.data.templates || []);
      return res.data.templates || [];
    } catch {
      toast.error('Failed to load templates');
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, router, user]);

  useEffect(() => {
    if (user) {
      fetchContactsOverview();
      fetchTemplates();
    }
  }, [user, fetchContactsOverview, fetchTemplates]);

  const applyTemplateSelection = useCallback((template) => {
    if (!template) return;
    setMessageSource('template');
    setSelectedTemplateId(template._id);
    setSelectedTemplate(template);
    setMessage(template.body);
    setTemplateVariables(template.defaultVariables || {});
    setManualDetails((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : template.name
    }));
  }, []);

  useEffect(() => {
    if (!user || templates.length === 0) return;
    const templateId = new URLSearchParams(window.location.search).get('template');
    if (!templateId || handledTemplateQueryRef.current === templateId) return;

    const template = templates.find((item) => item._id === templateId);
    if (template) {
      handledTemplateQueryRef.current = templateId;
      applyTemplateSelection(template);
      setMessageSource('template');
    }
  }, [templates, user, applyTemplateSelection]);

  const campaignName = useMemo(() => {
    if (messageSource === 'template' && selectedTemplate) return selectedTemplate.name;
    return manualDetails.name.trim();
  }, [messageSource, selectedTemplate, manualDetails.name]);

  const audienceContacts = useMemo(() => {
    if (selectedAudienceTags.length === 0) return [];
    if (selectedAudienceTags.includes('__all__')) return allContacts;

    return allContacts.filter((contact) =>
      selectedAudienceTags.some((tag) => contact.tags?.includes(tag))
    );
  }, [allContacts, selectedAudienceTags]);

  const buildRecipients = useCallback(() => {
    return audienceContacts.map((contact) => ({
      name: contact.name || '',
      phone: contact.phone.replace(/\D/g, ''),
      segment: (contact.tags || []).join(', ') || ''
    }));
  }, [audienceContacts]);

  const recipientCount = audienceContacts.length;

  const missingTemplateVariables = useMemo(
    () => getMissingScheduleVariables(message, templateVariables),
    [message, templateVariables]
  );

  const getStepBlockers = useCallback(
    (currentStep) => {
      const blockers = [];

      if (currentStep === 1) {
        if (!campaignType) blockers.push('Select a campaign type');
        if (messageSource === 'template' && !selectedTemplateId) {
          blockers.push('Select a template');
        }
        if (messageSource === 'manual' && !manualDetails.name.trim()) {
          blockers.push('Enter a campaign / template name');
        }
      }

      if (currentStep === 2) {
        if (selectedAudienceTags.length === 0) blockers.push('Select at least one audience segment');
        if (recipientCount === 0) blockers.push('Selected segments have no contacts');
      }

      if (currentStep === 3) {
        if (!message.trim()) blockers.push('Enter a message');
        missingTemplateVariables.forEach((variable) => {
          blockers.push(`Fill in ${variableLabel(variable)} for {{${variable}}}`);
        });
      }

      if (currentStep === 4) {
        if (scheduleMode === 'later') {
          if (!scheduleDate) blockers.push('Select a schedule date');
          if (!scheduleTime) blockers.push('Select a schedule time');
          if (scheduleDate && scheduleTime) {
            const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
            if (Number.isNaN(scheduledAt.getTime())) {
              blockers.push('Enter a valid date and time');
            } else if (scheduledAt <= new Date(Date.now() + 60000)) {
              blockers.push('Schedule time must be at least 1 minute in the future');
            }
          }
        }
      }

      return blockers;
    },
    [
      campaignType,
      manualDetails.name,
      message,
      messageSource,
      missingTemplateVariables,
      recipientCount,
      scheduleDate,
      scheduleMode,
      scheduleTime,
      selectedAudienceTags.length,
      selectedTemplateId
    ]
  );

  const handleMessageSourceChange = (source) => {
    setMessageSource(source);
    if (source === 'manual') {
      setSelectedTemplateId('');
      setSelectedTemplate(null);
      setMessage('');
      setTemplateVariables({});
    }
  };

  const toggleAudienceTag = (tagName) => {
    if (tagName === '__all__') {
      setSelectedAudienceTags((prev) => (prev.includes('__all__') ? [] : ['__all__']));
      return;
    }

    setSelectedAudienceTags((prev) => {
      const withoutAll = prev.filter((tag) => tag !== '__all__');
      return withoutAll.includes(tagName)
        ? withoutAll.filter((tag) => tag !== tagName)
        : [...withoutAll, tagName];
    });
  };

  const handleSelectTemplate = (template) => {
    if (selectedTemplateId === template._id) {
      setSelectedTemplateId('');
      setSelectedTemplate(null);
      setMessage('');
      setTemplateVariables({});
      return;
    }
    applyTemplateSelection(template);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Describe the message you want');
      return;
    }

    setAiLoading(true);
    try {
      const res = await aiAPI.generate({
        preset: 'best',
        prompt: aiPrompt,
        tone: 'Friendly',
        language: manualDetails.languagesInput.split(',')[0]?.trim() || 'English',
        festival: 'General',
        audience: 'Customers',
        guidance: 'Create a WhatsApp campaign message. Include {{name}} when useful.'
      });
      setMessage(res.data.message);
      toast.success('Message generated!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLaunch = async () => {
    const blockers = [
      ...getStepBlockers(1),
      ...getStepBlockers(2),
      ...getStepBlockers(3),
      ...getStepBlockers(4)
    ];
    if (blockers.length > 0) {
      toast.error(blockers[0]);
      return;
    }

    const recipients = buildRecipients();
    const scheduleValidationError = validateScheduleOnClient(message, templateVariables, recipients);
    if (scheduleValidationError) {
      toast.error(scheduleValidationError);
      return;
    }

    let scheduledAt;
    if (scheduleMode === 'now') {
      scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
    } else {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    }

    const typeLabel = CAMPAIGN_TYPES.find((t) => t.id === campaignType)?.label || 'Campaign';
    const finalName = campaignName || typeLabel;

    setSubmitting(true);
    try {
      await scheduledAPI.createCampaign({
        name: finalName,
        message,
        scheduledAt: scheduledAt.toISOString(),
        timezone: 'Asia/Kolkata',
        individualNumbers: recipients.map((recipient) => ({
          phone: recipient.phone,
          name: recipient.name
        })),
        templateId: messageSource === 'template' ? selectedTemplateId : undefined,
        templateVariables
      });

      toast.success(scheduleMode === 'now' ? 'Campaign launched!' : 'Campaign scheduled!');
      router.push('/dashboard/scheduled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to launch campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const goNext = () => {
    const blockers = getStepBlockers(step);
    if (blockers.length > 0) {
      toast.error(blockers[0]);
      return;
    }

    if (step === 3 && message.includes('{{name}}')) {
      const err = validateScheduleOnClient(message, templateVariables, buildRecipients());
      if (err) {
        toast.error(err);
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, 5));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  const currentStepMeta = WIZARD_STEPS.find((item) => item.id === step);
  const stepBlockers = getStepBlockers(step);

  return (
    <div className="bg-[#111814] border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-6 border-b border-white/10 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/scheduled"
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
            >
              <ChevronLeft size={16} /> Back
            </Link>
            <div>
              <h2 className="font-bold text-lg">New Campaign</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Step {step} of 5 · {currentStepMeta?.label}
              </p>
            </div>
          </div>
        </div>
        <CampaignWizardStepper step={step} />
      </div>

      <div className="p-6 min-h-[420px]">
        {step === 1 && (
          <Step1CampaignType
            campaignType={campaignType}
            setCampaignType={setCampaignType}
            messageSource={messageSource}
            setMessageSource={handleMessageSourceChange}
            templates={templates}
            loadingTemplates={loadingTemplates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
            manualDetails={manualDetails}
            setManualDetails={setManualDetails}
          />
        )}
        {step === 2 && (
          <Step2Audience
            tagLibrary={tagLibrary}
            allContacts={allContacts}
            loadingContacts={loadingContacts}
            selectedAudienceTags={selectedAudienceTags}
            toggleAudienceTag={toggleAudienceTag}
          />
        )}
        {step === 3 && (
          <Step3Message
            message={message}
            setMessage={setMessage}
            messageSource={messageSource}
            selectedTemplate={selectedTemplate}
            templateVariables={templateVariables}
            setTemplateVariables={setTemplateVariables}
            aiSectionOpen={aiSectionOpen}
            setAiSectionOpen={setAiSectionOpen}
            aiPrompt={aiPrompt}
            setAiPrompt={setAiPrompt}
            aiLoading={aiLoading}
            onGenerateAi={handleAIGenerate}
          />
        )}
        {step === 4 && (
          <Step4Schedule
            scheduleMode={scheduleMode}
            setScheduleMode={setScheduleMode}
            scheduleDate={scheduleDate}
            setScheduleDate={setScheduleDate}
            scheduleTime={scheduleTime}
            setScheduleTime={setScheduleTime}
            sendingSpeed={sendingSpeed}
            setSendingSpeed={setSendingSpeed}
          />
        )}
        {step === 5 && (
          <Step5Review
            campaignType={campaignType}
            selectedAudienceTags={selectedAudienceTags}
            recipientCount={recipientCount}
            scheduleMode={scheduleMode}
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            sendingSpeed={sendingSpeed}
            message={message}
          />
        )}
      </div>

      <div className="border-t border-white/10 p-6 space-y-4">
        {stepBlockers.length > 0 && step < 5 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-200 mb-1">Complete to continue:</p>
            <ul className="space-y-1">
              {stepBlockers.map((blocker) => (
                <li key={blocker} className="text-xs text-amber-100/90">
                  • {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <Link
              href="/dashboard/scheduled"
              className="flex-1 border border-white/10 hover:border-white/20 text-white font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center"
            >
              Cancel
            </Link>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={stepBlockers.length > 0}
              className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              Continue <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={submitting}
              className="flex-1 bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-50 text-black font-semibold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {submitting ? 'Launching...' : 'Launch Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
