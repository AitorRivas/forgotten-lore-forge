import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

#### Escena 1: [Nombre]
**Tipo:** [social|exploración|combate|investigación|puzzle|persecución|sigilo]
**Duración:** [minutos estimados]
**Objetivo del jugador:** [qué deben lograr — claro y medible]
**Trigger de inicio:** [qué activa esta escena]
**Trigger de salida:** [qué condición la termina]

**Mecánicas clave:**
- Tirada principal: [Habilidad (CD X)] — [qué pasa en éxito / fracaso]
- Tirada secundaria: [Habilidad (CD X)] — [efecto]
- Tirada oculta (DM): [Percepción/Intuición CD X] — [qué revela]

**Elementos interactivos:**
| Elemento | Interacción | Resultado |
|----------|-------------|-----------|
| [objeto/NPC/lugar] | [acción del jugador] | [consecuencia mecánica] |

**Transición a siguiente escena:** [cómo conecta]

---

#### Escena 2: [Nombre]
[Misma estructura...]

---

### ⚔️ Encuentros Detallados

#### Encuentro A: [Nombre]
**Tipo:** [combate|social|skill challenge|puzzle|trampa]
**CR Total:** [valor]
**Mapa sugerido:** [descripción del terreno táctico]

**Enemigos/Desafío:**
| Criatura/Desafío | Cantidad | CR | HP | CA | Rol táctico |
|-------------------|----------|----|----|----|----|
| [nombre] | [n] | [cr] | [hp] | [ca] | [tanque/artillero/controlador/merodeador] |

**Terreno táctico:**
- [Cobertura parcial en X]
- [Terreno difícil en Y]
- [Elemento ambiental interactivo en Z]

**Fases del encuentro:**
1. **Ronda 1-2:** [táctica inicial enemiga]
2. **Ronda 3-4:** [cambio de táctica / refuerzos / evento ambiental]
3. **Condición de victoria:** [qué termina el encuentro — no solo "matar todo"]
4. **Condición de derrota:** [qué pasa si pierden — no TPK directo, consecuencias narrativas]

**Recompensas:**
- XP: [valor]
- Botín: [objetos]
- Información: [qué aprenden]

---

### 🪝 Ganchos Narrativos

| Gancho | Tipo | Momento | Efecto en campaña |
|--------|------|---------|-------------------|
| [descripción] | [pista|amenaza|oportunidad|dilema|revelación] | [en qué escena aparece] | [cómo afecta el futuro] |

**Gancho principal:** [el más importante — desarrollar en detalle]
- **Presentación:** [cómo lo descubren los jugadores]
- **Si lo siguen:** [consecuencia narrativa + mecánica]
- **Si lo ignoran:** [consecuencia de ignorarlo]

---

### 🎯 Objetivos Claros

**Objetivo principal:**
- [Descripción clara y medible]
- **Condición de éxito:** [qué deben lograr exactamente]
- **Recompensa:** [XP, oro, objetos, aliados, información]

**Objetivos secundarios (opcionales):**
1. [Objetivo] — Recompensa: [qué ganan]
2. [Objetivo] — Recompensa: [qué ganan]

**Objetivo secreto (DM):**
- [Algo que los jugadores no saben que pueden lograr]
- **Pista para descubrirlo:** [CD X de Investigación/Percepción]

---

### 💥 Consecuencias

#### Mecánicas
| Resultado | Consecuencia mecánica |
|-----------|----------------------|
| Éxito total | [bonificación/objeto/aliado/ventaja permanente] |
| Éxito parcial | [beneficio menor + complicación futura] |
| Fracaso | [penalización/enemigo más fuerte/recurso perdido] |
| Fracaso crítico | [cambio narrativo mayor — nuevo antagonista/traición/pérdida] |

#### Narrativas
| Resultado | Impacto en campaña |
|-----------|-------------------|
| Éxito total | [cómo cambia el mundo/la historia] |
| Éxito parcial | [consecuencia mixta] |
| Fracaso | [escalada de amenaza] |

---

### 📌 Notas de Ejecución para el DM
- [Timing: cuándo hacer pausas dramáticas]
- [Improvisación: qué hacer si los jugadores hacen X inesperado]
- [Pacing: cómo mantener el ritmo]
- [Props: qué preparar físicamente]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();

    const prompt = customPrompt
      ? `Transforma el siguiente contenido narrativo en formato de gameplay estructurado y mecánicamente jugable para D&D 5e:\n\n${customPrompt}`
      : `Crea una estructura de gameplay completa y original para una sesión de D&D 5e nivel 5-7 en Forgotten Realms. Incluye 3-4 escenas con mecánicas detalladas, encuentros con stats, ganchos narrativos, objetivos claros y tabla de consecuencias.`;

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
    console.error("structure-gameplay error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
