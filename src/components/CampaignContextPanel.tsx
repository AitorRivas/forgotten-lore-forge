import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  MapPin, Users, Swords, BookOpen, AlertTriangle,
  MessageSquare, Scroll, Brain, Target, ChevronDown, ChevronRight, Plus, X, Save
} from "lucide-react";

interface NarrativeContext {
  summary: string;
  chapters: string[];
  important_events: string[];
  known_antagonists: string[];
  active_npcs: string[];
  party_decisions: string[];
  open_conflicts: string[];
  narrative_memory: string[];
  regions_explored: string[];
  loot_given: string[];
  plot_hooks_pending: string[];
}

interface CampaignData {
  id: string;
  region: string | null;
  tone: string | null;
  current_act: number | null;
  narrative_context: NarrativeContext;
}

interface Props {
  campaign: CampaignData;
  onUpdated: () => void;
}

const SECTIONS = [
  { key: "summary", label: "Resumen General", icon: BookOpen, type: "text" as const },
  { key: "chapters", label: "Capítulos", icon: Scroll, type: "list" as const },
  { key: "important_events", label: "Eventos Importantes", icon: Target, type: "list" as const },
  { key: "known_antagonists", label: "Antagonistas Conocidos", icon: Swords, type: "list" as const },
  { key: "active_npcs", label: "PNJs Activos", icon: Users, type: "list" as const },
  { key: "party_decisions", label: "Decisiones del Grupo", icon: MessageSquare, type: "list" as const },
  { key: "open_conflicts", label: "Conflictos Abiertos", icon: AlertTriangle, type: "list" as const },
  { key: "narrative_memory", label: "Memoria Narrativa", icon: Brain, type: "list" as const },
  { key: "regions_explored", label: "Regiones Exploradas", icon: MapPin, type: "list" as const },
  { key: "plot_hooks_pending", label: "Ganchos Pendientes", icon: Target, type: "list" as const },
] as const;

const CampaignContextPanel = ({ campaign, onUpdated }: Props) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [region, setRegion] = useState(campaign.region || "");
  const [tone, setTone] = useState(campaign.tone || "épico");
  const [currentAct, setCurrentAct] = useState(campaign.current_act || 1);
  const [ctx, setCtx] = useState<NarrativeContext>(campaign.narrative_context || {
    summary: "", chapters: [], important_events: [], known_antagonists: [],
    active_npcs: [], party_decisions: [], open_conflicts: [],
    narrative_memory: [], regions_explored: [], loot_given: [], plot_hooks_pending: [],
  });
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleSection = (key: string) => {
    setExpanded(expanded === key ? null : key);
  };

  const addItem = (key: string) => {
    if (!newItem.trim()) return;
    const updated = { ...ctx, [key]: [...(ctx[key as keyof NarrativeContext] as string[] || []), newItem.trim()] };
    setCtx(updated);
    setNewItem("");
  };

  const removeItem = (key: string, index: number) => {
    const arr = [...(ctx[key as keyof NarrativeContext] as string[])];
    arr.splice(index, 1);
    setCtx({ ...ctx, [key]: arr });
  };

  const saveAll = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("campaigns")
      .update({
        region: region || null,
        tone,
        current_act: currentAct,
        narrative_context: JSON.parse(JSON.stringify(ctx)),
      })
      .eq("id", campaign.id);

    if (error) {
      toast.error("Error guardando contexto");
    } else {
      toast.success("Contexto actualizado");
      onUpdated();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-muted-foreground uppercase tracking-wider">
          Contexto de Campaña
        </h3>
        <button
          onClick={saveAll}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors disabled:opacity-50"
        >
          <Save size={12} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {/* Campaign Meta */}
      <div className="ornate-border rounded-lg p-3 parchment-bg">
        <button
          onClick={() => setEditingMeta(!editingMeta)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="font-display text-xs text-gold">Datos de Campaña</span>
          {editingMeta ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
        </button>
        {editingMeta && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Región Principal</label>
              <input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ej: Costa de la Espada"
                className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tono</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors mt-0.5"
              >
                <option value="épico">Épico</option>
                <option value="oscuro">Oscuro</option>
                <option value="misterioso">Misterioso</option>
                <option value="cómico">Cómico</option>
                <option value="político">Político</option>
                <option value="exploración">Exploración</option>
                <option value="horror">Horror</option>
                <option value="bélico">Bélico</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Acto Actual</label>
              <input
                type="number"
                value={currentAct}
                onChange={(e) => setCurrentAct(parseInt(e.target.value) || 1)}
                min={1}
                max={10}
                className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors mt-0.5"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Narrative Sections */}
      {SECTIONS.map((section) => {
        const isExpanded = expanded === section.key;
        const Icon = section.icon;
        const value = ctx[section.key as keyof NarrativeContext];
        const itemCount = section.type === "list" ? (value as string[])?.length || 0 : (value ? 1 : 0);

        return (
          <div key={section.key} className="ornate-border rounded-lg p-3 parchment-bg">
            <button
              onClick={() => toggleSection(section.key)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Icon size={13} className="text-gold" />
                <span className="font-display text-xs text-foreground">{section.label}</span>
                {itemCount > 0 && (
                  <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
                    {itemCount}
                  </span>
                )}
              </div>
              {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>

            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="mt-2"
              >
                {section.type === "text" ? (
                  <textarea
                    value={(value as string) || ""}
                    onChange={(e) => setCtx({ ...ctx, [section.key]: e.target.value })}
                    placeholder="Describe el resumen general de la campaña..."
                    rows={3}
                    className="w-full bg-secondary border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                ) : (
                  <div className="space-y-1.5">
                    {(value as string[])?.map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5 group">
                        <span className="text-xs text-foreground flex-1 leading-relaxed">{item}</span>
                        <button
                          onClick={() => removeItem(section.key, i)}
                          className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-1.5 mt-1">
                      <input
                        value={expanded === section.key ? newItem : ""}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addItem(section.key)}
                        placeholder="Añadir..."
                        className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:border-gold transition-colors"
                      />
                      <button
                        onClick={() => addItem(section.key)}
                        className="text-gold hover:text-gold-light transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CampaignContextPanel;
