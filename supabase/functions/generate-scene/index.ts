import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto Dungeon Master de D&D 5e especializado en Forgotten Realms (Reinos Olvidados).

Genera una ESCENA: un evento cerrado, autónomo, que empieza y termina en el mismo momento de juego.
NO deja consecuencias estructurales obligatorias. Puede usarse para improvisación inmediata.

Una escena puede incluir:
- Combate evitable (siempre debe poder evitarse)
- Encuentro social
- Decisión moral inmediata
- Evento caótico
- Interrupción ambiental
- Micro misterio
- Ritual fallido
- Evento político breve

FORMATO DE RESPUESTA (markdown):

# 🎭 [Título evocador de la escena]

## 📍 Localización
[Descripción del lugar, adaptada a la región de Faerûn]

## 🔥 Detonante
[Qué desencadena la escena — algo que los jugadores ven, oyen o descubren]

## ⚡ Conflicto Central
[La tensión principal que deben resolver o enfrentar]

## 🎲 Posibles Resoluciones
1. **[Opción 1]:** [Descripción y consecuencia inmediata]
2. **[Opción 2]:** [Descripción y consecuencia inmediata]
3. **[Opción 3]:** [Descripción y consecuencia inmediata]

## 🌀 Posible Giro Inesperado
[Algo que el DM puede activar para elevar la tensión]

## 🗡️ Criaturas/PNJs Involucrados (si aplica)
[Breve ficha: nombre, rol, motivación, CA, PG y 1-2 acciones clave]

## 💥 Consecuencias Inmediatas
[Qué pasa justo después, independientemente de la resolución elegida]

## 📝 Notas para el DM
[Consejos de interpretación, ambiente, música sugerida, CDs relevantes]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nivelGrupo, localizacion, tipo, tono, customPrompt } = await req.json();

    let userPrompt = "Genera una escena cerrada, evocadora y útil para improvisación inmediata en D&D 5e.";
    const details: string[] = [];
    if (nivelGrupo) details.push(`Nivel del grupo: ${nivelGrupo}`);
    if (localizacion) details.push(`Localización: ${localizacion}`);
    if (tipo) details.push(`Tipo de escena: ${tipo}`);
    if (tono) details.push(`Tono: ${tono}`);
    if (customPrompt) details.push(`Instrucciones del DM: ${customPrompt}`);
    if (details.length) userPrompt += "\n\n" + details.join("\n");

    const aiResult = await generateWithFallback(SYSTEM_PROMPT, userPrompt, {
      contentType: "scene",
      outputFormat: "markdown",
      stream: true,
      model: "gemini-2.5-pro",
      region: localizacion,
      tone: tono,
      partyLevel: nivelGrupo,
    });

    if (!aiResult) {
      return new Response(
        JSON.stringify({ error: "Todos los servicios de IA están saturados. Espera unos segundos e inténtalo de nuevo." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(aiResult.response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider },
    });
  } catch (e) {
    console.error("generate-scene error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
