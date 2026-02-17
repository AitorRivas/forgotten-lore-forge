import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un Dungeon Master profesional que convierte contenido narrativo en guiones ejecutables.

Tu trabajo es transformar misiones o contenido en GUIONES LISTOS PARA JUGAR: descripciones evocadoras, escenas estructuradas, decisiones ramificadas y cliffhangers.

Incluye las siguientes secciones en tu respuesta:

## Guión de Sesión: [Título]

### Resumen para el DM
[Párrafo conciso de 2-3 líneas]

### Escenas (2-4 escenas principales)
Para cada escena:
- **Objetivo:** qué debe lograr el DM
- **Ambientación:** descripción sensorial
- **PNJs presentes:** quiénes están
- **Entrada del jugador:** cómo comienza
- **Descripción narrativa (lee esto):** Párrafo atmosférico de 3-4 líneas
- **Decisiones posibles:** opciones de los jugadores con resultados
- **Encuentro (si aplica):** tipo, enemigos, dificultad

### Árbol de Resultados Alternativos
Triunfo / Fracaso / Resultado mixto

### Pistas y Secretos
Pistas descubribles y secretos ocultos

### Encuentros Principales
Detallados con stats

### Cliffhanger / Gancho para Próxima Sesión
Revelación impactante

### Notas para el DM
Consejos prácticos`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();

    const userPrompt = customPrompt
      ? `Convierte este contenido en un guión de sesión ejecutable:\n\n${customPrompt}`
      : `Crea un guión de sesión completo y original para un grupo de aventureros de nivel 5-7 en Forgotten Realms.`;

    const aiResult = await generateWithFallback(SYSTEM_PROMPT, userPrompt, {
      contentType: "session-script",
      outputFormat: "markdown",
      stream: true,
      model: "gemini-2.5-pro",
    });

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "Los servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(aiResult.response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider } });
  } catch (e) {
    console.error("generate-session-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
