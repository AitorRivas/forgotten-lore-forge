import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un motor profesional de generación narrativa para D&D 5e ambientado en Forgotten Realms.

OBJETIVO: Generar misiones como arcos narrativos completos listos para jugar.

FORMATO DE SALIDA: JSON ESTRICTO.
Responde ÚNICAMENTE con un objeto JSON válido. Sin markdown, sin emojis, sin texto fuera del JSON.
NO envuelvas en bloques de código.

LÍMITES DE CARACTERES POR CAMPO (obligatorio, nunca exceder):
- nombre: máx 60 caracteres
- contexto_general: máx 900 caracteres
- detonante: máx 500 caracteres
- conflicto_real: máx 600 caracteres
- actos: array de exactamente 3 objetos, cada uno con:
    - titulo: máx 40 caracteres
    - objetivo: máx 300 caracteres
    - obstaculo: máx 300 caracteres
    - giro: máx 300 caracteres
- enfoques_resolucion: array de exactamente 3 objetos, cada uno con:
    - tipo: "combate" | "social" | "estrategico"
    - descripcion: máx 500 caracteres
- giros_argumentales: array de exactamente 2 strings, máx 300 caracteres cada uno
- consecuencias_exito: máx 500 caracteres
- consecuencias_fracaso: máx 500 caracteres
- consecuencias_ignorar: máx 400 caracteres
- secretos: array de exactamente 2 strings, máx 300 caracteres cada uno
- recompensas: máx 400 caracteres
- notas_dm: máx 600 caracteres

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
  "notas_dm": "string"
}`;

/** Trim a string to maxLen at the last complete sentence or word boundary */
function safeTrim(text: string | undefined | null, maxLen: number): string {
  if (!text) return "";
  let s = text.trim();
  if (s.length <= maxLen) return s;
  // Cut at last sentence boundary
  const cut = s.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf(".");
  if (lastPeriod > maxLen * 0.5) return cut.slice(0, lastPeriod + 1);
  // Fall back to last space
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLen * 0.5) return cut.slice(0, lastSpace) + ".";
  return cut;
}

function extractJSON(raw: string): any {
  // Strip markdown code fences
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON object found");
  if (end === -1) {
    // Try to repair truncated JSON
    cleaned = cleaned.slice(start) + '"}]}';
  } else {
    cleaned = cleaned.slice(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt repair: add missing closing brackets
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

const DEFAULT_MISSION = {
  nombre: "Misión sin título",
  contexto_general: "",
  detonante: "",
  conflicto_real: "",
  actos: [
    { titulo: "Fase 1", objetivo: "", obstaculo: "", giro: "" },
    { titulo: "Fase 2", objetivo: "", obstaculo: "", giro: "" },
    { titulo: "Fase 3", objetivo: "", obstaculo: "", giro: "" },
  ],
  enfoques_resolucion: [
    { tipo: "combate", descripcion: "" },
    { tipo: "social", descripcion: "" },
    { tipo: "estrategico", descripcion: "" },
  ],
  giros_argumentales: ["", ""],
  consecuencias_exito: "",
  consecuencias_fracaso: "",
  consecuencias_ignorar: "",
  secretos: ["", ""],
  recompensas: "",
  notas_dm: "",
};

function sanitizeMission(raw: any): typeof DEFAULT_MISSION {
  const m = { ...DEFAULT_MISSION };
  m.nombre = safeTrim(raw.nombre, 60) || m.nombre;
  m.contexto_general = safeTrim(raw.contexto_general, 900);
  m.detonante = safeTrim(raw.detonante, 500);
  m.conflicto_real = safeTrim(raw.conflicto_real, 600);
  
  if (Array.isArray(raw.actos)) {
    m.actos = raw.actos.slice(0, 3).map((a: any, i: number) => ({
      titulo: safeTrim(a?.titulo, 40) || `Fase ${i + 1}`,
      objetivo: safeTrim(a?.objetivo, 300),
      obstaculo: safeTrim(a?.obstaculo, 300),
      giro: safeTrim(a?.giro, 300),
    }));
    while (m.actos.length < 3) m.actos.push({ titulo: `Fase ${m.actos.length + 1}`, objetivo: "", obstaculo: "", giro: "" });
  }

  if (Array.isArray(raw.enfoques_resolucion)) {
    m.enfoques_resolucion = raw.enfoques_resolucion.slice(0, 3).map((e: any) => ({
      tipo: ["combate", "social", "estrategico"].includes(e?.tipo) ? e.tipo : "combate",
      descripcion: safeTrim(e?.descripcion, 500),
    }));
    while (m.enfoques_resolucion.length < 3) {
      const tipos = ["combate", "social", "estrategico"];
      m.enfoques_resolucion.push({ tipo: tipos[m.enfoques_resolucion.length] || "combate", descripcion: "" });
    }
  }

  if (Array.isArray(raw.giros_argumentales)) {
    m.giros_argumentales = raw.giros_argumentales.slice(0, 2).map((g: any) => safeTrim(String(g || ""), 300));
    while (m.giros_argumentales.length < 2) m.giros_argumentales.push("");
  }

  m.consecuencias_exito = safeTrim(raw.consecuencias_exito, 500);
  m.consecuencias_fracaso = safeTrim(raw.consecuencias_fracaso, 500);
  m.consecuencias_ignorar = safeTrim(raw.consecuencias_ignorar, 400);

  if (Array.isArray(raw.secretos)) {
    m.secretos = raw.secretos.slice(0, 2).map((s: any) => safeTrim(String(s || ""), 300));
    while (m.secretos.length < 2) m.secretos.push("");
  }

  m.recompensas = safeTrim(raw.recompensas, 400);
  m.notas_dm = safeTrim(raw.notas_dm, 600);

  return m;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, ubicacion, tipo, nivelGrupo, tono, customPrompt, parentMissionId } = await req.json();

    if (!ubicacion || !tipo) {
      return new Response(
        JSON.stringify({ error: "Ubicación y tipo de misión son obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let contextBlock = "";
    const { data: recentMissions } = await supabase
      .from("misiones")
      .select("titulo, tipo, ubicacion_principal, conflicto_central")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentMissions && recentMissions.length > 0) {
      contextBlock += "\nMISIONES RECIENTES (evita repetir patrones):\n";
      recentMissions.forEach((m: any) => {
        contextBlock += `- ${m.titulo || "Sin título"} | ${m.tipo || "?"} | ${m.ubicacion_principal || "?"}\n`;
      });
    }

    if (parentMissionId) {
      const { data: parent } = await supabase
        .from("misiones")
        .select("titulo, ubicacion_principal, conflicto_central")
        .eq("id", parentMissionId)
        .single();
      if (parent) {
        contextBlock += `\nMISIÓN PADRE (esta es una submisión): ${parent.titulo || "Sin título"} en ${parent.ubicacion_principal || "?"}. Conflicto: ${parent.conflicto_central || "?"}`;
      }
    }

    let userPrompt = `Genera una misión con estos parámetros:
TIPO: ${tipo}
UBICACIÓN: ${ubicacion}
NIVEL: ${nivelGrupo || "1-5"}
TONO: ${tono || "épico"}`;

    if (customPrompt) userPrompt += `\nINSTRUCCIONES ADICIONALES: ${customPrompt}`;
    if (contextBlock) userPrompt += `\n${contextBlock}`;
    userPrompt += "\n\nResponde SOLO con el JSON estructurado. Sin markdown ni texto adicional.";

    const aiResult = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-flash", stream: false, userId, temperature: 0.8 }
    );

    if (!aiResult) {
      return new Response(
        JSON.stringify({ error: "Los servicios de IA están saturados. Inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawText = await aiResult.response.text();
    
    // Parse SSE or direct JSON
    let fullText = "";
    if (rawText.includes("data: ")) {
      const lines = rawText.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.delta?.content || "";
          fullText += content;
        } catch { /* skip */ }
      }
    } else {
      // Try direct OpenAI-format response
      try {
        const parsed = JSON.parse(rawText);
        fullText = parsed.choices?.[0]?.message?.content || rawText;
      } catch {
        fullText = rawText;
      }
    }

    let mission;
    try {
      const rawJson = extractJSON(fullText);
      mission = sanitizeMission(rawJson);
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", fullText.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Error procesando respuesta de IA. Inténtalo de nuevo.", raw: fullText.slice(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
