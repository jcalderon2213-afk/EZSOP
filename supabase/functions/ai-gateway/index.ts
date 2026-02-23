import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    if (!action) {
      return jsonResponse({ success: false, error: "Missing action" }, 400);
    }

    const client = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    switch (action) {
      case "recommend-sops": {
        const { industry_type, state, county, governing_bodies } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            { success: false, error: "Missing required fields: industry_type, state" },
            400,
          );
        }

        const gbList =
          Array.isArray(governing_bodies) && governing_bodies.length > 0
            ? governing_bodies.map((gb: { name: string; level: string }) => `${gb.name} (${gb.level})`).join(", ")
            : "None specified";

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const userPrompt = `Generate 8-12 recommended Standard Operating Procedures for the following business:

Industry: ${industry_type}
Location: ${locationParts.join(", ")}
Governing bodies: ${gbList}

Return a JSON array of objects with these fields:
- "title": short SOP title
- "category": category grouping (e.g. "Health & Safety", "Administration", "Training", "Emergency", "Compliance")
- "description": one sentence explaining why this SOP matters for this business
- "sort_order": integer starting at 1`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: "You are a regulatory compliance expert specializing in Standard Operating Procedures for care facilities, healthcare providers, and related industries. Consider the specific industry type, geographic location, and governing bodies when recommending SOPs. Return ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let recommendations;
        try {
          recommendations = JSON.parse(text);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({ success: true, data: { recommendations } });
      }

      case "generate-sop-steps": {
        const { transcript, context_links, regulation_text, sop_title } = payload ?? {};

        if (!transcript) {
          return jsonResponse(
            { success: false, error: "Missing required field: transcript" },
            400,
          );
        }

        let contextSection = "";
        if (Array.isArray(context_links) && context_links.length > 0) {
          const linkLines = context_links
            .map((l: { url: string; label: string }) => `- ${l.label}: ${l.url}`)
            .join("\n");
          contextSection = `\n\nReference links:\n${linkLines}`;
        }

        let regulationSection = "";
        if (regulation_text) {
          regulationSection = `\n\nRelevant regulation text:\n${regulation_text}`;
        }

        const userPrompt = `Generate structured SOP steps for the following process:

SOP Title: ${sop_title || "Untitled SOP"}

Process description (from user):
${transcript}${contextSection}${regulationSection}

Break this process into clear, numbered steps. Return a JSON array of objects with these fields:
- "step_number": integer starting at 1
- "title": concise step title (imperative verb, e.g. "Verify patient identity")
- "description": detailed description of what to do in this step (2-4 sentences)`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: "You are an SOP writing expert. Break the described process into clear, actionable, numbered steps. Each step should have a concise title and a detailed description. Keep steps specific and actionable. Use the provided context and regulations to inform the steps, but focus primarily on the user's described process. Return ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let steps;
        try {
          steps = JSON.parse(text);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({ success: true, data: { steps } });
      }

      case "compliance-check": {
        const { sop_title, steps: sopSteps, industry_type, state, governing_bodies } = payload ?? {};

        if (!sopSteps || !Array.isArray(sopSteps) || sopSteps.length === 0) {
          return jsonResponse(
            { success: false, error: "Missing required field: steps (array of SOP steps)" },
            400,
          );
        }

        const stepsText = sopSteps
          .map((s: { step_number: number; title: string; description: string }) =>
            `Step ${s.step_number}: ${s.title}\n${s.description || "No description"}`)
          .join("\n\n");

        let contextInfo = "";
        if (industry_type) contextInfo += `\nIndustry: ${industry_type}`;
        if (state) contextInfo += `\nLocation: ${state}`;
        if (Array.isArray(governing_bodies) && governing_bodies.length > 0) {
          const gbList = governing_bodies
            .map((gb: { name: string; level: string }) => `${gb.name} (${gb.level})`)
            .join(", ");
          contextInfo += `\nGoverning bodies: ${gbList}`;
        }

        const userPrompt = `Review the following SOP for regulatory compliance issues, safety gaps, and best-practice violations:

SOP Title: ${sop_title || "Untitled SOP"}
${contextInfo ? `\nBusiness context:${contextInfo}` : ""}

SOP Steps:
${stepsText}

Identify compliance findings — gaps, risks, or areas that need improvement. For each finding, specify severity and which step it relates to (or null if it's a general issue). Return a JSON array of objects with these fields:
- "finding_id": integer starting at 1
- "severity": "high" | "medium" | "low"
- "title": short description of the issue (1 sentence)
- "description": detailed explanation of why this is a compliance concern (2-3 sentences)
- "related_step": step number (integer) or null if general
- "recommendation": what the user should do to address this (1-2 sentences)`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system: "You are a regulatory compliance auditor specializing in Standard Operating Procedures for care facilities, healthcare providers, and related industries. Review SOPs against industry regulations, safety standards, and best practices. Identify gaps, risks, and areas needing improvement. Be thorough but practical — focus on findings that matter. Return ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let findings;
        try {
          findings = JSON.parse(text);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({ success: true, data: { findings } });
      }

      case "knowledge-interview": {
        const { industry_type, state, county, messages: chatHistory } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            { success: false, error: "Missing required fields: industry_type, state" },
            400,
          );
        }

        // Build the opening user message with business context
        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const openingMessage = `I run a ${industry_type} in ${locationParts.join(", ")}. Please start the interview.`;

        // Construct the full messages array: opening context + conversation history
        const apiMessages: Array<{ role: "user" | "assistant"; content: string }> = [
          { role: "user", content: openingMessage },
        ];

        if (Array.isArray(chatHistory) && chatHistory.length > 0) {
          for (const msg of chatHistory) {
            apiMessages.push({
              role: msg.role as "user" | "assistant",
              content: msg.content,
            });
          }
        }

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3072,
          system: `You are an expert business compliance consultant conducting an intake interview. Your goal is to learn enough about the user's business to later generate a personalized checklist of compliance documents, licenses, certifications, and regulatory resources they need to collect.

Ask 5–10 questions, ONE at a time. Adapt your questions to the specific industry type and to previous answers. Be conversational, warm, and encouraging — this replaces a boring onboarding form. Do NOT ask for the business name (we already have it). Do NOT ask about operating hours.

Focus your questions on topics that help generate a compliance document checklist:
- Services offered and client/customer types served
- Staff size and key roles
- Known regulatory or licensing bodies they report to
- Certifications or licenses already held
- Compliance challenges or pain points they experience
- Years in operation
- Special operational details (capacity, unique features, accommodations)

Skip topics the user has already answered naturally. If an answer is vague, ask one brief follow-up before moving on. Never ask more than 10 questions total.

RESPONSE FORMAT — return ONLY a valid JSON object. No markdown fences, no commentary outside the JSON.

While interviewing:
{
  "message": "Your conversational question text",
  "question_number": <int>,
  "total_expected": <int>,
  "topic": "<category_tag>",
  "done": false
}

When the interview is complete:
{
  "message": "A friendly wrap-up summarizing what you learned",
  "question_number": <int>,
  "total_expected": <int>,
  "topic": "complete",
  "done": true,
  "profile": {
    "industry_subtype": "<string or null>",
    "services": ["<string>"],
    "client_types": ["<string>"],
    "staff_count_range": "1-5" | "6-15" | "16-50" | "50+",
    "licensing_bodies": ["<string>"],
    "certifications_held": ["<string>"],
    "years_in_operation": <number or null>,
    "special_considerations": ["<string>"],
    "has_existing_sops": <boolean>,
    "pain_points": ["<string>"]
  }
}

Adjust total_expected as the conversation progresses. The profile must synthesize ALL information gathered throughout the entire interview.`,
          messages: apiMessages,
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let interview;
        try {
          interview = JSON.parse(text);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({ success: true, data: interview });
      }

      case "generate-knowledge-checklist": {
        const { industry_type, state, county, profile } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            { success: false, error: "Missing required fields: industry_type, state" },
            400,
          );
        }

        if (!profile || typeof profile !== "object" || !Array.isArray(profile.services)) {
          return jsonResponse(
            { success: false, error: "Missing required field: profile (with services array)" },
            400,
          );
        }

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const userPrompt = `Generate a compliance knowledge base checklist for the following business:

Industry: ${industry_type}
Specialization: ${profile.industry_subtype || "General"}
Location: ${locationParts.join(", ")}

Services: ${profile.services.join(", ") || "Not specified"}
Client types: ${profile.client_types?.join(", ") || "Not specified"}
Staff size: ${profile.staff_count_range || "Not specified"}
Years in operation: ${profile.years_in_operation ?? "Not specified"}
Known licensing bodies: ${profile.licensing_bodies?.join(", ") || "None specified"}
Certifications held: ${profile.certifications_held?.join(", ") || "None"}
Special considerations: ${profile.special_considerations?.join(", ") || "None"}
Has existing SOPs: ${profile.has_existing_sops ? "Yes" : "No"}
Pain points: ${profile.pain_points?.join(", ") || "None reported"}

Return a JSON object with this shape:
{
  "checklist": [
    {
      "id": "kb-001",
      "title": "Document or regulation title",
      "description": "Why they need this (1-2 sentences)",
      "type": "LINK" | "PDF" | "DOCUMENT" | "OTHER",
      "priority": "REQUIRED" | "RECOMMENDED" | "OPTIONAL",
      "suggested_source": "https://..." or null
    }
  ],
  "governing_bodies": [
    { "name": "Body name", "level": "federal" | "state" | "county" | "local" }
  ]
}`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3072,
          system: `You are a regulatory compliance research specialist. Generate a personalized checklist of documents, regulations, licenses, certifications, and reference materials that a business needs to collect for their compliance knowledge base.

Base your recommendations on the specific industry type, geographic location (state and county regulations matter), and the detailed business profile provided. Be specific — reference actual regulation names, administrative rule codes, and licensing requirements where applicable.

For each checklist item:
- Use specific, real document/regulation titles (e.g. "Oregon Administrative Rules 411-050" not "state licensing rules")
- Include a suggested_source URL when you are confident it exists (government .gov sites, official regulatory body sites). Set to null if unsure — do NOT fabricate URLs.
- Categorize the type: LINK (web resource), PDF (downloadable document), DOCUMENT (template/form the user needs to create), OTHER
- Set priority: REQUIRED (legally mandated for this business), RECOMMENDED (industry best practice), OPTIONAL (helpful but not critical)

Personalization rules:
- If services include medication administration → include medication management protocols and training requirements
- If they have employees → include employment law resources, worker safety, HR documentation
- If specific licensing_bodies are mentioned → include their specific regulatory documents
- If pain_points mention specific challenges → include resources addressing them
- If certifications_held lists existing certs → do NOT recommend obtaining those, but include renewal/continuing education resources if relevant
- If special_considerations mention specific features → include relevant specialized regulations
- Always include the primary regulatory source for the industry + state
- Always include applicable federal requirements (OSHA, ADA, etc.)

Generate 8–15 checklist items. Order by priority: REQUIRED first, then RECOMMENDED, then OPTIONAL. Use sequential IDs: "kb-001", "kb-002", etc.

Also generate a governing_bodies array listing all regulatory bodies relevant to this business at federal, state, county, and local levels.

Return ONLY a valid JSON object. No markdown code fences, no commentary, no explanation — just the raw JSON object.`,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let result;
        try {
          result = JSON.parse(text);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({
          success: true,
          data: {
            checklist: result.checklist,
            governing_bodies: result.governing_bodies,
          },
        });
      }

      case "ingest-knowledge": {
        const { profile: kbProfile, items: kbItems } = payload ?? {};

        if (!kbProfile || typeof kbProfile !== "object" || !Array.isArray(kbProfile.services)) {
          return jsonResponse(
            { success: false, error: "Missing required field: profile (with services array)" },
            400,
          );
        }

        if (!Array.isArray(kbItems) || kbItems.length === 0) {
          return jsonResponse(
            { success: false, error: "Missing required field: items (non-empty array of provided items)" },
            400,
          );
        }

        // Build the collected items list
        const itemLines = kbItems.map(
          (item: {
            title: string;
            description: string;
            type: string;
            provided_url: string | null;
            provided_file: string | null;
            provided_text: string | null;
          }, idx: number) => {
            const parts = [`${idx + 1}. ${item.title} (${item.type})`];
            if (item.description) parts.push(`   Description: ${item.description}`);
            if (item.provided_url) parts.push(`   URL: ${item.provided_url}`);
            if (item.provided_file) parts.push(`   File: ${item.provided_file}`);
            if (item.provided_text) parts.push(`   Content: ${item.provided_text}`);
            return parts.join("\n");
          },
        ).join("\n\n");

        const kbUserPrompt = `Synthesize the following business profile and collected compliance documents into a knowledge summary:

BUSINESS PROFILE:
Industry: ${kbProfile.industry_subtype || "General"}
Services: ${kbProfile.services?.join(", ") || "Not specified"}
Client types: ${kbProfile.client_types?.join(", ") || "Not specified"}
Staff size: ${kbProfile.staff_count_range || "Not specified"}
Years in operation: ${kbProfile.years_in_operation ?? "Not specified"}
Licensing bodies: ${kbProfile.licensing_bodies?.join(", ") || "None specified"}
Certifications held: ${kbProfile.certifications_held?.join(", ") || "None"}
Special considerations: ${kbProfile.special_considerations?.join(", ") || "None"}
Has existing SOPs: ${kbProfile.has_existing_sops ? "Yes" : "No"}
Pain points: ${kbProfile.pain_points?.join(", ") || "None reported"}

COLLECTED DOCUMENTS AND RESOURCES (${kbItems.length} items):
${itemLines}`;

        const kbMessage = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: `You are a compliance knowledge synthesizer. Your job is to distill a business's compliance profile and collected documents/resources into a structured knowledge summary. This summary will be injected as context into future SOP generation and compliance audit calls, so it must be factual and specific — not generic advice.

The summary should be:
- Comprehensive but concise (1000–2000 words)
- Organized by topic area with markdown ## headers
- Written in third person about the business
- Focused on actionable compliance facts specific to THIS business

Organize into these sections (skip any with no relevant information):
1. Business Overview — industry, location, services, client types, staff size
2. Regulatory Framework — applicable regulations, licensing bodies, administrative codes
3. Licensing & Certifications — current licenses, renewal requirements
4. Staffing & Training Requirements — mandated training, staff certifications
5. Operational Requirements — facility standards, record-keeping, reporting obligations
6. Health & Safety — OSHA, infection control, medication management, emergency protocols
7. Client Rights & Privacy — HIPAA, ADA, client rights regulations
8. Known Gaps & Pain Points — challenges the business has identified

Also return a learned_topics array of specific tag-style topic labels covered (e.g. "Oregon AFH Licensing", "Medication Administration Training", "OSHA Compliance"). Aim for 4–10 topics.

Return ONLY a valid JSON object. No markdown code fences, no commentary, no explanation — just the raw JSON object.
{
  "knowledge_summary": "Full structured summary with markdown ## headers",
  "learned_topics": ["Topic 1", "Topic 2"]
}`,
          messages: [{ role: "user", content: kbUserPrompt }],
        });

        const kbText =
          kbMessage.content[0].type === "text" ? kbMessage.content[0].text : "";

        let kbResult;
        try {
          kbResult = JSON.parse(kbText);
        } catch {
          return jsonResponse(
            { success: false, error: "Failed to parse AI response as JSON" },
            500,
          );
        }

        return jsonResponse({
          success: true,
          data: {
            knowledge_summary: kbResult.knowledge_summary,
            learned_topics: kbResult.learned_topics,
          },
        });
      }

      case "test": {
        const prompt = payload?.prompt || "Say hello";

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: "You are a helpful assistant. Keep responses concise.",
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        return jsonResponse({ success: true, data: { response: text } });
      }

      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
