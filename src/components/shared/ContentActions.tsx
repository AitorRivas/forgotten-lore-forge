import { Pencil, Eye, RefreshCw, Save, X, Loader2, Info } from "lucide-react";

interface ContentActionsProps {
  editMode: boolean;
  onToggleEdit: () => void;
  onRegenerate: () => void;
  onSave: () => void;
  onDiscard: () => void;
  saving: boolean;
  generating: boolean;
  savedId?: string | null;
  providerType?: "primary" | "alternative" | null;
  /** Extra actions to render */
  extraActions?: React.ReactNode;
}

const ContentActions = ({
  editMode, onToggleEdit, onRegenerate, onSave, onDiscard,
  saving, generating, savedId, providerType, extraActions,
}: ContentActionsProps) => (
  <div className="space-y-2">
    {providerType === "alternative" && (
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-1.5 w-fit">
        <Info size={12} /><span>Generado con proveedor alternativo</span>
      </div>
    )}
    <div className="flex flex-wrap gap-2 justify-end">
      <button onClick={onToggleEdit}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors border ${editMode ? "bg-gold/20 text-gold border-gold/40" : "border-border text-foreground hover:border-gold/40"}`}>
        {editMode ? <><Eye size={13} /> Vista</> : <><Pencil size={13} /> Editar</>}
      </button>
      <button onClick={onRegenerate} disabled={generating}
        className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-foreground hover:border-gold/40 transition-colors disabled:opacity-50">
        {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerar
      </button>
      {extraActions}
      <button onClick={onSave} disabled={saving || generating}
        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-display hover:bg-gold-dark transition-colors disabled:opacity-50">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
        {saving ? "Guardando…" : savedId ? "Guardado ✓" : "Guardar"}
      </button>
      <button onClick={onDiscard}
        className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
        <X size={13} /> Descartar
      </button>
    </div>
  </div>
);

export default ContentActions;
