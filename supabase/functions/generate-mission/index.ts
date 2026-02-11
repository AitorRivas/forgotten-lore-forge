import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un motor profesional de generación narrativa para Dungeon Masters de Dungeons & Dragons 5e ambientado exclusivamente en Forgotten Realms.

OBJETIVO: Generar contenido jugable, coherente, DIVERSO y estructurado para campañas reales.

REGLAS CRÍTICAS:
- Usa únicamente lore oficial de Forgotten Realms.
- Mantén coherencia TOTAL con el contexto de campaña proporcionado.
- Haz referencia a eventos previos, NPCs activos, antagonistas y conflictos abiertos.
- Las nuevas misiones deben avanzar o complicar los conflictos existentes.
- Respeta las decisiones del grupo y sus consecuencias.
- Introduce nuevos elementos que complementen la narrativa sin contradecirla.
- Cada misión DEBE incluir al menos dos de: intriga social/política, investigación, combate significativo, puzzle/desafío lógico, dilema moral, giro narrativo inesperado.

=== CONTROL DE DIVERSIDAD Y VARIACIÓN (OBLIGATORIO) ===

Recibirás un ANÁLISIS DE PATRONES que muestra qué se ha usado recientemente. DEBES:

1. **VARIAR CONFLICTOS**: Si los conflictos recientes son militares, usa intriga política, traición interna, crisis religiosa, catástrofe natural, plaga mágica, o conflicto comercial. NUNCA repitas el mismo tipo de conflicto dos veces seguidas.

2. **CAMBIAR DINÁMICAS SOCIALES**: Alterna entre:
   - Aliados que se vuelven enemigos / enemigos que piden ayuda
   - Dilemas donde no hay "lado bueno"
   - Traiciones inesperadas de NPCs de confianza
   - Facciones neutrales que se ven forzadas a tomar partido
   - Víctimas que resultan ser culpables / villanos con razones legítimas

3. **INTRODUCIR ELEMENTOS INESPERADOS**: Cada misión DEBE tener al menos un elemento que rompa las expectativas:
   - Giros de trama que recontextualicen eventos previos
   - Revelaciones que cambien la percepción de un NPC conocido
   - Consecuencias inesperadas de acciones pasadas del grupo
   - Amenazas de fuentes completamente nuevas e imprevistas
   - Alianzas imposibles forzadas por las circunstancias

4. **EVITAR CLICHÉS REPETITIVOS**: PROHIBIDO repetir estos patrones si ya se usaron:
   - "Rescata al prisionero" consecutivamente
   - "Mata al monstruo en la cueva" sin variación
   - "El mercader pide escolta" de nuevo
   - "La taberna es atacada" otra vez
   - Mismo tipo de villano (si el último fue un nigromante, el siguiente NO puede ser otro nigromante)
   - Misma estructura (si la última fue lineal, la siguiente debe ser abierta/sandbox)

5. **ROTAR TIPOS DE MISIÓN**: Alterna entre estas categorías, priorizando las MENOS usadas:
   - Investigación/misterio
   - Diplomacia/negociación
   - Exploración/descubrimiento
   - Defensa/protección
   - Infiltración/sigilo
   - Supervivencia/escape
   - Heist/robo elaborado
   - Juicio/debate/tribunal
   - Carrera contra el tiempo
   - Guerra de información/espionaje

6. **VARIAR ANTAGONISTAS**: Si se proporciona lista de antagonistas usados, el nuevo antagonista DEBE ser de un tipo diferente. Categorías:
   - Político corrupto / Noble ambicioso
   - Culto o secta
   - Criatura ancestral / Aberración
   - Organización criminal
   - Hechicero renegado / Mago loco
   - Entidad extraplanar
   - Fuerza de la naturaleza / Bestia primordial
   - Autómata / Constructo descontrolado
   - Traidor interno / Doble agente
   - Amenaza colectiva (plaga, hambruna, desastre)

=== FIN CONTROL DE DIVERSIDAD ===

FORMATO DE RESPUESTA (usa markdown):

## 🗡️ [Título de la Misión]

### 📜 Resumen
[Resumen breve en 2-3 oraciones, conectado con la trama existente]

### 🪝 Gancho Narrativo
[Cómo los aventureros se enteran — debe conectar con NPCs o eventos existentes]

### 📍 Ubicación
[Lugar específico en Forgotten Realms con descripción atmosférica]

### 🎭 NPCs Clave
[NPCs nuevos y existentes. Para cada uno: nombre, raza, clase/ocupación, motivación, secreto. Marca con ⭐ los que ya existen en la campaña]

### ⚔️ Encuentros
[2-3 encuentros detallados con nivel de dificultad sugerido]

### 🧩 Elementos Narrativos
[Elementos: intriga, investigación, combate, puzzle, dilema moral, giro]

### 🏆 Recompensas
[Tesoro, objetos mágicos, alianzas, información]

### 🔄 Consecuencias
[Qué pasa según las decisiones — cómo afecta a conflictos abiertos]

### 🔗 Conexiones con la Campaña
[Cómo esta misión conecta con eventos previos, avanza conflictos abiertos, y siembra semillas para el futuro]

### 🎲 Variación Narrativa
[Explica brevemente qué elementos nuevos introduces respecto a misiones anteriores y por qué]

### 📝 Notas para el DM
[Consejos de interpretación, música sugerida, variaciones posibles]`;

// Analyze patterns from recent missions to build diversity constraints
function analyzePatternsFromMissions(missions: any[]): string {
  if (!missions || missions.length === 0) return "";

  const patterns: string[] = [];

  // Extract mission types/structures from titles and content
  const titles = missions.map((m: any) => m.title).filter(Boolean);
  if (titles.length > 0) {
    patterns.push(`TÍTULOS DE MISIONES RECIENTES (NO repitas estructuras similares):\n${titles.map((t: string) => `- "${t}"`).join("\n")}`);
  }

  // Analyze content for repeated patterns
  const allContent = missions
    .map((m: any) => m.full_content || m.summary || "")
    .join("\n")
    .toLowerCase();

  const detectedPatterns: string[] = [];

  // Detect antagonist types
  const antagonistTypes: Record<string, string[]> = {
    "nigromante/no-muertos": ["nigromante", "no-muerto", "undead", "zombi", "esqueleto", "lich", "necromanc"],
    "dragón": ["dragón", "dragon", "wyrm", "draco"],
    "culto/secta": ["culto", "secta", "cultist", "ritual oscuro", "sacrificio"],
    "bandidos/criminales": ["bandido", "ladrón", "criminal", "contrabandist", "asesino", "gremio de ladrones"],
    "demonio/diablo": ["demonio", "diablo", "infernal", "abiso", "fiend"],
    "goblinoides": ["goblin", "hobgoblin", "bugbear", "orco"],
    "hechicero/mago": ["hechicero", "mago", "archimago", "brujo"],
    "político/noble": ["noble", "lord", "señor", "barón", "duque", "político", "consejo"],
  };

  const usedAntagonistTypes: string[] = [];
  for (const [type, keywords] of Object.entries(antagonistTypes)) {
    if (keywords.some(k => allContent.includes(k))) {
      usedAntagonistTypes.push(type);
    }
  }
  if (usedAntagonistTypes.length > 0) {
    detectedPatterns.push(`Tipos de antagonista ya usados: ${usedAntagonistTypes.join(", ")}. USA UN TIPO DIFERENTE.`);
  }

  // Detect mission structures
  const structureTypes: Record<string, string[]> = {
    "rescate": ["rescata", "salvar", "prisionero", "cautivo", "liberar", "secuestr"],
    "escolta/viaje": ["escolta", "acompañar", "viaje", "caravana", "transporte"],
    "caza de monstruo": ["caza", "matar", "bestia", "criatura", "guarida", "cueva"],
    "investigación": ["investiga", "pista", "misterio", "descubrir", "averiguar"],
    "defensa": ["defender", "proteger", "asedio", "ataque a", "invasión"],
    "exploración": ["explora", "ruinas", "templo antiguo", "catacumbas", "dungeon"],
    "diplomacia": ["negociar", "tratado", "alianza", "embajad", "diplomacia"],
    "infiltración": ["infiltra", "sigilo", "espía", "disfraz", "encubierto"],
  };

  const usedStructures: string[] = [];
  for (const [type, keywords] of Object.entries(structureTypes)) {
    if (keywords.some(k => allContent.includes(k))) {
      usedStructures.push(type);
    }
  }
  if (usedStructures.length > 0) {
    detectedPatterns.push(`Estructuras de misión ya usadas: ${usedStructures.join(", ")}. ELIGE UNA ESTRUCTURA DIFERENTE.`);
  }

  // Detect dominant tones
  const toneTypes: Record<string, string[]> = {
    "combate pesado": ["batalla", "guerra", "ejército", "asalto", "combate"],
    "horror": ["horror", "terror", "miedo", "pesadilla", "macabro"],
    "misterio": ["misterio", "enigma", "acertijo", "secreto", "oculto"],
    "político": ["política", "intriga", "corte", "consejo", "facción"],
    "exploración": ["viaje", "descubrimiento", "territorio", "mapa", "expedición"],
  };

  const usedTones: string[] = [];
  for (const [type, keywords] of Object.entries(toneTypes)) {
    if (keywords.some(k => allContent.includes(k))) {
      usedTones.push(type);
    }
  }
  if (usedTones.length > 0) {
    detectedPatterns.push(`Tonos dominantes recientes: ${usedTones.join(", ")}. CAMBIA EL TONO DOMINANTE.`);
  }

  // Detect location types
  const locationTypes: Record<string, string[]> = {
    "mazmorra/cueva": ["cueva", "mazmorra", "dungeon", "subterráneo", "catacumba"],
    "ciudad": ["ciudad", "pueblo", "villa", "metrópolis", "urbano"],
    "bosque/naturaleza": ["bosque", "selva", "naturaleza", "arboleda", "pantano"],
    "mar/costa": ["mar", "costa", "barco", "puerto", "isla"],
    "montaña": ["montaña", "cumbre", "paso", "fortaleza de montaña"],
    "desierto": ["desierto", "arena", "oasis", "caluroso"],
    "planar": ["plano", "extraplanar", "feywild", "shadowfell", "ethereal"],
  };

  const usedLocations: string[] = [];
  for (const [type, keywords] of Object.entries(locationTypes)) {
    if (keywords.some(k => allContent.includes(k))) {
      usedLocations.push(type);
    }
  }
  if (usedLocations.length > 0) {
    detectedPatterns.push(`Tipos de ubicación recientes: ${usedLocations.join(", ")}. USA UNA UBICACIÓN DE TIPO DIFERENTE.`);
  }

  if (detectedPatterns.length > 0) {
    patterns.push(`\nPATRONES DETECTADOS — EVITA REPETIRLOS:\n${detectedPatterns.map(p => `⚠️ ${p}`).join("\n")}`);
  }

  return patterns.length > 0
    ? `\n\n=== ANÁLISIS DE DIVERSIDAD (OBLIGATORIO) ===\n${patterns.join("\n\n")}\n=== FIN ANÁLISIS DE DIVERSIDAD ===`
    : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, userId, customPrompt } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch full campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaña no encontrada");
    }

    // Fetch previous missions (more for better diversity analysis)
    const { data: missions } = await supabase
      .from("missions")
      .select("title, summary, full_content")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Also fetch missions from OTHER campaigns of this user for cross-campaign diversity
    const { data: otherMissions } = await supabase
      .from("missions")
      .select("title, summary")
      .eq("user_id", userId)
      .neq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Fetch user context
    const { data: userContext } = await supabase
      .from("user_context")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Build rich campaign context
    const ctx = campaign.narrative_context || {};
    let campaignContext = `\n\n=== CONTEXTO DE CAMPAÑA ACTIVA ===`;
    campaignContext += `\nCampaña: "${campaign.name}"`;
    campaignContext += `\nDescripción: ${campaign.description || "Sin descripción"}`;
    campaignContext += `\nRegión principal: ${campaign.region || "Sin definir"}`;
    campaignContext += `\nTono: ${campaign.tone || "épico"}`;
    campaignContext += `\nNivel: ${campaign.level_range}`;
    campaignContext += `\nActo actual: ${campaign.current_act || 1}`;

    if (ctx.summary) {
      campaignContext += `\n\nRESUMEN GENERAL:\n${ctx.summary}`;
    }

    if (ctx.chapters?.length > 0) {
      campaignContext += `\n\nCAPÍTULOS EXISTENTES:\n${ctx.chapters.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
    }

    if (ctx.important_events?.length > 0) {
      campaignContext += `\n\nEVENTOS IMPORTANTES:\n${ctx.important_events.map((e: string) => `- ${e}`).join("\n")}`;
    }

    if (ctx.known_antagonists?.length > 0) {
      campaignContext += `\n\nANTAGONISTAS CONOCIDOS:\n${ctx.known_antagonists.map((a: string) => `- ${a}`).join("\n")}`;
    }

    if (ctx.active_npcs?.length > 0) {
      campaignContext += `\n\nPNJs ACTIVOS (deben aparecer o ser mencionados si es relevante):\n${ctx.active_npcs.map((n: string) => `- ${n}`).join("\n")}`;
    }

    if (ctx.party_decisions?.length > 0) {
      campaignContext += `\n\nDECISIONES DEL GRUPO (respétalas):\n${ctx.party_decisions.map((d: string) => `- ${d}`).join("\n")}`;
    }

    if (ctx.open_conflicts?.length > 0) {
      campaignContext += `\n\nCONFLICTOS ABIERTOS (avánzalos o complícalos):\n${ctx.open_conflicts.map((c: string) => `- ${c}`).join("\n")}`;
    }

    if (ctx.narrative_memory?.length > 0) {
      campaignContext += `\n\nMEMORIA NARRATIVA PREVIA:\n${ctx.narrative_memory.slice(-5).map((m: string) => `- ${m}`).join("\n")}`;
    }

    if (ctx.plot_hooks_pending?.length > 0) {
      campaignContext += `\n\nGANCHOS PENDIENTES (considera usar alguno):\n${ctx.plot_hooks_pending.map((h: string) => `- ${h}`).join("\n")}`;
    }

    if (ctx.regions_explored?.length > 0) {
      campaignContext += `\n\nREGIONES YA EXPLORADAS:\n${ctx.regions_explored.join(", ")}`;
    }

    // Previous missions for continuity
    if (missions && missions.length > 0) {
      campaignContext += `\n\nMISIONES ANTERIORES (mantén continuidad, no repitas estructuras):\n`;
      missions.forEach((m: any, i: number) => {
        campaignContext += `${i + 1}. ${m.title}${m.summary ? ` — ${m.summary}` : ""}\n`;
      });
    }

    // User-level variety context
    if (userContext) {
      const recentStyles = (userContext.narrative_styles || []).slice(-5);
      if (recentStyles.length > 0) {
        campaignContext += `\n\nESTILOS NARRATIVOS RECIENTES DEL DM (usa uno diferente):\n${recentStyles.join(", ")}`;
      }
      const recentRegions = (userContext.regions_used || []).slice(-5);
      if (recentRegions.length > 0) {
        campaignContext += `\n\nREGIONES USADAS GLOBALMENTE POR ESTE DM:\n${recentRegions.join(", ")}`;
      }
      const recentThemes = (userContext.recent_themes || []).slice(-5);
      if (recentThemes.length > 0) {
        campaignContext += `\n\nTEMAS RECIENTES DEL DM (varía):\n${recentThemes.join(", ")}`;
      }
    }

    // Cross-campaign diversity
    if (otherMissions && otherMissions.length > 0) {
      campaignContext += `\n\nMISIONES RECIENTES EN OTRAS CAMPAÑAS DEL MISMO DM (evita repetir patrones):\n`;
      otherMissions.forEach((m: any) => {
        campaignContext += `- ${m.title}\n`;
      });
    }

    campaignContext += `\n=== FIN CONTEXTO ===`;

    // Build diversity analysis from recent mission content
    const diversityAnalysis = analyzePatternsFromMissions(missions || []);

    let userPrompt = `Genera la siguiente misión para esta campaña. Recuerda: la DIVERSIDAD es obligatoria.`;
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES ADICIONALES DEL DM:\n${customPrompt}`;
    }
    userPrompt += campaignContext;
    userPrompt += diversityAnalysis;

    // Retry with exponential backoff for rate limits
    let response: Response | null = null;
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
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
        }
      );

      if (response.status !== 429 || attempt === maxRetries) break;
      
      const waitMs = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
      console.log(`Rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = response ? await response.text() : "No response";
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "Error del servicio de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-mission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
