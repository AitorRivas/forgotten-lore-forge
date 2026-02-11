import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un editor narrativo experto para campañas de D&D 5e en Forgotten Realms.

Tu trabajo es comparar un texto ORIGINAL generado por IA con la VERSIÓN EDITADA por un humano y producir un análisis detallado.

REGLAS CRÍTICAS:
1. NUNCA sobrescribas el texto humano — el texto editado por el humano es SAGRADO
2. Solo SUGIERE mejoras como notas separadas
3. Detecta cambios narrativos importantes que afecten la continuidad
4. Valida coherencia con el lore de Forgotten Realms

FORMATO DE RESPUESTA (JSON válido, sin markdown, sin backticks):

{
  "changes_detected": [
    {
      "type": "addition|removal|modification|rewrite",
      "importance": "critical|major|minor|cosmetic",
      "description": "qué cambió",
      "narrative_impact": "cómo afecta a la historia/campaña"
    }
  ],
  "coherence_issues": [
    {
      "severity": "error|warning|info",
      "issue": "qué problema de coherencia existe",
      "suggestion": "cómo podría resolverse (sin cambiar el texto humano)"
    }
  ],
  "narrative_updates": {
    "new_npcs": ["NPC añadido por el humano"],
    "removed_npcs": ["NPC eliminado por el humano"],
    "new_events": ["evento nuevo"],
    "changed_relationships": ["relación modificada"],
    "new_plot_hooks": ["gancho narrativo nuevo"],
    "resolved_hooks": ["gancho resuelto o eliminado"],
    "tone_shift": "si el tono cambió, descripción breve"
  },
  "improvement_suggestions": [
    {
      "area": "dónde aplicaría la mejora (no en el texto humano, sino como nota separada)",
      "suggestion": "sugerencia concreta",
      "reason": "por qué mejoraría"
    }
  ],
  "summary": "resumen de 1-2 oraciones de los cambios más importantes del humano"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { original_text, edited_text, content_id, campaign_id } = await req.json();

    if (!original_text || !edited_text) {
      return new Response(JSON.stringify({ error: "original_text and edited_text are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input lengths
    if (original_text.length > 50000 || edited_text.length > 50000) {
      return new Response(JSON.stringify({ error: "Text too long (max 50000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // AI analysis of the diff
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `TEXTO ORIGINAL (generado por IA):\n\n${original_text}\n\n---\n\nTEXTO EDITADO (por el humano):\n\n${edited_text}`,
          },
        ],
      }),
    });

    let analysis: any = null;
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const raw = aiData.choices?.[0]?.message?.content || "";
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      try {
        analysis = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse review analysis:", cleaned);
        analysis = { summary: "No se pudo analizar automáticamente.", changes_detected: [], coherence_issues: [], narrative_updates: {}, improvement_suggestions: [] };
      }
    }

    // Save the edited text (never overwrite with AI — human text is sacred)
    if (content_id) {
      await supabase
        .from("generated_content")
        .update({ editable_text: edited_text, updated_at: new Date().toISOString() })
        .eq("id", content_id)
        .eq("user_id", user.id);
    }

    // Update campaign narrative memory if there are critical changes
    if (campaign_id && analysis?.narrative_updates) {
      const nu = analysis.narrative_updates;
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("narrative_context")
        .eq("id", campaign_id)
        .eq("user_id", user.id)
        .single();

      if (campaign) {
        const ctx: any = campaign.narrative_context || {};

        if (nu.new_npcs?.length > 0) {
          ctx.active_npcs = [...(ctx.active_npcs || []), ...nu.new_npcs].slice(-20);
        }
        if (nu.removed_npcs?.length > 0) {
          ctx.active_npcs = (ctx.active_npcs || []).filter((n: string) =>
            !nu.removed_npcs.some((r: string) => n.toLowerCase().includes(r.toLowerCase()))
          );
        }
        if (nu.new_events?.length > 0) {
          ctx.important_events = [...(ctx.important_events || []), ...nu.new_events].slice(-15);
        }
        if (nu.new_plot_hooks?.length > 0) {
          ctx.plot_hooks_pending = [...(ctx.plot_hooks_pending || []), ...nu.new_plot_hooks].slice(-10);
        }
        if (nu.resolved_hooks?.length > 0) {
          ctx.plot_hooks_pending = (ctx.plot_hooks_pending || []).filter((h: string) =>
            !nu.resolved_hooks.some((r: string) => h.toLowerCase().includes(r.toLowerCase()))
          );
        }
        if (nu.changed_relationships?.length > 0) {
          ctx.narrative_memory = [...(ctx.narrative_memory || []), `Edición humana: ${nu.changed_relationships.join("; ")}`].slice(-15);
        }

        await supabase
          .from("campaigns")
          .update({ narrative_context: ctx })
          .eq("id", campaign_id)
          .eq("user_id", user.id);
      }
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("human-edit-review error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
