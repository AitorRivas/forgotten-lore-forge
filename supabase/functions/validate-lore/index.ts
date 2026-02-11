import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto en lore de Forgotten Realms y editor narrativo de campañas de D&D 5e.

Tu trabajo es REVISAR contenido generado y validar su coherencia. No inventas contenido nuevo — solo corriges y señalas problemas.

PROCESO DE VALIDACIÓN:

1. **Coherencia con Forgotten Realms:** Verifica que nombres, lugares, facciones, deidades, eventos históricos, geografía y cultura sean consistentes con el canon oficial de Forgotten Realms (hasta 1492 DR). Señala cualquier error de lore.

2. **Coherencia interna de campaña:** Si se proporciona contexto de campaña, verifica que el contenido no contradiga eventos previos, decisiones del grupo, NPCs establecidos, relaciones entre facciones, ni la línea temporal interna.

3. **Coherencia de PNJs:** Verifica que los PNJs mencionados mantengan personalidad, motivaciones y afiliaciones consistentes con sus apariciones previas. Señala cambios de comportamiento inexplicados.

4. **Progresión narrativa:** Evalúa si el contenido progresa lógicamente desde los eventos anteriores. Señala saltos narrativos, escaladas abruptas, o resoluciones demasiado convenientes.

FORMATO DE RESPUESTA (usa markdown):

## ✅ Informe de Validación de Lore y Continuidad

### 📊 Resultado General
- **Estado:** [✅ Válido | ⚠️ Con observaciones | ❌ Requiere correcciones]
- **Puntuación de coherencia:** [1-10]
- **Errores críticos:** [número]
- **Advertencias:** [número]

---

### 🌍 Coherencia con Forgotten Realms
[Para cada problema encontrado:]

**[✅|⚠️|❌] [Elemento revisado]**
- **Problema:** [qué está mal]
- **Lore correcto:** [cómo debería ser según el canon]
- **Corrección sugerida:** [cómo arreglarlo sin alterar la intención]

[Si todo es correcto: "Sin problemas detectados."]

---

### 📜 Coherencia con la Campaña
[Para cada inconsistencia:]

**[⚠️|❌] [Elemento inconsistente]**
- **Contradicción detectada:** [qué contradice]
- **Contexto previo:** [qué se estableció antes]
- **Corrección sugerida:** [cómo reconciliar]

---

### 🧍 Coherencia de PNJs
[Para cada PNJ revisado:]

**[✅|⚠️|❌] [Nombre del PNJ]**
- **Consistencia de personalidad:** [coherente / inconsistente — por qué]
- **Motivaciones:** [alineadas / contradictorias]
- **Afiliaciones:** [correctas / alteradas sin justificación]
- **Corrección sugerida:** [si aplica]

---

### 📈 Progresión Narrativa
- **Flujo lógico:** [¿los eventos siguen una secuencia coherente?]
- **Escalada apropiada:** [¿el nivel de amenaza progresa correctamente?]
- **Resoluciones:** [¿son ganadas o demasiado convenientes?]
- **Saltos narrativos:** [¿hay huecos que necesiten explicación?]

---

### 🔧 Contenido Corregido
[Si hay correcciones necesarias, reescribe SOLO las partes problemáticas manteniendo la intención original del autor. No reescribas todo el contenido — solo las secciones que necesitan corrección.]

**Sección corregida 1:**
> [Texto original problemático]

→ [Texto corregido con justificación breve]

---

### 📌 Recomendaciones Finales
- [Sugerencia 1 para mejorar coherencia futura]
- [Sugerencia 2]
- [Sugerencia 3]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();

    const prompt = customPrompt
      ? `Revisa y valida el siguiente contenido generado para D&D 5e en Forgotten Realms. Corrige inconsistencias sin alterar la intención original:\n\n${customPrompt}`
      : `Genera un ejemplo de informe de validación mostrando cómo revisarías una misión típica de D&D 5e en Forgotten Realms. Incluye ejemplos de errores de lore comunes, inconsistencias de campaña y correcciones sugeridas.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GEMINI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("validate-lore error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
