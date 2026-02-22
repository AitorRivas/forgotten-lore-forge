import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { faerunLocations } from "@/data/faerun-locations";
import { toast } from "sonner";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Swords, Loader2, Save, Pencil, Eye, Users,
  Zap, MapPin, RefreshCw, X, Link2, Plus, Trash2,
  ChevronDown, BookOpen, Mountain, Bug, BarChart3, Star, Sparkles, Brain, ScrollText,
  Check, Scale, Info, AlertTriangle, Target, Skull, Flame,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import PageHeader from "@/components/shared/PageHeader";
import GenerationStatus from "@/components/shared/GenerationStatus";
import FormField from "@/components/shared/FormField";

type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

interface PartyMember {
  id: string;
  className: string;
  level: number;
}

interface MisionOption {
  id: string;
  titulo: string;
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
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([
    { id: crypto.randomUUID(), className: "Guerrero", level: 5 },
  ]);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>(3);
  const [encounterTheme, setEncounterTheme] = useState("");
  const [specificRequest, setSpecificRequest] = useState("");
  const [region, setRegion] = useState("Costa de la Espada");
  const [selectedMissionId, setSelectedMissionId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mId = params.get("missionId");
    if (mId) setSelectedMissionId(mId);
  }, []);

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [encounter, setEncounter] = useState<any>(null);
  const [savedEncounterId, setSavedEncounterId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [validationResult, setValidationResult] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<"primary" | "alternative" | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [misiones, setMisiones] = useState<MisionOption[]>([]);

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
    const fetchMisiones = async () => {
      const { data } = await supabase.from("misiones").select("id, titulo").order("titulo");
      if (data) setMisiones(data);
    };
    fetchMisiones();
  }, []);

  const regionOptions = useMemo(() => faerunLocations.map((loc) => loc.region_mayor), []);

  const SECTION_DEFS: { key: string; pattern: RegExp; label: string; icon: React.ElementType; defaultOpen?: boolean }[] = [
    { key: "resumen", pattern: /^##\s*📊\s*Resumen del Encuentro/m, label: "Resumen del Encuentro", icon: BarChart3, defaultOpen: true },
    { key: "tactico", pattern: /^##\s*🎯\s*Resumen Táctico/m, label: "Resumen Táctico", icon: Target, defaultOpen: true },
    { key: "analisis", pattern: /^##\s*👥\s*Análisis del Grupo/m, label: "Análisis del Grupo", icon: BookOpen, defaultOpen: true },
    { key: "criaturas", pattern: /^##\s*🐉\s*Criaturas del Encuentro/m, label: "Criaturas", icon: Bug, defaultOpen: true },
    { key: "equilibrio", pattern: /^##\s*⚖️\s*Validación de Equilibrio/m, label: "Validación de Equilibrio", icon: Scale },
    { key: "estrategia", pattern: /^##\s*🎯\s*Estrategia Táctica por Fases/m, label: "Estrategia por Fases", icon: Brain, defaultOpen: true },
    { key: "inicio", pattern: /^###\s*⚡\s*Inicio del Combate/m, label: "Fase: Inicio (Asaltos 1-2)", icon: Zap },
    { key: "medio", pattern: /^###\s*🔄\s*Punto Medio/m, label: "Fase: Punto Medio (Asaltos 3-4)", icon: RefreshCw },
    { key: "ganando", pattern: /^###\s*🏆\s*Si.*Ganando/m, label: "Fase: Enemigos Ganando", icon: Flame },
    { key: "perdiendo", pattern: /^###\s*💀\s*Si.*Perdiendo/m, label: "Fase: Enemigos Perdiendo", icon: Skull },
    { key: "escenario", pattern: /^##\s*🗺️\s*Descripción del Escenario/m, label: "Escenario", icon: Mountain },
    { key: "recompensas", pattern: /^##\s*💰\s*Recompensas/m, label: "Recompensas", icon: Star },
    { key: "notas", pattern: /^##\s*📝\s*Notas del DM/m, label: "Notas del DM", icon: Pencil },
  ];

  const parseEncounterSections = useCallback((md: string) => {
    if (!md) return [];
    const headingRegex = /^(## .+)$/gm;
    const matches: { heading: string; start: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = headingRegex.exec(md)) !== null) {
      matches.push({ heading: m[1], start: m.index });
    }
    if (matches.length === 0) {
      return [{ key: "full", label: "Encuentro Completo", icon: Swords, content: md, defaultOpen: true }];
    }
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
      const matched = SECTION_DEFS.find((s) => s.pattern.test(heading));
      if (matched) {
        sections.push({ key: matched.key, label: matched.label, icon: matched.icon, content: sectionContent, defaultOpen: matched.defaultOpen });
      } else {
        const cleanLabel = heading.replace(/^##\s*/, "").replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
        sections.push({ key: `section-${i}`, label: cleanLabel || `Sección ${i + 1}`, icon: ScrollText, content: sectionContent });
      }
    }
    return sections;
  }, []);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) => { setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })); };

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
    setProviderType(null);
    setServiceUnavailable(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();

      const body = {
        partyMembers: partyMembers.map((m) => ({ className: m.className, level: m.level })),
        partySize: partyMembers.length, avgLevel, difficulty: difficultyLevel,
        difficultyLabel: DIFFICULTY_LABELS[difficultyLevel].label,
        region, encounterTheme: encounterTheme || undefined,
        specificRequest: specificRequest || undefined,
        missionId: selectedMissionId || undefined, userId: user?.id,
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
      setProviderType(data.provider || "primary");
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      setServiceUnavailable(true);
      console.error("Encounter generation error:", e.message);
    } finally {
      setGenerating(false);
    }
  }, [region, partyMembers, avgLevel, difficultyLevel, encounterTheme, specificRequest, selectedMissionId]);

  const saveEncounter = useCallback(async () => {
    if (!encounter) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Debes iniciar sesión para guardar");
      const content = editMode ? editedContent : encounter;
      const diffLabel = DIFFICULTY_LABELS[difficultyLevel].label;

      if (savedEncounterId) {
        const { error } = await supabase.from("encounters" as any).update({
          texto_completo_editable: content, nivel_grupo: avgLevel,
          numero_personajes: partyMembers.length, dificultad: difficultyLevel,
          tags: [region, diffLabel, encounterTheme].filter(Boolean),
        } as any).eq("id", savedEncounterId);
        if (error) throw error;
        if (editMode) { setEncounter(editedContent); setEditMode(false); }
        toast.success("Contenido generado con éxito");
      } else {
        const { data, error } = await supabase.from("encounters" as any).insert({
          user_id: user.id, mission_id: selectedMissionId || null, tipo: "encuentro",
          nivel_grupo: avgLevel, numero_personajes: partyMembers.length, dificultad: difficultyLevel,
          criaturas_json: partyMembers.map((m) => ({ className: m.className, level: m.level })),
          estrategia_json: { theme: encounterTheme || null, region, specificRequest: specificRequest || null },
          texto_completo_editable: content, xp_total: 0,
          tags: [region, diffLabel, encounterTheme].filter(Boolean),
        } as any).select("id").single();
        if (error) throw error;
        setSavedEncounterId((data as any)?.id || null);
        if (editMode) { setEncounter(editedContent); setEditMode(false); }
        toast.success("Contenido generado con éxito");
      }
    } catch (e: any) {
      toast.error("Se ha producido un error. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [encounter, editMode, editedContent, selectedMissionId, avgLevel, partyMembers, difficultyLevel, region, encounterTheme, specificRequest, savedEncounterId]);

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
            avgLevel, partySize: partyMembers.length,
            difficulty: difficultyLevel, difficultyLabel: DIFFICULTY_LABELS[difficultyLevel].label,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Error revalidando");
      }
      const data = await resp.json();
      setValidationResult(data.validation_markdown);
      toast.success("Contenido generado con éxito");
    } catch (e: any) {
      toast.error("Se ha producido un error. Intenta de nuevo.");
    } finally {
      setRevalidating(false);
    }
  }, [encounter, editMode, editedContent, partyMembers, avgLevel, difficultyLevel]);

  const markdownContent = encounter || "";
  const inputClass = "w-full bg-secondary border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-gold transition-colors";

  return (
    <div className="min-h-screen bg-background pb-6">
      <PageHeader
        title="Generador de Encuentros"
        subtitle="Encuentros híbridos personalizados para D&D 5e"
        icon={Swords}
        backPath="/dashboard"
        breadcrumbs={[{ label: "Inicio", path: "/dashboard" }, { label: "Encuentros" }]}
      />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel - Form */}
          <div className="lg:col-span-1 space-y-5">
            {/* Party composition */}
            <div className="ornate-border rounded-lg p-4 parchment-bg">
              <h3 className="font-display text-base text-gold flex items-center gap-2 mb-4">
                <Users size={16} /> Grupo de Jugadores
              </h3>
              <div className="space-y-3">
                {partyMembers.map((member, idx) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                    <select value={member.className} onChange={(e) => updateMember(member.id, "className", e.target.value)} className={`flex-1 ${inputClass}`}>
                      {CLASSES_5E.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="number" min={1} max={20} value={member.level}
                      onChange={(e) => updateMember(member.id, "level", Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      className={`w-16 text-center ${inputClass}`} />
                    <button onClick={() => removeMember(member.id)} disabled={partyMembers.length <= 1}
                      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addMember}
                  className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border rounded py-2 text-xs text-muted-foreground hover:text-gold hover:border-gold/40 transition-colors">
                  <Plus size={14} /> Añadir personaje
                </button>
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-xs">
                <span className="text-muted-foreground"><strong className="text-foreground">{partyMembers.length}</strong> personaje{partyMembers.length !== 1 ? "s" : ""}</span>
                <span className="text-muted-foreground">Nivel promedio: <strong className="text-gold">{avgLevel}</strong></span>
              </div>
              <FormField label="Región" required>
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
                  {regionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </FormField>
            </div>

            {/* Difficulty */}
            <div className="ornate-border rounded-lg p-4 parchment-bg">
              <h3 className="font-display text-base text-gold flex items-center gap-2 mb-4">
                <Zap size={16} /> Dificultad<span className="text-gold ml-0.5">*</span>
              </h3>
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as DifficultyLevel[]).map((lvl) => {
                  const { label, color } = DIFFICULTY_LABELS[lvl];
                  return (
                    <button key={lvl} onClick={() => setDifficultyLevel(lvl)}
                      className={`flex-1 flex flex-col items-center gap-1 py-3 rounded border transition-all ${difficultyLevel === lvl ? "border-gold/60 bg-secondary" : "border-border hover:border-gold/30"}`}>
                      <span className={`font-display text-lg ${color}`}>{lvl}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            <div className="ornate-border rounded-lg p-4 parchment-bg space-y-3">
              <h3 className="font-display text-base text-gold flex items-center gap-2 mb-2">
                <MapPin size={16} /> Detalles
              </h3>
              <FormField label="Tema" hint="Ej: emboscada, negociación, misterio">
                <input type="text" value={encounterTheme} onChange={(e) => setEncounterTheme(e.target.value)}
                  placeholder="Ej: emboscada, negociación, misterio" className={inputClass} />
              </FormField>
              <FormField label="Petición específica" hint="Describe lo que quieres">
                <textarea value={specificRequest} onChange={(e) => setSpecificRequest(e.target.value)}
                  placeholder="Describe lo que quieres en este encuentro..." rows={3} className={`${inputClass} resize-none`} />
              </FormField>
            </div>

            {/* Mission link */}
            <div className="ornate-border rounded-lg p-4 parchment-bg">
              <FormField label="Vincular a Misión">
                <select value={selectedMissionId} onChange={(e) => setSelectedMissionId(e.target.value)} className={inputClass}>
                  <option value="">Sin vincular (biblioteca general)</option>
                  {misiones.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
                </select>
              </FormField>
            </div>

            {/* Generate button */}
            <button onClick={generateEncounter} disabled={generating}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-display py-3.5 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {generating ? "Generando contenido…" : "Generar Encuentro"}
            </button>
          </div>

          {/* Right panel - Results */}
          <div className="lg:col-span-2">
            {serviceUnavailable && !encounter ? (
              <GenerationStatus status="error" entityName="Encuentro" serviceUnavailable onRetry={generateEncounter} retrying={generating} />
            ) : encounter ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {providerType === "alternative" && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-1.5 w-fit">
                    <Info size={12} /><span>Generado con proveedor alternativo</span>
                  </div>
                )}
                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={generateEncounter} disabled={generating}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:border-gold/40 transition-colors disabled:opacity-50">
                    {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerar
                  </button>
                  <button onClick={() => { setEditMode(!editMode); if (!editMode) setEditedContent(markdownContent); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors border ${editMode ? "bg-gold/20 text-gold border-gold/40" : "border-border text-foreground hover:border-gold/40"}`}>
                    {editMode ? <><Eye size={13} /> Vista</> : <><Pencil size={13} /> Editar</>}
                  </button>
                  <button onClick={revalidateBalance} disabled={revalidating || generating}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:border-gold/40 transition-colors disabled:opacity-50">
                    {revalidating ? <Loader2 size={13} className="animate-spin" /> : <Scale size={13} />}
                    {revalidating ? "Revalidando…" : "Revalidar"}
                  </button>
                  <button onClick={saveEncounter} disabled={saving || generating}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {saving ? "Guardando…" : savedEncounterId ? "Guardado ✓" : "Guardar"}
                  </button>
                  <button onClick={() => { setEncounter(null); setEditMode(false); setSavedEncounterId(null); setValidationResult(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <X size={13} /> Descartar
                  </button>
                </div>

                {editMode ? (
                  <div className="ornate-border rounded-lg p-5 parchment-bg">
                    <textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full min-h-[600px] bg-secondary/50 border border-border rounded p-4 text-sm text-foreground font-mono leading-relaxed focus:outline-none focus:border-gold/50 transition-colors resize-y" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {parseEncounterSections(markdownContent).map((section) => {
                      const Icon = section.icon;
                      const isOpen = openSections[section.key] ?? section.defaultOpen ?? false;
                      return (
                        <Collapsible key={section.key} open={isOpen} onOpenChange={() => toggleSection(section.key)}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full ornate-border rounded-lg parchment-bg px-4 py-3 flex items-center justify-between hover:border-gold/50 transition-all group">
                              <div className="flex items-center gap-3">
                                <Icon size={16} className="text-gold" />
                                <span className="font-display text-sm text-foreground group-hover:text-gold transition-colors">{section.label}</span>
                              </div>
                              <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ornate-border rounded-b-lg border-t-0 px-4 py-4 parchment-bg -mt-1">
                              <div className="prose-fantasy text-sm"><ReactMarkdown>{section.content}</ReactMarkdown></div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}

                {validationResult && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="ornate-border rounded-lg p-5 parchment-bg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-base text-gold flex items-center gap-2"><Scale size={16} /> Resultado de Revalidación</h3>
                      <button onClick={() => setValidationResult(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
                    </div>
                    <div className="prose-fantasy text-sm"><ReactMarkdown>{validationResult}</ReactMarkdown></div>
                  </motion.div>
                )}

                {savedEncounterId && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                    <Check size={12} className="text-green-400" /><span>Guardado en biblioteca</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <GenerationStatus status="idle" entityName="Generador de Encuentros" idleIcon={Swords}
                idleDescription="Configura tu grupo, elige la dificultad y genera un encuentro táctico con criaturas oficiales, estrategia detallada y validación de equilibrio para D&D 5e." />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EncounterGenerator;
