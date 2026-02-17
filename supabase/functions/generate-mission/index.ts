import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un motor profesional de generación narrativa para Dungeon Masters de D&D 5e ambientado EXCLUSIVAMENTE en Forgotten Realms (Reinos Olvidados).

OBJETIVO: Generar MISIONES COMPLETAS como arcos narrativos listos para jugar en mesa. No sinopsis: narrativa detallada, modular y jugable.

REGLAS CRÍTICAS:
- Usa únicamente lore oficial de Forgotten Realms.
- Adapta cultura, religión, facciones y política a la región seleccionada.
- Cada misión DEBE incluir al menos dos de: intriga social/política, investigación, combate significativo, puzzle, dilema moral, giro inesperado.
- NUNCA generes misiones lineales ni monotemáticas.
- El tipo principal define el eje central, pero la misión siempre debe mezclar combate, escenas sociales, investigación y decisiones morales.

FORMATO DE RESPUESTA — OBLIGATORIO (usa markdown con estas secciones EXACTAS):

## 🗡️ [Título de la Misión]

### 📜 Contexto General
[Situación actual de la región. Estado político/social/mágico. Facciones implicadas. Mínimo 3 párrafos.]

### 💥 Detonante
[Evento concreto que inicia la misión. Cómo se enteran los aventureros.]

### 🎭 Trama Central
**Lo que parece estar ocurriendo:** [descripción]
**Lo que realmente está ocurriendo:** [descripción]
**Lo que permanece oculto:** [descripción]

### 📋 Actos / Fases

#### Fase 1: [Nombre]
- **Objetivo:** [qué deben lograr]
- **Obstáculo:** [qué se interpone]
- **Posible giro:** [qué puede cambiar]
- **Escenas sugeridas:** [2-3 escenas]

#### Fase 2: [Nombre]
- **Objetivo:** ...
- **Obstáculo:** ...
- **Posible giro:** ...
- **Escenas sugeridas:** ...

#### Fase 3: [Nombre]
- **Objetivo:** ...
- **Obstáculo:** ...
- **Posible giro:** ...
- **Escenas sugeridas:** ...

### 🛤️ Posibles Enfoques de Resolución

#### Enfoque 1: Resolución por Combate
[Descripción detallada]

#### Enfoque 2: Resolución Social/Diplomática
[Descripción detallada]

#### Enfoque 3: Resolución Estratégica/Indirecta
[Descripción detallada]

### 🔄 Giros Argumentales
1. **[Giro 1]:** [Descripción coherente con el lore]
2. **[Giro 2]:** [Descripción coherente con el lore]

### ⚖️ Consecuencias
**Si tienen éxito:** [consecuencias detalladas]
**Si fracasan:** [consecuencias detalladas]
**Si ignoran la misión:** [consecuencias detalladas]

### 🔐 Secretos Ocultos
- [Secreto 1 que el DM puede revelar gradualmente]
- [Secreto 2]

### ⚡ Eventos Dinámicos
- [Evento que puede ocurrir durante la misión según las acciones del grupo]
- [Evento 2]

### 🎭 PNJ Clave
[Nombre, rol, motivación y relación con la trama para cada PNJ. Mínimo 3.]

### 🏆 Recompensas
- **Económicas:** [oro, gemas, etc.]
- **Sociales:** [reputación, alianzas]
- **Políticas:** [influencia, títulos]
- **Objetos mágicos sugeridos:** [1-2 objetos apropiados al nivel]

### 📊 Riesgos de Escalada
- [Qué pasa si los jugadores tardan demasiado]
- [Cómo escala la amenaza]

### 📝 Notas para el DM
[Consejos de interpretación, ritmo, adaptación a diferentes estilos de grupo. Mínimo 3 consejos.]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, ubicacion, tipo, nivelGrupo, tono, customPrompt, parentMissionId } = await req.json();

    if (!ubicacion || !tipo) {
      return new Response(
        JSON.stringify({ error: "Ubicación y tipo de misión son obligatorios para la generación IA." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch context: recent missions for diversity
    let contextBlock = "";
    const { data: recentMissions } = await supabase
      .from("misiones")
      .select("titulo, tipo, ubicacion_principal, conflicto_central")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentMissions && recentMissions.length > 0) {
      contextBlock += "\n\n=== MISIONES RECIENTES (EVITA REPETIR PATRONES) ===\n";
      recentMissions.forEach((m: any) => {
        contextBlock += `- ${m.titulo || "Sin título"} | Tipo: ${m.tipo || "?"} | Ubicación: ${m.ubicacion_principal || "?"} | Conflicto: ${m.conflicto_central || "?"}\n`;
      });
      contextBlock += "=== FIN ===";
    }

    // If parent mission, fetch its context
    if (parentMissionId) {
      const { data: parent } = await supabase
        .from("misiones")
        .select("titulo, descripcion, ubicacion_principal, conflicto_central, trama_detallada")
        .eq("id", parentMissionId)
        .single();
      if (parent) {
        contextBlock += `\n\n=== MISIÓN PADRE (esta es una submisión) ===\nTítulo: ${parent.titulo}\nDescripción: ${parent.descripcion || ""}\nUbicación: ${parent.ubicacion_principal || ""}\nConflicto: ${parent.conflicto_central || ""}\nTrama: ${(parent.trama_detallada || "").slice(0, 500)}\n=== FIN ===`;
      }
    }

    // User context
    const { data: userContext } = await supabase
      .from("user_context")
      .select("recent_themes, regions_used, narrative_styles")
      .eq("user_id", userId)
      .single();

    if (userContext) {
      const themes = (userContext.recent_themes || []).slice(-5);
      const regions = (userContext.regions_used || []).slice(-5);
      if (themes.length > 0) contextBlock += `\nTemas recientes: ${themes.join(", ")}`;
      if (regions.length > 0) contextBlock += `\nRegiones usadas: ${regions.join(", ")}`;
    }

    let userPrompt = `Genera una misión completa con los siguientes parámetros:

TIPO DE MISIÓN: ${tipo}
UBICACIÓN: ${ubicacion}
NIVEL DEL GRUPO: ${nivelGrupo || "1-5"}
TONO: ${tono || "épico"}

La misión debe ser un arco narrativo completo listo para jugar. NO una sinopsis. Incluye TODAS las secciones del formato obligatorio.`;

    if (customPrompt) userPrompt += `\n\nINSTRUCCIONES ADICIONALES DEL DM:\n${customPrompt}`;
    userPrompt += contextBlock;

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", stream: true, userId }
    );

    if (!aiResult) {
      return new Response(
        JSON.stringify({ error: "Los servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(aiResult.response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider },
    });
  } catch (e) {
    console.error("generate-mission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
