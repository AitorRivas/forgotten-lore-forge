import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un diseñador de encuentros y estructurador de gameplay para D&D 5e en Forgotten Realms.

Tu trabajo es transformar contenido narrativo en FORMATO MECÁNICAMENTE JUGABLE. No generas lore nuevo — reestructuras lo existente en bloques ejecutables en mesa.

FORMATO DE RESPUESTA (usa markdown):

## ⚙️ Estructura de Gameplay: [Título]

### 📋 Resumen Ejecutivo
- **Duración estimada:** [horas]
- **Nivel recomendado:** [rango]
- **Tipo dominante:** [combate|social|exploración|investigación|mixto]
- **Dificultad general:** [Fácil|Media|Difícil|Mortal]

---

### 🎬 Escenas Estructuradas
[Escenas con mecánicas, triggers, tiradas, transiciones]

### ⚔️ Encuentros Detallados
[Con CR, terreno táctico, fases, condiciones victoria/derrota]

### 🪝 Ganchos Narrativos
[Tabla de ganchos con tipo, momento y efecto]

### 🎯 Objetivos Claros
[Principal, secundarios, secreto]

### 💥 Consecuencias
[Tablas mecánicas y narrativas por resultado]

### 📌 Notas de Ejecución para el DM
[Timing, improvisación, pacing, props]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    const prompt = customPrompt
      ? `Transforma el siguiente contenido narrativo en formato de gameplay estructurado:\n\n${customPrompt}`
      : `Crea una estructura de gameplay completa y original para una sesión de D&D 5e nivel 5-7 en Forgotten Realms.`;

    const response = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: prompt }],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("structure-gameplay error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});