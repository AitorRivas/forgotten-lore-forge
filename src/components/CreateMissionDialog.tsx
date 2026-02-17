import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, ChevronDown } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  parentId?: string;
  parentTitle?: string;
}

interface MisionOption {
  id: string;
  titulo: string;
}

const CreateMissionDialog = ({ open, onClose, onCreated, parentId, parentTitle }: Props) => {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [nivelRecomendado, setNivelRecomendado] = useState("1-5");
  const [tags, setTags] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(parentId || "");
  const [linkedMissions, setLinkedMissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [existingMissions, setExistingMissions] = useState<MisionOption[]>([]);

  useEffect(() => {
    if (open) {
      setSelectedParentId(parentId || "");
      fetchExistingMissions();
    }
  }, [open, parentId]);

  const fetchExistingMissions = async () => {
    const { data } = await supabase
      .from("misiones")
      .select("id, titulo")
      .order("titulo");
    if (data) setExistingMissions(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Debes iniciar sesión");
      setLoading(false);
      return;
    }

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const { error } = await supabase.from("misiones").insert({
      user_id: user.id,
      titulo,
      descripcion: descripcion || null,
      nivel_recomendado: nivelRecomendado,
      tags: tagArray,
      mission_parent_id: selectedParentId || null,
      linked_missions_ids: linkedMissions,
      estado: "activa",
      tipo: selectedParentId ? "submision" : "raiz",
    });

    if (error) {
      toast.error("Error creando misión");
    } else {
      toast.success("¡Misión creada!");
      setTitulo("");
      setDescripcion("");
      setNivelRecomendado("1-5");
      setTags("");
      setSelectedParentId("");
      setLinkedMissions([]);
      onCreated();
      onClose();
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="ornate-border rounded-t-2xl sm:rounded-lg parchment-bg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card/95 backdrop-blur-sm z-10 rounded-t-2xl sm:rounded-t-lg">
          <h2 className="font-display text-xl text-gold">Nueva Misión</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">
              Título
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Nombre de la misión..."
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe la premisa de esta misión..."
              rows={3}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors resize-none"
            />
          </div>

          {/* Vincular como submisión */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">
              Submisión de (opcional)
            </label>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
              className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors"
            >
              <option value="">Misión raíz (independiente)</option>
              {existingMissions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
          </div>

          {/* Misiones relacionadas */}
          <div>
            <label className="block text-sm font-display text-gold-light mb-1.5">
              Misiones relacionadas (opcional)
            </label>
            <div className="space-y-2">
              {existingMissions
                .filter((m) => m.id !== selectedParentId)
                .map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={linkedMissions.includes(m.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setLinkedMissions([...linkedMissions, m.id]);
                        } else {
                          setLinkedMissions(linkedMissions.filter((id) => id !== m.id));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="truncate">{m.titulo}</span>
                  </label>
                ))}
              {existingMissions.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay misiones aún</p>
              )}
            </div>
          </div>

          {/* Nivel y tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">
                Nivel Recomendado
              </label>
              <select
                value={nivelRecomendado}
                onChange={(e) => setNivelRecomendado(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors"
              >
                <option value="1-5">Nivel 1-5</option>
                <option value="5-10">Nivel 5-10</option>
                <option value="11-16">Nivel 11-16</option>
                <option value="17-20">Nivel 17-20</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-display text-gold-light mb-1.5">
                Tags
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="combate, política, exploración"
                className="w-full bg-secondary border border-border rounded-lg px-4 py-3 text-foreground text-base focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          {/* Submit - fixed at bottom on mobile */}
          <div className="sticky bottom-0 pt-3 pb-2 bg-transparent">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-border text-foreground font-display py-3 rounded-lg hover:bg-secondary transition-colors text-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-primary-foreground font-display py-3 rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 text-base"
              >
                {loading ? "Creando..." : "Crear Misión"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMissionDialog;
