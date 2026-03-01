import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Create a Supabase client with service role key (bypasses RLS)
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/**
 * Fetch relevant knowledge items from the database.
 * If categories are provided, filters to those categories.
 * Returns formatted text block for injection into prompts.
 */
async function fetchKnowledgeContext(
  orgId: string,
  categories?: string[],
  maxItems = 30,
): Promise<string> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("knowledge_items")
    .select("title, description, category, level, priority, provided_text, provided_url")
    .eq("org_id", orgId)
    .eq("status", "learned")
    .order("priority", { ascending: true })
    .limit(maxItems);

  if (categories && categories.length > 0) {
    query = query.in("category", categories);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return "";
  }

  const lines = data.map(
    (item: {
      title: string;
      description: string | null;
      category: string | null;
      level: string | null;
      priority: string | null;
      provided_text: string | null;
      provided_url: string | null;
    }) => {
      const parts: string[] = [];
      parts.push(`### ${item.title}`);
      if (item.category) parts.push(`Category: ${item.category}`);
      if (item.level) parts.push(`Level: ${item.level}`);
      if (item.priority) parts.push(`Priority: ${item.priority}`);
      if (item.description) parts.push(`Description: ${item.description}`);
      if (item.provided_url) parts.push(`Source: ${item.provided_url}`);
      // Include content but truncate to keep prompt size manageable
      if (item.provided_text) {
        const truncated =
          item.provided_text.length > 1500
            ? item.provided_text.slice(0, 1500) + "\n[...truncated]"
            : item.provided_text;
        parts.push(`Content:\n${truncated}`);
      }
      return parts.join("\n");
    },
  );

  return lines.join("\n\n---\n\n");
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
        const {
          org_id,
          industry_type,
          state,
          county,
          governing_bodies,
          knowledge_context,
        } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required fields: industry_type, state",
            },
            400,
          );
        }

        const gbList =
          Array.isArray(governing_bodies) && governing_bodies.length > 0
            ? governing_bodies
                .map(
                  (gb: { name: string; level: string }) =>
                    `${gb.name} (${gb.level})`,
                )
                .join(", ")
            : "None specified";

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        // Auto-fetch knowledge context from DB if org_id is provided
        let knowledgeBlock = "";
        if (org_id) {
          const dbKnowledge = await fetchKnowledgeContext(org_id, [
            "rules-and-policies",
            "documentation",
            "forms",
          ]);
          if (dbKnowledge) {
            knowledgeBlock = `\n\nOregon AFH Compliance Knowledge Base (use this to personalize recommendations with REAL regulations and forms):\n${dbKnowledge}`;
          }
        }
        // Fall back to frontend-provided context
        if (!knowledgeBlock && knowledge_context) {
          knowledgeBlock = `\n\nBusiness Knowledge Base (use this to personalize recommendations):\n${knowledge_context}`;
        }

        const userPrompt = `Generate 8-12 recommended Standard Operating Procedures for the following business:

Industry: ${industry_type}
Location: ${locationParts.join(", ")}
Governing bodies: ${gbList}${knowledgeBlock}

Return a JSON array of objects with these fields:
- "title": short SOP title
- "category": category grouping (e.g. "Health & Safety", "Administration", "Training", "Emergency", "Compliance")
- "description": one sentence explaining why this SOP matters for this business
- "sort_order": integer starting at 1`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system:
            "You are a regulatory compliance expert specializing in Standard Operating Procedures for Oregon Adult Foster Homes and related care facilities. You have access to the actual Oregon Administrative Rules (OAR 411-049 through 411-052) and official DHS forms. Use specific regulation citations and real form numbers in your recommendations. Return ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let recommendations;
        try {
          recommendations = JSON.parse(text);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        return jsonResponse({ success: true, data: { recommendations } });
      }

      case "generate-sop-steps": {
        const {
          org_id,
          transcript,
          context_links,
          regulation_text,
          sop_title,
          sop_category,
          knowledge_context,
          is_day_in_life,
        } = payload ?? {};

        if (!transcript) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: transcript",
            },
            400,
          );
        }

        let contextSection = "";
        if (Array.isArray(context_links) && context_links.length > 0) {
          const linkLines = context_links
            .map(
              (l: { url: string; label: string }) => `- ${l.label}: ${l.url}`,
            )
            .join("\n");
          contextSection = `\n\nReference links:\n${linkLines}`;
        }

        let regulationSection = "";
        if (regulation_text) {
          regulationSection = `\n\nRelevant regulation text:\n${regulation_text}`;
        }

        // Auto-fetch knowledge context from DB
        let knowledgeBlock = "";
        if (org_id) {
          // Pick categories relevant to the SOP being generated
          const relevantCategories = getCategoriesForSop(sop_category || sop_title || "");
          const dbKnowledge = await fetchKnowledgeContext(
            org_id,
            relevantCategories,
            20,
          );
          if (dbKnowledge) {
            knowledgeBlock = `\n\nOregon AFH Compliance Knowledge Base (reference these REAL regulations, forms, and procedures):\n${dbKnowledge}`;
          }
        }
        if (!knowledgeBlock && knowledge_context) {
          knowledgeBlock = `\n\nBusiness knowledge base:\n${knowledge_context}`;
        }

        let dayInLifeInstruction = "";
        if (is_day_in_life) {
          dayInLifeInstruction = `\n\nIMPORTANT — "Day in the Life" mode: This SOP should document a COMPLETE daily routine at an Oregon Adult Foster Home, organized chronologically from morning to night. Structure the steps as time-based phases (e.g. "Morning Routine", "Medication Administration", "Meal Preparation", "Afternoon Activities", "Evening Wind-Down", "Overnight Procedures"). Each step should cover what happens during that phase. Include regulatory touchpoints naturally within each phase (medication logs, incident documentation, meal planning, etc.).`;
        }

        const userPrompt = `Generate structured SOP steps for the following process:

SOP Title: ${sop_title || "Untitled SOP"}

Process description (from user):
${transcript}${contextSection}${regulationSection}${knowledgeBlock}${dayInLifeInstruction}

Break this process into clear, numbered steps. Reference specific Oregon AFH forms (e.g. APD 0344, APD 0812A) and OAR citations where applicable. Return a JSON array of objects with these fields:
- "step_number": integer starting at 1
- "title": concise step title (imperative verb, e.g. "Verify patient identity")
- "description": a SINGLE STRING (not an array!) containing 3-6 bullet points separated by newline characters. Each bullet starts with "• ". Example value: "• Verify the resident's identity using two identifiers\\n• Document verification on APD 0344\\n• File completed form in the resident's record". IMPORTANT: this must be one string with \\n between bullets, NOT a JSON array of strings.
- "resources": an array of links, forms, documents, or regulations referenced in this step. For each resource: { "type": "url" | "form" | "doc", "label": "Human-readable name (e.g. APD 0411 — Background Check Request)", "url": "https://..." or "" if unknown }. Use type "url" for websites, "form" for forms/applications, "doc" for regulations/documents/guides. If no resources apply to a step, return an empty array [].`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system:
            "You are an SOP writing expert for Oregon Adult Foster Homes. You know the Oregon Administrative Rules (OAR 411-049 through 411-052), official DHS/APD forms, and AFH operational best practices. Break the described process into clear, actionable, numbered steps. Reference specific form numbers (APD 0344, APD 0812A, etc.) and OAR sections where applicable.\n\nFor each step's \"description\": return a SINGLE STRING (not a JSON array!) containing 3-6 bullet points. Each bullet starts with \"• \" and bullets are separated by \"\\n\" (newline characters inside the string). Each bullet is one short actionable line — no paragraphs, no filler. Focus on WHAT to do, not explaining why.\n\nFor each step's \"resources\": scan the user's transcript AND the regulatory/knowledge context for any mentions of websites, URLs, forms (like APD forms), documents, OAR references, or tools. Extract each one as a resource object with type (\"url\" for websites, \"form\" for forms/applications, \"doc\" for regulations/documents/guides), label, and url (empty string if unknown). If none detected for a step, return an empty array [].\n\nReturn ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let steps;
        try {
          steps = JSON.parse(text);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        // Safety: if AI returned description as an array, join into a string
        if (Array.isArray(steps)) {
          for (const step of steps) {
            if (Array.isArray(step.description)) {
              step.description = step.description.join("\n");
            }
          }
        }

        return jsonResponse({ success: true, data: { steps } });
      }

      case "generate-guided-questions": {
        const {
          org_id: guidedOrgId,
          sop_title: guidedTitle,
          sop_category: guidedCategory,
          is_day_in_life: guidedDayInLife,
        } = payload ?? {};

        if (!guidedTitle) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: sop_title",
            },
            400,
          );
        }

        // Fetch knowledge context for regulatory-aware questions
        let guidedKnowledge = "";
        if (guidedOrgId) {
          const relevantCategories = getCategoriesForSop(
            guidedCategory || guidedTitle || "",
          );
          const dbKnowledge = await fetchKnowledgeContext(
            guidedOrgId,
            relevantCategories,
            20,
          );
          if (dbKnowledge) {
            guidedKnowledge = `\n\nOregon AFH Regulatory Context (reference real forms, OAR sections, and requirements in your questions):\n${dbKnowledge}`;
          }
        }

        let guidedUserPrompt: string;
        let guidedSystemPrompt: string;

        if (guidedDayInLife) {
          guidedUserPrompt = `Generate interview questions to document a typical day at an Oregon Adult Foster Home.${guidedKnowledge}`;
          guidedSystemPrompt = `You are an SOP interview expert for Oregon Adult Foster Homes. Your job is to ask 5-6 practical multiple-choice questions that capture a complete "Day in the Life" daily routine at an AFH.

Each question should have 3-4 realistic answer choices specific to AFH daily operations. Do NOT include an "Other" option — the frontend handles that.

Your questions should walk through the day chronologically:
1. What time does the day typically start, and what's the first thing that happens? (e.g. wake-up routine, morning medications, breakfast prep)
2. How are medications managed throughout the day? (e.g. medication pass times, logging, storage)
3. What activities or care happen during the middle of the day? (e.g. meals, personal care, appointments, activities)
4. How do you handle documentation during the day? (e.g. daily logs, incident reports, medication records)
5. What does the evening and overnight routine look like? (e.g. dinner, evening meds, bedtime, overnight checks)
6. How do you handle unexpected situations? (e.g. falls, behavioral incidents, medical emergencies)

Use the provided regulatory context to make questions reference real Oregon forms and OAR sections where relevant.

Return ONLY a JSON object in this exact format, no markdown, no backticks:
{"questions":[{"id":1,"question":"...","answers":["...","...","..."]},{"id":2,"question":"...","answers":["...","...","..."]}]}`;
        } else {
          guidedUserPrompt = `Generate interview questions for this SOP: "${guidedTitle}"
Category: ${guidedCategory || "General"}${guidedKnowledge}`;
          guidedSystemPrompt = `You are an SOP interview expert for Oregon Adult Foster Homes. Your job is to ask 4-6 practical multiple-choice questions that will capture enough detail to build a complete standard operating procedure.

Each question should have 3-4 realistic answer choices specific to AFH operations. Do NOT include an "Other" option — the frontend handles that.

Your questions should cover these areas as relevant to the SOP topic:
- Who is responsible for this task?
- What triggers or starts this process?
- What are the key steps or actions involved?
- What gets documented or recorded?
- What happens if something goes wrong or there's an exception?

Use the provided regulatory context to make questions reference real Oregon forms, OAR sections, and AFH requirements where relevant.

Return ONLY a JSON object in this exact format, no markdown, no backticks:
{"questions":[{"id":1,"question":"...","answers":["...","...","..."]},{"id":2,"question":"...","answers":["...","...","..."]}]}`;
        }

        const guidedMessage = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: guidedSystemPrompt,
          messages: [{ role: "user", content: guidedUserPrompt }],
        });

        const guidedText =
          guidedMessage.content[0].type === "text"
            ? guidedMessage.content[0].text
            : "";

        let guidedResult;
        try {
          guidedResult = JSON.parse(guidedText);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        // Normalize: accept both { questions: [...] } and bare [...]
        const questions = Array.isArray(guidedResult)
          ? guidedResult
          : guidedResult.questions;

        if (!Array.isArray(questions)) {
          return jsonResponse(
            {
              success: false,
              error: "AI response did not contain a questions array",
            },
            500,
          );
        }

        return jsonResponse({ success: true, data: { questions } });
      }

      case "compliance-check": {
        const {
          org_id,
          sop_title,
          steps: sopSteps,
          industry_type,
          state,
          governing_bodies,
          knowledge_context,
        } = payload ?? {};

        if (!sopSteps || !Array.isArray(sopSteps) || sopSteps.length === 0) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: steps (array of SOP steps)",
            },
            400,
          );
        }

        const stepsText = sopSteps
          .map(
            (s: {
              step_number: number;
              title: string;
              description: string;
            }) =>
              `Step ${s.step_number}: ${s.title}\n${s.description || "No description"}`,
          )
          .join("\n\n");

        let contextInfo = "";
        if (industry_type) contextInfo += `\nIndustry: ${industry_type}`;
        if (state) contextInfo += `\nLocation: ${state}`;
        if (
          Array.isArray(governing_bodies) &&
          governing_bodies.length > 0
        ) {
          const gbList = governing_bodies
            .map(
              (gb: { name: string; level: string }) =>
                `${gb.name} (${gb.level})`,
            )
            .join(", ");
          contextInfo += `\nGoverning bodies: ${gbList}`;
        }

        // Auto-fetch ALL knowledge for compliance checking
        let knowledgeBlock = "";
        if (org_id) {
          const dbKnowledge = await fetchKnowledgeContext(org_id, undefined, 40);
          if (dbKnowledge) {
            knowledgeBlock = `\n\nOregon AFH Compliance Knowledge Base (check the SOP against these REAL regulations and requirements):\n${dbKnowledge}`;
          }
        }
        if (!knowledgeBlock && knowledge_context) {
          knowledgeBlock = `\nBusiness Knowledge Base:\n${knowledge_context}\n`;
        }

        const userPrompt = `Review the following SOP for regulatory compliance issues, safety gaps, and best-practice violations:

SOP Title: ${sop_title || "Untitled SOP"}
${contextInfo ? `\nBusiness context:${contextInfo}` : ""}${knowledgeBlock}
SOP Steps:
${stepsText}

Identify compliance findings — gaps, risks, or areas that need improvement. Cross-reference against the Oregon Administrative Rules and official forms provided in the knowledge base. For each finding, specify severity and which step it relates to (or null if it's a general issue). Return a JSON array of objects with these fields:
- "finding_id": integer starting at 1
- "severity": "high" | "medium" | "low"
- "title": short description of the issue (1 sentence)
- "description": detailed explanation including specific OAR citations or form references (2-3 sentences)
- "related_step": step number (integer) or null if general
- "recommendation": what the user should do to address this, including specific forms or OAR sections (1-2 sentences)`;

        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2048,
          system:
            "You are a regulatory compliance auditor specializing in Oregon Adult Foster Homes. You audit SOPs against OAR 411-049 through 411-052, official DHS/APD forms, OSHA standards, and Oregon employment law. Cite specific OAR sections and form numbers in your findings. Be thorough but practical — focus on findings that matter. Return ONLY a valid JSON array. No markdown code fences, no commentary, no explanation — just the raw JSON array.",
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        let findings;
        try {
          findings = JSON.parse(text);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        return jsonResponse({ success: true, data: { findings } });
      }

      case "knowledge-interview": {
        const {
          industry_type,
          state,
          county,
          messages: chatHistory,
        } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required fields: industry_type, state",
            },
            400,
          );
        }

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const openingMessage = `I run a ${industry_type} in ${locationParts.join(", ")}. Please start the interview.`;

        const apiMessages: Array<{
          role: "user" | "assistant";
          content: string;
        }> = [{ role: "user", content: openingMessage }];

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
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        return jsonResponse({ success: true, data: interview });
      }

      case "generate-single-source": {
        const { industry_type, state, county, existing_titles } =
          payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required fields: industry_type, state",
            },
            400,
          );
        }

        const titleList =
          Array.isArray(existing_titles) && existing_titles.length > 0
            ? existing_titles
                .map((t: string, i: number) => `${i + 1}. ${t}`)
                .join("\n")
            : "(none)";

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const singlePrompt = `Suggest ONE new compliance source for a ${industry_type} in ${locationParts.join(", ")}.

Sources already in the knowledge base:
${titleList}

If you can suggest a useful source that is NOT a duplicate of any listed above, return:
{
  "exhausted": false,
  "source": {
    "title": "Document or regulation title",
    "description": "Why they need this (1-2 sentences)",
    "type": "LINK" | "PDF" | "DOCUMENT" | "OTHER",
    "priority": "REQUIRED" | "RECOMMENDED" | "OPTIONAL",
    "level": "federal" | "state" | "county" | "local" | "internal",
    "suggested_source": "https://..." or null
  }
}

If ALL relevant sources are already covered and you have no more useful suggestions, return:
{ "exhausted": true }`;

        const singleMsg = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: `You are a regulatory compliance research specialist. Suggest exactly ONE new source document, regulation, license, or reference material for a business's compliance knowledge base. The source must NOT duplicate any title already listed. Use specific, real document names and regulation codes. Only suggest a source if it adds genuine value. Return ONLY valid JSON — no markdown fences, no commentary.`,
          messages: [{ role: "user", content: singlePrompt }],
        });

        const singleText =
          singleMsg.content[0].type === "text"
            ? singleMsg.content[0].text
            : "";

        let singleResult;
        try {
          singleResult = JSON.parse(singleText);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        return jsonResponse({ success: true, data: singleResult });
      }

      case "generate-starter-sources": {
        const { industry_type, state, county, profile } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required fields: industry_type, state",
            },
            400,
          );
        }

        if (
          !profile ||
          typeof profile !== "object" ||
          !Array.isArray(profile.services)
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: profile (with services array)",
            },
            400,
          );
        }

        const locationParts = [state];
        if (county) locationParts.push(`${county} County`);

        const userPrompt = `Generate starter knowledge base sources for the following business:

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
  "sources": [
    {
      "title": "Document or regulation title",
      "description": "Why they need this (1-2 sentences)",
      "type": "LINK" | "PDF" | "DOCUMENT" | "OTHER",
      "priority": "REQUIRED" | "RECOMMENDED" | "OPTIONAL",
      "level": "federal" | "state" | "county" | "local" | "internal",
      "suggested_source": "https://..." or null
    }
  ],
  "governing_bodies": [
    { "name": "Body name", "level": "federal" | "state" | "county" | "local" }
  ]
}`;

        const starterMsg = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3072,
          system: `You are a regulatory compliance research specialist. Generate a personalized list of source documents, regulations, licenses, certifications, and reference materials that a business needs for their compliance knowledge base.

Base your recommendations on the specific industry type, geographic location (state and county regulations matter), and the detailed business profile provided. Be specific — reference actual regulation names, administrative rule codes, and licensing requirements where applicable.

For each source:
- Use specific, real document/regulation titles (e.g. "Oregon Administrative Rules 411-050" not "state licensing rules")
- Include a suggested_source URL when you are confident it exists (government .gov sites, official regulatory body sites). Set to null if unsure — do NOT fabricate URLs.
- Categorize the type: LINK (web resource), PDF (downloadable document), DOCUMENT (template/form the user needs to create), OTHER
- Set priority: REQUIRED (legally mandated for this business), RECOMMENDED (industry best practice), OPTIONAL (helpful but not critical)
- Set level to classify the regulatory scope:
  - "federal" for national requirements (OSHA, ADA, HIPAA, etc.)
  - "state" for state-specific regulations, licensing rules, administrative codes
  - "county" for county-specific requirements
  - "local" for city or local ordinances
  - "internal" for business-created documents (handbooks, templates, policies)

Generate 8–15 sources. Order by priority: REQUIRED first, then RECOMMENDED, then OPTIONAL.

Also generate a governing_bodies array listing all regulatory bodies relevant to this business at federal, state, county, and local levels.

Return ONLY a valid JSON object. No markdown code fences, no commentary, no explanation — just the raw JSON object.`,
          messages: [{ role: "user", content: userPrompt }],
        });

        const starterText =
          starterMsg.content[0].type === "text"
            ? starterMsg.content[0].text
            : "";

        let starterResult;
        try {
          starterResult = JSON.parse(starterText);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
            500,
          );
        }

        return jsonResponse({
          success: true,
          data: {
            sources: starterResult.sources,
            governing_bodies: starterResult.governing_bodies,
          },
        });
      }

      case "generate-knowledge-checklist": {
        const { industry_type, state, county, profile } = payload ?? {};

        if (!industry_type || !state) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required fields: industry_type, state",
            },
            400,
          );
        }

        if (
          !profile ||
          typeof profile !== "object" ||
          !Array.isArray(profile.services)
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: profile (with services array)",
            },
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
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
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

        if (
          !kbProfile ||
          typeof kbProfile !== "object" ||
          !Array.isArray(kbProfile.services)
        ) {
          return jsonResponse(
            {
              success: false,
              error: "Missing required field: profile (with services array)",
            },
            400,
          );
        }

        if (!Array.isArray(kbItems) || kbItems.length === 0) {
          return jsonResponse(
            {
              success: false,
              error:
                "Missing required field: items (non-empty array of provided items)",
            },
            400,
          );
        }

        const itemLines = kbItems
          .map(
            (
              item: {
                title: string;
                description: string;
                type: string;
                provided_url: string | null;
                provided_file: string | null;
                provided_text: string | null;
              },
              idx: number,
            ) => {
              const parts = [`${idx + 1}. ${item.title} (${item.type})`];
              if (item.description)
                parts.push(`   Description: ${item.description}`);
              if (item.provided_url)
                parts.push(`   URL: ${item.provided_url}`);
              if (item.provided_file)
                parts.push(`   File: ${item.provided_file}`);
              if (item.provided_text)
                parts.push(`   Content: ${item.provided_text}`);
              return parts.join("\n");
            },
          )
          .join("\n\n");

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
          kbMessage.content[0].type === "text"
            ? kbMessage.content[0].text
            : "";

        let kbResult;
        try {
          kbResult = JSON.parse(kbText);
        } catch {
          return jsonResponse(
            {
              success: false,
              error: "Failed to parse AI response as JSON",
            },
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
          system:
            "You are a helpful assistant. Keep responses concise.",
          messages: [{ role: "user", content: prompt }],
        });

        const text =
          message.content[0].type === "text" ? message.content[0].text : "";

        return jsonResponse({ success: true, data: { response: text } });
      }

      default:
        return jsonResponse(
          { success: false, error: `Unknown action: ${action}` },
          400,
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ success: false, error: message }, 500);
  }
});

/**
 * Maps an SOP category or title to relevant knowledge base categories
 * so we fetch the most relevant content for context.
 */
function getCategoriesForSop(sopCategoryOrTitle: string): string[] {
  const lower = sopCategoryOrTitle.toLowerCase();

  // Always include rules-and-policies as baseline
  const categories = ["rules-and-policies"];

  if (
    lower.includes("medication") ||
    lower.includes("med") ||
    lower.includes("drug") ||
    lower.includes("pharmacy")
  ) {
    categories.push("forms", "documentation");
  }
  if (
    lower.includes("fire") ||
    lower.includes("evacuation") ||
    lower.includes("emergency") ||
    lower.includes("safety")
  ) {
    categories.push("building-safety", "documentation", "forms");
  }
  if (
    lower.includes("hire") ||
    lower.includes("hiring") ||
    lower.includes("employee") ||
    lower.includes("staff") ||
    lower.includes("training") ||
    lower.includes("labor")
  ) {
    categories.push("employment-labor");
  }
  if (
    lower.includes("training") ||
    lower.includes("caregiver") ||
    lower.includes("orientation") ||
    lower.includes("abuse") ||
    lower.includes("reporting") ||
    lower.includes("preparedness") ||
    lower.includes("person-centered") ||
    lower.includes("licensure")
  ) {
    categories.push("manager-training");
  }
  if (
    lower.includes("hire") ||
    lower.includes("hiring") ||
    lower.includes("background check") ||
    lower.includes("onboard") ||
    lower.includes("mentor") ||
    lower.includes("substitute") ||
    lower.includes("qualification") ||
    lower.includes("recruit")
  ) {
    categories.push("manager-hiring");
  }
  if (
    lower.includes("medicaid") ||
    lower.includes("billing") ||
    lower.includes("payment") ||
    lower.includes("claims")
  ) {
    categories.push("medicaid", "financial");
  }
  if (
    lower.includes("insurance") ||
    lower.includes("liability") ||
    lower.includes("workers comp")
  ) {
    categories.push("insurance");
  }
  if (
    lower.includes("financial") ||
    lower.includes("tax") ||
    lower.includes("bookkeeping") ||
    lower.includes("accounting")
  ) {
    categories.push("financial");
  }
  if (
    lower.includes("inspect") ||
    lower.includes("license") ||
    lower.includes("audit") ||
    lower.includes("compliance")
  ) {
    categories.push("documentation", "forms");
  }
  if (
    lower.includes("resident") ||
    lower.includes("care plan") ||
    lower.includes("admission") ||
    lower.includes("discharge")
  ) {
    categories.push("forms", "documentation");
  }

  // Deduplicate
  return [...new Set(categories)];
}
