import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { documentType, author, recipient, context, campaignContext, narrativeContext, tone } = await req.json();

    const systemPrompt = `Eres un generador de documentos narrativos para D&D 5e en Forgotten Realms.
Creas documentos "reales" que pueden leerse en mesa, con voz auténtica y múltiples capas de información.

REGLAS:
- El tono y estilo varían según autor, época y contexto
- La información explícita es clara pero posibilita interpretaciones múltiples
- La información implícita requiere lectura atenta o Insight/Investigation
- Las pistas ocultas están presentes pero sutiles — no evidentes al primer vistazo
- El documento debe parecer auténtico a Forgotten Realms (referencias a dioses, lugares, dinero)
- Ortografía y sintaxis reflejan educación del autor
- El documento es legible y utilizable literalmente en mesa

TIPOS DE DOCUMENTO:
- Carta privada (personal, informal, motivos ocultos)
- Decreto oficial (formal, sello/autoridad, consecuencias legales)
- Contrato (cláusulas visibles y ocultas, términos ambiguos)
- Informe secreto (cuidado en redacción, nombres en clave, información fragmentada)
- Diario personal (entrada singular, confesiones, información comprometida)
- Mensaje codificado (cifrado simple, pistas para decodificar, información sensible)

FORMATO DE RESPUESTA (JSON estricto):
{
  "document_type": "tipo",
  "title": "título o identificación del documento",
  "document_body": "el documento completo, legible y auténtico para leer en mesa",
  "author_info": {"name": "autor", "title": "cargo/rol", "motivation": "qué quería lograr", "voice": "características del estilo de escritura"},
  "explicit_information": [{"fact": "información clara", "how_presented": "cómo aparece en el documento"}],
  "implicit_information": [{"hint": "pista implícita", "location_in_text": "dónde está", "difficulty": "Insight DC 12|Investigation DC 15", "what_it_reveals": "qué significa"}],
  "hidden_clues": [{"clue": "pista oculta", "location": "dónde exactamente", "discovery_method": "cómo encontrarla", "interpretation": "qué significa", "connects_to": "con qué se conecta"}],
  "red_herrings": [{"misdirection": "falsa pista", "why_misleading": "por qué despista", "actual_truth": "la verdad real"}],
  "if_codified": {"cipher_type": "tipo de cifrado", "key": "clave para decodificar", "difficulty": "DC para descifrar", "decrypted_content": "contenido desencriptado"},
  "narrative_hooks": ["gancho narrativo 1", "gancho narrativo 2", "..."],
  "dm_notes": "Qué el DM debe saber, cómo usar este documento",
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

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        response_mime_type: "application/json",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    let document;
    try {
      document = JSON.parse(content);
    } catch {
      document = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ document }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-document error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
