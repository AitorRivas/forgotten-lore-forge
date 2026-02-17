import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentType, author, recipient, context, campaignContext, narrativeContext, tone } = await req.json();

    const systemPrompt = `Eres un generador de documentos narrativos para D&D 5e en Forgotten Realms.
Creas documentos "reales" que pueden leerse en mesa, con voz auténtica y múltiples capas de información.

REGLAS:
- El tono y estilo varían según autor, época y contexto
- La información explícita es clara pero posibilita interpretaciones múltiples
- La información implícita requiere lectura atenta o Insight/Investigation
- Las pistas ocultas están presentes pero sutiles
- El documento debe parecer auténtico a Forgotten Realms
- El documento es legible y utilizable literalmente en mesa

FORMATO DE RESPUESTA (JSON estricto):
{
  "document_type": "tipo",
  "title": "título o identificación del documento",
  "document_body": "el documento completo, legible y auténtico para leer en mesa",
  "author_info": {"name": "autor", "title": "cargo/rol", "motivation": "qué quería lograr", "voice": "características del estilo"},
  "explicit_information": [{"fact": "información clara", "how_presented": "cómo aparece"}],
  "implicit_information": [{"hint": "pista implícita", "location_in_text": "dónde está", "difficulty": "DC", "what_it_reveals": "qué significa"}],
  "hidden_clues": [{"clue": "pista oculta", "location": "dónde", "discovery_method": "cómo encontrarla", "interpretation": "qué significa", "connects_to": "con qué conecta"}],
  "red_herrings": [{"misdirection": "falsa pista", "why_misleading": "por qué despista", "actual_truth": "la verdad real"}],
  "if_codified": {"cipher_type": "tipo de cifrado", "key": "clave", "difficulty": "DC", "decrypted_content": "contenido desencriptado"},
  "narrative_hooks": ["gancho 1", "gancho 2"],
  "dm_notes": "Qué el DM debe saber",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `TIPO: ${documentType || "carta privada"}
AUTOR: ${author || "no especificado"}
DESTINATARIO: ${recipient || "no especificado"}
CONTEXTO: ${context || "no especificado"}
TONO: ${tone || "coherente con el documento"}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera un documento narrativo completo y utilizable en mesa.`;

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", temperature: 0.85, response_mime_type: "application/json" }
    );

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResult.response.json();
    const content = data.choices?.[0]?.message?.content;
    let document;
    try { document = JSON.parse(content); } catch { document = { raw: content, parse_error: true }; }

    return new Response(JSON.stringify({ document }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-document error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});