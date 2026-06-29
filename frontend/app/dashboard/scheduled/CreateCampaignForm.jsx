"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { scheduledAPI, groupsAPI, aiAPI, templatesAPI } from "@/lib/api";
import CampaignWizardStepper from "@/components/dashboard/campaign/CampaignWizardStepper";
import Step1CampaignType from "@/components/dashboard/campaign/Step1CampaignType";
import Step2Audience from "@/components/dashboard/campaign/Step2Audience";
import Step3Message from "@/components/dashboard/campaign/Step3Message";
import Step4Schedule from "@/components/dashboard/campaign/Step4Schedule";
import Step5Review from "@/components/dashboard/campaign/Step5Review";
import {
  WIZARD_STEPS,
  getMinScheduleDate,
  getMinScheduleTime,
} from "@/lib/scheduledCampaign";
import {
  getMissingScheduleVariables,
  validateScheduleOnClient,
  variableLabel,
} from "@/lib/template";
import { getPhoneValidationError, normalizePhoneNumber } from "@/lib/phone";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";

const DEFAULT_MANUAL_DETAILS = {
  name: "",
  description: "",
  icon: "📋",
  category: "custom",
  tagsInput: "",
  languagesInput: "English",
};

export default function CreateCampaignForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editCampaignId = searchParams.get("edit");
  const handledTemplateQueryRef = useRef(null);
  const handledEditQueryRef = useRef(null);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(Boolean(editCampaignId));

  const [allContacts, setAllContacts] = useState([]);
  const [tagLibrary, setTagLibrary] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [messageSource, setMessageSource] = useState("template");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [manualDetails, setManualDetails] = useState(DEFAULT_MANUAL_DETAILS);

  const [selectedContactPhones, setSelectedContactPhones] = useState([]);
  const [manualRecipients, setManualRecipients] = useState([]);
  const [expandedTag, setExpandedTag] = useState(null);
  const [message, setMessage] = useState("");
  const [templateVariables, setTemplateVariables] = useState({});

  const [scheduleMode, setScheduleMode] = useState("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [recurrencePattern, setRecurrencePattern] = useState("none");
  const [recurrenceStartDate, setRecurrenceStartDate] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [sendingSpeed, setSendingSpeed] = useState("safe");

  const [aiSectionOpen, setAiSectionOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const fetchContactsOverview = useCallback(async () => {
    try {
      setLoadingContacts(true);
      const res = await groupsAPI.getOverview();
      setAllContacts(res.data.contacts || []);
      setTagLibrary(res.data.tags || []);
    } catch {
      toast.error("Failed to load contacts");
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
      toast.error("Failed to load templates");
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, router, user]);

  useEffect(() => {
    if (user) {
      fetchContactsOverview();
      fetchTemplates();
    }
  }, [user, fetchContactsOverview, fetchTemplates]);

  const applyTemplateSelection = useCallback((template) => {
    if (!template) return;
    setMessageSource("template");
    setSelectedTemplateId(template._id);
    setSelectedTemplate(template);
    setMessage(template.body);
    setTemplateVariables(template.defaultVariables || {});
    setManualDetails((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : template.name,
    }));
  }, []);

  useEffect(() => {
    if (!user || templates.length === 0) return;
    const templateId = new URLSearchParams(window.location.search).get(
      "template",
    );
    if (!templateId || handledTemplateQueryRef.current === templateId) return;

    const template = templates.find((item) => item._id === templateId);
    if (template) {
      handledTemplateQueryRef.current = templateId;
      applyTemplateSelection(template);
      setMessageSource("template");
    }
  }, [templates, user, applyTemplateSelection]);

  const applyCampaignForEdit = useCallback(
    (campaign) => {
      if (campaign.status !== "pending") {
        toast.error("Only pending campaigns can be edited");
        router.replace("/dashboard/scheduled");
        return;
      }

      if (campaign.templateId) {
        const templateId =
          typeof campaign.templateId === "object"
            ? campaign.templateId._id
            : campaign.templateId;
        const template = templates.find((item) => item._id === templateId);

        if (template) {
          applyTemplateSelection(template);
        } else {
          setMessageSource("manual");
          setMessage(campaign.message || "");
          setManualDetails((prev) => ({
            ...prev,
            name: campaign.name || prev.name,
          }));
        }
      } else {
        setMessageSource("manual");
        setMessage(campaign.message || "");
        setManualDetails((prev) => ({
          ...prev,
          name: campaign.name || prev.name,
        }));
      }

      setTemplateVariables(campaign.templateVariables || {});
      setSendingSpeed(campaign.sendingSpeed || "safe");
      setRecurrencePattern(campaign.recurrencePattern || "none");

      if (campaign.recurrenceStartDate) {
        const start = new Date(campaign.recurrenceStartDate);
        setRecurrenceStartDate(start.toISOString().slice(0, 10));
      }
      if (campaign.recurrenceEndDate) {
        const end = new Date(campaign.recurrenceEndDate);
        setRecurrenceEndDate(end.toISOString().slice(0, 10));
      }

      const phones = (campaign.individualNumbers || []).map((entry) =>
        String(entry.phone || "").replace(/\D/g, ""),
      );
      setSelectedContactPhones(phones.filter(Boolean));

      const contactPhoneSet = new Set(
        allContacts.map((contact) =>
          String(contact.phone || "").replace(/\D/g, ""),
        ),
      );
      const manualOnly = (campaign.individualNumbers || [])
        .filter(
          (entry) =>
            !contactPhoneSet.has(String(entry.phone || "").replace(/\D/g, "")),
        )
        .map((entry) => ({
          name: entry.name || "",
          phone: entry.phone,
        }));
      setManualRecipients(manualOnly);

      const scheduled = new Date(campaign.scheduledAt);
      setScheduleMode("later");
      setScheduleDate(scheduled.toISOString().slice(0, 10));
      setScheduleTime(
        `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`,
      );
    },
    [allContacts, applyTemplateSelection, router, templates],
  );

  useEffect(() => {
    if (
      !user ||
      !editCampaignId ||
      handledEditQueryRef.current === editCampaignId
    )
      return;
    if (loadingContacts || loadingTemplates) return;

    const loadCampaignForEdit = async () => {
      setLoadingEdit(true);
      try {
        const res = await scheduledAPI.getCampaign(editCampaignId);
        handledEditQueryRef.current = editCampaignId;
        applyCampaignForEdit(res.data.campaign);
      } catch (err) {
        toast.error(err.response?.data?.error || "Failed to load campaign");
        router.replace("/dashboard/scheduled");
      } finally {
        setLoadingEdit(false);
      }
    };

    loadCampaignForEdit();
  }, [
    applyCampaignForEdit,
    editCampaignId,
    loadingContacts,
    loadingTemplates,
    router,
    user,
  ]);

  const campaignName = useMemo(() => {
    if (messageSource === "template" && selectedTemplate)
      return selectedTemplate.name;
    return manualDetails.name.trim();
  }, [messageSource, selectedTemplate, manualDetails.name]);

  const audienceContacts = useMemo(() => {
    if (selectedContactPhones.length === 0) return [];
    const phoneSet = new Set(selectedContactPhones);
    return allContacts.filter((contact) =>
      phoneSet.has(contact.phone.replace(/\D/g, "")),
    );
  }, [allContacts, selectedContactPhones]);

  const buildRecipients = useCallback(() => {
    const manualByPhone = new Map(
      manualRecipients.map((entry) => [entry.phone.replace(/\D/g, ""), entry]),
    );

    return selectedContactPhones.map((phone) => {
      const clean = phone.replace(/\D/g, "");
      const contact = allContacts.find(
        (item) => item.phone.replace(/\D/g, "") === clean,
      );
      const manual = manualByPhone.get(clean);

      if (contact) {
        return {
          name: contact.name || manual?.name || "",
          phone: clean,
          segment: (contact.tags || []).join(", ") || "",
        };
      }

      return {
        name: manual?.name || "",
        phone: clean,
        segment: "Manual",
      };
    });
  }, [allContacts, manualRecipients, selectedContactPhones]);

  const recipientCount = selectedContactPhones.length;

  const missingTemplateVariables = useMemo(
    () => getMissingScheduleVariables(message, templateVariables),
    [message, templateVariables],
  );

  const getStepBlockers = useCallback(
    (currentStep) => {
      const blockers = [];

      if (currentStep === 1) {
        if (messageSource === "template" && !selectedTemplateId) {
          blockers.push("Select a template");
        }
        if (messageSource === "manual" && !manualDetails.name.trim()) {
          blockers.push("Enter a campaign name");
        }
      }

      if (currentStep === 2) {
        if (selectedContactPhones.length === 0)
          blockers.push("Select at least one contact");
      }

      if (currentStep === 3) {
        if (!message.trim()) blockers.push("Enter a message");
        missingTemplateVariables.forEach((variable) => {
          blockers.push(
            `Fill in ${variableLabel(variable)} for {{${variable}}}`,
          );
        });
      }

      if (currentStep === 4) {
        if (scheduleMode === "later") {
          const minDate = getMinScheduleDate();
          if (!scheduleDate) blockers.push("Select a schedule date");
          if (!scheduleTime) blockers.push("Select a schedule time");
          if (scheduleDate && scheduleDate < minDate) {
            blockers.push("Cannot schedule for a past date");
          }
          if (scheduleDate && scheduleTime) {
            const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
            if (Number.isNaN(scheduledAt.getTime())) {
              blockers.push("Enter a valid date and time");
            } else if (scheduledAt <= new Date(Date.now() + 60000)) {
              blockers.push(
                "Schedule time must be at least 1 minute in the future",
              );
            }
            if (
              scheduleDate === minDate &&
              scheduleTime < getMinScheduleTime(scheduleDate)
            ) {
              blockers.push("Select a future time for today");
            }
          }

          if (recurrencePattern && recurrencePattern !== "none") {
            if (!recurrenceStartDate)
              blockers.push("Select a recurrence start date");
            if (!recurrenceEndDate)
              blockers.push("Select a recurrence end date");
            if (
              recurrenceStartDate &&
              recurrenceEndDate &&
              recurrenceEndDate < recurrenceStartDate
            ) {
              blockers.push("End date must be on or after start date");
            }
          }
        }
      }

      return blockers;
    },
    [
      manualDetails.name,
      message,
      messageSource,
      missingTemplateVariables,
      recipientCount,
      recurrenceEndDate,
      recurrencePattern,
      recurrenceStartDate,
      scheduleDate,
      scheduleMode,
      scheduleTime,
      selectedContactPhones.length,
      selectedTemplateId,
    ],
  );

  const handleMessageSourceChange = (source) => {
    setMessageSource(source);
    if (source === "manual") {
      setSelectedTemplateId("");
      setSelectedTemplate(null);
      setMessage("");
      setTemplateVariables({});
    }
  };

  const toggleContactSelection = (phone) => {
    const clean = phone.replace(/\D/g, "");
    setSelectedContactPhones((prev) =>
      prev.includes(clean) ? prev.filter((p) => p !== clean) : [...prev, clean],
    );
  };

  const selectAllInTag = (contacts) => {
    const phones = contacts.map((contact) => contact.phone.replace(/\D/g, ""));
    setSelectedContactPhones((prev) => [...new Set([...prev, ...phones])]);
  };

  const deselectAllInTag = (contacts) => {
    const phoneSet = new Set(
      contacts.map((contact) => contact.phone.replace(/\D/g, "")),
    );
    setSelectedContactPhones((prev) =>
      prev.filter((phone) => !phoneSet.has(phone)),
    );
  };

  const addManualRecipient = (phoneValue, name, country) => {
    const normalized = normalizePhoneNumber(phoneValue, country);
    if (!normalized) {
      toast.error(getPhoneValidationError(country));
      return false;
    }

    const clean = normalized.e164.replace(/\D/g, "");
    if (selectedContactPhones.includes(clean)) {
      toast.error("This number is already selected");
      return false;
    }

    const existingContact = allContacts.find(
      (item) => item.phone.replace(/\D/g, "") === clean,
    );

    setSelectedContactPhones((prev) => [...prev, clean]);

    if (existingContact) {
      if (name.trim()) {
        setManualRecipients((prev) => [
          ...prev,
          { phone: clean, e164: normalized.e164, name: name.trim() },
        ]);
      }
      return true;
    }

    setManualRecipients((prev) => [
      ...prev,
      {
        phone: clean,
        e164: normalized.e164,
        name: name.trim(),
      },
    ]);
    return true;
  };

  const removeManualRecipient = (phone) => {
    const clean = phone.replace(/\D/g, "");
    setManualRecipients((prev) =>
      prev.filter((entry) => entry.phone.replace(/\D/g, "") !== clean),
    );
    setSelectedContactPhones((prev) => prev.filter((entry) => entry !== clean));
  };

  const handleSelectTemplate = (template) => {
    if (selectedTemplateId === template._id) {
      setSelectedTemplateId("");
      setSelectedTemplate(null);
      setMessage("");
      setTemplateVariables({});
      return;
    }
    applyTemplateSelection(template);
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Describe the message you want");
      return;
    }

    setAiLoading(true);
    try {
      const res = await aiAPI.generate({
        preset: "best",
        prompt: aiPrompt,
        tone: "Friendly",
        language:
          manualDetails.languagesInput.split(",")[0]?.trim() || "English",
        festival: "General",
        audience: "Customers",
        guidance:
          "Create a WhatsApp campaign message. Include {{name}} when useful.",
      });
      setMessage(res.data.message);
      toast.success("Message generated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const handleLaunch = async () => {
    const blockers = [
      ...getStepBlockers(1),
      ...getStepBlockers(2),
      ...getStepBlockers(3),
      ...getStepBlockers(4),
    ];
    if (blockers.length > 0) {
      toast.error(blockers[0]);
      return;
    }

    const recipients = buildRecipients();
    const scheduleValidationError = validateScheduleOnClient(
      message,
      templateVariables,
      recipients,
    );
    if (scheduleValidationError) {
      toast.error(scheduleValidationError);
      return;
    }

    let scheduledAt;
    if (scheduleMode === "now") {
      scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
    } else {
      scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    }

    const finalName = campaignName || "Untitled Campaign";

    setSubmitting(true);
    try {
      const payload = {
        name: finalName,
        message,
        scheduledAt: scheduledAt.toISOString(),
        timezone: "Asia/Kolkata",
        individualNumbers: recipients.map((recipient) => ({
          phone: recipient.phone,
          name: recipient.name,
        })),
        templateId:
          messageSource === "template" ? selectedTemplateId : undefined,
        templateVariables,
        sendingSpeed,
        recurrencePattern:
          recurrencePattern !== "none" ? recurrencePattern : undefined,
        recurrenceStartDate:
          recurrencePattern !== "none" && recurrenceStartDate
            ? new Date(`${recurrenceStartDate}T00:00:00`).toISOString()
            : undefined,
        recurrenceEndDate:
          recurrencePattern !== "none" && recurrenceEndDate
            ? new Date(`${recurrenceEndDate}T23:59:59`).toISOString()
            : undefined,
      };

      if (editCampaignId) {
        await scheduledAPI.updateCampaign(editCampaignId, payload);
        toast.success("Campaign updated!");
      } else {
        await scheduledAPI.createCampaign(payload);
        toast.success(
          scheduleMode === "now" ? "Campaign launched!" : "Campaign scheduled!",
        );
      }

      router.push("/dashboard/scheduled");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to launch campaign");
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

    if (step === 3 && message.includes("{{name}}")) {
      const err = validateScheduleOnClient(
        message,
        templateVariables,
        buildRecipients(),
      );
      if (err) {
        toast.error(err);
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, 5));
  };

  if (loading || loadingEdit) {
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
              <h2 className="font-bold text-lg">
                {editCampaignId ? "Edit Campaign" : "New Campaign"}
              </h2>
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
            expandedTag={expandedTag}
            setExpandedTag={setExpandedTag}
            selectedContactPhones={selectedContactPhones}
            manualRecipients={manualRecipients}
            toggleContactSelection={toggleContactSelection}
            selectAllInTag={selectAllInTag}
            deselectAllInTag={deselectAllInTag}
            onAddManualRecipient={addManualRecipient}
            onRemoveManualRecipient={removeManualRecipient}
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
            recurrencePattern={recurrencePattern}
            setRecurrencePattern={setRecurrencePattern}
            recurrenceStartDate={recurrenceStartDate}
            setRecurrenceStartDate={setRecurrenceStartDate}
            recurrenceEndDate={recurrenceEndDate}
            setRecurrenceEndDate={setRecurrenceEndDate}
            sendingSpeed={sendingSpeed}
            setSendingSpeed={setSendingSpeed}
          />
        )}
        {step === 5 && (
          <Step5Review
            campaignName={campaignName}
            messageSource={messageSource}
            recipientCount={recipientCount}
            scheduleMode={scheduleMode}
            scheduleDate={scheduleDate}
            scheduleTime={scheduleTime}
            recurrencePattern={recurrencePattern}
            recurrenceStartDate={recurrenceStartDate}
            recurrenceEndDate={recurrenceEndDate}
            sendingSpeed={sendingSpeed}
            message={message}
          />
        )}
      </div>

      <div className="border-t border-white/10 p-6 space-y-4">
        {stepBlockers.length > 0 && step < 5 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-medium text-amber-200 mb-1">
              Complete to continue:
            </p>
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
              {submitting ? "Launching..." : "Launch Campaign"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
