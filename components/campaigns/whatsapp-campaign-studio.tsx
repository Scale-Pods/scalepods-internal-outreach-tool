"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Save,
  RefreshCw,
  MessageSquare,
  FileText,
  User,
  Building,
  Briefcase,
  Layers,
  ChevronRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { getInstantlyStatusBadge } from "@/components/dashboard/campaign-badge";

const API_WEBHOOK_URL = "https://n8n.srv1010832.hstgr.cloud/webhook/whatsapp-campaign-api";

interface DynamicCampaignOption {
  id: number;
  campaignName: string;
  alias: string | null;
  instantlyStatus: string | null;
}

const PRESETS: Record<number, { label: string; text: string }> = {
  9: {
    label: "Campaign 9 (Aussie Legal / Advisory)",
    text: `Step 1: Initial Hook (Focus: Document Ingestion & Admin Bottlenecks)
Hi {{firstname}}, noticed {{company name}} has been scaling its advisory & client work. Most Aussie firms lose hours every week chasing client documents, manually indexing files, and managing routine workflows. We built an autonomous practice automation agent that handles 24/7 document ingestion, data extraction, and client workflow routing without adding admin headcount. Open to a quick 2-min walkthrough video of how it works?

Step 2: Follow-Up 1 (Focus: Proof & Billable Recovery — +48 Hours)
Hi {{firstname}}, bumping this up—legal, accounting, and advisory practices using our document ingestion and client workflow bots typically cut manual compliance and admin processing time by 40–60% in week one, freeing up senior staff for billable advisory work. Want me to send over the 1-page workflow architecture for {{company name}}?

Step 3: Follow-Up 2 (Focus: Low-Friction Breakup — +4 Days)
Hey {{firstname}}, haven't heard back so I'll assume practice workflow automation isn't a priority for {{company name}} right now. I'll close the loop here—if automated client onboarding, document ingestion, or compliance routing ever hit your roadmap, just reply to this thread. Best of luck with the practice!`,
  },
  5: {
    label: "Campaign 5 (US HVAC Dispatch AI)",
    text: `Step 1: Initial Hook (Focus: Work Order Bottlenecks)
Hi {{firstname}}, noticed {{company name}} handles heavy commercial HVAC maintenance. Most dispatchers lose hours manually triaging incoming service tickets. We built an autonomous dispatch agent integrated directly with ServiceTitan that triages tenant calls and assigns certified technicians in under 90 seconds. Open to seeing a 2-min walkthrough video?

Step 2: Follow-Up 1 (Focus: First-Time Fix Rates & Overtime Reduction)
Hi {{firstname}}, bumping this up—commercial field service teams using our dispatch agent typically cut emergency response dispatch lag by 70% and reduce dispatcher overtime in week one. Want me to send the 1-page workflow architecture for {{company name}}?

Step 3: Follow-Up 2 (Focus: Polite Breakup)
Hey {{firstname}}, haven't heard back so I'll assume automated technician dispatch isn't on {{company name}}'s roadmap right now. I'll close the loop here—if after-hours triage ever becomes a priority, feel free to reply anytime. Wishing you continued growth!`,
  },
  1: {
    label: "Campaign 1 (Dubai HR & Recruitment)",
    text: `Step 1: Initial Hook (Focus: Candidate Screening Delays)
Hi {{firstname}}, noticed {{company name}} is expanding its team in the UAE. Most Gulf recruiters lose days screening high applicant volumes across Bayt and LinkedIn. We built an autonomous recruitment agent that unifies candidate intake, scores CVs against your exact rubric, and coordinates WhatsApp interviews in under 30 minutes. Open to a quick 2-min walkthrough?

Step 2: Follow-Up 1 (Focus: Time-to-Hire Metrics)
Hi {{firstname}}, bumping this up—talent teams in Dubai using our screening agent typically reduce recruiter screening hours by 70% while keeping hiring managers in full control. Want me to send over a sample workflow architecture for {{company name}}?

Step 3: Follow-Up 2 (Focus: Polite Breakup)
Hey {{firstname}}, haven't heard back so I'll assume talent acquisition automation isn't a current focus for {{company name}}. I'll close the loop here. Best of luck with your hiring!`,
  },
};

interface LeadSample {
  first_name: string;
  company_name: string;
  designation: string;
  industry: string;
  has_verified_prior_contact?: boolean;
}

interface SequenceStep {
  step: number;
  cadence: string;
  objective: string;
  rendered_whatsapp_message: string;
  character_count: number;
  compliance_check: {
    passed: boolean;
    single_line: boolean;
    length_valid: boolean;
    validation_error: string | null;
  };
}

const DEFAULT_STEP_META = [
  { step: 1, cadence: "Day 3", objective: "Initial Hook & Value Proposition" },
  { step: 2, cadence: "Day 11", objective: "Proof & Workflow Architecture Follow-Up" },
  { step: 3, cadence: "Day 21", objective: "Low-Friction Breakup & Close Loop" },
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collapses duplicated leading greetings such as "Hi Marcus. Hi Marcus. ..." */
export function stripDuplicateGreeting(text: string, firstName: string): string {
  if (!text) return "";
  if (!firstName.trim()) return text;
  const escaped = escapeRegex(firstName.trim());
  const pattern = new RegExp(
    `^(Hi|Hey|Hello)\\s+${escaped}[.!,]?\\s*(Hi|Hey|Hello)\\s+${escaped}[.!,]?`,
    "i"
  );
  return text.replace(pattern, `Hi ${firstName.trim()}.`);
}

/** Strips redundant leading greeting when the chat bubble header already renders "Hi {firstName}." */
function sanitizeBubbleBody(text: string, firstName: string): string {
  const collapsed = stripDuplicateGreeting(text.trim(), firstName);
  const namePattern = firstName.trim()
    ? `(?:${escapeRegex(firstName.trim())}|there|\\{\\{firstname\\}\\})`
    : `(?:there|\\{\\{firstname\\}\\})`;
  const leadingGreeting = new RegExp(`^(?:Hi|Hey|Hello)\\s+${namePattern}[.!,:]*\\s*`, "i");
  const withoutGreeting = collapsed.replace(leadingGreeting, "").trim();
  if (!withoutGreeting) return collapsed;
  // Capitalize first letter if stripping "Hi Marcus, noticed..." left lowercase "noticed..."
  return withoutGreeting.charAt(0).toUpperCase() + withoutGreeting.slice(1);
}

/** Interpolates simulator variables and builds deterministic 3-step simulated preview from KB text */
function buildSimulatedDraftSequence(kb: string, sim: LeadSample): SequenceStep[] {
  const firstName = sim.first_name?.trim() || "Marcus";
  const company = sim.company_name?.trim() || "Apex Air Systems";
  const designation = sim.designation?.trim() || "VP of Operations";
  const industry = sim.industry?.trim() || "Commercial Facilities";

  const interpolate = (raw: string) =>
    raw
      .replace(/\{\{\s*first_?name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*company(?:\s|_)?name\s*\}\}/gi, company)
      .replace(/\{\{\s*designation\s*\}\}/gi, designation)
      .replace(/\{\{\s*industry\s*\}\}/gi, industry)
      .trim();

  // Extract explicit "Step 1:" / "Step 2:" / "Step 3:" blocks if present in KB
  const stepBlocks: Record<number, { objective?: string; body: string }> = {};
  const stepRegex = /Step\s*([1-3])\s*:?([^\n]*)\n([\s\S]*?)(?=\n\s*Step\s*[1-3]\s*:|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = stepRegex.exec(kb)) !== null) {
    const stepNum = Number(match[1]);
    const heading = match[2]?.trim().replace(/^\(|\)$/g, "");
    const body = match[3]?.trim();
    if (body) {
      stepBlocks[stepNum] = { objective: heading || undefined, body };
    }
  }

  const trimmedKb = kb.trim();

  return DEFAULT_STEP_META.map((meta) => {
    const block = stepBlocks[meta.step];
    let rawBody = block?.body;

    if (!rawBody) {
      const compactContext = trimmedKb.replace(/\s+/g, " ").slice(0, 260);
      if (meta.step === 1) {
        rawBody = `Noticed {{company name}} is focused on ${industry} operations. Based on your campaign context: ${compactContext}${trimmedKb.length > 260 ? "..." : ""} Open to a quick 2-min walkthrough?`;
      } else if (meta.step === 2) {
        rawBody = `Following up on our note for {{company name}} — teams led by {{designation}}s in ${industry} use this workflow to eliminate manual bottlenecks. Want me to share the 1-page architecture?`;
      } else {
        rawBody = `Haven't heard back, so I'll assume this isn't a top priority for {{company name}} right now. I'll close the loop here—feel free to reply anytime if it hits your roadmap.`;
      }
    }

    const interpolated = sanitizeBubbleBody(interpolate(rawBody), firstName);
    const charCount = interpolated.length;

    return {
      step: meta.step,
      cadence: meta.cadence,
      objective: block?.objective || meta.objective,
      rendered_whatsapp_message: interpolated,
      character_count: charCount,
      compliance_check: {
        passed: charCount <= 1024,
        single_line: !interpolated.includes("\n\n"),
        length_valid: charCount <= 1024,
        validation_error: charCount > 1024 ? "Exceeds Meta 1024 char limit" : null,
      },
    };
  });
}

function getMetaLimitBadge(charCount: number) {
  if (charCount > 1024) {
    return {
      badgeClass: "bg-rose-950/80 border-rose-600/70 text-rose-400",
      textClass: "text-rose-400 font-bold",
      label: "Exceeds 1024 Limit",
    };
  }
  if (charCount >= 400 && charCount <= 600) {
    return {
      badgeClass: "bg-amber-950/70 border-amber-700/60 text-amber-400",
      textClass: "text-amber-400 font-bold",
      label: "Warning (400–600)",
    };
  }
  if (charCount > 600) {
    return {
      badgeClass: "bg-amber-950/80 border-amber-600/70 text-amber-300",
      textClass: "text-amber-300 font-bold",
      label: "Near Meta Limit",
    };
  }
  return {
    badgeClass: "bg-emerald-950/70 border-emerald-700/60 text-emerald-400",
    textClass: "text-emerald-400 font-semibold",
    label: "Meta Optimal",
  };
}

export interface WhatsAppCampaignStudioProps {
  initialCampaignId?: number;
}

export function WhatsAppCampaignStudio({ initialCampaignId = 9 }: WhatsAppCampaignStudioProps) {
  const [campaignId, setCampaignId] = useState<number>(initialCampaignId);
  const [campaignName, setCampaignName] = useState<string>(`ScalePods Internal Outreach ${initialCampaignId}`);
  const [campaignOptions, setCampaignOptions] = useState<DynamicCampaignOption[]>(() =>
    Array.from({ length: 10 }, (_, idx) => ({
      id: idx + 1,
      campaignName: `ScalePods Internal Outreach ${idx + 1}`,
      alias: null,
      instantlyStatus: null,
    }))
  );
  const [aliasInput, setAliasInput] = useState<string>("");
  const [savingAlias, setSavingAlias] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);
  const [totalLeads, setTotalLeads] = useState<number>(0);
  const [enrichedLeads, setEnrichedLeads] = useState<number>(0);
  const [kbText, setKbText] = useState<string>("");
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(false);

  // Prospect simulator state
  const [simulator, setSimulator] = useState<LeadSample>({
    first_name: "Marcus",
    company_name: "Apex Air Systems",
    designation: "VP of Operations",
    industry: "Commercial Facilities",
    has_verified_prior_contact: false,
  });

  const [sequence, setSequence] = useState<SequenceStep[]>([]);
  const [previewSource, setPreviewSource] = useState<"ai" | "draft" | "placeholder">("placeholder");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [savingStatus, setSavingStatus] = useState<"ACTIVATING" | "SAVING_DRAFT" | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<{ start: number; end: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Update campaignId if initialCampaignId changes externally
  useEffect(() => {
    if (initialCampaignId && initialCampaignId >= 1 && initialCampaignId <= 10) {
      setCampaignId(initialCampaignId);
    }
  }, [initialCampaignId]);

  // Fetch dynamic campaign names & assigned_lead aliases for Campaigns 1–10
  const fetchCampaignOptions = async () => {
    try {
      const res = await fetch("/api/campaigns/aliases");
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.campaigns) && data.campaigns.length > 0) {
        const opts: DynamicCampaignOption[] = data.campaigns.map((c: any) => ({
          id: Number(c.id || c.campaignId),
          campaignName: c.campaignName || `ScalePods Internal Outreach ${c.id || c.campaignId}`,
          alias: c.alias || null,
          instantlyStatus: c.instantlyStatus ?? null,
        }));
        setCampaignOptions(opts);
        const active = opts.find((o) => o.id === campaignId);
        if (active) {
          setAliasInput(active.alias || "");
        }
      }
    } catch (err) {
      console.error("Failed to load dynamic campaign aliases", err);
    }
  };

  useEffect(() => {
    fetchCampaignOptions();
  }, []);

  // Load Campaign Config on campaignId change
  const fetchCampaignConfig = async (id: number) => {
    setIsLoadingConfig(true);
    setSequence([]);
    setPreviewSource("placeholder");
    const knownOption = campaignOptions.find((o) => o.id === id);
    setAliasInput(knownOption?.alias || "");
    try {
      const resp = await fetch(API_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_campaign_config",
          campaign_id: id,
        }),
      });
      const data = await resp.json();
      if (data.success && data.campaign) {
        const loadedKb = data.campaign.knowledge_base || "";
        const resolvedName = data.campaign.campaign_name || `ScalePods Internal Outreach ${id}`;
        setCampaignName(resolvedName);
        setCampaignOptions((prev) =>
          prev.map((opt) => (opt.id === id ? { ...opt, campaignName: resolvedName } : opt))
        );
        setIsEnabled(Boolean(data.campaign.enabled));
        setKbText(loadedKb);
        setSystemPrompt(data.campaign.system_prompt || "");
        setTotalLeads(data.campaign.total_leads || 0);
        setEnrichedLeads(data.campaign.enriched_leads || 0);

        if (Array.isArray(data.campaign.sequence) && data.campaign.sequence.length > 0) {
          setSequence(data.campaign.sequence);
          setPreviewSource("ai");
        } else if (loadedKb.trim().length >= 20) {
          setSequence(buildSimulatedDraftSequence(loadedKb, simulator));
          setPreviewSource("draft");
        } else {
          setSequence([]);
          setPreviewSource("placeholder");
        }
      }
    } catch (err) {
      console.error("Failed to load campaign config", err);
      setBannerMessage({ text: "Error connecting to campaign API.", type: "error" });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  const handleSaveAlias = async () => {
    const trimmed = aliasInput.trim();
    if (!trimmed) {
      triggerToast("Enter a campaign alias before saving.", "error");
      return;
    }
    setSavingAlias(true);
    try {
      const res = await fetch("/api/webhook/assign-person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          person: trimmed,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        triggerToast(json?.error || "Failed to update campaign alias.", "error");
        return;
      }
      setCampaignOptions((prev) =>
        prev.map((opt) => (opt.id === campaignId ? { ...opt, alias: trimmed } : opt))
      );
      triggerToast(`Campaign ${campaignId} alias updated to "${trimmed}"`, "success");
    } catch (err) {
      console.error("Failed to save campaign alias", err);
      triggerToast("Network error saving campaign alias.", "error");
    } finally {
      setSavingAlias(false);
    }
  };

  useEffect(() => {
    fetchCampaignConfig(campaignId);
  }, [campaignId]);

  // Keep simulated draft previews live-updated when KB or simulator variables change (unless an AI preview is active)
  useEffect(() => {
    if (isLoadingConfig || loadingPreview || previewSource === "ai") return;
    if (kbText.trim().length >= 20) {
      setSequence(buildSimulatedDraftSequence(kbText, simulator));
      setPreviewSource("draft");
    } else {
      setSequence([]);
      setPreviewSource("placeholder");
    }
  }, [kbText, simulator, isLoadingConfig, loadingPreview, previewSource]);

  // Generate Sequence Preview
  const handleGeneratePreview = async () => {
    if (!kbText.trim() || kbText.trim().length < 20) {
      setBannerMessage({
        text: "Please enter at least 20 characters of product context or templates before generating a preview.",
        type: "error",
      });
      return;
    }

    setLoadingPreview(true);
    setBannerMessage(null);
    try {
      const resp = await fetch(API_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview_sequence",
          campaign_id: campaignId,
          campaign_kb_text: kbText,
          system_prompt: systemPrompt,
          lead_sample: simulator,
        }),
      });
      const data = await resp.json();
      if (data.success && Array.isArray(data.sequence)) {
        setSequence(data.sequence);
        setPreviewSource("ai");
      } else {
        setBannerMessage({ text: data.error || "Failed to generate sequence preview.", type: "error" });
      }
    } catch (err) {
      console.error("Failed to generate preview", err);
      setBannerMessage({ text: "Timeout or network error generating preview.", type: "error" });
    } finally {
      setLoadingPreview(false);
    }
  };

  // Save Campaign (Approve & Activate OR Save Draft)
  const handleSaveCampaign = async (activate: boolean) => {
    if (activate && (!kbText.trim() || kbText.trim().length < 20)) {
      setBannerMessage({
        text: "Cannot activate campaign with empty product details. Minimum 20 characters required.",
        type: "error",
      });
      return;
    }

    const previousEnabled = isEnabled;
    if (activate) {
      setIsEnabled(true); // Optimistic activation
    }

    setSavingStatus(activate ? "ACTIVATING" : "SAVING_DRAFT");
    setBannerMessage(null);
    try {
      const resp = await fetch(API_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_campaign_kb",
          campaign_id: campaignId,
          campaign_kb_text: kbText,
          system_prompt: systemPrompt,
          enabled: activate,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setIsEnabled(Boolean(data.enabled));
        const successText = activate
          ? `Campaign ${campaignId} configuration saved & activated for hourly outreach`
          : `Campaign ${campaignId} draft saved successfully (remains inactive).`;
        setBannerMessage({
          text: successText,
          type: "success",
        });
        triggerToast(successText, "success");
      } else {
        setIsEnabled(previousEnabled);
        const errText = data.error || "Failed to update campaign in database.";
        setBannerMessage({ text: errText, type: "error" });
        triggerToast(errText, "error");
      }
    } catch (err) {
      console.error("Failed to save campaign", err);
      setIsEnabled(previousEnabled);
      const errText = "Error saving campaign to database.";
      setBannerMessage({ text: errText, type: "error" });
      triggerToast(errText, "error");
    } finally {
      setSavingStatus(null);
    }
  };

  const syncCursorPos = () => {
    if (!textareaRef.current) return;
    cursorPosRef.current = {
      start: textareaRef.current.selectionStart ?? kbText.length,
      end: textareaRef.current.selectionEnd ?? kbText.length,
    };
  };

  const insertVariable = (token: string) => {
    const variableText = `{{${token}}}`;
    const textarea = textareaRef.current;
    if (!textarea) {
      setKbText((prev) => (prev ? `${prev} ${variableText}` : variableText));
      return;
    }

    const start =
      document.activeElement === textarea
        ? textarea.selectionStart
        : (cursorPosRef.current?.start ?? textarea.selectionStart ?? textarea.value.length);
    const end =
      document.activeElement === textarea
        ? textarea.selectionEnd
        : (cursorPosRef.current?.end ?? textarea.selectionEnd ?? textarea.value.length);
    const current = textarea.value;

    const updated = current.substring(0, start) + variableText + current.substring(end);
    setKbText(updated);
    const nextPos = start + variableText.length;
    cursorPosRef.current = { start: nextPos, end: nextPos };

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  const activeInstantlyStatus = campaignOptions.find((o) => o.id === campaignId)?.instantlyStatus ?? null;
  const emailStatusInfo = getInstantlyStatusBadge(activeInstantlyStatus);
  const EMAIL_STATUS_CARD_CLASSES: Record<string, { card: string; dot: string }> = {
    emerald: {
      card: "bg-emerald-950/50 border-emerald-500/70 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]",
      dot: "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]",
    },
    amber: {
      card: "bg-amber-950/50 border-amber-500/70 text-amber-300",
      dot: "bg-amber-400",
    },
    blue: {
      card: "bg-blue-950/50 border-blue-500/70 text-blue-300",
      dot: "bg-blue-400",
    },
    red: {
      card: "bg-red-950/50 border-red-500/70 text-red-300",
      dot: "bg-red-400",
    },
    slate: {
      card: "bg-slate-950 border-slate-800 text-slate-400",
      dot: "bg-slate-600",
    },
  };
  const emailStatusClasses = EMAIL_STATUS_CARD_CLASSES[emailStatusInfo.color];

  const applyPreset = (presetKey: number) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setKbText(preset.text);
      setPreviewSource("draft");
      setBannerMessage({
        text: `Loaded copy preset for ${preset.label}`,
        type: "success",
      });
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl p-3.5 sm:p-5 md:p-6 font-sans border border-slate-800 shadow-2xl">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-5 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span className="bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-md text-xs font-black">SP</span>
            WhatsApp Campaign Sequence Studio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure authoritative product context, preview 3-touch AI sequences, and activate hourly Meta outreach
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/70 border border-emerald-800/80 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            n8n Production API Connected
          </div>
        </div>
      </div>

      {/* Confirmation / Alert Banner */}
      {bannerMessage && (
        <div
          className={`mb-5 p-3.5 border text-xs sm:text-sm rounded-xl flex justify-between items-center transition-all ${
            bannerMessage.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
              : "bg-rose-950/90 border-rose-500/50 text-rose-200"
          }`}
        >
          <span className="flex items-center gap-2">
            {bannerMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            )}
            {bannerMessage.text}
          </span>
          <button
            onClick={() => setBannerMessage(null)}
            className="hover:text-white font-bold ml-4 text-xs px-2 py-1 rounded bg-slate-900/40"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration Form */}
        <section className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              Campaign Configuration
            </h3>
            <button
              type="button"
              onClick={() => fetchCampaignConfig(campaignId)}
              disabled={isLoadingConfig}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 underline transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingConfig ? "animate-spin" : ""}`} />
              Reload DB
            </button>
          </div>

          {/* Campaign Selector (1–10) */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Select Campaign (1–10):
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
            >
              {campaignOptions.map((c) => {
                const statusLabel = c.instantlyStatus ? getInstantlyStatusBadge(c.instantlyStatus).label : null;
                return (
                  <option key={c.id} value={c.id}>
                    {`Campaign ${c.id} — ${c.alias || c.campaignName}${statusLabel ? ` (${statusLabel})` : ""}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Inline Campaign Alias / Rename */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Campaign Alias (assigned_lead):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveAlias();
                }}
                placeholder="e.g. Palki HR UK, Adnan $10..."
                className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 sm:py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleSaveAlias}
                disabled={savingAlias || !aliasInput.trim()}
                className="px-3 py-2 sm:py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-300 border border-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 shrink-0"
              >
                {savingAlias ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save Alias
              </button>
            </div>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-center">
            <div
              className={`p-2 sm:p-3 rounded-lg border transition-all duration-300 ${emailStatusClasses.card}`}
            >
              <div className="text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${emailStatusClasses.dot}`}></span>
                {emailStatusInfo.label.toUpperCase()}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Email Status</div>
            </div>
            <div className="p-2 sm:p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-xs sm:text-sm font-bold text-white">{enrichedLeads.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Enriched</div>
            </div>
            <div className="p-2 sm:p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-xs sm:text-sm font-bold text-white">{totalLeads.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Total Leads</div>
            </div>
          </div>

          {/* Quick Copy Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-slate-400">Quick Copy Presets:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset(9)}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded transition"
              >
                ⚖️ Legal (Camp 9)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(5)}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded transition"
              >
                ❄️ HVAC (Camp 5)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(1)}
                className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded transition"
              >
                🇦🇪 Dubai HR (Camp 1)
              </button>
            </div>
          </div>

          {/* Product Context / KB Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-400">
                Campaign Product Context &amp; Reference Templates:
              </label>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                kbText.length < 20
                  ? "text-amber-400 bg-amber-950/50 border-amber-800/50"
                  : kbText.length > 1024
                  ? "text-rose-400 bg-rose-950/50 border-rose-800/50"
                  : kbText.length >= 400
                  ? "text-amber-300 bg-amber-950/40 border-amber-700/50"
                  : "text-emerald-400 bg-emerald-950/40 border-emerald-800/50"
              }`}>
                {kbText.length} chars (min 20)
              </span>
            </div>
            <textarea
              ref={textareaRef}
              rows={8}
              value={kbText}
              onChange={(e) => {
                setKbText(e.target.value);
                if (previewSource === "ai") setPreviewSource("draft");
                syncCursorPos();
              }}
              onClick={syncCursorPos}
              onKeyUp={syncCursorPos}
              onSelect={syncCursorPos}
              placeholder="Paste product details or sequence reference templates with {{firstname}}, {{company name}}..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition leading-relaxed resize-y"
            />
            <p className="text-[11px] text-slate-400 italic mt-1.5">
              Do not include redundant &lsquo;Hi &#123;&#123;firstname&#125;&#125;&rsquo; if already starting the prompt with one.
            </p>
          </div>

          {/* Variable Insertion Chips */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">Click to insert dynamic variables:</span>
            <div className="flex flex-wrap gap-1.5">
              {["firstname", "company name", "designation", "industry"].map((v) => (
                <button
                  key={v}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertVariable(v)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 px-2 py-1 rounded transition active:scale-95"
                >
                  + &#123;&#123;{v}&#125;&#125;
                </button>
              ))}
            </div>
          </div>

          {/* Prospect Simulator */}
          <div className="border-t border-slate-800 pt-3 space-y-2">
            <span className="text-[11px] text-slate-400 font-medium block">
              Prospect Simulator Variables:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">First Name</label>
                <input
                  type="text"
                  placeholder="First Name"
                  value={simulator.first_name}
                  onChange={(e) => setSimulator({ ...simulator, first_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Company Name</label>
                <input
                  type="text"
                  placeholder="Company Name"
                  value={simulator.company_name}
                  onChange={(e) => setSimulator({ ...simulator, company_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Title / Designation</label>
                <input
                  type="text"
                  placeholder="Title / Designation"
                  value={simulator.designation}
                  onChange={(e) => setSimulator({ ...simulator, designation: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 block mb-0.5">Industry</label>
                <input
                  type="text"
                  placeholder="Industry"
                  value={simulator.industry}
                  onChange={(e) => setSimulator({ ...simulator, industry: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 px-2.5 py-1.5 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={loadingPreview}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
              >
                {loadingPreview ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                    ⚡ Generate Preview
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSaveCampaign(true)}
                disabled={savingStatus === "ACTIVATING"}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow"
              >
                {savingStatus === "ACTIVATING" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ✅ Approve &amp; Activate
                  </>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleSaveCampaign(false)}
              disabled={savingStatus === "SAVING_DRAFT"}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-3 rounded-lg text-xs border border-slate-700 transition flex items-center justify-center gap-1.5"
            >
              {savingStatus === "SAVING_DRAFT" ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 text-slate-400" />
                  💾 Save Draft Only (Keep Inactive)
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Column: Live 3-Touch WhatsApp Preview */}
        <section className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  Live 3-Touch WhatsApp Sequence Preview
                </h3>
                {previewSource === "ai" && !loadingPreview && !isLoadingConfig && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-700/60 text-emerald-300">
                    AI Preview
                  </span>
                )}
                {previewSource === "draft" && !loadingPreview && !isLoadingConfig && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-950/70 border border-sky-700/60 text-sky-300">
                    Draft Preview
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                Prospect: <strong className="text-emerald-400">{simulator.first_name || "Lead"}</strong> (
                {simulator.company_name || "Company"})
              </span>
            </div>

            {isLoadingConfig || loadingPreview ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {DEFAULT_STEP_META.map((meta) => (
                  <div
                    key={meta.step}
                    className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg min-h-[340px]"
                  >
                    <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded">
                        STEP {meta.step}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{meta.cadence}</span>
                    </div>
                    <div className="p-2.5 bg-slate-950 text-[10px] text-slate-500 border-b border-slate-800/60 min-h-[46px]">
                      {meta.objective}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between bg-[#0a1914]/50 animate-pulse">
                      <div className="bg-slate-900/70 rounded-xl p-3 space-y-2 border border-slate-800">
                        <div className="h-3 w-20 bg-slate-800 rounded"></div>
                        <div className="h-3 w-full bg-slate-800 rounded"></div>
                        <div className="h-3 w-11/12 bg-slate-800 rounded"></div>
                        <div className="h-3 w-4/5 bg-slate-800 rounded"></div>
                        <div className="h-3 w-2/3 bg-slate-800 rounded"></div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex justify-between">
                        <div className="h-3 w-16 bg-slate-800 rounded"></div>
                        <div className="h-3 w-20 bg-slate-800 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sequence.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {DEFAULT_STEP_META.map((meta) => (
                  <div
                    key={meta.step}
                    className="flex flex-col bg-slate-950 border border-slate-800/90 rounded-xl overflow-hidden shadow-lg min-h-[340px]"
                  >
                    <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center">
                      <span className="text-[11px] font-bold text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded">
                        STEP {meta.step}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{meta.cadence}</span>
                    </div>
                    <div className="p-2.5 bg-slate-950 text-[10px] text-slate-400 border-b border-slate-800/60 leading-relaxed min-h-[46px]">
                      {meta.objective}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between bg-[#0a1914]/30">
                      <div className="bg-slate-900/50 text-slate-400 rounded-xl p-3 text-xs leading-relaxed border border-dashed border-slate-800">
                        <div className="text-[11px] text-emerald-400/80 font-medium mb-1">
                          Hi {simulator.first_name || "there"}.
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Enter product context on the left (min 20 chars) or select a preset to preview Step {meta.step} for{" "}
                          <span className="text-slate-300">{simulator.company_name || "this prospect"}</span>.
                        </p>
                      </div>
                      <div className="mt-3 flex justify-between items-center text-[10px] pt-2 border-t border-slate-800/80">
                        <span className="font-mono text-slate-500">0 / 400 chars</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <ShieldCheck className="h-3 w-3" />
                          Awaiting Copy
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {sequence.map((step) => {
                  const firstName = simulator.first_name || "there";
                  const sanitizedBody = sanitizeBubbleBody(step.rendered_whatsapp_message || "", firstName);
                  const charCount = sanitizedBody.length;
                  const metaLimit = getMetaLimitBadge(charCount);

                  return (
                    <div
                      key={step.step}
                      className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg min-h-[340px]"
                    >
                      {/* Step Header */}
                      <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-[11px] font-bold text-sky-400 bg-sky-950/70 border border-sky-800/60 px-2 py-0.5 rounded">
                          STEP {step.step}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{step.cadence}</span>
                      </div>

                      {/* Step Objective */}
                      <div className="p-2.5 bg-slate-950 text-[10px] text-slate-400 border-b border-slate-800/60 leading-relaxed min-h-[46px] line-clamp-2">
                        {step.objective}
                      </div>

                      {/* WhatsApp Chat Bubble */}
                      <div className="p-3 flex-1 flex flex-col justify-between bg-[#0a1914]/50">
                        <div className="bg-[#0b4334] text-emerald-50 rounded-xl p-3 text-xs leading-relaxed shadow relative border border-emerald-800/40">
                          <div className="text-[11px] text-emerald-200/90 font-medium mb-1">
                            Hi {firstName}.
                          </div>
                          <p className="whitespace-pre-wrap">{sanitizedBody}</p>
                          <div className="text-[9px] text-emerald-300/80 text-right mt-2 flex items-center justify-end gap-1 font-mono">
                            <span>10:45 AM</span>
                            <span className="text-sky-400 font-bold">✓✓</span>
                          </div>
                        </div>

                        {/* Meta Compliance Badge */}
                        <div className="mt-3 flex justify-between items-center text-[10px] pt-2 border-t border-slate-800/80 gap-1">
                          <span className={`font-mono ${metaLimit.textClass}`}>
                            {charCount} chars
                          </span>
                          <span
                            className={`flex items-center gap-1 font-medium px-1.5 py-0.5 rounded border ${metaLimit.badgeClass}`}
                          >
                            <ShieldCheck className="h-3 w-3 shrink-0" />
                            {metaLimit.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Template: <code className="text-slate-400">customizable_template_scalepods|en</code></span>
            <span>Meta WhatsApp Cloud API</span>
          </div>
        </section>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 sm:max-w-md px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-medium transition-all animate-in fade-in slide-in-from-bottom-4 ${
            toastMessage.type === "success"
              ? "bg-emerald-950/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/60"
              : "bg-rose-950/95 border-rose-500/70 text-rose-100 shadow-rose-950/60"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
          <span className="flex-1">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white font-bold px-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

export default WhatsAppCampaignStudio;
