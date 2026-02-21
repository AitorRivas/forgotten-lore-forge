import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { callAIWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `Eres un analista narrativo experto para campañas de Dungeons & Dragons 5e en Forgotten Realms.

Tu trabajo es analizar TODA la información disponible de una campaña y generar un BRIEFING ESTRUCTURADO.

Responde SOLAMENTE con JSON válido (sin markdown, sin backticks) con esta estructura exacta:

{
  "active_conflicts": [
    { "name": "nombre del conflicto", "status": "activo|escalando|latente", "parties_involved": ["parte1", "parte2"], "stakes": "qué está en juego", "next_likely_development": "qué podría pasar" }
  ],
  "growing_threats": [
    { "threat": "descripción", "severity": "baja|media|alta|crítica", "source": "origen", "timeline": "inmediata|corto plazo|largo plazo", "signs": "señales" }
  ],
  "key_relationships": [
    { "between": ["entidad1", "entidad2"], "nature": "alianza|rivalidad|tensión|deuda|romance|traición", "current_state": "estado", "potential_shift": "cambio posible" }
  ],
  "unresolved_clues": [
    { "clue": "descripción", "origin": "de dónde", "possible_leads": "hacia dónde", "urgency": "baja|media|alta" }
  ],
  "pending_consequences": [
    { "action": "qué hizo el grupo", "consequence": "resultado", "timing": "cuándo", "severity": "menor|moderada|mayor" }
  ],
  "political_tensions": [
    { "faction1": "facción 1", "faction2": "facción 2", "issue": "causa", "powder_keg": "qué podría hacerla estallar" }
  ],
  "secrets": {
    "revealed": [{ "secret": "secreto", "impact": "impacto", "who_knows": "quién lo sabe" }],
    "hidden": [{ "secret": "secreto", "holder": "quién lo guarda", "revelation_trigger": "qué lo revelaría", "narrative_impact": "impacto" }]
  },
  "narrative_momentum": {
    "dominant_theme": "tema",
    "emotional_arc": "arco emocional",
    "recommended_next_beat": "siguiente beat",
    "pacing_suggestion": "sugerencia de ritmo"
  },
  "dm_summary": "Resumen ejecutivo de 3-5 oraciones."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaignId } = await req.json();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: campaign, error: campaignError } = await supabase.from("campaigns").select("*").eq("id", campaignId).single();
    if (campaignError || !campaign) throw new Error("Campaña no encontrada");

    const { data: missions } = await supabase.from("missions")
      .select("title, summary, full_content, hook, location, npcs, encounters, rewards, session_number")
      .eq("campaign_id", campaignId).order("created_at", { ascending: true });

    const ctx = campaign.narrative_context || {};
    let analysisInput = `=== CAMPAÑA: "${campaign.name}" ===`;
    analysisInput += `\nDescripción: ${campaign.description || "Sin descripción"}`;
    analysisInput += `\nRegión: ${campaign.region || "Sin definir"}\nTono: ${campaign.tone || "épico"}\nNivel: ${campaign.level_range}\nActo: ${campaign.current_act || 1}`;

    if (ctx.summary) analysisInput += `\n\nRESUMEN: ${ctx.summary}`;
    if (ctx.chapters?.length > 0) analysisInput += `\n\nCAPÍTULOS:\n${ctx.chapters.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
    if (ctx.important_events?.length > 0) analysisInput += `\n\nEVENTOS:\n${ctx.important_events.map((e: string) => `- ${e}`).join("\n")}`;
    if (ctx.known_antagonists?.length > 0) analysisInput += `\n\nANTAGONISTAS:\n${ctx.known_antagonists.map((a: string) => `- ${a}`).join("\n")}`;
    if (ctx.active_npcs?.length > 0) analysisInput += `\n\nPNJs:\n${ctx.active_npcs.map((n: string) => `- ${n}`).join("\n")}`;
    if (ctx.party_decisions?.length > 0) analysisInput += `\n\nDECISIONES:\n${ctx.party_decisions.map((d: string) => `- ${d}`).join("\n")}`;
    if (ctx.open_conflicts?.length > 0) analysisInput += `\n\nCONFLICTOS:\n${ctx.open_conflicts.map((c: string) => `- ${c}`).join("\n")}`;
    if (ctx.narrative_memory?.length > 0) analysisInput += `\n\nMEMORIA:\n${ctx.narrative_memory.map((m: string) => `- ${m}`).join("\n")}`;
    if (ctx.plot_hooks_pending?.length > 0) analysisInput += `\n\nGANCHOS:\n${ctx.plot_hooks_pending.map((h: string) => `- ${h}`).join("\n")}`;
    if (ctx.regions_explored?.length > 0) analysisInput += `\n\nREGIONES: ${ctx.regions_explored.join(", ")}`;
    if (ctx.loot_given?.length > 0) analysisInput += `\n\nBOTÍN:\n${ctx.loot_given.map((l: string) => `- ${l}`).join("\n")}`;

    if (missions && missions.length > 0) {
      analysisInput += `\n\n=== MISIONES (${missions.length}) ===\n`;
      missions.forEach((m: any, i: number) => {
        analysisInput += `\n--- Misión ${i + 1}: ${m.title} ---`;
        if (m.summary) analysisInput += `\nResumen: ${m.summary}`;
        if (m.hook) analysisInput += `\nGancho: ${m.hook}`;
        if (m.location) analysisInput += `\nUbicación: ${m.location}`;
        if (m.full_content) {
          const content = m.full_content.length > 2000 ? m.full_content.substring(0, 2000) + "..." : m.full_content;
          analysisInput += `\nContenido:\n${content}`;
        }
      });
    }

    const aiResult = await callAIWithFallback(
      [
        { role: "system", content: "Eres un analista narrativo experto para campañas de D&D 5e. Responde SOLO con JSON válido, sin markdown ni backticks." },
        { role: "user", content: ANALYSIS_PROMPT + "\n\n" + analysisInput },
      ],
      { model: "gemini-2.5-flash" }
    );

    if (!aiResult) {
      return new Response(JSON.stringify({ error: "No hay proveedores de IA disponibles en este momento. Inténtalo en unos minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResult.response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    console.log("Raw AI content (first 500 chars):", rawContent.substring(0, 500));
    // Strip markdown fences and any leading/trailing non-JSON text
    let cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    // Try to extract JSON object if surrounded by other text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    let analysis: any;
    try { analysis = JSON.parse(cleaned); } catch (parseErr) {
      console.error("JSON parse failed. Cleaned content (first 1000 chars):", cleaned.substring(0, 1000));
      // Return a minimal valid analysis instead of crashing
      analysis = {
        active_conflicts: [], growing_threats: [], key_relationships: [],
        unresolved_clues: [], pending_consequences: [], political_tensions: [],
        secrets: { revealed: [], hidden: [] },
        narrative_momentum: { dominant_theme: "Sin datos suficientes", emotional_arc: "Por determinar", recommended_next_beat: "Continuar explorando", pacing_suggestion: "Normal" },
        dm_summary: "No se pudo analizar completamente la campaña. Intenta de nuevo."
      };
    }

    return new Response(JSON.stringify({ success: true, analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-campaign error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});