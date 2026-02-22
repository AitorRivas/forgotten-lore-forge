import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Users, UserPlus, Map, Castle, Swords, Loader2, Clapperboard, ShieldCheck, Gamepad2, Save, Pencil, Eye, Send, CheckCircle, AlertTriangle, Info, RefreshCw, X,
} from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import GenerationStatus from "@/components/shared/GenerationStatus";
import ContentActions from "@/components/shared/ContentActions";

interface GeneratorModule {
  id: string;
  label: string;
  icon: React.ElementType;
  endpoint: string;
  placeholder: string;
  description: string;
}

const MODULES: GeneratorModule[] = [
  { id: "pc", label: "Personaje Jugador", icon: UserPlus, endpoint: "generate-pc", placeholder: "Ej: 'Elfa druida con pasado oscuro'", description: "Genera un PC completo con personalidad, historia, secretos y ganchos de campaña." },
  { id: "npc", label: "PNJ", icon: Users, endpoint: "generate-npc", placeholder: "Ej: 'Tabernera con conexiones al mercado negro'", description: "Crea un PNJ profundo con motivaciones ocultas y ganchos de misión." },
  { id: "campaign-idea", label: "Idea de Campaña", icon: Map, endpoint: "generate-campaign-idea", placeholder: "Ej: 'Campaña política en Waterdeep'", description: "Genera una campaña completa con antagonista, facciones y giros." },
  { id: "campaign-structure", label: "Estructura de Campaña", icon: Castle, endpoint: "generate-campaign-structure", placeholder: "Ej: 'Estructura para campaña de 3 actos'", description: "Construye actos, capítulos y misiones detalladas." },
  { id: "mission", label: "Misión", icon: Swords, endpoint: "generate-mission", placeholder: "Ej: 'Misión de infiltración en fortaleza githyanki'", description: "Genera una misión standalone con encuentros y consecuencias." },
  { id: "session-script", label: "Guión de Sesión", icon: Clapperboard, endpoint: "generate-session-script", placeholder: "Ej: 'Guión con escenas y decisiones ramificadas'", description: "Convierte contenido en un guión ejecutable con escenas." },
  { id: "validate-lore", label: "Validar Lore", icon: ShieldCheck, endpoint: "validate-lore", placeholder: "Pega contenido para validar coherencia con Forgotten Realms", description: "Revisa coherencia con el lore y corrige sin alterar intención." },
  { id: "structure-gameplay", label: "Gameplay", icon: Gamepad2, endpoint: "structure-gameplay", placeholder: "Pega contenido narrativo para transformar en gameplay", description: "Transforma narrativa en gameplay con mecánicas y stats." },
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
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  const generate = useCallback(async (module: GeneratorModule) => {
    setGenerating(true);
    setStreamContent("");
    setLastPromptUsed(customPrompt);
    setProviderType(null);
    setServiceUnavailable(false);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${module.endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ customPrompt: customPrompt || undefined }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Error generando contenido");
      }

      const providerHeader = resp.headers.get("X-AI-Provider");
      setProviderType(providerHeader === "alternative" ? "alternative" : "primary");

      if (!resp.body) throw new Error("No stream body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "", fullContent = "", streamDone = false;

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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const content = JSON.parse(jsonStr).choices?.[0]?.delta?.content as string | undefined;
            if (content) { fullContent += content; setStreamContent(fullContent); }
          } catch { textBuffer = line + "\n" + textBuffer; break; }
        }
      }

      toast.success("Contenido generado con éxito");
      setCustomPrompt("");
    } catch (e: any) {
      setServiceUnavailable(true);
      console.error("Generator error:", e.message);
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ content: streamContent, content_type: activeModule }),
        }
      );
      if (!resp.ok) throw new Error("Error guardando");
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      toast.error("Se ha producido un error. Intenta de nuevo.");
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
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ original_text: streamContent, edited_text: editedContent }),
        }
      );
      if (!resp.ok) throw new Error("Error revisando");
      const data = await resp.json();
      setReviewResult(data.analysis);
      setStreamContent(editedContent);
      setEditMode(false);
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      toast.error("Se ha producido un error. Intenta de nuevo.");
    } finally {
      setReviewing(false);
    }
  }, [streamContent, editedContent]);

  const currentModule = MODULES.find((m) => m.id === activeModule);

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Módulos Generadores"
        subtitle="Herramientas de creación narrativa para el DM"
        icon={Sparkles}
        backPath="/dashboard"
        breadcrumbs={[{ label: "Inicio", path: "/dashboard" }, { label: "Generadores" }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Module selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = activeModule === mod.id;
            return (
              <button key={mod.id} onClick={() => { setActiveModule(mod.id); setStreamContent(""); }}
                className={`ornate-border rounded-lg p-4 text-center transition-all ${isActive ? "border-gold/60 bg-secondary" : "parchment-bg hover:border-gold/30"}`}>
                <Icon size={22} className={`mx-auto mb-2 ${isActive ? "text-gold" : "text-muted-foreground"}`} />
                <span className={`font-display text-xs ${isActive ? "text-gold" : "text-foreground"}`}>{mod.label}</span>
              </button>
            );
          })}
        </div>

        {currentModule ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="ornate-border rounded-lg p-4 parchment-bg">
                <div className="flex items-center gap-2 mb-2">
                  <currentModule.icon size={16} className="text-gold" />
                  <h3 className="font-display text-base text-gold">{currentModule.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">{currentModule.description}</p>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={currentModule.placeholder} rows={4}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors resize-none mb-3" />
                <button onClick={() => generate(currentModule)} disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? "Generando contenido…" : "Generar"}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {serviceUnavailable && !streamContent ? (
                <GenerationStatus status="error" entityName={currentModule.label} serviceUnavailable
                  onRetry={() => generate(currentModule)} retrying={generating} />
              ) : streamContent ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-5 parchment-bg space-y-3">
                  <ContentActions
                    editMode={editMode}
                    onToggleEdit={() => { if (!editMode) setEditedContent(streamContent); setEditMode(!editMode); }}
                    onRegenerate={() => { setCustomPrompt(lastPromptUsed); generate(currentModule); }}
                    onSave={saveContent}
                    onDiscard={() => { setStreamContent(""); setEditMode(false); setReviewResult(null); }}
                    saving={saving} generating={generating} providerType={providerType}
                    extraActions={
                      editMode ? (
                        <button onClick={reviewEdits} disabled={reviewing}
                          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:border-gold/40 transition-colors disabled:opacity-50">
                          {reviewing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          {reviewing ? "Revisando…" : "Revisar Cambios"}
                        </button>
                      ) : undefined
                    }
                  />
                  {editMode ? (
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                  ) : (
                    <div className="prose-fantasy text-sm"><ReactMarkdown>{streamContent}</ReactMarkdown></div>
                  )}
                </motion.div>
              ) : (
                <GenerationStatus status="idle" entityName={currentModule.label} idleIcon={currentModule.icon}
                  idleDescription="Describe lo que necesitas o genera contenido aleatorio" />
              )}

              {/* Review Results Panel */}
              {reviewResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ornate-border rounded-lg p-5 parchment-bg">
                  <h3 className="font-display text-base text-gold mb-4 flex items-center gap-2">
                    <CheckCircle size={16} /> Revisión de Cambios
                  </h3>
                  {reviewResult.summary && (
                    <p className="text-sm text-foreground mb-4 p-3 bg-secondary/50 rounded border border-border">{reviewResult.summary}</p>
                  )}
                  {reviewResult.changes_detected?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-display text-sm text-foreground mb-2">Cambios Detectados</h4>
                      <div className="space-y-2">
                        {reviewResult.changes_detected.map((c: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs p-2 bg-secondary/30 rounded">
                            <span className={`mt-0.5 ${c.importance === "critical" ? "text-red-400" : c.importance === "major" ? "text-yellow-400" : "text-muted-foreground"}`}>
                              {c.importance === "critical" || c.importance === "major" ? <AlertTriangle size={12} /> : <Info size={12} />}
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
                            <span className="text-gold">{s.area}:</span> <span className="text-foreground">{s.suggestion}</span>
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
          <GenerationStatus status="idle" entityName="Módulos Generadores" idleIcon={Sparkles}
            idleDescription="Selecciona uno de los generadores para crear personajes, PNJs, ideas de campaña, estructuras narrativas o misiones." />
        )}
      </main>
    </div>
  );
};

export default Generators;
