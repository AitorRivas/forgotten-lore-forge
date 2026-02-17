import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronRight, ChevronDown, Swords, Target, Plus,
  Link2, Pencil, Save, Loader2, Scroll, Check, Archive, Trash2,
} from "lucide-react";
import CreateMissionDialog from "@/components/CreateMissionDialog";

interface Mision {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string | null;
  estado: string;
  nivel_recomendado: string | null;
  tags: string[];
  mission_parent_id: string | null;
  linked_missions_ids: string[];
  contenido: string | null;
  metadata: any;
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
  titulo: string;
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

const MissionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mision, setMision] = useState<Mision | null>(null);
  const [submisiones, setSubmisiones] = useState<Mision[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [linkedMisions, setLinkedMisions] = useState<LinkedMision[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; titulo: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSub, setShowCreateSub] = useState(false);

  // Expandable sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    info: true,
    submisiones: true,
    encuentros: false,
    relacionadas: false,
  });

  const toggleSection = (key: string) =>
    setExpandedSections((p) => ({ ...p, [key]: !p[key] }));

  useEffect(() => {
    if (id) {
      fetchAll();
    }
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchMision(), fetchSubmisiones(), fetchEncounters()]);
    setLoading(false);
  };

  const fetchMision = async () => {
    const { data, error } = await supabase
      .from("misiones")
      .select("*")
      .eq("id", id!)
      .single();

    if (error || !data) {
      toast.error("Misión no encontrada");
      navigate("/dashboard");
      return;
    }

    const m = data as any;
    setMision({ ...m, tags: m.tags || [], linked_missions_ids: m.linked_missions_ids || [] });

    // Build breadcrumb
    const crumbs: { id: string; titulo: string }[] = [];
    let currentParentId = m.mission_parent_id;
    while (currentParentId) {
      const { data: parent } = await supabase
        .from("misiones")
        .select("id, titulo, mission_parent_id")
        .eq("id", currentParentId)
        .single();
      if (!parent) break;
      crumbs.unshift({ id: parent.id, titulo: parent.titulo });
      currentParentId = parent.mission_parent_id;
    }
    setBreadcrumb(crumbs);

    // Fetch linked missions
    if (m.linked_missions_ids?.length > 0) {
      const { data: linked } = await supabase
        .from("misiones")
        .select("id, titulo, estado")
        .in("id", m.linked_missions_ids);
      setLinkedMisions((linked as LinkedMision[]) || []);
    } else {
      setLinkedMisions([]);
    }
  };

  const fetchSubmisiones = async () => {
    const { data } = await supabase
      .from("misiones")
      .select("*")
      .eq("mission_parent_id", id!)
      .order("created_at", { ascending: true });

    setSubmisiones(
      (data || []).map((m: any) => ({
        ...m,
        tags: m.tags || [],
        linked_missions_ids: m.linked_missions_ids || [],
      }))
    );
  };

  const fetchEncounters = async () => {
    const { data } = await supabase
      .from("encounters")
      .select("id, texto_completo_editable, tipo, dificultad, nivel_grupo, created_at")
      .eq("mission_id", id!)
      .order("created_at", { ascending: false });

    setEncounters((data as Encounter[]) || []);
  };

  const updateEstado = async (newEstado: string) => {
    if (!mision) return;
    const { error } = await supabase
      .from("misiones")
      .update({ estado: newEstado })
      .eq("id", mision.id);

    if (error) {
      toast.error("Error actualizando estado");
    } else {
      toast.success(`Misión marcada como ${newEstado}`);
      setMision({ ...mision, estado: newEstado });
    }
  };

  const deleteMision = async () => {
    if (!mision) return;
    if (!confirm("¿Eliminar esta misión y todas sus submisiones?")) return;
    const { error } = await supabase
      .from("misiones")
      .delete()
      .eq("id", mision.id);
    if (error) {
      toast.error("Error eliminando misión");
    } else {
      toast.success("Misión eliminada");
      if (mision.mission_parent_id) {
        navigate(`/mission/${mision.mission_parent_id}`);
      } else {
        navigate("/dashboard");
      }
    }
  };

  if (loading || !mision) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-flicker text-gold text-xl font-display">Descifrando pergaminos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header with breadcrumb */}
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 overflow-x-auto">
            <button onClick={() => navigate("/dashboard")} className="hover:text-gold shrink-0">
              Inicio
            </button>
            {breadcrumb.map((crumb) => (
              <span key={crumb.id} className="flex items-center gap-1.5 shrink-0">
                <ChevronRight size={12} />
                <button onClick={() => navigate(`/mission/${crumb.id}`)} className="hover:text-gold truncate max-w-[120px]">
                  {crumb.titulo}
                </button>
              </span>
            ))}
            <ChevronRight size={12} className="shrink-0" />
            <span className="text-foreground truncate">{mision.titulo}</span>
          </div>

          {/* Back + title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (mision.mission_parent_id) {
                  navigate(`/mission/${mision.mission_parent_id}`);
                } else {
                  navigate("/dashboard");
                }
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="font-display text-lg sm:text-xl text-gold text-glow truncate">
              {mision.titulo}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* SECTION: Info Principal */}
        <SectionCard
          title="Información"
          icon={Scroll}
          open={expandedSections.info}
          onToggle={() => toggleSection("info")}
        >
          {mision.descripcion && (
            <p className="text-sm text-foreground mb-4">{mision.descripcion}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded capitalize ${ESTADO_BADGE[mision.estado] || "bg-secondary text-muted-foreground"}`}>
              {mision.estado}
            </span>
            {mision.nivel_recomendado && (
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">
                Nivel {mision.nivel_recomendado}
              </span>
            )}
            {mision.tipo && (
              <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded capitalize">
                {mision.tipo}
              </span>
            )}
          </div>

          {mision.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {mision.tags.map((tag) => (
                <span key={tag} className="text-xs bg-secondary/70 text-muted-foreground px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {mision.estado !== "completada" && (
              <button
                onClick={() => updateEstado("completada")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:border-green-500/50 transition-colors"
              >
                <Check size={14} /> Completar
              </button>
            )}
            {mision.estado !== "archivada" && (
              <button
                onClick={() => updateEstado("archivada")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:border-muted-foreground/50 transition-colors"
              >
                <Archive size={14} /> Archivar
              </button>
            )}
            {mision.estado !== "activa" && (
              <button
                onClick={() => updateEstado("activa")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border hover:border-gold/50 transition-colors"
              >
                <Target size={14} /> Reactivar
              </button>
            )}
            <button
              onClick={deleteMision}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border text-destructive hover:border-destructive/50 transition-colors ml-auto"
            >
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        </SectionCard>

        {/* SECTION: Submisiones */}
        <SectionCard
          title={`Submisiones (${submisiones.length})`}
          icon={Target}
          open={expandedSections.submisiones}
          onToggle={() => toggleSection("submisiones")}
        >
          {submisiones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay submisiones aún</p>
          ) : (
            <div className="space-y-2">
              {submisiones.map((sub, i) => (
                <button
                  key={sub.id}
                  onClick={() => navigate(`/mission/${sub.id}`)}
                  className="w-full text-left ornate-border rounded-lg p-3 hover:border-gold/50 transition-colors"
                  style={{ marginLeft: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <span className="font-display text-sm text-gold truncate block">{sub.titulo}</span>
                      {sub.descripcion && (
                        <span className="text-xs text-muted-foreground line-clamp-1">{sub.descripcion}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ESTADO_BADGE[sub.estado]}`}>
                        {sub.estado}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowCreateSub(true)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
          >
            <Plus size={16} /> Añadir Submisión
          </button>
        </SectionCard>

        {/* SECTION: Encuentros */}
        <SectionCard
          title={`Encuentros (${encounters.length})`}
          icon={Swords}
          open={expandedSections.encuentros}
          onToggle={() => toggleSection("encuentros")}
        >
          {encounters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay encuentros vinculados</p>
          ) : (
            <div className="space-y-2">
              {encounters.map((enc) => {
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
          <button
            onClick={() => navigate(`/encounter-generator?missionId=${mision.id}`)}
            className="w-full mt-3 flex items-center justify-center gap-2 border border-dashed border-border rounded-lg py-3 text-sm text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
          >
            <Swords size={16} /> Generar Encuentro
          </button>
        </SectionCard>

        {/* SECTION: Misiones Relacionadas */}
        <SectionCard
          title={`Relacionadas (${linkedMisions.length})`}
          icon={Link2}
          open={expandedSections.relacionadas}
          onToggle={() => toggleSection("relacionadas")}
        >
          {linkedMisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay misiones relacionadas</p>
          ) : (
            <div className="space-y-2">
              {linkedMisions.map((lm) => (
                <button
                  key={lm.id}
                  onClick={() => navigate(`/mission/${lm.id}`)}
                  className="w-full text-left ornate-border rounded-lg p-3 hover:border-gold/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm text-foreground">{lm.titulo}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${ESTADO_BADGE[lm.estado]}`}>
                        {lm.estado}
                      </span>
                      <ChevronRight size={16} className="text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>
      </main>

      {/* FAB for new submission */}
      <button
        onClick={() => setShowCreateSub(true)}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-gold-dark transition-colors z-50"
        title="Nueva Submisión"
      >
        <Plus size={24} />
      </button>

      <CreateMissionDialog
        open={showCreateSub}
        onClose={() => setShowCreateSub(false)}
        onCreated={() => {
          fetchSubmisiones();
        }}
        parentId={mision.id}
        parentTitle={mision.titulo}
      />
    </div>
  );
};

// Reusable collapsible section card
const SectionCard = ({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="ornate-border rounded-lg parchment-bg overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center justify-between p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-gold" />
        <span className="font-display text-sm text-foreground">{title}</span>
      </div>
      {open ? (
        <ChevronDown size={18} className="text-muted-foreground" />
      ) : (
        <ChevronRight size={18} className="text-muted-foreground" />
      )}
    </button>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="px-4 pb-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default MissionDetail;
