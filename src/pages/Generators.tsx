import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Sparkles, Users, UserPlus, Map, Castle, Swords, Loader2, Clapperboard, ShieldCheck, Gamepad2, Save, Pencil, Eye, Send, CheckCircle, AlertTriangle, Info, RefreshCw, X,
} from "lucide-react";

interface GeneratorModule {
  id: string;
  label: string;
  icon: React.ElementType;
  endpoint: string;
  placeholder: string;
  description: string;
}

const MODULES: GeneratorModule[] = [
  {
    id: "pc",
    label: "Personaje Jugador",
    icon: UserPlus,
    endpoint: "generate-pc",
    placeholder: "Ej: 'Elfa druida con pasado oscuro' o 'Enano forjador de runas nivel 5'",
    description: "Genera un PC completo con personalidad, historia, secretos y ganchos de campaña.",
  },
  {
    id: "npc",
    label: "PNJ",
    icon: Users,
    endpoint: "generate-npc",
    placeholder: "Ej: 'Tabernera con conexiones al mercado negro' o 'Sacerdote corrupto de Helm'",
    description: "Crea un PNJ profundo con motivaciones ocultas, traiciones posibles y ganchos de misión.",
  },
  {
    id: "campaign-idea",
    label: "Idea de Campaña",
    icon: Map,
    endpoint: "generate-campaign-idea",
    placeholder: "Ej: 'Campaña política en Waterdeep' o 'Horror cósmico en Undermountain nivel 5-15'",
    description: "Genera una campaña completa con antagonista, facciones, giros y dilemas morales.",
  },
  {
    id: "campaign-structure",
    label: "Estructura de Campaña",
    icon: Castle,
    endpoint: "generate-campaign-structure",
    placeholder: "Ej: 'Estructura completa para una campaña de 3 actos sobre la guerra de dragones'",
    description: "Construye actos, capítulos, misiones detalladas con finales múltiples.",
  },
   {
     id: "mission",
     label: "Misión",
     icon: Swords,
     endpoint: "generate-mission",
     placeholder: "Ej: 'Misión de infiltración en una fortaleza githyanki'",
     description: "Genera una misión standalone con encuentros, NPCs y consecuencias.",
   },
   {
     id: "session-script",
     label: "Guión de Sesión",
     icon: Clapperboard,
     endpoint: "generate-session-script",
     placeholder: "Ej: 'Convierte mi misión en un guión con escenas y decisiones ramificadas' o deja vacío para generar una sesión aleatoria",
     description: "Convierte contenido en un guión ejecutable con escenas, decisiones, encuentros y cliffhangers.",
   },
   {
     id: "validate-lore",
     label: "Validar Lore",
     icon: ShieldCheck,
     endpoint: "validate-lore",
     placeholder: "Pega aquí el contenido generado (misión, PNJ, campaña) para validar su coherencia con Forgotten Realms y tu campaña",
     description: "Revisa coherencia con el lore, campaña, PNJs y progresión narrativa. Corrige sin alterar intención.",
   },
   {
     id: "structure-gameplay",
     label: "Gameplay",
     icon: Gamepad2,
     endpoint: "structure-gameplay",
     placeholder: "Pega contenido narrativo (misión, escena, idea) para transformarlo en formato mecánicamente jugable con encuentros, CDs, stats y consecuencias",
     description: "Transforma narrativa en gameplay: escenas con mecánicas, encuentros con stats, objetivos y consecuencias.",
   },
 ];

const Generators = () => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<any>(null);
  const [lastPromptUsed, setLastPromptUsed] = useState("");
  const [providerType, setProviderType] = useState<"primary" | "alternative" | null>(null);

  const generate = useCallback(async (module: GeneratorModule) => {
    setGenerating(true);
    setStreamContent("");
    setLastPromptUsed(customPrompt);
    setProviderType(null);

    try {
      const body: Record<string, string | undefined> = {
        customPrompt: customPrompt || undefined,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${module.endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando contenido");
      }

      // Read provider from response header
      const providerHeader = resp.headers.get("X-AI-Provider");
      if (providerHeader === "alternative") setProviderType("alternative");
      else setProviderType("primary");

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      toast.success("¡Contenido generado!");
      setCustomPrompt("");
    } catch (e: any) {
      toast.error(e.message || "Error generando contenido");
    } finally {
      setGenerating(false);
    }
  }, [customPrompt]);

  const saveContent = useCallback(async () => {
    if (!streamContent || !activeModule) return;
    setSaving(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/format-and-store`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            content: streamContent,
            content_type: activeModule,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error guardando contenido");
      }
      toast.success("¡Contenido guardado en tu biblioteca!");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [streamContent, activeModule]);

  const reviewEdits = useCallback(async () => {
    if (!streamContent || !editedContent || editedContent === streamContent) {
      toast.info("No se detectaron cambios");
      return;
    }
    setReviewing(true);
    setReviewResult(null);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/human-edit-review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            original_text: streamContent,
            edited_text: editedContent,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error revisando cambios");
      }
      const data = await resp.json();
      setReviewResult(data.analysis);
      // Apply human edits to streamContent (human text is sacred)
      setStreamContent(editedContent);
      setEditMode(false);
      toast.success("¡Cambios revisados y aplicados!");
    } catch (e: any) {
      toast.error(e.message || "Error revisando");
    } finally {
      setReviewing(false);
    }
  }, [streamContent, editedContent]);

  const currentModule = MODULES.find((m) => m.id === activeModule);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="font-display text-2xl text-gold text-glow">
                Módulos Generadores
              </h1>
              <p className="text-sm text-muted-foreground">
                Herramientas de creación narrativa para el DM
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
         {/* Module selector */}
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => {
                  setActiveModule(mod.id);
                  setStreamContent("");
                }}
                className={`ornate-border rounded-lg p-4 text-center transition-all ${
                  isActive
                    ? "border-gold/60 bg-secondary"
                    : "parchment-bg hover:border-gold/30"
                }`}
              >
                <Icon
                  size={24}
                  className={`mx-auto mb-2 ${isActive ? "text-gold" : "text-muted-foreground"}`}
                />
                <span
                  className={`font-display text-xs ${
                    isActive ? "text-gold" : "text-foreground"
                  }`}
                >
                  {mod.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active module */}
        {currentModule ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input */}
            <div className="lg:col-span-1">
              <div className="ornate-border rounded-lg p-5 parchment-bg">
                <div className="flex items-center gap-2 mb-2">
                  <currentModule.icon size={18} className="text-gold" />
                  <h3 className="font-display text-lg text-gold">
                    {currentModule.label}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  {currentModule.description}
                </p>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={currentModule.placeholder}
                  rows={4}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors resize-none mb-3"
                />
                <button
                  onClick={() => generate(currentModule)}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-2.5 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {generating ? "Generando..." : "Generar"}
                </button>
              </div>
            </div>

            {/* Output */}
            <div className="lg:col-span-2 space-y-4">
              {streamContent ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                   className="ornate-border rounded-lg p-6 parchment-bg"
                 >
                   {providerType === "alternative" && (
                     <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-1.5 mb-3 w-fit">
                       <Info size={12} />
                       <span>Generado con proveedor alternativo por disponibilidad temporal.</span>
                     </div>
                   )}
                   <div className="flex justify-between items-center mb-3">
                     <div className="flex gap-2">
                       <button
                         onClick={() => { setEditMode(false); setReviewResult(null); }}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${!editMode ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                       >
                         <Eye size={13} /> Vista
                       </button>
                       <button
                         onClick={() => { setEditMode(true); setEditedContent(streamContent); }}
                         className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${editMode ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"}`}
                       >
                         <Pencil size={13} /> Editar
                       </button>
                     </div>
                     <div className="flex gap-2">
                       {currentModule && (
                         <button
                           onClick={() => { setCustomPrompt(lastPromptUsed); generate(currentModule); }}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-accent border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors"
                         >
                           <RefreshCw size={13} /> Regenerar
                         </button>
                       )}
                       <button
                         onClick={() => { setStreamContent(""); setEditMode(false); setReviewResult(null); }}
                         className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                       >
                         <X size={13} /> Descartar
                       </button>
                       {editMode && (
                         <button
                           onClick={reviewEdits}
                           disabled={reviewing}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-accent border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors disabled:opacity-50"
                         >
                           {reviewing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                           {reviewing ? "Revisando..." : "Revisar Cambios"}
                         </button>
                       )}
                       <button
                         onClick={saveContent}
                         disabled={saving || generating}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50"
                       >
                         {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                         {saving ? "Guardando..." : "Guardar"}
                       </button>
                     </div>
                   </div>

                   {editMode ? (
                     <textarea
                       value={editedContent}
                       onChange={(e) => setEditedContent(e.target.value)}
                       className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y"
                     />
                   ) : (
                     <div className="prose-fantasy">
                       <ReactMarkdown>{streamContent}</ReactMarkdown>
                     </div>
                   )}
                 </motion.div>
              ) : (
                <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
                  <currentModule.icon
                    className="mx-auto mb-4 text-gold"
                    size={40}
                  />
                  <h3 className="font-display text-xl text-foreground mb-2">
                    {currentModule.label}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Describe lo que necesitas o genera contenido aleatorio
                  </p>
                </div>
               )}

               {/* Review Results Panel */}
               {reviewResult && (
                 <motion.div
                   initial={{ opacity: 0, y: 10 }}
                   animate={{ opacity: 1, y: 0 }}
                   className="ornate-border rounded-lg p-5 parchment-bg"
                 >
                   <h3 className="font-display text-lg text-gold mb-4 flex items-center gap-2">
                     <CheckCircle size={18} /> Revisión de Cambios
                   </h3>

                   {reviewResult.summary && (
                     <p className="text-sm text-foreground mb-4 p-3 bg-secondary/50 rounded border border-border">
                       {reviewResult.summary}
                     </p>
                   )}

                   {reviewResult.changes_detected?.length > 0 && (
                     <div className="mb-4">
                       <h4 className="font-display text-sm text-foreground mb-2">Cambios Detectados</h4>
                       <div className="space-y-2">
                         {reviewResult.changes_detected.map((c: any, i: number) => (
                           <div key={i} className="flex items-start gap-2 text-xs p-2 bg-secondary/30 rounded">
                             <span className={`mt-0.5 ${c.importance === "critical" ? "text-red-400" : c.importance === "major" ? "text-yellow-400" : "text-muted-foreground"}`}>
                               {c.importance === "critical" ? <AlertTriangle size={12} /> : c.importance === "major" ? <AlertTriangle size={12} /> : <Info size={12} />}
                             </span>
                             <div>
                               <span className="text-foreground">{c.description}</span>
                               {c.narrative_impact && <p className="text-muted-foreground mt-0.5">{c.narrative_impact}</p>}
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {reviewResult.coherence_issues?.length > 0 && (
                     <div className="mb-4">
                       <h4 className="font-display text-sm text-foreground mb-2">Coherencia</h4>
                       <div className="space-y-2">
                         {reviewResult.coherence_issues.map((c: any, i: number) => (
                           <div key={i} className="text-xs p-2 bg-secondary/30 rounded">
                             <span className={c.severity === "error" ? "text-red-400" : c.severity === "warning" ? "text-yellow-400" : "text-blue-400"}>
                               [{c.severity}]
                             </span>{" "}
                             <span className="text-foreground">{c.issue}</span>
                             {c.suggestion && <p className="text-muted-foreground mt-1">💡 {c.suggestion}</p>}
                           </div>
                         ))}
                       </div>
                     </div>
                   )}

                   {reviewResult.improvement_suggestions?.length > 0 && (
                     <div>
                       <h4 className="font-display text-sm text-foreground mb-2">Sugerencias de Mejora</h4>
                       <div className="space-y-2">
                         {reviewResult.improvement_suggestions.map((s: any, i: number) => (
                           <div key={i} className="text-xs p-2 bg-secondary/30 rounded">
                             <span className="text-gold">{s.area}:</span>{" "}
                             <span className="text-foreground">{s.suggestion}</span>
                             {s.reason && <p className="text-muted-foreground mt-0.5">{s.reason}</p>}
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                 </motion.div>
               )}
             </div>
          </div>
        ) : (
          <div className="ornate-border rounded-lg p-16 parchment-bg text-center">
            <Sparkles className="mx-auto mb-4 text-gold" size={48} />
            <h3 className="font-display text-2xl text-foreground mb-3">
              Elige un Módulo
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Selecciona uno de los generadores para crear personajes, PNJs, ideas
              de campaña, estructuras narrativas o misiones independientes.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Generators;
