import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };

async function callAIWithFallback(messages: any[], options: { model?: string; stream?: boolean } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro"; const body: any = { model: geminiModel, messages };
  if (options.stream) body.stream = true;
  if (GEMINI_API_KEY) { try { const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (resp.ok) return resp; if (resp.status === 429) console.log("Gemini rate limited..."); else console.error("Gemini error:", resp.status); } catch (e) { console.error("Gemini fetch error:", e); } }
  if (LOVABLE_API_KEY) { try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: `google/${geminiModel}` }) }); if (resp.ok) return resp; if (resp.status === 429 || resp.status === 402) console.log("Lovable AI (Google) unavailable, trying ChatGPT..."); else console.error("Lovable AI error:", resp.status); } catch (e) { console.error("Lovable AI error:", e); } }
  if (LOVABLE_API_KEY) { const m = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5"; try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: m }) }); if (resp.ok) return resp; console.error("ChatGPT fallback error:", resp.status); } catch (e) { console.error("ChatGPT error:", e); } }
  return null;
}

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

2. **CAMBIAR DINÁMICAS SOCIALES**: Alterna entre aliados que se vuelven enemigos, dilemas sin "lado bueno", traiciones inesperadas, facciones neutrales forzadas, víctimas culpables / villanos con razones.

3. **INTRODUCIR ELEMENTOS INESPERADOS**: Cada misión DEBE tener al menos un elemento que rompa expectativas.

4. **EVITAR CLICHÉS REPETITIVOS**: PROHIBIDO repetir patrones consecutivos.

5. **ROTAR TIPOS DE MISIÓN**: Alterna entre investigación, diplomacia, exploración, defensa, infiltración, supervivencia, heist, juicio, carrera contra el tiempo, espionaje.

6. **VARIAR ANTAGONISTAS**: El nuevo antagonista DEBE ser de un tipo diferente al anterior.

=== FIN CONTROL DE DIVERSIDAD ===

FORMATO DE RESPUESTA (usa markdown):

## 🗡️ [Título de la Misión]

### 📜 Resumen
[Resumen breve en 2-3 oraciones]

### 🪝 Gancho Narrativo
[Cómo los aventureros se enteran]

### 📍 Ubicación
[Lugar específico en Forgotten Realms]

### 🎭 NPCs Clave
[NPCs nuevos y existentes con detalles]

### ⚔️ Encuentros
[2-3 encuentros detallados]

### 🧩 Elementos Narrativos
[Intriga, investigación, combate, puzzle, dilema moral, giro]

### 🏆 Recompensas
[Tesoro, objetos mágicos, alianzas, información]

### 🔄 Consecuencias
[Según decisiones — cómo afecta a conflictos]

### 🔗 Conexiones con la Campaña
[Conexiones con eventos previos]

### 🎲 Variación Narrativa
[Qué elementos nuevos introduces]

### 📝 Notas para el DM
[Consejos de interpretación]`;

function analyzePatternsFromMissions(missions: any[]): string {
  if (!missions || missions.length === 0) return "";
  const patterns: string[] = [];
  const titles = missions.map((m: any) => m.title).filter(Boolean);
  if (titles.length > 0) patterns.push(`TÍTULOS RECIENTES:\n${titles.map((t: string) => `- "${t}"`).join("\n")}`);
  const allContent = missions.map((m: any) => m.full_content || m.summary || "").join("\n").toLowerCase();
  const detectedPatterns: string[] = [];
  const antagonistTypes: Record<string, string[]> = { "nigromante/no-muertos": ["nigromante", "no-muerto", "zombi", "lich"], "dragón": ["dragón", "dragon", "wyrm"], "culto/secta": ["culto", "secta", "ritual oscuro"], "bandidos/criminales": ["bandido", "criminal", "asesino"], "demonio/diablo": ["demonio", "diablo", "infernal"], "hechicero/mago": ["hechicero", "mago", "archimago"], "político/noble": ["noble", "lord", "barón", "duque"] };
  const usedTypes: string[] = [];
  for (const [type, keywords] of Object.entries(antagonistTypes)) { if (keywords.some(k => allContent.includes(k))) usedTypes.push(type); }
  if (usedTypes.length > 0) detectedPatterns.push(`Antagonistas usados: ${usedTypes.join(", ")}. USA TIPO DIFERENTE.`);
  const structureTypes: Record<string, string[]> = { "rescate": ["rescata", "prisionero", "liberar"], "escolta": ["escolta", "caravana"], "caza": ["caza", "bestia", "guarida"], "investigación": ["investiga", "misterio"], "defensa": ["defender", "asedio"], "exploración": ["explora", "ruinas"], "diplomacia": ["negociar", "alianza"], "infiltración": ["infiltra", "espía"] };
  const usedStructures: string[] = [];
  for (const [type, keywords] of Object.entries(structureTypes)) { if (keywords.some(k => allContent.includes(k))) usedStructures.push(type); }
  if (usedStructures.length > 0) detectedPatterns.push(`Estructuras usadas: ${usedStructures.join(", ")}. ELIGE DIFERENTE.`);
  if (detectedPatterns.length > 0) patterns.push(`\nPATRONES — EVITA REPETIRLOS:\n${detectedPatterns.map(p => `⚠️ ${p}`).join("\n")}`);
  return patterns.length > 0 ? `\n\n=== ANÁLISIS DE DIVERSIDAD ===\n${patterns.join("\n\n")}\n=== FIN ===` : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId, userId, customPrompt } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL"); const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
    if (campaignError || !campaign) throw new Error("Campaña no encontrada");

    const { data: missions } = await supabase.from("missions").select("title, summary, full_content").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(10);
    const { data: otherMissions } = await supabase.from("missions").select("title, summary").eq("user_id", userId).neq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(5);
    const { data: userContext } = await supabase.from("user_context").select("*").eq("user_id", userId).single();

    const ctx = campaign.narrative_context || {};
    let campaignContext = `\n\n=== CONTEXTO ===\nCampaña: "${campaign.name}"\nDescripción: ${campaign.description || "Sin descripción"}\nRegión: ${campaign.region || "Sin definir"}\nTono: ${campaign.tone || "épico"}\nNivel: ${campaign.level_range}\nActo: ${campaign.current_act || 1}`;
    if (ctx.summary) campaignContext += `\n\nRESUMEN:\n${ctx.summary}`;
    if (ctx.chapters?.length > 0) campaignContext += `\n\nCAPÍTULOS:\n${ctx.chapters.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
    if (ctx.important_events?.length > 0) campaignContext += `\n\nEVENTOS:\n${ctx.important_events.map((e: string) => `- ${e}`).join("\n")}`;
    if (ctx.known_antagonists?.length > 0) campaignContext += `\n\nANTAGONISTAS:\n${ctx.known_antagonists.map((a: string) => `- ${a}`).join("\n")}`;
    if (ctx.active_npcs?.length > 0) campaignContext += `\n\nPNJs:\n${ctx.active_npcs.map((n: string) => `- ${n}`).join("\n")}`;
    if (ctx.party_decisions?.length > 0) campaignContext += `\n\nDECISIONES:\n${ctx.party_decisions.map((d: string) => `- ${d}`).join("\n")}`;
    if (ctx.open_conflicts?.length > 0) campaignContext += `\n\nCONFLICTOS:\n${ctx.open_conflicts.map((c: string) => `- ${c}`).join("\n")}`;
    if (ctx.narrative_memory?.length > 0) campaignContext += `\n\nMEMORIA:\n${ctx.narrative_memory.slice(-5).map((m: string) => `- ${m}`).join("\n")}`;
    if (ctx.plot_hooks_pending?.length > 0) campaignContext += `\n\nGANCHOS:\n${ctx.plot_hooks_pending.map((h: string) => `- ${h}`).join("\n")}`;
    if (ctx.regions_explored?.length > 0) campaignContext += `\n\nREGIONES: ${ctx.regions_explored.join(", ")}`;
    if (missions && missions.length > 0) { campaignContext += `\n\nMISIONES ANTERIORES:\n`; missions.forEach((m: any, i: number) => { campaignContext += `${i + 1}. ${m.title}${m.summary ? ` — ${m.summary}` : ""}\n`; }); }
    if (userContext) {
      const recentStyles = (userContext.narrative_styles || []).slice(-5);
      if (recentStyles.length > 0) campaignContext += `\n\nESTILOS RECIENTES: ${recentStyles.join(", ")}`;
      const recentThemes = (userContext.recent_themes || []).slice(-5);
      if (recentThemes.length > 0) campaignContext += `\n\nTEMAS RECIENTES: ${recentThemes.join(", ")}`;
    }
    if (otherMissions && otherMissions.length > 0) { campaignContext += `\n\nMISIONES OTRAS CAMPAÑAS:\n`; otherMissions.forEach((m: any) => { campaignContext += `- ${m.title}\n`; }); }
    campaignContext += `\n=== FIN CONTEXTO ===`;

    const diversityAnalysis = analyzePatternsFromMissions(missions || []);
    let userPrompt = `Genera la siguiente misión para esta campaña. Recuerda: la DIVERSIDAD es obligatoria.`;
    if (customPrompt) userPrompt += `\n\nINSTRUCCIONES DEL DM:\n${customPrompt}`;
    userPrompt += campaignContext + diversityAnalysis;

    const response = await callAIWithFallback(
      [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userPrompt }],
      { model: "gemini-2.5-pro", stream: true }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Ambos servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("generate-mission error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});