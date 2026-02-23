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
