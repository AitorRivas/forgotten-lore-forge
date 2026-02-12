import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithFallback(messages: any[], options: { model?: string; stream?: boolean } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro"; const body: any = { model: geminiModel, messages };
  if (options.stream) body.stream = true;
  if (GEMINI_API_KEY) { try { const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (resp.ok) return resp; if (resp.status === 429) console.log("Gemini rate limited..."); else console.error("Gemini error:", resp.status); } catch (e) { console.error("Gemini fetch error:", e); } }
  if (LOVABLE_API_KEY) { try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: `google/${geminiModel}` }) }); if (resp.ok) return resp; if (resp.status === 429 || resp.status === 402) console.log("Lovable AI (Google) unavailable, trying ChatGPT..."); else console.error("Lovable AI error:", resp.status); } catch (e) { console.error("Lovable AI error:", e); } }
  if (LOVABLE_API_KEY) { const m = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5"; try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: m }) }); if (resp.ok) return resp; console.error("ChatGPT fallback error:", resp.status); } catch (e) { console.error("ChatGPT error:", e); } }
  return null;
}

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
[Cómo cambia el antagonista a lo largo de los actos]

### 🎭 Eventos Sociales Clave
[Momentos diplomáticos, festivales, juicios, bodas, funerales]

### 🔍 Arcos de Investigación
[Misterios que los jugadores van desentrañando]

### ⚔️ Combates Épicos
[Los 3-5 combates más importantes]

### 🧩 Puzzles y Desafíos
[Puzzles, acertijos o desafíos lógicos integrados]

### 🔚 Finales Múltiples
[Al menos 3 posibles finales]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    let userPrompt = "Construye la estructura completa de una campaña épica de D&D 5e en Forgotten Realms con actos, capítulos, misiones detalladas y finales múltiples.";
    if (customPrompt) userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;

    const response = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("generate-campaign-structure error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});