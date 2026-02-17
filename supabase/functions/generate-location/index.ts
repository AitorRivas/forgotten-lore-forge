import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWithFallback, parseAIJsonResponse } from "../_shared/ai-provider.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };

const SYSTEM_PROMPT = `Eres un diseñador de localizaciones vivas para D&D 5e en Forgotten Realms.

Genera localizaciones detalladas, jugables, con secretos, facciones, PNJs, rumores y conflictos activos.

Cada localización debe sentirse como un lugar real donde los jugadores pueden pasar múltiples sesiones.`;

const JSON_SCHEMA = `{
  "name": "string — nombre del lugar",
  "type": "string — tipo (ciudad, pueblo, ruinas, fortaleza, etc.)",
  "official_region": "string — región de Faerûn",
  "brief_history": "string — historia breve",
  "current_state": "string — estado actual",
  "social_climate": {
    "general_mood": "string",
    "tensions": ["string"],
    "power_dynamics": "string"
  },
  "economy": {
    "primary_industry": "string",
    "trade_goods": ["string"],
    "economic_health": "string",
    "black_market": "string"
  },
  "factions_present": [{
    "faction": "string", "influence": "string", "leader_local": "string",
    "agenda": "string", "public_face": "string", "real_activity": "string"
  }],
  "active_rumors": [{
    "rumor": "string", "truth_percentage": "number", "heard_at": "string", "narrative_potential": "string"
  }],
  "local_conflicts": [{
    "conflict": "string", "parties": ["string"], "stakes": "string", "current_status": "string"
  }],
  "key_locations": [{
    "name": "string", "type": "string", "description": "string",
    "owner": "string", "notable_feature": "string", "hook": "string"
  }],
  "random_events": [{
    "event": "string", "trigger": "string", "probability": "string", "consequences": "string"
  }],
  "resident_npcs": [{
    "name": "string", "role": "string", "personality": "string",
    "secret": "string", "useful_for": "string", "quest_hook": "string"
  }],
  "hidden_secrets": [{
    "secret": "string", "discovery_method": "string", "narrative_impact": "string", "danger_level": "string"
  }],
  "atmosphere": {
    "sights": "string", "sounds": "string", "smells": "string", "feeling": "string"
  },
  "dm_notes": "string",
  "summary": "string"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { region, tone, campaignContext, narrativeContext, partyLevel, locationType, specificRequest } = await req.json();

    let userPrompt = `Genera una localización viva y jugable.`;
    if (locationType) userPrompt += `\nTIPO DE LOCALIZACIÓN: ${locationType}`;
    if (specificRequest) userPrompt += `\nPETICIÓN ESPECÍFICA: ${specificRequest}`;
    if (narrativeContext) userPrompt += `\nMEMORIA NARRATIVA:\n${JSON.stringify(narrativeContext)}`;

    const response = await generateWithFallback(SYSTEM_PROMPT, userPrompt, {
      contentType: "location",
      outputFormat: "json",
      jsonSchema: JSON_SCHEMA,
      region: region || "Costa de la Espada",
      tone: tone || "épico",
      partyLevel: partyLevel || "5-10",
      campaignContext: campaignContext ? JSON.stringify(campaignContext) : undefined,
      temperature: 0.85,
    });

    if (!response) {
      return new Response(JSON.stringify({ error: "Los servicios de IA están saturados. Espera unos segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const location = parseAIJsonResponse(content, { raw: content, parse_error: true });

    return new Response(JSON.stringify({ location }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("generate-location error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
