import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };

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
    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: "Genera una campaña original e inesperada para D&D 5e en Faerûn. Sorpréndeme." }],
      { model: "gemini-2.5-flash" }
    );

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "No hay proveedores de IA disponibles en este momento. Inténtalo en unos minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResult.response.json();
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