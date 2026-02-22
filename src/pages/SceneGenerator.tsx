import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Theater, Loader2, Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import GenerationStatus from "@/components/shared/GenerationStatus";
import ContentActions from "@/components/shared/ContentActions";
import FormField from "@/components/shared/FormField";

const SCENE_TYPES = [
  "social", "tensión", "combate evitable", "moral", "investigación breve",
  "caos", "ritual fallido", "evento político", "micro misterio", "interrupción ambiental",
];

const TONES = ["oscuro", "político", "cómico", "trágico", "épico", "misterioso", "tenso"];

const SceneGenerator = () => {
  const navigate = useNavigate();
  const [nivelGrupo, setNivelGrupo] = useState("5");
  const [localizacion, setLocalizacion] = useState("Costa de la Espada");
  const [tipo, setTipo] = useState("");
  const [tono, setTono] = useState("");
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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scene`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            nivelGrupo, localizacion, tipo: tipo || undefined, tono: tono || undefined,
            customPrompt: customPrompt || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error generando escena");
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
      console.error("Scene generation error:", e.message);
    } finally {
      setGenerating(false);
    }
  }, [nivelGrupo, localizacion, tipo, tono, customPrompt]);

  const saveScene = useCallback(async () => {
    if (!content) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");
      const text = editMode ? editedContent : content;
      const titleMatch = text.match(/^#+ (.+)/m);
      const titulo = titleMatch ? titleMatch[1].replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim() : "Escena sin título";

      const { data, error } = await supabase.from("escenas" as any).insert({
        user_id: user.id, titulo, tipo: tipo || "social", descripcion_narrativa: text,
        localizacion, nivel_recomendado: nivelGrupo, tono: tono || null,
        tags: [localizacion, tipo, tono].filter(Boolean),
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
  }, [content, editMode, editedContent, tipo, localizacion, nivelGrupo, tono]);

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Generador de Escenas"
        subtitle="Eventos cerrados para improvisación"
        icon={Theater}
        backPath="/dashboard"
        breadcrumbs={[
          { label: "Inicio", path: "/dashboard" },
          { label: "Escenas" },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <FormField label="Nivel del grupo" required>
                <input type="number" min={1} max={20} value={nivelGrupo} onChange={(e) => setNivelGrupo(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Localización" required>
                <select value={localizacion} onChange={(e) => setLocalizacion(e.target.value)} className={inputClass}>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
              <FormField label="Tipo" hint="Dejar vacío para aleatorio">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                  <option value="">Aleatorio</option>
                  {SCENE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Tono" hint="Dejar vacío para aleatorio">
                <select value={tono} onChange={(e) => setTono(e.target.value)} className={inputClass}>
                  <option value="">Aleatorio</option>
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Detalles extra" hint="Contexto adicional para la escena">
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ej: 'En una taberna pirata con un cadáver bajo la mesa'"
                  rows={3} className={`${inputClass} text-sm resize-none`} />
              </FormField>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando contenido…" : "Generar Escena"}
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {serviceUnavailable && !content ? (
              <GenerationStatus status="error" entityName="Escena" serviceUnavailable onRetry={generate} retrying={generating} />
            ) : content ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-5 parchment-bg space-y-3">
                <ContentActions
                  editMode={editMode}
                  onToggleEdit={() => { setEditMode(!editMode); if (!editMode) setEditedContent(content); }}
                  onRegenerate={generate}
                  onSave={saveScene}
                  onDiscard={() => { setContent(""); setEditMode(false); setSavedId(null); }}
                  saving={saving} generating={generating} savedId={savedId} providerType={providerType}
                />
                {editMode ? (
                  <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                ) : (
                  <div className="prose-fantasy text-sm"><ReactMarkdown>{content}</ReactMarkdown></div>
                )}
              </motion.div>
            ) : (
              <GenerationStatus status="idle" entityName="Generador de Escenas" idleIcon={Theater}
                idleDescription="Genera eventos cerrados para improvisación: combates evitables, dilemas morales, misterios breves, eventos sociales y más." />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SceneGenerator;
