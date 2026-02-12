import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version" };
async function callAIWithFallback(messages: any[], options: { model?: string } = {}) {
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY"); const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const geminiModel = options.model || "gemini-2.5-pro"; const body = { model: geminiModel, messages };
  if (GEMINI_API_KEY) { try { const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (resp.ok) return resp; if (resp.status === 429) console.log("Gemini rate limited..."); else console.error("Gemini error:", resp.status); } catch (e) { console.error("Gemini fetch error:", e); } }
  if (LOVABLE_API_KEY) { try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: `google/${geminiModel}` }) }); if (resp.ok) return resp; if (resp.status === 429 || resp.status === 402) console.log("Lovable AI unavailable, trying ChatGPT..."); } catch (e) { console.error("Lovable AI error:", e); } }
  if (LOVABLE_API_KEY) { const m = geminiModel.includes("flash") ? "openai/gpt-5-mini" : "openai/gpt-5"; try { const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...body, model: m }) }); if (resp.ok) return resp; } catch (e) { console.error("ChatGPT error:", e); } }
  return null;
}
const SYSTEM_PROMPT = `Eres un editor narrativo experto para campañas de D&D 5e en Forgotten Realms. Compara texto ORIGINAL con VERSIÓN EDITADA por humano. NUNCA sobrescribas el texto humano. Responde JSON: {"changes_detected":[{"type":"addition|removal|modification","importance":"critical|major|minor","description":"cambio","narrative_impact":"impacto"}],"coherence_issues":[{"severity":"error|warning|info","issue":"problema","suggestion":"sugerencia"}],"narrative_updates":{"new_npcs":[],"removed_npcs":[],"new_events":[],"changed_relationships":[],"new_plot_hooks":[],"resolved_hooks":[],"tone_shift":""},"improvement_suggestions":[{"area":"área","suggestion":"sugerencia","reason":"razón"}],"summary":"resumen"}`;
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { original_text, edited_text, content_id, campaign_id } = await req.json();
    if (!original_text || !edited_text) return new Response(JSON.stringify({ error: "original_text and edited_text are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (original_text.length > 50000 || edited_text.length > 50000) return new Response(JSON.stringify({ error: "Text too long" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    let analysis: any = null;
    const aiResponse = await callAIWithFallback([{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `ORIGINAL:\n\n${original_text}\n\n---\n\nEDITADO:\n\n${edited_text}` }]);
    if (aiResponse) { const aiData = await aiResponse.json(); const raw = aiData.choices?.[0]?.message?.content || ""; const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim(); try { analysis = JSON.parse(cleaned); } catch { analysis = { summary: "No se pudo analizar.", changes_detected: [], coherence_issues: [], narrative_updates: {}, improvement_suggestions: [] }; } }
    if (content_id) await supabase.from("generated_content").update({ editable_text: edited_text, updated_at: new Date().toISOString() }).eq("id", content_id).eq("user_id", user.id);
    if (campaign_id && analysis?.narrative_updates) {
      const nu = analysis.narrative_updates;
      const { data: campaign } = await supabase.from("campaigns").select("narrative_context").eq("id", campaign_id).eq("user_id", user.id).single();
      if (campaign) {
        const ctx: any = campaign.narrative_context || {};
        if (nu.new_npcs?.length > 0) ctx.active_npcs = [...(ctx.active_npcs || []), ...nu.new_npcs].slice(-20);
        if (nu.removed_npcs?.length > 0) ctx.active_npcs = (ctx.active_npcs || []).filter((n: string) => !nu.removed_npcs.some((r: string) => n.toLowerCase().includes(r.toLowerCase())));
        if (nu.new_events?.length > 0) ctx.important_events = [...(ctx.important_events || []), ...nu.new_events].slice(-15);
        if (nu.new_plot_hooks?.length > 0) ctx.plot_hooks_pending = [...(ctx.plot_hooks_pending || []), ...nu.new_plot_hooks].slice(-10);
        if (nu.resolved_hooks?.length > 0) ctx.plot_hooks_pending = (ctx.plot_hooks_pending || []).filter((h: string) => !nu.resolved_hooks.some((r: string) => h.toLowerCase().includes(r.toLowerCase())));
        if (nu.changed_relationships?.length > 0) ctx.narrative_memory = [...(ctx.narrative_memory || []), `Edición: ${nu.changed_relationships.join("; ")}`].slice(-15);
        await supabase.from("campaigns").update({ narrative_context: ctx }).eq("id", campaign_id).eq("user_id", user.id);
      }
    }
    return new Response(JSON.stringify({ success: true, analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) { console.error("human-edit-review error:", e); return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});