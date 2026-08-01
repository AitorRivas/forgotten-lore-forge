import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un diseñador profesional de campañas para Dungeons & Dragons 5.5e (reglas 2024) en Forgotten Realms.

Genera ideas de campaña completas, épicas y jugables con estructura narrativa sólida.

FORMATO DE RESPUESTA (usa markdown):

## 🌍 [Título de la Campaña]

### 📜 Concepto
[Pitch de 2-3 oraciones que capture la esencia de la campaña]

### 📍 Región
[Región oficial de Forgotten Realms con descripción del entorno y ambiente]

### 🎭 Tema Central
[El tema filosófico/narrativo que recorre toda la campaña]

### ⚔️ Conflicto Principal
[El gran conflicto que los aventureros deben resolver — con matices y complejidad]

### 🦹 Antagonista Principal
- **Nombre:** [nombre]
- **Naturaleza:** [qué es]
- **Motivación:** [por qué hace lo que hace — debe ser comprensible]
- **Método:** [cómo opera]
- **Debilidad:** [punto vulnerable]
- **Razón legítima:** [por qué alguien podría estar de acuerdo con él]

### 📈 Amenaza Progresiva
[Cómo la amenaza escala a lo largo de la campaña]

### 🏛️ Facciones
[3-5 facciones involucradas]

### 💥 Evento Detonante
[El evento que pone todo en marcha]

### 🔄 Giros Narrativos
[3-4 giros que redefinen la historia]

### ⚖️ Dilemas Morales
[3-4 dilemas sin respuesta fácil]

### 🎮 Estilo de Juego
[Proporción de: combate, exploración, intriga social, investigación, horror, humor]

### 📊 Progresión
- **Nivel inicial:** [nivel]
- **Nivel final:** [nivel]
- **Duración estimada:** [número de sesiones]

### 💡 Notas para el DM
[Tono, inspiraciones, bandas sonoras sugeridas]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    let userPrompt = "Genera una idea de campaña épica, original y completa para D&D 5.5e (reglas 2024) en Forgotten Realms.";
    if (customPrompt) userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!aiResult) {
      return new Response(JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResult.response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider } });
  } catch (e) {
    console.error("generate-campaign-idea error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});