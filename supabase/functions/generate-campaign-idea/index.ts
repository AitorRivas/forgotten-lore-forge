import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un diseñador profesional de campañas para Dungeons & Dragons 5e en Forgotten Realms.

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
[Cómo la amenaza escala a lo largo de la campaña — de local a regional a potencialmente mundial]

### 🏛️ Facciones
[3-5 facciones involucradas, cada una con nombre, objetivo, y relación con el conflicto principal]

### 💥 Evento Detonante
[El evento que pone todo en marcha — cómo los aventureros se ven involucrados]

### 🔄 Giros Narrativos
[3-4 giros que redefinen la historia a lo largo de la campaña]

### ⚖️ Dilemas Morales
[3-4 dilemas sin respuesta fácil que los jugadores enfrentarán]

### 🎮 Estilo de Juego
[Proporción de: combate, exploración, intriga social, investigación, horror, humor]

### 📊 Progresión
- **Nivel inicial:** [nivel]
- **Nivel final:** [nivel]
- **Duración estimada:** [número de sesiones]

### 💡 Notas para el DM
[Tono, inspiraciones, bandas sonoras sugeridas, advertencias de contenido si aplica]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    let userPrompt = "Genera una idea de campaña épica, original y completa para D&D 5e en Forgotten Realms.";
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-campaign-idea error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
