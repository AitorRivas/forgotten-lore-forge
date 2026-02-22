import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Wand2, Swords, Scroll, ChevronDown, ChevronRight,
  Target, Users, Search, Theater, BookOpen, Gem,
} from "lucide-react";
import CreateMissionDialog from "@/components/CreateMissionDialog";
import ContextPanel from "@/components/ContextPanel";
import PageHeader from "@/components/shared/PageHeader";
import CreateButton from "@/components/shared/CreateButton";

interface Mision {
  id: string;
  titulo: string | null;
  descripcion: string | null;
  tipo: string | null;
  estado: string;
  nivel_recomendado: string | null;
  ubicacion_principal: string | null;
  tono: string | null;
  tags: string[];
  mission_parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface MisionWithCounts extends Mision {
  submisionCount: number;
  encounterCount: number;
}

const ESTADO_BADGE: Record<string, string> = {
  activa: "bg-green-900/40 text-green-300",
  completada: "bg-blue-900/40 text-blue-300",
  archivada: "bg-muted text-muted-foreground",
};

const MissionsDashboard = () => {
  const [misiones, setMisiones] = useState<MisionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [userId, setUserId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [showContextMobile, setShowContextMobile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
    fetchMisiones();
  }, []);

  const fetchMisiones = async () => {
    const { data: allMisiones, error } = await supabase
      .from("misiones").select("*").is("mission_parent_id", null).order("updated_at", { ascending: false });

    if (error) { toast.error("Se ha producido un error. Intenta de nuevo."); setLoading(false); return; }

    const enriched: MisionWithCounts[] = await Promise.all(
      (allMisiones || []).map(async (m: any) => {
        const { count: subCount } = await supabase.from("misiones").select("id", { count: "exact", head: true }).eq("mission_parent_id", m.id);
        const { count: encCount } = await supabase.from("encounters").select("id", { count: "exact", head: true }).eq("mission_id", m.id);
        return { ...m, tags: m.tags || [], submisionCount: subCount || 0, encounterCount: encCount || 0 };
      })
    );

    setMisiones(enriched);
    setLoading(false);
  };

  const filtered = misiones.filter((m) => {
    if (filterEstado !== "todas" && m.estado !== filterEstado) return false;
    if (searchQuery && !(m.titulo || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const navButtons = (
    <div className="flex items-center gap-1">
      <button onClick={() => navigate("/scene-generator")} className="text-gold hover:text-gold-light transition-colors p-2" title="Escenas"><Theater size={18} /></button>
      <button onClick={() => navigate("/encounter-generator")} className="text-gold hover:text-gold-light transition-colors p-2" title="Encuentros"><Swords size={18} /></button>
      <button onClick={() => navigate("/npc-generator")} className="text-gold hover:text-gold-light transition-colors p-2" title="PNJ"><Users size={18} /></button>
      <button onClick={() => navigate("/magic-item-generator")} className="text-gold hover:text-gold-light transition-colors p-2" title="Objetos"><Gem size={18} /></button>
      <button onClick={() => navigate("/generators")} className="text-gold hover:text-gold-light transition-colors p-2" title="Más"><Wand2 size={18} /></button>
      <button onClick={() => navigate("/library")} className="text-gold hover:text-gold-light transition-colors p-2" title="Biblioteca"><BookOpen size={18} /></button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <PageHeader title="Crónicas de Faerûn" showLogout rightContent={navButtons} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Context panel */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <button onClick={() => setShowContextMobile(!showContextMobile)}
              className="lg:hidden w-full flex items-center justify-between ornate-border rounded-lg p-3 parchment-bg mb-4">
              <span className="font-display text-sm text-gold">Biblioteca Personal</span>
              {showContextMobile ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            </button>
            <div className={`${showContextMobile ? "block" : "hidden"} lg:block`}>
              {userId && <ContextPanel userId={userId} />}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <div className="mb-6">
              <h2 className="font-display text-2xl sm:text-3xl text-foreground">Tus Misiones</h2>
              <p className="text-muted-foreground mt-1 text-sm">Gestiona tus aventuras en los Reinos Olvidados</p>
            </div>

            {/* Search and filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar misiones..." className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold transition-colors" />
              </div>
              <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}
                className="bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold transition-colors">
                <option value="todas">Todas</option>
                <option value="activa">Activas</option>
                <option value="completada">Completadas</option>
                <option value="archivada">Archivadas</option>
              </select>
            </div>

            {/* Mission list */}
            {loading ? (
              <div className="text-center text-muted-foreground py-20">
                <div className="animate-flicker text-gold text-xl">Consultando los archivos...</div>
              </div>
            ) : filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 ornate-border rounded-lg parchment-bg">
                <Scroll className="mx-auto mb-4 text-gold" size={48} />
                <h3 className="font-display text-xl text-foreground mb-2">
                  {misiones.length === 0 ? "No hay misiones registradas" : "Sin resultados"}
                </h3>
                <p className="text-muted-foreground mb-6 text-sm px-4">
                  {misiones.length === 0 ? "Comienza tu primera aventura en Faerûn" : "Prueba con otros filtros"}
                </p>
                {misiones.length === 0 && (
                  <button onClick={() => setShowCreate(true)}
                    className="bg-primary text-primary-foreground font-display px-6 py-3 rounded-lg hover:bg-gold-dark transition-colors text-base">
                    Crear Primera Misión
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="space-y-3">
                {filtered.map((mision, i) => (
                  <motion.div key={mision.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }} className="ornate-border rounded-lg parchment-bg overflow-hidden">
                    <button onClick={() => setExpandedId(expandedId === mision.id ? null : mision.id)} className="w-full text-left p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-base text-gold truncate">{mision.titulo || "Misión sin título"}</h3>
                          {mision.ubicacion_principal && <span className="text-xs text-muted-foreground">{mision.ubicacion_principal}</span>}
                          {mision.descripcion && <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{mision.descripcion}</p>}
                        </div>
                        {expandedId === mision.id ? <ChevronDown size={20} className="text-muted-foreground shrink-0 mt-1" /> : <ChevronRight size={20} className="text-muted-foreground shrink-0 mt-1" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`text-xs px-2 py-1 rounded capitalize ${ESTADO_BADGE[mision.estado] || "bg-secondary text-muted-foreground"}`}>{mision.estado}</span>
                        {mision.nivel_recomendado && <span className="text-xs bg-secondary text-muted-foreground px-2 py-1 rounded">Nivel {mision.nivel_recomendado}</span>}
                        {mision.submisionCount > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1"><Target size={12} /> {mision.submisionCount} sub</span>}
                        {mision.encounterCount > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1"><Swords size={12} /> {mision.encounterCount}</span>}
                      </div>
                    </button>
                    <AnimatePresence>
                      {expandedId === mision.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-3">
                            {mision.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {mision.tags.map((tag) => <span key={tag} className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded">{tag}</span>)}
                              </div>
                            )}
                            <button onClick={() => navigate(`/mission/${mision.id}`)}
                              className="w-full bg-primary text-primary-foreground font-display py-3 rounded-lg hover:bg-gold-dark transition-colors text-base">
                              Ver Misión
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <CreateButton label="Crear Misión" onClick={() => setShowCreate(true)} />

      <CreateMissionDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchMisiones} />
    </div>
  );
};

export default MissionsDashboard;
