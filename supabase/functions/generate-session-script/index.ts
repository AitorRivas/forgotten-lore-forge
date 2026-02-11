import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un Dungeon Master profesional que convierte contenido narrativo en guiones ejecutables.

Tu trabajo es transformar misiones o contenido en GUIONES LISTOS PARA JUGAR: descripciones evocadoras, escenas estructuradas, decisiones ramificadas y cliffhangers.

FORMATO DE RESPUESTA (usa markdown):

## 🎭 Guión de Sesión: [Título]

### 📋 Resumen para el DM
[Párrafo conciso de 2-3 líneas: qué pasa en esta sesión, objetivos principales, tono]

---

### 🎬 Escenas (2-4 escenas principales)

#### Escena 1: [Nombre evocador]
**Objetivo:** [qué debe lograr el DM en esta escena]
**Ambientación:** [descripción sensorial: sonidos, olores, luz, atmósfera]
**PNJs presentes:** [quiénes están aquí y qué hacen]
**Entrada del jugador:** [cómo comienza para los jugadores]

**Descripción narrativa (lee esto):**
[Párrafo de 3-4 líneas: atmósfera rica, detalles sensoriales, sensación de peligro o misterio]

**Decisiones posibles:**
- **Si dialogan con [NPC]:** [resultado social / información revelada]
- **Si investigan [lugar]:** [descubren pista X / activan encuentro Y]
- **Si actúan violentamente:** [consecuencias narrativas / combate]
- **Si intentan escapar:** [cómo evoluciona la escena]

**Encuentro (si aplica):**
- **Tipo:** [combate|social|exploración|puzzle]
- **Enemigos/desafío:** [qué se opone a los jugadores]
- **Dificultad:** [Fácil|Medio|Difícil|Mortal]
- **Dinámicas:** [cómo cambia el encuentro según acciones jugador]

[Repite para escenas 2, 3, 4...]

---

### 🧩 Árbol de Resultados Alternativos

**Si triunfan en [escena X]:**
- [Avanza a siguiente escena]
- [Consiguen aliado / información clave]
- [Consecuencia narrativa]

**Si fracasan en [escena X]:**
- [Escena alternativa / giro narrativo]
- [Nuevo antagonista se revela]
- [Oportunidad de rescate o redención]

**Si el resultado es mixto:**
- [Éxito con precio]
- [Victoria pírrica]
- [Nueva complicación]

---

### 💡 Pistas y Secretos

**Pista 1:** [Información que los jugadores pueden descubrir en escena X si investigan]
- **Dificultad de descubrimiento:** [CD X]
- **Impacto narrativo:** [cómo cambia el juego]

**Pista 2:** [...]

**Secreto oculto:** [Información que NO deben descubrir a menos que hagan algo inesperado]
- **Si lo descubren:** [nuevo giro narrativo]

---

### ⚔️ Encuentros Principales

**Encuentro A: [Nombre]**
- **Ubicación:** [dónde]
- **Enemigos/antagonistas:** [quiénes]
- **Stats/CR:** [nivel de desafío]
- **Elementos especiales:** [objetos mágicos, terreno táctico, aliados]
- **Objetivos alternativos:** [no solo matar]

---

### 🔮 Cliffhanger / Gancho para Próxima Sesión

[Revelación impactante, misterio sin resolver, amenaza creciente, o giro narrativo que deja a los jugadores pidiendo más]

**Impacto:** [cómo afecta a la campaña general]
**Temas a explorar:** [qué preguntas quedan abiertas]

---

### 📌 Notas para el DM
- [Pausa dramática en momento X]
- [Prepara [objeto] como prop físico]
- [Ten listo plan B si los jugadores hacen Y]
- [Sé flexible con el orden de escenas]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();

    const prompt = customPrompt
      ? `Convierte este contenido en un guión de sesión ejecutable:\n\n${customPrompt}`
      : `Crea un guión de sesión completo y original para un grupo de aventureros de nivel 5-7 en Forgotten Realms. Incluye 3-4 escenas conectadas, encuentro principal, árbol de decisiones ramificadas, pistas y un cliffhanger épico.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "Payment required, please add funds to your Lovable AI workspace.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-session-script error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
