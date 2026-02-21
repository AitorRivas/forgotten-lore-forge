import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateWithFallback, AI_ERRORS } from "../_shared/ai-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NPC_PROMPTS: Record<string, string> = {
  menor: `Eres un creador de PNJ menores para D&D 5e en Forgotten Realms.
Genera un PNJ BREVE y funcional. Solo lo esencial para improvisación rápida.

FORMATO (markdown):
## 🧍 [Nombre]

### 📋 Datos Básicos
- **Raza:** [raza]
- **Clase/Tipo:** [tipo simple, ej: Plebeyo, Guardia, Comerciante]
- **Rol:** [función narrativa en 1 línea]
- **Alineamiento:** [alineamiento]

### 👁️ Apariencia
[2-3 frases: rasgo distintivo principal, vestimenta, primera impresión]

### 🧠 Personalidad
- **Rasgo visible:** [1 defecto o manía inmediatamente notable]
- **Frase típica:** ["frase entre comillas"]
- **Lenguaje corporal:** [1 gesto o postura característica]

### 🎯 Motivación
[1-2 frases: qué quiere y por qué]

### 🤫 Secreto Oculto
[1 secreto que los jugadores pueden descubrir y que sea jugable]

### 💡 Notas para el DM
[Cómo interpretarlo en mesa: voz sugerida, actitud, reacción ante los aventureros]`,

  relevante: `Eres un experto creador de PNJs para D&D 5e en Forgotten Realms.
Genera PNJs completos con ficha de combate y profundidad narrativa.

FORMATO (markdown):

## 🧍 [Nombre]

### 📋 Datos Básicos
- **Raza:** [raza]
- **Género:** [género]
- **Edad:** [edad]
- **Clase/Tipo:** [clase D&D 5e]
- **Rol:** [función]
- **Alineamiento:** [real] (aparente: [aparente])
- **CR:** [valor]

### ⚔️ Ficha de Combate
| Atributo | Valor | Mod |
|----------|-------|-----|
| FUE | [val] | [mod] |
| DES | [val] | [mod] |
| CON | [val] | [mod] |
| INT | [val] | [mod] |
| SAB | [val] | [mod] |
| CAR | [val] | [mod] |

- **PG:** [PG] ([dados])
- **CA:** [CA] ([tipo armadura])
- **Velocidad:** [vel] pies
- **Salvaciones:** [salvaciones]
- **Habilidades:** [con bonus]
- **Sentidos:** [sentidos]
- **Idiomas:** [idiomas]
- **Resistencias/Inmunidades:** [si aplica]

### 🗡️ Acciones
[Ataques con tirada y daño completos]

### 🔄 Reacciones
[Si tiene]

### 🌟 Rasgos Especiales
[Rasgos de clase/raciales con mecánica]

### 📜 Hechizos (si aplica)
[Con CD, bonus y lista por nivel]

### 🎒 Equipo
[Objetos relevantes]

### 👁️ Apariencia
[Descripción física, rasgo distintivo, vestimenta]

### 🎭 Cómo Interpretarlo en Mesa
- **Voz sugerida:** [tono, acento, ritmo]
- **Lenguaje corporal:** [gestos, postura, mirada]
- **Defecto visible:** [algo que los jugadores notan de inmediato]
- **Frase típica:** ["frase entre comillas"]
- **Bajo presión:** [cómo cambia su comportamiento]

### 🧠 Personalidad
- **En superficie:** [cómo se presenta]
- **En privado:** [cómo es realmente]

### 📖 Historia
[2-3 párrafos: origen, eventos, posición actual]

### 🎯 Motivaciones Ocultas
[Verdaderas razones de sus acciones]

### 🤫 Secretos
1. [Secreto menor — fácil de descubrir]
2. [Secreto mayor — requiere investigación]
3. [Secreto devastador]

### 🏛️ Afiliaciones
[Facciones]

### 🪝 Ganchos de Misión
[3 misiones que puede detonar]

### 💡 Notas para el DM
[Tácticas de combate preferidas, consejos de interpretación]`,

  "antagonista principal": `Eres un experto creador de antagonistas principales para D&D 5e en Forgotten Realms.
Genera un villano con ficha de combate COMPLETA, tácticas avanzadas y profundidad narrativa extrema.

FORMATO (markdown):

## 🧍 [Nombre]

### 📋 Datos Básicos
- **Raza:** [raza]
- **Género:** [género]
- **Edad:** [edad]
- **Clase/Tipo:** [clase D&D 5e, puede ser multiclase]
- **Rol:** Antagonista Principal
- **Alineamiento:** [real] (aparente: [aparente])
- **CR:** [valor — debe ser desafiante para el nivel indicado]

### ⚔️ Ficha de Combate
| Atributo | Valor | Mod |
|----------|-------|-----|
| FUE | [val] | [mod] |
| DES | [val] | [mod] |
| CON | [val] | [mod] |
| INT | [val] | [mod] |
| SAB | [val] | [mod] |
| CAR | [val] | [mod] |

- **PG:** [PG] ([dados]) — debe ser alto para un antagonista
- **CA:** [CA] ([tipo])
- **Velocidad:** [vel] pies
- **Salvaciones:** [salvaciones con competencia]
- **Habilidades:** [con bonus]
- **Sentidos:** [sentidos]
- **Idiomas:** [idiomas]
- **Resistencias/Inmunidades:** [obligatorio para antagonistas]

### 🗡️ Acciones
[Ataques detallados, multiataques si aplica]

### 🔄 Reacciones
[Al menos 1 reacción defensiva]

### ⭐ Acciones Legendarias (3/turno)
[Al menos 3 acciones legendarias con coste]

### 🏰 Acciones de Guarida (si aplica)
[Acciones especiales en su guarida, CD e iniciativa 20]

### 🌟 Rasgos Especiales
[Rasgos únicos de alto nivel]

### 📜 Hechizos (si aplica)
[Lista completa por nivel con CD y bonus]

### 🎒 Equipo
[Objetos mágicos que porta]

### 👁️ Apariencia
[Descripción imponente y memorable]

### 🎭 Cómo Interpretarlo en Mesa
- **Voz sugerida:** [tono, acento, ritmo — debe ser memorable]
- **Lenguaje corporal:** [postura dominante, gestos de poder]
- **Defecto visible:** [debilidad perceptible]
- **Frase típica:** ["frase intimidante entre comillas"]
- **Frases de combate:** ["frase al iniciar combate", "frase al ser herido", "frase al derrotar enemigo"]
- **Bajo presión:** [reacción cuando pierde ventaja]

### 🧠 Personalidad
- **En superficie:** [máscara pública]
- **En privado:** [verdadero yo]

### 📖 Historia
[3-4 párrafos: origen, caída o ascenso, plan actual]

### 🎯 Plan Maestro
[Qué busca lograr y cómo, con fases]

### 🗡️ Tácticas de Combate Avanzadas
- **Apertura preferida:** [primer movimiento táctico]
- **Prioridad de objetivos:** [a quién ataca primero y por qué]
- **Uso de minions:** [cómo utiliza a sus subordinados]
- **Plan de retirada:** [cuándo y cómo escapa]
- **Trampas preparadas:** [si tiene preparativos en su territorio]

### 🤫 Secretos
1. [Secreto menor]
2. [Secreto mayor]
3. [Secreto devastador que puede cambiar la campaña]

### 🏛️ Afiliaciones y Recursos
[Facciones, ejércitos, espías, aliados]

### 💰 Recursos
[Dinero, contactos, información, objetos, ejércitos]

### 📈 Evolución Narrativa
[Cómo escala la amenaza a lo largo de la campaña]

### 🪝 Ganchos de Misión
[4 misiones/situaciones que este antagonista detona]

### 💡 Notas para el DM
[Consejos avanzados de interpretación y uso táctico en mesa]`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customPrompt, importancia } = await req.json();
    
    const category = importancia || "relevante";
    const systemPrompt = NPC_PROMPTS[category] || NPC_PROMPTS["relevante"];

    let userPrompt = `Genera un PNJ ${category === "menor" ? "breve" : category === "antagonista principal" ? "antagonista principal" : "completo"} para D&D 5e en Forgotten Realms.`;
    if (customPrompt) {
      userPrompt += `\n\nINSTRUCCIONES DEL USUARIO:\n${customPrompt}`;
    }

    const aiResult = await generateWithFallback(systemPrompt, userPrompt, {
      contentType: "npc",
      outputFormat: "markdown",
      stream: true,
      model: "gemini-2.5-pro",
    });

    if (!aiResult) {
      return new Response(
        JSON.stringify({ error: AI_ERRORS.ALL_UNAVAILABLE }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(aiResult.response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-AI-Provider": aiResult.provider },
    });
  } catch (e) {
    console.error("generate-npc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
