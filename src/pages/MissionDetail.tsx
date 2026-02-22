import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronDown, Swords, Target, Plus,
  Link2, Pencil, Save, Loader2, Scroll, Check, Archive, Trash2, Theater,
  MapPin, BookOpen, Shield, AlertTriangle, Trophy, Eye, Gem, RefreshCw,
} from "lucide-react";
import CreateMissionDialog from "@/components/CreateMissionDialog";
import PageHeader from "@/components/shared/PageHeader";
import CreateButton from "@/components/shared/CreateButton";

interface Mision {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  tipo: string | null;
  estado: string;
  nivel_recomendado: string | null;
  tags: string[];
  mission_parent_id: string | null;
  linked_missions_ids: string[];
  contenido: string | null;
  metadata: any;
  tono: string | null;
  ubicacion_principal: string | null;
  contexto_general: string | null;
  detonante: string | null;
  conflicto_central: string | null;
  trama_detallada: string | null;
  actos_o_fases: any[];
  posibles_rutas: any[];
  giros_argumentales: any[];
  consecuencias_potenciales: any;
  secretos_ocultos: string[];
  eventos_dinamicos: string[];
  recompensas_sugeridas: any;
  riesgos_escalada: string[];
  facciones_involucradas: string[];
  pnj_clave: string[];
  created_at: string;
  updated_at: string;
}

interface Encounter {
  id: string;
  texto_completo_editable: string;
  tipo: string;
  dificultad: number;
  nivel_grupo: number;
  created_at: string;
}

interface LinkedMision {
  id: string;
  titulo: string | null;
  estado: string;
}

const ESTADO_BADGE: Record<string, string> = {
  activa: "bg-green-900/40 text-green-300",
  completada: "bg-blue-900/40 text-blue-300",
  archivada: "bg-muted text-muted-foreground",
};

const DIFF_LABELS: Record<number, string> = {
  1: "Fácil", 2: "Moderado", 3: "Desafiante", 4: "Difícil", 5: "Mortal",
};

const REGENERABLE_FIELDS: Record<string, { label: string; dbField: string }> = {
  contexto_general: { label: "Contexto", dbField: "contexto_general" },
  detonante: { label: "Detonante", dbField: "detonante" },
  conflicto_central: { label: "Conflicto", dbField: "conflicto_central" },
  notas_dm: { label: "Notas DM", dbField: "contenido" },
};

const MissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mision, setMision] = useState<Mision | null>(null);
  const [submisiones, setSubmisiones] = useState<Mision[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [scenes, setScenes] = useState<any[]>([]);
  const [linkedMisions, setLinkedMisions] = useState<LinkedMision[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; titulo: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSub, setShowCreateSub] = useState(false);

  // Field editing
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingField, setSavingField] = useState(false);
  const [regeneratingField, setRegeneratingField] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    info: true,
    contexto: true,
    detonante: false,
    conflicto: false,
    actos: false,
    enfoques: false,
    giros: false,
    consecuencias: false,
    secretos: false,
    recompensas: false,
    notas_dm: false,
    submisiones: false,
    escenas: false,
    encuentros: false,
    relacionadas: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  useEffect(() => { if (id) fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchMision(), fetchSubmisiones(), fetchEncounters(), fetchScenes()]);
    setLoading(false);
  };

  const fetchMision = async () => {
    const { data, error } = await supabase.from("misiones").select("*").eq("id", id!).single();
    if (error || !data) { toast.error("Misión no encontrada"); navigate("/dashboard"); return; }
    const m = data as any;
    setMision({
      ...m,
      tags: m.tags || [],
      linked_missions_ids: m.linked_missions_ids || [],
      actos_o_fases: m.actos_o_fases || [],
      posibles_rutas: m.posibles_rutas || [],
      giros_argumentales: m.giros_argumentales || [],
      consecuencias_potenciales: m.consecuencias_potenciales || {},
      secretos_ocultos: m.secretos_ocultos || [],
      eventos_dinamicos: m.eventos_dinamicos || [],
      recompensas_sugeridas: m.recompensas_sugeridas || {},
      riesgos_escalada: m.riesgos_escalada || [],
      facciones_involucradas: m.facciones_involucradas || [],
      pnj_clave: m.pnj_clave || [],
    });

    const crumbs: { id: string; titulo: string | null }[] = [];
    let currentParentId = m.mission_parent_id;
    while (currentParentId) {
      const { data: parent } = await supabase
        .from("misiones").select("id, titulo, mission_parent_id").eq("id", currentParentId).single();
      if (!parent) break;
      crumbs.unshift({ id: parent.id, titulo: parent.titulo });
      currentParentId = parent.mission_parent_id;
    }
    setBreadcrumb(crumbs);

    if (m.linked_missions_ids?.length > 0) {
      const { data: linked } = await supabase.from("misiones").select("id, titulo, estado").in("id", m.linked_missions_ids);
      setLinkedMisions((linked as LinkedMision[]) || []);
    } else {
      setLinkedMisions([]);
    }
  };

  const fetchSubmisiones = async () => {
    const { data } = await supabase.from("misiones").select("*").eq("mission_parent_id", id!).order("created_at", { ascending: true });
    setSubmisiones((data || []).map((m: any) => ({ ...m, tags: m.tags || [], linked_missions_ids: m.linked_missions_ids || [] })));
  };

  const fetchEncounters = async () => {
    const { data } = await supabase.from("encounters").select("id, texto_completo_editable, tipo, dificultad, nivel_grupo, created_at").eq("mission_id", id!).order("created_at", { ascending: false });
    setEncounters((data as Encounter[]) || []);
  };

  const fetchScenes = async () => {
    const { data } = await supabase.from("escenas").select("id, titulo, tipo, localizacion, created_at").eq("mission_id", id!).order("created_at", { ascending: false });
    setScenes((data as any[]) || []);
  };

  const updateEstado = async (newEstado: string) => {
    if (!mision) return;
    const { error } = await supabase.from("misiones").update({ estado: newEstado }).eq("id", mision.id);
    if (error) toast.error("Error actualizando estado");
    else { toast.success(`Misión: ${newEstado}`); setMision({ ...mision, estado: newEstado }); }
  };

  const deleteMision = async () => {
    if (!mision || !confirm("¿Eliminar esta misión y todas sus submisiones?")) return;
    const { error } = await supabase.from("misiones").delete().eq("id", mision.id);
    if (error) toast.error("Error eliminando");
    else {
      toast.success("Misión eliminada");
      navigate(mision.mission_parent_id ? `/mission/${mision.mission_parent_id}` : "/dashboard");
    }
  };

  const saveField = async (field: string, value: any) => {
    if (!mision) return;
    setSavingField(true);
    const { error } = await supabase.from("misiones").update({ [field]: value }).eq("id", mision.id);
    if (error) toast.error("Error guardando");
    else {
      toast.success("Guardado");
      setMision({ ...mision, [field]: value });
      setEditingField(null);
    }
    setSavingField(false);
  };

  const regenerateField = async (fieldKey: string) => {
    if (!mision) return;
    setRegeneratingField(fieldKey);
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
            regenerateField: fieldKey,
            tipo: mision.tipo || "aventura",
            ubicacion: mision.ubicacion_principal || "Faerûn",
            nivelGrupo: mision.nivel_recomendado || "1-5",
            tono: mision.tono || "épico",
            customPrompt: mision.conflicto_central || "",
          }),
        }
      );
      if (!res.ok) throw new Error("Error regenerando");
      const data = await res.json();
      if (data.value) {
        const dbField = REGENERABLE_FIELDS[fieldKey]?.dbField || fieldKey;
        if (confirm(`¿Reemplazar ${REGENERABLE_FIELDS[fieldKey]?.label || fieldKey} con el nuevo contenido?`)) {
          await saveField(dbField, data.value);
        }
      }
    } catch (e: any) {
      toast.error("Error regenerando sección");
    }
    setRegeneratingField(null);
  };

  if (loading || !mision) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-flicker text-gold text-xl font-display">Descifrando pergaminos...</div>
      </div>
    );
  }

  const displayTitle = mision.titulo || "Misión sin título";
  const missionMode = mision.metadata?.mode;

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader
        title={displayTitle}
        icon={Scroll}
        backPath={mision.mission_parent_id ? `/mission/${mision.mission_parent_id}` : "/dashboard"}
        breadcrumbs={[
          { label: "Inicio", path: "/dashboard" },
          ...breadcrumb.map(c => ({ label: c.titulo || "Sin título", path: `/mission/${c.id}` })),
          { label: displayTitle },
        ]}
        rightContent={missionMode ? (
          <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ${missionMode === "extended" ? "bg-amber-400/20 text-amber-400" : "bg-secondary text-muted-foreground"}`}>
            {missionMode === "extended" ? "Extendida" : "Normal"}
          </span>
        ) : undefined}
      />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-3">
        {/* INFO */}
        <SectionCard title="Información General" icon={Scroll} sectionKey="info" expanded={expandedSections} toggle={toggleSection}>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded capitalize ${ESTADO_BADGE[mision.estado] || "bg-secondary text-muted-foreground"}`}>{mision.estado}</span>
            {mision.nivel_recomendado && <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">Nivel {mision.nivel_recomendado}</span>}
            {mision.tipo && <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded capitalize">{mision.tipo}</span>}
            {mision.tono && <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded capitalize">{mision.tono}</span>}
          </div>
          {mision.ubicacion_principal && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
              <MapPin size={14} className="text-gold shrink-0" /><span>{mision.ubicacion_principal}</span>
            </div>
          )}
          {mision.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {mision.tags.map(tag => <span key={tag} className="text-xs bg-secondary/70 text-muted-foreground px-2 py-0.5 rounded">{tag}</span>)}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {mision.estado !== "completada" && (
              <button onClick={() => updateEstado("completada")} className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border hover:border-green-500/50 transition-colors">
                <Check size={14} /> Completar
              </button>
            )}
            {mision.estado !== "archivada" && (
              <button onClick={() => updateEstado("archivada")} className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border hover:border-muted-foreground/50 transition-colors">
                <Archive size={14} /> Archivar
              </button>
            )}
            {mision.estado !== "activa" && (
              <button onClick={() => updateEstado("activa")} className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border hover:border-gold/50 transition-colors">
                <Target size={14} /> Reactivar
              </button>
            )}
            <button onClick={deleteMision} className="flex items-center gap-1.5 text-xs px-3 py-2.5 rounded-lg border border-border text-destructive hover:border-destructive/50 transition-colors ml-auto">
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </SectionCard>

        {/* CONTEXTO */}
        <EditableFieldCard title="Contexto General" icon={BookOpen} sectionKey="contexto" expanded={expandedSections} toggle={toggleSection}
          value={mision.contexto_general} field="contexto_general"
          editingField={editingField} setEditingField={setEditingField}
          editValue={editValue} setEditValue={setEditValue}
          saving={savingField} onSave={saveField}
          canRegenerate regeneratingField={regeneratingField} onRegenerate={regenerateField} />

        {/* DETONANTE */}
        <EditableFieldCard title="Detonante" icon={AlertTriangle} sectionKey="detonante" expanded={expandedSections} toggle={toggleSection}
          value={mision.detonante} field="detonante"
          editingField={editingField} setEditingField={setEditingField}
          editValue={editValue} setEditValue={setEditValue}
          saving={savingField} onSave={saveField}
          canRegenerate regeneratingField={regeneratingField} onRegenerate={regenerateField} />

        {/* CONFLICTO */}
        <EditableFieldCard title="Conflicto Central" icon={Shield} sectionKey="conflicto" expanded={expandedSections} toggle={toggleSection}
          value={mision.conflicto_central} field="conflicto_central"
          editingField={editingField} setEditingField={setEditingField}
          editValue={editValue} setEditValue={setEditValue}
          saving={savingField} onSave={saveField}
          canRegenerate regeneratingField={regeneratingField} onRegenerate={regenerateField} />

        {/* ACTOS */}
        <SectionCard title="Actos / Fases" icon={Target} sectionKey="actos" expanded={expandedSections} toggle={toggleSection}>
          {mision.actos_o_fases.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin actos definidos</p>
          ) : (
            <div className="space-y-3">
              {mision.actos_o_fases.map((acto: any, i: number) => (
                <div key={i} className="border border-border/50 rounded-lg p-3 space-y-1.5">
                  <p className="font-display text-sm text-gold">{acto.titulo || `Fase ${i + 1}`}</p>
                  {acto.objetivo && <p className="text-xs text-foreground/80"><span className="text-muted-foreground">Objetivo:</span> {acto.objetivo}</p>}
                  {acto.obstaculo && <p className="text-xs text-foreground/80"><span className="text-muted-foreground">Obstáculo:</span> {acto.obstaculo}</p>}
                  {acto.giro && <p className="text-xs text-foreground/80"><span className="text-muted-foreground">Giro:</span> {acto.giro}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ENFOQUES */}
        <SectionCard title="Enfoques de Resolución" icon={Eye} sectionKey="enfoques" expanded={expandedSections} toggle={toggleSection}>
          {mision.posibles_rutas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin enfoques definidos</p>
          ) : (
            <div className="space-y-3">
              {mision.posibles_rutas.map((ruta: any, i: number) => (
                <div key={i} className="border border-border/50 rounded-lg p-3">
                  <p className="font-display text-xs text-gold capitalize mb-1">{ruta.tipo || `Enfoque ${i + 1}`}</p>
                  <p className="text-xs text-foreground/80">{ruta.descripcion}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* GIROS */}
        <SectionCard title="Giros Argumentales" icon={Gem} sectionKey="giros" expanded={expandedSections} toggle={toggleSection}>
          {mision.giros_argumentales.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin giros definidos</p>
          ) : (
            <ul className="space-y-2">
              {mision.giros_argumentales.map((giro: any, i: number) => (
                <li key={i} className="text-xs text-foreground/80 border-l-2 border-gold/30 pl-3">
                  {typeof giro === "string" ? giro : JSON.stringify(giro)}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* CONSECUENCIAS */}
        <SectionCard title="Consecuencias" icon={AlertTriangle} sectionKey="consecuencias" expanded={expandedSections} toggle={toggleSection}>
          {mision.consecuencias_potenciales && Object.keys(mision.consecuencias_potenciales).length > 0 ? (
            <div className="space-y-2">
              {mision.consecuencias_potenciales.exito && (
                <div><p className="text-xs font-display text-green-400">Éxito</p><p className="text-xs text-foreground/80 mt-0.5">{mision.consecuencias_potenciales.exito}</p></div>
              )}
              {mision.consecuencias_potenciales.fracaso && (
                <div><p className="text-xs font-display text-red-400">Fracaso</p><p className="text-xs text-foreground/80 mt-0.5">{mision.consecuencias_potenciales.fracaso}</p></div>
              )}
              {mision.consecuencias_potenciales.ignorar && (
                <div><p className="text-xs font-display text-muted-foreground">Ignorar</p><p className="text-xs text-foreground/80 mt-0.5">{mision.consecuencias_potenciales.ignorar}</p></div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin consecuencias definidas</p>
          )}
        </SectionCard>

        {/* SECRETOS */}
        <SectionCard title="Secretos Ocultos" icon={Eye} sectionKey="secretos" expanded={expandedSections} toggle={toggleSection}>
          {mision.secretos_ocultos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin secretos definidos</p>
          ) : (
            <ul className="space-y-2">
              {mision.secretos_ocultos.map((s, i) => (
                <li key={i} className="text-xs text-foreground/80 border-l-2 border-gold/30 pl-3">{s}</li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* RECOMPENSAS */}
        <SectionCard title="Recompensas" icon={Trophy} sectionKey="recompensas" expanded={expandedSections} toggle={toggleSection}>
          {mision.recompensas_sugeridas?.descripcion ? (
            <p className="text-xs text-foreground/80">{mision.recompensas_sugeridas.descripcion}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin recompensas definidas</p>
          )}
        </SectionCard>

        {/* NOTAS DM */}
        <EditableFieldCard title="Notas para el DM" icon={BookOpen} sectionKey="notas_dm" expanded={expandedSections} toggle={toggleSection}
          value={mision.contenido} field="contenido"
          editingField={editingField} setEditingField={setEditingField}
          editValue={editValue} setEditValue={setEditValue}
          saving={savingField} onSave={saveField}
          canRegenerate regeneratingField={regeneratingField} onRegenerate={() => regenerateField("notas_dm")} />

        {/* SUBMISIONES */}
        <SectionCard title={`Submisiones (${submisiones.length})`} icon={Target} sectionKey="submisiones" expanded={expandedSections} toggle={toggleSection}>
          {submisiones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay submisiones aún</p>
          ) : (
            <div className="space-y-2">
              {submisiones.map(sub => (
                <button key={sub.id} onClick={() => navigate(`/mission/${sub.id}`)} className="w-full text-left ornate-border rounded-lg p-3 hover:border-gold/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-display text-sm text-gold truncate block">{sub.titulo || "Sin título"}</span>
                      {sub.tipo && <span className="text-xs text-muted-foreground capitalize">{sub.tipo}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ESTADO_BADGE[sub.estado]}`}>{sub.estado}</span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowCreateSub(true)} className="w-full mt-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors">
            <Plus size={16} /> Añadir Submisión
          </button>
        </SectionCard>

        {/* ESCENAS */}
        <SectionCard title={`Escenas (${scenes.length})`} icon={Theater} sectionKey="escenas" expanded={expandedSections} toggle={toggleSection}>
          {scenes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay escenas asociadas</p>
          ) : (
            <div className="space-y-2">
              {scenes.map((scene: any) => (
                <div key={scene.id} className="ornate-border rounded-lg p-3">
                  <span className="text-sm text-foreground">{scene.titulo}</span>
                  <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                    {scene.tipo && <span className="capitalize">{scene.tipo}</span>}
                    {scene.localizacion && <><span>·</span><span>{scene.localizacion}</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate(`/scene-generator?missionId=${mision.id}`)} className="w-full mt-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors">
            <Theater size={16} /> Generar Escena
          </button>
        </SectionCard>

        {/* ENCUENTROS */}
        <SectionCard title={`Encuentros (${encounters.length})`} icon={Swords} sectionKey="encuentros" expanded={expandedSections} toggle={toggleSection}>
          {encounters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay encuentros vinculados</p>
          ) : (
            <div className="space-y-2">
              {encounters.map(enc => {
                const firstLine = enc.texto_completo_editable?.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 80) || "Encuentro";
                return (
                  <div key={enc.id} className="ornate-border rounded-lg p-3">
                    <span className="text-sm text-foreground">{firstLine}</span>
                    <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{DIFF_LABELS[enc.dificultad] || `Dif. ${enc.dificultad}`}</span>
                      <span>·</span>
                      <span>Nivel {enc.nivel_grupo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => navigate(`/encounter-generator?missionId=${mision.id}`)} className="w-full mt-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors">
            <Swords size={16} /> Generar Encuentro
          </button>
        </SectionCard>

        {/* RELACIONADAS */}
        <SectionCard title={`Relacionadas (${linkedMisions.length})`} icon={Link2} sectionKey="relacionadas" expanded={expandedSections} toggle={toggleSection}>
          {linkedMisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay misiones relacionadas</p>
          ) : (
            <div className="space-y-2">
              {linkedMisions.map(lm => (
                <button key={lm.id} onClick={() => navigate(`/mission/${lm.id}`)} className="w-full text-left ornate-border rounded-lg p-3 hover:border-gold/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-foreground">{lm.titulo || "Sin título"}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ESTADO_BADGE[lm.estado]}`}>{lm.estado}</span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </main>

      {/* FAB */}
      <button onClick={() => setShowCreateSub(true)}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-gold-dark transition-colors z-50"
        title="Nueva Submisión">
        <Plus size={24} />
      </button>

      <CreateMissionDialog
        open={showCreateSub}
        onClose={() => setShowCreateSub(false)}
        onCreated={() => fetchSubmisiones()}
        parentId={mision.id}
        parentTitle={displayTitle}
      />
    </div>
  );
};

// Reusable collapsible section card
const SectionCard = ({
  title, icon: Icon, sectionKey, expanded, toggle, children,
}: {
  title: string; icon: React.ElementType; sectionKey: string; expanded: Record<string, boolean>; toggle: (key: string) => void; children: React.ReactNode;
}) => (
  <div className="ornate-border rounded-lg parchment-bg overflow-hidden">
    <button onClick={() => toggle(sectionKey)} className="w-full flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-gold" />
        <span className="font-display text-sm text-foreground">{title}</span>
      </div>
      {expanded[sectionKey] ? <ChevronDown size={18} className="text-muted-foreground" /> : <ChevronRight size={18} className="text-muted-foreground" />}
    </button>
    <AnimatePresence>
      {expanded[sectionKey] && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

// Editable text field card with optional regeneration
const EditableFieldCard = ({
  title, icon, sectionKey, expanded, toggle, value, field,
  editingField, setEditingField, editValue, setEditValue, saving, onSave,
  canRegenerate, regeneratingField, onRegenerate,
}: {
  title: string; icon: React.ElementType; sectionKey: string; expanded: Record<string, boolean>; toggle: (key: string) => void;
  value: string | null; field: string;
  editingField: string | null; setEditingField: (f: string | null) => void;
  editValue: string; setEditValue: (v: string) => void;
  saving: boolean; onSave: (field: string, value: string) => void;
  canRegenerate?: boolean; regeneratingField?: string | null; onRegenerate?: (field: string) => void;
}) => {
  const isEditing = editingField === field;
  const isRegenerating = regeneratingField === field;
  return (
    <SectionCard title={title} icon={icon} sectionKey={sectionKey} expanded={expanded} toggle={toggle}>
      {isEditing ? (
        <div className="space-y-2">
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={5}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:border-gold transition-colors resize-y" />
          <div className="flex gap-2">
            <button onClick={() => setEditingField(null)} className="flex-1 border border-border text-foreground text-xs py-2.5 rounded-lg hover:bg-secondary transition-colors">Cancelar</button>
            <button onClick={() => onSave(field, editValue)} disabled={saving}
              className="flex-1 bg-primary text-primary-foreground text-xs py-2.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
            </button>
          </div>
        </div>
      ) : value ? (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => { setEditValue(value); setEditingField(field); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors">
              <Pencil size={12} /> Editar
            </button>
            {canRegenerate && onRegenerate && (
              <button onClick={() => onRegenerate(field)} disabled={!!regeneratingField}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors disabled:opacity-50">
                {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Regenerar
              </button>
            )}
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{value}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">Sin contenido.</p>
          <button onClick={() => { setEditValue(""); setEditingField(field); }} className="text-xs text-gold hover:underline">Añadir</button>
          {canRegenerate && onRegenerate && (
            <button onClick={() => onRegenerate(field)} disabled={!!regeneratingField}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold transition-colors disabled:opacity-50">
              {isRegenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Generar
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
};

export default MissionDetail;
