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

    const { region, tone, campaignContext, narrativeContext, partyLevel, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de eventos sociales complejos para D&D 5e en Forgotten Realms.
Creas encuentros sociales ricos, jugables y con múltiples capas de intriga que permiten soluciones no violentas.

REGLAS:
- Todo debe ser coherente con el lore oficial de Forgotten Realms
- Los asistentes deben tener motivaciones realistas y agendas ocultas creíbles
- Incluir al menos 3 soluciones no violentas viables para cada conflicto principal
- Los rumores mezclan verdad y mentira de forma natural
- Las consecuencias deben ramificarse según las decisiones del grupo
- Los giros narrativos deben ser sorprendentes pero lógicos en retrospectiva
- Adaptar la complejidad política al nivel del grupo

TIPOS DE EVENTO POSIBLES: baile de la nobleza, banquete diplomático, feria comercial, torneo, festival religioso, subasta secreta, juicio público, coronación, funeral de importancia, reunión de gremios, concilio de facciones, boda política, celebración popular, audiencia real, mercado negro exclusivo.

FORMATO DE RESPUESTA (JSON estricto):
{
  "event_type": "tipo de evento",
  "title": "nombre memorable del evento",
  "location": {"name": "lugar", "district": "barrio/zona", "city": "ciudad", "description": "ambientación detallada"},
  "occasion": "motivo del evento",
  "atmosphere": "descripción de la atmósfera y ambiente sensorial",
  "key_attendees": [
    {"name": "nombre", "title": "título/cargo", "faction": "facción", "public_agenda": "lo que dice querer", "hidden_agenda": "lo que realmente busca", "secrets": ["secretos que guarda"], "personality_hook": "rasgo memorable para roleplay", "leverage": "qué pueden usar los PJs para influirle"}
  ],
  "active_rumors": [
    {"rumor": "lo que se susurra", "truth_percentage": 0-100, "source_npc": "quién lo difunde", "purpose": "por qué existe este rumor"}
  ],
  "social_conflicts": [
    {"conflict": "descripción", "parties": ["involucrados"], "stakes": "qué está en juego", "nonviolent_solutions": ["solución 1", "solución 2", "solución 3"]}
  ],
  "roleplay_opportunities": [
    {"situation": "descripción", "skills_useful": ["habilidades relevantes"], "potential_rewards": "qué se puede ganar", "risk": "qué puede salir mal"}
  ],
  "potential_scandals": [
    {"scandal": "descripción", "trigger": "qué lo desata", "affected_parties": ["afectados"], "fallout": "consecuencias si se revela"}
  ],
  "narrative_twists": [
    {"twist": "descripción", "foreshadowing": "pistas previas sutiles", "trigger_condition": "qué lo activa", "impact": "cómo cambia la situación"}
  ],
  "consequence_branches": [
    {"decision": "decisión del grupo", "outcome_a": "si eligen opción A", "outcome_b": "si eligen opción B", "long_term_impact": "efecto a largo plazo"}
  ],
  "timeline": [
    {"phase": "fase del evento", "duration": "duración", "key_moments": "qué ocurre", "opportunities": "ventanas de acción para PJs"}
  ],
  "dm_notes": "Consejos para dirigir este evento social",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Forgotten Realms"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera un evento social complejo, jugable y memorable.`;

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

    let socialEvent;
    try {
      socialEvent = JSON.parse(content);
    } catch {
      socialEvent = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ socialEvent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-social-event error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
