import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, BookOpen, Search, Scroll, Theater, Swords, Users,
  ChevronDown, ChevronRight, Filter, Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type ContentType = "misiones" | "escenas" | "encounters" | "npcs";

interface LibraryItem {
  id: string;
  type: ContentType;
  title: string;
  subtitle?: string;
  content?: string;
  tags: string[];
  level?: string;
  location?: string;
  created_at: string;
}

const TAB_CONFIG: { type: ContentType; label: string; icon: React.ElementType }[] = [
  { type: "misiones", label: "Misiones", icon: Scroll },
  { type: "escenas", label: "Escenas", icon: Theater },
  { type: "encounters", label: "Encuentros", icon: Swords },
  { type: "npcs", label: "PNJ", icon: Users },
];

const Library = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ContentType>("misiones");
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchItems(); }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    setExpandedId(null);
    try {
      let mapped: LibraryItem[] = [];

      if (activeTab === "misiones") {
        const { data } = await supabase.from("misiones").select("*").order("updated_at", { ascending: false });
        mapped = (data || []).map((m: any) => ({
          id: m.id, type: "misiones" as const, title: m.titulo, subtitle: m.descripcion,
          content: m.contenido, tags: m.tags || [], level: m.nivel_recomendado,
          location: undefined, created_at: m.created_at,
        }));
      } else if (activeTab === "escenas") {
        const { data } = await supabase.from("escenas" as any).select("*").order("created_at", { ascending: false });
        mapped = (data || []).map((s: any) => ({
          id: s.id, type: "escenas" as const, title: s.titulo, subtitle: s.tipo,
          content: s.descripcion_narrativa, tags: s.tags || [], level: s.nivel_recomendado,
          location: s.localizacion, created_at: s.created_at,
        }));
      } else if (activeTab === "encounters") {
        const { data } = await supabase.from("encounters").select("*").order("created_at", { ascending: false });
        mapped = (data || []).map((e: any) => ({
          id: e.id, type: "encounters" as const,
          title: e.texto_completo_editable?.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 80) || "Encuentro",
          subtitle: `Dificultad ${e.dificultad} · Nivel ${e.nivel_grupo}`,
          content: e.texto_completo_editable, tags: e.tags || [], level: String(e.nivel_grupo),
          location: undefined, created_at: e.created_at,
        }));
      } else if (activeTab === "npcs") {
        const { data } = await supabase.from("npcs" as any).select("*").order("created_at", { ascending: false });
        mapped = (data || []).map((n: any) => ({
          id: n.id, type: "npcs" as const, title: n.nombre, subtitle: [n.rol, n.importancia].filter(Boolean).join(" · "),
          content: n.contenido_completo, tags: n.tags || [], level: n.nivel,
          location: n.localizacion, created_at: n.created_at,
        }));
      }

      setItems(mapped);
    } catch {
      toast.error("Error cargando biblioteca");
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (item: LibraryItem) => {
    if (!confirm("¿Eliminar este elemento?")) return;
    const { error } = await supabase.from(item.type as any).delete().eq("id", item.id);
    if (error) { toast.error("Error eliminando"); return; }
    toast.success("Eliminado");
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    if (expandedId === item.id) setExpandedId(null);
  };

  const filtered = items.filter((i) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return i.title.toLowerCase().includes(q) || i.tags.some((t) => t.toLowerCase().includes(q)) || i.location?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground p-1">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-display text-lg sm:text-2xl text-gold text-glow flex items-center gap-2">
            <BookOpen size={20} /> Biblioteca
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {TAB_CONFIG.map(({ type, label, icon: Icon }) => (
            <button key={type} onClick={() => setActiveTab(type)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-display shrink-0 transition-colors ${
                activeTab === type ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, tag o localización..."
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold transition-colors" />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16"><div className="animate-flicker text-gold text-lg">Cargando...</div></div>
        ) : filtered.length === 0 ? (
          <div className="ornate-border rounded-lg p-12 parchment-bg text-center">
            <BookOpen className="mx-auto mb-3 text-gold" size={40} />
            <h3 className="font-display text-lg text-foreground mb-1">Sin resultados</h3>
            <p className="text-muted-foreground text-sm">Genera contenido para llenarte la biblioteca</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <div key={item.id} className="ornate-border rounded-lg parchment-bg overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full text-left p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-display text-sm text-gold block truncate">{item.title}</span>
                      {item.subtitle && <span className="text-xs text-muted-foreground">{item.subtitle}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.level && <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">Nv {item.level}</span>}
                      {expandedId === item.id ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                    </div>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  )}
                </button>

                <AnimatePresence>
                  {expandedId === item.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                        {item.content && (
                          <div className="prose-fantasy text-sm max-h-[400px] overflow-y-auto">
                            <ReactMarkdown>{item.content}</ReactMarkdown>
                          </div>
                        )}
                        <div className="flex gap-2">
                          {item.type === "misiones" && (
                            <button onClick={() => navigate(`/mission/${item.id}`)}
                              className="flex-1 bg-primary text-primary-foreground font-display py-2.5 rounded-lg text-sm hover:bg-gold-dark transition-colors">
                              Ver Misión
                            </button>
                          )}
                          <button onClick={() => deleteItem(item)}
                            className="flex items-center gap-1.5 px-3 py-2.5 border border-border rounded-lg text-xs text-destructive hover:border-destructive/50 transition-colors">
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;
