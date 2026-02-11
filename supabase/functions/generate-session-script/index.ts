import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithFallback(messages: any[], options: { model?: string; stream?: boolean } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro";
  const body: any = { model: geminiModel, messages };
  if (options.stream) body.stream = true;

  if (GEMINI_API_KEY) {
    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (resp.ok) return resp;
    if (resp.status !== 429) console.error("Gemini error:", resp.status); else console.log("Gemini rate limited, trying Lovable AI...");
  }
  if (LOVABLE_API_KEY) {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: `google/${geminiModel}` }),
    });
    if (resp.ok) return resp;
    console.error("Lovable AI error:", resp.status);
  }
  return null;
}

const SYSTEM_PROMPT = `Eres un Dungeon Master profesional que convierte contenido narrativo en guiones ejecutables.

Tu trabajo es transformar misiones o contenido en GUIONES LISTOS PARA JUGAR: descripciones evocadoras, escenas estructuradas, decisiones ramificadas y cliffhangers.

FORMATO DE RESPUESTA (usa markdown):

## 🎭 Guión de Sesión: [Título]

### 📋 Resumen para el DM
[Párrafo conciso de 2-3 líneas]

---

### 🎬 Escenas (2-4 escenas principales)

#### Escena 1: [Nombre evocador]
**Objetivo:** [qué debe lograr el DM]
**Ambientación:** [descripción sensorial]
**PNJs presentes:** [quiénes están]
**Entrada del jugador:** [cómo comienza]

**Descripción narrativa (lee esto):**
[Párrafo de 3-4 líneas atmosférico]

**Decisiones posibles:**
- **Si dialogan con [NPC]:** [resultado]
- **Si investigan [lugar]:** [descubrimiento]
- **Si actúan violentamente:** [consecuencias]
- **Si intentan escapar:** [evolución]

**Encuentro (si aplica):**
- **Tipo:** [combate|social|exploración|puzzle]
- **Enemigos/desafío:** [qué se opone]
- **Dificultad:** [Fácil|Medio|Difícil|Mortal]

---

### 🧩 Árbol de Resultados Alternativos
[Triunfo / Fracaso / Resultado mixto]

### 💡 Pistas y Secretos
[Pistas descubribles y secretos ocultos]

### ⚔️ Encuentros Principales
[Detallados con stats]

### 🔮 Cliffhanger / Gancho para Próxima Sesión
[Revelación impactante]

### 📌 Notas para el DM
[Consejos prácticos]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    const prompt = customPrompt
      ? `Convierte este contenido en un guión de sesión ejecutable:\n\n${customPrompt}`
      : `Crea un guión de sesión completo y original para un grupo de aventureros de nivel 5-7 en Forgotten Realms.`;

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
    console.error("generate-session-script error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});