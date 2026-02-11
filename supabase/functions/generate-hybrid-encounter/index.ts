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

    const { region, tone, campaignContext, narrativeContext, partyLevel, encounterTheme, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de encuentros híbridos para D&D 5e en Forgotten Realms.
Creas encuentros donde combate, diplomacia e investigación coexisten y el grupo elige su enfoque.

REGLAS:
- El encuentro debe ser resoluble por combate, diplomacia, sigilo o ingenio — todos válidos
- Las consecuencias varían drásticamente según el enfoque elegido
- La tensión narrativa debe escalar naturalmente
- El combate nunca es la única opción, pero siempre es una opción
- Las opciones sociales deben ser tan detalladas como las de combate
- El impacto en la campaña debe ser significativo independientemente del enfoque
- Integrar con lore oficial de Forgotten Realms
- Incluir puntos de inflexión donde la situación puede cambiar de social a combate (y viceversa)

FORMATO DE RESPUESTA (JSON estricto):
{
  "title": "nombre del encuentro",
  "encounter_type": "negociación armada|emboscada negociable|ritual interrumpible|juicio por combate|confrontación diplomática|rescate complejo|intercambio tenso|invasión silenciable",
  "context": {"situation": "qué está pasando", "location": "dónde", "stakes": "qué está en juego", "time_pressure": "none|low|medium|high|critical", "why_now": "por qué ocurre en este momento"},
  "narrative_tension": {"opening_tension": "nivel inicial", "escalation_triggers": ["qué hace subir la tensión"], "deescalation_options": ["qué puede calmar la situación"], "point_of_no_return": "momento donde ya no hay vuelta atrás"},
  "involved_parties": [
    {"name": "nombre/grupo", "motivation": "qué quieren", "disposition": "hostile|wary|neutral|cautious_ally", "negotiation_leverage": "qué les importa", "combat_capability": "weak|moderate|strong|overwhelming", "breaking_point": "qué les hace atacar/huir"}
  ],
  "social_options": [
    {"approach": "enfoque social", "key_skills": ["habilidades"], "key_arguments": ["argumentos efectivos"], "npc_reactions": "cómo responden", "success_outcome": "resultado si funciona", "partial_success": "resultado parcial", "failure_consequence": "si falla"}
  ],
  "combat_scenario": {"enemies": [{"name": "nombre", "cr": "CR", "tactics": "táctica", "morale_break": "cuándo huyen/se rinden"}], "terrain_features": ["elementos tácticos del terreno"], "environmental_hazards": ["peligros ambientales"], "victory_conditions": ["no solo matar — capturar, expulsar, proteger"]},
  "stealth_option": {"approach": "cómo resolver con sigilo", "challenges": ["obstáculos"], "detection_consequences": "qué pasa si les detectan", "success_outcome": "resultado si funciona"},
  "tipping_points": [
    {"trigger": "qué ocurre", "shifts_from": "social|combat|stealth", "shifts_to": "social|combat|stealth", "can_be_reversed": true, "how_to_reverse": "cómo volver atrás"}
  ],
  "consequences_by_approach": {
    "full_combat": {"immediate": "resultado inmediato", "reputation_impact": "cómo cambia su reputación", "campaign_impact": "efecto en la campaña"},
    "full_diplomacy": {"immediate": "resultado", "reputation_impact": "reputación", "campaign_impact": "campaña"},
    "stealth_resolution": {"immediate": "resultado", "reputation_impact": "reputación", "campaign_impact": "campaña"},
    "mixed_approach": {"immediate": "resultado", "reputation_impact": "reputación", "campaign_impact": "campaña"}
  },
  "conflict_evolution": {"if_unresolved": "qué pasa si los PJs no actúan", "escalation_timeline": "cómo empeora con el tiempo", "future_repercussions": ["consecuencias futuras"]},
  "dm_notes": "Cómo dirigir este encuentro de forma orgánica",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Costa de la Espada"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
TEMA: ${encounterTheme || "cualquiera"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Diseña un encuentro híbrido donde combate y diplomacia coexistan.`;

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

    let encounter;
    try {
      encounter = JSON.parse(content);
    } catch {
      encounter = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ encounter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-hybrid-encounter error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
