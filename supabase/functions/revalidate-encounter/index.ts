import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIWithFallback as callAI } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { encounterText, partyMembers, avgLevel, partySize, difficulty, difficultyLabel } = await req.json();

    if (!encounterText) {
      return new Response(JSON.stringify({ error: "No encounter text provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const partyAnalysis = (partyMembers || []).map((m: any) => `- ${m.className} nivel ${m.level}`).join("\n");

    const systemPrompt = `Eres un auditor de equilibrio de encuentros para D&D 5e. Tu trabajo es:

1. Analizar el encuentro editado por el DM.
2. Verificar que los CR de las criaturas sean correctos según los manuales oficiales.
3. Recalcular el XP total (con multiplicadores por número de enemigos).
4. Comparar con los umbrales de dificultad del DMG para el grupo dado.
5. Identificar inconsistencias (CR incorrecto, XP mal calculado, estadísticas erróneas).
6. Sugerir ajustes concretos si la dificultad real no coincide con la deseada.

FORMATO DE RESPUESTA (Markdown):

# ⚖️ Revalidación de Equilibrio

## 📊 Resultado del Análisis
- **Dificultad deseada:** [nivel]
- **Dificultad real calculada:** [nivel]
- **Estado:** ✅ Equilibrado / ⚠️ Desajustado / ❌ Desequilibrado

## 🔍 Verificación de Criaturas
Para cada criatura encontrada:
- **[Nombre]:** CR [X] → [✅ Correcto / ❌ Incorrecto, debería ser CR Y]
- **XP:** [cantidad] → [✅ / ❌]

## 📐 Cálculo de XP
- **XP base total:** [suma]
- **Multiplicador:** ×[valor] (por [X] criaturas)
- **XP ajustado:** [total]
- **XP por jugador:** [total ÷ jugadores]

## 📋 Umbrales del Grupo
| Umbral | Por Jugador | Total Grupo |
|--------|-------------|-------------|
| Fácil | [X] | [X × jugadores] |
| Moderado | [X] | [X × jugadores] |
| Difícil | [X] | [X × jugadores] |
| Letal | [X] | [X × jugadores] |

## ⚠️ Problemas Detectados
[Lista de problemas o "No se detectaron problemas"]

## 🔧 Ajustes Sugeridos
[Sugerencias concretas para corregir el equilibrio, o "El encuentro está correctamente equilibrado"]

## 📝 Texto Corregido (si aplica)
[Si hay correcciones necesarias en stats/CR/XP, incluir las secciones corregidas aquí. Si todo está correcto, indicar "No se requieren correcciones."]`;

    const userPrompt = `GRUPO (${partySize} jugadores, nivel promedio ${avgLevel}):
${partyAnalysis}

DIFICULTAD DESEADA: ${difficultyLabel} (${difficulty}/5)

TEXTO DEL ENCUENTRO EDITADO POR EL DM:
---
${encounterText}
---

Analiza el equilibrio, verifica CRs y XP, y sugiere ajustes si es necesario.`;

    const response = await callAI(
      [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      { temperature: 0.4 }
    );

    if (!response) {
      return new Response(JSON.stringify({ error: "Los servicios de IA están saturados. Intenta en unos segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ validation_markdown: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("revalidate-encounter error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error revalidando encuentro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
