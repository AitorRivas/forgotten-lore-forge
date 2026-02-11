import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANALYSIS_PROMPT = `Eres un analista narrativo experto para campañas de Dungeons & Dragons 5e en Forgotten Realms.

Tu trabajo es analizar TODA la información disponible de una campaña y generar un BRIEFING ESTRUCTURADO que sirva como guía para la próxima sesión.

Responde SOLAMENTE con JSON válido (sin markdown, sin backticks) con esta estructura exacta:

{
  "active_conflicts": [
    { "name": "nombre del conflicto", "status": "activo|escalando|latente", "parties_involved": ["parte1", "parte2"], "stakes": "qué está en juego", "next_likely_development": "qué podría pasar" }
  ],
  "growing_threats": [
    { "threat": "descripción de la amenaza", "severity": "baja|media|alta|crítica", "source": "origen", "timeline": "inmediata|corto plazo|largo plazo", "signs": "señales que los jugadores podrían notar" }
  ],
  "key_relationships": [
    { "between": ["entidad1", "entidad2"], "nature": "alianza|rivalidad|tensión|deuda|romance|traición", "current_state": "estado actual", "potential_shift": "cómo podría cambiar" }
  ],
  "unresolved_clues": [
    { "clue": "descripción de la pista", "origin": "de dónde surgió", "possible_leads": "hacia dónde podría llevar", "urgency": "baja|media|alta" }
  ],
  "pending_consequences": [
    { "action": "qué hizo el grupo", "consequence": "qué debería resultar", "timing": "cuándo debería manifestarse", "severity": "menor|moderada|mayor" }
  ],
  "political_tensions": [
    { "faction1": "facción/grupo 1", "faction2": "facción/grupo 2", "issue": "causa de la tensión", "powder_keg": "qué podría hacerla estallar" }
  ],
  "secrets": {
    "revealed": [
      { "secret": "secreto revelado", "impact": "cómo afecta la trama", "who_knows": "quién lo sabe" }
    ],
    "hidden": [
      { "secret": "secreto aún oculto", "holder": "quién lo guarda", "revelation_trigger": "qué podría revelarlo", "narrative_impact": "cómo cambiaría la historia si se revela" }
    ]
  },
  "narrative_momentum": {
    "dominant_theme": "tema dominante actual",
    "emotional_arc": "dónde está emocionalmente la historia",
    "recommended_next_beat": "qué tipo de escena/evento sería ideal a continuación",
    "pacing_suggestion": "sugerencia de ritmo narrativo"
  },
  "dm_summary": "Resumen ejecutivo de 3-5 oraciones para el DM: estado general, prioridades y recomendación para la próxima sesión."
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaña no encontrada");
    }

    // Fetch all missions for deep analysis
    const { data: missions } = await supabase
      .from("missions")
      .select("title, summary, full_content, hook, location, npcs, encounters, rewards, session_number")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    // Build comprehensive data package for analysis
    const ctx = campaign.narrative_context || {};

    let analysisInput = `=== CAMPAÑA: "${campaign.name}" ===`;
    analysisInput += `\nDescripción: ${campaign.description || "Sin descripción"}`;
    analysisInput += `\nRegión: ${campaign.region || "Sin definir"}`;
    analysisInput += `\nTono: ${campaign.tone || "épico"}`;
    analysisInput += `\nNivel: ${campaign.level_range}`;
    analysisInput += `\nActo: ${campaign.current_act || 1}`;

    if (ctx.summary) analysisInput += `\n\nRESUMEN: ${ctx.summary}`;

    if (ctx.chapters?.length > 0) {
      analysisInput += `\n\nCAPÍTULOS:\n${ctx.chapters.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`;
    }
    if (ctx.important_events?.length > 0) {
      analysisInput += `\n\nEVENTOS IMPORTANTES:\n${ctx.important_events.map((e: string) => `- ${e}`).join("\n")}`;
    }
    if (ctx.known_antagonists?.length > 0) {
      analysisInput += `\n\nANTAGONISTAS:\n${ctx.known_antagonists.map((a: string) => `- ${a}`).join("\n")}`;
    }
    if (ctx.active_npcs?.length > 0) {
      analysisInput += `\n\nPNJs ACTIVOS:\n${ctx.active_npcs.map((n: string) => `- ${n}`).join("\n")}`;
    }
    if (ctx.party_decisions?.length > 0) {
      analysisInput += `\n\nDECISIONES DEL GRUPO:\n${ctx.party_decisions.map((d: string) => `- ${d}`).join("\n")}`;
    }
    if (ctx.open_conflicts?.length > 0) {
      analysisInput += `\n\nCONFLICTOS ABIERTOS:\n${ctx.open_conflicts.map((c: string) => `- ${c}`).join("\n")}`;
    }
    if (ctx.narrative_memory?.length > 0) {
      analysisInput += `\n\nMEMORIA NARRATIVA:\n${ctx.narrative_memory.map((m: string) => `- ${m}`).join("\n")}`;
    }
    if (ctx.plot_hooks_pending?.length > 0) {
      analysisInput += `\n\nGANCHOS PENDIENTES:\n${ctx.plot_hooks_pending.map((h: string) => `- ${h}`).join("\n")}`;
    }
    if (ctx.regions_explored?.length > 0) {
      analysisInput += `\n\nREGIONES EXPLORADAS: ${ctx.regions_explored.join(", ")}`;
    }
    if (ctx.loot_given?.length > 0) {
      analysisInput += `\n\nBOTÍN ENTREGADO:\n${ctx.loot_given.map((l: string) => `- ${l}`).join("\n")}`;
    }

    // Include full mission content for deep analysis
    if (missions && missions.length > 0) {
      analysisInput += `\n\n=== MISIONES COMPLETAS (${missions.length}) ===\n`;
      missions.forEach((m: any, i: number) => {
        analysisInput += `\n--- Misión ${i + 1}: ${m.title} (Sesión #${m.session_number || "?"}) ---`;
        if (m.summary) analysisInput += `\nResumen: ${m.summary}`;
        if (m.hook) analysisInput += `\nGancho: ${m.hook}`;
        if (m.location) analysisInput += `\nUbicación: ${m.location}`;
        if (m.full_content) {
          // Limit content to avoid token overflow but keep key info
          const content = m.full_content.length > 2000
            ? m.full_content.substring(0, 2000) + "..."
            : m.full_content;
          analysisInput += `\nContenido:\n${content}`;
        }
        analysisInput += "\n";
      });
    }

    // Call AI for deep analysis
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un analista narrativo experto para campañas de D&D 5e. Responde SOLO con JSON válido, sin markdown ni backticks.",
          },
          {
            role: "user",
            content: ANALYSIS_PROMPT + "\n\n" + analysisInput,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI analysis error:", aiResponse.status, errorText);
      throw new Error("Error del servicio de análisis");
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let analysis: any;
    try {
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse analysis:", cleaned);
      throw new Error("Error procesando el análisis");
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-campaign error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
