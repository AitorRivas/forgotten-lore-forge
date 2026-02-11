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

    const { region, tone, campaignContext, narrativeContext, partyLevel, mysteryType, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de arcos de investigación para D&D 5e en Forgotten Realms.
Creas misterios complejos, jugables y con múltiples capas que recompensan la deducción del grupo.

REGLAS:
- La verdad oculta debe ser sorprendente pero lógica en retrospectiva
- Usar el sistema de "tres pistas": cada conclusión importante tiene al menos 3 pistas independientes que llevan a ella (regla de los tres indicios de Alexandrian)
- Las pistas falsas deben ser creíbles pero distinguibles con investigación profunda
- Los sospechosos deben tener motivo, medios y oportunidad creíbles
- Los obstáculos sociales deben requerir roleplay, no solo tiradas
- Nunca bloquear la investigación detrás de una sola tirada de dado
- Los giros narrativos deben recontextualizar pistas anteriores
- La revelación final debe ser dramáticamente satisfactoria
- Integrar con el lore oficial de Forgotten Realms

TIPOS DE MISTERIO: asesinato, robo, conspiración política, infiltración, desaparición, sabotaje, corrupción, culto secreto, contrabando, chantaje, suplantación de identidad, maldición.

FORMATO DE RESPUESTA (JSON estricto):
{
  "title": "nombre de la investigación",
  "mystery_type": "tipo",
  "hook": "cómo llega a los PJs",
  "crime_or_mystery": {"description": "qué ha ocurrido aparentemente", "victim": "afectado", "when": "cuándo", "where": "dónde", "apparent_motive": "lo que parece"},
  "hidden_truth": {"real_culprit": "quién es realmente responsable", "real_motive": "motivación verdadera", "method": "cómo lo hizo", "why_hidden": "por qué es difícil de descubrir"},
  "suspects": [
    {"name": "nombre", "role": "cargo/oficio", "motive": "motivo aparente", "means": "medios", "opportunity": "oportunidad", "alibi": "coartada", "alibi_flaw": "fallo en la coartada", "guilty": false, "what_they_hide": "qué ocultan aunque sean inocentes"}
  ],
  "real_clues": [
    {"clue": "descripción", "location": "dónde encontrarla", "discovery_method": "cómo descubrirla", "what_it_reveals": "qué demuestra", "connects_to": "a qué otra pista conecta", "difficulty": "easy|medium|hard"}
  ],
  "false_leads": [
    {"clue": "pista falsa", "why_misleading": "por qué despista", "how_to_debunk": "cómo descartarla", "planted_by": "quién la colocó y por qué"}
  ],
  "investigation_scenes": [
    {"scene": "nombre/lugar", "description": "qué encuentran", "npcs_present": ["PNJs disponibles"], "clues_available": ["pistas obtenibles"], "challenges": ["obstáculos"], "skills_useful": ["habilidades relevantes"], "possible_outcomes": ["resultados posibles"]}
  ],
  "social_obstacles": [
    {"obstacle": "descripción", "blocking_npc": "quién bloquea", "motivation": "por qué bloquean", "solutions": ["formas de superar sin violencia"], "consequences_of_force": "qué pasa si usan fuerza"}
  ],
  "narrative_twists": [
    {"twist": "descripción", "trigger": "qué lo activa", "recontextualizes": "qué pistas anteriores cambian de significado", "emotional_impact": "impacto dramático"}
  ],
  "final_revelation": {"scene": "escena de revelación", "dramatic_moment": "momento dramático", "proof": "evidencia definitiva", "culprit_reaction": "reacción del culpable", "resolution_options": ["formas de resolver"]},
  "timeline": [{"phase": "fase", "focus": "enfoque", "key_scenes": ["escenas"], "pacing_notes": "ritmo sugerido"}],
  "dm_notes": "Consejos para dirigir la investigación sin frustrar ni regalar",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Costa de la Espada"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
TIPO DE MISTERIO: ${mysteryType || "cualquiera"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Diseña una investigación compleja, jugable y dramáticamente satisfactoria.`;

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

    let investigation;
    try {
      investigation = JSON.parse(content);
    } catch {
      investigation = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ investigation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-investigation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
