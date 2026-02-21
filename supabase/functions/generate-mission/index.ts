import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAIWithFallback, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NORMAL_LIMITS = {
  nombre: 60, contexto_general: 900, detonante: 500, conflicto_real: 600,
  acto_titulo: 40, acto_campo: 300, enfoque_desc: 500,
  giro: 300, cons_exito: 500, cons_fracaso: 500, cons_ignorar: 400,
  secreto: 300, recompensas: 400, notas_dm: 600,
};

const EXTENDED_LIMITS = {
  nombre: 80, contexto_general: 1800, detonante: 900, conflicto_real: 1200,
  acto_titulo: 60, acto_campo: 600, enfoque_desc: 800,
  giro: 500, cons_exito: 800, cons_fracaso: 800, cons_ignorar: 600,
  secreto: 500, recompensas: 700, notas_dm: 1000,
};

function buildSystemPrompt(limits: typeof NORMAL_LIMITS, isExtended: boolean) {
  const extra = isExtended ? `
CAMPOS ADICIONALES (modo extendido):
- subtramas: array de 2 strings, máx ${limits.secreto} caracteres cada una
- detalle_ambiental: máx ${limits.detonante} caracteres
- pnj_implicados: array de 2 objetos con {nombre, rol, motivacion} (máx 200 chars cada campo)
` : "";

  const extraSchema = isExtended ? `
  "subtramas": ["string", "string"],
  "detalle_ambiental": "string",
  "pnj_implicados": [{"nombre":"string","rol":"string","motivacion":"string"},{"nombre":"string","rol":"string","motivacion":"string"}]` : "";

  return `Eres un motor profesional de generación narrativa para D&D 5e ambientado en Forgotten Realms.

OBJETIVO: Generar misiones como arcos narrativos completos listos para jugar.

FORMATO DE SALIDA: JSON ESTRICTO.
Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin emojis, sin texto fuera del JSON.
NO envuelvas en bloques de código.

LÍMITES DE CARACTERES POR CAMPO (obligatorio, nunca exceder):
- nombre: máx ${limits.nombre} caracteres
- contexto_general: máx ${limits.contexto_general} caracteres
- detonante: máx ${limits.detonante} caracteres
- conflicto_real: máx ${limits.conflicto_real} caracteres
- actos: array de exactamente 3 objetos, cada uno con:
    - titulo: máx ${limits.acto_titulo} caracteres
    - objetivo: máx ${limits.acto_campo} caracteres
    - obstaculo: máx ${limits.acto_campo} caracteres
    - giro: máx ${limits.acto_campo} caracteres
- enfoques_resolucion: array de exactamente 3 objetos, cada uno con:
    - tipo: "combate" | "social" | "estrategico"
    - descripcion: máx ${limits.enfoque_desc} caracteres
- giros_argumentales: array de exactamente 2 strings, máx ${limits.giro} caracteres cada uno
- consecuencias_exito: máx ${limits.cons_exito} caracteres
- consecuencias_fracaso: máx ${limits.cons_fracaso} caracteres
- consecuencias_ignorar: máx ${limits.cons_ignorar} caracteres
- secretos: array de exactamente 2 strings, máx ${limits.secreto} caracteres cada uno
- recompensas: máx ${limits.recompensas} caracteres
- notas_dm: máx ${limits.notas_dm} caracteres
${extra}

REGLAS:
- Prioriza claridad y síntesis.
- No repitas información entre campos.
- Frases cortas y completas. Nunca cortes palabras ni dejes frases incompletas.
- Usa lore oficial de Forgotten Realms.
- Adapta cultura, religión y facciones a la región.
- La misión debe mezclar combate, intriga, investigación y decisiones morales.
- NUNCA generes misiones lineales.

ESQUEMA JSON EXACTO:
{
  "nombre": "string",
  "contexto_general": "string",
  "detonante": "string",
  "conflicto_real": "string",
  "actos": [
    {"titulo": "string", "objetivo": "string", "obstaculo": "string", "giro": "string"},
    {"titulo": "string", "objetivo": "string", "obstaculo": "string", "giro": "string"},
    {"titulo": "string", "objetivo": "string", "obstaculo": "string", "giro": "string"}
  ],
  "enfoques_resolucion": [
    {"tipo": "combate", "descripcion": "string"},
    {"tipo": "social", "descripcion": "string"},
    {"tipo": "estrategico", "descripcion": "string"}
  ],
  "giros_argumentales": ["string", "string"],
  "consecuencias_exito": "string",
  "consecuencias_fracaso": "string",
  "consecuencias_ignorar": "string",
  "secretos": ["string", "string"],
  "recompensas": "string",
  "notas_dm": "string"${extraSchema}
}`;
}

function safeTrim(text: string | undefined | null, maxLen: number): string {
  if (!text) return "";
  let s = text.trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf(".");
  if (lastPeriod > maxLen * 0.5) return cut.slice(0, lastPeriod + 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) return cut.slice(0, lastSpace) + ".";
  return cut;
}

function extractJSON(raw: string): any {
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON object found");
  if (end === -1) {
    cleaned = cleaned.slice(start) + '"}]}';
  } else {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const opens = (repaired.match(/{/g) || []).length;
    const closes = (repaired.match(/}/g) || []).length;
    for (let i = 0; i < opens - closes; i++) repaired += "}";
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    return JSON.parse(repaired);
  }
}

function validateMission(m: any): string[] {
  const errors: string[] = [];
  if (!m.nombre) errors.push("nombre vacío");
  if (!m.contexto_general) errors.push("contexto_general vacío");
  if (!m.detonante) errors.push("detonante vacío");
  if (!Array.isArray(m.actos) || m.actos.length < 3) errors.push("menos de 3 actos");
  // Check for truncated words (ending in consonant cluster without vowel)
  const fields = [m.nombre, m.contexto_general, m.detonante, m.conflicto_real, m.consecuencias_exito, m.consecuencias_fracaso, m.notas_dm];
  for (const f of fields) {
    if (typeof f === "string" && f.length > 5 && /[bcdfghjklmnpqrstvwxyz]{3,}$/i.test(f)) {
      errors.push("posible texto truncado detectado");
      break;
    }
  }
  return errors;
}

function sanitizeMission(raw: any, limits: typeof NORMAL_LIMITS, isExtended: boolean) {
  const m: any = {
    nombre: safeTrim(raw.nombre, limits.nombre) || "Misión sin título",
    contexto_general: safeTrim(raw.contexto_general, limits.contexto_general),
    detonante: safeTrim(raw.detonante, limits.detonante),
    conflicto_real: safeTrim(raw.conflicto_real, limits.conflicto_real),
    actos: [],
    enfoques_resolucion: [],
    giros_argumentales: [],
    consecuencias_exito: safeTrim(raw.consecuencias_exito, limits.cons_exito),
    consecuencias_fracaso: safeTrim(raw.consecuencias_fracaso, limits.cons_fracaso),
    consecuencias_ignorar: safeTrim(raw.consecuencias_ignorar, limits.cons_ignorar),
    secretos: [],
    recompensas: safeTrim(raw.recompensas, limits.recompensas),
    notas_dm: safeTrim(raw.notas_dm, limits.notas_dm),
  };

  if (Array.isArray(raw.actos)) {
    m.actos = raw.actos.slice(0, 3).map((a: any, i: number) => ({
      titulo: safeTrim(a?.titulo, limits.acto_titulo) || `Fase ${i + 1}`,
      objetivo: safeTrim(a?.objetivo, limits.acto_campo),
      obstaculo: safeTrim(a?.obstaculo, limits.acto_campo),
      giro: safeTrim(a?.giro, limits.acto_campo),
    }));
  }
  while (m.actos.length < 3) m.actos.push({ titulo: `Fase ${m.actos.length + 1}`, objetivo: "", obstaculo: "", giro: "" });

  if (Array.isArray(raw.enfoques_resolucion)) {
    m.enfoques_resolucion = raw.enfoques_resolucion.slice(0, 3).map((e: any) => ({
      tipo: ["combate", "social", "estrategico"].includes(e?.tipo) ? e.tipo : "combate",
      descripcion: safeTrim(e?.descripcion, limits.enfoque_desc),
    }));
  }
  const tipos = ["combate", "social", "estrategico"];
  while (m.enfoques_resolucion.length < 3) {
    m.enfoques_resolucion.push({ tipo: tipos[m.enfoques_resolucion.length] || "combate", descripcion: "" });
  }

  if (Array.isArray(raw.giros_argumentales)) {
    m.giros_argumentales = raw.giros_argumentales.slice(0, 2).map((g: any) => safeTrim(String(g || ""), limits.giro));
  }
  while (m.giros_argumentales.length < 2) m.giros_argumentales.push("");

  if (Array.isArray(raw.secretos)) {
    m.secretos = raw.secretos.slice(0, 2).map((s: any) => safeTrim(String(s || ""), limits.secreto));
  }
  while (m.secretos.length < 2) m.secretos.push("");

  // Extended fields
  if (isExtended) {
    m.subtramas = Array.isArray(raw.subtramas) ? raw.subtramas.slice(0, 2).map((s: any) => safeTrim(String(s || ""), limits.secreto)) : [];
    m.detalle_ambiental = safeTrim(raw.detalle_ambiental, limits.detonante);
    m.pnj_implicados = Array.isArray(raw.pnj_implicados) ? raw.pnj_implicados.slice(0, 2).map((p: any) => ({
      nombre: safeTrim(p?.nombre, 200),
      rol: safeTrim(p?.rol, 200),
      motivacion: safeTrim(p?.motivacion, 200),
    })) : [];
  }

  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, ubicacion, tipo, nivelGrupo, tono, customPrompt, parentMissionId, mode, regenerateField } = await req.json();

    // PARTIAL REGENERATION
    if (regenerateField) {
      const limits = mode === "extended" ? EXTENDED_LIMITS : NORMAL_LIMITS;
      const fieldPrompt = `Regenera SOLO el campo "${regenerateField}" de una misión D&D 5e.
Contexto: Tipo ${tipo || "aventura"}, Ubicación: ${ubicacion || "Faerûn"}, Nivel: ${nivelGrupo || "1-5"}, Tono: ${tono || "épico"}.
${customPrompt ? `Contexto adicional: ${customPrompt}` : ""}
Responde SOLO con el texto del campo, sin JSON, sin comillas, sin prefijos.
Máximo ${limits[regenerateField as keyof typeof limits] || 600} caracteres.
Frases completas. Nunca cortes palabras.`;

      const aiResult = await callAIWithFallback(
        [{ role: "system", content: "Eres un motor narrativo para D&D 5e en Forgotten Realms. Responde SOLO con el texto solicitado, sin formato JSON ni markdown." },
         { role: "user", content: fieldPrompt }],
        { model: "gemini-2.5-flash", stream: false, userId, temperature: 0.8 }
      );

      if (!aiResult) {
        return new Response(JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const rawText = await aiResult.response.text();
      let text = rawText;
      try {
        const parsed = JSON.parse(rawText);
        text = parsed.choices?.[0]?.message?.content || rawText;
      } catch { /* use raw */ }
      
      const maxLen = limits[regenerateField as keyof typeof limits] || 600;
      const trimmed = safeTrim(text.replace(/^["']|["']$/g, "").trim(), maxLen as number);

      return new Response(JSON.stringify({ field: regenerateField, value: trimmed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FULL GENERATION
    if (!ubicacion || !tipo) {
      return new Response(
        JSON.stringify({ error: "Ubicación y tipo de misión son obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isExtended = mode === "extended";
    const limits = isExtended ? EXTENDED_LIMITS : NORMAL_LIMITS;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let contextBlock = "";
    const { data: recentMissions } = await supabase
      .from("misiones").select("titulo, tipo, ubicacion_principal, conflicto_central")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);

    if (recentMissions?.length) {
      contextBlock += "\nMISIONES RECIENTES (evita repetir patrones):\n";
      recentMissions.forEach((m: any) => {
        contextBlock += `- ${m.titulo || "Sin título"} | ${m.tipo || "?"} | ${m.ubicacion_principal || "?"}\n`;
      });
    }

    if (parentMissionId) {
      const { data: parent } = await supabase
        .from("misiones").select("titulo, ubicacion_principal, conflicto_central")
        .eq("id", parentMissionId).single();
      if (parent) {
        contextBlock += `\nMISIÓN PADRE: ${parent.titulo || "Sin título"} en ${parent.ubicacion_principal || "?"}. Conflicto: ${parent.conflicto_central || "?"}`;
      }
    }

    let userPrompt = `Genera una misión ${isExtended ? "EXTENDIDA con máxima profundidad narrativa" : ""} con estos parámetros:
TIPO: ${tipo}
UBICACIÓN: ${ubicacion}
NIVEL: ${nivelGrupo || "1-5"}
TONO: ${tono || "épico"}`;

    if (customPrompt) userPrompt += `\nINSTRUCCIONES ADICIONALES: ${customPrompt}`;
    if (contextBlock) userPrompt += `\n${contextBlock}`;
    userPrompt += "\n\nResponde SOLO con el JSON estructurado. Sin markdown ni texto adicional.";

    const SYSTEM_PROMPT = buildSystemPrompt(limits, isExtended);

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: isExtended ? "gemini-2.5-pro" : "gemini-2.5-flash", stream: false, userId, temperature: 0.8 }
    );

    if (!aiResult) {
      // If extended failed, retry as normal
      if (isExtended) {
        console.log("Extended generation failed, falling back to normal mode");
        const normalPrompt = buildSystemPrompt(NORMAL_LIMITS, false);
        const retryResult = await callAIWithFallback(
          [{ role: "system", content: normalPrompt }, { role: "user", content: userPrompt }],
          { model: "gemini-2.5-flash", stream: false, userId, temperature: 0.8 }
        );
        if (!retryResult) {
          return new Response(
            JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Process with normal limits
        const rawText2 = await retryResult.response.text();
        let fullText2 = rawText2;
        try { const p = JSON.parse(rawText2); fullText2 = p.choices?.[0]?.message?.content || rawText2; } catch {}
        if (fullText2.includes("data: ")) {
          let t = "";
          for (const line of fullText2.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const d = line.slice(6); if (d === "[DONE]") continue;
            try { t += JSON.parse(d).choices?.[0]?.message?.content || JSON.parse(d).choices?.[0]?.delta?.content || ""; } catch {}
          }
          fullText2 = t || fullText2;
        }
        const mission2 = sanitizeMission(extractJSON(fullText2), NORMAL_LIMITS, false);
        return new Response(JSON.stringify({ ...mission2, _mode: "normal", _fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-AI-Provider": retryResult.provider },
        });
      }
      return new Response(
        JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawText = await aiResult.response.text();
    let fullText = "";
    if (rawText.includes("data: ")) {
      for (const line of rawText.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6); if (data === "[DONE]") continue;
        try { fullText += JSON.parse(data).choices?.[0]?.message?.content || JSON.parse(data).choices?.[0]?.delta?.content || ""; } catch {}
      }
    } else {
      try { fullText = JSON.parse(rawText).choices?.[0]?.message?.content || rawText; } catch { fullText = rawText; }
    }

    let mission;
    try {
      const rawJson = extractJSON(fullText);
      mission = sanitizeMission(rawJson, limits, isExtended);
    } catch (e) {
      // Validation retry
      console.error("JSON parse error, retrying:", e);
      const retryResult = await callAIWithFallback(
        [{ role: "system", content: buildSystemPrompt(NORMAL_LIMITS, false) },
         { role: "user", content: userPrompt + "\n\nIMPORTANTE: El intento anterior falló. Genera un JSON válido y simple." }],
        { model: "gemini-2.5-flash", stream: false, userId, temperature: 0.7 }
      );
      if (!retryResult) {
        return new Response(
          JSON.stringify({ error: "Error procesando respuesta de IA. Inténtalo de nuevo." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const rt = await retryResult.response.text();
      let ft = rt;
      try { ft = JSON.parse(rt).choices?.[0]?.message?.content || rt; } catch {}
      mission = sanitizeMission(extractJSON(ft), NORMAL_LIMITS, false);
      mission._mode = "normal";
      mission._fallback = true;
    }

    // Validate
    const errors = validateMission(mission);
    if (errors.length > 0) {
      console.warn("Validation warnings:", errors);
      mission._warnings = errors;
    }

    mission._mode = isExtended ? "extended" : "normal";

    return new Response(JSON.stringify(mission), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-AI-Provider": aiResult.provider },
    });
  } catch (e) {
    console.error("generate-mission error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
