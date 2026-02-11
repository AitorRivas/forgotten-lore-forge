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

    const { recentEvents, partyDecisions, affectedNPCs, factions, activeConflicts, region, narrativeContext } = await req.json();

    const systemPrompt = `Eres un motor de consecuencias dinámicas para campañas de D&D 5e en Forgotten Realms.
Tu función es analizar eventos recientes y generar consecuencias realistas, coherentes con el lore oficial y la memoria narrativa.

REGLAS:
- Cada consecuencia debe ser específica, no genérica
- Las facciones reaccionan según sus motivaciones canónicas (Zhentarim = lucro/poder, Arpistas = equilibrio, Enclave Esmeralda = naturaleza, etc.)
- Los cambios económicos deben ser proporcionales a los eventos
- Los rumores deben mezclar verdad con exageración, como ocurriría realmente
- Las amenazas futuras deben ser semillas narrativas que el DM pueda desarrollar
- Mantén coherencia con los conflictos activos y la memoria narrativa proporcionada

FORMATO DE RESPUESTA (JSON estricto):
{
  "political_changes": [{"change": "descripción", "severity": "minor|moderate|major", "affected_entities": ["..."]}],
  "social_changes": [{"change": "descripción", "impact_area": "local|regional|continental"}],
  "economic_changes": [{"change": "descripción", "direction": "positive|negative", "sectors": ["..."]}],
  "faction_reactions": [{"faction": "nombre", "reaction": "descripción", "stance_shift": "friendly|neutral|hostile", "actions_planned": "..."}],
  "emerging_conflicts": [{"conflict": "descripción", "parties_involved": ["..."], "urgency": "low|medium|high|critical"}],
  "narrative_opportunities": [{"opportunity": "descripción", "type": "quest|alliance|discovery|betrayal", "hooks": ["..."]}],
  "future_threats": [{"threat": "descripción", "timeline": "immediate|short_term|long_term", "danger_level": "low|medium|high|deadly"}],
  "rumors": [{"rumor": "lo que la gente dice", "truth_percentage": 0-100, "source": "taberna|mercado|templo|corte|submundo"}],
  "summary": "Resumen ejecutivo de 2-3 frases para el DM"
}`;

    const userPrompt = `EVENTOS RECIENTES:\n${JSON.stringify(recentEvents || [], null, 2)}

DECISIONES DEL GRUPO:\n${JSON.stringify(partyDecisions || [], null, 2)}

PNJs AFECTADOS:\n${JSON.stringify(affectedNPCs || [], null, 2)}

FACCIONES INVOLUCRADAS:\n${JSON.stringify(factions || [], null, 2)}

CONFLICTOS ACTIVOS:\n${JSON.stringify(activeConflicts || [], null, 2)}

REGIÓN: ${region || "No especificada"}

MEMORIA NARRATIVA EXISTENTE:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera consecuencias dinámicas detalladas y coherentes.`;

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
        temperature: 0.8,
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

    let consequences;
    try {
      consequences = JSON.parse(content);
    } catch {
      consequences = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ consequences }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-consequences error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
