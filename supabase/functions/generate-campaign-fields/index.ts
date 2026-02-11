import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };

async function callAIWithFallback(messages: any[], options: { model?: string } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-flash"; const body = { model: geminiModel, messages };
  if (GEMINI_API_KEY) { const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (resp.ok) return resp; if (resp.status === 429) console.log("Gemini rate limited, trying Lovable AI..."); else console.error("Gemini error:", resp.status); }
  if (LOVABLE_API_KEY) { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: `google/${geminiModel}` }) }); if (resp.ok) return resp; console.error("Lovable AI error:", resp.status); }
  return null;
}

const SYSTEM_PROMPT = `Eres un diseñador profesional de campañas de D&D 5e en Forgotten Realms (Faerûn).

Genera los datos de una campaña original en formato JSON puro. Sin texto fuera del JSON.

Las regiones válidas son (usa exactamente estos nombres):
"Costa de la Espada", "Norte", "Valles", "Cormyr", "Sembia", "Mar de la Luna", "Corazón Occidental", "Amn", "Tethyr", "Calimshan", "Chult", "Thay", "Rashemen", "Aglarond", "Este Inaccesible", "Turmish", "Alcance de Vilhon", "Costa del Dragón", "Costa del Mar de las Estrellas Caídas", "Impiltur", "Damara", "Vaasa", "Gran Valle", "Thesk", "Mulhorand", "Unther", "Chessenta", "Halruaa", "Luiren", "Shaar", "Reinos Fronterizos", "Lapaliiya", "Samarach", "Var el Dorado", "Estagund", "Durpar", "Ulgarth", "Anauroch"

Los tonos válidos son: "épico", "oscuro", "misterioso", "cómico", "político", "exploración", "horror"

Los rangos de nivel válidos son: "1-5", "5-10", "11-16", "17-20"

FORMATO JSON OBLIGATORIO:
{
  "name": "Título épico y evocador de la campaña (máx 60 caracteres)",
  "description": "Premisa narrativa de 2-4 frases que enganche al DM.",
  "region": "Una de las regiones válidas",
  "tone": "Uno de los tonos válidos",
  "levelRange": "Uno de los rangos válidos"
}

REGLAS:
- El nombre debe ser memorable y temático.
- La descripción debe ser una premisa jugable.
- Devuelve SOLO el JSON, sin markdown, sin explicaciones.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const response = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: "Genera una campaña original e inesperada para D&D 5e en Faerûn. Sorpréndeme." }],
      { model: "gemini-2.5-flash" }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-campaign-fields error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});