import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto creador de personajes jugadores (PCs) para Dungeons & Dragons 5.5e (reglas 2024) ambientado en Forgotten Realms.

Genera personajes profundos, jugables, con historia coherente con el lore oficial.

FORMATO DE RESPUESTA (usa markdown):

## 🎭 [Nombre del Personaje]

### 📋 Ficha Básica
- **Raza:** [raza oficial de D&D 5.5e (reglas 2024)]
- **Clase:** [clase y subclase sugerida]
- **Trasfondo:** [trasfondo oficial o personalizado]
- **Alineamiento:** [alineamiento]
- **Nivel sugerido:** [nivel]

### 🧠 Personalidad
- **Rasgos:** [2-3 rasgos de personalidad distintivos]
- **Ideales:** [qué principios guían al personaje]
- **Vínculos:** [personas, lugares u objetos importantes]
- **Defectos:** [debilidades de carácter]

### 🎯 Objetivos
- **Objetivo principal:** [meta a largo plazo]
- **Objetivo secundario:** [meta personal más íntima]

### 😰 Miedo Principal
[Describe el miedo más profundo del personaje y cómo afecta su comportamiento]

### 🤫 Secreto
[Un secreto que el personaje guarda — puede ser sobre su pasado, su familia, sus poderes, etc.]

### ⚡ Conflicto Interno
[La tensión interna que define al personaje — entre deber y deseo, pasado y presente, etc.]

### 📖 Historia
[Historia de 3-5 párrafos coherente con el lore de Forgotten Realms. Incluye origen, eventos formativos, y cómo llegó a ser aventurero]

### 🪝 Gancho para Campaña
[Cómo este personaje puede integrarse en una campaña existente. Incluye 2-3 ganchos narrativos que un DM pueda usar]

### 🔗 Conexiones Potenciales
[3-4 conexiones con facciones, organizaciones o NPCs conocidos de Forgotten Realms que el DM pueda explotar]

### 💡 Consejos de Interpretación
[Tips para rolear este personaje: manías, frases típicas, reacciones habituales]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { customPrompt } = await req.json();
    let userPrompt = "Genera un personaje jugador único y memorable para una campaña de D&D 5.5e (reglas 2024) en Forgotten Realms.";
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
    console.error("generate-pc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});