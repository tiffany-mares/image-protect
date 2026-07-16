import { createServerFn } from "@tanstack/react-start";

// Public demo endpoint: given an image data URL, ask a vision model to describe it.
// This is used by the on-page "Protection Lab" to demonstrate what AI scrapers "see"
// before and after Inkshield perturbations are applied.
export const scanImage = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (
      !input ||
      typeof input.imageDataUrl !== "string" ||
      !input.imageDataUrl.startsWith("data:image/")
    ) {
      throw new Error("imageDataUrl must be a data:image/* URL");
    }
    if (input.imageDataUrl.length > 6_000_000) {
      throw new Error("Image too large (>6MB). Please use a smaller image.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        error:
          "AI gateway is not configured. Enable Lovable Cloud/AI to run the demo.",
      };
    }

    const prompt = `You are a stock-image AI scraper cataloging this artwork.
Return a compact JSON object with these fields:
- "subject": the main subject in 2-6 words
- "style": the art style / medium in 2-6 words
- "tags": array of 5-8 short descriptive tags
- "confidence": your confidence 0-1 that you correctly identified the subject
Only return JSON, no prose.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("scanImage gateway error", res.status, body);
      return {
        ok: false as const,
        error: `Vision model returned ${res.status}. ${body.slice(0, 200)}`,
      };
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "";

    // Try to parse JSON out of the model output.
    let parsed:
      | { subject?: string; style?: string; tags?: string[]; confidence?: number }
      | null = null;
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = null;
    }

    return {
      ok: true as const,
      raw,
      subject: parsed?.subject ?? "—",
      style: parsed?.style ?? "—",
      tags: Array.isArray(parsed?.tags) ? parsed!.tags!.slice(0, 8) : [],
      confidence:
        typeof parsed?.confidence === "number" ? parsed!.confidence! : null,
    };
  });
