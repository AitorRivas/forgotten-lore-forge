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

    const { region, tone, campaignContext, narrativeContext, partyLevel, dilemmaTheme, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de dilemas morales complejos para D&D 5e en Forgotten Realms.
Creas situaciones donde no hay respuesta claramente correcta, forzando decisiones significativas con consecuencias reales.

REGLAS:
- Ninguna opción debe ser objetivamente "la buena" — todas tienen costes reales
- La información disponible para los PJs debe ser deliberadamente incompleta
- Las consecuencias deben ramificarse a corto y largo plazo
- Los PNJs deben reaccionar emocionalmente de forma creíble
- Integrar facciones de FR con sus filosofías reales (Arpistas vs Zhentarim vs Enclave Esmeralda, etc.)
- El dilema debe ser relevante para la narrativa en curso, no un caso aislado
- Evitar dilemas de trolley problem genéricos — crear situaciones específicas y contextualizadas

TEMAS POSIBLES: sacrificio individual vs bien común, justicia vs misericordia, lealtad vs deber, verdad vs estabilidad, libertad vs seguridad, tradición vs progreso, venganza vs perdón, pragmatismo vs idealismo.

FORMATO DE RESPUESTA (JSON estricto):
{
  "title": "nombre del dilema",
  "theme": "tema moral central",
  "initial_situation": {"description": "qué encuentran los PJs", "urgency": "low|medium|high|critical", "context": "cómo llegaron aquí"},
  "involved_parties": [
    {"name": "nombre/grupo", "role": "su papel en el conflicto", "motivation": "qué quieren y por qué", "moral_standing": "por qué creen tener razón", "emotional_state": "estado emocional actual", "what_they_hide": "qué no dicen"}
  ],
  "conflicting_interests": [
    {"interest": "descripción", "who_benefits": "quién gana", "who_suffers": "quién pierde", "moral_weight": "por qué importa"}
  ],
  "incomplete_information": [
    {"what_pjs_know": "información visible", "what_pjs_dont_know": "información oculta", "how_to_discover": "cómo podrían averiguarlo", "discovery_changes_everything": "cómo cambia el dilema si lo descubren"}
  ],
  "possible_decisions": [
    {"decision": "opción", "immediate_appeal": "por qué parece buena idea", "hidden_cost": "el precio que no ven", "alignment_tendency": "qué alineamiento la favorece"}
  ],
  "short_term_consequences": [
    {"decision": "si eligen X", "immediate_result": "qué pasa ahora", "who_reacts": "quién responde", "emotional_fallout": "impacto emocional inmediato"}
  ],
  "long_term_consequences": [
    {"decision": "si eligieron X", "weeks_later": "en semanas", "months_later": "en meses", "permanent_change": "cambio permanente en el mundo"}
  ],
  "political_social_impact": [
    {"decision": "decisión", "political_shift": "cambio político", "social_shift": "cambio social", "faction_reactions": [{"faction": "nombre", "reaction": "respuesta"}]}
  ],
  "npc_emotional_impact": [
    {"npc": "nombre", "if_decision_a": "reacción emocional", "if_decision_b": "reacción alternativa", "relationship_change": "cómo cambia su relación con los PJs"}
  ],
  "dm_notes": "Cómo presentar el dilema sin sesgar a los jugadores",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Forgotten Realms"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
TEMA PREFERIDO: ${dilemmaTheme || "cualquiera"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera un dilema moral complejo donde ninguna opción sea claramente correcta.`;

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

    let dilemma;
    try {
      dilemma = JSON.parse(content);
    } catch {
      dilemma = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ dilemma }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-moral-dilemma error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
