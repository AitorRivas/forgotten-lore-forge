import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un motor profesional de generación narrativa para Dungeon Masters de Dungeons & Dragons 5e ambientado exclusivamente en Forgotten Realms.

OBJETIVO: Generar contenido jugable, coherente, diverso y estructurado para campañas reales.

REGLAS CRÍTICAS:
- Usa únicamente lore oficial de Forgotten Realms.
- Mantén coherencia TOTAL con el contexto de campaña proporcionado.
- Haz referencia a eventos previos, NPCs activos, antagonistas y conflictos abiertos.
- Las nuevas misiones deben avanzar o complicar los conflictos existentes.
- Respeta las decisiones del grupo y sus consecuencias.
- Introduce nuevos elementos que complementen la narrativa sin contradecirla.
- Cada misión DEBE incluir al menos dos de: intriga social/política, investigación, combate significativo, puzzle/desafío lógico, dilema moral, giro narrativo inesperado.

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

### 📝 Notas para el DM
[Consejos de interpretación, música sugerida, variaciones posibles]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, userId, customPrompt } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
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

    // Fetch previous missions
    const { data: missions } = await supabase
      .from("missions")
      .select("title, summary, full_content")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(8);

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

    // Previous missions
    if (missions && missions.length > 0) {
      campaignContext += `\n\nMISIONES ANTERIORES (mantén continuidad, no repitas estructuras):\n`;
      missions.forEach((m: any, i: number) => {
        campaignContext += `${i + 1}. ${m.title}${m.summary ? ` — ${m.summary}` : ""}\n`;
      });
    }

    // User-level variety context
    if (userContext) {
      const recentStyles = (userContext.narrative_styles || []).slice(-3);
      if (recentStyles.length > 0) {
        campaignContext += `\n\nESTILOS NARRATIVOS RECIENTES DEL DM (varía):\n${recentStyles.join(", ")}`;
      }
    }

    campaignContext += `\n=== FIN CONTEXTO ===`;

    let userPrompt = `Genera la siguiente misión para esta campaña.`;
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES ADICIONALES DEL DM:\n${customPrompt}`;
    }
    userPrompt += campaignContext;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Demasiadas solicitudes. Espera un momento." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
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
