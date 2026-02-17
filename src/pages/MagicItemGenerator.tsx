import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Gem, Loader2, Save, Pencil, Eye, RefreshCw, X,
  Info, AlertTriangle, Sparkles,
} from "lucide-react";

const TIPOS = [
  "arma", "armadura", "escudo", "objeto maravilloso", "anillo", "varita",
  "bastón", "pergamino", "poción", "herramienta", "instrumento", "reliquia", "artefacto",
];

const RAREZAS = ["común", "poco común", "raro", "muy raro", "legendario"];

const TONOS = ["benigno", "ambiguo", "oscuro", "corruptor"];

const ROLES = ["combate", "exploración", "social", "híbrido"];

const MagicItemGenerator = () => {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState("objeto maravilloso");
  const [rareza, setRareza] = useState("");
  const [nivel, setNivel] = useState("5");
  const [region, setRegion] = useState("Costa de la Espada");
  const [tono, setTono] = useState("");
  const [rolObj, setRolObj] = useState("");
  const [esArtefacto, setEsArtefacto] = useState(false);
  const [escalable, setEscalable] = useState(false);
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
      const promptParts = [
        customPrompt,
        `Tipo de objeto: ${tipo}`,
        rareza ? `Rareza: ${rareza}` : "Rareza: elige la más apropiada",
        `Nivel del grupo: ${nivel}`,
        `Región: ${region}`,
        tono ? `Tono: ${tono}` : "",
        rolObj ? `Rol: ${rolObj}` : "",
        esArtefacto ? "Este objeto ES un artefacto. Sigue la estructura oficial del DMG para artefactos." : "",
        escalable ? "El objeto debe tener crecimiento escalable con condiciones de desbloqueo." : "",
      ].filter(Boolean).join("\n");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-magic-item`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ customPrompt: promptParts }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error generando objeto mágico");
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
      toast.success("¡Objeto mágico generado!");
    } catch (e: any) {
      if (e.message?.includes("saturados") || e.message?.includes("no disponible") || e.message?.includes("429")) {
        setServiceUnavailable(true);
      } else {
        toast.error(e.message || "Error generando objeto mágico");
      }
    } finally {
      setGenerating(false);
    }
  }, [tipo, rareza, nivel, region, tono, rolObj, esArtefacto, escalable, customPrompt]);

  const saveItem = useCallback(async () => {
    if (!content) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión");
      const text = editMode ? editedContent : content;
      const nameMatch = text.match(/^#+ .*?✨\s*(.+)/m) || text.match(/^#+ (.+)/m);
      const nombre = nameMatch ? nameMatch[1].trim() : "Objeto sin nombre";

      const { data, error } = await supabase.from("objetos_magicos" as any).insert({
        user_id: user.id,
        nombre,
        tipo,
        rareza: rareza || "poco común",
        es_artefacto: esArtefacto,
        crecimiento_escalable: escalable,
        region,
        nivel_recomendado: nivel,
        tono: tono || null,
        rol_objeto: rolObj || null,
        contenido_completo: text,
        tags: [tipo, rareza || "poco común", region, tono, rolObj].filter(Boolean),
      } as any).select("id").single();

      if (error) throw error;
      setSavedId((data as any)?.id || null);
      if (editMode) { setContent(editedContent); setEditMode(false); }
      toast.success("¡Objeto guardado en tu biblioteca!");
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [content, editMode, editedContent, tipo, rareza, region, nivel, tono, rolObj, esArtefacto, escalable]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-lg sm:text-2xl text-gold text-glow flex items-center gap-2">
              <Gem size={20} /> Generador de Objetos Mágicos
            </h1>
            <p className="text-xs text-muted-foreground">Objetos mágicos D&D 5e · Reinos Olvidados</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="space-y-4">
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Tipo de objeto</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Rareza (opcional)</label>
                <select value={rareza} onChange={(e) => setRareza(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  <option value="">Automática</option>
                  {RAREZAS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Nivel del grupo</label>
                <input type="number" min={1} max={20} value={nivel} onChange={(e) => setNivel(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Región de Faerûn</label>
                <select value={region} onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Tono (opcional)</label>
                <select value={tono} onChange={(e) => setTono(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  <option value="">Cualquiera</option>
                  {TONOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Rol (opcional)</label>
                <select value={rolObj} onChange={(e) => setRolObj(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors">
                  <option value="">Cualquiera</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={esArtefacto} onChange={(e) => setEsArtefacto(e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-gold" />
                  <span className="text-sm text-foreground">¿Es artefacto?</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={escalable} onChange={(e) => setEscalable(e.target.checked)}
                    className="w-5 h-5 rounded border-border text-primary focus:ring-gold" />
                  <span className="text-sm text-foreground">¿Crecimiento escalable?</span>
                </label>
              </div>

              <div>
                <label className="text-sm text-muted-foreground block mb-1">Detalles extra (opcional)</label>
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ej: 'Espada forjada por un herrero enano en Gauntlgrym, maldita por Asmodeus'"
                  rows={3}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground text-sm focus:outline-none focus:border-gold transition-colors resize-none" />
              </div>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando objeto..." : "Generar Objeto Mágico"}
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
                  <button onClick={saveItem} disabled={saving}
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
                    className="w-full min-h-[600px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                ) : (
                  <div className="prose-fantasy text-sm"><ReactMarkdown>{content}</ReactMarkdown></div>
                )}
              </motion.div>
            ) : (
              <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
                <Gem className="mx-auto mb-4 text-gold" size={48} />
                <h3 className="font-display text-xl text-foreground mb-2">Generador de Objetos Mágicos</h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Genera objetos mágicos completos con propiedades mecánicas, lore, rumores, ganchos narrativos y notas para el DM. Soporta artefactos con estructura oficial del DMG.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MagicItemGenerator;
