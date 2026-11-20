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

const API_WEBHOOK_URL = "https://n8n.srv1010832.hstgr.cloud/webhook/whatsapp-campaign-api";

export const CAMPAIGNS_METADATA = [
  { id: 1, name: "Campaign 1 — Dubai HR SaaS & Recruitment Automation", key: "scalepods_hr_dubai" },
  { id: 2, name: "Campaign 2 — US B2B Sales Pipeline & CRM Automation", key: "scalepods_b2b_us" },
  { id: 3, name: "Campaign 3 — UK Operational & Call Automation", key: "scalepods_ops_uk" },
  { id: 4, name: "Campaign 4 — Enterprise n8n Orchestration", key: "scalepods_enterprise_4" },
  { id: 5, name: "Campaign 5 — US Commercial HVAC Dispatch AI", key: "scalepods_hvac_us" },
  { id: 6, name: "Campaign 6 — Executive AI Consulting", key: "scalepods_advisory_6" },
  { id: 7, name: "Campaign 7 — Australian Property Care & Strata", key: "scalepods_property_au" },
  { id: 8, name: "Campaign 8 — Australian Retail & Logistics Inventory", key: "scalepods_retail_au" },
  { id: 9, name: "Campaign 9 — Australian Legal & Advisory Practice Automation", key: "scalepods_advisory_au" },
  { id: 10, name: "Campaign 10 — Australian Tech & Startup Scaleup", key: "scalepods_tech_au" },
];

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

export interface WhatsAppCampaignStudioProps {
  initialCampaignId?: number;
}

export function WhatsAppCampaignStudio({ initialCampaignId = 9 }: WhatsAppCampaignStudioProps) {
  const [campaignId, setCampaignId] = useState<number>(initialCampaignId);
  const [campaignName, setCampaignName] = useState<string>("ScalePods Internal Outreach 9");
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
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [savingStatus, setSavingStatus] = useState<"ACTIVATING" | "SAVING_DRAFT" | null>(null);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update campaignId if initialCampaignId changes externally
  useEffect(() => {
    if (initialCampaignId && initialCampaignId >= 1 && initialCampaignId <= 10) {
      setCampaignId(initialCampaignId);
    }
  }, [initialCampaignId]);

  // Load Campaign Config on campaignId change
  const fetchCampaignConfig = async (id: number) => {
    setIsLoadingConfig(true);
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
        setCampaignName(data.campaign.campaign_name || `Campaign ${id}`);
        setIsEnabled(Boolean(data.campaign.enabled));
        setKbText(data.campaign.knowledge_base || "");
        setSystemPrompt(data.campaign.system_prompt || "");
        setTotalLeads(data.campaign.total_leads || 0);
        setEnrichedLeads(data.campaign.enriched_leads || 0);
      }
    } catch (err) {
      console.error("Failed to load campaign config", err);
      setBannerMessage({ text: "Error connecting to campaign API.", type: "error" });
    } finally {
      setIsLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchCampaignConfig(campaignId);
  }, [campaignId]);

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
        setIsEnabled(data.enabled);
        setBannerMessage({
          text: activate
            ? `Campaign ${campaignId} APPROVED and ACTIVATED for live WhatsApp outreach!`
            : `Campaign ${campaignId} draft saved successfully (remains inactive).`,
          type: "success",
        });
      } else {
        setBannerMessage({ text: data.error || "Failed to update campaign in database.", type: "error" });
      }
    } catch (err) {
      console.error("Failed to save campaign", err);
      setBannerMessage({ text: "Error saving campaign to database.", type: "error" });
    } finally {
      setSavingStatus(null);
    }
  };

  const insertVariable = (token: string) => {
    const textToInsert = `{{${token}}}`;
    if (!textareaRef.current) {
      setKbText((prev) => (prev ? `${prev} ${textToInsert}` : textToInsert));
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const newText = text.substring(0, start) + textToInsert + text.substring(end);
    setKbText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const applyPreset = (presetKey: number) => {
    const preset = PRESETS[presetKey];
    if (preset) {
      setKbText(preset.text);
      setBannerMessage({
        text: `Loaded copy preset for ${preset.label}`,
        type: "success",
      });
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-2xl p-5 md:p-6 font-sans border border-slate-800 shadow-2xl">
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
              {CAMPAIGNS_METADATA.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div
              className={`p-3 rounded-lg border transition ${
                isEnabled
                  ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
                  : "bg-slate-950 border-slate-800 text-slate-400"
              }`}
            >
              <div className="text-sm font-bold flex items-center justify-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                  }`}
                ></span>
                {isEnabled ? "ACTIVE" : "INACTIVE"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">State</div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-sm font-bold text-white">{enrichedLeads.toLocaleString()}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">Enriched Leads</div>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
              <div className="text-sm font-bold text-white">{totalLeads.toLocaleString()}</div>
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
              <span className={`text-[10px] ${kbText.length >= 20 ? "text-emerald-400" : "text-amber-400"}`}>
                {kbText.length} chars (min 20)
              </span>
            </div>
            <textarea
              ref={textareaRef}
              rows={8}
              value={kbText}
              onChange={(e) => setKbText(e.target.value)}
              placeholder="Paste product details or sequence reference templates with {{firstname}}, {{company name}}..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 transition leading-relaxed resize-y"
            />
          </div>

          {/* Variable Insertion Chips */}
          <div>
            <span className="text-[11px] text-slate-400 block mb-1.5">Click to insert dynamic variables:</span>
            <div className="flex flex-wrap gap-1.5">
              {["firstname", "company name", "designation", "industry"].map((v) => (
                <button
                  key={v}
                  type="button"
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                Live 3-Touch WhatsApp Sequence Preview
              </h3>
              <span className="text-xs text-slate-400">
                Prospect: <strong className="text-emerald-400">{simulator.first_name || "Lead"}</strong> (
                {simulator.company_name || "Company"})
              </span>
            </div>

            {sequence.length === 0 ? (
              <div className="text-center py-24 px-4 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                <MessageSquare className="h-10 w-10 mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-400">No sequence generated yet.</p>
                <p className="text-xs mt-1 text-slate-500 max-w-sm mx-auto">
                  Click &ldquo;⚡ Generate Sequence Preview&rdquo; to simulate how OpenAI and Meta templates will render for this prospect.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {sequence.map((step) => (
                  <div
                    key={step.step}
                    className="flex flex-col bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg"
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
                          Hi {simulator.first_name || "there"}.
                        </div>
                        <p className="whitespace-pre-wrap">{step.rendered_whatsapp_message}</p>
                        <div className="text-[9px] text-emerald-300/80 text-right mt-2 flex items-center justify-end gap-1 font-mono">
                          <span>10:45 AM</span>
                          <span className="text-sky-400 font-bold">✓✓</span>
                        </div>
                      </div>

                      {/* Meta Compliance Badge */}
                      <div className="mt-3 flex justify-between items-center text-[10px] pt-2 border-t border-slate-800/80">
                        <span
                          className={`font-mono ${
                            step.character_count > 400 ? "text-amber-400 font-bold" : "text-slate-400"
                          }`}
                        >
                          {step.character_count} / 400 chars
                        </span>
                        <span
                          className={`flex items-center gap-1 font-medium ${
                            step.compliance_check.length_valid ? "text-emerald-400" : "text-amber-400"
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {step.compliance_check.length_valid ? "Meta Compliant" : "Exceeds Limit"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Template: <code className="text-slate-400">customizable_template_scalepods|en</code></span>
            <span>Meta WhatsApp Cloud API</span>
          </div>
        </section>
      </div>
    </div>
  );
}

export default WhatsAppCampaignStudio;
