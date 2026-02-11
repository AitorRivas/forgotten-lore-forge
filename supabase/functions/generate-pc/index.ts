import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto creador de personajes jugadores (PCs) para Dungeons & Dragons 5e ambientado en Forgotten Realms.

Genera personajes profundos, jugables, con historia coherente con el lore oficial.

FORMATO DE RESPUESTA (usa markdown):

## 🎭 [Nombre del Personaje]

### 📋 Ficha Básica
- **Raza:** [raza oficial de D&D 5e]
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    let userPrompt = "Genera un personaje jugador único y memorable para una campaña de D&D 5e en Forgotten Realms.";
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
    console.error("generate-pc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
