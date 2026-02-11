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

    const { region, factions, openConflicts, growingThreats, recentPartyActions, timePassed, campaignContext, narrativeContext } = await req.json();

    const systemPrompt = `Eres un simulador de estado del mundo para D&D 5e en Forgotten Realms.
Simulas qué ocurre en el mundo durante el tiempo entre sesiones, generando eventos offscreen coherentes.

REGLAS:
- Los eventos deben ser consecuencia lógica de conflictos activos y acciones del grupo
- Las facciones actúan según sus motivaciones canónicas incluso sin intervención de los PJs
- El mundo no espera a los PJs — las cosas empeoran o mejoran según la lógica interna
- Los rumores reflejan eventos reales distorsionados por la transmisión oral
- Las amenazas escalan si no se atienden
- Las oportunidades tienen ventana temporal — pueden expirar
- Proporcional al tiempo transcurrido (días vs semanas vs meses)
- Coherencia absoluta con lore de Forgotten Realms y memoria narrativa

FORMATO DE RESPUESTA (JSON estricto):
{
  "time_simulated": "período simulado",
  "world_summary": "resumen de 2-3 frases de qué ha cambiado",
  "offscreen_events": [
    {"event": "qué ocurrió", "when": "cuándo durante el período", "caused_by": "qué lo provocó", "witnesses": ["quién lo vio"], "public_knowledge": true, "impact": "consecuencia directa"}
  ],
  "political_changes": [
    {"change": "descripción", "old_state": "antes", "new_state": "ahora", "key_actors": ["responsables"], "stability": "stable|fragile|volatile"}
  ],
  "faction_movements": [
    {"faction": "nombre", "action_taken": "qué hicieron", "motivation": "por qué", "new_position": "nueva posición de poder", "relation_to_party": "cómo afecta a los PJs"}
  ],
  "new_rumors": [
    {"rumor": "lo que se dice", "truth_percentage": 0-100, "spread": "local|regional|widespread", "source_origin": "de dónde viene", "narrative_hook": "qué puede desencadenar"}
  ],
  "narrative_opportunities": [
    {"opportunity": "descripción", "type": "quest|alliance|discovery|trade|rescue", "time_sensitive": true, "expires_in": "cuánto tiempo queda", "reward_potential": "qué pueden ganar"}
  ],
  "emerging_threats": [
    {"threat": "descripción", "source": "origen", "current_severity": "minor|moderate|serious|critical", "trajectory": "growing|stable|declining", "if_ignored": "qué pasa si no actúan"}
  ],
  "environmental_changes": [
    {"change": "descripción", "cause": "natural|magical|faction|consequence", "affected_area": "zona afectada", "gameplay_impact": "cómo afecta al juego"}
  ],
  "npc_status_updates": [
    {"npc": "nombre", "previous_status": "antes", "current_status": "ahora", "reason": "por qué cambió", "party_relevance": "importancia para los PJs"}
  ],
  "dm_briefing": "Resumen ejecutivo para el DM: qué contar, qué ocultar, qué dejar que descubran"
}`;

    const userPrompt = `REGIÓN: ${region || "Costa de la Espada"}
TIEMPO TRANSCURRIDO: ${timePassed || "1-2 semanas"}
FACCIONES ACTIVAS:\n${JSON.stringify(factions || [], null, 2)}
CONFLICTOS ABIERTOS:\n${JSON.stringify(openConflicts || [], null, 2)}
AMENAZAS CRECIENTES:\n${JSON.stringify(growingThreats || [], null, 2)}
ACCIONES RECIENTES DEL GRUPO:\n${JSON.stringify(recentPartyActions || [], null, 2)}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}
MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Simula qué ha ocurrido en el mundo durante este tiempo.`;

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

    let simulation;
    try {
      simulation = JSON.parse(content);
    } catch {
      simulation = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ simulation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("simulate-world-state error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
