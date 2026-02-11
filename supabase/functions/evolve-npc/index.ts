import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithFallback(messages: any[], options: { model?: string; temperature?: number; response_mime_type?: string } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro";
  const body: any = { model: geminiModel, messages };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.response_mime_type) body.response_mime_type = options.response_mime_type;

  if (GEMINI_API_KEY) {
    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (resp.ok) return resp;
    if (resp.status !== 429) console.error("Gemini error:", resp.status); else console.log("Gemini rate limited, trying Lovable AI...");
  }
  if (LOVABLE_API_KEY) {
    const lovBody = { ...body, model: `google/${geminiModel}` };
    delete lovBody.response_mime_type;
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(lovBody),
    });
    if (resp.ok) return resp;
    console.error("Lovable AI error:", resp.status);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { npcs, recentEvents, partyDecisions, campaignContext, narrativeContext } = await req.json();

    const systemPrompt = `Eres un motor de evolución de PNJs para D&D 5e en Forgotten Realms.
Analizas PNJs existentes junto con eventos recientes y generas evoluciones narrativas realistas y coherentes.

REGLAS:
- Los cambios deben ser graduales y justificados por eventos concretos
- La personalidad evoluciona, no cambia radicalmente sin trauma significativo
- Los cambios de lealtad requieren motivación clara y progresiva
- Mantener coherencia absoluta con la historia previa y el lore de Forgotten Realms

FORMATO DE RESPUESTA (JSON estricto):
{
  "npc_evolutions": [
    {
      "npc_name": "nombre",
      "previous_state": {"personality": "rasgos", "loyalty": "a quién", "goals": ["objetivos"], "relationships": ["relaciones"]},
      "triggering_events": ["eventos"],
      "personality_changes": [{"trait": "rasgo", "from": "antes", "to": "ahora", "cause": "por qué"}],
      "loyalty_shifts": [{"from": "antes", "to": "ahora", "reason": "motivación", "stability": "firm|fragile|conflicted"}],
      "new_goals": [{"goal": "objetivo", "motivation": "por qué", "urgency": "low|medium|high", "conflicts_with": "qué contradice"}],
      "resentments": [{"towards": "contra quién", "cause": "por qué", "intensity": "mild|moderate|burning", "expression": "cómo", "potential_action": "qué podría hacer"}],
      "new_alliances": [{"with": "aliado", "basis": "base", "mutual_benefit": "beneficio", "vulnerability": "debilidad"}],
      "resources_changed": {"gained": ["ganados"], "lost": ["perdidos"], "narrative_impact": "impacto"},
      "secrets_discovered": [{"secret": "qué", "source": "cómo", "what_they_do_with_it": "uso", "danger_to_party": "amenaza"}],
      "arc_trajectory": {"direction": "ally_to_enemy|enemy_to_ally|deepening_ally|deepening_enemy|neutral_shift|wildcard", "current_phase": "fase", "next_likely_step": "próximo paso", "intervention_window": "qué pueden hacer los PJs"},
      "dm_roleplay_notes": "Cómo interpretarlo ahora"
    }
  ],
  "emerging_dynamics": [{"dynamic": "dinámica", "npcs_involved": ["nombres"], "tension_level": "low|medium|high|explosive"}],
  "narrative_opportunities": [{"opportunity": "oportunidad", "involves": ["PNJs"], "type": "betrayal|revelation|alliance|confrontation"}],
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `PNJs A EVOLUCIONAR:\n${JSON.stringify(npcs || [], null, 2)}

EVENTOS RECIENTES:\n${JSON.stringify(recentEvents || [], null, 2)}

DECISIONES DEL GRUPO:\n${JSON.stringify(partyDecisions || [], null, 2)}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera evoluciones narrativas realistas y coherentes para estos PNJs.`;

    const response = await callAIWithFallback(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", temperature: 0.8, response_mime_type: "application/json" }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let evolution;
    try { evolution = JSON.parse(content); } catch { evolution = { raw: content, parse_error: true }; }

    return new Response(JSON.stringify({ evolution }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("evolve-npc error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});