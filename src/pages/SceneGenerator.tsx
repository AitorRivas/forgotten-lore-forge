import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Theater, Loader2, Save, Pencil, Eye, RefreshCw, X,
  Info, AlertTriangle, Sparkles,
} from "lucide-react";

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
      toast.success("¡Escena generada!");
    } catch (e: any) {
      if (e.message?.includes("saturados") || e.message?.includes("no disponible") || e.message?.includes("429")) {
        setServiceUnavailable(true);
      } else {
        toast.error(e.message || "Error generando escena");
      }
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

      // Extract title from first heading
      const titleMatch = text.match(/^#+ (.+)/m);
      const titulo = titleMatch ? titleMatch[1].replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim() : "Escena sin título";

      const { data, error } = await supabase.from("escenas" as any).insert({
        user_id: user.id,
        titulo,
        tipo: tipo || "social",
        descripcion_narrativa: text,
        localizacion,
        nivel_recomendado: nivelGrupo,
        tono: tono || null,
        tags: [localizacion, tipo, tono].filter(Boolean),
      } as any).select("id").single();

      if (error) throw error;
      setSavedId((data as any)?.id || null);
      if (editMode) { setContent(editedContent); setEditMode(false); }
      toast.success("¡Escena guardada en tu biblioteca!");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [content, editMode, editedContent, tipo, localizacion, nivelGrupo, tono]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-lg sm:text-2xl text-gold text-glow flex items-center gap-2">
              <Theater size={20} /> Generador de Escenas
            </h1>
            <p className="text-xs text-muted-foreground">Eventos cerrados para improvisación</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Nivel del grupo</label>
                <input type="number" min={1} max={20} value={nivelGrupo} onChange={(e) => setNivelGrupo(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Localización</label>
                <select value={localizacion} onChange={(e) => setLocalizacion(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Tipo (opcional)</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  <option value="">Aleatorio</option>
                  {SCENE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Tono (opcional)</label>
                <select value={tono} onChange={(e) => setTono(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  <option value="">Aleatorio</option>
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Detalles extra (opcional)</label>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ej: 'En una taberna pirata con un cadáver bajo la mesa'"
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
              </div>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando escena..." : "Generar Escena"}
            </button>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {serviceUnavailable && !content ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-10 parchment-bg text-center space-y-4">
                <AlertTriangle className="mx-auto text-amber-400" size={40} />
                <h3 className="font-display text-lg text-foreground">Servicio temporalmente no disponible</h3>
                <p className="text-sm text-muted-foreground">El servicio de generación está temporalmente no disponible. Inténtalo en unos minutos.</p>
                <button onClick={generate} disabled={generating}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-display rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Reintentar
                </button>
              </motion.div>
            ) : content ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-5 parchment-bg space-y-3">
                {providerType === "alternative" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-1.5 w-fit">
                    <Info size={12} /><span>Generado con proveedor alternativo por disponibilidad temporal.</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={() => { setEditMode(!editMode); if (!editMode) setEditedContent(content); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors border ${editMode ? "bg-gold/20 text-gold border-gold/40" : "border-border text-foreground"}`}>
                    {editMode ? <><Eye size={13} /> Vista</> : <><Pencil size={13} /> Editar</>}
                  </button>
                  <button onClick={generate} disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors disabled:opacity-50">
                    <RefreshCw size={13} /> Regenerar
                  </button>
                  <button onClick={saveScene} disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {saving ? "Guardando..." : savedId ? "Guardado ✓" : "Guardar"}
                  </button>
                  <button onClick={() => { setContent(""); setEditMode(false); setSavedId(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <X size={13} /> Descartar
                  </button>
                </div>
                {editMode ? (
                  <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                    className="w-full min-h-[500px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                ) : (
                  <div className="prose-fantasy text-sm"><ReactMarkdown>{content}</ReactMarkdown></div>
                )}
              </motion.div>
            ) : (
              <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
                <Theater className="mx-auto mb-4 text-gold" size={48} />
                <h3 className="font-display text-xl text-foreground mb-2">Generador de Escenas</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Genera eventos cerrados para improvisación: combates evitables, dilemas morales, misterios breves, eventos sociales y más.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SceneGenerator;
