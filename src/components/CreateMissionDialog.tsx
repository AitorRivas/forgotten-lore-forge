import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Sparkles, Loader2 } from "lucide-react";
import { faerunLocations } from "@/data/faerun-locations";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentId?: string;
  parentTitle?: string;
}

interface MissionJSON {
  nombre: string;
  contexto_general: string;
  detonante: string;
  conflicto_real: string;
  actos: { titulo: string; objetivo: string; obstaculo: string; giro: string }[];
  enfoques_resolucion: { tipo: string; descripcion: string }[];
  giros_argumentales: string[];
  consecuencias_exito: string;
  consecuencias_fracaso: string;
  consecuencias_ignorar: string;
  secretos: string[];
  recompensas: string;
  notas_dm: string;
}

const TIPOS_MISION = [
  "Combate", "Investigación", "Social", "Política", "Exploración",
  "Infiltración", "Supervivencia", "Diplomática", "Religiosa",
  "Puzzle", "Terror", "Heist",
];

const TONOS = [
  "Épico", "Oscuro", "Heroico", "Trágico", "Moralmente gris",
  "Político", "Cómico", "Misterioso",
];

const CreateMissionDialog = ({ open, onClose, onCreated, parentId, parentTitle }: Props) => {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState("");
  const [nivelRecomendado, setNivelRecomendado] = useState("1-5");
  const [tono, setTono] = useState("");
  const [tags, setTags] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(parentId || "");

  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedSubregion, setSelectedSubregion] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");

  const [generating, setGenerating] = useState(false);
  const [generatedMission, setGeneratedMission] = useState<MissionJSON | null>(null);
  const [saving, setSaving] = useState(false);

  const [existingMissions, setExistingMissions] = useState<{ id: string; titulo: string }[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedParentId(parentId || "");
      fetchExistingMissions();
    }
  }, [open, parentId]);

  const fetchExistingMissions = async () => {
    const { data } = await supabase.from("misiones").select("id, titulo").order("titulo");
    if (data) setExistingMissions(data);
  };

  const subregiones = faerunLocations.find(r => r.region_mayor === selectedRegion)?.subregiones || [];
  const localizaciones = subregiones.find(s => s.nombre_subregion === selectedSubregion)?.localizaciones || [];
  const ubicacionFull = [selectedRegion, selectedSubregion, selectedLocation].filter(Boolean).join(" > ");

  const handleGenerate = async () => {
    if (!tipo || !selectedRegion) {
      toast.error("Selecciona tipo de misión y ubicación");
      return;
    }

    setGenerating(true);
    setGeneratedMission(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Inicia sesión"); setGenerating(false); return; }

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            userId: user.id,
            ubicacion: ubicacionFull,
            tipo,
            nivelGrupo: nivelRecomendado,
            tono: tono || "épico",
            parentMissionId: selectedParentId || null,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const mission: MissionJSON = await res.json();
      setGeneratedMission(mission);
      toast.success("Misión generada correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error generando misión");
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Inicia sesión"); setSaving(false); return; }

    const m = generatedMission;
    const finalTitle = titulo || m?.nombre || `Misión ${tipo || "nueva"}`;
    const tagArray = tags.split(",").map(t => t.trim()).filter(Boolean);

    const insertData: any = {
      user_id: user.id,
      titulo: finalTitle,
      tipo: tipo || null,
      nivel_recomendado: nivelRecomendado,
      tags: tagArray,
      tono: tono || null,
      ubicacion_principal: ubicacionFull || null,
      mission_parent_id: selectedParentId || null,
      estado: "activa",
      contexto_general: m?.contexto_general || null,
      detonante: m?.detonante || null,
      conflicto_central: m?.conflicto_real || null,
      trama_detallada: null,
      actos_o_fases: m?.actos || [],
      posibles_rutas: m?.enfoques_resolucion || [],
      giros_argumentales: m?.giros_argumentales || [],
      consecuencias_potenciales: m ? {
        exito: m.consecuencias_exito,
        fracaso: m.consecuencias_fracaso,
        ignorar: m.consecuencias_ignorar,
      } : {},
      secretos_ocultos: m?.secretos || [],
      recompensas_sugeridas: m ? { descripcion: m.recompensas } : {},
      contenido: m?.notas_dm || null,
    };

    const { error } = await supabase.from("misiones").insert(insertData);

    if (error) {
      toast.error("Error guardando misión");
      console.error(error);
    } else {
      toast.success("¡Misión creada!");
      resetForm();
      onCreated();
      onClose();
    }
    setSaving(false);
  };

  const resetForm = () => {
    setTitulo(""); setTipo(""); setNivelRecomendado("1-5"); setTono(""); setTags("");
    setSelectedParentId(""); setSelectedRegion(""); setSelectedSubregion(""); setSelectedLocation("");
    setGeneratedMission(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="ornate-border rounded-t-2xl sm:rounded-lg parchment-bg w-full max-w-lg max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card/95 backdrop-blur-sm z-10 rounded-t-2xl sm:rounded-t-lg">
          <h2 className="font-display text-xl text-gold">
            {parentTitle ? `Submisión de: ${parentTitle}` : "Nueva Misión"}
          </h2>
          <button onClick={() => { resetForm(); onClose(); }} className="text-muted-foreground hover:text-foreground p-2">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">
              Título <span className="text-muted-foreground text-xs">(opcional — se autogenera)</span>
            </label>
            <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)}
              placeholder="Se generará automáticamente..."
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">Tipo de Misión *</label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_MISION.map(t => (
                <button key={t} type="button" onClick={() => setTipo(tipo === t ? "" : t)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    tipo === t ? "border-gold bg-gold/20 text-gold" : "border-border text-muted-foreground hover:border-gold/40"
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Ubicación */}
          <div className="space-y-3">
            <label className="block text-sm font-display text-gold-light">Ubicación en Faerûn *</label>
            <select value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedSubregion(""); setSelectedLocation(""); }}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors">
              <option value="">Selecciona región...</option>
              {faerunLocations.map(r => <option key={r.region_mayor} value={r.region_mayor}>{r.region_mayor}</option>)}
            </select>
            {subregiones.length > 0 && (
              <select value={selectedSubregion} onChange={(e) => { setSelectedSubregion(e.target.value); setSelectedLocation(""); }}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors">
                <option value="">Subregión (opcional)...</option>
                {subregiones.map(s => <option key={s.nombre_subregion} value={s.nombre_subregion}>{s.nombre_subregion}</option>)}
              </select>
            )}
            {localizaciones.length > 0 && (
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors">
                <option value="">Localización específica (opcional)...</option>
                {localizaciones.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
          </div>

          {/* Tono */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">Tono</label>
            <div className="flex flex-wrap gap-2">
              {TONOS.map(t => (
                <button key={t} type="button" onClick={() => setTono(tono === t ? "" : t)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    tono === t ? "border-gold bg-gold/20 text-gold" : "border-border text-muted-foreground hover:border-gold/40"
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Nivel + Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">Nivel Recomendado</label>
              <select value={nivelRecomendado} onChange={(e) => setNivelRecomendado(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors">
                <option value="1-5">Nivel 1-5</option>
                <option value="5-10">Nivel 5-10</option>
                <option value="11-16">Nivel 11-16</option>
                <option value="17-20">Nivel 17-20</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">Tags</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="combate, política..."
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors" />
            </div>
          </div>

          {/* Parent selector */}
          {!parentId && (
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">Submisión de (opcional)</label>
              <select value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors">
                <option value="">Misión raíz (independiente)</option>
                {existingMissions.map(m => <option key={m.id} value={m.id}>{m.titulo || "Sin título"}</option>)}
              </select>
            </div>
          )}

          {/* Generate button */}
          <button onClick={handleGenerate} disabled={generating || !tipo || !selectedRegion}
            className="w-full flex items-center justify-center gap-2 bg-secondary border border-gold/40 text-gold font-display py-3 rounded-lg hover:bg-gold/10 transition-colors disabled:opacity-40 text-base">
            {generating ? <><Loader2 size={18} className="animate-spin" /> Generando...</> : <><Sparkles size={18} /> Generar con IA</>}
          </button>

          {/* Preview generated mission */}
          {generatedMission && (
            <div className="space-y-3 border border-gold/30 rounded-lg p-3 bg-secondary/50">
              <h3 className="font-display text-gold text-sm">Vista previa</h3>
              <PreviewField label="Nombre" value={generatedMission.nombre} />
              <PreviewField label="Contexto" value={generatedMission.contexto_general} />
              <PreviewField label="Detonante" value={generatedMission.detonante} />
              <PreviewField label="Conflicto" value={generatedMission.conflicto_real} />
              {generatedMission.actos.map((a, i) => (
                <div key={i} className="border-t border-border/50 pt-2">
                  <p className="text-xs font-display text-gold-light">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.objetivo}</p>
                </div>
              ))}
              <PreviewField label="Recompensas" value={generatedMission.recompensas} />
              <PreviewField label="Notas DM" value={generatedMission.notas_dm} />
            </div>
          )}

          {/* Actions */}
          <div className="sticky bottom-0 pt-3 pb-2">
            <div className="flex gap-3">
              <button type="button" onClick={() => { resetForm(); onClose(); }}
                className="flex-1 border border-border text-foreground font-display py-3 rounded-lg hover:bg-secondary transition-colors text-base">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || (!titulo && !generatedMission)}
                className="flex-1 bg-primary text-primary-foreground font-display py-3 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
                {saving ? "Guardando..." : "Guardar Misión"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreviewField = ({ label, value }: { label: string; value: string }) => {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-display text-gold-light">{label}</p>
      <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">{value}</p>
    </div>
  );
};

export default CreateMissionDialog;
