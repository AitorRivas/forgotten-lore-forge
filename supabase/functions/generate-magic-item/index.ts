import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWithFallback } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Eres un experto diseñador de objetos mágicos para Dungeons & Dragons 5e ambientados en Forgotten Realms (Reinos Olvidados).

Genera objetos mágicos completos, equilibrados, narrativamente ricos y mecánicamente correctos según las reglas de D&D 5e.

REGLAS DE BALANCE:
- Común: efectos menores, utilidad o estéticos. Sin bonificadores de combate significativos.
- Poco común: +1 a ataque/daño/CA o habilidades menores. Requiere sintonización si es potente.
- Raro: +2 o habilidades moderadas. Puede tener cargas. Casi siempre requiere sintonización.
- Muy raro: +3 o habilidades poderosas. Cargas limitadas. Siempre requiere sintonización.
- Legendario: efectos transformadores. Limitaciones significativas. Siempre requiere sintonización.
- Artefacto: sigue la estructura oficial del DMG (propiedades beneficiosas/perjudiciales menores y mayores, condición de destrucción).

Para ARTEFACTOS, incluye OBLIGATORIAMENTE:
- Poderes beneficiosos menores (1d4 de la tabla del DMG)
- Poderes beneficiosos mayores (1d4 de la tabla del DMG)
- Propiedades perjudiciales menores (1d4 de la tabla del DMG)
- Propiedades perjudiciales mayores (al menos 1)
- Condición de destrucción única y narrativa
- Impacto en el mundo / consecuencias de su uso

FORMATO DE RESPUESTA (markdown):

## ✨ [Nombre del Objeto]

### 📋 Datos Básicos
- **Tipo:** [arma/armadura/escudo/objeto maravilloso/anillo/varita/bastón/pergamino/poción/herramienta/instrumento/reliquia/artefacto]
- **Subtipo:** [espada larga/cota de mallas/etc., si aplica]
- **Rareza:** [común/poco común/raro/muy raro/legendario]
- **Artefacto:** [Sí (menor/medio/mayor) / No]
- **Requiere sintonización:** [Sí/No] [restricción si aplica, ej: (por un paladín)]
- **Nivel recomendado:** [rango de niveles]

### 📖 Descripción
[Descripción física evocadora del objeto: apariencia, material, marcas, sensaciones al tocarlo]

### ⚔️ Propiedades Mecánicas
- **Bonificadores:** [+X a ataque/daño/CA/salvaciones/habilidades]
- **Propiedades mágicas:** [efectos permanentes mientras se porta/sintoniza]

### 🌟 Habilidades Activas
[Lista de habilidades que requieren acción/acción bonus/reacción para usar]
- **[Nombre].** [Descripción mecánica con CD, daño, duración, etc.]

### 🛡️ Habilidades Pasivas
[Efectos que están siempre activos mientras se porta/sintoniza]

### 🔋 Cargas
- **Cargas:** [X] cargas
- **Recarga:** [cómo se recargan: al amanecer, bajo la luna llena, con sangre, etc.]
- **Gasto:** [qué cuesta cada habilidad]

### ⚠️ Efectos Secundarios
[Costes, riesgos o consecuencias de usar el objeto]

### 💀 Maldiciones (si aplica)
[Maldiciones ocultas que se revelan al sintonizar o usar el objeto]

### 📈 Crecimiento Escalable (si aplica)
[Cómo evoluciona el objeto: condiciones de desbloqueo, nuevos poderes por nivel/logros]

### 🏛️ Historia y Lore
[2-3 párrafos: quién lo creó, cuándo, por qué, eventos históricos asociados en Forgotten Realms]

### 🌍 Origen
- **Localización:** [región/ciudad/lugar de Faerûn]
- **Creador original:** [nombre y contexto]
- **Era:** [cuándo fue creado]

### 🗣️ Rumores
1. [Rumor verdadero pero incompleto]
2. [Rumor falso pero convincente]
3. [Rumor que mezcla verdad y mentira]

### 🪝 Ganchos Narrativos
1. [Gancho de misión que el objeto puede detonar]
2. [Conflicto que genera poseerlo]
3. [Conexión con facciones/PNJ]

### 💡 Notas para el DM
[Consejos de uso: cuándo introducirlo, cómo equilibrarlo, impacto en la mesa, tácticas si es un arma enemiga]

### 🔥 Condición de Destrucción (solo artefactos)
[Cómo puede destruirse este artefacto — debe ser épico y narrativo]`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt } = await req.json();

    let userPrompt = "Genera un objeto mágico único, equilibrado y narrativamente rico para D&D 5e en Forgotten Realms.";
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;
    }

    const aiResult = await generateWithFallback(SYSTEM_PROMPT, userPrompt, {
      contentType: "magic-item",
      outputFormat: "markdown",
      stream: true,
      model: "gemini-2.5-pro",
    });

    if (!aiResult) {
      return new Response(
        JSON.stringify({ error: "Todos los servicios de IA están saturados. Inténtalo en unos minutos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(aiResult.response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider },
    });
  } catch (e) {
    console.error("generate-magic-item error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
