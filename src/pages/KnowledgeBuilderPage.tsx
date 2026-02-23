import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { supabase } from "../lib/supabase";
import logger from "../lib/logger";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

interface BusinessProfile {
  industry_subtype: string | null;
  services: string[];
  client_types: string[];
  staff_count_range: string;
  licensing_bodies: string[];
  certifications_held: string[];
  years_in_operation: number | null;
  special_considerations: string[];
  has_existing_sops: boolean;
  pain_points: string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KnowledgeBuilderPage() {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  // State
  const [pageLoading, setPageLoading] = useState(true);
  const [status, setStatus] = useState<"in_progress" | "complete">("in_progress");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);

  // Refs
  const interviewIdRef = useRef<string | null>(null);
  const orgRef = useRef<{ industry_type: string; state: string; county: string | null } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasInitRef = useRef(false);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Load interview on mount
  useEffect(() => {
    if (!userProfile?.org_id || hasInitRef.current) return;
    hasInitRef.current = true;
    loadInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.org_id]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  async function fetchOrgContext() {
    if (orgRef.current) return orgRef.current;

    const { data, error: err } = await supabase
      .from("orgs")
      .select("industry_type, state, county")
      .eq("id", userProfile!.org_id)
      .single();

    if (err) throw err;

    orgRef.current = {
      industry_type: data.industry_type,
      state: data.state,
      county: data.county,
    };
    return orgRef.current;
  }

  function parseAIDisplay(content: string): string {
    try {
      return JSON.parse(content).message;
    } catch {
      return content;
    }
  }

  function extractProgress(msgs: ChatMessage[]) {
    const lastAi = [...msgs].reverse().find((m) => m.role === "assistant");
    if (!lastAi) return;
    try {
      const parsed = JSON.parse(lastAi.content);
      if (parsed.question_number && parsed.total_expected) {
        setProgress({ current: parsed.question_number, total: parsed.total_expected });
      }
    } catch {
      /* ignore */
    }
  }

  // ── Load existing interview ─────────────────────────────────────────────────

  async function loadInterview() {
    try {
      const orgId = userProfile!.org_id;
      logger.info("knowledge_load_start", { orgId });

      const { data, error: fetchError } = await supabase
        .from("knowledge_interviews")
        .select("id, status, messages, answers")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        interviewIdRef.current = data.id;
        const msgs = (data.messages ?? []) as ChatMessage[];
        setMessages(msgs);
        extractProgress(msgs);

        if (data.status === "complete") {
          setStatus("complete");
          setProfile(data.answers as BusinessProfile);
          setPageLoading(false);
          logger.info("knowledge_load_complete", { interviewId: data.id });
          return;
        }

        // In progress — resume
        setPageLoading(false);
        if (msgs.length === 0) {
          await fireAICall([]);
        }
        return;
      }

      // No row — create one and fire first call
      const { data: newRow, error: insertError } = await supabase
        .from("knowledge_interviews")
        .insert({ org_id: orgId, status: "in_progress", messages: [] })
        .select("id")
        .single();

      if (insertError) throw insertError;

      interviewIdRef.current = newRow.id;
      logger.info("knowledge_interview_created", { interviewId: newRow.id });
      setPageLoading(false);
      await fireAICall([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("knowledge_load_error", { message: msg });
      setError(msg);
      setPageLoading(false);
    }
  }

  // ── AI call ─────────────────────────────────────────────────────────────────

  async function fireAICall(currentMessages: ChatMessage[]) {
    setSending(true);
    setError("");

    try {
      const org = await fetchOrgContext();

      const { data: fnData, error: fnError } = await supabase.functions.invoke(
        "ai-gateway",
        {
          body: {
            action: "knowledge-interview",
            payload: {
              industry_type: org.industry_type,
              state: org.state,
              county: org.county,
              messages: currentMessages,
            },
          },
        },
      );

      if (fnError) throw fnError;
      if (!fnData?.success)
        throw new Error(fnData?.error ?? "Unknown error from AI gateway");

      const response = fnData.data;
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: JSON.stringify(response),
      };
      const updatedMessages = [...currentMessages, aiMessage];

      setMessages(updatedMessages);
      setProgress({
        current: response.question_number,
        total: response.total_expected,
      });

      if (response.done) {
        // Interview complete
        setProfile(response.profile);
        setStatus("complete");

        await supabase
          .from("knowledge_interviews")
          .update({
            messages: updatedMessages,
            answers: response.profile,
            status: "complete",
            updated_at: new Date().toISOString(),
          })
          .eq("id", interviewIdRef.current);

        logger.info("knowledge_interview_complete", {
          interviewId: interviewIdRef.current,
        });
        showToast("Interview complete!", "success");
      } else {
        // Save progress
        await supabase
          .from("knowledge_interviews")
          .update({
            messages: updatedMessages,
            updated_at: new Date().toISOString(),
          })
          .eq("id", interviewIdRef.current);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("knowledge_ai_error", { message: msg });
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSending(false);
    }
  }

  // ── Send user message ───────────────────────────────────────────────────────

  async function handleSend() {
    const text = inputText.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInputText("");

    await fireAICall(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Start over ──────────────────────────────────────────────────────────────

  async function handleStartOver() {
    if (!interviewIdRef.current) return;

    try {
      await supabase
        .from("knowledge_interviews")
        .update({
          status: "in_progress",
          messages: [],
          answers: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", interviewIdRef.current);

      setStatus("in_progress");
      setMessages([]);
      setProgress(null);
      setProfile(null);
      setError("");

      logger.info("knowledge_interview_restart", {
        interviewId: interviewIdRef.current,
      });
      await fireAICall([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg, "error");
    }
  }

  // ── Render: Loading ─────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Knowledge Base</h1>
        <p className="mt-10 text-center text-sm text-text-muted">Loading...</p>
      </div>
    );
  }

  // ── Render: Complete ────────────────────────────────────────────────────────

  if (status === "complete" && profile) {
    return (
      <div>
        <h1 className="font-display text-2xl font-600">Knowledge Base</h1>
        <p className="mt-1 text-sm text-text-muted">
          Your business profile interview is complete.
        </p>

        <div className="mt-6 max-w-[600px]">
          {/* Success banner */}
          <div className="flex items-center gap-3 rounded-sm bg-accent-light px-4 py-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs text-white">
              &#10003;
            </span>
            <p className="text-sm font-500 text-accent">Interview Complete</p>
          </div>

          {/* Profile card */}
          <div className="mt-4 rounded border border-card-border bg-card p-6 shadow">
            <h2 className="mb-4 text-sm font-600 text-text">
              Business Profile Summary
            </h2>
            <dl className="space-y-3 text-sm">
              {profile.industry_subtype && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-text-muted">Specialization</dt>
                  <dd className="text-right font-500 text-text">
                    {profile.industry_subtype}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Services</dt>
                <dd className="text-right font-500 text-text">
                  {profile.services.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Client Types</dt>
                <dd className="text-right font-500 text-text">
                  {profile.client_types.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Staff Size</dt>
                <dd className="text-right font-500 text-text">
                  {profile.staff_count_range}
                </dd>
              </div>
              {profile.years_in_operation !== null && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-text-muted">
                    Years in Operation
                  </dt>
                  <dd className="text-right font-500 text-text">
                    {profile.years_in_operation}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Licensing Bodies</dt>
                <dd className="text-right font-500 text-text">
                  {profile.licensing_bodies.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Certifications</dt>
                <dd className="text-right font-500 text-text">
                  {profile.certifications_held.join(", ") || "—"}
                </dd>
              </div>
              {profile.special_considerations.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-text-muted">
                    Special Considerations
                  </dt>
                  <dd className="text-right font-500 text-text">
                    {profile.special_considerations.join(", ")}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-text-muted">Existing SOPs</dt>
                <dd className="text-right font-500 text-text">
                  {profile.has_existing_sops ? "Yes" : "No"}
                </dd>
              </div>
              {profile.pain_points.length > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-text-muted">Pain Points</dt>
                  <dd className="text-right font-500 text-text">
                    {profile.pain_points.join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-sm border border-card-border bg-card px-5 py-2 text-sm font-500 text-text-muted transition-colors hover:text-text"
            >
              Start Over
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-sm bg-primary px-5 py-2 text-sm font-600 text-white opacity-50"
            >
              Continue to Document Checklist &rarr;
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Chat (in_progress) ──────────────────────────────────────────────

  const progressPercent = progress
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 120px)" }}
    >
      {/* Header + progress */}
      <div>
        <h1 className="font-display text-2xl font-600">Knowledge Base</h1>
        <p className="mt-1 text-sm text-text-muted">
          Tell us about your business so we can build your compliance checklist.
        </p>
        {progress && (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
              <span>
                Question {progress.current} of {progress.total}
              </span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  background:
                    "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-sm px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "border border-card-border bg-card text-text"
              }`}
            >
              {msg.role === "assistant"
                ? parseAIDisplay(msg.content)
                : msg.content}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-sm border border-card-border bg-card px-4 py-3">
              <span
                className="typing-dot h-2 w-2 rounded-full bg-text-muted"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="typing-dot h-2 w-2 rounded-full bg-text-muted"
                style={{ animationDelay: "200ms" }}
              />
              <span
                className="typing-dot h-2 w-2 rounded-full bg-text-muted"
                style={{ animationDelay: "400ms" }}
              />
            </div>
          </div>
        )}

        {/* Error retry */}
        {error && !sending && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => fireAICall(messages)}
              className="rounded-sm bg-warn-light px-4 py-3 text-sm text-warn transition-colors hover:bg-warn-light/80"
            >
              Something went wrong. Tap to retry.
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 border-t border-card-border pt-4">
        <div className="flex gap-3">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            rows={1}
            className="flex-1 resize-none rounded-sm border border-card-border bg-card px-3 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            placeholder="Type your answer..."
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="shrink-0 rounded-sm bg-primary px-5 py-2.5 text-sm font-600 text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
