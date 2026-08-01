import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto en lore de Forgotten Realms y editor narrativo de campañas de D&D 5.5e (reglas 2024).

Tu trabajo es REVISAR contenido generado y validar su coherencia. No inventas contenido nuevo — solo corriges y señalas problemas.

PROCESO DE VALIDACIÓN:

1. **Coherencia con Forgotten Realms:** Verifica nombres, lugares, facciones, deidades, eventos históricos, geografía y cultura.

2. **Coherencia interna de campaña:** Verifica que el contenido no contradiga eventos previos ni decisiones del grupo.

3. **Coherencia de PNJs:** Verifica personalidad, motivaciones y afiliaciones consistentes.

4. **Progresión narrativa:** Evalúa si el contenido progresa lógicamente.

FORMATO DE RESPUESTA (usa markdown):

## ✅ Informe de Validación de Lore y Continuidad

### 📊 Resultado General
- **Estado:** [✅ Válido | ⚠️ Con observaciones | ❌ Requiere correcciones]
- **Puntuación de coherencia:** [1-10]

### 🌍 Coherencia con Forgotten Realms
[Problemas y correcciones]

### 📜 Coherencia con la Campaña
[Inconsistencias]

### 🧍 Coherencia de PNJs
[Revisión de PNJs]

### 📈 Progresión Narrativa
[Evaluación]

### 🔧 Contenido Corregido
[Solo secciones problemáticas]

### 📌 Recomendaciones Finales
[Sugerencias]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    const prompt = customPrompt
      ? `Revisa y valida el siguiente contenido para D&D 5.5e (reglas 2024) en Forgotten Realms:\n\n${customPrompt}`
      : `Genera un ejemplo de informe de validación para una misión típica de D&D 5.5e (reglas 2024) en Forgotten Realms.`;

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!aiResult) {
      return new Response(JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResult.response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider } });
  } catch (e) {
    console.error("validate-lore error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});