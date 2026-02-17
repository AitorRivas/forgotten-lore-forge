import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(messages: any[], options: { temperature?: number } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const model = "gemini-2.5-pro";
  const body: any = { model, messages, temperature: options.temperature ?? 0.8 };

  if (GEMINI_API_KEY) {
    try {
      const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (resp.ok) return resp;
      if (resp.status === 429) console.log("Gemini rate limited, falling back...");
      else console.error("Gemini error:", resp.status);
    } catch (e) { console.error("Gemini fetch error:", e); }
  }

  if (LOVABLE_API_KEY) {
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: `google/${model}` }),
      });
      if (resp.ok) return resp;
    } catch (e) { console.error("Lovable AI error:", e); }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { partyMembers, partySize, avgLevel, difficulty, difficultyLabel, region, encounterTheme, specificRequest, campaignId } = await req.json();

    // Get user from auth header
    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;
    let campaignContext: any = null;

    if (authHeader.startsWith("Bearer ")) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = data?.claims?.sub || null;

      // Fetch campaign context if campaignId provided
      if (campaignId && userId) {
        const { data: campaign } = await supabase
          .from("campaigns")
          .select("name, region, tone, level_range, narrative_context")
          .eq("id", campaignId)
          .single();
        if (campaign) campaignContext = campaign;
      }
    }

    // Build party analysis
    const partyAnalysis = (partyMembers || []).map((m: any) => `- ${m.className} nivel ${m.level}`).join("\n");

    const systemPrompt = `Eres un diseñador de encuentros tácticos experto para D&D 5e (Forgotten Realms). 
Tu trabajo es crear encuentros equilibrados, detallados y jugables siguiendo ESTRICTAMENTE las reglas oficiales de D&D 5e.

REGLAS FUNDAMENTALES:
1. Usa SOLO criaturas del Monster Manual, Volo's Guide, Mordenkainen's Tome, Fizban's Treasury y otros libros OFICIALES de D&D 5e.
2. Los CR deben ser precisos y verificados contra las tablas oficiales de XP por CR.
3. El equilibrio debe seguir las tablas de umbrales de XP del DMG (cap. 3):
   - Fácil: XP total < umbral fácil × nº jugadores
   - Moderado: entre umbral fácil y medio
   - Desafiante: entre umbral medio y difícil
   - Difícil: entre umbral difícil y letal
   - Mortal: XP total ≥ umbral letal × nº jugadores
4. Aplica el multiplicador de XP por número de enemigos (DMG p.82).
5. Incluye stats reales: CA, PG, velocidad, ataques, habilidades y hechizos tal como aparecen en los manuales.

FORMATO DE RESPUESTA (Markdown estructurado):

# ⚔️ [Título del Encuentro]

## 📊 Resumen del Encuentro
- **Dificultad:** [nivel]
- **XP Total:** [cantidad] XP (ajustado: [cantidad] XP)
- **Nº Criaturas:** [cantidad]
- **Entorno:** [tipo de terreno/ubicación]
- **Región:** [región de Faerûn]

## 👥 Análisis del Grupo
[Resumen de fortalezas y debilidades del grupo basado en su composición]

## 🐉 Criaturas del Encuentro
Para CADA criatura:
### [Nombre] (CR [X], [XP] XP)
- **Fuente:** [libro oficial]
- **CA:** [valor] | **PG:** [valor] ([dados])
- **Velocidad:** [valor]
- **Estadísticas:** FUE [X] DEX [X] CON [X] INT [X] SAB [X] CAR [X]
- **Habilidades:** [lista]
- **Sentidos:** [lista]
- **Idiomas:** [lista]
- **Resistencias/Inmunidades:** [si aplica]
- **Ataques:**
  - [Nombre ataque]: +[bonus] a impactar, alcance [X], [daño]
- **Habilidades Especiales:**
  - [Nombre]: [descripción mecánica completa]
- **Hechizos** (si aplica):
  - Trucos: [lista]
  - Nivel 1 ([X] ranuras): [lista]
  - Nivel 2 ([X] ranuras): [lista]
  - [etc.]
- **Rasgos Especiales:** [lista de rasgos pasivos o activos relevantes]

## 🎯 Estrategia Táctica
### Fase de Preparación
[Cómo están posicionados los enemigos antes del encuentro]

### Plan de los 3 Primeros Asaltos
**Asalto 1:** [acciones detalladas de cada criatura]
**Asalto 2:** [acciones detalladas, reacciones a los PJs]
**Asalto 3:** [adaptación táctica según el desarrollo]

### Tácticas Avanzadas
- **Foco de ataque:** [a quién atacan primero y por qué]
- **Uso del terreno:** [cómo aprovechan el entorno]
- **Retirada:** [cuándo y cómo se retiran]
- **Sinergias:** [combinaciones entre criaturas]

## ⚖️ Validación de Equilibrio
- **XP por jugador:** [cantidad]
- **Umbral Fácil:** [valor] | **Moderado:** [valor] | **Difícil:** [valor] | **Letal:** [valor]
- **Clasificación real:** [resultado]
- **Multiplicador aplicado:** ×[valor] (por [X] criaturas)
- **Ajustes recomendados:** [si el equilibrio no coincide con la dificultad pedida]

## 🗺️ Descripción del Escenario
[Descripción narrativa del lugar, atmósfera, elementos interactivos]

### Elementos del Terreno
- [Elemento 1]: [efecto mecánico]
- [Elemento 2]: [efecto mecánico]

## 💰 Recompensas
- **XP Total:** [cantidad] (÷ ${partySize || 4} = [XP por jugador])
- **Tesoro:** [según las tablas del DMG para CR apropiado]

## 📝 Notas del DM
[Consejos para dirigir el encuentro, variaciones, ganchos narrativos]`;

    const effectiveRegion = campaignContext?.region || region || "Costa de la Espada";
    const effectiveTone = campaignContext?.tone || "épico";

    // Region-specific lore context for the prompt
    const regionLoreMap: Record<string, string> = {
      "Costa de la Espada": "Criaturas típicas: goblins, gnolls, orcos, bandidos del Camino Comercial, dragones jóvenes, monstruos marinos costeros, sahuagin. Clima: templado oceánico, nieblas frecuentes. Amenazas: Culto del Dragón, Zhentarim, piratas de Luskan, resurgimiento de Tiamat.",
      "Costa de la Espada Norte": "Criaturas típicas: trolls de hielo, gigantes de escarcha, lobos invernales, yetis, orcos de Muchas Flechas, dragones blancos. Clima: frío severo, tormentas de nieve. Amenazas: la Hueste Salvaje, restos del ejército de Muchas Flechas, nigromantes del Norte.",
      "Norte": "Criaturas típicas: gigantes de escarcha y fuego, remorhaz, wyverns, quimeras, osos polares, goblins de las cuevas. Clima: ártico/subártico, ventiscas. Amenazas: Auril, la Doncella de Escarcha, cultos elementales, dragones ancestrales.",
      "Valles": "Criaturas típicas: drow de Cormanthor, arañas gigantes, licántropos del bosque, treants corruptos, bandidos zhentarim. Clima: continental templado, bosques densos. Amenazas: Zhentarim, drow de Szith Morcane, resurgimiento de Myth Drannor.",
      "Cormyr": "Criaturas típicas: dragones púrpura (vigilantes), gnolls de las fronteras, goblinoides del Paso del Gnoll, no-muertos del Pantano de los Trolls. Clima: templado, lluvias estacionales. Amenazas: Magos de Guerra rebeldes, cultos de Shar, conspiraciones nobiliarias.",
      "Calimshan": "Criaturas típicas: genasi, djinn, efreet, lamias, yuan-ti, escorpiones gigantes, momias del desierto. Clima: árido, calor extremo, tormentas de arena. Amenazas: pashas criminales, genios desatados, ruinas de Calim y Memnon.",
      "Chult": "Criaturas típicas: dinosaurios (velociraptores, t-rex), yuan-ti, pteranodontes, zombies de la Maldición de la Muerte, froghemoths. Clima: tropical, lluvias torrenciales, calor húmedo. Amenazas: Acererak, yuan-ti de Omu, la Maldición de la Muerte.",
      "Thay": "Criaturas típicas: no-muertos (zombies, esqueletos, espectros, liches menores), gólems, quimeras arcanas, demonios invocados. Clima: continental, tormentas arcanas. Amenazas: Szass Tam, los Magos Rojos, experimentación necromática.",
      "Amn": "Criaturas típicas: ogros de las Montañas de la Nube, bandidos mercantiles, monstruos del Bosque de Snakewood, yuan-ti infiltrados. Clima: mediterráneo, cálido. Amenazas: Casas mercantiles rivales, Sombras de Amn, cultos ocultos.",
      "Sembia": "Criaturas típicas: espías, asesinos, constructos de guardia, monstruos de alcantarilla, sombras de Shar. Clima: templado continental. Amenazas: netheril, intrigas políticas, cultos de Shar, contrabandistas.",
      "Mar de la Luna": "Criaturas típicas: aberraciones del Mar de la Luna, zombies de Phlan, dragones negros, beholders. Clima: continental húmedo, nieblas. Amenazas: Mulmaster, resurgimiento del Templo del Mal Elemental, el Dragón Negro.",
      "Corazón Occidental": "Criaturas típicas: bandidos del camino, licántropos, no-muertos del Darkhold, wyverns de las Colinas del Atardecer. Clima: templado, praderas. Amenazas: Zhentarim de Darkhold, cultos demoníacos, monstruos errantes.",
      "Tethyr": "Criaturas típicas: monstruos del Bosque de Tethir, ogros, trolls del bosque, elfos salvajes hostiles. Clima: mediterráneo cálido. Amenazas: guerra civil residual, monstruos del bosque profundo, piratas de la costa.",
      "Rashemen": "Criaturas típicas: berserkers, espíritus de la naturaleza, lobos terribles, fey oscuras, elementales. Clima: frío continental, bosques densos. Amenazas: Thay, hags del Bosque Inmóvil, espíritus ancestrales corruptos.",
    };

    const regionLore = regionLoreMap[effectiveRegion] || `Región: ${effectiveRegion}. Usa criaturas apropiadas para el entorno y clima de esta zona de Faerûn según el lore oficial.`;

    let userPrompt = `COMPOSICIÓN DEL GRUPO (${partySize || partyMembers?.length || 4} jugadores, nivel promedio ${avgLevel}):
${partyAnalysis}

DIFICULTAD OBJETIVO: ${difficultyLabel || "Desafiante"} (nivel ${difficulty}/5)
REGIÓN: ${effectiveRegion}
TONO: ${effectiveTone}

CONTEXTO REGIONAL (lore oficial de Forgotten Realms):
${regionLore}
IMPORTANTE: Selecciona criaturas que sean coherentes con esta región, su clima, amenazas activas y fauna local según el lore oficial. El entorno del encuentro debe reflejar el clima y la geografía regional.`;

    if (encounterTheme) userPrompt += `\nTEMA DEL ENCUENTRO: ${encounterTheme}`;
    if (specificRequest) userPrompt += `\nPETICIÓN ESPECÍFICA: ${specificRequest}`;
    if (campaignContext) {
      userPrompt += `\n\nCONTEXTO DE CAMPAÑA:
- Campaña: ${campaignContext.name}
- Rango de nivel: ${campaignContext.level_range}
- Región: ${campaignContext.region}
- Tono: ${campaignContext.tone}`;
      if (campaignContext.narrative_context) {
        const nc = campaignContext.narrative_context;
        if (nc.active_npcs?.length) userPrompt += `\n- PNJs activos: ${nc.active_npcs.slice(0, 5).join(", ")}`;
        if (nc.regions_explored?.length) userPrompt += `\n- Regiones exploradas: ${nc.regions_explored.slice(0, 5).join(", ")}`;
        if (nc.open_conflicts?.length) userPrompt += `\n- Conflictos abiertos: ${nc.open_conflicts.slice(0, 3).join(", ")}`;
      }
    }

    userPrompt += `\n\nDiseña el encuentro completo siguiendo el formato indicado. Usa SOLO criaturas oficiales de D&D 5e coherentes con la región. Valida el equilibrio con las tablas del DMG.`;

    const response = await callAI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { temperature: 0.8 }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Los servicios de IA están saturados. Intenta en unos segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ encounter_markdown: content, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-encounter error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error generando encuentro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
