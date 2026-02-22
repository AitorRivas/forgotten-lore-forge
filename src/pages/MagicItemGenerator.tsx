import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Gem, Loader2, Sparkles, Shield } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import GenerationStatus from "@/components/shared/GenerationStatus";
import ContentActions from "@/components/shared/ContentActions";
import FormField from "@/components/shared/FormField";

const TIPOS = [
  "arma", "armadura", "escudo", "objeto maravilloso", "anillo", "varita",
  "bastón", "pergamino", "poción", "herramienta", "instrumento", "reliquia", "artefacto",
];

const RAREZAS: { value: string; label: string; color: string }[] = [
  { value: "común", label: "Común", color: "text-zinc-400" },
  { value: "poco común", label: "Poco Común", color: "text-green-400" },
  { value: "raro", label: "Raro", color: "text-blue-400" },
  { value: "muy raro", label: "Muy Raro", color: "text-purple-400" },
  { value: "legendario", label: "Legendario", color: "text-amber-400" },
];

const RARITY_RISK: Record<string, { risk: string; riskColor: string }> = {
  "común": { risk: "Sin riesgo", riskColor: "text-green-400" },
  "poco común": { risk: "Riesgo bajo", riskColor: "text-green-400" },
  "raro": { risk: "Riesgo moderado", riskColor: "text-yellow-400" },
  "muy raro": { risk: "Riesgo alto", riskColor: "text-orange-400" },
  "legendario": { risk: "Riesgo extremo", riskColor: "text-red-400" },
};

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
        customPrompt, `Tipo de objeto: ${tipo}`,
        rareza ? `Rareza: ${rareza}` : "Rareza: elige la más apropiada",
        `Nivel del grupo: ${nivel}`, `Región: ${region}`,
        tono ? `Tono: ${tono}` : "", rolObj ? `Rol: ${rolObj}` : "",
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
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      setServiceUnavailable(true);
      console.error("Magic item generation error:", e.message);
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
        user_id: user.id, nombre, tipo, rareza: rareza || "poco común",
        es_artefacto: esArtefacto, crecimiento_escalable: escalable, region,
        nivel_recomendado: nivel, tono: tono || null, rol_objeto: rolObj || null,
        contenido_completo: text, tags: [tipo, rareza || "poco común", region, tono, rolObj].filter(Boolean),
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
  }, [content, editMode, editedContent, tipo, rareza, region, nivel, tono, rolObj, esArtefacto, escalable]);

  const inputClass = "w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Generador de Objetos Mágicos"
        subtitle="Objetos mágicos D&D 5e · Reinos Olvidados"
        icon={Gem}
        backPath="/dashboard"
        breadcrumbs={[{ label: "Inicio", path: "/dashboard" }, { label: "Objetos Mágicos" }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <FormField label="Tipo de objeto" required>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                  {TIPOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Rareza" hint="Dejar vacío para automática">
                <select value={rareza} onChange={(e) => setRareza(e.target.value)} className={inputClass}>
                  <option value="">Automática</option>
                  {RAREZAS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {rareza && (
                  <div className="flex items-center justify-between mt-2 px-1">
                    <span className={`text-xs font-medium ${RAREZAS.find(r => r.value === rareza)?.color || ""}`}>
                      <Gem size={12} className="inline mr-1" />{RAREZAS.find(r => r.value === rareza)?.label}
                    </span>
                    <span className={`text-xs ${RARITY_RISK[rareza]?.riskColor || ""}`}>
                      <Shield size={12} className="inline mr-1" />{RARITY_RISK[rareza]?.risk}
                    </span>
                  </div>
                )}
              </FormField>
              <FormField label="Nivel del grupo" required>
                <input type="number" min={1} max={20} value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClass} />
              </FormField>
              <FormField label="Región de Faerûn" required>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
              <FormField label="Tono">
                <select value={tono} onChange={(e) => setTono(e.target.value)} className={inputClass}>
                  <option value="">Cualquiera</option>
                  {TONOS.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </FormField>
              <FormField label="Rol">
                <select value={rolObj} onChange={(e) => setRolObj(e.target.value)} className={inputClass}>
                  <option value="">Cualquiera</option>
                  {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </FormField>
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
              <FormField label="Detalles extra" hint="Contexto adicional para el objeto">
                <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ej: 'Espada forjada por un herrero enano en Gauntlgrym, maldita por Asmodeus'"
                  rows={3} className={`${inputClass} text-sm resize-none`} />
              </FormField>
            </div>

            <button onClick={generate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando contenido…" : "Generar Objeto Mágico"}
            </button>
          </div>

          <div className="lg:col-span-2">
            {serviceUnavailable && !content ? (
              <GenerationStatus status="error" entityName="Objeto Mágico" serviceUnavailable onRetry={generate} retrying={generating} />
            ) : content ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="ornate-border rounded-lg p-5 parchment-bg space-y-3">
                <ContentActions
                  editMode={editMode}
                  onToggleEdit={() => { setEditMode(!editMode); if (!editMode) setEditedContent(content); }}
                  onRegenerate={generate} onSave={saveItem}
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
              <GenerationStatus status="idle" entityName="Generador de Objetos Mágicos" idleIcon={Gem}
                idleDescription="Genera objetos mágicos completos con propiedades mecánicas, lore, rumores, ganchos narrativos y notas para el DM." />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MagicItemGenerator;
