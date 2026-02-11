import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, userId, missionTitle, missionContent } = await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Database not configured");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to extract structured context from mission content
    const extractionPrompt = `Analiza esta misión de D&D y extrae información estructurada para actualizar el contexto de la campaña.

MISIÓN:
${missionContent}

Responde SOLAMENTE con JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "location": "nombre del lugar principal",
  "location_type": "tipo: ciudad|mazmorra|bosque|mar|montaña|desierto|planar|ruinas|fortaleza",
  "narrative_style": "tipo: intriga|investigación|combate|exploración|social|puzzle|horror|diplomacia",
  "mission_type": "tipo: rescate|escolta|caza|investigación|defensa|exploración|diplomacia|infiltración|supervivencia|heist|juicio|espionaje",
  "antagonist_type": "tipo: político|culto|criatura_ancestral|criminal|hechicero|extraplanar|naturaleza|constructo|traidor|amenaza_colectiva|ninguno",
  "dominant_theme": "tema principal: venganza|redención|poder|sacrificio|traición|descubrimiento|supervivencia|justicia|ambición|libertad",
  "new_npcs": ["nombre - descripción breve de cada NPC nuevo"],
  "new_antagonists": ["nombre - descripción de cada antagonista"],
  "new_events": ["evento importante que ocurrió o puede ocurrir"],
  "new_conflicts": ["conflicto nuevo o ampliado"],
  "plot_hooks": ["gancho narrativo para futuras sesiones"],
  "narrative_memory": "resumen de 1-2 oraciones de lo más importante de esta misión para recordar",
  "chapter_summary": "resumen de 1 oración del capítulo/misión"
}`;

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un asistente que extrae datos estructurados de textos narrativos de D&D. Responde SOLO con JSON válido." },
          { role: "user", content: extractionPrompt },
        ],
      }),
    });

    let extracted: any = {};
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "{}";
      // Clean markdown code blocks if present
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        extracted = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse AI extraction:", cleaned);
      }
    }

    // Fetch current campaign context
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("narrative_context")
      .eq("id", campaignId)
      .single();

    const ctx = campaign?.narrative_context || {
      summary: "",
      chapters: [],
      important_events: [],
      known_antagonists: [],
      active_npcs: [],
      party_decisions: [],
      open_conflicts: [],
      narrative_memory: [],
      regions_explored: [],
      loot_given: [],
      plot_hooks_pending: [],
    };

    // Merge extracted data into campaign context
    if (extracted.chapter_summary) {
      ctx.chapters = [...(ctx.chapters || []), extracted.chapter_summary].slice(-20);
    }

    if (extracted.location && !ctx.regions_explored?.includes(extracted.location)) {
      ctx.regions_explored = [...(ctx.regions_explored || []), extracted.location].slice(-15);
    }

    if (extracted.new_npcs?.length > 0) {
      ctx.active_npcs = [...(ctx.active_npcs || []), ...extracted.new_npcs].slice(-20);
    }

    if (extracted.new_antagonists?.length > 0) {
      ctx.known_antagonists = [...(ctx.known_antagonists || []), ...extracted.new_antagonists].slice(-10);
    }

    if (extracted.new_events?.length > 0) {
      ctx.important_events = [...(ctx.important_events || []), ...extracted.new_events].slice(-15);
    }

    if (extracted.new_conflicts?.length > 0) {
      ctx.open_conflicts = [...(ctx.open_conflicts || []), ...extracted.new_conflicts].slice(-10);
    }

    if (extracted.plot_hooks?.length > 0) {
      ctx.plot_hooks_pending = [...(ctx.plot_hooks_pending || []), ...extracted.plot_hooks].slice(-10);
    }

    if (extracted.narrative_memory) {
      ctx.narrative_memory = [...(ctx.narrative_memory || []), extracted.narrative_memory].slice(-15);
    }

    // Update campaign
    await supabase
      .from("campaigns")
      .update({ narrative_context: ctx })
      .eq("id", campaignId);

    // Update user-level context
    const { data: userContext } = await supabase
      .from("user_context")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (userContext) {
      const regionsUsed = [...(userContext.regions_used as string[] || [])];
      if (extracted.location && !regionsUsed.includes(extracted.location)) {
        regionsUsed.push(extracted.location);
      }

      const stylesUsed = [...(userContext.narrative_styles as string[] || [])];
      if (extracted.narrative_style && !stylesUsed.includes(extracted.narrative_style)) {
        stylesUsed.push(extracted.narrative_style);
      }

      // Track recent themes for diversity
      const recentThemes = [...(userContext.recent_themes as string[] || [])];
      const themeEntries = [
        extracted.mission_type && `misión:${extracted.mission_type}`,
        extracted.antagonist_type && extracted.antagonist_type !== "ninguno" && `antagonista:${extracted.antagonist_type}`,
        extracted.dominant_theme && `tema:${extracted.dominant_theme}`,
        extracted.location_type && `ubicación:${extracted.location_type}`,
      ].filter(Boolean) as string[];
      recentThemes.push(...themeEntries);

      await supabase
        .from("user_context")
        .update({
          regions_used: regionsUsed.slice(-10),
          narrative_styles: stylesUsed.slice(-8),
          recent_themes: recentThemes.slice(-20),
          npcs_created: [...(userContext.npcs_created as string[] || []), ...(extracted.new_npcs || [])].slice(-20),
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } else {
      await supabase.from("user_context").insert({
        user_id: userId,
        regions_used: extracted.location ? [extracted.location] : [],
        narrative_styles: extracted.narrative_style ? [extracted.narrative_style] : [],
        recent_themes: [
          extracted.mission_type && `misión:${extracted.mission_type}`,
          extracted.antagonist_type && `antagonista:${extracted.antagonist_type}`,
          extracted.dominant_theme && `tema:${extracted.dominant_theme}`,
        ].filter(Boolean),
        npcs_created: extracted.new_npcs || [],
      });
    }

    return new Response(JSON.stringify({ success: true, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-context error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
