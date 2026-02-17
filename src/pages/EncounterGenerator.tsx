import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Swords, Loader2, Save, Pencil, Eye, Users, Shield,
  Skull, Flame, Zap, Target, MapPin, RefreshCw, X, Link2, Plus, Trash2,
} from "lucide-react";

type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

interface PartyMember {
  id: string;
  className: string;
  level: number;
}

interface Campaign {
  id: string;
  name: string;
}

const CLASSES_5E = [
  "Bárbaro", "Bardo", "Clérigo", "Druida", "Explorador", "Guerrero",
  "Hechicero", "Mago", "Monje", "Paladín", "Pícaro", "Brujo", "Artífice",
];

const DIFFICULTY_LABELS: Record<DifficultyLevel, { label: string; color: string }> = {
  1: { label: "Fácil", color: "text-green-400" },
  2: { label: "Moderado", color: "text-yellow-400" },
  3: { label: "Desafiante", color: "text-amber-400" },
  4: { label: "Difícil", color: "text-orange-400" },
  5: { label: "Mortal", color: "text-red-400" },
};

const EncounterGenerator = () => {
  const navigate = useNavigate();

  // Party composition
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([
    { id: crypto.randomUUID(), className: "Guerrero", level: 5 },
  ]);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(3);
  const [encounterTheme, setEncounterTheme] = useState("");
  const [specificRequest, setSpecificRequest] = useState("");
  const [region, setRegion] = useState("Costa de la Espada");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");

  // UI state
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [encounter, setEncounter] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  const avgLevel = partyMembers.length
    ? Math.round(partyMembers.reduce((sum, m) => sum + m.level, 0) / partyMembers.length * 10) / 10
    : 0;

  const addMember = () => {
    setPartyMembers((prev) => [...prev, { id: crypto.randomUUID(), className: "Guerrero", level: Math.round(avgLevel) || 1 }]);
  };

  const removeMember = (id: string) => {
    if (partyMembers.length <= 1) return;
    setPartyMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMember = (id: string, field: keyof Omit<PartyMember, "id">, value: string | number) => {
    setPartyMembers((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  };

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase.from("campaigns").select("id, name").order("name");
      if (data) setCampaigns(data);
    };
    fetchCampaigns();
  }, []);

  const formatEncounterMarkdown = (enc: any): string => {
    if (!enc || enc.parse_error) return enc?.raw || "Error al parsear el encuentro.";

    let md = `# ⚔️ ${enc.title || "Encuentro"}\n\n`;
    md += `**Tipo:** ${enc.encounter_type || "Híbrido"}\n\n`;

    if (enc.context) {
      md += `## 📍 Contexto\n`;
      md += `- **Situación:** ${enc.context.situation || ""}\n`;
      md += `- **Ubicación:** ${enc.context.location || ""}\n`;
      md += `- **En juego:** ${enc.context.stakes || ""}\n`;
      md += `- **Presión temporal:** ${enc.context.time_pressure || "none"}\n`;
      md += `- **¿Por qué ahora?:** ${enc.context.why_now || ""}\n\n`;
    }

    if (enc.narrative_tension) {
      md += `## 🎭 Tensión Narrativa\n`;
      md += `- **Tensión inicial:** ${enc.narrative_tension.opening_tension || ""}\n`;
      if (enc.narrative_tension.escalation_triggers?.length) {
        md += `- **Detonantes de escalada:**\n`;
        enc.narrative_tension.escalation_triggers.forEach((t: string) => { md += `  - ${t}\n`; });
      }
      if (enc.narrative_tension.deescalation_options?.length) {
        md += `- **Opciones de desescalada:**\n`;
        enc.narrative_tension.deescalation_options.forEach((o: string) => { md += `  - ${o}\n`; });
      }
      md += `- **Punto sin retorno:** ${enc.narrative_tension.point_of_no_return || ""}\n\n`;
    }

    if (enc.involved_parties?.length) {
      md += `## 👥 Partes Involucradas\n`;
      enc.involved_parties.forEach((p: any) => {
        md += `### ${p.name}\n`;
        md += `- **Motivación:** ${p.motivation || ""}\n`;
        md += `- **Disposición:** ${p.disposition || ""}\n`;
        md += `- **Capacidad de combate:** ${p.combat_capability || ""}\n`;
        md += `- **Punto de ruptura:** ${p.breaking_point || ""}\n\n`;
      });
    }

    if (enc.combat_scenario) {
      md += `## ⚔️ Escenario de Combate\n`;
      if (enc.combat_scenario.enemies?.length) {
        md += `### Enemigos\n`;
        enc.combat_scenario.enemies.forEach((e: any) => {
          md += `- **${e.name}** (CR ${e.cr}) — Táctica: ${e.tactics || ""}, Moral: ${e.morale_break || ""}\n`;
        });
        md += `\n`;
      }
      if (enc.combat_scenario.terrain_features?.length) {
        md += `**Terreno:** ${enc.combat_scenario.terrain_features.join(", ")}\n`;
      }
      if (enc.combat_scenario.environmental_hazards?.length) {
        md += `**Peligros ambientales:** ${enc.combat_scenario.environmental_hazards.join(", ")}\n`;
      }
      if (enc.combat_scenario.victory_conditions?.length) {
        md += `**Condiciones de victoria:** ${enc.combat_scenario.victory_conditions.join(", ")}\n`;
      }
      md += `\n`;
    }

    if (enc.social_options?.length) {
      md += `## 🗣️ Opciones Sociales\n`;
      enc.social_options.forEach((s: any) => {
        md += `### ${s.approach}\n`;
        md += `- **Habilidades clave:** ${s.key_skills?.join(", ") || ""}\n`;
        md += `- **Éxito:** ${s.success_outcome || ""}\n`;
        md += `- **Éxito parcial:** ${s.partial_success || ""}\n`;
        md += `- **Fallo:** ${s.failure_consequence || ""}\n\n`;
      });
    }

    if (enc.stealth_option) {
      md += `## 🥷 Opción Sigilosa\n`;
      md += `- **Enfoque:** ${enc.stealth_option.approach || ""}\n`;
      md += `- **Detección:** ${enc.stealth_option.detection_consequences || ""}\n`;
      md += `- **Éxito:** ${enc.stealth_option.success_outcome || ""}\n\n`;
    }

    if (enc.consequences_by_approach) {
      md += `## 📊 Consecuencias por Enfoque\n`;
      const approaches: Record<string, string> = {
        full_combat: "Combate total",
        full_diplomacy: "Diplomacia total",
        stealth_resolution: "Sigilo",
        mixed_approach: "Enfoque mixto",
      };
      Object.entries(approaches).forEach(([key, label]) => {
        const c = enc.consequences_by_approach[key];
        if (c) {
          md += `### ${label}\n`;
          md += `- **Inmediato:** ${c.immediate || ""}\n`;
          md += `- **Reputación:** ${c.reputation_impact || ""}\n`;
          md += `- **Campaña:** ${c.campaign_impact || ""}\n\n`;
        }
      });
    }

    if (enc.dm_notes) md += `## 📝 Notas del DM\n${enc.dm_notes}\n\n`;
    if (enc.summary) md += `---\n*${enc.summary}*\n`;

    return md;
  };

  const generateEncounter = useCallback(async () => {
    setGenerating(true);
    setEncounter(null);
    setEditMode(false);

    try {
      const partyDesc = partyMembers.map((m) => `${m.className} nivel ${m.level}`).join(", ");
      const diffLabel = DIFFICULTY_LABELS[difficultyLevel].label;
      const body = {
        region,
        tone: "épico",
        partyLevel: `Grupo: ${partyDesc}. Nivel promedio ${avgLevel}, ${partyMembers.length} jugadores, dificultad ${diffLabel}`,
        encounterTheme: encounterTheme || undefined,
        specificRequest: specificRequest || undefined,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-hybrid-encounter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error generando encuentro");
      }

      const data = await resp.json();
      setEncounter(data.encounter);
      toast.success("¡Encuentro generado!");
    } catch (e: any) {
      toast.error(e.message || "Error generando encuentro");
    } finally {
      setGenerating(false);
    }
  }, [region, partyMembers, avgLevel, difficultyLevel, encounterTheme, specificRequest]);

  const saveEncounter = useCallback(async () => {
    if (!encounter) return;
    setSaving(true);
    try {
      const content = editMode ? editedContent : formatEncounterMarkdown(encounter);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/format-and-store`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            content,
            content_type: "encounter",
            campaign_id: selectedCampaignId || undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error guardando encuentro");
      }

      toast.success(
        selectedCampaignId
          ? "¡Encuentro guardado y vinculado a la campaña!"
          : "¡Encuentro guardado en tu biblioteca!"
      );
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [encounter, editMode, editedContent, selectedCampaignId]);

  const markdownContent = encounter ? formatEncounterMarkdown(encounter) : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-display text-2xl text-gold text-glow flex items-center gap-2">
              <Swords size={24} /> Generador de Encuentros
            </h1>
            <p className="text-sm text-muted-foreground">
              Crea encuentros híbridos personalizados para D&D 5e
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Form */}
          <div className="lg:col-span-1 space-y-5">
            {/* Party composition */}
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold flex items-center gap-2 mb-4">
                <Users size={18} /> Grupo de Jugadores
              </h3>

              <div className="space-y-3">
                {partyMembers.map((member, idx) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <select
                      value={member.className}
                      onChange={(e) => updateMember(member.id, "className", e.target.value)}
                      className="flex-1 bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
                    >
                      {CLASSES_5E.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={member.level}
                      onChange={(e) => updateMember(member.id, "level", Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      className="w-16 bg-secondary border border-border rounded px-2 py-1.5 text-sm text-foreground text-center focus:outline-none focus:border-gold transition-colors"
                    />
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={partyMembers.length <= 1}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addMember}
                  className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border rounded py-2 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors"
                >
                  <Plus size={14} /> Añadir personaje
                </button>
              </div>

              {/* Summary */}
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{partyMembers.length}</strong> personaje{partyMembers.length !== 1 ? "s" : ""}
                </span>
                <span className="text-muted-foreground">
                  Nivel promedio: <strong className="text-gold">{avgLevel}</strong>
                </span>
              </div>

              {/* Region */}
              <div className="mt-4">
                <label className="text-sm text-muted-foreground block mb-1">Región</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="Costa de la Espada"
                  className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            {/* Difficulty scale 1-5 */}
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold flex items-center gap-2 mb-4">
                <Zap size={18} /> Dificultad
              </h3>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((lvl) => {
                  const { label, color } = DIFFICULTY_LABELS[lvl];
                  return (
                    <button
                      key={lvl}
                      onClick={() => setDifficultyLevel(lvl)}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded border transition-all ${
                        difficultyLevel === lvl
                          ? "border-gold/60 bg-secondary"
                          : "border-border hover:border-gold/30"
                      }`}
                    >
                      <span className={`font-display text-lg ${color}`}>{lvl}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Seleccionado: <strong className={DIFFICULTY_LABELS[difficultyLevel].color}>{DIFFICULTY_LABELS[difficultyLevel].label}</strong>
              </p>
            </div>

            {/* Theme & details */}
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold flex items-center gap-2 mb-4">
                <MapPin size={18} /> Detalles del Encuentro
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Tema (opcional)</label>
                  <input
                    type="text"
                    value={encounterTheme}
                    onChange={(e) => setEncounterTheme(e.target.value)}
                    placeholder="Ej: emboscada, negociación, misterio"
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Petición específica (opcional)</label>
                  <textarea
                    value={specificRequest}
                    onChange={(e) => setSpecificRequest(e.target.value)}
                    placeholder="Describe lo que quieres en este encuentro..."
                    rows={3}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Campaign link */}
            <div className="ornate-border rounded-lg p-5 parchment-bg">
              <h3 className="font-display text-lg text-gold flex items-center gap-2 mb-3">
                <Link2 size={18} /> Vincular a Campaña
              </h3>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors"
              >
                <option value="">Sin vincular (biblioteca general)</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Generate button */}
            <button
              onClick={generateEncounter}
              disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3 rounded hover:bg-gold-dark transition-colors disabled:opacity-50 text-lg"
            >
              {generating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Swords size={20} />
              )}
              {generating ? "Creando encuentro..." : "Crear Encuentro"}
            </button>
          </div>

          {/* Right panel - Results */}
          <div className="lg:col-span-2">
            {encounter ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="ornate-border rounded-lg p-6 parchment-bg">
                  {/* Toolbar */}
                  <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditMode(false)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${
                          !editMode ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Eye size={13} /> Vista
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(true);
                          setEditedContent(markdownContent);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-display transition-colors ${
                          editMode ? "bg-gold/20 text-gold border border-gold/40" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Pencil size={13} /> Editar
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={generateEncounter}
                        disabled={generating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent border border-border rounded text-xs text-foreground hover:border-gold/50 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={13} /> Regenerar
                      </button>
                      <button
                        onClick={() => {
                          setEncounter(null);
                          setEditMode(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={13} /> Descartar
                      </button>
                      <button
                        onClick={saveEncounter}
                        disabled={saving || generating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? "Guardando..." : "Guardar en Biblioteca"}
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  {editMode ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full min-h-[600px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y"
                    />
                  ) : (
                    <div className="prose-fantasy">
                      <ReactMarkdown>{markdownContent}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="ornate-border rounded-lg p-16 parchment-bg text-center">
                <Swords className="mx-auto mb-4 text-gold" size={48} />
                <h3 className="font-display text-xl text-foreground mb-2">
                  Generador de Encuentros
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Configura tu grupo, elige la dificultad y genera un encuentro híbrido
                  con combate, diplomacia e investigación para D&D 5e.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EncounterGenerator;
