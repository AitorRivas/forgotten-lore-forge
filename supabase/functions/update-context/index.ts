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
    const { campaignId, userId, missionContent, region, narrativeStyle, mainTheme, mainVillain } =
      await req.json();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Database not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Update user context with new mission data
    const { data: userContext } = await supabase
      .from("user_context")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (userContext) {
      const regionsUsed = (userContext.regions_used || []).slice(-9); // Keep last 10
      if (region && !regionsUsed.includes(region)) {
        regionsUsed.push(region);
      }

      const stylesUsed = (userContext.narrative_styles || []).slice(-7); // Keep last 8
      if (narrativeStyle && !stylesUsed.includes(narrativeStyle)) {
        stylesUsed.push(narrativeStyle);
      }

      const themesUsed = (userContext.recent_themes || []).slice(-9); // Keep last 10
      if (mainTheme && !themesUsed.includes(mainTheme)) {
        themesUsed.push(mainTheme);
      }

      await supabase
        .from("user_context")
        .update({
          regions_used: regionsUsed,
          narrative_styles: stylesUsed,
          recent_themes: themesUsed,
          last_updated: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }

    // Update campaign metadata
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("campaign_metadata")
      .eq("id", campaignId)
      .single();

    if (campaign?.campaign_metadata) {
      const metadata = campaign.campaign_metadata;
      const regions = (metadata.regions || []).slice(-4); // Keep last 5
      if (region && !regions.includes(region)) {
        regions.push(region);
      }

      const themes = (metadata.themes || []).slice(-4); // Keep last 5
      if (mainTheme && !themes.includes(mainTheme)) {
        themes.push(mainTheme);
      }

      const villains = (metadata.villain_archetypes || []).slice(-3); // Keep last 4
      if (mainVillain && !villains.includes(mainVillain)) {
        villains.push(mainVillain);
      }

      const sessionCount = (metadata.session_count || 0) + 1;

      await supabase
        .from("campaigns")
        .update({
          campaign_metadata: {
            regions,
            themes,
            villain_archetypes: villains,
            session_count: sessionCount,
          },
        })
        .eq("id", campaignId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("update-context error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
