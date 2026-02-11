import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, AlertTriangle, Users, Search, Clock, Landmark,
  Eye, EyeOff, Compass, ChevronDown, ChevronRight, Loader2, Zap
} from "lucide-react";

interface ConflictItem {
  name: string;
  status: string;
  parties_involved: string[];
  stakes: string;
  next_likely_development: string;
}

interface ThreatItem {
  threat: string;
  severity: string;
  source: string;
  timeline: string;
  signs: string;
}

interface RelationshipItem {
  between: string[];
  nature: string;
  current_state: string;
  potential_shift: string;
}

interface ClueItem {
  clue: string;
  origin: string;
  possible_leads: string;
  urgency: string;
}

interface ConsequenceItem {
  action: string;
  consequence: string;
  timing: string;
  severity: string;
}

interface PoliticalItem {
  faction1: string;
  faction2: string;
  issue: string;
  powder_keg: string;
}

interface SecretItem {
  secret: string;
  impact?: string;
  who_knows?: string;
  holder?: string;
  revelation_trigger?: string;
  narrative_impact?: string;
}

interface NarrativeMomentum {
  dominant_theme: string;
  emotional_arc: string;
  recommended_next_beat: string;
  pacing_suggestion: string;
}

export interface CampaignAnalysis {
  active_conflicts: ConflictItem[];
  growing_threats: ThreatItem[];
  key_relationships: RelationshipItem[];
  unresolved_clues: ClueItem[];
  pending_consequences: ConsequenceItem[];
  political_tensions: PoliticalItem[];
  secrets: { revealed: SecretItem[]; hidden: SecretItem[] };
  narrative_momentum: NarrativeMomentum;
  dm_summary: string;
}

interface Props {
  analysis: CampaignAnalysis | null;
  loading: boolean;
  onAnalyze: () => void;
}

const severityColor: Record<string, string> = {
  baja: "text-green-400",
  media: "text-yellow-400",
  alta: "text-orange-400",
  crítica: "text-red-400",
  menor: "text-green-400",
  moderada: "text-yellow-400",
  mayor: "text-red-400",
};

const statusBadge: Record<string, string> = {
  activo: "bg-red-900/40 text-red-300",
  escalando: "bg-orange-900/40 text-orange-300",
  latente: "bg-yellow-900/40 text-yellow-300",
};

const Section = ({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="ornate-border rounded-lg parchment-bg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-gold" />
          <span className="font-display text-xs text-foreground">{title}</span>
          {count > 0 && (
            <span className="text-xs bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">
              {count}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CampaignAnalysisPanel = ({ analysis, loading, onAnalyze }: Props) => {
  if (!analysis) {
    return (
      <div className="ornate-border rounded-lg p-6 parchment-bg text-center">
        <Compass className="mx-auto mb-3 text-gold" size={32} />
        <h3 className="font-display text-sm text-foreground mb-2">
          Análisis Narrativo
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Analiza los eventos previos para extraer conflictos, amenazas, pistas y más.
        </p>
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="flex items-center justify-center gap-2 mx-auto bg-primary text-primary-foreground font-display text-sm py-2 px-4 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Zap size={14} />
          )}
          {loading ? "Analizando..." : "Analizar Campaña"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm text-muted-foreground uppercase tracking-wider">
          Análisis Narrativo
        </h3>
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gold hover:text-gold-light transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {loading ? "Analizando..." : "Reanalizar"}
        </button>
      </div>

      {/* DM Summary */}
      {analysis.dm_summary && (
        <div className="ornate-border rounded-lg p-3 parchment-bg border-gold/30">
          <div className="flex items-center gap-2 mb-2">
            <Compass size={13} className="text-gold" />
            <span className="font-display text-xs text-gold">Resumen para el DM</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{analysis.dm_summary}</p>
        </div>
      )}

      {/* Narrative Momentum */}
      {analysis.narrative_momentum && (
        <div className="ornate-border rounded-lg p-3 parchment-bg">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-gold" />
            <span className="font-display text-xs text-gold">Momentum Narrativo</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div><span className="text-muted-foreground">Tema dominante:</span> <span className="text-foreground">{analysis.narrative_momentum.dominant_theme}</span></div>
            <div><span className="text-muted-foreground">Arco emocional:</span> <span className="text-foreground">{analysis.narrative_momentum.emotional_arc}</span></div>
            <div><span className="text-muted-foreground">Siguiente beat:</span> <span className="text-foreground">{analysis.narrative_momentum.recommended_next_beat}</span></div>
            <div><span className="text-muted-foreground">Ritmo sugerido:</span> <span className="text-foreground">{analysis.narrative_momentum.pacing_suggestion}</span></div>
          </div>
        </div>
      )}

      {/* Active Conflicts */}
      <Section title="Conflictos Activos" icon={Swords} count={analysis.active_conflicts?.length || 0}>
        <div className="space-y-2">
          {analysis.active_conflicts?.map((c, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-display text-foreground">{c.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadge[c.status] || "bg-secondary text-muted-foreground"}`}>
                  {c.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">En juego: {c.stakes}</p>
              <p className="text-[11px] text-muted-foreground">Partes: {c.parties_involved?.join(", ")}</p>
              <p className="text-[11px] text-foreground/70">→ {c.next_likely_development}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Growing Threats */}
      <Section title="Amenazas Crecientes" icon={AlertTriangle} count={analysis.growing_threats?.length || 0}>
        <div className="space-y-2">
          {analysis.growing_threats?.map((t, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground">{t.threat}</span>
                <span className={`text-[10px] font-bold ${severityColor[t.severity] || "text-muted-foreground"}`}>
                  {t.severity?.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Origen: {t.source} · {t.timeline}</p>
              <p className="text-[11px] text-foreground/70">Señales: {t.signs}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Key Relationships */}
      <Section title="Relaciones Clave" icon={Users} count={analysis.key_relationships?.length || 0}>
        <div className="space-y-2">
          {analysis.key_relationships?.map((r, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <span className="text-xs text-foreground">{r.between?.join(" ↔ ")}</span>
              <p className="text-[11px] text-muted-foreground">Tipo: {r.nature} · {r.current_state}</p>
              <p className="text-[11px] text-foreground/70">Podría: {r.potential_shift}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Unresolved Clues */}
      <Section title="Pistas sin Resolver" icon={Search} count={analysis.unresolved_clues?.length || 0}>
        <div className="space-y-2">
          {analysis.unresolved_clues?.map((c, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground">{c.clue}</span>
                <span className={`text-[10px] font-bold ${severityColor[c.urgency] || "text-muted-foreground"}`}>
                  {c.urgency}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Origen: {c.origin}</p>
              <p className="text-[11px] text-foreground/70">Lleva a: {c.possible_leads}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Pending Consequences */}
      <Section title="Consecuencias Pendientes" icon={Clock} count={analysis.pending_consequences?.length || 0}>
        <div className="space-y-2">
          {analysis.pending_consequences?.map((c, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <span className="text-xs text-foreground">{c.action}</span>
              <p className="text-[11px] text-muted-foreground">→ {c.consequence}</p>
              <p className="text-[11px] text-foreground/70">{c.timing} · <span className={severityColor[c.severity] || ""}>{c.severity}</span></p>
            </div>
          ))}
        </div>
      </Section>

      {/* Political Tensions */}
      <Section title="Tensiones Políticas" icon={Landmark} count={analysis.political_tensions?.length || 0}>
        <div className="space-y-2">
          {analysis.political_tensions?.map((p, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <span className="text-xs text-foreground">{p.faction1} vs {p.faction2}</span>
              <p className="text-[11px] text-muted-foreground">Causa: {p.issue}</p>
              <p className="text-[11px] text-foreground/70">Polvorín: {p.powder_keg}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Secrets */}
      <Section
        title="Secretos Revelados"
        icon={Eye}
        count={analysis.secrets?.revealed?.length || 0}
      >
        <div className="space-y-2">
          {analysis.secrets?.revealed?.map((s, i) => (
            <div key={i} className="border-l-2 border-gold/30 pl-2 space-y-0.5">
              <span className="text-xs text-foreground">{s.secret}</span>
              <p className="text-[11px] text-muted-foreground">Impacto: {s.impact}</p>
              <p className="text-[11px] text-foreground/70">Lo saben: {s.who_knows}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Secretos Ocultos"
        icon={EyeOff}
        count={analysis.secrets?.hidden?.length || 0}
      >
        <div className="space-y-2">
          {analysis.secrets?.hidden?.map((s, i) => (
            <div key={i} className="border-l-2 border-red-900/30 pl-2 space-y-0.5">
              <span className="text-xs text-foreground">{s.secret}</span>
              <p className="text-[11px] text-muted-foreground">Guardián: {s.holder}</p>
              <p className="text-[11px] text-muted-foreground">Detonante: {s.revelation_trigger}</p>
              <p className="text-[11px] text-foreground/70">Si se revela: {s.narrative_impact}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default CampaignAnalysisPanel;
