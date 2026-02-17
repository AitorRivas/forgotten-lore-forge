import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Swords, Loader2, Save, Pencil, Eye, Users, Shield,
  Skull, Flame, Zap, Target, MapPin, RefreshCw, X, Link2, Plus, Trash2,
  ChevronDown, BookOpen, Mountain, Bug, BarChart3, Star, Sparkles, Brain, ScrollText, Settings2,
  Check, Scale,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const [revalidating, setRevalidating] = useState(false);
  const [encounter, setEncounter] = useState<any>(null);
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [validationResult, setValidationResult] = useState<string | null>(null);
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

  // Section definitions for collapsible display
  const SECTION_DEFS: { key: string; pattern: RegExp; label: string; icon: React.ElementType; defaultOpen?: boolean }[] = [
    { key: "resumen", pattern: /^##\s*📊\s*Resumen del Encuentro/m, label: "Resumen del Encuentro", icon: BarChart3, defaultOpen: true },
    { key: "analisis", pattern: /^##\s*👥\s*Análisis del Grupo/m, label: "Contexto Narrativo", icon: BookOpen, defaultOpen: true },
    { key: "escenario", pattern: /^##\s*🗺️\s*Descripción del Escenario/m, label: "Terreno", icon: Mountain },
    { key: "criaturas", pattern: /^##\s*🐉\s*Criaturas del Encuentro/m, label: "Criaturas", icon: Bug, defaultOpen: true },
    { key: "equilibrio", pattern: /^##\s*⚖️\s*Validación de Equilibrio/m, label: "Estadísticas de CR / XP Total", icon: Target },
    { key: "habilidades", pattern: /habilidades especiales/im, label: "Habilidades", icon: Star },
    { key: "hechizos", pattern: /hechizos/im, label: "Hechizos", icon: Sparkles },
    { key: "rasgos", pattern: /rasgos especiales/im, label: "Rasgos Especiales", icon: ScrollText },
    { key: "estrategia", pattern: /^##\s*🎯\s*Estrategia Táctica/m, label: "Estrategia del Enemigo", icon: Brain },
    { key: "plan", pattern: /Plan de los 3 Primeros Asaltos/m, label: "Plan Táctico (3 Asaltos)", icon: Swords },
    { key: "ajuste", pattern: /Ajustes recomendados/im, label: "Ajuste de Dificultad", icon: Settings2 },
    { key: "recompensas", pattern: /^##\s*💰\s*Recompensas/m, label: "Recompensas", icon: Shield },
    { key: "notas", pattern: /^##\s*📝\s*Notas del DM/m, label: "Notas del DM", icon: Pencil },
  ];

  const parseEncounterSections = useCallback((md: string) => {
    if (!md) return [];

    // Find all ## headings and split by them
    const headingRegex = /^(## .+)$/gm;
    const matches: { heading: string; start: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(md)) !== null) {
      matches.push({ heading: m[1], start: m.index });
    }

    if (matches.length === 0) {
      return [{ key: "full", label: "Encuentro Completo", icon: Swords, content: md, defaultOpen: true }];
    }

    // Extract title (everything before first ##)
    const titleContent = md.slice(0, matches[0].start).trim();
    const sections: { key: string; label: string; icon: React.ElementType; content: string; defaultOpen?: boolean }[] = [];

    if (titleContent) {
      sections.push({ key: "titulo", label: "Título", icon: Swords, content: titleContent, defaultOpen: true });
    }

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].start;
      const end = i + 1 < matches.length ? matches[i + 1].start : md.length;
      const sectionContent = md.slice(start, end).trim();
      const heading = matches[i].heading;

      // Try to match to a known section
      const matched = SECTION_DEFS.find((s) => s.pattern.test(heading));
      if (matched) {
        sections.push({
          key: matched.key,
          label: matched.label,
          icon: matched.icon,
          content: sectionContent,
          defaultOpen: matched.defaultOpen,
        });
      } else {
        // Fallback: use heading text as label
        const cleanLabel = heading.replace(/^##\s*/, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
        sections.push({
          key: `section-${i}`,
          label: cleanLabel || `Sección ${i + 1}`,
          icon: ScrollText,
          content: sectionContent,
        });
      }
    }

    return sections;
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Initialize open sections when encounter changes
  useEffect(() => {
    if (encounter) {
      const sections = parseEncounterSections(encounter);
      const initial: Record<string, boolean> = {};
      sections.forEach((s) => { initial[s.key] = s.defaultOpen ?? false; });
      setOpenSections(initial);
    }
  }, [encounter, parseEncounterSections]);

  const generateEncounter = useCallback(async () => {
    setGenerating(true);
    setEncounter(null);
    setEditMode(false);
    setSavedEncounterId(null);
    setValidationResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      const body = {
        partyMembers: partyMembers.map((m) => ({ className: m.className, level: m.level })),
        partySize: partyMembers.length,
        avgLevel,
        difficulty: difficultyLevel,
        difficultyLabel: DIFFICULTY_LABELS[difficultyLevel].label,
        region,
        encounterTheme: encounterTheme || undefined,
        specificRequest: specificRequest || undefined,
        campaignId: selectedCampaignId || undefined,
        userId: user?.id,
      };

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-encounter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error generando encuentro");
      }

      const data = await resp.json();
      setEncounter(data.encounter_markdown);
      toast.success("¡Encuentro generado!");
    } catch (e: any) {
      toast.error(e.message || "Error generando encuentro");
    } finally {
      setGenerating(false);
    }
  }, [region, partyMembers, avgLevel, difficultyLevel, encounterTheme, specificRequest, selectedCampaignId]);

  const saveEncounter = useCallback(async () => {
    if (!encounter) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión para guardar");

      const content = editMode ? editedContent : encounter;
      const diffLabel = DIFFICULTY_LABELS[difficultyLevel].label;

      if (savedEncounterId) {
        // Update existing record
        const { error } = await supabase.from("encounters" as any).update({
          texto_completo_editable: content,
          nivel_grupo: avgLevel,
          numero_personajes: partyMembers.length,
          dificultad: difficultyLevel,
          tags: [region, diffLabel, encounterTheme].filter(Boolean),
        } as any).eq("id", savedEncounterId);
        if (error) throw error;

        // Apply edits to the live encounter view
        if (editMode) {
          setEncounter(editedContent);
          setEditMode(false);
        }
        toast.success("¡Cambios guardados!");
      } else {
        // Insert new record
        const { data, error } = await supabase.from("encounters" as any).insert({
          user_id: user.id,
          campaign_id: selectedCampaignId || null,
          tipo: "encuentro",
          nivel_grupo: avgLevel,
          numero_personajes: partyMembers.length,
          dificultad: difficultyLevel,
          criaturas_json: partyMembers.map((m) => ({ className: m.className, level: m.level })),
          estrategia_json: { theme: encounterTheme || null, region, specificRequest: specificRequest || null },
          texto_completo_editable: content,
          xp_total: 0,
          tags: [region, diffLabel, encounterTheme].filter(Boolean),
        } as any).select("id").single();
        if (error) throw error;
        setSavedEncounterId((data as any)?.id || null);

        if (editMode) {
          setEncounter(editedContent);
          setEditMode(false);
        }
        toast.success(
          selectedCampaignId
            ? "¡Encuentro guardado y vinculado a la campaña!"
            : "¡Encuentro guardado en tu biblioteca!"
        );
      }
    } catch (e: any) {
      toast.error(e.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }, [encounter, editMode, editedContent, selectedCampaignId, avgLevel, partyMembers, difficultyLevel, region, encounterTheme, specificRequest, savedEncounterId]);

  const revalidateBalance = useCallback(async () => {
    const content = editMode ? editedContent : encounter;
    if (!content) return;
    setRevalidating(true);
    setValidationResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revalidate-encounter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            encounterText: content,
            partyMembers: partyMembers.map((m) => ({ className: m.className, level: m.level })),
            avgLevel,
            partySize: partyMembers.length,
            difficulty: difficultyLevel,
            difficultyLabel: DIFFICULTY_LABELS[difficultyLevel].label,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error revalidando");
      }
      const data = await resp.json();
      setValidationResult(data.validation_markdown);
      toast.success("Revalidación completada");
    } catch (e: any) {
      toast.error(e.message || "Error revalidando equilibrio");
    } finally {
      setRevalidating(false);
    }
  }, [encounter, editMode, editedContent, partyMembers, avgLevel, difficultyLevel]);

  const markdownContent = encounter || "";

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
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    onClick={generateEncounter}
                    disabled={generating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-accent border border-border rounded text-sm text-foreground hover:border-gold/50 transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Regenerar Encuentro
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(!editMode);
                      if (!editMode) setEditedContent(markdownContent);
                    }}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm transition-colors border ${
                      editMode
                        ? "bg-gold/20 text-gold border-gold/40"
                        : "border-border text-foreground hover:border-gold/50"
                    }`}
                  >
                    <Pencil size={14} /> Editar Manualmente
                  </button>
                  <button
                    onClick={revalidateBalance}
                    disabled={revalidating || generating}
                    className="flex items-center gap-1.5 px-4 py-2 border border-border rounded text-sm text-foreground hover:border-gold/50 transition-colors disabled:opacity-50"
                  >
                    {revalidating ? <Loader2 size={14} className="animate-spin" /> : <Scale size={14} />}
                    {revalidating ? "Revalidando..." : "Revalidar Equilibrio"}
                  </button>
                  <button
                    onClick={saveEncounter}
                    disabled={saving || generating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-display hover:bg-gold-dark transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? "Guardando..." : savedEncounterId ? "Actualizar" : "Guardar en Biblioteca"}
                  </button>
                  <button
                    onClick={() => { setEncounter(null); setEditMode(false); setSavedEncounterId(null); setValidationResult(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={14} /> Descartar
                  </button>
                </div>

                {/* Edit mode */}
                {editMode ? (
                  <div className="ornate-border rounded-lg p-6 parchment-bg">
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full min-h-[600px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y"
                    />
                  </div>
                ) : (
                  /* Collapsible sections */
                  <div className="space-y-2">
                    {parseEncounterSections(markdownContent).map((section) => {
                      const Icon = section.icon;
                      const isOpen = openSections[section.key] ?? section.defaultOpen ?? false;
                      return (
                        <Collapsible
                          key={section.key}
                          open={isOpen}
                          onOpenChange={() => toggleSection(section.key)}
                        >
                          <CollapsibleTrigger asChild>
                            <button className="w-full ornate-border rounded-lg parchment-bg px-5 py-3 flex items-center justify-between hover:border-gold/50 transition-all group">
                              <div className="flex items-center gap-3">
                                <Icon size={18} className="text-gold" />
                                <span className="font-display text-sm text-foreground group-hover:text-gold transition-colors">
                                  {section.label}
                                </span>
                              </div>
                              <ChevronDown
                                size={16}
                                className={`text-muted-foreground transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ornate-border rounded-b-lg border-t-0 px-5 py-4 parchment-bg -mt-1">
                              <div className="prose-fantasy text-sm">
                                <ReactMarkdown>{section.content}</ReactMarkdown>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}

                {/* Validation result panel */}
                {validationResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ornate-border rounded-lg p-6 parchment-bg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-lg text-gold flex items-center gap-2">
                        <Scale size={18} /> Resultado de Revalidación
                      </h3>
                      <button
                        onClick={() => setValidationResult(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="prose-fantasy text-sm">
                      <ReactMarkdown>{validationResult}</ReactMarkdown>
                    </div>
                  </motion.div>
                )}

                {/* Saved indicator */}
                {savedEncounterId && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                    <Check size={12} className="text-green-400" />
                    <span>Guardado en biblioteca</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="ornate-border rounded-lg p-16 parchment-bg text-center">
                <Swords className="mx-auto mb-4 text-gold" size={48} />
                <h3 className="font-display text-xl text-foreground mb-2">
                  Generador de Encuentros
                </h3>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Configura tu grupo, elige la dificultad y genera un encuentro táctico
                  con criaturas oficiales, estrategia detallada y validación de equilibrio para D&D 5e.
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
