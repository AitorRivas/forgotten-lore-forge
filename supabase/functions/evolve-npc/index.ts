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

    const { npcs, recentEvents, partyDecisions, campaignContext, narrativeContext } = await req.json();

    const systemPrompt = `Eres un motor de evolución de PNJs para D&D 5e en Forgotten Realms.
Analizas PNJs existentes junto con eventos recientes y generas evoluciones narrativas realistas y coherentes.

REGLAS:
- Los cambios deben ser graduales y justificados por eventos concretos, no arbitrarios
- La personalidad evoluciona, no cambia radicalmente sin trauma significativo
- Los cambios de lealtad requieren motivación clara y progresiva
- Los resentimientos se acumulan — rastrear interacciones negativas previas
- Las alianzas nuevas deben beneficiar a ambas partes desde su perspectiva
- Un PNJ puede evolucionar de aliado a antagonista (o viceversa) pero necesita arco narrativo
- Mantener coherencia absoluta con la historia previa y el lore de Forgotten Realms
- Los secretos descubiertos deben tener impacto narrativo real

FORMATO DE RESPUESTA (JSON estricto):
{
  "npc_evolutions": [
    {
      "npc_name": "nombre del PNJ",
      "previous_state": {"personality": "rasgos previos", "loyalty": "a quién servía", "goals": ["objetivos anteriores"], "relationships": ["relaciones clave"]},
      "triggering_events": ["eventos que causan el cambio"],
      "personality_changes": [{"trait": "rasgo afectado", "from": "antes", "to": "ahora", "cause": "por qué cambió"}],
      "loyalty_shifts": [{"from": "lealtad anterior", "to": "nueva lealtad", "reason": "motivación", "stability": "firm|fragile|conflicted"}],
      "new_goals": [{"goal": "nuevo objetivo", "motivation": "por qué", "urgency": "low|medium|high", "conflicts_with": "qué otro objetivo contradice"}],
      "resentments": [{"towards": "contra quién", "cause": "por qué", "intensity": "mild|moderate|burning", "expression": "cómo lo manifiesta", "potential_action": "qué podría hacer"}],
      "new_alliances": [{"with": "aliado nuevo", "basis": "en qué se basa", "mutual_benefit": "qué gana cada uno", "vulnerability": "punto débil de la alianza"}],
      "resources_changed": {"gained": ["recursos ganados"], "lost": ["recursos perdidos"], "narrative_impact": "cómo afecta su capacidad de acción"},
      "secrets_discovered": [{"secret": "qué ha descubierto", "source": "cómo lo supo", "what_they_do_with_it": "cómo lo usa", "danger_to_party": "amenaza para los PJs"}],
      "arc_trajectory": {"direction": "ally_to_enemy|enemy_to_ally|deepening_ally|deepening_enemy|neutral_shift|wildcard", "current_phase": "descripción de en qué punto del arco está", "next_likely_step": "próximo paso probable", "intervention_window": "qué podrían hacer los PJs para cambiar el rumbo"},
      "dm_roleplay_notes": "Cómo interpretar al PNJ ahora vs antes"
    }
  ],
  "emerging_dynamics": [{"dynamic": "nueva dinámica entre PNJs", "npcs_involved": ["nombres"], "tension_level": "low|medium|high|explosive"}],
  "narrative_opportunities": [{"opportunity": "oportunidad para el DM", "involves": ["PNJs"], "type": "betrayal|revelation|alliance|confrontation"}],
  "summary": "Resumen ejecutivo de 2-3 frases"
}`;

    const userPrompt = `PNJs A EVOLUCIONAR:\n${JSON.stringify(npcs || [], null, 2)}

EVENTOS RECIENTES:\n${JSON.stringify(recentEvents || [], null, 2)}

DECISIONES DEL GRUPO:\n${JSON.stringify(partyDecisions || [], null, 2)}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera evoluciones narrativas realistas y coherentes para estos PNJs.`;

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

    let evolution;
    try {
      evolution = JSON.parse(content);
    } catch {
      evolution = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ evolution }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("evolve-npc error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
