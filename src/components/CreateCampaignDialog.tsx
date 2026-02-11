import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { faerunLocations, getSubregions, getLocations } from "@/data/faerun-locations";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateCampaignDialog = ({ open, onClose, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [levelRange, setLevelRange] = useState("1-5");
  const [region, setRegion] = useState("");
  const [subregion, setSubregion] = useState("");
  const [location, setLocation] = useState("");
  const [tone, setTone] = useState("épico");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const subregions = getSubregions(region);
  const locations = getLocations(region, subregion);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setSubregion("");
    setLocation("");
  };

  const handleSubregionChange = (newSubregion: string) => {
    setSubregion(newSubregion);
    setLocation("");
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

    const { error } = await supabase.from("campaigns").insert({
      name,
      description: description || null,
      level_range: levelRange,
      region: location || region || null,
      tone,
      user_id: user.id,
    });

    if (error) {
      toast.error("Error creando campaña");
    } else {
      toast.success("¡Campaña creada!");
      setName("");
      setDescription("");
      setLevelRange("1-5");
      setRegion("");
      setSubregion("");
      setLocation("");
      setTone("épico");
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
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className="block text-sm font-display text-gold-light mb-1">
                Tono
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
              >
                <option value="épico">Épico</option>
                <option value="oscuro">Oscuro</option>
                <option value="misterioso">Misterioso</option>
                <option value="cómico">Cómico</option>
                <option value="político">Político</option>
                <option value="exploración">Exploración</option>
                <option value="horror">Horror</option>
              </select>
            </div>
           </div>
           <div className="space-y-3">
             <div>
               <label className="block text-sm font-display text-gold-light mb-1">
                 Región Principal
               </label>
               <select
                 value={region}
                 onChange={(e) => handleRegionChange(e.target.value)}
                 className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
               >
                 <option value="">Selecciona una región...</option>
                 {faerunLocations.map((r) => (
                   <option key={r.region_mayor} value={r.region_mayor}>
                     {r.region_mayor}
                   </option>
                 ))}
               </select>
             </div>
             {region && (
               <div>
                 <label className="block text-sm font-display text-gold-light mb-1">
                   Subregión
                 </label>
                 <select
                   value={subregion}
                   onChange={(e) => handleSubregionChange(e.target.value)}
                   className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                 >
                   <option value="">Selecciona una subregión...</option>
                   {subregions.map((s) => (
                     <option key={s} value={s}>
                       {s}
                     </option>
                   ))}
                 </select>
               </div>
             )}
             {subregion && (
               <div>
                 <label className="block text-sm font-display text-gold-light mb-1">
                   Localización
                 </label>
                 <select
                   value={location}
                   onChange={(e) => setLocation(e.target.value)}
                   className="w-full bg-secondary border border-border rounded px-4 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors"
                 >
                   <option value="">Selecciona una localización...</option>
                   {locations.map((loc) => (
                     <option key={loc} value={loc}>
                       {loc}
                     </option>
                   ))}
                 </select>
               </div>
             )}
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
