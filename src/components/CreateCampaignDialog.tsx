import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateCampaignDialog = ({ open, onClose, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [levelRange, setLevelRange] = useState("1-5");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Debes iniciar sesión");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("campaigns").insert({
      name,
      description: description || null,
      level_range: levelRange,
      user_id: user.id,
    });

    if (error) {
      toast.error("Error creando campaña");
    } else {
      toast.success("¡Campaña creada!");
      setName("");
      setDescription("");
      setLevelRange("1-5");
      onCreated();
      onClose();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="ornate-border rounded-lg p-6 parchment-bg w-full max-w-lg">
        <h2 className="font-display text-2xl text-gold mb-6">Nueva Campaña</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-display text-gold-light mb-1">
              Nombre de la Campaña
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="La Maldición de Strahd..."
              className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-display text-gold-light mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe la premisa de tu campaña..."
              rows={3}
              className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-display text-gold-light mb-1">
              Rango de Nivel
            </label>
            <select
              value={levelRange}
              onChange={(e) => setLevelRange(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
            >
              <option value="1-5">Nivel 1-5 (Tier 1)</option>
              <option value="5-10">Nivel 5-10 (Tier 2)</option>
              <option value="11-16">Nivel 11-16 (Tier 3)</option>
              <option value="17-20">Nivel 17-20 (Tier 4)</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border text-foreground font-display py-2.5 rounded hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground font-display py-2.5 rounded hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear Campaña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCampaignDialog;
