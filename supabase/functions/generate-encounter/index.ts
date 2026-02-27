import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIWithFallback as callAI, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── XP thresholds per character level (DMG p.82) ──
const XP_THRESHOLDS: Record<number, { easy: number; medium: number; hard: number; deadly: number }> = {
  1:  { easy: 25,   medium: 50,   hard: 75,   deadly: 100 },
  2:  { easy: 50,   medium: 100,  hard: 150,  deadly: 200 },
  3:  { easy: 75,   medium: 150,  hard: 225,  deadly: 400 },
  4:  { easy: 125,  medium: 250,  hard: 375,  deadly: 500 },
  5:  { easy: 250,  medium: 500,  hard: 750,  deadly: 1100 },
  6:  { easy: 300,  medium: 600,  hard: 900,  deadly: 1400 },
  7:  { easy: 350,  medium: 750,  hard: 1100, deadly: 1700 },
  8:  { easy: 450,  medium: 900,  hard: 1400, deadly: 2100 },
  9:  { easy: 550,  medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600,  medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800,  medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

const CR_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
  "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

function getEncounterMultiplier(numMonsters: number): number {
  if (numMonsters <= 1) return 1;
  if (numMonsters === 2) return 1.5;
  if (numMonsters <= 6) return 2;
  if (numMonsters <= 10) return 2.5;
  if (numMonsters <= 14) return 3;
  return 4;
}

function getPartyThresholds(partyMembers: { level: number }[]) {
  const thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const m of partyMembers) {
    const lvl = Math.max(1, Math.min(20, Math.round(m.level)));
    const t = XP_THRESHOLDS[lvl];
    thresholds.easy += t.easy;
    thresholds.medium += t.medium;
    thresholds.hard += t.hard;
    thresholds.deadly += t.deadly;
  }
  return thresholds;
}

function getTargetXPRange(difficulty: number, thresholds: ReturnType<typeof getPartyThresholds>) {
  switch (difficulty) {
    case 1: return { min: thresholds.easy * 0.7, max: thresholds.medium - 1 };
    case 2: return { min: thresholds.medium, max: thresholds.hard - 1 };
    case 3: return { min: thresholds.hard, max: thresholds.deadly - 1 };
    case 4: return { min: thresholds.deadly, max: thresholds.deadly * 1.3 };
    case 5: return { min: thresholds.deadly * 1.3, max: thresholds.deadly * 2 };
    default: return { min: thresholds.hard, max: thresholds.deadly - 1 };
  }
}

interface ParsedCreature {
  name: string;
  cr: string;
  xp: number;
  count: number;
}

function parseCreaturesFromMarkdown(md: string): ParsedCreature[] {
  const creatures: ParsedCreature[] = [];
  const creatureRegex = /###\s*(?:(\d+)[×x]\s*)?(.+?)\s*\(CR\s*([0-9/]+)\s*,?\s*(\d[\d.,]*)\s*XP\)/gi;
  let match;
  while ((match = creatureRegex.exec(md)) !== null) {
    const count = match[1] ? parseInt(match[1]) : 1;
    const name = match[2].trim();
    const cr = match[3];
    const xpStr = match[4].replace(/[.,]/g, "");
    const xp = parseInt(xpStr) || CR_XP[cr] || 0;
    creatures.push({ name, cr, xp, count });
  }
  return creatures;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  adjustedXP: number;
  baseXP: number;
  totalCreatures: number;
  classification: string;
}

function validateEncounter(
  creatures: ParsedCreature[],
  partyMembers: { level: number }[],
  difficulty: number,
): ValidationResult {
  const errors: string[] = [];
  const thresholds = getPartyThresholds(partyMembers);
  const target = getTargetXPRange(difficulty, thresholds);

  const totalCreatures = creatures.reduce((s, c) => s + c.count, 0);
  const baseXP = creatures.reduce((s, c) => s + c.xp * c.count, 0);
  const multiplier = getEncounterMultiplier(totalCreatures);
  const adjustedXP = Math.round(baseXP * multiplier);

  let classification = "Fácil";
  if (adjustedXP >= thresholds.deadly * 1.3) classification = "Mortal";
  else if (adjustedXP >= thresholds.deadly) classification = "Difícil";
  else if (adjustedXP >= thresholds.hard) classification = "Desafiante";
  else if (adjustedXP >= thresholds.medium) classification = "Moderado";

  const diffLabels: Record<number, string> = { 1: "Fácil", 2: "Moderado", 3: "Desafiante", 4: "Difícil", 5: "Mortal" };
  const targetLabel = diffLabels[difficulty] || "Desafiante";

  if (adjustedXP < target.min * 0.8) {
    errors.push(`XP_TOO_LOW: XP ajustado (${adjustedXP}) está muy por debajo del rango ${targetLabel} (mín: ${Math.round(target.min)}).`);
  } else if (adjustedXP > target.max * 1.3) {
    errors.push(`XP_TOO_HIGH: XP ajustado (${adjustedXP}) excede significativamente el rango ${targetLabel} (máx: ${Math.round(target.max)}).`);
  }

  const avgLevel = partyMembers.reduce((s, m) => s + m.level, 0) / partyMembers.length;
  const maxSafeCR = Math.ceil(avgLevel * 1.5) + 2;
  for (const c of creatures) {
    const crNum = c.cr.includes("/") ? eval(c.cr) : parseFloat(c.cr);
    if (crNum > maxSafeCR) {
      errors.push(`CR_TOO_HIGH: ${c.name} (CR ${c.cr}) excede el CR máximo seguro (${maxSafeCR}).`);
    }
  }

  if (totalCreatures === 0) {
    errors.push("NO_CREATURES: No se detectaron criaturas en el encuentro.");
  } else if (baseXP < thresholds.easy * 0.5 && difficulty >= 2) {
    errors.push(`TRIVIAL: El encuentro es trivial (${baseXP} XP base).`);
  }

  if (totalCreatures === 1 && difficulty >= 3) {
    const cr = creatures[0]?.cr;
    const crNum = cr?.includes("/") ? eval(cr) : parseFloat(cr || "0");
    if (crNum < avgLevel + 3) {
      errors.push(`NO_SYNERGY: Un solo monstruo de CR ${cr} carece de sinergia táctica.`);
    }
  }

  return { valid: errors.length === 0, errors, adjustedXP, baseXP, totalCreatures, classification };
}

// ── Detect party weaknesses ──
function analyzePartyWeaknesses(partyMembers: { className: string; level: number }[]): string[] {
  const weaknesses: string[] = [];
  const classes = partyMembers.map(m => m.className.toLowerCase());
  
  const hasTank = classes.some(c => ["guerrero", "paladín", "bárbaro"].includes(c));
  const hasHealer = classes.some(c => ["clérigo", "druida", "paladín", "bardo"].includes(c));
  const hasCaster = classes.some(c => ["mago", "hechicero", "brujo"].includes(c));
  
  if (!hasTank) weaknesses.push("SIN_TANQUE: No hay tanque frontal. Reducir criaturas cuerpo a cuerpo agresivas o añadir terreno defensivo.");
  if (!hasHealer) weaknesses.push("SIN_SANADOR: No hay sanador dedicado. Considerar menor daño sostenido y añadir opciones de descanso corto.");
  if (partyMembers.length <= 2) weaknesses.push("GRUPO_PEQUEÑO: Grupo reducido. Reducir número de enemigos para evitar desventaja de acción.");
  if (partyMembers.length >= 6) weaknesses.push("GRUPO_GRANDE: Grupo numeroso. Aumentar enemigos o añadir objetivos secundarios.");
  
  return weaknesses;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { partyMembers, partySize, avgLevel, difficulty, difficultyLabel, region, encounterTheme, specificRequest, campaignId } = await req.json();

    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;
    let campaignContext: any = null;

    if (authHeader.startsWith("Bearer ")) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id || null;
        if (campaignId && userId) {
          const { data: campaign } = await supabase
            .from("campaigns")
            .select("name, region, tone, level_range, narrative_context")
            .eq("id", campaignId)
            .single();
          if (campaign) campaignContext = campaign;
        }
      } catch (authErr) {
        console.warn("Auth extraction failed, continuing without user context:", authErr);
      }
    }

    const partyAnalysis = (partyMembers || []).map((m: any) => `- ${m.className} nivel ${m.level}`).join("\n");
    const partyWithLevels = (partyMembers || []).map((m: any) => ({ level: m.level || 5, className: m.className || "Guerrero" }));
    const partyWeaknesses = analyzePartyWeaknesses(partyWithLevels);

    const systemPrompt = `Eres un diseñador de encuentros tácticos experto para D&D 5e (Forgotten Realms). 
Tu trabajo es crear encuentros equilibrados, detallados y jugables siguiendo ESTRICTAMENTE las reglas oficiales de D&D 5e.

REGLAS FUNDAMENTALES:
1. Usa SOLO criaturas del Monster Manual, Volo's Guide, Mordenkainen's Tome, Fizban's Treasury y otros libros OFICIALES de D&D 5e.
2. Los CR deben ser precisos y verificados contra las tablas oficiales de XP por CR.
3. El equilibrio debe seguir las tablas de umbrales de XP del DMG (cap. 3).
4. Aplica el multiplicador de XP por número de enemigos (DMG p.82).
5. Incluye stats reales: CA, PG, velocidad, ataques, habilidades y hechizos tal como aparecen en los manuales.
6. SIEMPRE incluye sinergia táctica real entre las criaturas.
7. Las criaturas DEBEN tener ### en formato: ### [Nombre] (CR [X], [XP] XP) - OBLIGATORIO para validación.

FORMATO DE RESPUESTA (Markdown estructurado):

# ⚔️ [Título del Encuentro]

## 📊 Resumen del Encuentro
- **Dificultad:** [Fácil/Moderado/Desafiante/Difícil/Mortal]
- **XP Total:** [cantidad] XP (ajustado: [cantidad] XP)
- **Nº Criaturas:** [cantidad]
- **Entorno:** [tipo de terreno/ubicación]
- **Región:** [región de Faerûn]

## 🎯 Resumen Táctico
[Párrafo breve de 2-3 frases describiendo la premisa del combate: qué buscan los enemigos, cuál es la amenaza principal y qué hace único este encuentro]

## 👥 Análisis del Grupo
[Resumen de fortalezas y debilidades del grupo basado en su composición]

## 🐉 Criaturas del Encuentro
Para CADA criatura (OBLIGATORIO usar este formato exacto):
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
- **Hechizos** (si aplica)
- **Rasgos Especiales:** [lista]

## ⚖️ Validación de Equilibrio
- **XP por jugador:** [cantidad]
- **Umbral Fácil:** [valor] | **Moderado:** [valor] | **Difícil:** [valor] | **Letal:** [valor]
- **Clasificación real:** [resultado]
- **Multiplicador aplicado:** ×[valor] (por [X] criaturas)
- **Ajustes recomendados:** [si aplica]

## 🎯 Estrategia Táctica por Fases

### ⚡ Inicio del Combate (Asaltos 1-2)
[Cómo abren el combate los enemigos: posicionamiento, ataques iniciales, habilidades de apertura]

### 🔄 Punto Medio (Asaltos 3-4)
[Cómo adaptan la táctica: cambios de foco, uso de habilidades especiales, sinergias entre criaturas]

### 🏆 Si los Enemigos Están Ganando
[Qué hacen si tienen ventaja: presionar, hacer prisioneros, exigir rendición, ejecutar debilitados]

### 💀 Si los Enemigos Están Perdiendo
[Cuándo y cómo se retiran, piden refuerzos, negocian, luchan hasta la muerte o intentan escapar]

## 🗺️ Descripción del Escenario
[Descripción narrativa del lugar, atmósfera, elementos interactivos]

### Elementos del Terreno
- [Elemento 1]: [efecto mecánico]
- [Elemento 2]: [efecto mecánico]

## 💰 Recompensas
- **XP Total:** [cantidad] (÷ ${partySize || 4} = [XP por jugador])
- **Tesoro:** [según tablas del DMG]

## 📝 Notas del DM
[Consejos para dirigir el encuentro, variaciones, ganchos narrativos]`;

    const effectiveRegion = campaignContext?.region || region || "Costa de la Espada";
    const effectiveTone = campaignContext?.tone || "épico";

    const regionLoreMap: Record<string, string> = {
      "Costa de la Espada": "Criaturas típicas: goblins, gnolls, orcos, bandidos del Camino Comercial, dragones jóvenes, sahuagin. Clima: templado oceánico, nieblas frecuentes.",
      "Costa de la Espada Norte": "Criaturas típicas: trolls de hielo, gigantes de escarcha, lobos invernales, yetis, orcos de Muchas Flechas, dragones blancos. Clima: frío severo.",
      "Norte": "Criaturas típicas: gigantes de escarcha y fuego, remorhaz, wyverns, quimeras, osos polares. Clima: ártico/subártico.",
      "Valles": "Criaturas típicas: drow de Cormanthor, arañas gigantes, licántropos, treants corruptos, bandidos zhentarim. Clima: continental templado.",
      "Cormyr": "Criaturas típicas: gnolls de las fronteras, goblinoides, no-muertos del Pantano de los Trolls. Clima: templado.",
      "Calimshan": "Criaturas típicas: genasi, djinn, efreet, lamias, yuan-ti, escorpiones gigantes. Clima: árido, calor extremo.",
      "Chult": "Criaturas típicas: dinosaurios, yuan-ti, pteranodontes, zombies de la Maldición de la Muerte. Clima: tropical.",
      "Thay": "Criaturas típicas: no-muertos, gólems, quimeras arcanas, demonios invocados. Clima: continental, tormentas arcanas.",
      "Amn": "Criaturas típicas: ogros, bandidos mercantiles, yuan-ti infiltrados. Clima: mediterráneo.",
      "Sembia": "Criaturas típicas: espías, asesinos, constructos de guardia, sombras de Shar. Clima: templado continental.",
      "Mar de la Luna": "Criaturas típicas: aberraciones, zombies de Phlan, dragones negros, beholders. Clima: continental húmedo.",
      "Corazón Occidental": "Criaturas típicas: bandidos, licántropos, no-muertos del Darkhold, wyverns. Clima: templado.",
      "Tethyr": "Criaturas típicas: monstruos del Bosque de Tethir, ogros, trolls del bosque. Clima: mediterráneo cálido.",
      "Rashemen": "Criaturas típicas: berserkers, espíritus, lobos terribles, fey oscuras, elementales. Clima: frío continental.",
    };

    const regionLore = regionLoreMap[effectiveRegion] || `Región: ${effectiveRegion}. Usa criaturas apropiadas para esta zona de Faerûn.`;

    let baseUserPrompt = `COMPOSICIÓN DEL GRUPO (${partySize || partyMembers?.length || 4} jugadores, nivel promedio ${avgLevel}):
${partyAnalysis}

DIFICULTAD OBJETIVO: ${difficultyLabel || "Desafiante"} (nivel ${difficulty}/5)
REGIÓN: ${effectiveRegion}
TONO: ${effectiveTone}

CONTEXTO REGIONAL: ${regionLore}`;

    if (partyWeaknesses.length > 0) {
      baseUserPrompt += `\n\nAJUSTES POR COMPOSICIÓN DEL GRUPO:\n${partyWeaknesses.join("\n")}`;
    }

    if (encounterTheme) baseUserPrompt += `\nTEMA DEL ENCUENTRO: ${encounterTheme}. El encuentro DEBE girar alrededor de este tema.`;
    if (specificRequest) baseUserPrompt += `\nINDICACIONES CREATIVAS DEL USUARIO (integrar obligatoriamente): ${specificRequest}`;
    baseUserPrompt += `\n\nVerifica que todos los parámetros proporcionados han sido utilizados de forma significativa.`;
    if (campaignContext) {
      baseUserPrompt += `\n\nCONTEXTO DE CAMPAÑA:
- Campaña: ${campaignContext.name}
- Rango de nivel: ${campaignContext.level_range}
- Región: ${campaignContext.region}
- Tono: ${campaignContext.tone}`;
      if (campaignContext.narrative_context) {
        const nc = campaignContext.narrative_context;
        if (nc.active_npcs?.length) baseUserPrompt += `\n- PNJs activos: ${nc.active_npcs.slice(0, 5).join(", ")}`;
        if (nc.regions_explored?.length) baseUserPrompt += `\n- Regiones exploradas: ${nc.regions_explored.slice(0, 5).join(", ")}`;
        if (nc.open_conflicts?.length) baseUserPrompt += `\n- Conflictos abiertos: ${nc.open_conflicts.slice(0, 3).join(", ")}`;
      }
    }

    // ── GENERATION + VALIDATION LOOP ──
    const thresholds = getPartyThresholds(partyWithLevels);
    const targetRange = getTargetXPRange(difficulty, thresholds);
    const maxAttempts = 3;
    let encounterMd = "";
    let validation: ValidationResult | null = null;
    let providerInfo: "primary" | "alternative" = "primary";

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let userPrompt = baseUserPrompt;

      if (attempt === 0) {
        userPrompt += `\n\nREFERENCIA DE EQUILIBRIO:
- Fácil: ${thresholds.easy} XP | Moderado: ${thresholds.medium} XP | Difícil: ${thresholds.hard} XP | Letal: ${thresholds.deadly} XP
- Rango XP ajustado objetivo para "${difficultyLabel}": ${Math.round(targetRange.min)} – ${Math.round(targetRange.max)} XP
- Recuerda aplicar multiplicador por número de criaturas (DMG p.82).

Diseña el encuentro completo. Usa SOLO criaturas oficiales coherentes con la región.`;
      } else {
        userPrompt += `\n\n⚠️ CORRECCIÓN (intento ${attempt + 1}):
Problemas: ${validation!.errors.map(e => `- ${e}`).join("\n")}
XP base: ${validation!.baseXP} | XP ajustado: ${validation!.adjustedXP} | Criaturas: ${validation!.totalCreatures}
Rango objetivo: ${Math.round(targetRange.min)} – ${Math.round(targetRange.max)} XP
Genera el encuentro COMPLETO de nuevo corregido.`;
      }

      console.log(`[generate-encounter] Attempt ${attempt + 1}/${maxAttempts}`);

      const aiResult = await callAI(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { temperature: attempt === 0 ? 0.8 : 0.5, userId: userId || undefined }
      );

      if (!aiResult) {
        return new Response(JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      providerInfo = aiResult.provider;
      const data = await aiResult.response.json();
      encounterMd = data.choices?.[0]?.message?.content || "";

      const creatures = parseCreaturesFromMarkdown(encounterMd);
      validation = validateEncounter(creatures, partyWithLevels, difficulty);

      console.log(`[generate-encounter] Attempt ${attempt + 1}: ${creatures.length} types, ${validation.totalCreatures} total, XP: ${validation.adjustedXP}, ${validation.classification}, errors: ${validation.errors.length}`);

      if (validation.valid) {
        console.log(`[generate-encounter] ✅ Validated on attempt ${attempt + 1}`);
        break;
      }

      if (creatures.length === 0 && encounterMd.length > 500 && attempt === maxAttempts - 1) {
        console.log("[generate-encounter] ⚠️ Could not parse creatures but content substantial, accepting.");
        break;
      }
    }

    if (validation) {
      const badge = validation.valid
        ? `\n\n---\n> ✅ **Validación automática:** Encuentro equilibrado. XP ajustado: ${validation.adjustedXP} (${validation.classification}). ${validation.totalCreatures} criaturas.`
        : `\n\n---\n> ⚠️ **Validación automática:** Posibles desajustes tras ${maxAttempts} intentos. XP ajustado: ${validation.adjustedXP} (${validation.classification}). Revisa manualmente.\n> Problemas: ${validation.errors.join(" | ")}`;
      encounterMd += badge;
    }

    return new Response(JSON.stringify({ 
      encounter_markdown: encounterMd, 
      userId, 
      validation,
      provider: providerInfo === "primary" ? "primary" : "alternative",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("generate-encounter error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error generando encuentro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
