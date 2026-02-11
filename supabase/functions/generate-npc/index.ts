import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithFallback(messages: any[], options: { model?: string; stream?: boolean; temperature?: number; response_mime_type?: string } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro";
  const lovableModel = `google/${geminiModel}`;
  const body: any = { model: geminiModel, messages };
  if (options.stream) body.stream = true;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.response_mime_type) body.response_mime_type = options.response_mime_type;

  // Try Gemini first
  if (GEMINI_API_KEY) {
    const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (resp.ok) return resp;
    if (resp.status !== 429) {
      const t = await resp.text();
      console.error("Gemini error:", resp.status, t);
      // Fall through to Lovable AI
    } else {
      console.log("Gemini rate limited, falling back to Lovable AI...");
    }
  }

  // Fallback to Lovable AI
  if (LOVABLE_API_KEY) {
    const lovableBody = { ...body, model: lovableModel };
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(lovableBody),
    });
    if (resp.ok) return resp;
    if (resp.status === 429) {
      console.error("Both Gemini and Lovable AI rate limited");
      return null; // Both failed
    }
    if (resp.status === 402) {
      console.error("Lovable AI: payment required");
      return null;
    }
    const t = await resp.text();
    console.error("Lovable AI error:", resp.status, t);
  }

  return null;
}

const SYSTEM_PROMPT = `Eres un experto creador de Personajes No Jugadores (PNJs/NPCs) para Dungeons & Dragons 5e en Forgotten Realms.

Genera PNJs profundos, complejos, con motivaciones ocultas y utilidad narrativa real para el DM.

FORMATO DE RESPUESTA (usa markdown):

## 🧍 [Nombre del PNJ]

### 📋 Datos Básicos
- **Raza:** [raza]
- **Género:** [género]
- **Edad:** [edad aproximada]
- **Rol:** [ocupación/función en la historia]
- **Alineamiento:** [alineamiento real, puede diferir del aparente]
- **Alineamiento aparente:** [lo que parece ser]

### 👁️ Apariencia
[Descripción física detallada: rasgos distintivos, vestimenta, manías físicas, primera impresión]

### 🧠 Personalidad
- **En superficie:** [cómo se presenta al mundo]
- **En privado:** [cómo es realmente]
- **Bajo presión:** [cómo reacciona en crisis]
- **Muletilla/frase típica:** [algo que dice siempre]

### 📖 Historia
[Historia de 3-4 párrafos: origen, eventos que lo moldearon, cómo llegó a su posición actual]

### 🎯 Motivaciones Ocultas
[Las verdaderas razones detrás de sus acciones — pueden contradecir lo que dice]

### 🤫 Secretos
1. [Secreto menor — fácil de descubrir]
2. [Secreto mayor — requiere investigación]
3. [Secreto devastador — cambiaría todo si se revela]

### 🏛️ Afiliaciones
[Facciones, gremios, organizaciones a las que pertenece o sirvió. Incluye facciones oficiales de FR si aplica]

### 💰 Recursos
[Qué tiene a su disposición: dinero, contactos, información, objetos, favores, ejército, etc.]

### 🗡️ Posibles Traiciones
[En qué circunstancias traicionaría a los aventureros o a sus aliados. Qué lo haría cambiar de bando]

### 📈 Evolución Narrativa
[Cómo puede cambiar este PNJ a lo largo de la campaña — arcos posibles de redención, corrupción, o revelación]

### 🪝 Ganchos de Misión
[3-4 misiones o situaciones que este PNJ puede detonar para los aventureros]

### 💡 Notas para el DM
[Consejos para interpretarlo: voz, gestos, cómo reacciona a diferentes tipos de jugadores]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();

    let userPrompt = "Genera un PNJ profundo, memorable y narrativamente útil para una campaña de D&D 5e en Forgotten Realms.";
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;
    }

    const response = await callAIWithFallback(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!response) {
      return new Response(
        JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-npc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});