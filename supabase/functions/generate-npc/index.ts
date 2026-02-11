import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userPrompt = "Genera un PNJ profundo, memorable y narrativamente útil para una campaña de D&D 5e en Forgotten Realms.";
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
        model: "google/gemini-3-flash-preview",
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
    console.error("generate-npc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
