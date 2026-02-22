import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Users, Loader2, Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import GenerationStatus from "@/components/shared/GenerationStatus";
import ContentActions from "@/components/shared/ContentActions";
import FormField from "@/components/shared/FormField";

const ROLES = [
  "villano", "aliado", "neutral", "comerciante", "líder político",
  "sacerdote", "criminal", "mercenario", "sabio", "espía",
];

const IMPORTANCIA: { value: string; label: string; desc: string }[] = [
  { value: "menor", label: "PNJ Menor", desc: "Rápido, solo esenciales para improvisación" },
  { value: "relevante", label: "PNJ Completo", desc: "Con ficha de combate y profundidad narrativa" },
  { value: "antagonista principal", label: "Antagonista Principal", desc: "Tácticas avanzadas, acciones legendarias" },
];

const NpcGenerator = () => {
  const navigate = useNavigate();
  const [nivel, setNivel] = useState("5");
  const [rol, setRol] = useState("");
  const [region, setRegion] = useState("Costa de la Espada");
  const [importancia, setImportancia] = useState("relevante");
  const [customPrompt, setCustomPrompt] = useState("");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [providerType, setProviderType] = useState<"primary" | "alternative" | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const regionOptions = useMemo(() => faerunLocations.map((l) => l.region_mayor), []);

  const generate = useCallback(async () => {
    setGenerating(true);
    setContent("");
    setProviderType(null);
    setServiceUnavailable(false);
    setSavedId(null);
    setEditMode(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-npc`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            importancia,
            customPrompt: [
              customPrompt, `Nivel aproximado: ${nivel}`,
              rol ? `Rol: ${rol}` : "", `Región: ${region}`,
            ].filter(Boolean).join("\n"),
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error generando PNJ");
      }

      const providerHeader = resp.headers.get("X-AI-Provider");
      setProviderType(providerHeader === "alternative" ? "alternative" : "primary");

      if (!resp.body) throw new Error("No stream body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { full += c; setContent(full); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      setServiceUnavailable(true);
      console.error("NPC generation error:", e.message);
    } finally {
      setGenerating(false);
    }
  }, [nivel, rol, region, importancia, customPrompt]);

  const saveNpc = useCallback(async () => {
    if (!content) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");
      const text = editMode ? editedContent : content;
      const nameMatch = text.match(/^#+ .*?([A-ZÁÉÍÓÚÑ][a-záéíóúñ][\w\sáéíóúñÁÉÍÓÚÑ'-]*)/m);
      const nombre = nameMatch ? nameMatch[1].trim() : "PNJ sin nombre";

      const { data, error } = await supabase.from("npcs" as any).insert({
        user_id: user.id, nombre, localizacion: region, nivel, rol: rol || null,
        importancia, contenido_completo: text, tags: [region, rol, importancia].filter(Boolean),
      } as any).select("id").single();

      if (error) throw error;
      setSavedId((data as any)?.id || null);
      if (editMode) { setContent(editedContent); setEditMode(false); }
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      toast.error("Se ha producido un error. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [content, editMode, editedContent, region, nivel, rol, importancia]);

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Generador de PNJ"
        subtitle="Personajes completos con ficha D&D 5e"
        icon={Users}
        backPath="/dashboard"
        breadcrumbs={[{ label: "Inicio", path: "/dashboard" }, { label: "PNJ" }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <FormField label="Nivel aproximado" required>
                <input type="number" min={1} max={20} value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Rol">
                <select value={rol} onChange={(e) => setRol(e.target.value)} className={inputClass}>
                  <option value="">Cualquiera</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
              <FormField label="Región de Faerûn" required>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
              <FormField label="Categoría de PNJ" required>
                <div className="space-y-2">
                  {IMPORTANCIA.map((i) => (
                    <label key={i.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        importancia === i.value ? "border-gold/60 bg-secondary" : "border-border hover:border-gold/30"
                      }`}>
                      <input type="radio" name="importancia" value={i.value} checked={importancia === i.value}
                        onChange={() => setImportancia(i.value)} className="mt-1 accent-[hsl(var(--gold))]" />
                      <div>
                        <span className="text-sm font-medium text-foreground">{i.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{i.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </FormField>
              <FormField label="Detalles extra" hint="Contexto adicional para el PNJ">
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ej: 'Elfa drow exiliada que es secretamente una agente de Bregan D'aerthe'"
                  rows={3} className={`${inputClass} text-sm resize-none`} />
              </FormField>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando contenido…" : "Generar PNJ"}
            </button>
          </div>

          <div className="lg:col-span-2">
            {serviceUnavailable && !content ? (
              <GenerationStatus status="error" entityName="PNJ" serviceUnavailable onRetry={generate} retrying={generating} />
            ) : content ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-5 parchment-bg space-y-3">
                <ContentActions
                  editMode={editMode}
                  onToggleEdit={() => { setEditMode(!editMode); if (!editMode) setEditedContent(content); }}
                  onRegenerate={generate} onSave={saveNpc}
                  onDiscard={() => { setContent(""); setEditMode(false); setSavedId(null); }}
                  saving={saving} generating={generating} savedId={savedId} providerType={providerType}
                />
                {editMode ? (
                  <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[600px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                ) : (
                  <div className="prose-fantasy text-sm"><ReactMarkdown>{content}</ReactMarkdown></div>
                )}
              </motion.div>
            ) : (
              <GenerationStatus status="idle" entityName="Generador de PNJ" idleIcon={Users}
                idleDescription="Genera personajes no jugadores completos con ficha de combate 5e, personalidad, secretos, motivaciones y ganchos narrativos." />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default NpcGenerator;
