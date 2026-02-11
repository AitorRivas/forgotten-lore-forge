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

    const { region, tone, campaignContext, narrativeContext, partyLevel, locationType, specificRequest } = await req.json();

    const systemPrompt = `Eres un diseñador de localizaciones vivas para D&D 5e en Forgotten Realms.
Creas lugares que se sienten habitados, dinámicos y llenos de posibilidades narrativas.

REGLAS:
- La localización debe existir coherentemente dentro de la geografía oficial de Forgotten Realms
- El clima social debe reflejar tensiones reales entre grupos
- La economía debe ser lógica para la región y recursos disponibles
- Las facciones presentes deben tener motivaciones canónicas
- Los rumores mezclan verdad y ficción de forma natural
- Los lugares clave deben ser utilizables en sesión (tabernas, templos, callejones, tiendas)
- Los eventos aleatorios deben poder ocurrir en cualquier visita
- Los PNJs residentes deben tener personalidad y utilidad narrativa
- Los secretos ocultos deben premiar la exploración profunda

TIPOS DE LOCALIZACIÓN: ciudad, pueblo, aldea, fortaleza, ruina, templo, bosque, cueva, puerto, mercado, campamento, torre, mansión, barrio bajo, distrito noble, cruce de caminos.

FORMATO DE RESPUESTA (JSON estricto):
{
  "name": "nombre de la localización",
  "type": "tipo",
  "official_region": "región oficial de FR",
  "brief_history": "historia en 3-4 frases",
  "current_state": "estado actual en 1-2 frases",
  "social_climate": {"general_mood": "ánimo general", "tensions": ["tensiones activas"], "power_dynamics": "quién manda realmente"},
  "economy": {"primary_industry": "industria principal", "trade_goods": ["bienes comerciales"], "economic_health": "poor|struggling|stable|prosperous|booming", "black_market": "qué se vende bajo cuerda"},
  "factions_present": [
    {"faction": "nombre", "influence": "low|medium|high|dominant", "leader_local": "líder local", "agenda": "qué buscan aquí", "public_face": "qué dicen hacer", "real_activity": "qué hacen realmente"}
  ],
  "active_rumors": [
    {"rumor": "lo que se dice", "truth_percentage": 0-100, "heard_at": "dónde se escucha", "narrative_potential": "qué puede desencadenar"}
  ],
  "local_conflicts": [
    {"conflict": "descripción", "parties": ["involucrados"], "stakes": "qué está en juego", "current_status": "simmering|escalating|open|resolved_temporarily"}
  ],
  "key_locations": [
    {"name": "nombre del lugar", "type": "tipo", "description": "descripción breve", "owner": "propietario", "notable_feature": "qué lo hace especial", "hook": "gancho narrativo"}
  ],
  "random_events": [
    {"event": "descripción", "trigger": "cuándo ocurre", "probability": "common|uncommon|rare", "consequences": "qué desencadena"}
  ],
  "resident_npcs": [
    {"name": "nombre", "role": "oficio/cargo", "personality": "rasgo dominante", "secret": "qué oculta", "useful_for": "en qué puede ayudar a los PJs", "quest_hook": "misión potencial"}
  ],
  "hidden_secrets": [
    {"secret": "descripción", "discovery_method": "cómo encontrarlo", "narrative_impact": "qué cambia si se descubre", "danger_level": "none|low|medium|high|deadly"}
  ],
  "atmosphere": {"sights": "lo que se ve", "sounds": "lo que se oye", "smells": "lo que se huele", "feeling": "la sensación general"},
  "dm_notes": "Consejos para dar vida a esta localización",
  "summary": "Resumen de 2-3 frases"
}`;

    const userPrompt = `REGIÓN: ${region || "Costa de la Espada"}
TONO: ${tone || "épico"}
NIVEL DEL GRUPO: ${partyLevel || "5-10"}
TIPO DE LOCALIZACIÓN: ${locationType || "cualquiera"}
${specificRequest ? `PETICIÓN ESPECÍFICA: ${specificRequest}` : ""}

CONTEXTO DE CAMPAÑA:\n${JSON.stringify(campaignContext || {}, null, 2)}

MEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext || {}, null, 2)}

Genera una localización viva, detallada y jugable.`;

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

    let location;
    try {
      location = JSON.parse(content);
    } catch {
      location = { raw: content, parse_error: true };
    }

    return new Response(JSON.stringify({ location }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-location error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
