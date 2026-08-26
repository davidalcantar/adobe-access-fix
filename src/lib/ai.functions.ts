import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SuggestInput, SuggestKind } from "./ai.server";

export type SuggestionResponse =
  | { ok: true; text: string }
  | { ok: false; status: number; message: string };

export const suggestRemediation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SuggestInput) => {
    const kinds: SuggestKind[] = ["alt", "longdesc", "heading", "table-headers"];
    if (!kinds.includes(input.kind)) throw new Error("Unsupported suggestion type");
    return input;
  })
  .handler(async ({ data }): Promise<SuggestionResponse> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, status: 401, message: "AI is not configured for this project." };
    }
    const { callGateway } = await import("./ai.server");
    const result = await callGateway(data, apiKey);
    if (result.ok) return { ok: true, text: result.text };
    return { ok: false, status: result.status, message: result.message };
  });
