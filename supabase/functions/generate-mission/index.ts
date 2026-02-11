import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un motor profesional de generación narrativa para Dungeon Masters de Dungeons & Dragons 5e ambientado exclusivamente en Forgotten Realms.

OBJETIVO: Generar contenido jugable, coherente, diverso y estructurado para campañas reales.

REGLAS:
- Usa únicamente lore oficial de Forgotten Realms.
- Mantén coherencia histórica, geográfica y política.
- Introduce conflictos claros y consecuencias reales.
- Cada misión DEBE incluir al menos dos de: intriga social/política, investigación, combate significativo, puzzle/desafío lógico, dilema moral, giro narrativo inesperado.

FORMATO DE RESPUESTA (usa markdown):

## 🗡️ [Título de la Misión]

### 📜 Resumen
[Resumen breve de la misión en 2-3 oraciones]

### 🪝 Gancho Narrativo
[Cómo los aventureros se enteran de la misión]

### 📍 Ubicación
[Lugar específico en Forgotten Realms con descripción atmosférica]

### 🎭 NPCs Clave
[Lista de NPCs con nombre, raza, clase/ocupación, motivación y secreto]

### ⚔️ Encuentros
[2-3 encuentros detallados con nivel de dificultad sugerido]

### 🧩 Elementos Narrativos
[Qué elementos incluye: intriga, investigación, combate, puzzle, dilema moral, giro]

### 🏆 Recompensas
[Tesoro, objetos mágicos, alianzas, información]

### 🔄 Consecuencias
[Qué pasa si los jugadores tienen éxito o fracasan]

### 📝 Notas para el DM
[Consejos de interpretación, música sugerida, variaciones posibles]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignName, campaignDescription, levelRange, previousMissions, customPrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userPrompt = `Genera una misión para la campaña "${campaignName}".`;
    if (campaignDescription) userPrompt += `\nDescripción de la campaña: ${campaignDescription}`;
    if (levelRange) userPrompt += `\nRango de nivel de los jugadores: ${levelRange}`;
    if (previousMissions && previousMissions.length > 0) {
      userPrompt += `\n\nMisiones anteriores (mantén continuidad y evita repetir estructuras):\n`;
      previousMissions.forEach((m: string, i: number) => {
        userPrompt += `${i + 1}. ${m}\n`;
      });
    }
    if (customPrompt) userPrompt += `\n\nInstrucciones adicionales del DM: ${customPrompt}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento antes de intentar de nuevo." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Añade más créditos en tu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-mission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
