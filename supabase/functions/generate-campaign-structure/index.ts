import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un arquitecto narrativo profesional para campañas de Dungeons & Dragons 5e en Forgotten Realms.

Tu trabajo es construir la ESTRUCTURA COMPLETA de una campaña: actos, capítulos, misiones detalladas, con evolución narrativa coherente.

FORMATO DE RESPUESTA (usa markdown):

## 🏰 Estructura de Campaña: [Título]

### 📊 Resumen Estructural
- **Actos totales:** [número]
- **Capítulos totales:** [número]
- **Misiones totales:** [número]
- **Niveles:** [inicio] → [final]
- **Sesiones estimadas:** [rango]

---

Para CADA ACTO genera:

### 🎬 Acto [N]: [Título del Acto]
**Tema:** [tema del acto]
**Niveles:** [rango]
**Objetivo narrativo:** [qué debe lograr este acto]

Para cada CAPÍTULO dentro del acto:

#### 📕 Capítulo [N.M]: [Título]
**Eventos clave:** [qué sucede]

Para cada MISIÓN dentro del capítulo:

##### ⚔️ Misión: [Título]
- **Objetivo:** [qué deben hacer los aventureros]
- **Conflicto:** [el conflicto central de esta misión]
- **Tipo:** [investigación|combate|social|exploración|infiltración|defensa|puzzle]
- **Giro:** [el giro narrativo de esta misión]
- **Consecuencias:** [qué pasa según el resultado — afecta al resto de la campaña]

---

### 🦹 Evolución del Antagonista
[Cómo cambia el antagonista a lo largo de los actos — sus planes, reacciones a los jugadores, escalada]

### 🎭 Eventos Sociales Clave
[Momentos diplomáticos, festivales, juicios, bodas, funerales que marcan la campaña]

### 🔍 Arcos de Investigación
[Misterios que los jugadores van desentrañando a lo largo de múltiples sesiones]

### ⚔️ Combates Épicos
[Los 3-5 combates más importantes de la campaña con contexto narrativo]

### 🧩 Puzzles y Desafíos
[Puzzles, acertijos o desafíos lógicos integrados en la narrativa]

### 🔚 Finales Múltiples
[Al menos 3 posibles finales dependiendo de las decisiones del grupo]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userPrompt = "Construye la estructura completa de una campaña épica de D&D 5e en Forgotten Realms con actos, capítulos, misiones detalladas y finales múltiples.";
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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
    console.error("generate-campaign-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
