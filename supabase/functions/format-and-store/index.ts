import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
import { callAIWithFallback } from "../_shared/ai-provider.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };
const SYSTEM_PROMPT = `Eres un formateador de contenido para base de datos de campañas D&D 5e. Dado contenido generado, extrae y devuelve SOLO JSON válido: {"title":"título","summary":"resumen","tags":["tags"],"relationships":[{"type":"npc|location|faction|item|event","name":"nombre","role":"rol"}],"reusable_elements":[{"type":"npc|location|encounter|item|hook|faction","name":"nombre","description":"desc"}],"narrative_hooks":[{"hook":"desc","priority":"alta|media|baja","connects_to":"qué conecta"}]}`;
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { content, content_type, campaign_id } = await req.json();
    if (!content || !content_type) return new Response(JSON.stringify({ error: "content and content_type are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    let structured = { title: content_type, summary: "", tags: [] as string[], relationships: [], reusable_elements: [], narrative_hooks: [] };
    const aiResult = await callAIWithFallback([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `Tipo: ${content_type}\n\nContenido:\n${content}` }], { model: "gemini-2.5-flash" });
    if (aiResult) { const aiData = await aiResult.response.json(); const raw = aiData.choices?.[0]?.message?.content || ""; try { const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim(); structured = { ...structured, ...JSON.parse(cleaned) }; } catch { console.error("Failed to parse AI output"); } }
    const { data, error } = await supabase.from("generated_content").insert({ user_id: user.id, campaign_id: campaign_id || null, content_type, title: structured.title, summary: structured.summary, editable_text: content, tags: structured.tags, relationships: structured.relationships, reusable_elements: structured.reusable_elements, narrative_hooks: structured.narrative_hooks }).select().single();
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) { console.error("format-and-store error:", e); return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});