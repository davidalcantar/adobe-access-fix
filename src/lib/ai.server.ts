const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.7-flash";

export type SuggestKind = "alt" | "longdesc" | "heading" | "table-headers";

export type SuggestInput = {
  kind: SuggestKind;
  /** data:image/...;base64,... crop of the element, when relevant. */
  imageDataUrl?: string | undefined;
  context: string;
  documentTitle?: string | undefined;
  extra?: string | undefined;
};

const PROMPTS: Record<SuggestKind, string> = {
  alt: [
    "You write alternative text for images inside PDF documents that must meet WCAG 2.2.",
    "Return ONE sentence, under 150 characters, describing what the image conveys in this document's context.",
    "Do not start with 'image of', 'picture of', or 'graphic of'. Do not mention the file or the format.",
    "If the image is purely decorative and carries no information, reply exactly: DECORATIVE",
    "Return only the alt text, with no quotes and no preamble.",
  ].join(" "),
  longdesc: [
    "You write extended descriptions for complex images (charts, diagrams, maps) in PDFs targeting WCAG 2.2 AAA.",
    "Describe the structure first, then the data or relationships it shows, then the takeaway.",
    "Use 2 to 5 short sentences of plain prose. No bullet characters, no markdown, no preamble.",
  ].join(" "),
  heading: [
    "You classify a text block from a PDF into a heading level for an accessible tag tree.",
    "Given the block text and the surrounding outline, reply with exactly one of: H1, H2, H3, H4, H5, H6, or P.",
    "Reply with the token only.",
  ].join(" "),
  "table-headers": [
    "You identify header cells in a table extracted from a PDF, for an accessible tag tree.",
    "You are given the table as rows of cells. Decide whether the first row is a header row, the first column is a header column, both, or neither.",
    "Reply with exactly one of: ROW, COLUMN, BOTH, NONE. Reply with the token only.",
  ].join(" "),
};

export async function callGateway(input: SuggestInput, apiKey: string) {
  const content: unknown[] = [];
  const parts = [
    input.documentTitle ? `Document title: ${input.documentTitle}` : "",
    input.context ? `Surrounding text: ${input.context.slice(0, 2500)}` : "",
    input.extra ? input.extra.slice(0, 3000) : "",
  ].filter(Boolean);
  content.push({ type: "text", text: parts.join("\n\n") || "No surrounding text available." });
  if (input.imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }

  const response = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PROMPTS[input.kind] },
        { role: "user", content },
      ],
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? body;
    } catch {
      /* keep raw body */
    }
    return { ok: false as const, status: response.status, message: message.slice(0, 400) };
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  return { ok: true as const, text };
}
