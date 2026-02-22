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
