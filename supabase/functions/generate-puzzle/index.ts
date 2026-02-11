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

    const { region, tone, campaignContext, narrativeContext, partyLevel, puzzleType, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de puzzles para D&D 5e en Forgotten Realms.
Creas puzzles jugables, lógicos, visualmente descriptivos y narrativamente integrados.

REGLAS:
- El puzzle debe ser resoluble con lógica, no con tiradas de dado aleatorias
- Incluir pistas graduales para evitar bloqueos (mínimo 3 niveles de pista)
- Las soluciones alternativas deben premiar creatividad sin trivializar el desafío
- Las consecuencias por fallo nunca deben ser un callejón sin salida narrativo
- Integrar el puzzle con el lore de Forgotten Realms (runas élficas, magia Weave, Netheril, etc.)
- La descripción visual debe ser lo suficientemente clara para que el DM la transmita sin mapa

TIPOS DE PUZZLE: mecánico (palancas, engranajes, presión), lógico (secuencias, patrones, deducción), mágico (runas, elementales, Weave), ambiental (terreno, agua, luz), social (acertijos de guardianes, negociación), temporal (secuencias cronológicas, loops), musical (tonos, ritmos, armonías).

FORMATO DE RESPUESTA (JSON estricto):
{
  "title": "nombre del puzzle",
  "puzzle_type": "tipo",
  "difficulty": "easy|medium|hard|deadly",
  "estimated_time": "minutos estimados en mesa",
  "narrative_context": {"setting": "dónde se encuentra", "origin": "quién lo creó y por qué", "lore_connection": "conexión con lore de FR", "story_role": "por qué los PJs deben resolverlo"},
  "visual_description": {"room_description": "descripción detallada del espacio", "key_elements": ["elementos visuales importantes"], "sensory_details": {"sight": "...", "sound": "...", "smell": "...", "touch": "...", "magic_sense": "para detect magic"}},
  "mechanics": {"core_mechanism": "cómo funciona el puzzle", "components": [{"element": "nombre", "function": "qué hace", "interaction": "cómo interactuar"}], "solution_steps": ["paso 1", "paso 2", "..."], "correct_solution": "solución completa explicada"},
  "gradual_hints": [
    {"level": 1, "trigger": "tras 5 min sin progreso / Investigación DC 10", "hint": "pista sutil"},
    {"level": 2, "trigger": "tras 10 min / Investigación DC 15", "hint": "pista más directa"},
    {"level": 3, "trigger": "tras 15 min / Arcana DC 12", "hint": "casi la respuesta"}
  ],
  "common_mistakes": [{"mistake": "error típico", "consequence": "qué pasa", "recovery": "cómo recuperarse"}],
  "failure_consequences": {"partial_failure": "fallo parcial - qué ocurre", "total_failure": "fallo total - qué ocurre", "narrative_bypass": "cómo avanza la historia si no se resuelve"},
  "alternative_solutions": [{"approach": "método alternativo", "requirements": "qué necesitan los PJs", "outcome": "resultado comparado con solución ideal"}],
  "story_integration": {"success_reward": "recompensa narrativa", "loot": "objetos obtenidos", "information_gained": "qué aprenden", "future_hooks": ["semillas narrativas que planta"]},
  "dm_tips": "Consejos para dirigir este puzzle",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Forgotten Realms"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
TIPO DE PUZZLE PREFERIDO: ${puzzleType || "cualquiera"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Diseña un puzzle jugable, lógico y narrativamente integrado.`;

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

    let puzzle;
    try {
      puzzle = JSON.parse(content);
    } catch {
      puzzle = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ puzzle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-puzzle error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
